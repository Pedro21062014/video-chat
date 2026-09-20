import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  doc,
  deleteDoc,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { VideoQualityOption, VideoQualityId, VIDEO_QUALITIES, SignalMessage } from './types';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.services.mozilla.com:3478' },
];

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
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private targetQualityId: VideoQualityId = '720p';
  private currentQualityOption: VideoQualityOption | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private remoteStreams: Map<string, MediaStream> = new Map();
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private currentRemoteUserIds: Set<string> = new Set();
  private connectionAttempts: Map<string, number> = new Map();
  private isNegotiating: Map<string, boolean> = new Map();
  private supervisorInterval: NodeJS.Timeout | null = null;
  private statsInterval: NodeJS.Timeout | null = null;
  private unsubscribeSignals: Unsubscribe | null = null;
  private onRemoteStreamCallback?: (userId: string, stream: MediaStream) => void;
  private onPeerDisconnectCallback?: (userId: string) => void;
  private onAdaptiveQualityCallback?: (qualityId: VideoQualityId, reason: string) => void;
  private isListening: boolean = false;

  // Adaptive Quality Tracking
  private badNetworkCycles: number = 0;
  private goodNetworkCycles: number = 0;
  private isAdaptiveActive: boolean = true;

  constructor(
    roomId: string,
    localUserId: string,
    onRemoteStream?: (userId: string, stream: MediaStream) => void,
    onPeerDisconnect?: (userId: string) => void,
    onAdaptiveQualityChange?: (qualityId: VideoQualityId, reason: string) => void
  ) {
    this.roomId = roomId;
    this.localUserId = localUserId;
    this.onRemoteStreamCallback = onRemoteStream;
    this.onPeerDisconnectCallback = onPeerDisconnect;
    this.onAdaptiveQualityCallback = onAdaptiveQualityChange;

    const defaultOpt = VIDEO_QUALITIES.find((q) => q.id === '720p') || VIDEO_QUALITIES[2];
    this.currentQualityOption = defaultOpt;
  }

  startListening(initialStream?: MediaStream | null) {
    if (typeof window === 'undefined' || this.isListening) return;
    this.isListening = true;

    if (initialStream) {
      this.localStream = initialStream;
    }

    try {
      // 1. Listen to real-time signals targeted to this user in Firestore
      const signalsQuery = query(
        collection(db, 'rooms', this.roomId, 'signals'),
        where('to', '==', this.localUserId)
      );

      this.unsubscribeSignals = onSnapshot(
        signalsQuery,
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const data = change.doc.data();
              const signalId = change.doc.id;

              const signal: SignalMessage = {
                id: signalId,
                from: data.from,
                to: data.to,
                type: data.type,
                payload: data.payload,
                timestamp: data.timestamp || Date.now(),
              };

              this.handleIncomingSignal(signal);

              // Clean up processed signal document
              deleteDoc(doc(db, 'rooms', this.roomId, 'signals', signalId)).catch(() => {});
            }
          });
        },
        (err) => {
          console.warn('[WebRTC] Signal listener error:', err);
        }
      );

      // 2. Start supervisor loop to auto-heal disconnected peers
      this.startSupervisor();

      // 3. Start Adaptive Quality Monitor for speed optimization & automatic downgrade
      this.startAdaptiveStatsMonitor();

      console.info(`[WebRTC] Signaling and speed optimization active for room ${this.roomId}`);
    } catch (err) {
      console.error('[WebRTC] Failed to start signaling:', err);
    }
  }

  private startSupervisor() {
    if (this.supervisorInterval) clearInterval(this.supervisorInterval);
    this.supervisorInterval = setInterval(() => {
      this.reconcileConnections();
    }, 2500);
  }

  /**
   * Adaptive Bitrate & Quality Monitor:
   * Inspects connection RTT, packet loss, bandwidth limitation, and dropped frames.
   * If network is lagging, automatically decreases video quality to maintain ultra-fast, smooth streaming.
   */
  private startAdaptiveStatsMonitor() {
    if (this.statsInterval) clearInterval(this.statsInterval);
    this.statsInterval = setInterval(async () => {
      if (!this.isListening || this.peerConnections.size === 0 || !this.isAdaptiveActive) return;

      let maxRtt = 0;
      let maxPacketLossRate = 0;
      let isBandwidthLimited = false;
      let hasActiveConnection = false;

      for (const [, pc] of this.peerConnections) {
        if (pc.connectionState !== 'connected') continue;
        hasActiveConnection = true;

        try {
          const stats = await pc.getStats();
          stats.forEach((report) => {
            // Outbound video stats
            if (report.type === 'outbound-rtp' && report.kind === 'video') {
              if (report.qualityLimitationReason === 'bandwidth' || report.qualityLimitationReason === 'cpu') {
                isBandwidthLimited = true;
              }
            }

            // Candidate pair RTT
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              if (report.currentRoundTripTime !== undefined) {
                const rttMs = report.currentRoundTripTime * 1000;
                if (rttMs > maxRtt) maxRtt = rttMs;
              }
            }

            // Remote inbound packet loss
            if (report.type === 'remote-inbound-rtp' && report.kind === 'video') {
              if (report.fractionLost !== undefined && report.fractionLost > 0) {
                const lossPct = report.fractionLost * 100;
                if (lossPct > maxPacketLossRate) maxPacketLossRate = lossPct;
              }
              if (report.roundTripTime !== undefined) {
                const rttMs = report.roundTripTime * 1000;
                if (rttMs > maxRtt) maxRtt = rttMs;
              }
            }
          });
        } catch {
          // ignore
        }
      }

      if (!hasActiveConnection) return;

      const isLagging = maxRtt > 320 || maxPacketLossRate > 4 || isBandwidthLimited;

      if (isLagging) {
        this.badNetworkCycles += 1;
        this.goodNetworkCycles = 0;

        // If lagging for 2 consecutive cycles (4s), automatically step down quality
        if (this.badNetworkCycles >= 2) {
          this.badNetworkCycles = 0;
          this.stepDownQuality(maxRtt, maxPacketLossRate);
        }
      } else if (maxRtt < 130 && maxPacketLossRate < 1) {
        this.goodNetworkCycles += 1;
        this.badNetworkCycles = 0;

        // If stable for 5 consecutive cycles (10s), try to gently step up toward preferred quality
        if (this.goodNetworkCycles >= 5) {
          this.goodNetworkCycles = 0;
          this.stepUpQuality();
        }
      } else {
        this.badNetworkCycles = 0;
        this.goodNetworkCycles = 0;
      }
    }, 2000);
  }

  private stepDownQuality(rtt: number, loss: number) {
    if (!this.currentQualityOption) return;
    const ladder: VideoQualityId[] = ['4k', '1080p', '720p', '480p', '360p', '240p', '144p'];
    const currentIndex = ladder.indexOf(this.currentQualityOption.id);

    if (currentIndex < ladder.length - 1) {
      const nextId = ladder[currentIndex + 1];
      const nextOpt = VIDEO_QUALITIES.find((q) => q.id === nextId);
      if (nextOpt) {
        console.info(`[WebRTC Adaptive] Network slow (RTT: ${Math.round(rtt)}ms, Loss: ${loss.toFixed(1)}%). Auto-downgrading to ${nextId}`);
        this.applyVideoQuality(nextOpt).catch(() => {});
        if (this.onAdaptiveQualityCallback) {
          this.onAdaptiveQualityCallback(nextId, 'Velocidade otimizada: qualidade diminuída automaticamente para evitar travamentos.');
        }
      }
    }
  }

  private stepUpQuality() {
    if (!this.currentQualityOption) return;
    const ladder: VideoQualityId[] = ['4k', '1080p', '720p', '480p', '360p', '240p', '144p'];
    const currentIndex = ladder.indexOf(this.currentQualityOption.id);
    const targetIndex = ladder.indexOf(this.targetQualityId);

    // Only step up if currently lower than the user's preferred target quality
    if (currentIndex > targetIndex && currentIndex > 0) {
      const prevId = ladder[currentIndex - 1];
      const prevOpt = VIDEO_QUALITIES.find((q) => q.id === prevId);
      if (prevOpt) {
        console.info(`[WebRTC Adaptive] Network recovered. Auto-recovering quality to ${prevId}`);
        this.applyVideoQuality(prevOpt).catch(() => {});
        if (this.onAdaptiveQualityCallback) {
          this.onAdaptiveQualityCallback(prevId, 'Conexão estável: restaurando resolução com fluidez.');
        }
      }
    }
  }

  private reconcileConnections() {
    if (!this.isListening) return;

    for (const targetUserId of this.currentRemoteUserIds) {
      if (targetUserId === this.localUserId) continue;

      const pc = this.peerConnections.get(targetUserId);
      const isConnected =
        pc &&
        (pc.connectionState === 'connected' ||
          pc.iceConnectionState === 'connected' ||
          pc.iceConnectionState === 'completed');

      if (!isConnected) {
        // Deterministic initiator: the user with alphabetically greater ID initiates the call
        const isPrimaryInitiator = this.localUserId > targetUserId;
        const attempts = this.connectionAttempts.get(targetUserId) || 0;

        // Initiator starts immediately; receiver acts as fallback after 3 supervisor cycles (7.5s)
        if (isPrimaryInitiator || attempts >= 3) {
          if (!this.isNegotiating.get(targetUserId)) {
            this.sendOffer(targetUserId).catch((err) => {
              console.warn(`[WebRTC] Error in supervisor offer to ${targetUserId}:`, err);
            });
          }
        }
        this.connectionAttempts.set(targetUserId, attempts + 1);
      } else {
        this.connectionAttempts.delete(targetUserId);
      }
    }
  }

  /**
   * Synchronizes active participants list from Firestore.
   */
  syncParticipants(remoteUserIds: string[]) {
    this.currentRemoteUserIds = new Set(remoteUserIds);

    // Clean up participants who left the room
    for (const [userId, pc] of this.peerConnections) {
      if (!this.currentRemoteUserIds.has(userId)) {
        try {
          pc.close();
        } catch {
          // ignore
        }
        this.peerConnections.delete(userId);
        this.remoteStreams.delete(userId);
        this.connectionAttempts.delete(userId);
        this.pendingCandidates.delete(userId);
        this.isNegotiating.delete(userId);
        if (this.onPeerDisconnectCallback) {
          this.onPeerDisconnectCallback(userId);
        }
      }
    }

    // Reconcile new/existing peers immediately
    this.reconcileConnections();
  }

  private createPeerConnection(targetUserId: string): RTCPeerConnection {
    const existing = this.peerConnections.get(targetUserId);
    if (existing && existing.connectionState !== 'closed' && existing.connectionState !== 'failed') {
      return existing;
    }

    if (existing) {
      try {
        existing.close();
      } catch {
        // ignore
      }
    }

    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10,
    });

    this.peerConnections.set(targetUserId, pc);

    // 1. ICE Candidate Handler
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal(targetUserId, 'candidate', event.candidate.toJSON());
      }
    };

    // 2. Track / Stream Reception Handler with instant reactivity
    pc.ontrack = (event) => {
      console.info(`[WebRTC] Received ${event.track.kind} track from peer ${targetUserId}`);
      let remoteStream = this.remoteStreams.get(targetUserId);
      if (!remoteStream) {
        if (event.streams && event.streams[0]) {
          remoteStream = event.streams[0];
        } else {
          remoteStream = new MediaStream();
        }
      }

      // Ensure received track is attached
      const existingTrackIds = new Set(remoteStream.getTracks().map((t) => t.id));
      if (!existingTrackIds.has(event.track.id)) {
        remoteStream.addTrack(event.track);
      }

      // Clone MediaStream to guarantee React component detects state change and re-renders
      const updatedStream = new MediaStream(remoteStream.getTracks());
      this.remoteStreams.set(targetUserId, updatedStream);
      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(targetUserId, updatedStream);
      }

      const handleTrackUpdate = () => {
        const current = this.remoteStreams.get(targetUserId);
        if (current) {
          const fresh = new MediaStream(current.getTracks());
          this.remoteStreams.set(targetUserId, fresh);
          if (this.onRemoteStreamCallback) {
            this.onRemoteStreamCallback(targetUserId, fresh);
          }
        }
      };

      event.track.addEventListener('unmute', handleTrackUpdate);
      event.track.addEventListener('mute', handleTrackUpdate);
      event.track.addEventListener('ended', handleTrackUpdate);
    };

    // 3. Connection State Change Handler
    pc.onconnectionstatechange = () => {
      console.info(`[WebRTC] Connection state with ${targetUserId}: ${pc.connectionState}`);
      if (pc.connectionState === 'connected') {
        this.connectionAttempts.delete(targetUserId);
        this.isNegotiating.set(targetUserId, false);

        // Apply quality settings immediately upon connection
        if (this.currentQualityOption) {
          this.applyQualityToPeer(pc, this.currentQualityOption).catch(() => {});
        }
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.isNegotiating.set(targetUserId, false);
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        this.connectionAttempts.delete(targetUserId);
      }
    };

    return pc;
  }

  private addTracksToConnection(pc: RTCPeerConnection) {
    const activeStream = this.screenStream || this.localStream;
    const senders = pc.getSenders();

    if (activeStream && activeStream.getTracks().length > 0) {
      activeStream.getTracks().forEach((track) => {
        const existingSender = senders.find((s) => s.track?.kind === track.kind);
        if (!existingSender) {
          try {
            const sender = pc.addTrack(track, activeStream);
            if (track.kind === 'video' && this.currentQualityOption) {
              this.tuneSenderParameters(sender, this.currentQualityOption);
            }
          } catch {
            // ignore
          }
        }
      });
    } else {
      // Ensure transceivers exist so SDP contains audio and video m-lines
      const hasAudio = senders.some((s) => s.track?.kind === 'audio') || pc.getTransceivers().some((t) => t.receiver.track.kind === 'audio');
      const hasVideo = senders.some((s) => s.track?.kind === 'video') || pc.getTransceivers().some((t) => t.receiver.track.kind === 'video');

      if (!hasAudio) {
        try {
          pc.addTransceiver('audio', { direction: 'sendrecv' });
        } catch {
          // ignore
        }
      }
      if (!hasVideo) {
        try {
          pc.addTransceiver('video', { direction: 'sendrecv' });
        } catch {
          // ignore
        }
      }
    }
  }

  async sendOffer(targetUserId: string) {
    if (targetUserId === this.localUserId) return;
    this.isNegotiating.set(targetUserId, true);

    try {
      console.info(`[WebRTC] Creating and sending offer to ${targetUserId}...`);
      const pc = this.createPeerConnection(targetUserId);
      this.addTracksToConnection(pc);

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await pc.setLocalDescription(offer);

      await this.sendSignal(targetUserId, 'offer', {
        type: offer.type,
        sdp: offer.sdp,
      });
    } catch (err) {
      console.warn(`[WebRTC] Failed to send offer to ${targetUserId}:`, err);
      this.isNegotiating.set(targetUserId, false);
    }
  }

  private async handleIncomingSignal(signal: SignalMessage) {
    const senderId = signal.from;
    if (!senderId || senderId === this.localUserId) return;

    try {
      if (signal.type === 'offer') {
        console.info(`[WebRTC] Received offer from ${senderId}`);
        const pc = this.createPeerConnection(senderId);
        this.addTracksToConnection(pc);

        const offerData = typeof signal.payload === 'string' ? JSON.parse(signal.payload) : signal.payload;
        await pc.setRemoteDescription(new RTCSessionDescription(offerData));

        // Drain queued candidates
        await this.drainPendingCandidates(senderId, pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        await this.sendSignal(senderId, 'answer', {
          type: answer.type,
          sdp: answer.sdp,
        });
      } else if (signal.type === 'answer') {
        console.info(`[WebRTC] Received answer from ${senderId}`);
        const pc = this.peerConnections.get(senderId);
        if (pc && (pc.signalingState === 'have-local-offer' || pc.signalingState === 'have-remote-pranswer')) {
          const answerData = typeof signal.payload === 'string' ? JSON.parse(signal.payload) : signal.payload;
          await pc.setRemoteDescription(new RTCSessionDescription(answerData));
          await this.drainPendingCandidates(senderId, pc);
          this.isNegotiating.set(senderId, false);
        }
      } else if (signal.type === 'candidate') {
        const candidateData = typeof signal.payload === 'string' ? JSON.parse(signal.payload) : signal.payload;
        if (!candidateData) return;

        const pc = this.peerConnections.get(senderId);
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidateData));
          } catch (err) {
            console.warn(`[WebRTC] Could not add ICE candidate from ${senderId}:`, err);
          }
        } else {
          // Queue candidate until remoteDescription is ready
          if (!this.pendingCandidates.has(senderId)) {
            this.pendingCandidates.set(senderId, []);
          }
          this.pendingCandidates.get(senderId)!.push(candidateData);
        }
      }
    } catch (err) {
      console.warn(`[WebRTC] Error handling signal from ${senderId}:`, err);
    }
  }

  private async drainPendingCandidates(senderId: string, pc: RTCPeerConnection) {
    const queue = this.pendingCandidates.get(senderId);
    if (!queue || queue.length === 0) return;

    for (const candidateData of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidateData));
      } catch (err) {
        console.warn(`[WebRTC] Failed to add queued candidate from ${senderId}:`, err);
      }
    }
    this.pendingCandidates.delete(senderId);
  }

  private async sendSignal(toUserId: string, type: 'offer' | 'answer' | 'candidate', payload: unknown) {
    try {
      const signalsCol = collection(db, 'rooms', this.roomId, 'signals');
      await addDoc(signalsCol, {
        from: this.localUserId,
        to: toUserId,
        type,
        payload: JSON.stringify(payload),
        timestamp: Date.now(),
      });
    } catch (err) {
      console.warn(`[WebRTC] Failed to send ${type} signal to ${toUserId}:`, err);
    }
  }

  async setLocalStream(stream: MediaStream | null) {
    this.localStream = stream;
    if (!stream) return;

    const videoTrack = stream.getVideoTracks()[0] || null;
    const audioTrack = stream.getAudioTracks()[0] || null;

    for (const [targetUserId, pc] of this.peerConnections) {
      if (pc.connectionState === 'closed') continue;

      try {
        const senders = pc.getSenders();
        let replacedVideo = false;
        let replacedAudio = false;

        for (const sender of senders) {
          if (sender.track?.kind === 'video' && videoTrack && !this.screenStream) {
            await sender.replaceTrack(videoTrack);
            if (this.currentQualityOption) {
              this.tuneSenderParameters(sender, this.currentQualityOption);
            }
            replacedVideo = true;
          } else if (sender.track?.kind === 'audio' && audioTrack) {
            await sender.replaceTrack(audioTrack);
            replacedAudio = true;
          }
        }

        // If no existing sender was present, add track
        if (!replacedVideo && videoTrack && !this.screenStream) {
          try {
            const sender = pc.addTrack(videoTrack, stream);
            if (this.currentQualityOption) {
              this.tuneSenderParameters(sender, this.currentQualityOption);
            }
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
        console.warn(`[WebRTC] Could not replace local track for peer ${targetUserId}:`, err);
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
      for (const [, pc] of this.peerConnections) {
        if (pc.connectionState === 'closed') continue;
        const videoSender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(videoTrack).catch(() => {});
        }
      }
    }
  }

  /**
   * Sets preferred base quality selected by user and resets adaptive state.
   */
  setPreferredQuality(qualityId: VideoQualityId) {
    this.targetQualityId = qualityId;
    const opt = VIDEO_QUALITIES.find((q) => q.id === qualityId) || VIDEO_QUALITIES[2];
    this.applyVideoQuality(opt).catch(() => {});
  }

  private tuneSenderParameters(sender: RTCRtpSender, opt: VideoQualityOption) {
    try {
      const params = sender.getParameters();
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
      // Speed & smoothness priority: maintain framerate and low latency
      params.degradationPreference = 'maintain-framerate';
      sender.setParameters(params).catch(() => {});
    } catch {
      // ignore
    }
  }

  private async applyQualityToPeer(pc: RTCPeerConnection, opt: VideoQualityOption) {
    const videoSender = pc.getSenders().find((s) => s.track?.kind === 'video');
    if (!videoSender) return;
    this.tuneSenderParameters(videoSender, opt);
  }

  async applyVideoQuality(opt: VideoQualityOption) {
    this.currentQualityOption = opt;
    for (const [, pc] of this.peerConnections) {
      if (pc.connectionState === 'closed') continue;
      await this.applyQualityToPeer(pc, opt);
    }
  }

  async closeAll() {
    this.isListening = false;

    if (this.supervisorInterval) {
      clearInterval(this.supervisorInterval);
      this.supervisorInterval = null;
    }

    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    if (this.unsubscribeSignals) {
      this.unsubscribeSignals();
      this.unsubscribeSignals = null;
    }

    this.connectionAttempts.clear();
    this.pendingCandidates.clear();
    this.isNegotiating.clear();
    this.currentRemoteUserIds.clear();

    for (const [, pc] of this.peerConnections) {
      try {
        pc.close();
      } catch {
        // ignore
      }
    }
    this.peerConnections.clear();
    this.remoteStreams.clear();
  }
}
