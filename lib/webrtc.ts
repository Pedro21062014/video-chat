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
import { VideoQualityOption, VideoQualityId, VIDEO_QUALITIES, SignalMessage, NetworkStatsInfo, NetworkQualityStatus } from './types';

// High-reliability global STUN servers for robust NAT traversal
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.services.mozilla.com:3478' },
  { urls: 'stun:stun.relay.metered.ca:80' },
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

/**
 * Optimizes SDP for ultra-low latency, in-band FEC error correction (no audio loss),
 * and instant video bitrates without slow ramp-up probing.
 */
function optimizeSdp(sdp: string): string {
  let modifiedSdp = sdp;

  // 1. Audio Optimization: Opus 10ms packet duration, FEC error correction, 48kHz voice
  if (modifiedSdp.includes('opus/48000')) {
    modifiedSdp = modifiedSdp.replace(
      /a=fmtp:(\d+)(.*opus\/48000.*)/gi,
      (match, pt, rest) => {
        if (rest.includes('useinbandfec=1')) return match;
        return `a=fmtp:${pt} minptime=10;useinbandfec=1;maxaveragebitrate=64000;stereo=0;sprop-stereo=0;cbr=1;${rest}`;
      }
    );
  }

  // 2. Video Optimization: start bitrate at 900kbps (no slow initial ramp) and min bitrate 350kbps
  if (modifiedSdp.includes('m=video')) {
    modifiedSdp = modifiedSdp.replace(
      /(a=mid:video\r?\n)/gi,
      `$1a=fmtp:96 x-google-min-bitrate=350;x-google-start-bitrate=900;x-google-max-bitrate=2200\r\n`
    );
  }

  return modifiedSdp;
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
  private isMakingOffer: Map<string, boolean> = new Map();
  private ignoreOffer: Map<string, boolean> = new Map();
  private isSettingRemoteAnswerPending: Map<string, boolean> = new Map();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private supervisorInterval: NodeJS.Timeout | null = null;
  private statsInterval: NodeJS.Timeout | null = null;
  private unsubscribeSignals: Unsubscribe | null = null;
  private onRemoteStreamCallback?: (userId: string, stream: MediaStream) => void;
  private onPeerDisconnectCallback?: (userId: string) => void;
  private onAdaptiveQualityCallback?: (qualityId: VideoQualityId, reason: string) => void;
  private onNetworkStatusCallback?: (info: NetworkStatsInfo) => void;
  private isListening: boolean = false;

  // Adaptive Quality & Network Health Tracking
  private badNetworkCycles: number = 0;
  private goodNetworkCycles: number = 0;
  private isAdaptiveActive: boolean = true;
  private consecutivePoorCount: number = 0;
  private consecutiveGoodCount: number = 0;
  private lastReportedStatus: NetworkQualityStatus = 'good';

  constructor(
    roomId: string,
    localUserId: string,
    onRemoteStream?: (userId: string, stream: MediaStream) => void,
    onPeerDisconnect?: (userId: string) => void,
    onAdaptiveQualityChange?: (qualityId: VideoQualityId, reason: string) => void,
    onNetworkStatusChange?: (info: NetworkStatsInfo) => void
  ) {
    this.roomId = roomId;
    this.localUserId = localUserId;
    this.onRemoteStreamCallback = onRemoteStream;
    this.onPeerDisconnectCallback = onPeerDisconnect;
    this.onAdaptiveQualityCallback = onAdaptiveQualityChange;
    this.onNetworkStatusCallback = onNetworkStatusChange;

    const defaultOpt = VIDEO_QUALITIES.find((q) => q.id === '720p') || VIDEO_QUALITIES[2];
    this.currentQualityOption = defaultOpt;
  }

  setOnNetworkStatusChange(callback: (info: NetworkStatsInfo) => void) {
    this.onNetworkStatusCallback = callback;
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

      // 2. Start supervisor loop for health monitoring and auto-recovery
      this.startSupervisor();

      // 3. Start Adaptive Quality Monitor for speed optimization & low latency
      this.startAdaptiveStatsMonitor();

      console.info(`[WebRTC] Engine active for room ${this.roomId}`);
    } catch (err) {
      console.error('[WebRTC] Failed to start signaling:', err);
    }
  }

  private startSupervisor() {
    if (this.supervisorInterval) clearInterval(this.supervisorInterval);
    this.supervisorInterval = setInterval(() => {
      this.reconcileConnections();
    }, 3000);
  }

  /**
   * Adaptive Bitrate & Quality Monitor:
   * Calibrated for great visual clarity with ultra-low latency even on moderate internet.
   * Tolerates normal jitter and only downgrades gracefully under sustained network congestion.
   */
  private startAdaptiveStatsMonitor() {
    if (this.statsInterval) clearInterval(this.statsInterval);
    this.statsInterval = setInterval(async () => {
      if (!this.isListening || this.peerConnections.size === 0 || !this.isAdaptiveActive) return;

      let maxRtt = 0;
      let maxPacketLossRate = 0;
      let hasActiveConnection = false;

      for (const [, pc] of this.peerConnections) {
        if (pc.connectionState !== 'connected') continue;
        hasActiveConnection = true;

        try {
          const stats = await pc.getStats();
          stats.forEach((report) => {
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

      // Real-time network health evaluation for user alerts
      const navConn = typeof navigator !== 'undefined' && 'connection' in navigator ? (navigator as any).connection : null;
      const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

      let detectedStatus: NetworkQualityStatus = 'good';
      let statusMsg = 'Conexão estável e rápida';
      let statusAdvice = '';

      if (isOffline) {
        detectedStatus = 'poor';
        statusMsg = 'Sem conexão com a internet';
        statusAdvice = 'Você está offline. Verifique seu sinal de Wi-Fi ou dados móveis.';
      } else if (
        (maxPacketLossRate >= 5.5 && maxRtt > 320) ||
        maxPacketLossRate >= 8.5 ||
        maxRtt > 650 ||
        (navConn && (navConn.effectiveType === '2g' || navConn.effectiveType === 'slow-2g'))
      ) {
        detectedStatus = 'poor';
        statusMsg = 'Sua conexão de internet está instável';
        statusAdvice = 'Sua conexão de internet está instável. Para evitar travamentos e melhorar a chamada, procure um lugar com melhor sinal de Wi-Fi ou dados móveis.';
      } else if (
        maxPacketLossRate >= 2.5 ||
        maxRtt > 260 ||
        (navConn && navConn.effectiveType === '3g')
      ) {
        detectedStatus = 'fair';
        statusMsg = 'Sinal de internet oscilando';
        statusAdvice = 'Sua conexão está um pouco lenta. A taxa de vídeo foi adaptada para manter a chamada sem travamentos.';
      }

      if (detectedStatus === 'poor') {
        this.consecutivePoorCount++;
        this.consecutiveGoodCount = 0;
        if (this.consecutivePoorCount >= 2 && this.lastReportedStatus !== 'poor') {
          this.lastReportedStatus = 'poor';
          this.onNetworkStatusCallback?.({
            status: 'poor',
            rtt: Math.round(maxRtt),
            packetLoss: Math.round(maxPacketLossRate),
            message: statusMsg,
            advice: statusAdvice,
          });
        }
      } else if (detectedStatus === 'fair') {
        this.consecutiveGoodCount = 0;
        if (this.lastReportedStatus !== 'fair' && this.consecutivePoorCount === 0) {
          this.lastReportedStatus = 'fair';
          this.onNetworkStatusCallback?.({
            status: 'fair',
            rtt: Math.round(maxRtt),
            packetLoss: Math.round(maxPacketLossRate),
            message: statusMsg,
            advice: statusAdvice,
          });
        }
      } else {
        this.consecutiveGoodCount++;
        if (this.consecutiveGoodCount >= 2) {
          this.consecutivePoorCount = 0;
          if (this.lastReportedStatus !== 'good') {
            this.lastReportedStatus = 'good';
            this.onNetworkStatusCallback?.({
              status: 'good',
              rtt: Math.round(maxRtt),
              packetLoss: Math.round(maxPacketLossRate),
              message: 'Conexão de internet restabelecida',
              advice: '',
            });
          }
        }
      }

      // Only consider congested if sustained high loss (>12%) with high RTT (>500ms) or severe loss (>18%)
      const isCongested = (maxPacketLossRate >= 12 && maxRtt > 500) || maxPacketLossRate >= 18 || maxRtt > 850;
      const isHealthy = maxPacketLossRate < 3 && maxRtt < 300;

      if (isCongested) {
        this.badNetworkCycles += 1;
        this.goodNetworkCycles = 0;

        // Require 3 consecutive cycles (6s of real sustained congestion)
        if (this.badNetworkCycles >= 3) {
          this.badNetworkCycles = 0;
          this.stepDownQuality(maxRtt, maxPacketLossRate);
        }
      } else if (isHealthy) {
        this.goodNetworkCycles += 1;
        this.badNetworkCycles = 0;

        // Recover after 3 cycles (6s of healthy network)
        if (this.goodNetworkCycles >= 3) {
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
    const ladder: VideoQualityId[] = ['4k', '1080p', '720p', '480p', '360p'];
    const currentIndex = ladder.indexOf(this.currentQualityOption.id);

    // Limit floor: don't auto-downgrade below 480p unless loss is above 20%
    const maxIndex = loss > 20 ? ladder.indexOf('360p') : ladder.indexOf('480p');

    if (currentIndex !== -1 && currentIndex < maxIndex) {
      const nextId = ladder[currentIndex + 1];
      const nextOpt = VIDEO_QUALITIES.find((q) => q.id === nextId);
      if (nextOpt) {
        console.info(`[WebRTC Adaptive] Ajustando taxa (RTT: ${Math.round(rtt)}ms, Perda: ${loss.toFixed(1)}%). Otimizando para ${nextId}`);
        this.applyVideoQuality(nextOpt).catch(() => {});
        if (this.onAdaptiveQualityCallback) {
          this.onAdaptiveQualityCallback(nextId, `Taxa de bits otimizada para ${nextId} para garantir fluidez.`);
        }
      }
    }
  }

  private stepUpQuality() {
    if (!this.currentQualityOption) return;
    const ladder: VideoQualityId[] = ['4k', '1080p', '720p', '480p', '360p'];
    const currentIndex = ladder.indexOf(this.currentQualityOption.id);
    const targetIndex = ladder.indexOf(this.targetQualityId);

    // Only step up if currently lower than user's preferred quality
    if (currentIndex > targetIndex && currentIndex > 0) {
      const prevId = ladder[currentIndex - 1];
      const prevOpt = VIDEO_QUALITIES.find((q) => q.id === prevId);
      if (prevOpt) {
        console.info(`[WebRTC Adaptive] Rede estável. Restaurando qualidade para ${prevId}`);
        this.applyVideoQuality(prevOpt).catch(() => {});
        if (this.onAdaptiveQualityCallback) {
          this.onAdaptiveQualityCallback(prevId, `Conexão estável: resolução elevada para ${prevId}.`);
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
        // W3C Perfect Negotiation: deterministic initiator (alphabetically greater ID) initiates initial offer
        const isPrimaryInitiator = this.localUserId > targetUserId;

        if (!pc || pc.connectionState === 'new' || pc.connectionState === 'closed') {
          if (isPrimaryInitiator) {
            this.sendOffer(targetUserId).catch(() => {});
          }
        }
      }
    }
  }

  /**
   * Synchronizes active participants list from Firestore.
   */
  syncParticipants(remoteUserIds: string[]) {
    this.currentRemoteUserIds = new Set(remoteUserIds);

    // Clean up participants who completely left the room in Firestore
    for (const [userId, pc] of this.peerConnections) {
      if (!this.currentRemoteUserIds.has(userId)) {
        try {
          pc.close();
        } catch {
          // ignore
        }
        this.peerConnections.delete(userId);
        this.remoteStreams.delete(userId);
        this.pendingCandidates.delete(userId);
        this.isMakingOffer.delete(userId);
        this.ignoreOffer.delete(userId);
        this.isSettingRemoteAnswerPending.delete(userId);

        const timer = this.reconnectTimers.get(userId);
        if (timer) {
          clearTimeout(timer);
          this.reconnectTimers.delete(userId);
        }

        if (this.onPeerDisconnectCallback) {
          this.onPeerDisconnectCallback(userId);
        }
      }
    }

    // Reconcile new peers immediately
    this.reconcileConnections();
  }

  private createPeerConnection(targetUserId: string): RTCPeerConnection {
    const existing = this.peerConnections.get(targetUserId);
    if (existing && existing.connectionState !== 'closed') {
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
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });

    this.peerConnections.set(targetUserId, pc);

    // 1. ICE Candidate Handler
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal(targetUserId, 'candidate', event.candidate.toJSON());
      }
    };

    // 2. Track / Stream Reception Handler with zero-latency buffer
    pc.ontrack = (event) => {
      console.info(`[WebRTC] Received ${event.track.kind} track from peer ${targetUserId}`);
      
      // Optimize receiver jitter buffer for real-time responsiveness
      try {
        const receivers = pc.getReceivers();
        receivers.forEach((rec) => {
          if ('playoutDelayHint' in rec) {
            (rec as unknown as { playoutDelayHint: number }).playoutDelayHint = 0.02; // 20ms buffer
          }
          if ('jitterBufferTarget' in rec) {
            (rec as unknown as { jitterBufferTarget: number }).jitterBufferTarget = 20; // 20ms
          }
        });
      } catch {
        // ignore
      }

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

    // 3. Connection State Change Handler with Intelligent Auto-Recovery (No sudden drops)
    pc.onconnectionstatechange = () => {
      console.info(`[WebRTC] Connection state with ${targetUserId}: ${pc.connectionState}`);
      if (pc.connectionState === 'connected') {
        const timer = this.reconnectTimers.get(targetUserId);
        if (timer) {
          clearTimeout(timer);
          this.reconnectTimers.delete(targetUserId);
        }

        // Apply quality & low-latency settings immediately upon connection
        if (this.currentQualityOption) {
          this.applyQualityToPeer(pc, this.currentQualityOption).catch(() => {});
        }
      } else if (pc.connectionState === 'closed') {
        this.onPeerDisconnectCallback?.(targetUserId);
      } else if (pc.connectionState === 'disconnected') {
        if (!this.reconnectTimers.has(targetUserId)) {
          const timer = setTimeout(() => {
            this.reconnectTimers.delete(targetUserId);
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
              console.info(`[WebRTC] Peer ${targetUserId} disconnected.`);
              this.onPeerDisconnectCallback?.(targetUserId);
            }
          }, 2500);
          this.reconnectTimers.set(targetUserId, timer);
        }
      } else if (pc.connectionState === 'failed') {
        console.warn(`[WebRTC] Connection failed with ${targetUserId}`);
        this.onPeerDisconnectCallback?.(targetUserId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        this.restartConnection(targetUserId);
      }
    };

    return pc;
  }

  private restartConnection(targetUserId: string) {
    if (!this.isListening || !this.currentRemoteUserIds.has(targetUserId)) return;
    const pc = this.peerConnections.get(targetUserId);
    if (pc) {
      try {
        if ('restartIce' in pc) {
          pc.restartIce();
        }
      } catch {
        // ignore
      }
    }
    // Polite peer pattern: higher ID sends offer to re-negotiate
    if (this.localUserId > targetUserId) {
      this.sendOffer(targetUserId).catch(() => {});
    }
  }

  private addTracksToConnection(pc: RTCPeerConnection) {
    const activeStream = this.screenStream || this.localStream;
    const senders = pc.getSenders();

    if (activeStream && activeStream.getTracks().length > 0) {
      activeStream.getTracks().forEach((track) => {
        // Hardware acceleration hint: motion for video, speech for audio
        if (track.kind === 'video') {
          (track as any).contentHint = this.screenStream ? 'detail' : 'motion';
        } else if (track.kind === 'audio') {
          (track as any).contentHint = 'speech';
        }

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
    this.isMakingOffer.set(targetUserId, true);

    try {
      console.info(`[WebRTC] Sending optimized offer to ${targetUserId}...`);
      const pc = this.createPeerConnection(targetUserId);
      this.addTracksToConnection(pc);

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      if (pc.signalingState !== 'stable') return;

      const optimizedSdp = optimizeSdp(offer.sdp || '');
      await pc.setLocalDescription({
        type: offer.type,
        sdp: optimizedSdp,
      });

      await this.sendSignal(targetUserId, 'offer', {
        type: offer.type,
        sdp: optimizedSdp,
      });
    } catch (err) {
      console.warn(`[WebRTC] Failed to send offer to ${targetUserId}:`, err);
    } finally {
      this.isMakingOffer.set(targetUserId, false);
    }
  }

  /**
   * Perfect Negotiation Pattern:
   * Handles offer collisions (glare) smoothly without connection drops or race conditions.
   */
  private async handleIncomingSignal(signal: SignalMessage) {
    const senderId = signal.from;
    if (!senderId || senderId === this.localUserId) return;

    // Deterministic politeness: peer with smaller userId is polite and yields during collisions
    const isPolite = this.localUserId < senderId;

    try {
      if (signal.type === 'offer') {
        const offerData = typeof signal.payload === 'string' ? JSON.parse(signal.payload) : signal.payload;
        const pc = this.createPeerConnection(senderId);
        this.addTracksToConnection(pc);

        const offerCollision = this.isMakingOffer.get(senderId) || pc.signalingState !== 'stable';
        const shouldIgnore = !isPolite && offerCollision;
        this.ignoreOffer.set(senderId, shouldIgnore);

        if (shouldIgnore) {
          console.warn(`[WebRTC] Glare detected with ${senderId}; impolite peer ignoring offer collision.`);
          return;
        }

        if (offerCollision && isPolite) {
          // Polite peer yields by rolling back local offer
          console.info(`[WebRTC] Glare detected with ${senderId}; polite peer yielding.`);
          try {
            await pc.setLocalDescription({ type: 'rollback' });
          } catch {
            // ignore rollback error
          }
        }

        const optimizedRemoteSdp = optimizeSdp(offerData.sdp || '');
        await pc.setRemoteDescription(new RTCSessionDescription({
          type: offerData.type,
          sdp: optimizedRemoteSdp,
        }));

        // Drain queued ICE candidates
        await this.drainPendingCandidates(senderId, pc);

        const answer = await pc.createAnswer();
        const optimizedAnswerSdp = optimizeSdp(answer.sdp || '');

        await pc.setLocalDescription({
          type: answer.type,
          sdp: optimizedAnswerSdp,
        });

        await this.sendSignal(senderId, 'answer', {
          type: answer.type,
          sdp: optimizedAnswerSdp,
        });
      } else if (signal.type === 'answer') {
        const pc = this.peerConnections.get(senderId);
        if (pc && !this.ignoreOffer.get(senderId)) {
          if (pc.signalingState === 'have-local-offer' || pc.signalingState === 'have-remote-pranswer') {
            const answerData = typeof signal.payload === 'string' ? JSON.parse(signal.payload) : signal.payload;
            const optimizedAnswerSdp = optimizeSdp(answerData.sdp || '');

            this.isSettingRemoteAnswerPending.set(senderId, true);
            await pc.setRemoteDescription(new RTCSessionDescription({
              type: answerData.type,
              sdp: optimizedAnswerSdp,
            }));
            this.isSettingRemoteAnswerPending.set(senderId, false);

            await this.drainPendingCandidates(senderId, pc);
          }
        }
      } else if (signal.type === 'candidate') {
        const candidateData = typeof signal.payload === 'string' ? JSON.parse(signal.payload) : signal.payload;
        if (!candidateData) return;

        const pc = this.peerConnections.get(senderId);
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidateData));
          } catch (err) {
            console.warn(`[WebRTC] ICE candidate addition error:`, err);
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
        console.warn(`[WebRTC] Failed to add queued candidate:`, err);
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

    if (videoTrack) {
      (videoTrack as any).contentHint = 'motion';
    }
    if (audioTrack) {
      (audioTrack as any).contentHint = 'speech';
    }

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
    const videoTrack = activeStream ? (activeStream.getVideoTracks()[0] || null) : null;

    if (videoTrack) {
      (videoTrack as any).contentHint = screenStream ? 'detail' : 'motion';
    }

    for (const [, pc] of this.peerConnections) {
      if (pc.connectionState === 'closed') continue;
      const videoSender = pc.getSenders().find((s) => s.track?.kind === 'video' || (!s.track && s.transport));
      if (videoSender) {
        videoSender.replaceTrack(videoTrack).catch(() => {});
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
      try {
        (params.encodings[0] as unknown as { priority: string; networkPriority: string }).priority = 'high';
        (params.encodings[0] as unknown as { priority: string; networkPriority: string }).networkPriority = 'high';
      } catch {
        // ignore
      }
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

    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();

    this.pendingCandidates.clear();
    this.isMakingOffer.clear();
    this.ignoreOffer.clear();
    this.isSettingRemoteAnswerPending.clear();
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
