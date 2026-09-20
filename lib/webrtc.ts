import { db } from './firebase';
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  query,
  where,
  deleteDoc,
  getDocs,
} from 'firebase/firestore';
import { VideoQualityOption } from './types';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

export class PeerConnectionManager {
  private roomId: string;
  private localUserId: string;
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private currentQualityOption: VideoQualityOption | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private remoteStreams: Map<string, MediaStream> = new Map();
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private onRemoteStreamCallback?: (peerId: string, stream: MediaStream) => void;
  private onPeerDisconnectCallback?: (peerId: string) => void;
  private unsubscribeSignals?: () => void;
  private processedSignals = new Set<string>();

  constructor(
    roomId: string,
    localUserId: string,
    onRemoteStream?: (peerId: string, stream: MediaStream) => void,
    onPeerDisconnect?: (peerId: string) => void
  ) {
    this.roomId = roomId;
    this.localUserId = localUserId;
    this.onRemoteStreamCallback = onRemoteStream;
    this.onPeerDisconnectCallback = onPeerDisconnect;
  }

  async applyVideoQuality(opt: VideoQualityOption) {
    this.currentQualityOption = opt;
    for (const [, pc] of this.peerConnections) {
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
        console.warn('Could not set encoding parameters on video sender:', err);
      }
    }
  }

  setLocalStream(stream: MediaStream | null) {
    this.localStream = stream;
    // Update tracks in active peer connections
    this.peerConnections.forEach((pc) => {
      const senders = pc.getSenders();
      if (stream) {
        stream.getTracks().forEach(async (track) => {
          const sender = senders.find((s) => s.track?.kind === track.kind);
          if (sender) {
            await sender.replaceTrack(track);
          } else {
            pc.addTrack(track, stream);
          }
        });
      }
    });

    if (this.currentQualityOption) {
      this.applyVideoQuality(this.currentQualityOption).catch(() => {});
    }
  }

  setScreenStream(screenStream: MediaStream | null) {
    this.screenStream = screenStream;
    const activeStream = screenStream || this.localStream;
    if (!activeStream) return;

    const videoTrack = activeStream.getVideoTracks()[0];
    if (videoTrack) {
      this.peerConnections.forEach((pc) => {
        const videoSender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(videoTrack);
        }
      });
    }
  }

  // Start listening to incoming WebRTC signals
  startListening() {
    const signalsRef = collection(db, 'rooms', this.roomId, 'signals');
    const q = query(signalsRef, where('to', '==', this.localUserId));

    this.unsubscribeSignals = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const docId = change.doc.id;
          if (this.processedSignals.has(docId)) return;
          this.processedSignals.add(docId);

          const data = change.doc.data();
          const { from, type, payload } = data;

          await this.handleIncomingSignal(from, type, payload);

          // Clean up consumed signal
          try {
            await deleteDoc(doc(signalsRef, docId));
          } catch {
            // ignore
          }
        }
      });
    });
  }

  private async getOrCreatePeer(peerId: string): Promise<RTCPeerConnection> {
    let pc = this.peerConnections.get(peerId);
    if (pc && pc.connectionState !== 'closed') {
      return pc;
    }

    pc = new RTCPeerConnection(RTC_CONFIG);
    this.peerConnections.set(peerId, pc);

    // Add local tracks
    const activeStream = this.screenStream || this.localStream;
    if (activeStream) {
      activeStream.getTracks().forEach((track) => {
        const sender = pc!.addTrack(track, activeStream);
        if (track.kind === 'video' && this.currentQualityOption) {
          try {
            const params = sender.getParameters();
            if (!params.encodings || params.encodings.length === 0) {
              params.encodings = [{}];
            }
            params.encodings[0].maxBitrate = this.currentQualityOption.bitrate;
            params.encodings[0].maxFramerate = this.currentQualityOption.frameRate;
            if (this.currentQualityOption.scaleResolutionDownBy > 1) {
              params.encodings[0].scaleResolutionDownBy = this.currentQualityOption.scaleResolutionDownBy;
            }
            sender.setParameters(params);
          } catch {
            // ignore
          }
        }
      });
    } else if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        const sender = pc!.addTrack(track, this.localStream!);
        if (track.kind === 'video' && this.currentQualityOption) {
          try {
            const params = sender.getParameters();
            if (!params.encodings || params.encodings.length === 0) {
              params.encodings = [{}];
            }
            params.encodings[0].maxBitrate = this.currentQualityOption.bitrate;
            params.encodings[0].maxFramerate = this.currentQualityOption.frameRate;
            if (this.currentQualityOption.scaleResolutionDownBy > 1) {
              params.encodings[0].scaleResolutionDownBy = this.currentQualityOption.scaleResolutionDownBy;
            }
            sender.setParameters(params);
          } catch {
            // ignore
          }
        }
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        await this.sendSignal(peerId, 'candidate', JSON.stringify(event.candidate));
      }
    };

    // Handle remote track
    pc.ontrack = (event) => {
      let stream = this.remoteStreams.get(peerId);
      if (!stream) {
        stream = new MediaStream();
      }
      if (event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach((track) => {
          if (!stream!.getTracks().some((t) => t.id === track.id)) {
            stream!.addTrack(track);
          }
        });
      } else if (event.track) {
        if (!stream.getTracks().some((t) => t.id === event.track.id)) {
          stream.addTrack(event.track);
        }
      }

      // Clone a fresh stream reference with current tracks to trigger React state updates
      const updatedStream = new MediaStream(stream.getTracks());
      this.remoteStreams.set(peerId, updatedStream);

      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(peerId, updatedStream);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc!.connectionState === 'disconnected' || pc!.connectionState === 'failed' || pc!.connectionState === 'closed') {
        if (this.onPeerDisconnectCallback) {
          this.onPeerDisconnectCallback(peerId);
        }
      }
    };

    return pc;
  }

  // Initiator creates offer to peer
  async connectToPeer(peerId: string) {
    if (peerId === this.localUserId) return;
    const pc = await this.getOrCreatePeer(peerId);

    // If already negotiating or have local offer, wait or skip
    if (pc.signalingState !== 'stable') return;

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);
      await this.sendSignal(peerId, 'offer', JSON.stringify(offer));
    } catch {
      // ignore
    }
  }

  private async flushPendingCandidates(peerId: string, pc: RTCPeerConnection) {
    const queued = this.pendingCandidates.get(peerId) || [];
    if (queued.length === 0) return;
    this.pendingCandidates.delete(peerId);

    for (const cand of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch {
        // ignore
      }
    }
  }

  private async handleIncomingSignal(from: string, type: string, payload: string) {
    try {
      const pc = await this.getOrCreatePeer(from);

      if (type === 'offer') {
        const offer = JSON.parse(payload);
        // Handle offer collision / glare
        if (pc.signalingState !== 'stable') {
          // If local ID is lower, yield and rollback local offer (polite peer)
          if (this.localUserId < from) {
            await pc.setLocalDescription({ type: 'rollback' } as RTCSessionDescriptionInit);
          } else {
            // Impolite peer ignores colliding offer
            return;
          }
        }

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await this.flushPendingCandidates(from, pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await this.sendSignal(from, 'answer', JSON.stringify(answer));
      } else if (type === 'answer') {
        const answer = JSON.parse(payload);
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          await this.flushPendingCandidates(from, pc);
        }
      } else if (type === 'candidate') {
        const candidate = JSON.parse(payload);
        if (candidate) {
          if (!pc.remoteDescription || !pc.remoteDescription.type) {
            const list = this.pendingCandidates.get(from) || [];
            list.push(candidate);
            this.pendingCandidates.set(from, list);
          } else {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch {
              // ignore
            }
          }
        }
      }
    } catch {
      // Signal error fallback
    }
  }

  private async sendSignal(to: string, type: 'offer' | 'answer' | 'candidate', payload: string) {
    try {
      const signalsRef = collection(db, 'rooms', this.roomId, 'signals');
      const newSignalDoc = doc(signalsRef);
      await setDoc(newSignalDoc, {
        from: this.localUserId,
        to,
        type,
        payload,
        timestamp: Date.now(),
      });
    } catch {
      // ignore
    }
  }

  async closeAll() {
    if (this.unsubscribeSignals) {
      this.unsubscribeSignals();
    }
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
    this.remoteStreams.clear();

    // Clean up signals created by this user
    try {
      const signalsRef = collection(db, 'rooms', this.roomId, 'signals');
      const q = query(signalsRef, where('from', '==', this.localUserId));
      const snap = await getDocs(q);
      snap.forEach((d) => deleteDoc(d.ref));
    } catch {
      // ignore
    }
  }
}
