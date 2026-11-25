import { BADGE_CATALOG, DIFFICULTIES, MOD_CATALOG } from '../data/catalog';
import { SONG_CHARTS } from '../data/songCharts';
import {
  BeatmapNote,
  DifficultyId,
  JudgmentTier,
  LetterRank,
  MilestoneForecast,
  ModCode,
  PlayerProfile,
  SongDefinition,
  SongSection,
  TrophyBadge,
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
    diffId === 'DEMON'
      ? 2.0
      : diffId === 'INSANE'
      ? 1.6
      : diffId === 'HARD'
      ? 1.35
      : diffId === 'NORMAL'
      ? 1.15
      : 1.0;
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

/**
 * Hand-crafted mode assignment tailored to song archetype, section energy,
 * local transient gap (enables natural Hold Arcs), and active Mods.
 */
function pickMusicalModeForAnchor(
  song: SongDefinition,
  diffId: DifficultyId,
  section: SongSection,
  prevSection: SongSection,
  index: number,
  energy: number,
  gapToNextSec: number,
  equippedMods: ModCode[],
  holdBias: number,
  burstBias: number,
  flipBias: number,
): { modeId: WaveModeId; holdDurationSec?: number; burstCount?: number } {
  const mirror = equippedMods.includes('MR');
  const coreCw: WaveModeId = mirror ? 'CCW_RED' : 'CW_GREEN';
  const coreFlip: WaveModeId = mirror ? 'CW_GREEN' : 'CCW_RED';

  // Sudden Death overrides non-hold/non-fever taps cleanly on strict notes
  if (equippedMods.includes('SD')) {
    if (gapToNextSec >= 1.28 && index % 6 === 3) {
      return { modeId: 'HOLD_ARC', holdDurationSec: Math.min(1.4, gapToNextSec * 0.62) };
    }
    return { modeId: 'ONE_PASS' };
  }

  // Tutorial track hand-sculpted gentle progression synced tightly to intro & drop chords
  if (song.id === 'moments_passing') {
    if (index <= 1) return { modeId: coreCw };
    if (index === 2) return { modeId: coreCw };
    if (index === 3 && gapToNextSec >= 1.15) {
      return { modeId: 'HOLD_ARC', holdDurationSec: Number(Math.min(1.1, Math.max(0.65, gapToNextSec - 0.42)).toFixed(2)) };
    }
    if (index === 4) return { modeId: coreFlip };
    if (gapToNextSec >= 1.3 && index % 5 === 2) {
      return { modeId: 'HOLD_ARC', holdDurationSec: Number(Math.min(1.2, gapToNextSec - 0.44)).toFixed(2) as unknown as number };
    }
    if (section === 'DROP' && index % 4 === 3) return { modeId: coreFlip };
    return { modeId: coreCw };
  }

  // Portal Link mod during breakdowns
  if (equippedMods.includes('OS') && section === 'BREAKDOWN' && index % 4 === 2 && gapToNextSec >= 0.72) {
    return { modeId: 'OSU_PORTAL' };
  }

  // Hidden Fade mod cues extra stealth targets on drops/breakdowns
  if (equippedMods.includes('HD') && (section === 'DROP' || section === 'BREAKDOWN') && index % 4 === 1) {
    return { modeId: 'GHOST_PULSE' };
  }

  // Fever Spinner on Build-Up -> Drop transitions (Hard+ or Overclock) with guaranteed room before drop
  const isDropTransition = prevSection === 'BUILD-UP' && section === 'DROP';
  if (
    isDropTransition &&
    (diffId === 'HARD' || diffId === 'INSANE' || diffId === 'DEMON' || equippedMods.includes('OC')) &&
    gapToNextSec >= 1.25
  ) {
    return { modeId: 'FEVER_SPINNER', holdDurationSec: Number(Math.min(1.6, gapToNextSec - 0.34)).toFixed(2) as unknown as number };
  }

  // Natural Hold Arc when music opens up between beats — always leave >= 0.38s breathing room after release
  const minHoldGap = diffId === 'CHILL' ? 1.22 : 1.04;
  const canPlaceHold =
    gapToNextSec >= minHoldGap &&
    index > 1 &&
    (section === 'INTRO' || section === 'BREAKDOWN' || section === 'BUILD-UP' || (section === 'DROP' && energy < 0.78));
  if (canPlaceHold) {
    const holdModulo = Math.max(3, Math.round(1 / Math.max(0.14, holdBias)));
    if (index % holdModulo === 2 || gapToNextSec >= 1.58) {
      const dur = Math.max(0.55, Math.min(1.55, gapToNextSec - 0.40));
      return { modeId: 'HOLD_ARC', holdDurationSec: Number(dur.toFixed(2)) };
    }
  }

  const hasOverclock = equippedMods.includes('OC');
  const canSlash = gapToNextSec >= 0.64;

  if (diffId === 'CHILL') {
    if (hasOverclock && section === 'DROP' && index % 5 === 2) return { modeId: 'DOUBLE_TAP' };
    if (hasOverclock && canSlash && section === 'BUILD-UP' && index % 6 === 4) return { modeId: 'METEOR_SLASH' };
    return { modeId: index % 6 === 4 ? coreFlip : coreCw };
  }

  if (diffId === 'NORMAL') {
    if (section === 'DROP') {
      const pool: WaveModeId[] =
        burstBias >= 0.22
          ? [coreCw, 'DOUBLE_TAP', coreFlip, canSlash ? 'METEOR_SLASH' : coreCw, 'PURPLE_SURGE', coreCw]
          : [coreCw, coreFlip, 'DOUBLE_TAP', 'PURPLE_SURGE', canSlash ? 'METEOR_SLASH' : coreFlip];
      return { modeId: pool[index % pool.length] };
    }
    if (index % 7 === 5) return { modeId: 'DOUBLE_TAP' };
    return { modeId: index % 4 === 3 ? coreFlip : coreCw };
  }

  if (diffId === 'HARD') {
    if (section === 'DROP') {
      const pool: WaveModeId[] = [
        coreCw,
        'DOUBLE_TAP',
        canSlash ? 'METEOR_SLASH' : coreFlip,
        'BEAT_BURST',
        'CASCADE_CHAIN',
        coreFlip,
        gapToNextSec >= 0.9 ? 'ORDERED_SEQ' : coreCw,
        'PURPLE_SURGE',
      ];
      const chosen = pool[index % pool.length];
      return { modeId: chosen, burstCount: chosen === 'BEAT_BURST' ? 3 : undefined };
    }
    if (section === 'BUILD-UP' && index % 5 === 3 && gapToNextSec >= 1.15) {
      return { modeId: 'FEVER_SPINNER', holdDurationSec: Number(Math.min(1.35, gapToNextSec - 0.32)).toFixed(2) as unknown as number };
    }
    const calmPool: WaveModeId[] = [
      coreCw,
      coreFlip,
      'SNIPER_MICRO',
      gapToNextSec >= 0.72 ? 'MULTI_CLUSTER' : coreCw,
      'DECAY_ARC',
      canSlash ? 'METEOR_SLASH' : coreFlip,
    ];
    return { modeId: calmPool[index % calmPool.length] };
  }

  if (diffId === 'INSANE') {
    if (section === 'DROP') {
      const pool: WaveModeId[] = [
        'DOUBLE_TAP',
        'BEAT_BURST',
        canSlash ? 'METEOR_SLASH' : 'PURPLE_SURGE',
        'CASCADE_CHAIN',
        'PURPLE_SURGE',
        gapToNextSec >= 0.72 ? 'OSU_PORTAL' : coreCw,
        gapToNextSec >= 0.85 ? 'ORDERED_SEQ' : 'DOUBLE_TAP',
        'BRAKE_DRIFT',
        coreFlip,
      ];
      const chosen = pool[index % pool.length];
      return { modeId: chosen, burstCount: chosen === 'BEAT_BURST' ? 3 : undefined };
    }
    const calmPool: WaveModeId[] = [
      'SNIPER_MICRO',
      'SPRING_BOUNCE',
      'DECAY_ARC',
      gapToNextSec >= 0.72 ? 'MULTI_CLUSTER' : coreCw,
      'GHOST_PULSE',
      gapToNextSec >= 1.15 ? 'FEVER_SPINNER' : 'DOUBLE_TAP',
      'HAZARD_DECOY',
    ];
    const chosen = calmPool[index % calmPool.length];
    return {
      modeId: chosen,
      holdDurationSec:
        chosen === 'FEVER_SPINNER'
          ? Number(Math.min(1.25, gapToNextSec - 0.32)).toFixed(2) as unknown as number
          : undefined,
    };
  }

  // DEMON: Crisp click-sync showcase blending double-clicks, bursts, flips, slashes, portals, and selective ONE_PASS drop accents!
  if (section === 'DROP') {
    if (energy >= 0.78 && index % 6 === 0) {
      return { modeId: 'ONE_PASS' };
    }
    const demonDropPool: WaveModeId[] = [
      'DOUBLE_TAP',
      'BEAT_BURST',
      canSlash ? 'METEOR_SLASH' : 'DOUBLE_TAP',
      'HAZARD_DECOY',
      'CASCADE_CHAIN',
      gapToNextSec >= 0.72 ? 'OSU_PORTAL' : 'PURPLE_SURGE',
      'PURPLE_SURGE',
      gapToNextSec >= 0.82 ? 'ORDERED_SEQ' : 'BEAT_BURST',
      'BRAKE_DRIFT',
      flipBias >= 0.24 ? coreFlip : coreCw,
    ];
    const chosen = demonDropPool[index % demonDropPool.length];
    return { modeId: chosen, burstCount: chosen === 'BEAT_BURST' ? 3 : undefined };
  }

  if (section === 'BUILD-UP' && index % 6 === 4 && gapToNextSec >= 1.15) {
    return { modeId: 'FEVER_SPINNER', holdDurationSec: Number(Math.min(1.2, gapToNextSec - 0.32)).toFixed(2) as unknown as number };
  }

  const demonVersePool: WaveModeId[] = [
    'SNIPER_MICRO',
    'DOUBLE_TAP',
    'GHOST_PULSE',
    'SPRING_BOUNCE',
    'DECAY_ARC',
    gapToNextSec >= 0.72 ? 'MULTI_CLUSTER' : coreCw,
    gapToNextSec >= 0.82 ? 'ORDERED_SEQ' : coreFlip,
    coreFlip,
  ];
  return { modeId: demonVersePool[index % demonVersePool.length] };
}

/**
 * Snaps a candidate audio transient onto the nearest musical subdivision (1/4 beat)
 * when within 55ms so notes land cleanly on the song's rhythmic pulse.
 */
function snapToMusicalSubdivision(t: number, phase: number, beatDur: number): number {
  const sub = beatDur / 4; // 16th-note pulse resolution
  const steps = Math.round((t - phase) / sub);
  const gridT = phase + steps * sub;
  if (Math.abs(gridT - t) <= 0.055) {
    return Number(gridT.toFixed(3));
  }
  return Number(t.toFixed(3));
}

interface RestWindow {
  startSec: number;
  endSec: number;
}

/**
 * Splits long songs (105s+) with 1–2 genuine musical breaks (6–20s) synced to breakdowns
 * or mid-track energy valleys so players get natural breathers & clean resync cues.
 */
function buildMusicalRestWindows(song: SongDefinition, curve: number[]): RestWindow[] {
  const dur = song.durationSec;
  if (song.id === 'moments_passing' || dur < 108) return [];

  const desiredCount = dur >= 175 ? 2 : 1;
  const targetCenters =
    desiredCount === 2 ? [dur * 0.41, dur * 0.72] : [dur * 0.54];
  const restLen = dur >= 220 ? 15.5 : dur >= 175 ? 11.5 : 8.5;

  const breaks: RestWindow[] = [];
  for (const center of targetCenters) {
    // Look near center (±18s) for lowest 5s energy valley or BREAKDOWN section
    const breakdownCue = song.sections.find(
      (s) => s.label === 'BREAKDOWN' && Math.abs(s.startPct * dur - center) < 26,
    );
    let bestStart = center - restLen * 0.45;
    if (breakdownCue) {
      bestStart = breakdownCue.startPct * dur + 1.2;
    } else if (curve.length > 8) {
      let minE = Infinity;
      const minIdx = Math.max(4, Math.floor((center - 18) / 5));
      const maxIdx = Math.min(curve.length - 5, Math.ceil((center + 18) / 5));
      for (let bi = minIdx; bi <= maxIdx; bi++) {
        if (curve[bi] < minE) {
          minE = curve[bi];
          bestStart = bi * 5;
        }
      }
    }
    const clampedStart = Math.max(24, Math.min(dur - restLen - 16, bestStart));
    breaks.push({
      startSec: Number(clampedStart.toFixed(2)),
      endSec: Number((clampedStart + restLen).toFixed(2)),
    });
  }
  return breaks;
}

function computeDynamicNoteDynamics(
  diffId: DifficultyId,
  section: SongSection,
  energy: number,
  index: number,
  modeId: WaveModeId,
): { sizeScale: number; speedScale: number } {
  const phraseWave = Math.sin(index * 0.72);

  if (diffId === 'CHILL') {
    // Chill keeps generously wide sectors and smooth predictable cadence
    const sizeScale = section === 'DROP' ? 1.18 : 1.26;
    const speedScale = section === 'DROP' ? 1.04 : 0.94;
    return { sizeScale, speedScale };
  }

  if (diffId === 'NORMAL') {
    const sizeScale =
      section === 'DROP'
        ? 1.06 + phraseWave * 0.1
        : section === 'BREAKDOWN'
        ? 0.94
        : 1.0 + phraseWave * 0.08;
    const speedScale = section === 'DROP' ? 1.08 : section === 'BREAKDOWN' ? 0.9 : 1.0;
    return {
      sizeScale: Number(Math.max(0.84, Math.min(1.22, sizeScale)).toFixed(2)),
      speedScale: Number(Math.max(0.86, Math.min(1.14, speedScale)).toFixed(2)),
    };
  }

  // HARD / INSANE / DEMON: deliberate speed-size musical interplay
  // Calm breakdowns/verses = slower dial speed + tighter precision target;
  // Drops/chorus bursts = brisk kinetic dial speed + wider satisfying catch window.
  let sizeScale = 1.0;
  let speedScale = 1.0;

  if (section === 'BREAKDOWN' || section === 'INTRO' || energy < 0.48) {
    sizeScale = 0.78 + (phraseWave > 0 ? 0.08 : -0.06);
    speedScale = 0.8 + (phraseWave > 0 ? 0.05 : -0.04);
  } else if (section === 'DROP' || energy >= 0.76) {
    if (phraseWave >= -0.15) {
      // Fast speed + Big catch targets on main chorus surges
      sizeScale = 1.16 + Math.min(0.18, (energy - 0.65) * 0.45);
      speedScale = 1.16 + Math.min(0.14, (energy - 0.65) * 0.35);
    } else {
      // Contrasting bar accent: brief slow-precision tuck
      sizeScale = 0.82;
      speedScale = 0.88;
    }
  } else {
    sizeScale = 0.96 + phraseWave * 0.18;
    speedScale = 0.98 + phraseWave * 0.14;
  }

  if (modeId === 'DOUBLE_TAP' || modeId === 'BEAT_BURST') {
    sizeScale = Math.max(sizeScale, 1.14);
    speedScale = Math.min(speedScale, 1.04);
  } else if (modeId === 'SNIPER_MICRO') {
    speedScale = Math.min(speedScale, 0.88);
  }

  return {
    sizeScale: Number(Math.max(0.68, Math.min(1.36, sizeScale)).toFixed(2)),
    speedScale: Number(Math.max(0.75, Math.min(1.30, speedScale)).toFixed(2)),
  };
}

/**
 * Generates an audio-locked BeatmapNote[] where EVERY note hits on a real MP3 transient
 * or quantized musical subdivision inside that specific track.
 */
export function buildSongBeatmap(
  song: SongDefinition,
  diffId: DifficultyId,
  equippedMods: ModCode[],
): BeatmapNote[] {
  const effectiveDiff: DifficultyId = song.chillOnly ? 'CHILL' : diffId;
  const cfg = DIFFICULTIES[effectiveDiff] || DIFFICULTIES.CHILL;
  const blueprint = SONG_CHARTS[song.id];
  const dtActive = equippedMods.includes('DT');
  const minGap = Math.max(0.20, cfg.minGapSec * (dtActive ? 0.82 : 1.0));
  const targetGap = cfg.targetGapSec * (dtActive ? 0.84 : 1.0);

  // Path 1: Custom MP3 uploaded by player
  if (song.isCustom && song.customOnsets && song.customOnsets.length >= 8) {
    const notes: BeatmapNote[] = [];
    const beatDur = 60 / Math.max(65, song.bpm);
    let lastT = -99;
    let idx = 0;
    let prevSec: SongSection = 'INTRO';
    for (let i = 0; i < song.customOnsets.length; i++) {
      const rawT = song.customOnsets[i];
      if (rawT < 1.2 || rawT > song.durationSec - 1.35) continue;
      const t = snapToMusicalSubdivision(rawT, song.customOnsets[0] || 0.25, beatDur);
      if (t - lastT < minGap) continue;
      const nextT =
        song.customOnsets.find((nt, j) => j > i && nt - t >= minGap) || song.durationSec - 1.0;
      const gap = Math.max(0.24, nextT - t);
      const prog = t / Math.max(1, song.durationSec);
      const sec = getSectionAtProgress(song, prog);
      const picked = pickMusicalModeForAnchor(
        song,
        effectiveDiff,
        sec,
        prevSec,
        idx,
        0.7,
        gap,
        equippedMods,
        0.18,
        0.18,
        0.2,
      );
      notes.push({
        index: idx,
        hitTime: Number(t.toFixed(3)),
        stepSec: Number(Math.max(0.22, Math.min(2.4, gap)).toFixed(3)),
        modeId: picked.modeId,
        section: sec,
        energy: 0.72,
        holdDurationSec: picked.holdDurationSec ? Number(picked.holdDurationSec) : undefined,
        burstCount: picked.burstCount,
      });
      prevSec = sec;
      lastT = t;
      idx += 1;
    }
    if (notes.length >= 6) return notes;
  }

  // Path 2: Official Bundled 13 MP3s using quantized musical transient anchors & steady beat-grid backbone
  if (blueprint && blueprint.peaks.length > 0) {
    const dur = blueprint.durationSec;
    const beatDur = 60 / Math.max(65, blueprint.bpm);
    const phase = blueprint.phaseSec || 0.2;
    const rawPeaks = blueprint.peaks;

    // Step A: Build unified candidate anchors quantized cleanly onto musical subdivisions
    const anchorMap = new Map<number, { t: number; e: number }>();

    for (const [pt, pe] of rawPeaks) {
      const snapped = snapToMusicalSubdivision(pt, phase, beatDur);
      const key = Math.round(snapped * 100);
      const existing = anchorMap.get(key);
      if (!existing || pe > existing.e) {
        anchorMap.set(key, { t: snapped, e: pe });
      }
    }

    // Musical beat-grid pulses: Chill rides half-bar / 2-beat groove; Normal rides steady beats; Hard+ unlocks full beat & off-beat sync
    const fillStep =
      effectiveDiff === 'CHILL'
        ? beatDur * 2
        : effectiveDiff === 'NORMAL'
        ? beatDur
        : effectiveDiff === 'HARD'
        ? beatDur
        : beatDur * 0.5;

    let cursor = phase + beatDur * 2;
    while (cursor < dur - 1.35) {
      if (cursor >= 1.15) {
        const snappedC = Number(cursor.toFixed(3));
        const hasNearby = Array.from(anchorMap.values()).some(
          (a) => Math.abs(a.t - snappedC) < fillStep * 0.42,
        );
        if (!hasNearby) {
          const bIdx = Math.min(blueprint.energyCurve.length - 1, Math.floor(snappedC / 5));
          const localE = blueprint.energyCurve[bIdx] ?? 0.55;
          // Only fill steady beats where music is audible cleanly (skip near-silent fades)
          if (localE >= 0.14) {
            anchorMap.set(Math.round(snappedC * 100), {
              t: snappedC,
              e: Number((localE * 0.8).toFixed(2)),
            });
          }
        }
      }
      cursor += fillStep;
    }

    const anchors = Array.from(anchorMap.values()).sort((a, b) => a.t - b.t);
    const restWindows = buildMusicalRestWindows(song, blueprint.energyCurve);

    // Step B: Curate anchors strictly adhering to musical BPM spacing, rest breaks & Tutorial opening breathers
    const selected: { t: number; e: number }[] = [];
    let lastSelectedT = -10;
    const isTutorial = song.id === 'moments_passing' && effectiveDiff === 'CHILL';

    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[i];
      if (a.t < (isTutorial ? 1.65 : 1.15) || a.t > dur - 1.35) continue;
      if (restWindows.some((rw) => a.t >= rw.startSec && a.t <= rw.endSec)) continue;

      const bIdx = Math.min(blueprint.energyCurve.length - 1, Math.floor(a.t / 5));
      const energy = blueprint.energyCurve[bIdx] ?? 0.6;
      const prog = a.t / Math.max(1, dur);
      const sec = getSectionAtProgress(song, prog);

      // Quantize target spacing neatly onto integer multiples of half-beat / beat
      const secSpacingScale =
        isTutorial && selected.length < 6
          ? 1.35
          : sec === 'DROP'
          ? 0.86
          : sec === 'BUILD-UP'
          ? 0.94
          : 1.05;
      const desiredGap = Math.max(minGap, targetGap * secSpacingScale);

      if (a.t - lastSelectedT < desiredGap * 0.86) continue;

      // Prefer stronger downbeat peaks when two peaks sit closely together
      if ((effectiveDiff === 'CHILL' || effectiveDiff === 'NORMAL') && a.e < 0.3 && i + 1 < anchors.length) {
        const nextStrong = anchors[i + 1];
        if (nextStrong.t - a.t < beatDur * 0.65 && nextStrong.e > a.e * 1.28) continue;
      }

      selected.push({ t: a.t, e: Math.max(a.e, energy) });
      lastSelectedT = a.t;
    }

    // Step C: Build final BeatmapNotes with dynamic size/speed contrast & clean post-hold recovery
    const notes: BeatmapNote[] = [];
    let prevSection: SongSection = 'INTRO';

    for (let i = 0; i < selected.length; i++) {
      const cur = selected[i];
      const next = selected[i + 1];
      const gap = next ? next.t - cur.t : Math.max(0.9, dur - cur.t);
      const prog = cur.t / Math.max(1, dur);
      const section = getSectionAtProgress(song, prog);

      const picked = pickMusicalModeForAnchor(
        song,
        effectiveDiff,
        section,
        prevSection,
        i,
        cur.e,
        gap,
        equippedMods,
        blueprint.holdBias,
        blueprint.burstBias,
        blueprint.flipBias,
      );
      const dynamics = computeDynamicNoteDynamics(
        effectiveDiff,
        section,
        cur.e,
        i,
        picked.modeId,
      );

      notes.push({
        index: i,
        hitTime: cur.t,
        stepSec: Number(Math.max(0.22, Math.min(2.6, gap)).toFixed(3)),
        modeId: picked.modeId,
        section,
        energy: cur.e,
        sizeScale: dynamics.sizeScale,
        speedScale: dynamics.speedScale,
        holdDurationSec: picked.holdDurationSec ? Number(picked.holdDurationSec) : undefined,
        burstCount: picked.burstCount,
      });
      prevSection = section;
    }

    if (notes.length > 0) return notes;
  }

  // Fallback Grid
  const beatDur = 60 / Math.max(65, song.bpm);
  const notes: BeatmapNote[] = [];
  let t = 1.4;
  let idx = 0;
  while (t < song.durationSec - 1.4) {
    const prog = t / Math.max(1, song.durationSec);
    const section = getSectionAtProgress(song, prog);
    notes.push({
      index: idx,
      hitTime: Number(t.toFixed(3)),
      stepSec: Number(targetGap.toFixed(3)),
      modeId: idx % 5 === 3 ? 'CCW_RED' : 'CW_GREEN',
      section,
      energy: 0.65,
    });
    t += Math.max(minGap, beatDur);
    idx += 1;
  }
  return notes;
}

export function evaluateEarnedBadges(
  profile: PlayerProfile,
  cleared: boolean,
  songId: string,
  diffId: DifficultyId,
  rank: LetterRank,
  maxStreak: number,
  equippedModsCount: number,
  nextTotalOrbsEarned: number,
  nextMechanicStats: PlayerProfile['mechanicStats'],
  nextSongRecords: PlayerProfile['songRecords'],
): TrophyBadge[] {
  const earned = new Set(profile.unlockedBadges);
  const newlyUnlocked: TrophyBadge[] = [];

  const grant = (id: string) => {
    if (earned.has(id)) return;
    const badge = BADGE_CATALOG.find((b) => b.id === id);
    if (badge) {
      earned.add(id);
      newlyUnlocked.push(badge);
    }
  };

  if (cleared && songId === 'moments_passing') grant('badge_first_orbit');
  if ((nextMechanicStats.HOLD_ARC?.hits || 0) >= 15) grant('badge_hold_artisan');
  if (maxStreak >= 50) grant('badge_combo_50');
  if (cleared && (rank === 'S' || rank === 'SS')) grant('badge_s_rank');
  if (
    nextSongRecords.winter_solstice &&
    nextSongRecords.winter_solstice.bestRank !== 'F' &&
    nextSongRecords.carol_of_the_bells &&
    nextSongRecords.carol_of_the_bells.bestRank !== 'F'
  ) {
    grant('badge_christmas');
  }
  if (nextTotalOrbsEarned >= 100) grant('badge_orb_100');
  if (
    cleared &&
    songId === 'final_battle' &&
    (diffId === 'HARD' || diffId === 'INSANE' || diffId === 'DEMON')
  ) {
    grant('badge_final_boss');
  }
  if (cleared && diffId === 'DEMON') grant('badge_demon_slayer');
  const burstSlashHits =
    (nextMechanicStats.BEAT_BURST?.hits || 0) + (nextMechanicStats.METEOR_SLASH?.hits || 0);
  if (burstSlashHits >= 20) grant('badge_burst_master');
  if (cleared && equippedModsCount >= 2) grant('badge_mod_smith');
  if (profile.unlockedThemes.length - 3 + profile.purchasedMods.length >= 5) {
    grant('badge_vault_collector');
  }
  const officialIds = [
    'moments_passing',
    'play_aliens',
    'mecha',
    'little_birdy',
    'cosmic_colors',
    'little_two',
    'speechless',
    'hungarian_dance',
    'moon_raiders',
    'reach',
    'final_battle',
    'winter_solstice',
    'carol_of_the_bells',
    'firefly',
    'the_other_pot_pie',
  ];
  if (officialIds.every((id) => nextSongRecords[id] && nextSongRecords[id].bestRank !== 'F')) {
    grant('badge_all_13');
  }

  return newlyUnlocked;
}
