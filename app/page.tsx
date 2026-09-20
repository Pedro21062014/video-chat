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
import { WhatsAppTwoPartyView } from '@/components/WhatsAppTwoPartyView';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useIsMobile } from '@/hooks/use-mobile';
import { AudioActivityDetector } from '@/lib/audioDetector';
import {
  registerCallSession,
  sendCallHeartbeat,
  leaveCallSession,
} from '@/lib/callsLimit';
import { Info, Copy, Check, LayoutGrid, Volume2, UserCheck, Sparkles } from 'lucide-react';

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
  const [roomId, setRoomId] = useState<string>('');
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
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  useEffect(() => {
    remoteStreamsRef.current = remoteStreams;
  }, [remoteStreams]);

  // Firestore Room Realtime State
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // UI Panels
  const [isChatOpen, setIsChatOpen] = useState(false);
  const isChatOpenRef = useRef(isChatOpen);
  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
  }, [isChatOpen]);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [copiedLinkBanner, setCopiedLinkBanner] = useState(false);
  const [pipTrigger, setPipTrigger] = useState(0);
  const [twoPartyViewMode, setTwoPartyViewMode] = useState<'whatsapp' | 'grid'>('whatsapp');
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [pinnedSpeakerId, setPinnedSpeakerId] = useState<string | null>(null);
  const [speakingUsersMap, setSpeakingUsersMap] = useState<Map<string, boolean>>(new Map());
  const [speakerViewOverride, setSpeakerViewOverride] = useState<'speaker' | 'grid' | 'auto'>('auto');
  const audioDetectorRef = useRef<AudioActivityDetector | null>(null);
  const isMobile = useIsMobile();

  const webrtcManagerRef = useRef<PeerConnectionManager | null>(null);

  // Safe Client Initialization: Detect URL parameter and clean up previous local session if reloaded
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      // If there was an old session stored, clean it up
      try {
        const lastActiveRoom = sessionStorage.getItem('active_call_room');
        const lastActiveUser = sessionStorage.getItem('active_call_user');
        if (lastActiveRoom && lastActiveUser) {
          deleteDoc(doc(db, 'rooms', lastActiveRoom, 'participants', lastActiveUser)).catch(() => {});
          leaveCallSession(lastActiveRoom, lastActiveUser).catch(() => {});
        }
        sessionStorage.removeItem('active_call_room');
        sessionStorage.removeItem('active_call_user');
      } catch {
        // ignore
      }

      // Check query parameter ?room=... and retain it!
      const params = new URLSearchParams(window.location.search);
      const queryRoom = (params.get('room') || '').toLowerCase().trim();
      if (queryRoom) {
        const timer = setTimeout(() => {
          setRoomId(queryRoom);
        }, 0);
        return () => clearTimeout(timer);
      }
    } catch (err) {
      console.warn('Safe client init warning:', err);
    }
  }, []);

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
    isNewRoom?: boolean,
    existingStream?: MediaStream | null
  ) => {
    const finalName = (userName && userName.trim()) || 'Participante';
    const userId = 'usr' + Math.random().toString(36).substring(2, 10);
    meetingStartTimeRef.current = Date.now();
    setCurrentUserId(userId);
    setDisplayName(finalName);
    setRoomId(targetRoom);
    setIsAudioMuted(initialAudioMuted);
    setIsVideoMuted(initialVideoMuted);
    setNotificationMessage(null);
    connectedPeersRef.current.clear();
    setIsHost(Boolean(isNewRoom));

    // Register active call session for IP rate limiting & reload recovery
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('active_call_room', targetRoom);
      sessionStorage.setItem('active_call_user', userId);
      registerCallSession(targetRoom, userId, Boolean(isNewRoom)).catch(() => {});
    }

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
    rtc.startListening(existingStream && !initialVideoMuted ? existingStream : null);

    // 1. If starting a brand new meeting, clean up ephemeral leftovers (excluding active user)
    if (isNewRoom) {
      clearEphemeralRoomData(targetRoom, userId).catch(() => {});
    }

    // 2. Concurrently get User Media with chosen quality without blocking room render
    (async () => {
      try {
        // A. If existingStream from Lobby is already live, seamlessly reuse it so camera never disappears!
        if (existingStream && !initialVideoMuted) {
          const liveVideoTrack = existingStream.getVideoTracks().find((t) => t.readyState === 'live');
          if (liveVideoTrack) {
            liveVideoTrack.enabled = !initialVideoMuted;
            const newStream = new MediaStream([liveVideoTrack]);
            localStreamRef.current = newStream;
            setLocalStream(newStream);
            rtc.setLocalStream(newStream);

            // Acquire audio track if unmuted
            if (!initialAudioMuted) {
              try {
                const audioMedia = await navigator.mediaDevices.getUserMedia({ audio: true });
                const audioTrack = audioMedia.getAudioTracks()[0];
                if (audioTrack) {
                  audioTrack.enabled = !initialAudioMuted;
                  newStream.addTrack(audioTrack);
                  rtc.setLocalStream(newStream);
                  setLocalStream(new MediaStream(newStream.getTracks()));
                }
              } catch {
                // Ignore audio error
              }
            }
            return;
          }
        }

        // B. Acquire fresh media stream
        const targetOpt = VIDEO_QUALITIES.find((q) => q.id === videoQuality) || VIDEO_QUALITIES[2];
        let stream: MediaStream | null = null;

        if (!initialVideoMuted) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: selectedCameraId
                ? { deviceId: { ideal: selectedCameraId }, width: { ideal: targetOpt.width }, height: { ideal: targetOpt.height }, frameRate: { ideal: targetOpt.frameRate } }
                : { facingMode: 'user', width: { ideal: targetOpt.width }, height: { ideal: targetOpt.height }, frameRate: { ideal: targetOpt.frameRate } },
              audio: !initialAudioMuted,
            });
          } catch {
            // Fallback: try basic video with audio
            try {
              stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: !initialAudioMuted,
              });
            } catch {
              // Video permission failed or camera busy; try audio only
              try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                setIsVideoMuted(true);
              } catch {
                stream = new MediaStream();
                setIsVideoMuted(true);
                setIsAudioMuted(true);
              }
            }
          }
        } else {
          // Video starts muted: acquire audio only
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: !initialAudioMuted });
          } catch {
            stream = new MediaStream();
          }
        }

        if (stream) {
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
        }
      } catch {
        // Last fallback: audio only if camera is blocked/denied
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
            if (roomSnap.exists()) {
              const roomData = roomSnap.data();
              // A participant joining an existing room is ONLY host if they are the original host
              userIsHost = Boolean(roomData?.hostId && roomData.hostId === userId);
            } else {
              userIsHost = false;
            }
          } catch {
            userIsHost = false;
          }
          setIsHost(userIsHost);
        } else {
          setIsHost(true);
        }

        const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
        const participantRef = doc(db, 'rooms', targetRoom, 'participants', userId);

        if (userIsHost) {
          // Host creates or reclaims room
          await Promise.all([
            setDoc(
              roomRef,
              {
                id: targetRoom,
                title: `Sala ${targetRoom}`,
                hostId: userId,
                createdBy: userId,
                hostName: finalName,
                lastActive: Date.now(),
                status: 'active',
                endedAt: null,
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
              role: 'host',
              avatarColor: randomColor,
            }),
          ]);
        } else {
          // Participant joining existing room NEVER overrides hostId
          await Promise.all([
            setDoc(
              roomRef,
              {
                lastActive: Date.now(),
                status: 'active',
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
              role: 'guest',
              avatarColor: randomColor,
            }),
          ]);
        }
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

    // Clean up audio activity detector
    if (audioDetectorRef.current) {
      audioDetectorRef.current.destroy();
      audioDetectorRef.current = null;
    }
    setActiveSpeakerId(null);
    setPinnedSpeakerId(null);
    setSpeakingUsersMap(new Map());

    // Reset local state to show Lobby again
    setIsInRoom(false);
    setRemoteStreams(new Map());
    setParticipants([]);
    setMessages([]);
    setIsScreenSharing(false);
    setIsChatOpen(false);
    setIsParticipantsOpen(false);

    // Release call limiter session
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('active_call_room');
      sessionStorage.removeItem('active_call_user');
      leaveCallSession(targetRoomId, leavingUserId).catch(() => {});
    }

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
    // Strictly forbid non-hosts/guests from ending the meeting for everyone
    if (!isHost) {
      await handleLeaveCall();
      return;
    }

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

  // Heartbeat to keep participant document active in Firestore & active IP calls slot active
  useEffect(() => {
    if (!isInRoom || !roomId || !currentUserId) return;
    const interval = setInterval(async () => {
      try {
        const pRef = doc(db, 'rooms', roomId, 'participants', currentUserId);
        await setDoc(pRef, { lastSeen: Date.now() }, { merge: true });

        // Heartbeat to call limit session
        sendCallHeartbeat(roomId, currentUserId).catch(() => {});
      } catch {
        // ignore
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [isInRoom, roomId, currentUserId]);

  // Cleanup on window/tab close (beforeunload and pagehide)
  useEffect(() => {
    if (!isInRoom || !roomId || !currentUserId) return;

    const handleUnload = () => {
      try {
        leaveCallSession(roomId, currentUserId).catch(() => {});
      } catch {
        // ignore
      }

      try {
        const pRef = doc(db, 'rooms', roomId, 'participants', currentUserId);
        deleteDoc(pRef).catch(() => {});
      } catch {
        // ignore
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
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

      // Synchronize and supervise active WebRTC peer connections
      if (webrtcManagerRef.current) {
        const remoteUserIds = list
          .map((p) => p.userId)
          .filter((id) => id && id !== currentUserId);
        webrtcManagerRef.current.syncParticipants(remoteUserIds);
      }
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
            if (!isChatOpenRef.current) {
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
  }, [isInRoom, roomId, currentUserId]);

  // Realtime Web Audio Speaking Activity Detector
  useEffect(() => {
    if (!isInRoom || !roomId || !currentUserId) {
      if (audioDetectorRef.current) {
        audioDetectorRef.current.destroy();
        audioDetectorRef.current = null;
      }
      return;
    }

    if (!audioDetectorRef.current) {
      audioDetectorRef.current = new AudioActivityDetector((speakingMap, loudSpeakerId) => {
        setSpeakingUsersMap(new Map(speakingMap));
        if (loudSpeakerId) {
          setActiveSpeakerId(loudSpeakerId);
        }
      });
    }

    // Register local stream
    audioDetectorRef.current.registerStream(currentUserId, localStream, isAudioMuted);

    // Register all remote streams
    remoteStreams.forEach((stream, peerId) => {
      const p = participants.find((part) => part.userId === peerId);
      audioDetectorRef.current?.registerStream(peerId, stream, Boolean(p?.isAudioMuted));
    });
  }, [isInRoom, roomId, currentUserId, localStream, isAudioMuted, remoteStreams, participants]);

  // Toggle Audio Track
  const handleToggleAudio = async () => {
    const nextState = !isAudioMuted;
    setIsAudioMuted(nextState);

    try {
      const pRef = doc(db, 'rooms', roomId, 'participants', currentUserId);
      await setDoc(pRef, { isAudioMuted: nextState }, { merge: true });
    } catch {
      // ignore
    }

    if (nextState) {
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
      }
      return;
    }

    // Unmuting mic
    const existingAudio = localStreamRef.current?.getAudioTracks().find((t) => t.readyState === 'live');
    if (existingAudio) {
      existingAudio.enabled = true;
      return;
    }

    // Acquire mic if missing
    try {
      const newAudio = await navigator.mediaDevices.getUserMedia({ audio: true });
      const newTrack = newAudio.getAudioTracks()[0];
      if (newTrack) {
        newTrack.enabled = true;
        if (!localStreamRef.current) {
          localStreamRef.current = new MediaStream([newTrack]);
        } else {
          localStreamRef.current.addTrack(newTrack);
        }
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        if (webrtcManagerRef.current) {
          webrtcManagerRef.current.setLocalStream(localStreamRef.current);
        }
      }
    } catch (err) {
      console.warn('Failed to acquire microphone on toggle:', err);
      setIsAudioMuted(true);
    }
  };

  // Toggle Video Track
  const handleToggleVideo = async () => {
    const nextState = !isVideoMuted;
    setIsVideoMuted(nextState);

    try {
      const pRef = doc(db, 'rooms', roomId, 'participants', currentUserId);
      await setDoc(pRef, { isVideoMuted: nextState }, { merge: true });
    } catch {
      // ignore
    }

    if (nextState) {
      // Muting video
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach((track) => {
          track.enabled = false;
        });
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      }
      return;
    }

    // Unmuting video (Turning camera ON)
    const existingLiveTrack = localStreamRef.current?.getVideoTracks().find((t) => t.readyState === 'live');
    if (existingLiveTrack) {
      existingLiveTrack.enabled = true;
      if (localStreamRef.current) {
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        if (webrtcManagerRef.current) {
          webrtcManagerRef.current.setLocalStream(localStreamRef.current);
        }
      }
      return;
    }

    // If no live video track exists in localStream, actively acquire camera!
    try {
      const targetOpt = VIDEO_QUALITIES.find((q) => q.id === videoQuality) || VIDEO_QUALITIES[2];
      const newMedia = await navigator.mediaDevices.getUserMedia({
        video: activeCameraId
          ? { deviceId: { ideal: activeCameraId }, width: { ideal: targetOpt.width }, height: { ideal: targetOpt.height } }
          : { facingMode: 'user', width: { ideal: targetOpt.width }, height: { ideal: targetOpt.height } },
        audio: false,
      });

      const newTrack = newMedia.getVideoTracks()[0];
      if (newTrack) {
        newTrack.enabled = true;
        if (!localStreamRef.current) {
          localStreamRef.current = new MediaStream([newTrack]);
        } else {
          localStreamRef.current.getVideoTracks().forEach((t) => {
            localStreamRef.current?.removeTrack(t);
            t.stop();
          });
          localStreamRef.current.addTrack(newTrack);
        }

        const freshStream = new MediaStream(localStreamRef.current.getTracks());
        setLocalStream(freshStream);
        if (webrtcManagerRef.current) {
          webrtcManagerRef.current.setLocalStream(localStreamRef.current);
        }
      }
    } catch (err) {
      console.warn('Failed to acquire camera on toggle:', err);
      setIsVideoMuted(true);
      try {
        const pRef = doc(db, 'rooms', roomId, 'participants', currentUserId);
        await setDoc(pRef, { isVideoMuted: true }, { merge: true });
      } catch {
        // ignore
      }
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
      <ErrorBoundary
        fallbackTitle="Lobby Protegido"
        fallbackDescription="O lobby encontrou uma instabilidade temporária e foi restaurado com segurança."
        onReset={() => {
          setIsInRoom(false);
          setRoomId('');
        }}
      >
        <Lobby
          key={roomId || 'lobby-root'}
          initialRoomId={roomId}
          onJoinRoom={handleJoinRoom}
          notificationMessage={notificationMessage}
        />
      </ErrorBoundary>
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

  // Dynamic Grid & Speaker Spotlight layout calculation
  const totalCount = allTiles.length;

  // 1. Mobile 2-party view: WhatsApp full screen + PIP draggable corner box
  const shouldRenderWhatsAppView =
    isMobile &&
    totalCount === 2 &&
    twoPartyViewMode === 'whatsapp' &&
    uniqueRemoteParticipants.length > 0 &&
    Boolean(uniqueRemoteParticipants[0]);

  // 2. 2 participants on desktop / tablet
  const isTwoParticipants = totalCount === 2;

  // 3. 3 participants: 3 vertical rectangles side-by-side
  const isThreeParticipants = totalCount === 3;

  // 4. 4 participants: 2x2 grid of 4 equal rectangles
  const isFourParticipants = totalCount === 4;

  // 5. >4 participants: Active Speaker Spotlight View
  const isMoreThanFour = totalCount > 4;
  const isSpeakerSpotlightView = isMoreThanFour && speakerViewOverride !== 'grid';

  // For Speaker Spotlight: determine who is in full screen stage
  const spotlightUserId =
    pinnedSpeakerId ||
    activeSpeakerId ||
    (uniqueRemoteParticipants[0]?.userId) ||
    currentUserId;

  const spotlightTile = allTiles.find((t) => t.participant.userId === spotlightUserId) || allTiles[0];
  const filmstripTiles = allTiles.filter((t) => t.participant.userId !== spotlightTile.participant.userId);

  return (
    <ErrorBoundary
      fallbackTitle="Interface da Chamada Protegida"
      fallbackDescription="A interface da chamada detectou uma instabilidade e foi protegida com segurança."
      onReset={() => {
        setTwoPartyViewMode('grid');
        setSpeakerViewOverride('auto');
      }}
    >
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

        <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-[#9aa0a6]">
          {totalCount === 2 && isMobile && (
            <button
              id="btn-toggle-two-party-view"
              onClick={() => setTwoPartyViewMode((prev) => (prev === 'whatsapp' ? 'grid' : 'whatsapp'))}
              title="Alternar entre modo WhatsApp e grade lado a lado"
              className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#3c4043]/60 hover:bg-[#3c4043] text-[#e8eaed] flex items-center gap-1.5 transition-colors cursor-pointer border border-[#3c4043]"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-[#8ab4f8]" />
              <span className="hidden sm:inline">
                {twoPartyViewMode === 'whatsapp' ? 'Lado a lado' : 'Estilo WhatsApp'}
              </span>
            </button>
          )}

          {isMoreThanFour && (
            <button
              id="btn-toggle-speaker-view"
              onClick={() => setSpeakerViewOverride((prev) => (prev === 'grid' ? 'auto' : 'grid'))}
              title="Alternar entre modo orador ativo e grade de participantes"
              className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#3c4043]/60 hover:bg-[#3c4043] text-[#e8eaed] flex items-center gap-1.5 transition-colors cursor-pointer border border-[#3c4043]"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-[#8ab4f8]" />
              <span>{speakerViewOverride === 'grid' ? 'Modo Orador' : 'Modo Grade'}</span>
            </button>
          )}

          <span className="font-medium text-[#e8eaed]">{currentTime}</span>
        </div>
      </header>

      {/* Main Video Area */}
      {shouldRenderWhatsAppView ? (
        <ErrorBoundary
          fallbackTitle="Visualização Restaurada"
          fallbackDescription="A visualização estilo WhatsApp encontrou uma instabilidade gráfica e foi revertida com segurança para a grade padrão."
          onReset={() => setTwoPartyViewMode('grid')}
        >
          <WhatsAppTwoPartyView
            localParticipant={localParticipant}
            remoteParticipant={uniqueRemoteParticipants[0]}
            localStream={activeTileStream}
            remoteStream={remoteStreams.get(uniqueRemoteParticipants[0].userId) || null}
            currentQuality={videoQuality}
            onOpenSettings={() => setIsCameraSettingsOpen(true)}
            onToggleVideo={handleToggleVideo}
          />
        </ErrorBoundary>
      ) : isSpeakerSpotlightView ? (
        /* > 4 Participants: Speaker Spotlight View (Orador em destaque inteiro + miniaturas abaixo) */
        <main
          id="speaker-spotlight-container"
          className="relative flex-1 min-h-0 w-full flex flex-col overflow-hidden max-w-7xl mx-auto p-2 sm:p-4 gap-2.5"
        >
          {/* Spotlight Header Sub-bar */}
          <div className="flex items-center justify-between px-2 text-xs text-[#9aa0a6] shrink-0">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 bg-[#3c4043]/80 px-3 py-1 rounded-full text-white font-medium border border-white/10 shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-[#8ab4f8]" />
                <span className="text-[#9aa0a6]">Orador:</span>
                <span className="text-[#8ab4f8] font-semibold">
                  {spotlightTile.isLocal ? 'Você' : spotlightTile.participant.displayName}
                </span>
                {pinnedSpeakerId && (
                  <span className="text-[10px] bg-[#8ab4f8]/20 text-[#8ab4f8] px-1.5 py-0.5 rounded font-normal">
                    Fixado
                  </span>
                )}
              </span>
              {pinnedSpeakerId && (
                <button
                  onClick={() => setPinnedSpeakerId(null)}
                  className="hover:text-white underline cursor-pointer text-xs transition-colors"
                >
                  Voltar ao foco automático
                </button>
              )}
            </div>

            <span className="text-[11px] text-[#9aa0a6]">
              {totalCount} participantes na chamada
            </span>
          </div>

          {/* Primary Spotlight Large Video Tile */}
          <div className="relative flex-1 min-h-0 w-full rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl bg-[#202124] border border-[#3c4043]">
            <VideoTile
              key={spotlightTile.participant.userId}
              participant={spotlightTile.participant}
              stream={spotlightTile.stream}
              isLocal={spotlightTile.isLocal}
              isSpeaking={speakingUsersMap.get(spotlightTile.participant.userId) ?? !spotlightTile.participant.isAudioMuted}
              onOpenSettings={spotlightTile.isLocal ? () => setIsCameraSettingsOpen(true) : undefined}
              onToggleVideo={spotlightTile.isLocal ? handleToggleVideo : undefined}
              currentQuality={spotlightTile.isLocal ? videoQuality : undefined}
            />
          </div>

          {/* Bottom Filmstrip Carousel */}
          <div className="h-24 sm:h-32 md:h-36 w-full shrink-0 flex gap-2.5 sm:gap-3 overflow-x-auto px-1 py-1 scrollbar-thin">
            {filmstripTiles.map(({ participant, stream, isLocal }) => {
              const isSpeaking = speakingUsersMap.get(participant.userId) ?? !participant.isAudioMuted;
              return (
                <div
                  key={participant.userId}
                  onClick={() => setPinnedSpeakerId(participant.userId)}
                  title="Clique para fixar como orador principal"
                  className="h-full aspect-[4/3] sm:aspect-video shrink-0 cursor-pointer rounded-xl overflow-hidden relative border-2 transition-all hover:scale-102 hover:border-[#8ab4f8] shadow-md group bg-[#28292c]"
                  style={{
                    borderColor: isSpeaking ? '#81c995' : 'rgba(255, 255, 255, 0.15)',
                  }}
                >
                  <VideoTile
                    participant={participant}
                    stream={stream}
                    isLocal={isLocal}
                    isSpeaking={isSpeaking}
                    onOpenSettings={isLocal ? () => setIsCameraSettingsOpen(true) : undefined}
                    onToggleVideo={isLocal ? handleToggleVideo : undefined}
                    currentQuality={isLocal ? videoQuality : undefined}
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none z-20">
                    <span className="text-[11px] bg-black/80 px-2 py-1 rounded-md text-white font-medium flex items-center gap-1 shadow">
                      <UserCheck className="w-3 h-3 text-[#8ab4f8]" />
                      Destacar
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      ) : (
        /* Main Video Tiles Grid Container */
        <main
          id="video-tiles-grid"
          className={`relative flex-1 min-h-0 p-2 sm:p-4 md:p-5 ${
            isTwoParticipants
              ? 'grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-5 md:gap-6 items-center justify-center max-w-6xl mx-auto w-full h-full'
              : isThreeParticipants
              ? 'grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 items-stretch justify-center max-w-7xl mx-auto w-full h-full'
              : isFourParticipants
              ? 'grid grid-cols-2 grid-rows-2 gap-3 sm:gap-4 items-center justify-center max-w-6xl mx-auto w-full h-full'
              : 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 items-center justify-center auto-rows-fr max-w-7xl mx-auto w-full h-full'
          } overflow-hidden transition-all duration-200`}
        >
          {totalCount === 1 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-[#202124]/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-[#3c4043] flex items-center gap-2.5 text-xs text-[#e8eaed] shadow-lg">
              <span className="w-2 h-2 rounded-full bg-[#81c995] animate-pulse" />
              <span>Aguardando outros entrarem na reunião...</span>
              <button
                onClick={handleCopyLink}
                className="text-[#8ab4f8] hover:text-white font-medium flex items-center gap-1 cursor-pointer transition-colors ml-1"
              >
                {copiedLinkBanner ? 'Copiado!' : 'Copiar link'}
              </button>
            </div>
          )}

          {allTiles.map(({ participant, stream, isLocal }) => (
            <VideoTile
              key={participant.userId}
              participant={participant}
              stream={stream}
              isLocal={isLocal}
              isSpeaking={speakingUsersMap.get(participant.userId) ?? !participant.isAudioMuted}
              onOpenSettings={isLocal ? () => setIsCameraSettingsOpen(true) : undefined}
              onToggleVideo={isLocal ? handleToggleVideo : undefined}
              currentQuality={isLocal ? videoQuality : undefined}
            />
          ))}
        </main>
      )}

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
        displayName={displayName}
        onToggleAudio={handleToggleAudio}
        onToggleVideo={handleToggleVideo}
        onLeaveCall={handleLeaveCall}
        isInRoom={isInRoom}
        openTrigger={pipTrigger}
        localStream={localStream}
        isSidebarOpen={isChatOpen || isParticipantsOpen}
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
    </ErrorBoundary>
  );
}
