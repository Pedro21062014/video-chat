import type { MediaConnection, default as PeerType } from 'peerjs';
import { VideoQualityOption } from './types';

/**
 * PeerJS requires peer IDs to match: /^[A-Za-z0-9]+(?:[ _-][A-Za-z0-9]+)*$/
 * Consecutive separators like '--' or '__' will cause PeerJS to immediately abort with InvalidID!
 * We format IDs as: vm_{cleanRoom}_{cleanUser} using single underscores.
 */
export function formatPeerId(roomId: string, userId: string): string {
  const cleanRoom = roomId.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanUser = userId.replace(/[^a-zA-Z0-9]/g, '');
  return `vm_${cleanRoom}_${cleanUser}`;
}

export function parseUserIdFromPeerId(peerId: string): string {
  const parts = peerId.split('_');
  if (parts.length >= 3) {
    return parts.slice(2).join('_');
  }
  return peerId;
}

export class PeerConnectionManager {
  private roomId: string;
  private localUserId: string;
  private peerId: string;
  private peer: PeerType | null = null;
  private isPeerOpen: boolean = false;
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private fallbackStream: MediaStream | null = null;
  private currentQualityOption: VideoQualityOption | null = null;
  private activeCalls: Map<string, MediaConnection> = new Map();
  private remoteStreams: Map<string, MediaStream> = new Map();
  private pendingPeersToConnect: Set<string> = new Set();
  private currentRemoteUserIds: Set<string> = new Set();
  private callAttempts: Map<string, number> = new Map();
  private supervisorInterval: NodeJS.Timeout | null = null;
  private onRemoteStreamCallback?: (peerId: string, stream: MediaStream) => void;
  private onPeerDisconnectCallback?: (peerId: string) => void;
  private isListening: boolean = false;

  constructor(
    roomId: string,
    localUserId: string,
    onRemoteStream?: (peerId: string, stream: MediaStream) => void,
    onPeerDisconnect?: (peerId: string) => void
  ) {
    this.roomId = roomId;
    this.localUserId = localUserId;
    this.peerId = formatPeerId(roomId, localUserId);
    this.onRemoteStreamCallback = onRemoteStream;
    this.onPeerDisconnectCallback = onPeerDisconnect;
  }

  /**
   * Generates a fallback stream with BOTH a silent audio track and a black canvas video track.
   * This guarantees that WebRTC RTCPeerConnection negotiates both audio and video transceivers
   * in the initial SDP offer/answer. When real camera/mic tracks arrive, replaceTrack works
   * instantly without renegotiation.
   */
  private getFallbackStream(): MediaStream {
    if (this.fallbackStream) {
      const v = this.fallbackStream.getVideoTracks()[0];
      const a = this.fallbackStream.getAudioTracks()[0];
      if (v && v.readyState === 'live' && a && a.readyState === 'live') {
        return this.fallbackStream;
      }
    }

    const tracks: MediaStreamTrack[] = [];

    if (typeof window !== 'undefined') {
      // 1. Silent dummy audio track
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const dst = ctx.createMediaStreamDestination();
          osc.connect(dst);
          osc.start();
          const aTrack = dst.stream.getAudioTracks()[0];
          if (aTrack) {
            aTrack.enabled = false;
            tracks.push(aTrack);
          }
        }
      } catch {
        // ignore
      }

      // 2. Dummy 640x360 dark video track so SDP negotiates m=video transceiver
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 360;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#202124';
          ctx.fillRect(0, 0, 640, 360);
        }
        if (typeof canvas.captureStream === 'function') {
          const cStream = canvas.captureStream(10);
          const vTrack = cStream.getVideoTracks()[0];
          if (vTrack) {
            tracks.push(vTrack);
          }
        }
      } catch {
        // ignore
      }
    }

    this.fallbackStream = new MediaStream(tracks);
    return this.fallbackStream;
  }

  async startListening(initialStream?: MediaStream | null) {
    if (typeof window === 'undefined' || this.isListening) return;
    this.isListening = true;

    if (initialStream) {
      this.localStream = initialStream;
    }

    try {
      const PeerModule = await import('peerjs');
      const Peer = PeerModule.default || PeerModule;

      const peerOptions: Record<string, unknown> = {
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun.cloudflare.com:3478' },
          ],
          iceCandidatePoolSize: 10,
        },
        debug: 1,
      };

      if (process.env.NEXT_PUBLIC_PEERJS_HOST) {
        peerOptions.host = process.env.NEXT_PUBLIC_PEERJS_HOST;
      }
      if (process.env.NEXT_PUBLIC_PEERJS_PORT) {
        peerOptions.port = Number(process.env.NEXT_PUBLIC_PEERJS_PORT);
      }
      if (process.env.NEXT_PUBLIC_PEERJS_PATH) {
        peerOptions.path = process.env.NEXT_PUBLIC_PEERJS_PATH;
      }
      if (process.env.NEXT_PUBLIC_PEERJS_KEY) {
        peerOptions.key = process.env.NEXT_PUBLIC_PEERJS_KEY;
      }
      if (process.env.NEXT_PUBLIC_PEERJS_SECURE !== undefined) {
        peerOptions.secure = process.env.NEXT_PUBLIC_PEERJS_SECURE === 'true';
      }

      console.info(`[PeerJS] Initializing peer with ID: ${this.peerId}`);
      const peer = new Peer(this.peerId, peerOptions);
      this.peer = peer;

      peer.on('open', (id: string) => {
        console.info(`[PeerJS] Connected to signaling server with ID: ${id}`);
        this.isPeerOpen = true;

        // Process any queued connection attempts
        for (const targetUserId of this.pendingPeersToConnect) {
          this.connectToPeer(targetUserId);
        }
        this.pendingPeersToConnect.clear();
      });

      peer.on('call', (call: MediaConnection) => {
        this.handleIncomingCall(call);
      });

      peer.on('disconnected', () => {
        console.info('[PeerJS] Disconnected from signaling server. Reconnecting...');
        this.isPeerOpen = false;
        if (peer && !peer.destroyed) {
          try {
            peer.reconnect();
          } catch {
            // ignore
          }
        }
      });

      peer.on('error', (err: unknown) => {
        const error = err as { type?: string; message?: string };
        if (error?.type === 'peer-unavailable') {
          console.info('[PeerJS] Peer is not yet online on signaling server; supervisor will retry.');
        } else {
          console.warn('[PeerJS] Notice:', error?.message || error);
        }
      });

      // Start periodic supervisor to reconcile and auto-retry disconnected peers
      this.startSupervisor();
    } catch (err) {
      console.error('[PeerJS] Failed to initialize peer:', err);
    }
  }

  private startSupervisor() {
    if (this.supervisorInterval) clearInterval(this.supervisorInterval);
    this.supervisorInterval = setInterval(() => {
      this.reconcileConnections();
    }, 2500);
  }

  private reconcileConnections() {
    if (!this.isListening || !this.isPeerOpen || !this.peer || this.peer.destroyed) return;

    for (const targetUserId of this.currentRemoteUserIds) {
      if (targetUserId === this.localUserId) continue;

      const call = this.activeCalls.get(targetUserId);
      const pc = call?.peerConnection;
      const isOpen = Boolean(call?.open && pc && pc.connectionState !== 'failed' && pc.connectionState !== 'closed');

      if (!isOpen) {
        // Peer with higher ID initiates immediately; other peer acts as fallback after 5s
        const isPrimaryCaller = this.localUserId > targetUserId;
        const attempts = this.callAttempts.get(targetUserId) || 0;

        if (isPrimaryCaller || attempts >= 2) {
          this.connectToPeer(targetUserId);
        }
        this.callAttempts.set(targetUserId, attempts + 1);
      } else {
        this.callAttempts.delete(targetUserId);
      }
    }
  }

  /**
   * Synchronizes the active participants list from Firestore.
   * Cleans up calls for left participants and triggers connections for active peers.
   */
  syncParticipants(remoteUserIds: string[]) {
    this.currentRemoteUserIds = new Set(remoteUserIds);

    // Clean up participants that left the room
    for (const [userId, call] of this.activeCalls) {
      if (!this.currentRemoteUserIds.has(userId)) {
        try {
          call.close();
        } catch {
          // ignore
        }
        this.activeCalls.delete(userId);
        this.remoteStreams.delete(userId);
        this.callAttempts.delete(userId);
        if (this.onPeerDisconnectCallback) {
          this.onPeerDisconnectCallback(userId);
        }
      }
    }

    // Trigger reconciliation immediately
    this.reconcileConnections();
  }

  private handleIncomingCall(call: MediaConnection) {
    const meta = call.metadata as { fromUserId?: string } | undefined;
    const remoteUserId = meta?.fromUserId || parseUserIdFromPeerId(call.peer);
    if (!remoteUserId || remoteUserId === this.localUserId) return;

    // Check if we already have an active, working call with this peer
    const existing = this.activeCalls.get(remoteUserId);
    if (existing && existing !== call && existing.open) {
      // Keep existing call if it is already healthy
      const pc = existing.peerConnection;
      if (pc && pc.connectionState === 'connected') {
        try {
          call.close();
        } catch {
          // ignore
        }
        return;
      }
    }

    if (existing && existing !== call) {
      try {
        existing.close();
      } catch {
        // ignore
      }
    }

    this.activeCalls.set(remoteUserId, call);

    const streamToSend = this.screenStream || this.localStream || this.getFallbackStream();
    call.answer(streamToSend);

    this.bindCallEvents(remoteUserId, call);
  }

  async connectToPeer(targetUserId: string) {
    if (targetUserId === this.localUserId) return;
    if (!this.peer || this.peer.destroyed) return;

    if (!this.isPeerOpen) {
      this.pendingPeersToConnect.add(targetUserId);
      return;
    }

    const existing = this.activeCalls.get(targetUserId);
    if (existing && existing.open) {
      const pc = existing.peerConnection;
      if (pc && pc.connectionState === 'connected') {
        return;
      }
    }

    const targetPeerId = formatPeerId(this.roomId, targetUserId);
    const streamToSend = this.screenStream || this.localStream || this.getFallbackStream();

    try {
      console.info(`[PeerJS] Calling peer ${targetUserId} (${targetPeerId})...`);
      const call = this.peer.call(targetPeerId, streamToSend, {
        metadata: { fromUserId: this.localUserId, roomId: this.roomId },
      });

      if (!call) return;

      this.activeCalls.set(targetUserId, call);
      this.bindCallEvents(targetUserId, call);
    } catch (err) {
      console.warn(`[PeerJS] Failed to call peer ${targetUserId}:`, err);
    }
  }

  private bindCallEvents(remoteUserId: string, call: MediaConnection) {
    const notifyStream = (stream: MediaStream) => {
      this.remoteStreams.set(remoteUserId, stream);
      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(remoteUserId, stream);
      }
    };

    call.on('stream', (remoteStream: MediaStream) => {
      notifyStream(remoteStream);

      remoteStream.getTracks().forEach((track) => {
        const handleTrackChange = () => {
          const current = this.remoteStreams.get(remoteUserId);
          if (current) {
            notifyStream(new MediaStream(current.getTracks()));
          }
        };
        track.addEventListener('unmute', handleTrackChange);
        track.addEventListener('mute', handleTrackChange);
        track.addEventListener('ended', handleTrackChange);
      });
    });

    const pc = call.peerConnection;
    if (pc) {
      pc.addEventListener('track', (e) => {
        if (e.streams && e.streams[0]) {
          notifyStream(e.streams[0]);
        }
      });

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          this.callAttempts.delete(remoteUserId);
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
          setTimeout(() => {
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
              this.activeCalls.delete(remoteUserId);
              this.remoteStreams.delete(remoteUserId);
              if (this.onPeerDisconnectCallback) {
                this.onPeerDisconnectCallback(remoteUserId);
              }
            }
          }, 3000);
        }
      };
    }

    call.on('close', () => {
      this.activeCalls.delete(remoteUserId);
      this.remoteStreams.delete(remoteUserId);
      if (this.onPeerDisconnectCallback) {
        this.onPeerDisconnectCallback(remoteUserId);
      }
    });

    call.on('error', (err) => {
      console.warn(`[PeerJS] Call error with peer ${remoteUserId}:`, err);
    });

    if (this.currentQualityOption) {
      this.applyVideoQuality(this.currentQualityOption).catch(() => {});
    }
  }

  async setLocalStream(stream: MediaStream | null) {
    this.localStream = stream;
    if (!stream) return;

    const videoTrack = stream.getVideoTracks()[0] || null;
    const audioTrack = stream.getAudioTracks()[0] || null;

    for (const [, call] of this.activeCalls) {
      const pc = call.peerConnection;
      if (!pc || pc.connectionState === 'closed') continue;

      try {
        const senders = pc.getSenders();
        let replacedVideo = false;
        let replacedAudio = false;

        for (const sender of senders) {
          if (sender.track?.kind === 'video' && videoTrack && !this.screenStream) {
            await sender.replaceTrack(videoTrack);
            replacedVideo = true;
          } else if (sender.track?.kind === 'audio' && audioTrack) {
            await sender.replaceTrack(audioTrack);
            replacedAudio = true;
          }
        }

        // If no video/audio sender was in place, add as track
        if (!replacedVideo && videoTrack && !this.screenStream) {
          try {
            pc.addTrack(videoTrack, stream);
          } catch {
            // ignore
          }
        }
        if (!replacedAudio && audioTrack) {
          try {
            pc.addTrack(audioTrack, stream);
          } catch {
            // ignore
          }
        }
      } catch (err) {
        console.warn('[PeerJS] Could not replace local track on sender:', err);
      }
    }

    if (this.currentQualityOption) {
      this.applyVideoQuality(this.currentQualityOption).catch(() => {});
    }
  }

  setScreenStream(screenStream: MediaStream | null) {
    this.screenStream = screenStream;
    const activeStream = screenStream || this.localStream;
    if (!activeStream) return;

    const videoTrack = activeStream.getVideoTracks()[0] || null;
    if (videoTrack) {
      for (const [, call] of this.activeCalls) {
        const pc = call.peerConnection;
        if (!pc || pc.connectionState === 'closed') continue;
        const videoSender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(videoTrack).catch(() => {});
        }
      }
    }
  }

  async applyVideoQuality(opt: VideoQualityOption) {
    this.currentQualityOption = opt;
    for (const [, call] of this.activeCalls) {
      const pc = call.peerConnection;
      if (!pc || pc.connectionState === 'closed') continue;
      const videoSender = pc.getSenders().find((s) => s.track?.kind === 'video');
      if (!videoSender) continue;
      try {
        const params = videoSender.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}];
        }
        params.encodings[0].maxBitrate = opt.bitrate;
        params.encodings[0].maxFramerate = opt.frameRate;
        if (opt.scaleResolutionDownBy > 1) {
          params.encodings[0].scaleResolutionDownBy = opt.scaleResolutionDownBy;
        } else {
          delete params.encodings[0].scaleResolutionDownBy;
        }
        await videoSender.setParameters(params);
      } catch (err) {
        console.warn('[PeerJS] Could not set video encoding parameters:', err);
      }
    }
  }

  async closeAll() {
    this.isListening = false;

    if (this.supervisorInterval) {
      clearInterval(this.supervisorInterval);
      this.supervisorInterval = null;
    }

    this.pendingPeersToConnect.clear();
    this.callAttempts.clear();
    this.currentRemoteUserIds.clear();

    for (const [, call] of this.activeCalls) {
      try {
        call.close();
      } catch {
        // ignore
      }
    }
    this.activeCalls.clear();
    this.remoteStreams.clear();

    if (this.peer && !this.peer.destroyed) {
      try {
        this.peer.destroy();
      } catch {
        // ignore
      }
      this.peer = null;
    }
  }
}
