'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  Participant,
  ChatMessage,
  FloatingReaction,
  RoomData,
  VIDEO_QUALITIES,
  VideoQualityId,
} from '@/lib/types';
import { PeerConnectionManager } from '@/lib/webrtc';
import { sound } from '@/lib/sound';
import { clearEphemeralRoomData, purgeRoomData, checkAndCleanIfRoomEmpty } from '@/lib/roomCleanup';
import { VideoTile } from '@/components/VideoTile';
import { ControlsBar } from '@/components/ControlsBar';
import { ChatPanel } from '@/components/ChatPanel';
import { ParticipantsPanel } from '@/components/ParticipantsPanel';
import { FloatingReactions } from '@/components/FloatingReactions';
import { Lobby } from '@/components/Lobby';
import { MiniCallWindow } from '@/components/MiniCallWindow';
import { CameraSettingsModal } from '@/components/CameraSettingsModal';
import { Info, Copy, Check } from 'lucide-react';

const AVATAR_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#10b981', // emerald
  '#f59e0b', // amber
  '#06b6d4', // cyan
];

export default function MeetingApp() {
  const [isInRoom, setIsInRoom] = useState(false);
  const [roomId, setRoomId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return (params.get('room') || '').toLowerCase();
    }
    return '';
  });
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [isHost, setIsHost] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);

  const connectedPeersRef = useRef<Set<string>>(new Set());

  // Audio / Video / Screen state
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);

  // Hardware devices
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string>('');

  // Video Quality & Camera Settings
  const [videoQuality, setVideoQuality] = useState<VideoQualityId>('720p');
  const [isCameraSettingsOpen, setIsCameraSettingsOpen] = useState(false);
  const meetingStartTimeRef = useRef<number>(0);

  // Media Streams
  const localStreamRef = useRef<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());

  // Firestore Room Realtime State
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // UI Panels
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [copiedLinkBanner, setCopiedLinkBanner] = useState(false);
  const [pipTrigger, setPipTrigger] = useState(0);

  const webrtcManagerRef = useRef<PeerConnectionManager | null>(null);

  // Clock in top left like Zoom / Meet
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Enumerate devices
  useEffect(() => {
    let active = true;
    navigator.mediaDevices?.enumerateDevices().then((devices) => {
      if (!active) return;
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      setAvailableCameras(videoInputs);
    }).catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  // Clean up floating reactions after 3.2 seconds
  useEffect(() => {
    if (floatingReactions.length === 0) return;
    const timer = setTimeout(() => {
      setFloatingReactions((prev) => prev.slice(1));
    }, 3200);
    return () => clearTimeout(timer);
  }, [floatingReactions]);

  // Change video quality dynamically and apply to live track & peer connections
  const handleChangeVideoQuality = async (newQuality: VideoQualityId) => {
    setVideoQuality(newQuality);
    const targetOpt = VIDEO_QUALITIES.find((q) => q.id === newQuality) || VIDEO_QUALITIES[2];

    const videoTrackConstraints: MediaTrackConstraints = {
      ...(activeCameraId ? { deviceId: { exact: activeCameraId } } : { facingMode: 'user' }),
      width: { ideal: targetOpt.width, max: targetOpt.width },
      height: { ideal: targetOpt.height, max: targetOpt.height },
      frameRate: { ideal: targetOpt.frameRate, max: targetOpt.frameRate },
    };

    try {
      let appliedDirectly = false;
      if (localStreamRef.current) {
        const activeTrack = localStreamRef.current.getVideoTracks()[0];
        if (activeTrack && activeTrack.readyState === 'live') {
          try {
            await activeTrack.applyConstraints(videoTrackConstraints);
            const s = activeTrack.getSettings();
            if (s.width && s.width <= targetOpt.width * 1.15) {
              appliedDirectly = true;
            }
          } catch {
            appliedDirectly = false;
          }
        }
      }

      if (!appliedDirectly) {
        const freshStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: videoTrackConstraints,
        });
        const newVideoTrack = freshStream.getVideoTracks()[0];
        newVideoTrack.enabled = !isVideoMuted;

        if (localStreamRef.current) {
          const oldTrack = localStreamRef.current.getVideoTracks()[0];
          if (oldTrack) {
            localStreamRef.current.removeTrack(oldTrack);
            oldTrack.stop();
          }
          localStreamRef.current.addTrack(newVideoTrack);
        }
      }

      if (localStreamRef.current) {
        if (webrtcManagerRef.current) {
          webrtcManagerRef.current.setLocalStream(localStreamRef.current);
          await webrtcManagerRef.current.applyVideoQuality(targetOpt);
        }
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      }
    } catch (err) {
      console.error('[VideoQuality] Error applying quality constraints:', err);
      if (webrtcManagerRef.current) {
        await webrtcManagerRef.current.applyVideoQuality(targetOpt);
      }
    }
  };

  // Change camera device and preserve video quality settings
  const handleChangeCamera = async (deviceId: string) => {
    setActiveCameraId(deviceId);
    const targetOpt = VIDEO_QUALITIES.find((q) => q.id === videoQuality) || VIDEO_QUALITIES[2];

    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: targetOpt.width, max: targetOpt.width },
          height: { ideal: targetOpt.height, max: targetOpt.height },
          frameRate: { ideal: targetOpt.frameRate, max: targetOpt.frameRate },
        },
      };
      const freshStream = await navigator.mediaDevices.getUserMedia(constraints);
      const newVideoTrack = freshStream.getVideoTracks()[0];
      newVideoTrack.enabled = !isVideoMuted;

      if (localStreamRef.current) {
        const oldTrack = localStreamRef.current.getVideoTracks()[0];
        if (oldTrack) {
          localStreamRef.current.removeTrack(oldTrack);
          oldTrack.stop();
        }
        localStreamRef.current.addTrack(newVideoTrack);
        if (webrtcManagerRef.current) {
          webrtcManagerRef.current.setLocalStream(localStreamRef.current);
          await webrtcManagerRef.current.applyVideoQuality(targetOpt);
        }
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      }
    } catch (err) {
      console.error('[Camera] Error changing camera device:', err);
    }
  };

  // Handle joining room from Lobby
  const handleJoinRoom = (
    targetRoom: string,
    userName: string,
    initialAudioMuted: boolean,
    initialVideoMuted: boolean,
    selectedCameraId?: string,
    isNewRoom?: boolean
  ) => {
    const finalName = (userName && userName.trim()) || 'Participante';
    const userId = 'user_' + Math.random().toString(36).substring(2, 9);
    meetingStartTimeRef.current = Date.now();
    setCurrentUserId(userId);
    setDisplayName(finalName);
    setRoomId(targetRoom);
    setIsAudioMuted(initialAudioMuted);
    setIsVideoMuted(initialVideoMuted);
    setNotificationMessage(null);
    connectedPeersRef.current.clear();
    setIsHost(Boolean(isNewRoom));

    // ⚡ INSTANT LAUNCH: Transition to conference view immediately
    setIsInRoom(true);

    // Initialize WebRTC signaling manager immediately
    const rtc = new PeerConnectionManager(
      targetRoom,
      userId,
      (peerId, remoteStream) => {
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.set(peerId, remoteStream);
          return next;
        });
      },
      (peerId) => {
        connectedPeersRef.current.delete(peerId);
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.delete(peerId);
          return next;
        });
      }
    );

    webrtcManagerRef.current = rtc;
    rtc.startListening();

    // 1. If starting a brand new meeting, clean up ephemeral leftovers WITHOUT setting status: 'ended'
    if (isNewRoom) {
      clearEphemeralRoomData(targetRoom).catch(() => {});
    }

    // 2. Concurrently get User Media with chosen quality without blocking room render
    (async () => {
      try {
        const targetOpt = VIDEO_QUALITIES.find((q) => q.id === videoQuality) || VIDEO_QUALITIES[2];
        const constraints: MediaStreamConstraints = {
          audio: true,
          video: {
            ...(selectedCameraId ? { deviceId: { exact: selectedCameraId } } : { facingMode: 'user' }),
            width: { ideal: targetOpt.width },
            height: { ideal: targetOpt.height },
            frameRate: { ideal: targetOpt.frameRate },
          },
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        // Apply initial mute states to tracks
        stream.getAudioTracks().forEach((t) => {
          t.enabled = !initialAudioMuted;
        });
        stream.getVideoTracks().forEach((t) => {
          t.enabled = !initialVideoMuted;
        });

        localStreamRef.current = stream;
        setLocalStream(stream);
        rtc.setLocalStream(stream);

        if (selectedCameraId) {
          setActiveCameraId(selectedCameraId);
        }
      } catch {
        // If mic/camera error, try audio-only or empty stream fallback
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioStream.getAudioTracks().forEach((t) => {
            t.enabled = !initialAudioMuted;
          });
          localStreamRef.current = audioStream;
          setLocalStream(audioStream);
          rtc.setLocalStream(audioStream);
          setIsVideoMuted(true);
        } catch {
          // Continue even without media
        }
      }
    })();

    // 3. Concurrently register room document and participant in Firestore
    (async () => {
      try {
        const roomRef = doc(db, 'rooms', targetRoom);
        let userIsHost = Boolean(isNewRoom);

        if (!isNewRoom) {
          try {
            const roomSnap = await getDoc(roomRef);
            const roomData = roomSnap.data();
            userIsHost = Boolean(!roomSnap.exists() || roomData?.status === 'ended' || roomData?.hostId === userId);
            setIsHost(userIsHost);
          } catch {
            // ignore
          }
        }

        const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
        const participantRef = doc(db, 'rooms', targetRoom, 'participants', userId);

        await Promise.all([
          setDoc(
            roomRef,
            {
              id: targetRoom,
              title: `Sala ${targetRoom}`,
              hostId: userIsHost ? userId : userId,
              createdBy: userIsHost ? userId : userId,
              hostName: finalName,
              lastActive: Date.now(),
              status: 'active',
              endedAt: null, // Clear any past endedAt
            },
            { merge: true }
          ),
          setDoc(participantRef, {
            userId,
            displayName: finalName,
            isAudioMuted: initialAudioMuted,
            isVideoMuted: initialVideoMuted,
            isScreenSharing: false,
            isHandRaised: false,
            joinedAt: Date.now(),
            lastSeen: Date.now(),
            role: userIsHost ? 'host' : 'guest',
            avatarColor: randomColor,
          }),
        ]);
      } catch {
        // ignore
      }
    })();
  };

  // Leave Call / Hangup
  const handleLeaveCall = async () => {
    sound.playHangup();

    const targetRoomId = roomId;
    const leavingUserId = currentUserId;

    // Stop all media tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
      setScreenStream(null);
    }

    // Close WebRTC
    if (webrtcManagerRef.current) {
      await webrtcManagerRef.current.closeAll();
      webrtcManagerRef.current = null;
    }

    // Clear connected peers cache
    connectedPeersRef.current.clear();

    // Reset local state to show Lobby again
    setIsInRoom(false);
    setRemoteStreams(new Map());
    setParticipants([]);
    setMessages([]);
    setIsScreenSharing(false);
    setIsChatOpen(false);
    setIsParticipantsOpen(false);

    // Remove user participant from Firestore.
    // If no active participants remain, purge all chats, reactions, signals, and participants
    // while keeping room metadata intact!
    if (targetRoomId) {
      await checkAndCleanIfRoomEmpty(targetRoomId, leavingUserId);
    }
  };

  const handleLeaveCallRef = useRef(handleLeaveCall);
  useEffect(() => {
    handleLeaveCallRef.current = handleLeaveCall;
  });

  // End Call for Everyone (Host Action)
  const handleEndCallForEveryone = async () => {
    sound.playHangup();

    const targetRoomId = roomId;

    try {
      if (targetRoomId) {
        await purgeRoomData(targetRoomId);
      }
    } catch {
      // ignore
    }

    await handleLeaveCall();
    setNotificationMessage('Você encerrou a reunião para todos os participantes.');
  };

  // Heartbeat to keep participant document active in Firestore & clean stale ghost participants
  useEffect(() => {
    if (!isInRoom || !roomId || !currentUserId) return;
    const interval = setInterval(async () => {
      try {
        const pRef = doc(db, 'rooms', roomId, 'participants', currentUserId);
        await setDoc(pRef, { lastSeen: Date.now() }, { merge: true });

        // Clean up any stale ghost participants that closed tab without leaving
        const pCol = collection(db, 'rooms', roomId, 'participants');
        const pSnap = await getDocs(pCol);
        const now = Date.now();
        pSnap.forEach((d) => {
          const p = d.data() as Participant;
          if (p.userId === currentUserId) return;
          if (now - (p.lastSeen || p.joinedAt || 0) > 45000) {
            deleteDoc(d.ref).catch(() => {});
          }
        });
      } catch {
        // ignore
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [isInRoom, roomId, currentUserId]);

  // Cleanup on window/tab close (beforeunload only)
  useEffect(() => {
    if (!isInRoom || !roomId || !currentUserId) return;

    const handleUnload = () => {
      try {
        const pRef = doc(db, 'rooms', roomId, 'participants', currentUserId);
        deleteDoc(pRef).catch(() => {});
      } catch {
        // ignore
      }
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [isInRoom, roomId, currentUserId]);

  // Sync Firestore Room Realtime Data
  useEffect(() => {
    if (!isInRoom || !roomId || !currentUserId) return;

    // 0. Listen to room document for host end call or role changes
    const roomRef = doc(db, 'rooms', roomId);
    const unsubscribeRoom = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.status === 'ended') {
          // Only auto-end if endedAt was explicitly set and occurred after this meeting session started
          if (data.endedAt && data.endedAt > meetingStartTimeRef.current) {
            sound.playHangup();
            setNotificationMessage('A reunião foi encerrada pelo organizador.');
            handleLeaveCallRef.current();
          }
        } else if (data.hostId === currentUserId) {
          setIsHost(true);
        }
      }
    });

    // 1. Listen to participants
    const participantsRef = collection(db, 'rooms', roomId, 'participants');
    const unsubscribeParticipants = onSnapshot(participantsRef, (snapshot) => {
      const list: Participant[] = [];
      const seen = new Set<string>();
      snapshot.forEach((d) => {
        const data = d.data() as Participant;
        if (data.userId && !seen.has(data.userId)) {
          seen.add(data.userId);
          list.push(data);
        }
      });
      setParticipants(list);

      // Connect to any new peer that joined (deterministic initiator)
      list.forEach((p) => {
        if (p.userId !== currentUserId && webrtcManagerRef.current) {
          if (!connectedPeersRef.current.has(p.userId)) {
            connectedPeersRef.current.add(p.userId);
            // Deterministic initiator: only peer with greater userId initiates offer
            if (currentUserId > p.userId) {
              webrtcManagerRef.current.connectToPeer(p.userId);
            }
          }
        }
      });
    });

    // 2. Listen to chat messages
    const messagesRef = collection(db, 'rooms', roomId, 'messages');
    const unsubscribeMessages = onSnapshot(messagesRef, (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((d) => {
        msgs.push({ id: d.id, ...(d.data() as Omit<ChatMessage, 'id'>) });
      });
      msgs.sort((a, b) => a.timestamp - b.timestamp);
      setMessages(msgs);

      // Play message sound for new incoming messages from others
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          if (data.senderId !== currentUserId) {
            sound.playMessage();
            if (!isChatOpen) {
              setUnreadChatCount((prev) => prev + 1);
            }
          }
        }
      });
    });

    // 3. Listen to emoji reactions
    const reactionsRef = collection(db, 'rooms', roomId, 'reactions');
    const unsubscribeReactions = onSnapshot(reactionsRef, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data() as FloatingReaction;
          setFloatingReactions((prev) => [
            ...prev,
            {
              ...data,
              id: change.doc.id,
              xOffset: 30 + Math.random() * 40,
            },
          ]);
        }
      });
    });

    return () => {
      unsubscribeRoom();
      unsubscribeParticipants();
      unsubscribeMessages();
      unsubscribeReactions();
    };
  }, [isInRoom, roomId, currentUserId, isChatOpen]);

  // Toggle Audio Track
  const handleToggleAudio = async () => {
    const nextState = !isAudioMuted;
    setIsAudioMuted(nextState);

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !nextState;
      });
    }

    // Update firestore participant doc
    try {
      const pRef = doc(db, 'rooms', roomId, 'participants', currentUserId);
      await setDoc(pRef, { isAudioMuted: nextState }, { merge: true });
    } catch {
      // ignore
    }
  };

  // Toggle Video Track
  const handleToggleVideo = async () => {
    const nextState = !isVideoMuted;
    setIsVideoMuted(nextState);

    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !nextState;
      });
    }

    try {
      const pRef = doc(db, 'rooms', roomId, 'participants', currentUserId);
      await setDoc(pRef, { isVideoMuted: nextState }, { merge: true });
    } catch {
      // ignore
    }
  };

  // Switch Camera (Mobile / Webcams)
  const handleSwitchCamera = async () => {
    if (availableCameras.length <= 1 || !localStreamRef.current) return;
    const currentIndex = availableCameras.findIndex((d) => d.deviceId === activeCameraId);
    const nextIndex = (currentIndex + 1) % availableCameras.length;
    const nextDevice = availableCameras[nextIndex];

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: nextDevice.deviceId } },
        audio: false,
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];

      if (oldVideoTrack) {
        localStreamRef.current.removeTrack(oldVideoTrack);
        oldVideoTrack.stop();
      }

      localStreamRef.current.addTrack(newVideoTrack);
      setActiveCameraId(nextDevice.deviceId);

      // Inform WebRTC peer connections
      if (webrtcManagerRef.current) {
        webrtcManagerRef.current.setLocalStream(localStreamRef.current);
      }
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
    } catch {
      // switch camera fallback
    }
  };

  // Screen Sharing (Low latency WebRTC native displayMedia)
  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      // Stop sharing
      if (screenStream) {
        screenStream.getTracks().forEach((t) => t.stop());
        setScreenStream(null);
      }
      setIsScreenSharing(false);

      if (webrtcManagerRef.current) {
        webrtcManagerRef.current.setScreenStream(null);
      }

      try {
        const pRef = doc(db, 'rooms', roomId, 'participants', currentUserId);
        await setDoc(pRef, { isScreenSharing: false }, { merge: true });
      } catch {
        // ignore
      }
    } else {
      // Start sharing
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            frameRate: { ideal: 30, max: 60 }, // Smooth low latency
          },
          audio: false,
        });

        setScreenStream(stream);
        setIsScreenSharing(true);

        if (webrtcManagerRef.current) {
          webrtcManagerRef.current.setScreenStream(stream);
        }

        // When user clicks native browser "Stop sharing" button
        stream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          setScreenStream(null);
          if (webrtcManagerRef.current) {
            webrtcManagerRef.current.setScreenStream(null);
          }
          const pRef = doc(db, 'rooms', roomId, 'participants', currentUserId);
          setDoc(pRef, { isScreenSharing: false }, { merge: true }).catch(() => {});
        };

        try {
          const pRef = doc(db, 'rooms', roomId, 'participants', currentUserId);
          await setDoc(pRef, { isScreenSharing: true }, { merge: true });
        } catch {
          // ignore
        }
      } catch {
        // Screen share canceled by user
      }
    }
  };

  // Raise Hand
  const handleToggleHandRaise = async () => {
    const nextState = !isHandRaised;
    setIsHandRaised(nextState);
    try {
      const pRef = doc(db, 'rooms', roomId, 'participants', currentUserId);
      await setDoc(pRef, { isHandRaised: nextState }, { merge: true });
    } catch {
      // ignore
    }
  };

  // Send Floating Reaction
  const handleSendReaction = async (emoji: string) => {
    try {
      const reactionDoc = doc(collection(db, 'rooms', roomId, 'reactions'));
      await setDoc(reactionDoc, {
        emoji,
        senderName: displayName,
        senderId: currentUserId,
        timestamp: Date.now(),
      });
    } catch {
      // ignore
    }
  };

  // Send Chat Message
  const handleSendMessage = async (text: string) => {
    try {
      const messageDoc = doc(collection(db, 'rooms', roomId, 'messages'));
      await setDoc(messageDoc, {
        senderId: currentUserId,
        senderName: displayName,
        text,
        timestamp: Date.now(),
      });
    } catch {
      // ignore
    }
  };

  // Copy meeting link
  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}?room=${roomId}`;
      navigator.clipboard.writeText(url);
      setCopiedLinkBanner(true);
      setTimeout(() => setCopiedLinkBanner(false), 2500);
    }
  };

  // If not inside a room, render Lobby
  if (!isInRoom) {
    return (
      <Lobby
        initialRoomId={roomId}
        onJoinRoom={handleJoinRoom}
        notificationMessage={notificationMessage}
      />
    );
  }

  // Active call participants (Local + Remotes with strict deduplication)
  const myUserId = currentUserId;
  const localParticipant: Participant = {
    userId: myUserId,
    displayName: displayName || 'Você',
    isAudioMuted,
    isVideoMuted,
    isScreenSharing,
    isHandRaised,
    joinedAt: 0,
    lastSeen: 0,
    role: isHost ? 'host' : 'guest',
    avatarColor: '#3b82f6',
  };

  const seenUserIds = new Set<string>();
  if (myUserId) seenUserIds.add(myUserId);

  const uniqueRemoteParticipants: Participant[] = [];
  for (const p of participants) {
    if (!p.userId || seenUserIds.has(p.userId)) continue;
    seenUserIds.add(p.userId);
    uniqueRemoteParticipants.push(p);
  }

  const activeTileStream = isScreenSharing && screenStream ? screenStream : localStream;
  const allTiles = [
    { participant: localParticipant, stream: activeTileStream, isLocal: true },
    ...uniqueRemoteParticipants.map((p) => ({
      participant: p,
      stream: remoteStreams.get(p.userId) || null,
      isLocal: false,
    })),
  ];

  // Dynamic Grid layout calculation
  const totalCount = allTiles.length;
  let gridColsClass = 'grid-cols-1';
  if (totalCount === 2) gridColsClass = 'grid-cols-1 md:grid-cols-2';
  else if (totalCount >= 3 && totalCount <= 4) gridColsClass = 'grid-cols-1 sm:grid-cols-2';
  else if (totalCount >= 5 && totalCount <= 6) gridColsClass = 'grid-cols-2 md:grid-cols-3';
  else if (totalCount > 6) gridColsClass = 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';

  return (
    <div className="relative h-screen h-[100dvh] w-screen max-w-full bg-[#202124] text-[#e8eaed] flex flex-col overflow-hidden select-none">
      {/* Top Header Bar with VideoMeet Logo, Room ID and Clock */}
      <header className="h-12 sm:h-14 px-3 sm:px-6 flex items-center justify-between shrink-0 z-20 border-b border-[#3c4043]/40 bg-[#202124]">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-lg overflow-hidden bg-[#28292c] flex items-center justify-center border border-[#3c4043]/60 shadow-sm shrink-0">
            <Image
              src="/logo_video_bonito.png"
              alt="VideoMeet"
              fill
              className="object-contain p-0.5"
              referrerPolicy="no-referrer"
            />
          </div>
          <span className="font-semibold text-sm sm:text-base tracking-tight text-[#e8eaed] flex items-center">
            Video<span className="text-[#8ab4f8]">Meet</span>
          </span>
          <span className="text-[#9aa0a6] text-xs sm:text-sm">|</span>
          <span className="text-xs sm:text-sm font-mono text-[#e8eaed]">{roomId}</span>
          <button
            id="btn-header-copy-link"
            onClick={handleCopyLink}
            title="Copiar link da reunião"
            className="p-1 rounded-full hover:bg-[#3c4043] text-[#9aa0a6] hover:text-white transition-colors cursor-pointer"
          >
            {copiedLinkBanner ? <Check className="w-3.5 h-3.5 text-[#81c995]" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs sm:text-sm text-[#9aa0a6]">
          <span className="font-medium text-[#e8eaed]">{currentTime}</span>
        </div>
      </header>

      {/* Main Video Tiles Grid Container (flex-1 min-h-0 prevents pushing the bottom bar offscreen) */}
      <main
        id="video-tiles-grid"
        className={`flex-1 min-h-0 p-2 sm:p-4 md:p-5 grid ${gridColsClass} gap-2.5 sm:gap-4 items-center justify-center auto-rows-fr max-w-7xl mx-auto w-full overflow-hidden transition-all duration-200`}
      >
        {allTiles.map(({ participant, stream, isLocal }) => (
          <VideoTile
            key={participant.userId}
            participant={participant}
            stream={stream}
            isLocal={isLocal}
            isSpeaking={!participant.isAudioMuted}
            onOpenSettings={isLocal ? () => setIsCameraSettingsOpen(true) : undefined}
            onToggleVideo={isLocal ? handleToggleVideo : undefined}
            currentQuality={isLocal ? videoQuality : undefined}
          />
        ))}
      </main>

      {/* Floating Emoji Reactions Overlay */}
      <FloatingReactions reactions={floatingReactions} />

      {/* Bottom Controls Bar (always visible and pinned) */}
      <ControlsBar
        isAudioMuted={isAudioMuted}
        isVideoMuted={isVideoMuted}
        isScreenSharing={isScreenSharing}
        isHandRaised={isHandRaised}
        unreadChatCount={unreadChatCount}
        participantsCount={allTiles.length}
        availableCameras={availableCameras}
        activeCameraId={activeCameraId}
        isChatOpen={isChatOpen}
        isParticipantsOpen={isParticipantsOpen}
        currentTime={currentTime}
        isHost={isHost}
        onToggleAudio={handleToggleAudio}
        onToggleVideo={handleToggleVideo}
        onToggleScreenShare={handleToggleScreenShare}
        onToggleHandRaise={handleToggleHandRaise}
        onSwitchCamera={handleSwitchCamera}
        onSendReaction={handleSendReaction}
        onToggleChat={() => {
          setIsChatOpen(!isChatOpen);
          if (!isChatOpen) setUnreadChatCount(0);
        }}
        onToggleParticipants={() => setIsParticipantsOpen(!isParticipantsOpen)}
        onLeaveCall={handleLeaveCall}
        onEndCallForEveryone={handleEndCallForEveryone}
        onOpenPiP={() => setPipTrigger((prev) => prev + 1)}
        onOpenSettings={() => setIsCameraSettingsOpen(true)}
        roomId={roomId}
      />

      {/* Camera & Video Quality Settings Modal */}
      <CameraSettingsModal
        isOpen={isCameraSettingsOpen}
        onClose={() => setIsCameraSettingsOpen(false)}
        currentQuality={videoQuality}
        onChangeQuality={handleChangeVideoQuality}
        availableCameras={availableCameras}
        activeCameraId={activeCameraId}
        onChangeCamera={handleChangeCamera}
        isVideoMuted={isVideoMuted}
        onToggleVideo={handleToggleVideo}
        localStream={localStream}
      />

      {/* Mini Floating Window / Picture-in-Picture on PC */}
      <MiniCallWindow
        roomId={roomId}
        isAudioMuted={isAudioMuted}
        isVideoMuted={isVideoMuted}
        participantsCount={allTiles.length}
        displayName={displayName}
        onToggleAudio={handleToggleAudio}
        onToggleVideo={handleToggleVideo}
        onLeaveCall={handleLeaveCall}
        isInRoom={isInRoom}
        openTrigger={pipTrigger}
      />

      {/* Slide-in Chat Panel */}
      <ChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={messages}
        onSendMessage={handleSendMessage}
        currentUserId={currentUserId}
      />

      {/* Slide-in Participants Panel */}
      <ParticipantsPanel
        isOpen={isParticipantsOpen}
        onClose={() => setIsParticipantsOpen(false)}
        participants={participants}
        currentUserId={currentUserId}
      />
    </div>
  );
}
