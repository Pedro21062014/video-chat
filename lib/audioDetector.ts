'use client';

// Web Audio API based speaking detection for active speaker tracking
class AudioActivityDetector {
  private audioCtx: AudioContext | null = null;
  private analysers = new Map<string, { analyser: AnalyserNode; source: MediaStreamAudioSourceNode }>();
  private dataArray: Uint8Array | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private onSpeakingChange?: (speakingMap: Map<string, boolean>, loudSpeakerId: string | null) => void;
  private lastSpeakingMap = new Map<string, boolean>();
  private lastLoudSpeakerId: string | null = null;
  private speakingDebounce = new Map<string, number>();

  constructor(onSpeakingChange?: (speakingMap: Map<string, boolean>, loudSpeakerId: string | null) => void) {
    this.onSpeakingChange = onSpeakingChange;
  }

  private initAudioContext() {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        try {
          this.audioCtx = new AudioCtx();
        } catch {
          // ignore
        }
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  registerStream(userId: string, stream: MediaStream | null, isMuted: boolean = false) {
    if (isMuted || !stream) {
      this.unregisterStream(userId);
      return;
    }

    const audioTracks = stream.getAudioTracks().filter((t) => t.enabled && t.readyState === 'live');
    if (audioTracks.length === 0) {
      this.unregisterStream(userId);
      return;
    }

    this.initAudioContext();
    if (!this.audioCtx) return;

    try {
      // If already tracking, unbind old source first
      if (this.analysers.has(userId)) {
        this.unregisterStream(userId);
      }

      const source = this.audioCtx.createMediaStreamSource(stream);
      const analyser = this.audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);

      this.analysers.set(userId, { analyser, source });

      if (!this.intervalId) {
        this.startLoop();
      }
    } catch {
      // AudioContext source binding fallback
    }
  }

  unregisterStream(userId: string) {
    const entry = this.analysers.get(userId);
    if (entry) {
      try {
        entry.source.disconnect();
      } catch {
        // ignore
      }
      this.analysers.delete(userId);
      this.speakingDebounce.delete(userId);
    }
  }

  private startLoop() {
    if (this.intervalId) return;

    this.intervalId = setInterval(() => {
      if (this.analysers.size === 0) return;

      const newSpeakingMap = new Map<string, boolean>();
      let maxVolume = 0;
      let loudestUserId: string | null = null;
      const now = Date.now();

      this.analysers.forEach(({ analyser }, userId) => {
        if (!this.dataArray || this.dataArray.length !== analyser.frequencyBinCount) {
          this.dataArray = new Uint8Array(analyser.frequencyBinCount);
        }
        // @ts-expect-error TypeScript 5.5+ DOM buffer variance
        analyser.getByteFrequencyData(this.dataArray);

        // Compute average energy
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
          sum += this.dataArray[i];
        }
        const avg = sum / this.dataArray.length;

        // Threshold around ~16-18 (out of 255) to avoid background hiss
        const isSpeakingRaw = avg > 16;
        if (isSpeakingRaw) {
          this.speakingDebounce.set(userId, now);
          if (avg > maxVolume) {
            maxVolume = avg;
            loudestUserId = userId;
          }
        }

        const lastSpoke = this.speakingDebounce.get(userId) || 0;
        const isSpeaking = now - lastSpoke < 450; // hold speaking state for 450ms for natural feel
        newSpeakingMap.set(userId, isSpeaking);
      });

      if (loudestUserId) {
        this.lastLoudSpeakerId = loudestUserId;
      }

      // Check if changes exist
      let changed = false;
      if (newSpeakingMap.size !== this.lastSpeakingMap.size) {
        changed = true;
      } else {
        newSpeakingMap.forEach((val, k) => {
          if (this.lastSpeakingMap.get(k) !== val) {
            changed = true;
          }
        });
      }

      if (changed || loudestUserId !== null) {
        this.lastSpeakingMap = newSpeakingMap;
        if (this.onSpeakingChange) {
          this.onSpeakingChange(newSpeakingMap, this.lastLoudSpeakerId);
        }
      }
    }, 120);
  }

  destroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.analysers.forEach(({ source }) => {
      try {
        source.disconnect();
      } catch {
        // ignore
      }
    });
    this.analysers.clear();
    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch {
        // ignore
      }
      this.audioCtx = null;
    }
  }
}

export { AudioActivityDetector };
