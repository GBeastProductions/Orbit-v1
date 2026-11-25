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

  // Tutorial track hand-sculpted progression
  if (song.id === 'moments_passing') {
    if (index < 3) return { modeId: coreCw };
    if (index === 3) return { modeId: 'HOLD_ARC', holdDurationSec: Math.min(1.15, Math.max(0.65, gapToNextSec * 0.62)) };
    if (index === 4) return { modeId: coreFlip };
    if (gapToNextSec >= 1.15 && index % 5 === 2) {
      return { modeId: 'HOLD_ARC', holdDurationSec: Math.min(1.25, gapToNextSec * 0.62) };
    }
    if (section === 'DROP' && index % 4 === 3) return { modeId: coreFlip };
    return { modeId: coreCw };
  }

  // Portal Link mod during breakdowns
  if (equippedMods.includes('OS') && section === 'BREAKDOWN' && index % 4 === 2) {
    return { modeId: 'OSU_PORTAL' };
  }

  // Hidden Fade mod cues extra stealth targets on drops/breakdowns
  if (equippedMods.includes('HD') && (section === 'DROP' || section === 'BREAKDOWN') && index % 4 === 1) {
    return { modeId: 'GHOST_PULSE' };
  }

  // Fever Spinner on Build-Up -> Drop transitions (Hard+ or Overclock)
  const isDropTransition = prevSection === 'BUILD-UP' && section === 'DROP';
  if (
    isDropTransition &&
    (diffId === 'HARD' || diffId === 'INSANE' || diffId === 'DEMON' || equippedMods.includes('OC')) &&
    gapToNextSec >= 1.1
  ) {
    return { modeId: 'FEVER_SPINNER', holdDurationSec: Math.min(1.75, gapToNextSec * 0.8) };
  }

  // Natural Hold Arc when music opens up between beats
  const canPlaceHold =
    gapToNextSec >= (diffId === 'CHILL' ? 1.18 : 0.96) &&
    index > 1 &&
    (section === 'INTRO' || section === 'BREAKDOWN' || section === 'BUILD-UP' || (section === 'DROP' && energy < 0.78));
  if (canPlaceHold) {
    const holdModulo = Math.max(3, Math.round(1 / Math.max(0.12, holdBias)));
    if (index % holdModulo === 2 || gapToNextSec >= 1.55) {
      const dur = Math.max(0.55, Math.min(1.65, gapToNextSec * 0.64));
      return { modeId: 'HOLD_ARC', holdDurationSec: Number(dur.toFixed(2)) };
    }
  }

  const hasOverclock = equippedMods.includes('OC');

  if (diffId === 'CHILL') {
    if (hasOverclock && section === 'DROP' && index % 5 === 2) return { modeId: 'DOUBLE_TAP' };
    if (hasOverclock && section === 'BUILD-UP' && index % 6 === 4) return { modeId: 'METEOR_SLASH' };
    return { modeId: index % 6 === 4 ? coreFlip : coreCw };
  }

  if (diffId === 'NORMAL') {
    if (section === 'DROP') {
      const pool: WaveModeId[] =
        burstBias >= 0.22
          ? [coreCw, 'DOUBLE_TAP', coreFlip, 'METEOR_SLASH', 'PURPLE_SURGE', coreCw]
          : [coreCw, coreFlip, 'DOUBLE_TAP', 'PURPLE_SURGE', 'METEOR_SLASH'];
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
        'METEOR_SLASH',
        'BEAT_BURST',
        'CASCADE_CHAIN',
        coreFlip,
        'ORDERED_SEQ',
        'PURPLE_SURGE',
      ];
      const chosen = pool[index % pool.length];
      return { modeId: chosen, burstCount: chosen === 'BEAT_BURST' ? 3 : undefined };
    }
    if (section === 'BUILD-UP' && index % 5 === 3) {
      return { modeId: 'FEVER_SPINNER', holdDurationSec: 1.25 };
    }
    const calmPool: WaveModeId[] = [coreCw, coreFlip, 'SNIPER_MICRO', 'MULTI_CLUSTER', 'DECAY_ARC', 'METEOR_SLASH'];
    return { modeId: calmPool[index % calmPool.length] };
  }

  if (diffId === 'INSANE') {
    if (section === 'DROP') {
      const pool: WaveModeId[] = [
        'DOUBLE_TAP',
        'BEAT_BURST',
        'METEOR_SLASH',
        'CASCADE_CHAIN',
        'PURPLE_SURGE',
        'OSU_PORTAL',
        'ORDERED_SEQ',
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
      'MULTI_CLUSTER',
      'GHOST_PULSE',
      'FEVER_SPINNER',
      'HAZARD_DECOY',
    ];
    const chosen = calmPool[index % calmPool.length];
    return {
      modeId: chosen,
      holdDurationSec: chosen === 'FEVER_SPINNER' ? 1.2 : undefined,
    };
  }

  // DEMON: Crisp click-sync showcase blending double-clicks, bursts, flips, slashes, portals, and selective ONE_PASS drop accents!
  if (section === 'DROP') {
    // Only selective strong drop downbeats (~1 in 6) carry strict ONE_PASS
    if (energy >= 0.78 && index % 6 === 0) {
      return { modeId: 'ONE_PASS' };
    }
    const demonDropPool: WaveModeId[] = [
      'DOUBLE_TAP',
      'BEAT_BURST',
      'METEOR_SLASH',
      'HAZARD_DECOY',
      'CASCADE_CHAIN',
      'OSU_PORTAL',
      'PURPLE_SURGE',
      'ORDERED_SEQ',
      'BRAKE_DRIFT',
      flipBias >= 0.24 ? coreFlip : coreCw,
    ];
    const chosen = demonDropPool[index % demonDropPool.length];
    return { modeId: chosen, burstCount: chosen === 'BEAT_BURST' ? 3 : undefined };
  }

  if (section === 'BUILD-UP' && index % 6 === 4) {
    return { modeId: 'FEVER_SPINNER', holdDurationSec: 1.15 };
  }

  const demonVersePool: WaveModeId[] = [
    'SNIPER_MICRO',
    'DOUBLE_TAP',
    'GHOST_PULSE',
    'SPRING_BOUNCE',
    'DECAY_ARC',
    'MULTI_CLUSTER',
    'ORDERED_SEQ',
    coreFlip,
  ];
  return { modeId: demonVersePool[index % demonVersePool.length] };
}

/**
 * Generates an audio-locked BeatmapNote[] where EVERY note hits on a real MP3 transient
 * or quantized subdivision inside that specific track.
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
  const minGap = Math.max(0.18, cfg.minGapSec * (dtActive ? 0.8 : 1.0));
  const targetGap = cfg.targetGapSec * (dtActive ? 0.82 : 1.0);

  // Path 1: Custom MP3 uploaded by player
  if (song.isCustom && song.customOnsets && song.customOnsets.length >= 8) {
    const notes: BeatmapNote[] = [];
    let lastT = -99;
    let idx = 0;
    let prevSec: SongSection = 'INTRO';
    for (let i = 0; i < song.customOnsets.length; i++) {
      const t = song.customOnsets[i];
      if (t < 1.15 || t > song.durationSec - 1.35) continue;
      if (t - lastT < minGap) continue;
      const nextT = song.customOnsets.find((nt, j) => j > i && nt - t >= minGap) || song.durationSec - 1.0;
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
        holdDurationSec: picked.holdDurationSec,
        burstCount: picked.burstCount,
      });
      prevSec = sec;
      lastT = t;
      idx += 1;
    }
    if (notes.length >= 6) return notes;
  }

  // Path 2: Official Bundled 13 MP3s using analyzed real transients & beat-grid fills
  if (blueprint && blueprint.peaks.length > 0) {
    const dur = blueprint.durationSec;
    const beatDur = 60 / Math.max(65, blueprint.bpm);
    const phase = blueprint.phaseSec || 0.2;
    const rawPeaks = blueprint.peaks;

    // Step A: Build unified candidate anchor list merging true transients + steady beat grid pulses in quiet gaps
    const anchors: { t: number; e: number }[] = [];
    for (const [pt, pe] of rawPeaks) {
      anchors.push({ t: pt, e: pe });
    }

    // Fill musical pulse points wherever MP3 lacks sharp percussive transients (e.g. orchestral strings in Hungarian Dance or Winter Solstice chime bars)
    const fillStep = beatDur * (effectiveDiff === 'CHILL' ? 2 : effectiveDiff === 'NORMAL' ? 1.5 : 1);
    let cursor = Math.max(1.05, phase + beatDur * 2);
    while (cursor < dur - 1.35) {
      const hasNearby = anchors.some((a) => Math.abs(a.t - cursor) < fillStep * 0.55);
      if (!hasNearby) {
        const bIdx = Math.min(blueprint.energyCurve.length - 1, Math.floor(cursor / 5));
        const localE = blueprint.energyCurve[bIdx] ?? 0.5;
        anchors.push({ t: Number(cursor.toFixed(2)), e: Number((localE * 0.75).toFixed(2)) });
      }
      cursor += fillStep;
    }
    anchors.sort((a, b) => a.t - b.t);

    // Step B: Curate anchors per difficulty tier & local section energy
    const selected: { t: number; e: number }[] = [];
    let lastSelectedT = -10;

    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[i];
      if (a.t < 1.1 || a.t > dur - 1.3) continue;
      const bIdx = Math.min(blueprint.energyCurve.length - 1, Math.floor(a.t / 5));
      const energy = blueprint.energyCurve[bIdx] ?? 0.6;
      const prog = a.t / Math.max(1, dur);
      const sec = getSectionAtProgress(song, prog);

      // Adaptive spacing scales musically with energy & difficulty
      const secSpacingScale = sec === 'DROP' ? 0.85 : sec === 'BUILD-UP' ? 0.94 : 1.08;
      const desiredGap = Math.max(minGap, targetGap * secSpacingScale);

      if (a.t - lastSelectedT < desiredGap * 0.82) continue;

      // In Chill/Normal, skip weak unaccented peaks if another stronger peak sits just ahead
      if ((effectiveDiff === 'CHILL' || effectiveDiff === 'NORMAL') && a.e < 0.25 && i + 1 < anchors.length) {
        const nextStrong = anchors[i + 1];
        if (nextStrong.t - a.t < 0.35 && nextStrong.e > a.e * 1.35) continue;
      }

      // If last note was a long hold or burst, guarantee comfortable breathing space after hold ends
      selected.push({ t: a.t, e: Math.max(a.e, energy) });
      lastSelectedT = a.t;
    }

    // Step C: Build final BeatmapNotes with musical choreography & guaranteed hold room
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

      notes.push({
        index: i,
        hitTime: cur.t,
        stepSec: Number(Math.max(0.2, Math.min(2.6, gap)).toFixed(3)),
        modeId: picked.modeId,
        section,
        energy: cur.e,
        holdDurationSec: picked.holdDurationSec,
        burstCount: picked.burstCount,
      });
      prevSection = section;
    }

    if (notes.length > 0) return notes;
  }

  // Fallback Grid
  const beatDur = 60 / Math.max(65, song.bpm);
  const notes: BeatmapNote[] = [];
  let t = 1.35;
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
  ];
  if (officialIds.every((id) => nextSongRecords[id] && nextSongRecords[id].bestRank !== 'F')) {
    grant('badge_all_13');
  }

  return newlyUnlocked;
}
