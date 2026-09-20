import Peer, { type MediaConnection } from 'peerjs';
import { VideoQualityOption } from './types';

export function formatPeerId(roomId: string, userId: string): string {
  const cleanRoom = roomId.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const cleanUser = userId.replace(/[^a-zA-Z0-9_-]/g, '');
  return `vm--${cleanRoom}--${cleanUser}`;
}

export function parseUserIdFromPeerId(peerId: string): string {
  const parts = peerId.split('--');
  if (parts.length >= 3) {
    return parts.slice(2).join('--');
  }
  return peerId;
}

export class PeerConnectionManager {
  private roomId: string;
  private localUserId: string;
  private peerId: string;
  private peer: Peer | null = null;
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private fallbackStream: MediaStream | null = null;
  private currentQualityOption: VideoQualityOption | null = null;
  private activeCalls: Map<string, MediaConnection> = new Map();
  private remoteStreams: Map<string, MediaStream> = new Map();
  private onRemoteStreamCallback?: (peerId: string, stream: MediaStream) => void;
  private onPeerDisconnectCallback?: (peerId: string) => void;
  private isListening: boolean = false;
  private callRetryTimers: Map<string, NodeJS.Timeout> = new Map();

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

  private getFallbackStream(): MediaStream {
    if (this.fallbackStream) return this.fallbackStream;
    if (typeof window !== 'undefined') {
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const dst = ctx.createMediaStreamDestination();
          osc.connect(dst);
          osc.start();
          const track = dst.stream.getAudioTracks()[0];
          if (track) {
            track.enabled = false;
            this.fallbackStream = new MediaStream([track]);
            return this.fallbackStream;
          }
        }
      } catch {
        // ignore
      }
      this.fallbackStream = new MediaStream();
      return this.fallbackStream;
    }
    return new MediaStream();
  }

  startListening() {
    if (typeof window === 'undefined' || this.isListening) return;
    this.isListening = true;

    try {
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

      const peer = new Peer(this.peerId, peerOptions);
      this.peer = peer;

      peer.on('open', (id) => {
        console.info(`[PeerJS] Initialized and registered with ID: ${id}`);
      });

      peer.on('call', (call) => {
        this.handleIncomingCall(call);
      });

      peer.on('disconnected', () => {
        console.info('[PeerJS] Disconnected from signaling server. Reconnecting...');
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
          console.info('[PeerJS] Peer is not yet available, will connect when ready.');
        } else {
          console.warn('[PeerJS] Notice:', error?.message || error);
        }
      });
    } catch (err) {
      console.error('[PeerJS] Failed to initialize peer:', err);
    }
  }

  private handleIncomingCall(call: MediaConnection) {
    const meta = call.metadata as { fromUserId?: string } | undefined;
    const remoteUserId = meta?.fromUserId || parseUserIdFromPeerId(call.peer);
    if (!remoteUserId || remoteUserId === this.localUserId) return;

    // Replace previous call if already exists
    const existing = this.activeCalls.get(remoteUserId);
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

    const existing = this.activeCalls.get(targetUserId);
    if (existing && existing.open) {
      return;
    }

    const targetPeerId = formatPeerId(this.roomId, targetUserId);
    const streamToSend = this.screenStream || this.localStream || this.getFallbackStream();

    try {
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
    call.on('stream', (remoteStream: MediaStream) => {
      const updated = new MediaStream(remoteStream.getTracks());
      this.remoteStreams.set(remoteUserId, updated);

      remoteStream.getTracks().forEach((track) => {
        const notify = () => {
          const s = this.remoteStreams.get(remoteUserId);
          if (s && this.onRemoteStreamCallback) {
            this.onRemoteStreamCallback(remoteUserId, new MediaStream(s.getTracks()));
          }
        };
        track.addEventListener('unmute', notify);
        track.addEventListener('ended', notify);
      });

      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(remoteUserId, updated);
      }
    });

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

    const pc = call.peerConnection;
    if (pc) {
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
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
        for (const sender of senders) {
          if (sender.track?.kind === 'video' && videoTrack && !this.screenStream) {
            await sender.replaceTrack(videoTrack);
          } else if (sender.track?.kind === 'audio' && audioTrack) {
            await sender.replaceTrack(audioTrack);
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

    for (const [, timer] of this.callRetryTimers) {
      clearTimeout(timer);
    }
    this.callRetryTimers.clear();

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
