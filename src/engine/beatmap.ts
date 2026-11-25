import { DIFFICULTIES, MOD_CATALOG } from '../data/catalog';
import {
  BeatmapNote,
  DifficultyId,
  JudgmentTier,
  LetterRank,
  MilestoneForecast,
  ModCode,
  SongDefinition,
  SongSection,
  WaveModeId,
} from '../types/game';

export const TAU = Math.PI * 2;

export function wrapAngle(angle: number): number {
  let a = angle % TAU;
  if (a < 0) a += TAU;
  return a;
}

export function signedAngleDiff(current: number, target: number): number {
  return Math.atan2(Math.sin(current - target), Math.cos(current - target));
}

export function formatTimeSec(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${mins}:${String(rem).padStart(2, '0')}`;
}

export function computeModMultiplier(equippedMods: ModCode[]): number {
  let mult = 1.0;
  for (const code of equippedMods) {
    const mod = MOD_CATALOG.find((m) => m.code === code);
    if (mod) mult *= mod.mult;
  }
  return mult;
}

export function getStreakMultiplier(streak: number): number {
  if (streak >= 40) return 1.25;
  if (streak >= 25) return 1.18;
  if (streak >= 12) return 1.1;
  if (streak >= 5) return 1.05;
  return 1.0;
}

export function computeTotalMultiplier(
  diffId: DifficultyId,
  equippedMods: ModCode[],
  streak: number,
): number {
  const diff = DIFFICULTIES[diffId] || DIFFICULTIES.CHILL;
  return diff.mult * computeModMultiplier(equippedMods) * getStreakMultiplier(streak);
}

export function computeHitPoints(
  tier: JudgmentTier,
  diffId: DifficultyId,
  equippedMods: ModCode[],
  streak: number,
): number {
  const baseWeight = tier === 'PERFECT' ? 3 : tier === 'GREAT' ? 2 : tier === 'GOOD' ? 1 : 0;
  if (baseWeight === 0) return 0;
  const totalMult = computeTotalMultiplier(diffId, equippedMods, streak);
  return Math.max(1, Math.round(baseWeight * totalMult));
}

export function computeLetterRank(
  accuracy: number,
  missCount: number,
  cleared: boolean,
): LetterRank {
  if (!cleared) return 'F';
  if (accuracy >= 99.5 && missCount === 0) return 'SS';
  if (accuracy >= 95 && missCount === 0) return 'S';
  if (accuracy >= 88) return 'A';
  if (accuracy >= 76) return 'B';
  if (accuracy >= 62) return 'C';
  return 'D';
}

export function isCashOutEligible(rank: LetterRank): boolean {
  return rank === 'SS' || rank === 'S' || rank === 'A' || rank === 'B' || rank === 'C';
}

export function computeRankOrbBonus(rank: LetterRank, diffId: DifficultyId): number {
  const tierScale =
    diffId === 'DEMON' ? 2.0 : diffId === 'INSANE' ? 1.6 : diffId === 'HARD' ? 1.35 : diffId === 'NORMAL' ? 1.15 : 1.0;
  if (rank === 'SS') return Math.round(30 * tierScale);
  if (rank === 'S') return Math.round(15 * tierScale);
  if (rank === 'A') return Math.round(6 * tierScale);
  if (rank === 'B') return Math.round(3 * tierScale);
  return 0;
}

export function computeNextMilestone(
  accuracy: number,
  missCount: number,
  cleared: boolean,
  diffId: DifficultyId,
): MilestoneForecast {
  const rank = computeLetterRank(accuracy, missCount, cleared);
  const accClamped = Math.max(0, Math.min(100, accuracy));

  if (!cleared || rank === 'F' || rank === 'D') {
    const gap = Math.max(0.1, 62 - accClamped);
    return {
      currentRank: rank,
      nextRank: 'C',
      gapLabel: !cleared
        ? 'Survive to finish with C-Rank+ (62% Acc) to unlock Orb Cash-Out'
        : `${gap.toFixed(1)}% accuracy away from C-Rank Orb Cash-Out`,
      progressPct: Math.min(98, (accClamped / 62) * 100),
      potentialBonusOrbs: computeRankOrbBonus('B', diffId),
    };
  }
  if (rank === 'C') {
    const gap = Math.max(0.1, 76 - accClamped);
    const bonus = computeRankOrbBonus('B', diffId);
    return {
      currentRank: 'C',
      nextRank: 'B',
      gapLabel: `${gap.toFixed(1)}% away from B-Rank (+${bonus} Bonus Orbs)`,
      progressPct: Math.min(99, ((accClamped - 62) / (76 - 62)) * 100),
      potentialBonusOrbs: bonus,
    };
  }
  if (rank === 'B') {
    const gap = Math.max(0.1, 88 - accClamped);
    const bonus = computeRankOrbBonus('A', diffId);
    return {
      currentRank: 'B',
      nextRank: 'A',
      gapLabel: `${gap.toFixed(1)}% away from A-Rank (+${bonus} Bonus Orbs)`,
      progressPct: Math.min(99, ((accClamped - 76) / (88 - 76)) * 100),
      potentialBonusOrbs: bonus,
    };
  }
  if (rank === 'A') {
    const bonus = computeRankOrbBonus('S', diffId);
    if (missCount > 0 && accClamped >= 95) {
      return {
        currentRank: 'A',
        nextRank: 'S',
        gapLabel: `Full Combo (0 misses) needed for S-Rank (+${bonus} Bonus Orbs)`,
        progressPct: 95,
        potentialBonusOrbs: bonus,
      };
    }
    const gap = Math.max(0.1, 95 - accClamped);
    return {
      currentRank: 'A',
      nextRank: 'S',
      gapLabel: `${gap.toFixed(1)}% & 0 misses away from S-Rank (+${bonus} Bonus Orbs)`,
      progressPct: Math.min(99, ((accClamped - 88) / (95 - 88)) * 100),
      potentialBonusOrbs: bonus,
    };
  }
  if (rank === 'S') {
    const gap = Math.max(0.1, 99.5 - accClamped);
    const bonus = computeRankOrbBonus('SS', diffId);
    return {
      currentRank: 'S',
      nextRank: 'SS',
      gapLabel: `${gap.toFixed(1)}% away from SS-Rank Mastery (+${bonus} Bonus Orbs)`,
      progressPct: Math.min(99, ((accClamped - 95) / (99.5 - 95)) * 100),
      potentialBonusOrbs: bonus,
    };
  }
  return {
    currentRank: 'SS',
    nextRank: null,
    gapLabel: 'Maximum SS Mastery Achieved',
    progressPct: 100,
    potentialBonusOrbs: computeRankOrbBonus('SS', diffId),
  };
}

export function getSectionAtProgress(song: SongDefinition, progressPct: number): SongSection {
  let current: SongSection = 'INTRO';
  for (const cue of song.sections) {
    if (progressPct >= cue.startPct) current = cue.label;
  }
  return current;
}

export function pickModeForNote(
  diffId: DifficultyId,
  section: SongSection,
  index: number,
  equippedMods: ModCode[],
  isTutorialTrack: boolean,
): WaveModeId {
  if (equippedMods.includes('SD')) return 'ONE_PASS';
  if (equippedMods.includes('OS') && section === 'BREAKDOWN' && index % 4 === 2) return 'OSU_PORTAL';
  if (equippedMods.includes('HD') && (section === 'DROP' || section === 'BREAKDOWN') && index % 3 === 1) {
    return 'GHOST_PULSE';
  }
  if (isTutorialTrack) {
    if (index < 3) return 'CW_GREEN';
    if (index === 3) return 'CCW_RED';
    if (section === 'INTRO') return index % 4 === 3 ? 'CCW_RED' : 'CW_GREEN';
    if (section === 'BUILD-UP') return index % 4 === 2 ? 'CCW_RED' : 'CW_GREEN';
    if (section === 'DROP') {
      const seq: WaveModeId[] = ['CW_GREEN', 'CW_GREEN', 'CCW_RED', 'CW_GREEN'];
      return seq[index % seq.length];
    }
    return 'CW_GREEN';
  }

  const hasOverclock = equippedMods.includes('OC');
  if (diffId === 'CHILL') {
    if (hasOverclock && section === 'DROP' && index % 5 === 2) return 'DOUBLE_TAP';
    return index % 6 === 4 ? 'CCW_RED' : 'CW_GREEN';
  }
  if (diffId === 'NORMAL') {
    const normalPool: WaveModeId[] =
      section === 'DROP'
        ? ['CW_GREEN', 'DOUBLE_TAP', 'CCW_RED', 'PURPLE_SURGE', 'CW_GREEN']
        : ['CW_GREEN', 'CCW_RED', 'CW_GREEN', 'DOUBLE_TAP'];
    return normalPool[index % normalPool.length];
  }
  if (diffId === 'HARD') {
    const hardPool: WaveModeId[] =
      section === 'DROP'
        ? ['CW_GREEN', 'DOUBLE_TAP', 'CCW_RED', 'CASCADE_CHAIN', 'ORDERED_SEQ', 'PURPLE_SURGE']
        : ['CW_GREEN', 'CCW_RED', 'SNIPER_MICRO', 'MULTI_CLUSTER', 'DECAY_ARC'];
    return hardPool[index % hardPool.length];
  }
  if (diffId === 'INSANE') {
    const insanePool: WaveModeId[] =
      section === 'DROP'
        ? ['CASCADE_CHAIN', 'DOUBLE_TAP', 'PURPLE_SURGE', 'OSU_PORTAL', 'ORDERED_SEQ', 'BRAKE_DRIFT', 'CCW_RED']
        : ['SNIPER_MICRO', 'SPRING_BOUNCE', 'DECAY_ARC', 'MULTI_CLUSTER', 'GHOST_PULSE'];
    return insanePool[index % insanePool.length];
  }

  const demonPool: WaveModeId[] =
    section === 'DROP'
      ? ['ONE_PASS', 'HAZARD_DECOY', 'DOUBLE_TAP', 'OSU_PORTAL', 'CASCADE_CHAIN', 'PURPLE_SURGE', 'BRAKE_DRIFT']
      : ['GHOST_PULSE', 'SNIPER_MICRO', 'ORDERED_SEQ', 'SPRING_BOUNCE', 'DECAY_ARC', 'CCW_RED'];
  return demonPool[index % demonPool.length];
}

export function buildSongBeatmap(
  song: SongDefinition,
  diffId: DifficultyId,
  equippedMods: ModCode[],
): BeatmapNote[] {
  const effectiveDiff: DifficultyId = song.chillOnly ? 'CHILL' : diffId;
  const cfg = DIFFICULTIES[effectiveDiff] || DIFFICULTIES.CHILL;
  const isTutorialTrack = song.id === 'moments_passing';

  if (song.isCustom && song.customOnsets && song.customOnsets.length >= 12) {
    const notes: BeatmapNote[] = [];
    const stride = effectiveDiff === 'CHILL' ? 2 : 1;
    let idx = 0;
    for (let i = 0; i < song.customOnsets.length; i += stride) {
      const t = song.customOnsets[i];
      if (t < 1.2 || t > song.durationSec - 1.5) continue;
      const nextT = song.customOnsets[i + stride] || t + 0.8;
      const prog = t / Math.max(1, song.durationSec);
      const section = getSectionAtProgress(song, prog);
      notes.push({
        index: idx,
        hitTime: t,
        stepSec: Math.max(0.32, Math.min(2.2, nextT - t)),
        modeId: pickModeForNote(effectiveDiff, section, idx, equippedMods, false),
        section,
      });
      idx += 1;
    }
    if (notes.length >= 8) return notes;
  }

  const beatDur = 60 / Math.max(65, song.bpm);
  const dtMult = equippedMods.includes('DT') ? 0.82 : 1.0;
  const notes: BeatmapNote[] = [];
  let t = 1.4;
  let idx = 0;
  const endLimit = Math.max(10, song.durationSec - 1.6);

  while (t < endLimit) {
    const prog = t / Math.max(1, song.durationSec);
    const section = getSectionAtProgress(song, prog);
    const secScale =
      section === 'DROP'
        ? 0.82
        : section === 'BUILD-UP'
        ? 0.92
        : section === 'BREAKDOWN'
        ? 1.15
        : section === 'OUTRO'
        ? 1.25
        : 1.05;
    const stepBeats = Math.max(0.45, cfg.subdivisionBeats * secScale * dtMult);
    const modeId = pickModeForNote(effectiveDiff, section, idx, equippedMods, isTutorialTrack);

    notes.push({
      index: idx,
      hitTime: t,
      stepSec: stepBeats * beatDur,
      modeId,
      section,
    });
    t += stepBeats * beatDur;
    idx += 1;
  }

  return notes;
}
