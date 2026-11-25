export type DifficultyId = 'CHILL' | 'NORMAL' | 'HARD' | 'INSANE' | 'DEMON';
export type ThemeId =
  | 'tokyo_pink'
  | 'shibuya_cyan'
  | 'emerald'
  | 'amber'
  | 'crimson'
  | 'shinjuku_violet'
  | 'snowflake_frost'
  | 'kyoto_jade';

export type HitSfxMode = 'switch' | 'harmonic' | 'rimshot';
export type BgFxMode = 'dynamic' | 'clean' | 'minimal';
export type ScreenView = 'TITLE' | 'SONG_SELECT' | 'PLAYING' | 'SETTINGS' | 'INDEX' | 'SHOP';

export type ModCode =
  | 'EZ'
  | 'NF'
  | 'SH'
  | 'HR'
  | 'DT'
  | 'HD'
  | 'SD'
  | 'FL'
  | 'OC'
  | 'OS'
  | 'MR'
  | 'RX';

export type ModCategory = 'reduction' | 'increase' | 'special';
export type SongCategory = 'tutorial' | 'arcade' | 'electronic' | 'christmas' | 'custom';

export type WaveModeId =
  | 'CW_GREEN'
  | 'CCW_RED'
  | 'HOLD_ARC'
  | 'DOUBLE_TAP'
  | 'BEAT_BURST'
  | 'METEOR_SLASH'
  | 'FEVER_SPINNER'
  | 'PURPLE_SURGE'
  | 'ONE_PASS'
  | 'SNIPER_MICRO'
  | 'MULTI_CLUSTER'
  | 'ORDERED_SEQ'
  | 'CASCADE_CHAIN'
  | 'DECAY_ARC'
  | 'HAZARD_DECOY'
  | 'GHOST_PULSE'
  | 'SPRING_BOUNCE'
  | 'BRAKE_DRIFT'
  | 'OSU_PORTAL';

export type SongSection = 'INTRO' | 'BUILD-UP' | 'DROP' | 'BREAKDOWN' | 'OUTRO';
export type JudgmentTier = 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS';
export type LetterRank = 'SS' | 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
export type GamePhase = 'IDLE' | 'PLAYING' | 'PAUSED' | 'SUMMARY' | 'TUTORIAL_CINEMATIC';
export type PauseTabId = 'main' | 'ctrl' | 'audio' | 'disp';

export interface ChassisTheme {
  id: ThemeId;
  label: string;
  jpLabel: string;
  orbCost: number;
  primary: string;
  bright: string;
  secondary: string;
  dim: string;
  edgeTick: string;
  trailSteps: [string, string, string, string];
  hubActiveFill: string;
  onPrimary: string;
  bgAccentRgb: string;
}

export interface DifficultyConfig {
  id: DifficultyId;
  name: string;
  mult: number;
  orbCost: number;
  minGapSec: number;
  targetGapSec: number;
  baseSpeed: number;
  arcScale: number;
  desc: string;
}

export interface SongSectionCue {
  startPct: number;
  label: SongSection;
}

export interface SynthFallbackPattern {
  style: 'arcade' | 'electro' | 'house' | 'rave';
  chords: number[][];
  lead: number[];
}

export interface SongDefinition {
  id: string;
  num: string;
  newgroundsId: string;
  artist: string;
  title: string;
  genre: string;
  category: SongCategory;
  bpm: number;
  keySig: string;
  scaleNotes: number[];
  durationSec: number;
  audioUrl: string;
  bgImageUrl: string;
  orbCost: number;
  chillOnly: boolean;
  isCustom?: boolean;
  customOnsets?: number[];
  synthFallback?: SynthFallbackPattern;
  stars: Partial<Record<DifficultyId, string>>;
  desc: string;
  sections: SongSectionCue[];
}

export interface LevelBackgroundSetting {
  dimPct: number;
  blurPx: number;
  customImageDataUrl?: string;
}

export interface WaveModeInfo {
  id: WaveModeId;
  name: string;
  tag: string;
  category: 'Core' | 'Rhythm & Hold' | 'Precision & Multi' | 'Hazard & Warp';
  color: string;
  desc: string;
  howToHit: string;
  timingTip: string;
  tierPresence: string;
}

export interface ModDefinition {
  id: ModCode;
  code: ModCode;
  name: string;
  category: ModCategory;
  mult: number;
  unlockHits: number;
  orbCost: number;
  desc: string;
}

export interface TrophyBadge {
  id: string;
  title: string;
  jpTitle: string;
  desc: string;
  tier: 'bronze' | 'silver' | 'gold' | 'prism';
  orbReward: number;
}

export interface BeatmapNote {
  index: number;
  hitTime: number;
  stepSec: number;
  modeId: WaveModeId;
  section: SongSection;
  energy: number;
  sizeScale?: number;
  speedScale?: number;
  holdDurationSec?: number;
  burstCount?: number;
}

export interface TargetSector {
  id: number;
  angle: number;
  baseAngle: number;
  halfWidth: number;
  initialHalfWidth: number;
  tapsLeft: number;
  lastTapAtMs?: number;
  seqNum: number;
  alpha: number;
  enteredWindow: boolean;
  // Audio-clock synchronization & recovery metadata
  spawnTime?: number;
  targetHitTime?: number;
  expireTime?: number;
  // Phase 2 Hold Arc & Special Mechanic Fields
  isHold?: boolean;
  holdSpanRad?: number;
  holdEndAngle?: number;
  holdDir?: 1 | -1;
  holdDurationSec?: number;
  holdElapsedSec?: number;
  isHolding?: boolean;
  holdTickAccum?: number;
  isFeverSpinner?: boolean;
  feverHits?: number;
  feverMaxHits?: number;
  feverRemainingSec?: number;
  isMeteorEcho?: boolean;
}

export interface HazardMine {
  angle: number;
  halfWidth: number;
}

export interface PortalPair {
  entryAngle: number;
  exitAngle: number;
  halfWidth: number;
  warped: boolean;
  warpFlashTimer: number;
}

export interface HitEffect {
  timer: number;
  duration: number;
  angle: number;
  isPerfect: boolean;
  label: string;
  color: string;
}

export interface HitErrorTick {
  offsetSigned: number;
  color: string;
  age: number;
}

export interface TutorialLesson {
  id: string;
  triggerMode: WaveModeId | 'ANY';
  minWaveIndex: number;
  title: string;
  instruction: string;
  highlightType: 'sector' | 'reverse' | 'bullseye' | 'hold';
}

export interface SongRecord {
  bestScore: number;
  bestRank: LetterRank;
  bestAccuracy: number;
  bestCombo: number;
}

export interface MechanicStat {
  hits: number;
  perfects: number;
  misses: number;
}

export interface PlayerProfile {
  trigger1Code: string;
  trigger1Label: string;
  trigger2Code: string;
  trigger2Label: string;
  allowPointerTap: boolean;
  musicEnabled: boolean;
  musicVolume: number;
  soundEnabled: boolean;
  sfxVolume: number;
  hitSfxMode: HitSfxMode;
  audioOffsetMs: number;
  bgFxMode: BgFxMode;
  theme: ThemeId;
  unlockedThemes: ThemeId[];
  selectedSongId: string;
  selectedDifficulty: DifficultyId;
  equippedMods: ModCode[];
  purchasedMods: ModCode[];
  unlockedDiffs: DifficultyId[];
  unlockedSongs: string[];
  unlockedBadges: string[];
  mechanicStats: Partial<Record<WaveModeId, MechanicStat>>;
  orbs: number;
  totalOrbsEarned: number;
  levelBgSettings: Record<string, LevelBackgroundSetting>;
  tutorialSongCompleted: boolean;
  devUnlocked: boolean;
  bestScore: number;
  tierBestScores: Record<DifficultyId, number>;
  songRecords: Record<string, SongRecord>;
  bestStreak: number;
  totalHits: number;
  totalMisses: number;
  totalPerfects: number;
  offsetDegSum: number;
  earlyMisses: number;
  lateMisses: number;
}

export interface MilestoneForecast {
  currentRank: LetterRank;
  nextRank: LetterRank | null;
  gapLabel: string;
  progressPct: number;
  potentialBonusOrbs: number;
}

export interface RunSummaryData {
  cleared: boolean;
  songId: string;
  songTitle: string;
  artist: string;
  difficulty: DifficultyId;
  score: number;
  previousBestScore: number;
  maxCombo: number;
  accuracy: number;
  rank: LetterRank;
  isSilverRank: boolean;
  perfectCount: number;
  greatCount: number;
  goodCount: number;
  missCount: number;
  avgOffsetDeg: number;
  offsetSamples: number[];
  unbankedOrbs: number;
  rankBonusOrbs: number;
  badgeBonusOrbs: number;
  cashedOutOrbs: number;
  cashOutApproved: boolean;
  newlyEarnedBadges: TrophyBadge[];
  missReason?: string;
  missDegrees?: string;
  isNewBest: boolean;
}
