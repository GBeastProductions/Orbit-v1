import { HitSfxMode, SongDefinition } from '../types/game';

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export interface DecodedCustomAudio {
  buffer: AudioBuffer;
  durationSec: number;
  estimatedBpm: number;
  onsets: number[];
}

class OrbitAudioEngine {
  private ctx: AudioContext | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private freqBins: Uint8Array<ArrayBuffer> | null = null;
  private sfxNoiseBuffer: AudioBuffer | null = null;

  private bufferCache = new Map<string, AudioBuffer>();
  private loadingPromises = new Map<string, Promise<AudioBuffer | null>>();
  private activeSource: AudioBufferSourceNode | null = null;
  private activeSourceGain: GainNode | null = null;
  private activeSongId: string | null = null;
  private playSessionId = 0;

  private playing = false;
  private startedAtCtxTime = 0;
  private startOffsetSec = 0;

  ensureContext(): AudioContext | null {
    if (!this.ctx) {
      try {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return null;
        this.ctx = new Ctx();

        // Transparent gentle limiter keeps music crisp and un-squashed while preventing digital clipping
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-4, this.ctx.currentTime);
        this.compressor.knee.setValueAtTime(12, this.ctx.currentTime);
        this.compressor.ratio.setValueAtTime(2.5, this.ctx.currentTime);
        this.compressor.attack.setValueAtTime(0.002, this.ctx.currentTime);
        this.compressor.release.setValueAtTime(0.12, this.ctx.currentTime);
        this.compressor.connect(this.ctx.destination);

        this.musicGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 64;
        this.analyser.smoothingTimeConstant = 0.78;
        this.freqBins = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));

        this.musicGain.connect(this.analyser);
        this.analyser.connect(this.compressor);
        this.sfxGain.connect(this.compressor);
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  unlock(): void {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  updateVolumes(musicEnabled: boolean, musicVol: number, soundEnabled: boolean, sfxVol: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    if (this.musicGain) {
      this.musicGain.gain.cancelScheduledValues(now);
      this.musicGain.gain.setTargetAtTime(musicEnabled ? (musicVol / 100) * 0.85 : 0, now, 0.02);
    }
    if (this.sfxGain) {
      this.sfxGain.gain.cancelScheduledValues(now);
      this.sfxGain.gain.setTargetAtTime(soundEnabled ? (sfxVol / 100) * 0.72 : 0, now, 0.015);
    }
  }

  async loadSongBuffer(song: SongDefinition): Promise<AudioBuffer | null> {
    if (this.bufferCache.has(song.id)) {
      return this.bufferCache.get(song.id) || null;
    }
    if (this.loadingPromises.has(song.id)) {
      return this.loadingPromises.get(song.id) || null;
    }
    const ctx = this.ensureContext();
    if (!ctx) return null;

    const task = (async () => {
      try {
        if (song.audioUrl) {
          const res = await fetch(song.audioUrl);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const arrayBuf = await res.arrayBuffer();
          const decoded = await ctx.decodeAudioData(arrayBuf.slice(0));
          this.bufferCache.set(song.id, decoded);
          return decoded;
        }
        return null;
      } catch (err) {
        console.warn(`Could not load audio for ${song.title}:`, err);
        return null;
      } finally {
        this.loadingPromises.delete(song.id);
      }
    })();

    this.loadingPromises.set(song.id, task);
    return task;
  }

  async decodeCustomFile(songId: string, file: File): Promise<DecodedCustomAudio | null> {
    const ctx = this.ensureContext();
    if (!ctx) return null;
    try {
      const arrayBuf = await file.arrayBuffer();
      const buffer = await ctx.decodeAudioData(arrayBuf);
      this.bufferCache.set(songId, buffer);
      const { estimatedBpm, onsets } = this.analyzeAudioBeats(buffer);
      return {
        buffer,
        durationSec: buffer.duration,
        estimatedBpm,
        onsets,
      };
    } catch (err) {
      console.warn('Custom audio decode failed:', err);
      return null;
    }
  }

  analyzeAudioBeats(buffer: AudioBuffer): { estimatedBpm: number; onsets: number[] } {
    const data = buffer.getChannelData(0);
    const sr = buffer.sampleRate;
    const hop = Math.floor(sr * 0.02);
    const energies: number[] = [];
    for (let i = 0; i < data.length; i += hop) {
      let sum = 0;
      const end = Math.min(data.length, i + hop);
      for (let j = i; j < end; j++) sum += data[j] * data[j];
      energies.push(Math.sqrt(sum / Math.max(1, end - i)));
    }
    const onsets: number[] = [];
    const win = 10;
    let lastOnset = -1;
    for (let i = win; i < energies.length; i++) {
      let avg = 0;
      for (let k = i - win; k < i; k++) avg += energies[k];
      avg /= win;
      const t = (i * hop) / sr;
      if (energies[i] > avg * 1.48 && energies[i] > 0.045 && t - lastOnset >= 0.24) {
        onsets.push(Number(t.toFixed(3)));
        lastOnset = t;
      }
    }
    let estimatedBpm = 124;
    if (onsets.length >= 8) {
      const intervals: number[] = [];
      for (let i = 1; i < Math.min(onsets.length, 90); i++) {
        const diff = onsets[i] - onsets[i - 1];
        if (diff >= 0.28 && diff <= 1.0) intervals.push(diff);
      }
      if (intervals.length > 0) {
        intervals.sort((a, b) => a - b);
        const median = intervals[Math.floor(intervals.length / 2)];
        let bpm = 60 / median;
        while (bpm < 86) bpm *= 2;
        while (bpm > 172) bpm /= 2;
        estimatedBpm = Math.round(bpm);
      }
    }
    return { estimatedBpm, onsets };
  }

  private teardownSource(src: AudioBufferSourceNode, gain: GainNode | null): void {
    const ctx = this.ctx;
    if (gain && ctx) {
      const now = ctx.currentTime;
      try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
        src.stop(now + 0.03);
      } catch {
        try {
          src.stop();
        } catch {
          // Ignore
        }
      }
      window.setTimeout(() => {
        try {
          src.disconnect();
          gain.disconnect();
        } catch {
          // Ignore
        }
      }, 45);
    } else {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // Ignore
      }
    }
  }

  stop(): void {
    this.playSessionId += 1;
    this.activeSongId = null;
    if (this.activeSource) {
      this.teardownSource(this.activeSource, this.activeSourceGain);
    }
    this.activeSource = null;
    this.activeSourceGain = null;
    this.playing = false;
  }

  async startAtOffset(
    song: SongDefinition,
    offsetSec: number,
    musicEnabled: boolean,
    musicVol: number,
    soundEnabled: boolean,
    sfxVol: number,
    loop = false,
    previewGainScale = 1.0,
  ): Promise<number | null> {
    const ctx = this.ensureContext();
    if (!ctx) return null;
    this.stop();
    const mySession = this.playSessionId;
    this.activeSongId = song.id;

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // Continue cleanly
      }
    }
    if (this.playSessionId !== mySession || this.activeSongId !== song.id) {
      return null;
    }

    this.updateVolumes(musicEnabled, musicVol, soundEnabled, sfxVol);
    const buffer = await this.loadSongBuffer(song);
    if (!buffer || this.playSessionId !== mySession || this.activeSongId !== song.id) {
      return null;
    }

    const safeOffset = Math.max(0, Math.min(offsetSec, Math.max(0, buffer.duration - 0.15)));
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = loop;
    // Strictly lock playbackRate to 1.0x — zero pitch/speed distortion across all difficulties
    src.playbackRate.setValueAtTime(1.0, ctx.currentTime);

    const srcGain = ctx.createGain();
    const now = ctx.currentTime;
    srcGain.gain.setValueAtTime(0.0001, now);
    srcGain.gain.linearRampToValueAtTime(previewGainScale, now + 0.032);
    src.connect(srcGain);
    if (this.musicGain) srcGain.connect(this.musicGain);

    src.onended = () => {
      try {
        src.disconnect();
        srcGain.disconnect();
      } catch {
        // Ignore
      }
      if (this.activeSource === src) {
        this.activeSource = null;
        this.activeSourceGain = null;
        this.playing = false;
      }
    };

    this.activeSource = src;
    this.activeSourceGain = srcGain;
    this.playing = true;
    this.startedAtCtxTime = now;
    this.startOffsetSec = safeOffset;
    src.start(now, safeOffset);

    return buffer.duration;
  }

  syncClock(): number | null {
    if (!this.playing || !this.ctx || this.ctx.state !== 'running') return null;
    return this.startOffsetSec + Math.max(0, this.ctx.currentTime - this.startedAtCtxTime);
  }

  isPlaying(): boolean {
    return this.playing;
  }

  getBassEnergy(): number {
    if (!this.analyser || !this.freqBins || !this.playing) return 0;
    this.analyser.getByteFrequencyData(this.freqBins);
    let sum = 0;
    const count = Math.min(5, this.freqBins.length);
    for (let i = 0; i < count; i++) sum += this.freqBins[i];
    return Math.min(1, sum / (count * 255));
  }

  getSpectrumBins(outBins: Float32Array): boolean {
    if (!this.analyser || !this.freqBins || !this.playing) {
      outBins.fill(0);
      return false;
    }
    this.analyser.getByteFrequencyData(this.freqBins);
    const len = outBins.length;
    const maxSrc = Math.max(1, Math.min(this.freqBins.length, 24));
    for (let i = 0; i < len; i++) {
      const srcIdx = Math.floor((i / len) * maxSrc);
      outBins[i] = this.freqBins[srcIdx] / 255;
    }
    return true;
  }

  private getSfxNoise(): AudioBuffer | null {
    if (this.sfxNoiseBuffer || !this.ctx) return this.sfxNoiseBuffer;
    const len = Math.floor(this.ctx.sampleRate * 0.03);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.35));
    }
    this.sfxNoiseBuffer = buf;
    return buf;
  }

  private getReadySfxCtx(allowResume: boolean): AudioContext | null {
    const ctx = allowResume ? this.ensureContext() : this.ctx;
    if (!ctx || !this.sfxGain) return null;
    if (ctx.state !== 'running') return null;
    return ctx;
  }

  playHit(
    enabled: boolean,
    mode: HitSfxMode,
    combo: number,
    isPerfect: boolean,
    scaleNotes: number[],
  ): void {
    if (!enabled) return;
    const ctx = this.getReadySfxCtx(true);
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const scale = scaleNotes.length > 0 ? scaleNotes : [60, 62, 64, 67, 69, 72];
    const midi = scale[combo % scale.length] + (isPerfect ? 12 : 0);
    const harmonicFreq = midiToFreq(midi);

    if (mode === 'harmonic') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(harmonicFreq, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.22, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.15);
      return;
    }

    if (mode === 'rimshot') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(isPerfect ? 540 : 440, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.032);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.24, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.045);
      return;
    }

    const thock = ctx.createOscillator();
    const thockGain = ctx.createGain();
    thock.type = 'sine';
    thock.frequency.setValueAtTime(isPerfect ? 345 : 280, now);
    thock.frequency.exponentialRampToValueAtTime(72, now + 0.036);
    thockGain.gain.setValueAtTime(0.0001, now);
    thockGain.gain.linearRampToValueAtTime(0.24, now + 0.004);
    thockGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.044);
    thock.connect(thockGain);
    thockGain.connect(this.sfxGain);
    thock.start(now);
    thock.stop(now + 0.048);

    const ping = ctx.createOscillator();
    const pingGain = ctx.createGain();
    ping.type = 'sine';
    ping.frequency.setValueAtTime(harmonicFreq, now);
    pingGain.gain.setValueAtTime(0.0001, now);
    pingGain.gain.linearRampToValueAtTime(isPerfect ? 0.075 : 0.042, now + 0.005);
    pingGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
    ping.connect(pingGain);
    pingGain.connect(this.sfxGain);
    ping.start(now);
    ping.stop(now + 0.08);

    const nb = this.getSfxNoise();
    if (nb) {
      const nSrc = ctx.createBufferSource();
      nSrc.buffer = nb;
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.09, now);
      nGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);
      nSrc.connect(nGain);
      nGain.connect(this.sfxGain);
      nSrc.start(now);
      nSrc.stop(now + 0.022);
    }
  }

  playLessonSlowCue(enabled: boolean): void {
    if (!enabled) return;
    const ctx = this.getReadySfxCtx(true);
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.22);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  playShieldBreak(enabled: boolean): void {
    if (!enabled) return;
    const ctx = this.getReadySfxCtx(true);
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.18);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  playMiss(enabled: boolean): void {
    if (!enabled) return;
    const ctx = this.getReadySfxCtx(true);
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    [185, 130].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      gain.gain.setValueAtTime(0.0001, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.15, now + idx * 0.08 + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.22);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.24);
    });
  }

  playUiTick(enabled: boolean): void {
    if (!enabled) return;
    const ctx = this.getReadySfxCtx(false);
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(680, now);
    osc.frequency.exponentialRampToValueAtTime(920, now + 0.025);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.075, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.032);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.036);
  }

  playUiLaunch(enabled: boolean): void {
    if (!enabled) return;
    const ctx = this.getReadySfxCtx(true);
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    [330, 495, 660].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.035);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.15, now + idx * 0.035 + 0.14);
      gain.gain.setValueAtTime(0.0001, now + idx * 0.035);
      gain.gain.linearRampToValueAtTime(0.11, now + idx * 0.035 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.035 + 0.16);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + idx * 0.035);
      osc.stop(now + idx * 0.035 + 0.18);
    });
  }

  playComboMilestone(enabled: boolean, tier: 1 | 2 | 3): void {
    if (!enabled) return;
    const ctx = this.getReadySfxCtx(true);
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const base = tier === 3 ? 880 : tier === 2 ? 740 : 587.33;
    [base, base * 1.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.045);
      gain.gain.setValueAtTime(0.0001, now + idx * 0.045);
      gain.gain.linearRampToValueAtTime(0.1, now + idx * 0.045 + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.045 + 0.18);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + idx * 0.045);
      osc.stop(now + idx * 0.045 + 0.2);
    });
  }

  playLevelClear(enabled: boolean): void {
    if (!enabled) return;
    const ctx = this.getReadySfxCtx(true);
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.075);
      gain.gain.setValueAtTime(0.0001, now + idx * 0.075);
      gain.gain.linearRampToValueAtTime(0.16, now + idx * 0.075 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.075 + 0.24);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + idx * 0.075);
      osc.stop(now + idx * 0.075 + 0.26);
    });
  }
}

export const audioEngine = new OrbitAudioEngine();
