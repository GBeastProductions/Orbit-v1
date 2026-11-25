import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audioEngine } from './audio/audioEngine';
import { BackgroundBackdrop } from './components/BackgroundBackdrop';
import { IndexScreen } from './components/IndexScreen';
import { ZoomWarpTransition } from './components/LazerChrome';
import { ModDrawer } from './components/ModDrawer';
import { OrbShopScreen } from './components/OrbShopScreen';
import { CanvasRenderState, OrbitStage } from './components/OrbitStage';
import { PauseDrawer } from './components/PauseDrawer';
import { RunSummaryModal } from './components/RunSummaryModal';
import { SettingsScreen } from './components/SettingsScreen';
import { SongSelectScreen } from './components/SongSelectScreen';
import { TitleScreen } from './components/TitleScreen';
import { TopBar } from './components/TopBar';
import {
  CHASSIS_THEMES,
  DEV_PASSCODE,
  DIFFICULTIES,
  HERO_DISCO_IMAGE,
  MOD_CATALOG,
  NEEDLE_TOLERANCE,
  SONG_CATALOG,
  TUTORIAL_LESSONS,
  WAVE_MODES,
} from './data/catalog';
import {
  buildSongBeatmap,
  computeHitPoints,
  computeLetterRank,
  computeRankOrbBonus,
  computeTotalMultiplier,
  evaluateEarnedBadges,
  formatTimeSec,
  getSectionAtProgress,
  getStreakMultiplier,
  isCashOutEligible,
  signedAngleDiff,
  wrapAngle,
} from './engine/beatmap';
import { orbitEvents } from './engine/gameEvents';
import { INITIAL_PROFILE, loadProfile, saveProfile } from './store/profileStore';
import {
  BeatmapNote,
  BgFxMode,
  DifficultyId,
  GamePhase,
  HitErrorTick,
  HitSfxMode,
  JudgmentTier,
  MechanicStat,
  ModCode,
  PauseTabId,
  PlayerProfile,
  RunSummaryData,
  ScreenView,
  SongDefinition,
  SongSection,
  TargetSector,
  ThemeId,
  TutorialLesson,
  WaveModeId,
} from './types/game';

interface RuntimeEngine {
  phase: GamePhase;
  score: number;
  hp: number;
  streak: number;
  maxStreakInRun: number;
  unbankedOrbs: number;
  shields: number;
  spinnerAngle: number;
  direction: 1 | -1;
  baseAngularSpeed: number;
  angularSpeed: number;
  waveModeId: WaveModeId;
  waveIndex: number;
  waitingForCue: boolean;
  targets: TargetSector[];
  hazards: { angle: number; halfWidth: number }[];
  portal: {
    entryAngle: number;
    exitAngle: number;
    halfWidth: number;
    warped: boolean;
    warpFlashTimer: number;
  } | null;
  waveElapsed: number;
  songTime: number;
  songSection: SongSection;
  beatmap: BeatmapNote[];
  beatmapIndex: number;
  hitEffects: {
    timer: number;
    duration: number;
    angle: number;
    isPerfect: boolean;
    label: string;
    color: string;
  }[];
  hitErrorTicks: HitErrorTick[];
  hubStatusText: string;
  hubStatusColor: string | null;
  hubStatusTimer: number;
  shakeTime: number;
  shakeAmplitude: number;
  shakeX: number;
  missReason: string;
  missDegrees: string;
  missNearestEdge: number;
  missSignedSpan: number;
  perfectCount: number;
  greatCount: number;
  goodCount: number;
  missCount: number;
  runOffsetDegSum: number;
  runHitCount: number;
  runOffsetSamples: number[];
  isTutorialRun: boolean;
  tutorialLives: number;
  shownLessonIds: Set<string>;
  activeLesson: TutorialLesson | null;
  activeLessonTimer: number;
  lessonSlowActive: boolean;
  tutorialGuideDisabled: boolean;
  dialTimeScale: number;
  cinematicTimer: number;
  dialVisualAlpha: number;
  dialSpinBoost: number;
  sandboxModeId: WaveModeId | null;
  beatPulse: number;
  activeBeatLed: number;
  pendingHits: number;
  pendingPerfects: number;
  pendingOffsetDegSum: number;
  pendingMisses: number;
  pendingEarlyMisses: number;
  pendingLateMisses: number;
  pendingMechanicDeltas: Partial<Record<WaveModeId, MechanicStat>>;
}

function formatKeyLabel(e: KeyboardEvent): string {
  if (e.code === 'Space') return 'SPACE';
  if (e.code.startsWith('Key')) return `KEY ${e.code.slice(3).toUpperCase()}`;
  if (e.code.startsWith('Digit')) return e.code.slice(5);
  if (e.code.startsWith('Arrow')) return e.code.slice(5).toUpperCase();
  return e.code.toUpperCase();
}

export default function App() {
  const [profile, setProfile] = useState<PlayerProfile>(() => loadProfile());
  const [songs, setSongs] = useState<SongDefinition[]>(() => [...SONG_CATALOG]);
  const [screen, setScreen] = useState<ScreenView>('TITLE');
  const [previousScreen, setPreviousScreen] = useState<ScreenView>('TITLE');
  const [customAudioStatus, setCustomAudioStatus] = useState('');
  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseTab, setPauseTab] = useState<PauseTabId>('main');
  const [modsOpen, setModsOpen] = useState(false);
  const [listeningSlot, setListeningSlot] = useState<0 | 1 | 2>(0);
  const [summaryData, setSummaryData] = useState<RunSummaryData | null>(null);
  const [showTutorialCompleteStripe, setShowTutorialCompleteStripe] = useState(false);
  const [warpLaunchLabel, setWarpLaunchLabel] = useState<string | null>(null);
  const warpTimersRef = useRef<number[]>([]);

  const [uiScore, setUiScore] = useState(0);
  const [uiHp, setUiHp] = useState(100);
  const [uiStreak, setUiStreak] = useState(0);
  const [uiUnbankedOrbs, setUiUnbankedOrbs] = useState(0);
  const [uiShields, setUiShields] = useState(0);
  const [uiSongTime, setUiSongTime] = useState(0);
  const [uiSection, setUiSection] = useState<SongSection>('INTRO');
  const [uiWaveMode, setUiWaveMode] = useState<WaveModeId>('CW_GREEN');
  const [uiPhase, setUiPhase] = useState<GamePhase>('IDLE');
  const [uiBeatLed, setUiBeatLed] = useState(0);
  const [uiActiveLesson, setUiActiveLesson] = useState<TutorialLesson | null>(null);
  const [uiTutorialLives, setUiTutorialLives] = useState(3);
  const [uiIsTutorialRun, setUiIsTutorialRun] = useState(false);
  const [uiSandboxMode, setUiSandboxMode] = useState<WaveModeId | null>(null);
  const [uiAccuracy, setUiAccuracy] = useState(100);

  const profileRef = useRef(profile);
  profileRef.current = profile;
  const songsRef = useRef(songs);
  songsRef.current = songs;
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const pauseOpenRef = useRef(pauseOpen);
  pauseOpenRef.current = pauseOpen;
  const modsOpenRef = useRef(modsOpen);
  modsOpenRef.current = modsOpen;
  const phaseBeforeOverlayRef = useRef<GamePhase>('IDLE');
  const lastInputTimestampRef = useRef(0);
  const lastTutorialStripeRef = useRef(false);

  const engineRef = useRef<RuntimeEngine>({
    phase: 'IDLE',
    score: 0,
    hp: 100,
    streak: 0,
    maxStreakInRun: 0,
    unbankedOrbs: 0,
    shields: 0,
    spinnerAngle: -Math.PI / 2,
    direction: 1,
    baseAngularSpeed: 1.55,
    angularSpeed: 1.55,
    waveModeId: 'CW_GREEN',
    waveIndex: 0,
    waitingForCue: false,
    targets: [],
    hazards: [],
    portal: null,
    waveElapsed: 0,
    songTime: 0,
    songSection: 'INTRO',
    beatmap: [],
    beatmapIndex: 0,
    hitEffects: [],
    hitErrorTicks: [],
    hubStatusText: 'READY',
    hubStatusColor: null,
    hubStatusTimer: 0,
    shakeTime: 0,
    shakeAmplitude: 0,
    shakeX: 0,
    missReason: '',
    missDegrees: '0.0',
    missNearestEdge: 0,
    missSignedSpan: 0,
    perfectCount: 0,
    greatCount: 0,
    goodCount: 0,
    missCount: 0,
    runOffsetDegSum: 0,
    runHitCount: 0,
    runOffsetSamples: [],
    isTutorialRun: false,
    tutorialLives: 3,
    shownLessonIds: new Set<string>(),
    activeLesson: null,
    activeLessonTimer: 0,
    lessonSlowActive: false,
    tutorialGuideDisabled: false,
    dialTimeScale: 1.0,
    cinematicTimer: 0,
    dialVisualAlpha: 1,
    dialSpinBoost: 0,
    sandboxModeId: null,
    beatPulse: 0,
    activeBeatLed: -1,
    pendingHits: 0,
    pendingPerfects: 0,
    pendingOffsetDegSum: 0,
    pendingMisses: 0,
    pendingEarlyMisses: 0,
    pendingLateMisses: 0,
    pendingMechanicDeltas: {},
  });

  const canvasStateRef = useRef<CanvasRenderState>({
    phase: 'IDLE',
    spinnerAngle: -Math.PI / 2,
    direction: 1,
    angularSpeed: 1.55,
    waveModeId: 'CW_GREEN',
    targets: [],
    hazards: [],
    portal: null,
    hitEffects: [],
    hitErrorTicks: [],
    hubStatusText: 'READY',
    hubStatusColor: null,
    hubStatusTimer: 0,
    shakeX: 0,
    missDegrees: '0.0',
    missNearestEdge: 0,
    missSignedSpan: 0,
    dialVisualAlpha: 1,
    bassEnergy: 0,
    spectrumBins: new Float32Array(36),
    beatPulse: 0,
    streak: 0,
    songProgressRatio: 0,
    songSections: [],
    songSection: 'INTRO',
    songTime: 0,
    lessonSlowActive: false,
    activeLesson: null,
    flashlightActive: false,
  });

  useEffect(() => {
    const t = CHASSIS_THEMES[profile.theme] || CHASSIS_THEMES.tokyo_pink;
    document.documentElement.style.setProperty('--theme-primary', t.primary);
    document.documentElement.style.setProperty('--theme-bright', t.bright);
    document.documentElement.style.setProperty('--theme-dim', t.dim);
    document.documentElement.style.setProperty('--theme-on-primary', t.onPrimary);
    document.documentElement.style.setProperty('--accent', t.primary);
    document.documentElement.style.setProperty('--accent-bright', t.bright);
    document.documentElement.style.setProperty('--accent-dim', t.dim);
    document.documentElement.style.setProperty('--accent-on', t.onPrimary);
    document.documentElement.style.setProperty('--bg-accent-rgb', t.bgAccentRgb);
  }, [profile.theme]);

  const updateProfile = useCallback(
    (updater: Partial<PlayerProfile> | ((p: PlayerProfile) => PlayerProfile)) => {
      setProfile((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
        saveProfile(next);
        return next;
      });
    },
    [],
  );

  const recordMechanicStat = (
    eng: RuntimeEngine,
    modeId: WaveModeId,
    kind: 'hit' | 'perfect' | 'miss',
  ) => {
    const cur = eng.pendingMechanicDeltas[modeId] || { hits: 0, perfects: 0, misses: 0 };
    if (kind === 'hit') cur.hits += 1;
    else if (kind === 'perfect') {
      cur.hits += 1;
      cur.perfects += 1;
    } else {
      cur.misses += 1;
    }
    eng.pendingMechanicDeltas[modeId] = cur;
  };

  const mergeMechanicStatsIntoProfile = (
    base: PlayerProfile['mechanicStats'],
    deltas: Partial<Record<WaveModeId, MechanicStat>>,
  ) => {
    const merged: PlayerProfile['mechanicStats'] = { ...base };
    for (const key of Object.keys(deltas) as WaveModeId[]) {
      const d = deltas[key];
      if (!d) continue;
      const prev = merged[key] || { hits: 0, perfects: 0, misses: 0 };
      merged[key] = {
        hits: prev.hits + d.hits,
        perfects: prev.perfects + d.perfects,
        misses: prev.misses + d.misses,
      };
    }
    return merged;
  };

  const flushRunProfileDeltas = useCallback(() => {
    const eng = engineRef.current;
    const hasMechDeltas = Object.keys(eng.pendingMechanicDeltas).length > 0;
    if (
      eng.pendingHits === 0 &&
      eng.pendingPerfects === 0 &&
      eng.pendingMisses === 0 &&
      eng.pendingOffsetDegSum === 0 &&
      !hasMechDeltas
    ) {
      return;
    }
    const hits = eng.pendingHits;
    const perfects = eng.pendingPerfects;
    const offsetSum = eng.pendingOffsetDegSum;
    const misses = eng.pendingMisses;
    const early = eng.pendingEarlyMisses;
    const late = eng.pendingLateMisses;
    const mechDeltas = eng.pendingMechanicDeltas;
    eng.pendingHits = 0;
    eng.pendingPerfects = 0;
    eng.pendingOffsetDegSum = 0;
    eng.pendingMisses = 0;
    eng.pendingEarlyMisses = 0;
    eng.pendingLateMisses = 0;
    eng.pendingMechanicDeltas = {};

    updateProfile((prev) => ({
      ...prev,
      totalHits: prev.totalHits + hits,
      totalPerfects: prev.totalPerfects + perfects,
      offsetDegSum: prev.offsetDegSum + offsetSum,
      totalMisses: prev.totalMisses + misses,
      earlyMisses: prev.earlyMisses + early,
      lateMisses: prev.lateMisses + late,
      mechanicStats: mergeMechanicStatsIntoProfile(prev.mechanicStats, mechDeltas),
    }));
  }, [updateProfile]);

  const getActiveSong = useCallback(
    (p: PlayerProfile = profileRef.current, list: SongDefinition[] = songsRef.current) => {
      return list.find((s) => s.id === p.selectedSongId) || list[0];
    },
    [],
  );

  const getEffectiveDifficulty = useCallback(
    (p: PlayerProfile = profileRef.current, song?: SongDefinition): DifficultyId => {
      const s = song || getActiveSong(p);
      if (s.chillOnly) return 'CHILL';
      return p.selectedDifficulty;
    },
    [getActiveSong],
  );

  const getBaseHalfWidth = useCallback((diffId: DifficultyId, mods: ModCode[]) => {
    const diff = DIFFICULTIES[diffId] || DIFFICULTIES.CHILL;
    let hw = 0.44 * diff.arcScale;
    if (mods.includes('HR')) hw *= 0.78;
    if (mods.includes('EZ')) hw *= 1.28;
    return Math.max(0.11, Math.min(0.68, hw));
  }, []);

  const computeNominalSpeed = useCallback(
    (diffId: DifficultyId, mods: ModCode[], bpm: number, modeId: WaveModeId) => {
      const beatDur = 60 / Math.max(65, bpm);
      const beatsPerRev =
        diffId === 'CHILL'
          ? 4.2
          : diffId === 'NORMAL'
          ? 3.5
          : diffId === 'HARD'
          ? 3.0
          : diffId === 'INSANE'
          ? 2.6
          : 2.35;
      let speed = (Math.PI * 2) / (beatsPerRev * beatDur);
      if (mods.includes('DT')) speed *= 1.12;
      if (mods.includes('EZ')) speed *= 0.90;
      if (modeId === 'PURPLE_SURGE') speed *= 1.24;
      return Math.max(1.25, Math.min(4.8, speed));
    },
    [],
  );

  const computeCurrentAccuracy = (eng: RuntimeEngine): number => {
    const total = eng.perfectCount + eng.greatCount + eng.goodCount + eng.missCount;
    if (total === 0) return 100;
    const weighted = eng.perfectCount + eng.greatCount * 0.66 + eng.goodCount * 0.33;
    return (weighted / total) * 100;
  };

  const finalizeRunSummary = useCallback(
    (cleared: boolean) => {
      const eng = engineRef.current;
      const p = profileRef.current;
      const song = getActiveSong(p);
      const diffId = getEffectiveDifficulty(p, song);

      audioEngine.stop();
      eng.phase = 'SUMMARY';
      setUiPhase('SUMMARY');

      const accuracy = computeCurrentAccuracy(eng);
      const rank = computeLetterRank(accuracy, eng.missCount, cleared);
      const isSilverRank = p.equippedMods.includes('HD') && (rank === 'SS' || rank === 'S');
      const avgOffsetDeg = eng.runHitCount > 0 ? eng.runOffsetDegSum / eng.runHitCount : 0;

      const cashOutApproved = !eng.sandboxModeId && isCashOutEligible(rank);
      const rankBonusOrbs = cashOutApproved ? computeRankOrbBonus(rank, diffId) : 0;

      const prevRec = p.songRecords[song.id];
      const isNewBest = !prevRec || eng.score > prevRec.bestScore;
      const rankOrder = ['SS', 'S', 'A', 'B', 'C', 'D', 'F'];
      const prevIdx = prevRec ? rankOrder.indexOf(prevRec.bestRank) : 99;
      const curIdx = rankOrder.indexOf(rank);
      const bestRank = prevRec && prevIdx >= 0 && prevIdx < curIdx ? prevRec.bestRank : rank;

      const nextRecords = eng.sandboxModeId
        ? p.songRecords
        : {
            ...p.songRecords,
            [song.id]: {
              bestScore: Math.max(prevRec?.bestScore || 0, eng.score),
              bestRank,
              bestAccuracy: Math.max(prevRec?.bestAccuracy || 0, accuracy),
              bestCombo: Math.max(prevRec?.bestCombo || 0, eng.maxStreakInRun),
            },
          };

      const nextTierBests = { ...p.tierBestScores };
      if (!eng.sandboxModeId && eng.score > (nextTierBests[diffId] || 0)) {
        nextTierBests[diffId] = eng.score;
      }

      const hitsDelta = eng.pendingHits;
      const perfectsDelta = eng.pendingPerfects;
      const offsetDelta = eng.pendingOffsetDegSum;
      const missesDelta = eng.pendingMisses;
      const earlyDelta = eng.pendingEarlyMisses;
      const lateDelta = eng.pendingLateMisses;
      const mechDeltas = eng.pendingMechanicDeltas;
      eng.pendingHits = 0;
      eng.pendingPerfects = 0;
      eng.pendingOffsetDegSum = 0;
      eng.pendingMisses = 0;
      eng.pendingEarlyMisses = 0;
      eng.pendingLateMisses = 0;
      eng.pendingMechanicDeltas = {};

      const nextMechStats = mergeMechanicStatsIntoProfile(p.mechanicStats, mechDeltas);
      const baseRunOrbs = cashOutApproved ? eng.unbankedOrbs + rankBonusOrbs : 0;
      const provisionalTotalOrbs = p.totalOrbsEarned + baseRunOrbs;

      const newlyEarnedBadges = eng.sandboxModeId
        ? []
        : evaluateEarnedBadges(
            p,
            cleared,
            song.id,
            diffId,
            rank,
            eng.maxStreakInRun,
            p.equippedMods.length,
            provisionalTotalOrbs,
            nextMechStats,
            nextRecords,
          );

      const badgeBonusOrbs = newlyEarnedBadges.reduce((acc, b) => acc + b.orbReward, 0);
      const cashedOutOrbs = baseRunOrbs + badgeBonusOrbs;
      const nextOrbs = p.orbs + cashedOutOrbs;
      const nextTotalOrbs = p.totalOrbsEarned + cashedOutOrbs;

      const nextTutorialDone =
        p.tutorialSongCompleted ||
        (cleared && song.id === 'moments_passing' && !eng.sandboxModeId);

      if (cleared) {
        audioEngine.playLevelClear(p.soundEnabled);
      }

      updateProfile((prev) => ({
        ...prev,
        tutorialSongCompleted: nextTutorialDone,
        orbs: nextOrbs,
        totalOrbsEarned: nextTotalOrbs,
        songRecords: nextRecords,
        tierBestScores: nextTierBests,
        unlockedBadges: Array.from(
          new Set([...prev.unlockedBadges, ...newlyEarnedBadges.map((b) => b.id)]),
        ),
        mechanicStats: nextMechStats,
        bestScore: Math.max(prev.bestScore, eng.sandboxModeId ? 0 : eng.score),
        bestStreak: Math.max(prev.bestStreak, eng.maxStreakInRun),
        totalHits: prev.totalHits + hitsDelta,
        totalPerfects: prev.totalPerfects + perfectsDelta,
        offsetDegSum: prev.offsetDegSum + offsetDelta,
        totalMisses: prev.totalMisses + missesDelta,
        earlyMisses: prev.earlyMisses + earlyDelta,
        lateMisses: prev.lateMisses + lateDelta,
      }));

      const summary: RunSummaryData = {
        cleared,
        songId: song.id,
        songTitle: song.title,
        artist: song.artist,
        difficulty: diffId,
        score: eng.score,
        previousBestScore: prevRec?.bestScore || 0,
        maxCombo: eng.maxStreakInRun,
        accuracy,
        rank,
        isSilverRank,
        perfectCount: eng.perfectCount,
        greatCount: eng.greatCount,
        goodCount: eng.goodCount,
        missCount: eng.missCount,
        avgOffsetDeg,
        offsetSamples: [...eng.runOffsetSamples],
        unbankedOrbs: eng.unbankedOrbs,
        rankBonusOrbs,
        badgeBonusOrbs,
        cashedOutOrbs,
        cashOutApproved,
        newlyEarnedBadges,
        missReason: cleared ? undefined : eng.missReason,
        missDegrees: cleared ? undefined : eng.missDegrees,
        isNewBest,
      };

      orbitEvents.emit('onRunComplete', summary);

      if (cleared && song.id === 'moments_passing' && !p.tutorialSongCompleted && !eng.sandboxModeId) {
        eng.phase = 'TUTORIAL_CINEMATIC';
        eng.cinematicTimer = 0;
        eng.activeLesson = null;
        eng.lessonSlowActive = false;
        setUiActiveLesson(null);
        setUiPhase('TUTORIAL_CINEMATIC');
        setSummaryData(summary);
        return;
      }

      setSummaryData(summary);
    },
    [getActiveSong, getEffectiveDifficulty, updateProfile],
  );

  const spawnNextWave = useCallback(
    (isFirstNote = false, overrideMode: WaveModeId | null = null) => {
      const eng = engineRef.current;
      const p = profileRef.current;
      const song = getActiveSong(p);
      const diffId = getEffectiveDifficulty(p, song);
      const mirrorMod = p.equippedMods.includes('MR');

      let note: BeatmapNote | null = null;
      if (eng.phase === 'PLAYING' && !eng.sandboxModeId) {
        // Skip past notes whose beat timestamp already elapsed noticeably while waiting
        while (
          eng.beatmapIndex < eng.beatmap.length &&
          eng.beatmap[eng.beatmapIndex].hitTime < eng.songTime - 0.12
        ) {
          eng.beatmapIndex += 1;
        }
        if (eng.beatmapIndex >= eng.beatmap.length) {
          finalizeRunSummary(true);
          return;
        }

        const candidate = eng.beatmap[eng.beatmapIndex];
        const dtToHit = candidate.hitTime - eng.songTime;

        // Long quiet break/gap in music: cruise smoothly until ~1.35s before the next musical transient
        if (dtToHit > 1.85) {
          eng.waitingForCue = true;
          eng.targets = [];
          eng.hazards = [];
          eng.portal = null;
          eng.baseAngularSpeed = computeNominalSpeed(diffId, p.equippedMods, song.bpm, candidate.modeId);
          eng.angularSpeed = eng.baseAngularSpeed;
          return;
        }

        eng.waitingForCue = false;
        note = candidate;
        eng.beatmapIndex += 1;
        eng.songSection = note.section;
        setUiSection(note.section);
      } else {
        eng.waitingForCue = false;
      }

      const modeId: WaveModeId = overrideMode || (note ? note.modeId : 'CW_GREEN');
      eng.waveModeId = modeId;
      eng.waveElapsed = 0;
      eng.hazards = [];
      eng.portal = null;
      setUiWaveMode(modeId);

      if (modeId === 'CCW_RED') eng.direction = -1;
      else if (modeId === 'CW_GREEN') eng.direction = 1;
      else if (mirrorMod && isFirstNote) eng.direction = -1;

      const nominalSpeed = computeNominalSpeed(diffId, p.equippedMods, song.bpm, modeId);

      // Compute Audio-Locked Omega & Target Angle so needle crosses target center AT exact note.hitTime!
      const rawDt = note && !eng.sandboxModeId ? note.hitTime - eng.songTime : 0;
      const syncDt = rawDt > 0.16 ? rawDt : Math.max(0.28, note ? note.stepSec * 0.85 : 0.82);

      let travelAngle: number;
      if (modeId === 'CASCADE_CHAIN') {
        travelAngle = Math.max(0.58, Math.min(2.2, nominalSpeed * syncDt));
      } else if (note && !eng.sandboxModeId) {
        travelAngle = Math.max(0.52, Math.min(4.9, nominalSpeed * syncDt));
      } else {
        const minOff = isFirstNote ? 1.65 : 1.35;
        travelAngle = minOff + Math.random() * (4.4 - minOff);
      }

      eng.baseAngularSpeed = note && !eng.sandboxModeId ? travelAngle / syncDt : nominalSpeed;
      eng.angularSpeed = eng.baseAngularSpeed;

      const tutWidthBonus = eng.isTutorialRun ? 1.28 : 1.0;
      const baseHW = Math.min(0.72, getBaseHalfWidth(diffId, p.equippedMods) * tutWidthBonus);
      const primaryAngle = wrapAngle(eng.spinnerAngle + eng.direction * travelAngle);

      const noteHitT = note && !eng.sandboxModeId ? note.hitTime : undefined;
      const standardGrace = eng.isTutorialRun ? 0.36 : diffId === 'CHILL' ? 0.32 : diffId === 'NORMAL' ? 0.28 : 0.24;
      const multiGrace = Math.max(0.82, note ? Math.min(1.55, note.stepSec * 0.92) : 1.1);

      if (modeId === 'FEVER_SPINNER') {
        const maxHits = p.equippedMods.includes('RX') ? 5 : diffId === 'DEMON' ? 9 : 7;
        eng.targets = [
          {
            id: 1,
            angle: primaryAngle,
            baseAngle: primaryAngle,
            halfWidth: baseHW,
            initialHalfWidth: baseHW,
            tapsLeft: maxHits,
            seqNum: 0,
            alpha: 1,
            enteredWindow: false,
            spawnTime: eng.songTime,
            targetHitTime: noteHitT,
            isFeverSpinner: true,
            feverHits: 0,
            feverMaxHits: maxHits,
            feverRemainingSec: note?.holdDurationSec || 1.3,
          },
        ];
      } else if (modeId === 'HOLD_ARC') {
        const holdDur = note?.holdDurationSec || 0.85;
        const holdSpanRad = Math.max(0.56, Math.min(2.75, eng.baseAngularSpeed * holdDur));
        const endAngle = wrapAngle(primaryAngle + eng.direction * holdSpanRad);
        eng.targets = [
          {
            id: 1,
            angle: primaryAngle,
            baseAngle: primaryAngle,
            halfWidth: Math.max(0.24, baseHW * 1.08),
            initialHalfWidth: Math.max(0.24, baseHW * 1.08),
            tapsLeft: 1,
            seqNum: 0,
            alpha: 1,
            enteredWindow: false,
            spawnTime: eng.songTime,
            targetHitTime: noteHitT,
            expireTime: noteHitT !== undefined ? noteHitT + Math.max(0.32, holdDur * 0.48) : undefined,
            isHold: true,
            holdSpanRad,
            holdEndAngle: endAngle,
            holdDir: eng.direction,
            holdDurationSec: holdDur,
            holdElapsedSec: 0,
            isHolding: false,
            holdTickAccum: 0,
          },
        ];
      } else if (modeId === 'MULTI_CLUSTER') {
        const secondAngle = wrapAngle(primaryAngle + eng.direction * 1.32);
        const clusterExpire = noteHitT !== undefined ? noteHitT + multiGrace : undefined;
        eng.targets = [
          {
            id: 1,
            angle: primaryAngle,
            baseAngle: primaryAngle,
            halfWidth: baseHW * 0.94,
            initialHalfWidth: baseHW * 0.94,
            tapsLeft: 1,
            seqNum: 0,
            alpha: 1,
            enteredWindow: false,
            spawnTime: eng.songTime,
            targetHitTime: noteHitT,
            expireTime: clusterExpire,
          },
          {
            id: 2,
            angle: secondAngle,
            baseAngle: secondAngle,
            halfWidth: baseHW * 0.94,
            initialHalfWidth: baseHW * 0.94,
            tapsLeft: 1,
            seqNum: 0,
            alpha: 1,
            enteredWindow: false,
            spawnTime: eng.songTime,
            targetHitTime: noteHitT !== undefined ? noteHitT + 1.32 / Math.max(1, eng.baseAngularSpeed) : undefined,
            expireTime: clusterExpire,
          },
        ];
      } else if (modeId === 'ORDERED_SEQ') {
        const span = Math.max(0.76, Math.min(1.28, travelAngle * 0.68));
        const a1 = primaryAngle;
        const a2 = wrapAngle(a1 + eng.direction * span);
        const a3 = wrapAngle(a2 + eng.direction * span);
        const hw = baseHW * 0.90;
        const seqExpire = noteHitT !== undefined ? noteHitT + (span * 2) / Math.max(1, eng.baseAngularSpeed) + standardGrace : undefined;
        eng.targets = [
          { id: 1, angle: a1, baseAngle: a1, halfWidth: hw, initialHalfWidth: hw, tapsLeft: 1, seqNum: 1, alpha: 1, enteredWindow: false, spawnTime: eng.songTime, targetHitTime: noteHitT, expireTime: seqExpire },
          { id: 2, angle: a2, baseAngle: a2, halfWidth: hw, initialHalfWidth: hw, tapsLeft: 1, seqNum: 2, alpha: 1, enteredWindow: false, spawnTime: eng.songTime, targetHitTime: noteHitT !== undefined ? noteHitT + span / Math.max(1, eng.baseAngularSpeed) : undefined, expireTime: seqExpire },
          { id: 3, angle: a3, baseAngle: a3, halfWidth: hw, initialHalfWidth: hw, tapsLeft: 1, seqNum: 3, alpha: 1, enteredWindow: false, spawnTime: eng.songTime, targetHitTime: noteHitT !== undefined ? noteHitT + (span * 2) / Math.max(1, eng.baseAngularSpeed) : undefined, expireTime: seqExpire },
        ];
      } else if (modeId === 'METEOR_SLASH') {
        const echoOffset = Math.max(0.95, Math.min(1.75, travelAngle * 0.82));
        const echoAngle = wrapAngle(primaryAngle - eng.direction * echoOffset);
        const slashExpire = noteHitT !== undefined ? noteHitT + multiGrace : undefined;
        eng.targets = [
          {
            id: 1,
            angle: primaryAngle,
            baseAngle: primaryAngle,
            halfWidth: baseHW,
            initialHalfWidth: baseHW,
            tapsLeft: 1,
            seqNum: 0,
            alpha: 1,
            enteredWindow: false,
            spawnTime: eng.songTime,
            targetHitTime: noteHitT,
            expireTime: slashExpire,
          },
          {
            id: 2,
            angle: echoAngle,
            baseAngle: echoAngle,
            halfWidth: baseHW * 1.06,
            initialHalfWidth: baseHW * 1.06,
            tapsLeft: 1,
            seqNum: 0,
            alpha: 0.48,
            enteredWindow: false,
            spawnTime: eng.songTime,
            targetHitTime: noteHitT !== undefined ? noteHitT + echoOffset / Math.max(1, eng.baseAngularSpeed * 1.15) : undefined,
            expireTime: slashExpire,
            isMeteorEcho: true,
          },
        ];
      } else if (modeId === 'OSU_PORTAL') {
        const entryOff = Math.max(0.55, travelAngle * 0.44);
        const postExitOff = Math.max(0.55, travelAngle - entryOff);
        const entryA = wrapAngle(eng.spinnerAngle + eng.direction * entryOff);
        const exitA = wrapAngle(entryA + Math.PI);
        const targetA = wrapAngle(exitA + eng.direction * postExitOff);
        eng.portal = {
          entryAngle: entryA,
          exitAngle: exitA,
          halfWidth: 0.24,
          warped: false,
          warpFlashTimer: 0,
        };
        eng.targets = [
          {
            id: 1,
            angle: targetA,
            baseAngle: targetA,
            halfWidth: baseHW,
            initialHalfWidth: baseHW,
            tapsLeft: 1,
            seqNum: 0,
            alpha: 1,
            enteredWindow: false,
            spawnTime: eng.songTime,
            targetHitTime: noteHitT,
            expireTime: noteHitT !== undefined ? noteHitT + standardGrace : undefined,
          },
        ];
      } else {
        const hw =
          modeId === 'SNIPER_MICRO'
            ? Math.max(0.12, baseHW * 0.64)
            : modeId === 'DECAY_ARC'
            ? baseHW * 1.18
            : baseHW;
        const tapsNeeded =
          modeId === 'DOUBLE_TAP' ? 2 : modeId === 'BEAT_BURST' ? note?.burstCount || 3 : 1;
        const tapExpire =
          noteHitT !== undefined
            ? noteHitT + (tapsNeeded > 1 ? Math.max(standardGrace + 0.34, multiGrace * 0.85) : standardGrace)
            : undefined;
        eng.targets = [
          {
            id: 1,
            angle: primaryAngle,
            baseAngle: primaryAngle,
            halfWidth: hw,
            initialHalfWidth: hw,
            tapsLeft: tapsNeeded,
            seqNum: 0,
            alpha: 1,
            enteredWindow: false,
            spawnTime: eng.songTime,
            targetHitTime: noteHitT,
            expireTime: tapExpire,
          },
        ];
        if (modeId === 'HAZARD_DECOY') {
          eng.hazards = [
            { angle: wrapAngle(primaryAngle - eng.direction * (hw + 0.38)), halfWidth: 0.14 },
            { angle: wrapAngle(primaryAngle + eng.direction * (hw + 0.38)), halfWidth: 0.14 },
          ];
        }
      }
    },
    [computeNominalSpeed, finalizeRunSummary, getActiveSong, getBaseHalfWidth, getEffectiveDifficulty],
  );

  const resetRound = useCallback(
    (autoStart: boolean, sandboxMode: WaveModeId | null = null) => {
      const eng = engineRef.current;
      const p = profileRef.current;
      const song = getActiveSong(p);
      const diffId = getEffectiveDifficulty(p, song);

      audioEngine.stopHoldShimmer();

      eng.score = 0;
      eng.hp = 100;
      eng.streak = 0;
      eng.maxStreakInRun = 0;
      eng.unbankedOrbs = 0;
      eng.shields = p.equippedMods.includes('SH') ? 1 : 0;
      eng.spinnerAngle = -Math.PI / 2;
      eng.direction = p.equippedMods.includes('MR') ? -1 : 1;
      eng.waveIndex = 0;
      eng.waitingForCue = false;
      eng.waveElapsed = 0;
      eng.songTime = 0;
      eng.songSection = 'INTRO';
      eng.beatmap = buildSongBeatmap(song, diffId, p.equippedMods);
      eng.beatmapIndex = 0;
      eng.hitEffects = [];
      eng.hitErrorTicks = [];
      eng.hubStatusText = 'READY';
      eng.hubStatusColor = null;
      eng.hubStatusTimer = 0;
      eng.shakeTime = 0;
      eng.shakeX = 0;
      eng.missReason = '';
      eng.missDegrees = '0.0';
      eng.missSignedSpan = 0;
      eng.perfectCount = 0;
      eng.greatCount = 0;
      eng.goodCount = 0;
      eng.missCount = 0;
      eng.runOffsetDegSum = 0;
      eng.runHitCount = 0;
      eng.runOffsetSamples = [];
      eng.isTutorialRun = !sandboxMode && song.id === 'moments_passing' && !p.tutorialSongCompleted;
      eng.tutorialLives = 3;
      eng.shownLessonIds = new Set<string>();
      eng.activeLesson = null;
      eng.activeLessonTimer = 0;
      eng.lessonSlowActive = false;
      eng.tutorialGuideDisabled = false;
      eng.dialTimeScale = 1.0;
      eng.cinematicTimer = 0;
      eng.dialVisualAlpha = 1;
      eng.dialSpinBoost = 0;
      eng.sandboxModeId = sandboxMode;

      setSummaryData(null);
      setShowTutorialCompleteStripe(false);
      setUiScore(0);
      setUiHp(100);
      setUiStreak(0);
      setUiAccuracy(100);
      setUiUnbankedOrbs(0);
      setUiShields(eng.shields);
      setUiSongTime(0);
      setUiSection('INTRO');
      setUiActiveLesson(null);
      setUiTutorialLives(3);
      setUiIsTutorialRun(eng.isTutorialRun);
      setUiSandboxMode(sandboxMode);

      eng.phase = autoStart ? 'PLAYING' : 'IDLE';
      setUiPhase(eng.phase);
      spawnNextWave(true, sandboxMode);

      if (autoStart) {
        audioEngine
          .startAtOffset(
            song,
            0,
            p.musicEnabled,
            p.musicVolume,
            p.soundEnabled,
            p.sfxVolume,
            Boolean(sandboxMode),
            1.0,
          )
          .then((realDur) => {
            if (realDur && Math.abs(realDur - song.durationSec) > 1.5) {
              setSongs((prev) =>
                prev.map((item) => (item.id === song.id ? { ...item, durationSec: realDur } : item)),
              );
            }
          });
      } else {
        audioEngine.stop();
      }
    },
    [getActiveSong, getEffectiveDifficulty, spawnNextWave],
  );

  useEffect(() => {
    resetRound(false, null);

    const handleFirstUnlock = () => {
      const p = profileRef.current;
      const active = getActiveSong(p);
      audioEngine.unlock();
      audioEngine.updateVolumes(p.musicEnabled, p.musicVolume, p.soundEnabled, p.sfxVolume);
      audioEngine.loadSongBuffer(active).then((buf) => {
        if (buf && Math.abs(buf.duration - active.durationSec) > 1.5) {
          setSongs((prev) =>
            prev.map((item) => (item.id === active.id ? { ...item, durationSec: buf.duration } : item)),
          );
        }
      });
    };
    window.addEventListener('pointerdown', handleFirstUnlock, { passive: true, once: true });
    window.addEventListener('keydown', handleFirstUnlock, { passive: true, once: true });
    return () => {
      window.removeEventListener('pointerdown', handleFirstUnlock);
      window.removeEventListener('keydown', handleFirstUnlock);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onBeforeUnload = () => flushRunProfileDeltas();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      warpTimersRef.current.forEach((id) => window.clearTimeout(id));
      warpTimersRef.current = [];
    };
  }, [flushRunProfileDeltas]);

  const triggerMiss = useCallback(
    (reasonText: string, targetRef?: TargetSector, isSuddenFail = false) => {
      const eng = engineRef.current;
      const p = profileRef.current;
      const song = getActiveSong(p);

      audioEngine.stopHoldShimmer();

      if (eng.lessonSlowActive) {
        eng.lessonSlowActive = false;
        eng.activeLesson = null;
        eng.dialTimeScale = 1.0;
        setUiActiveLesson(null);
      }

      if (eng.shields > 0 && !isSuddenFail) {
        eng.shields -= 1;
        setUiShields(eng.shields);
        eng.shakeTime = 0.25;
        eng.shakeAmplitude = 8;
        eng.hubStatusText = 'SHIELDED';
        eng.hubStatusColor = '#34d399';
        eng.hubStatusTimer = 0.7;
        audioEngine.playShieldBreak(p.soundEnabled);
        spawnNextWave(false, eng.sandboxModeId);
        return;
      }

      recordMechanicStat(eng, eng.waveModeId, 'miss');
      eng.missCount += 1;
      eng.streak = 0;
      setUiStreak(0);
      setUiAccuracy(computeCurrentAccuracy(eng));

      const ref = targetRef || eng.targets[0];
      if (ref) {
        const tStart = wrapAngle(ref.angle - ref.halfWidth);
        const tEnd = wrapAngle(ref.angle + ref.halfWidth);
        const dStart = signedAngleDiff(eng.spinnerAngle, tStart);
        const dEnd = signedAngleDiff(eng.spinnerAngle, tEnd);
        if (Math.abs(dStart) <= Math.abs(dEnd)) {
          eng.missNearestEdge = tStart;
          eng.missSignedSpan = dStart;
        } else {
          eng.missNearestEdge = tEnd;
          eng.missSignedSpan = dEnd;
        }
        const absDelta = Math.abs(signedAngleDiff(eng.spinnerAngle, ref.angle));
        const missRad = Math.max(0.002, absDelta - (ref.halfWidth + NEEDLE_TOLERANCE));
        eng.missDegrees = (missRad * (180 / Math.PI)).toFixed(1);
        const dirErr = signedAngleDiff(eng.spinnerAngle, ref.angle) * eng.direction;
        const isEarly = dirErr < 0;
        eng.hitErrorTicks.push({
          offsetSigned: isEarly ? -1 : 1,
          color: '#ef4444',
          age: 0,
        });
        if (eng.hitErrorTicks.length > 16) eng.hitErrorTicks.shift();
        eng.pendingMisses += 1;
        if (isEarly) eng.pendingEarlyMisses += 1;
        else eng.pendingLateMisses += 1;
      }

      if (eng.isTutorialRun) {
        if (eng.tutorialLives > 0) {
          eng.tutorialLives -= 1;
          setUiTutorialLives(eng.tutorialLives);
        }
        eng.shakeTime = 0.22;
        eng.shakeAmplitude = 6;
        eng.hubStatusText = eng.tutorialLives > 0 ? `${eng.tutorialLives} LIVES` : 'PRACTICE FLOW';
        eng.hubStatusColor = '#f59e0b';
        eng.hubStatusTimer = 0.75;
        audioEngine.playShieldBreak(p.soundEnabled);
        eng.waveIndex += 1;
        spawnNextWave(false, null);
        return;
      }

      // Integrity / HP Drain Model: missing 1 note gently costs Integrity without sudden death (except Sudden Death mod)
      const isNoFail = p.equippedMods.includes('NF') || Boolean(eng.sandboxModeId);
      const isSD = p.equippedMods.includes('SD') || isSuddenFail;
      const diffId = getEffectiveDifficulty(p, song);
      const baseDrain =
        diffId === 'CHILL'
          ? 7
          : diffId === 'NORMAL'
          ? 9
          : diffId === 'HARD'
          ? 12
          : diffId === 'INSANE'
          ? 14
          : 16;
      const modeAdj = eng.waveModeId === 'ONE_PASS' ? 5 : 0;
      const modMult = p.equippedMods.includes('HR') ? 1.3 : p.equippedMods.includes('EZ') ? 0.55 : 1.0;
      const drain = Math.round((baseDrain + modeAdj) * modMult);

      eng.hp = isSD && !isNoFail ? 0 : Math.max(isNoFail ? 1 : 0, eng.hp - drain);
      setUiHp(eng.hp);

      if (eng.hp > 0) {
        // Non-fatal miss: shock feedback + advance smoothly to next synced note!
        audioEngine.playMiss(p.soundEnabled);
        eng.shakeTime = 0.22;
        eng.shakeAmplitude = 7;
        eng.hubStatusText = reasonText;
        eng.hubStatusColor = '#ef4444';
        eng.hubStatusTimer = 0.52;
        eng.hitEffects.push({
          timer: 0.4,
          duration: 0.4,
          angle: eng.spinnerAngle,
          isPerfect: false,
          label: reasonText,
          color: '#ef4444',
        });
        eng.waveIndex += 1;
        spawnNextWave(false, eng.sandboxModeId);
        return;
      }

      audioEngine.playMiss(p.soundEnabled);
      eng.missReason = reasonText;
      eng.shakeTime = 0.34;
      eng.shakeAmplitude = 11;

      orbitEvents.emit('onMiss', {
        reason: reasonText,
        degrees: eng.missDegrees,
        songId: song.id,
      });

      finalizeRunSummary(false);
    },
    [finalizeRunSummary, getActiveSong, getEffectiveDifficulty, spawnNextWave],
  );

  const awardHitSuccess = useCallback(
    (
      tier: JudgmentTier,
      offsetSigned: number,
      offsetDeg: number,
      labelOverride?: string,
      orbGain = 0,
    ) => {
      const eng = engineRef.current;
      const p = profileRef.current;
      const song = getActiveSong(p);
      const diffId = getEffectiveDifficulty(p, song);
      const isPerfect = tier === 'PERFECT';
      const fxColor = tier === 'PERFECT' ? '#ffffff' : tier === 'GREAT' ? '#34d399' : '#22d3ee';

      eng.streak += 1;
      eng.maxStreakInRun = Math.max(eng.maxStreakInRun, eng.streak);

      const pts = computeHitPoints(tier, diffId, p.equippedMods, eng.streak);
      eng.score += pts;

      const hpGain = isPerfect ? 4.5 : tier === 'GREAT' ? 2.8 : 1.2;
      eng.hp = Math.min(100, eng.hp + hpGain);
      setUiHp(eng.hp);

      if (tier === 'PERFECT') {
        eng.perfectCount += 1;
        recordMechanicStat(eng, eng.waveModeId, 'perfect');
        if (!eng.sandboxModeId) {
          eng.unbankedOrbs += Math.max(1, orbGain);
          setUiUnbankedOrbs(eng.unbankedOrbs);
        }
      } else {
        if (tier === 'GREAT') eng.greatCount += 1;
        else eng.goodCount += 1;
        recordMechanicStat(eng, eng.waveModeId, 'hit');
        if (orbGain > 0 && !eng.sandboxModeId) {
          eng.unbankedOrbs += orbGain;
          setUiUnbankedOrbs(eng.unbankedOrbs);
        }
      }

      eng.runOffsetDegSum += offsetDeg;
      eng.runHitCount += 1;
      eng.runOffsetSamples.push(offsetSigned);

      if (p.equippedMods.includes('SH') && eng.streak % 12 === 0 && eng.shields < 2) {
        eng.shields += 1;
        setUiShields(eng.shields);
      }

      if (eng.streak === 25 || eng.streak === 50 || eng.streak === 100) {
        const mTier: 1 | 2 | 3 = eng.streak === 100 ? 3 : eng.streak === 50 ? 2 : 1;
        audioEngine.playComboMilestone(p.soundEnabled, mTier);
        orbitEvents.emit('onComboMilestone', { streak: eng.streak, tier: mTier });
      }

      orbitEvents.emit('onHit', {
        tier,
        streak: eng.streak,
        points: pts,
        offsetSigned,
        songId: song.id,
      });

      audioEngine.playHit(p.soundEnabled, p.hitSfxMode, eng.streak, isPerfect, song.scaleNotes);
      eng.hitEffects.push({
        timer: 0.44,
        duration: 0.44,
        angle: eng.spinnerAngle,
        isPerfect,
        label:
          labelOverride ||
          (isPerfect && !eng.sandboxModeId ? `${tier} +${pts} (+1 Orb)` : `${tier} +${pts}`),
        color: fxColor,
      });
      if (eng.hitEffects.length > 5) eng.hitEffects.shift();

      eng.hubStatusText = tier;
      eng.hubStatusColor = fxColor;
      eng.hubStatusTimer = 0.42;
      setUiScore(eng.score);
      setUiStreak(eng.streak);
      setUiAccuracy(computeCurrentAccuracy(eng));

      eng.pendingHits += 1;
      if (isPerfect) eng.pendingPerfects += 1;
      eng.pendingOffsetDegSum += offsetDeg;
    },
    [getActiveSong, getEffectiveDifficulty],
  );

  const handleTriggerPress = useCallback(() => {
    if (screenRef.current !== 'PLAYING') return;
    if (pauseOpenRef.current || modsOpenRef.current) return;

    const nowMs = performance.now();
    const minDebounce = engineRef.current.waveModeId === 'FEVER_SPINNER' ? 12 : 18;
    if (nowMs - lastInputTimestampRef.current < minDebounce) return;
    lastInputTimestampRef.current = nowMs;

    const eng = engineRef.current;
    const p = profileRef.current;
    if (eng.phase === 'IDLE' || eng.phase === 'SUMMARY') {
      audioEngine.ensureContext();
      resetRound(true, eng.sandboxModeId);
      return;
    }
    if (eng.phase !== 'PLAYING') return;

    // 1. Handle FEVER_SPINNER rapid mash
    const feverTarget = eng.targets.find((t) => t.isFeverSpinner);
    if (feverTarget) {
      feverTarget.feverHits = (feverTarget.feverHits || 0) + 1;
      const maxH = feverTarget.feverMaxHits || 7;
      const ratio = feverTarget.feverHits / maxH;
      audioEngine.playFeverTap(p.soundEnabled, ratio);
      eng.beatPulse = 0.65;
      if (feverTarget.feverHits >= maxH) {
        eng.targets = [];
        awardHitSuccess('PERFECT', 0, 0, 'FEVER MAX! (+2 Orbs)', 2);
        eng.waveIndex += 1;
        spawnNextWave(false, eng.sandboxModeId);
      }
      return;
    }

    // 2. If currently riding a Hold Arc already, ignore secondary accidental key press
    if (eng.targets.some((t) => t.isHold && t.isHolding)) {
      return;
    }

    // 3. Quiet gap cruise tap check
    if (eng.targets.length === 0) return;

    // 4. Hazard mines
    for (let i = 0; i < eng.hazards.length; i++) {
      const h = eng.hazards[i];
      if (Math.abs(signedAngleDiff(eng.spinnerAngle, h.angle)) <= h.halfWidth + 0.01) {
        triggerMiss('HAZARD HIT', eng.targets[0]);
        return;
      }
    }

    // 5. Find closest hit target in range
    let matchedIdx = -1;
    let bestAbsDelta = Infinity;
    for (let i = 0; i < eng.targets.length; i++) {
      const t = eng.targets[i];
      const absD = Math.abs(signedAngleDiff(eng.spinnerAngle, t.angle));
      if (absD <= t.halfWidth + NEEDLE_TOLERANCE && absD < bestAbsDelta) {
        bestAbsDelta = absD;
        matchedIdx = i;
      }
    }

    if (matchedIdx === -1) {
      let nearest = eng.targets[0];
      let minD = Infinity;
      for (const t of eng.targets) {
        const d = Math.abs(signedAngleDiff(eng.spinnerAngle, t.angle));
        if (d < minD) {
          minD = d;
          nearest = t;
        }
      }

      // Early Tap Guard: if player clicked far too early before beat arrival, nudge politely
      // WITHOUT deleting the upcoming on-beat sector so rhythm stays locked!
      const timeRemaining = nearest?.targetHitTime ? nearest.targetHitTime - eng.songTime : 0;
      if (nearest && !eng.sandboxModeId && (timeRemaining > 0.30 || minD > nearest.halfWidth + 0.48)) {
        eng.streak = 0;
        setUiStreak(0);
        if (!eng.isTutorialRun && !p.equippedMods.includes('NF')) {
          eng.hp = Math.max(1, eng.hp - 3);
          setUiHp(eng.hp);
        }
        eng.hubStatusText = 'WAIT BEAT';
        eng.hubStatusColor = '#fbbf24';
        eng.hubStatusTimer = 0.42;
        eng.hitEffects.push({
          timer: 0.28,
          duration: 0.28,
          angle: eng.spinnerAngle,
          isPerfect: false,
          label: 'EARLY',
          color: '#fbbf24',
        });
        audioEngine.playShieldBreak(p.soundEnabled);
        return;
      }

      const dirErr = nearest ? signedAngleDiff(eng.spinnerAngle, nearest.angle) * eng.direction : 0;
      triggerMiss(dirErr < 0 ? 'TOO EARLY' : 'TOO LATE', nearest);
      return;
    }

    const hitTarget = eng.targets[matchedIdx];
    if (eng.waveModeId === 'ORDERED_SEQ' && matchedIdx !== 0) {
      triggerMiss('WRONG ORDER', hitTarget);
      return;
    }

    if (eng.activeLesson) {
      eng.activeLessonTimer = 0.9;
    }

    // 6. Engage HOLD_ARC sustain
    if (hitTarget.isHold) {
      hitTarget.isHolding = true;
      hitTarget.holdElapsedSec = 0;
      const song = getActiveSong(p);
      audioEngine.startHoldShimmer(p.soundEnabled, song.scaleNotes, eng.streak);
      eng.hubStatusText = 'HOLDING';
      eng.hubStatusColor = '#38bdf8';
      eng.hubStatusTimer = 0.5;
      return;
    }

    const rxBoost = p.equippedMods.includes('RX') ? 0.31 : 0.25;
    const ratio = bestAbsDelta / Math.max(0.01, hitTarget.halfWidth);
    const tier: JudgmentTier = ratio <= rxBoost ? 'PERFECT' : ratio <= 0.64 ? 'GREAT' : 'GOOD';
    const fxColor = tier === 'PERFECT' ? '#ffffff' : tier === 'GREAT' ? '#34d399' : '#22d3ee';
    const signedErr = signedAngleDiff(eng.spinnerAngle, hitTarget.angle) * eng.direction;
    const offsetSigned = Math.max(
      -1,
      Math.min(1, signedErr / Math.max(0.05, hitTarget.halfWidth + NEEDLE_TOLERANCE)),
    );
    eng.hitErrorTicks.push({ offsetSigned, color: fxColor, age: 0 });
    if (eng.hitErrorTicks.length > 16) eng.hitErrorTicks.shift();

    const song = getActiveSong(p);
    if (hitTarget.tapsLeft > 1) {
      hitTarget.tapsLeft -= 1;
      hitTarget.halfWidth *= 0.88;
      audioEngine.playHit(p.soundEnabled, p.hitSfxMode, eng.streak, tier === 'PERFECT', song.scaleNotes);
      eng.hitEffects.push({
        timer: 0.34,
        duration: 0.34,
        angle: eng.spinnerAngle,
        isPerfect: tier === 'PERFECT',
        label: hitTarget.tapsLeft === 1 ? 'LAST TAP!' : `TAP ×${hitTarget.tapsLeft}`,
        color: '#22d3ee',
      });
      eng.hubStatusText = `×${hitTarget.tapsLeft} LEFT`;
      eng.hubStatusColor = '#22d3ee';
      eng.hubStatusTimer = 0.35;
      return;
    }

    eng.targets.splice(matchedIdx, 1);

    // METEOR_SLASH flips direction straight toward its rebound echo!
    if (eng.waveModeId === 'METEOR_SLASH' && eng.targets.length > 0 && eng.targets[0].isMeteorEcho) {
      eng.direction = eng.direction === 1 ? -1 : 1;
      eng.targets[0].alpha = 1.0;
      eng.angularSpeed = eng.baseAngularSpeed * 1.15;
    }

    const offsetDeg = bestAbsDelta * (180 / Math.PI);
    awardHitSuccess(tier, offsetSigned, offsetDeg);

    if (eng.targets.length > 0) return;

    eng.waveIndex += 1;
    spawnNextWave(false, eng.sandboxModeId);
  }, [awardHitSuccess, getActiveSong, resetRound, spawnNextWave, triggerMiss]);

  const handleTriggerRelease = useCallback(() => {
    if (screenRef.current !== 'PLAYING') return;
    const eng = engineRef.current;
    if (eng.phase !== 'PLAYING') return;

    const holdIdx = eng.targets.findIndex((t) => t.isHold && t.isHolding);
    if (holdIdx === -1) return;

    const holdTarget = eng.targets[holdIdx];
    audioEngine.stopHoldShimmer();
    const dur = Math.max(0.25, holdTarget.holdDurationSec || 0.85);
    const prog = (holdTarget.holdElapsedSec || 0) / dur;

    if (prog < 0.42) {
      triggerMiss('HOLD BROKEN', holdTarget);
      return;
    }

    eng.targets.splice(holdIdx, 1);
    const tier: JudgmentTier = prog >= 0.72 ? 'PERFECT' : prog >= 0.54 ? 'GREAT' : 'GOOD';
    awardHitSuccess(
      tier,
      Math.max(-0.5, Math.min(0.5, prog - 0.92)),
      Math.abs(1 - prog) * 14,
      tier === 'PERFECT' ? 'HOLD CLEAR! (+1 Orb)' : 'HOLD CLEAR',
      tier === 'PERFECT' ? 1 : 0,
    );

    eng.waveIndex += 1;
    spawnNextWave(false, eng.sandboxModeId);
  }, [awardHitSuccess, spawnNextWave, triggerMiss]);

  // Fixed-Cap 60fps Update Loop
  useEffect(() => {
    let lastTime = performance.now();
    let lastHudSync = 0;
    let rafId = 0;

    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const eng = engineRef.current;
      const p = profileRef.current;
      const song = getActiveSong(p);

      for (let i = eng.hitEffects.length - 1; i >= 0; i--) {
        eng.hitEffects[i].timer -= dt;
        if (eng.hitEffects[i].timer <= 0) eng.hitEffects.splice(i, 1);
      }
      for (let i = eng.hitErrorTicks.length - 1; i >= 0; i--) {
        eng.hitErrorTicks[i].age += dt;
        if (eng.hitErrorTicks[i].age >= 1.8) eng.hitErrorTicks.splice(i, 1);
      }
      if (eng.hubStatusTimer > 0) {
        eng.hubStatusTimer = Math.max(0, eng.hubStatusTimer - dt);
      }
      if (eng.shakeTime > 0) {
        eng.shakeTime = Math.max(0, eng.shakeTime - dt);
        const prog = 1 - eng.shakeTime / 0.34;
        eng.shakeX = Math.sin(prog * Math.PI * 10) * eng.shakeAmplitude * Math.pow(1 - prog, 2);
        if (eng.shakeTime === 0) eng.shakeX = 0;
      }

      eng.beatPulse = Math.max(0, eng.beatPulse - dt * 4.5);
      const tRef = eng.songTime > 0 ? eng.songTime : now / 1000;
      const ledIdx = Math.floor(tRef / (60 / Math.max(60, song.bpm))) % 4;
      if (ledIdx !== eng.activeBeatLed) {
        eng.activeBeatLed = ledIdx;
        eng.beatPulse = 0.85;
        setUiBeatLed(ledIdx);
        orbitEvents.emit('onBeat', { beatIndex: ledIdx, bpm: song.bpm, songId: song.id });
      }

      if (eng.phase === 'TUTORIAL_CINEMATIC') {
        eng.cinematicTimer += dt;
        const t = eng.cinematicTimer;
        if (t < 0.85) {
          const prog = t / 0.85;
          eng.dialSpinBoost = 12 * prog;
          eng.dialVisualAlpha = Math.max(0, 1 - prog);
        } else if (t < 2.0) {
          eng.dialVisualAlpha = 0;
        } else if (t < 2.65) {
          const prog = (t - 2.0) / 0.65;
          eng.dialSpinBoost = 6 * (1 - prog);
          eng.dialVisualAlpha = Math.min(1, prog);
        } else {
          eng.dialSpinBoost = 0;
          eng.dialVisualAlpha = 1;
        }

        const stripeActive = t >= 0.65 && t < 2.15;
        if (stripeActive !== lastTutorialStripeRef.current) {
          lastTutorialStripeRef.current = stripeActive;
          setShowTutorialCompleteStripe(stripeActive);
        }

        eng.spinnerAngle = wrapAngle(eng.spinnerAngle + (eng.angularSpeed + eng.dialSpinBoost) * dt);
        if (t >= 2.75) {
          if (lastTutorialStripeRef.current) {
            lastTutorialStripeRef.current = false;
            setShowTutorialCompleteStripe(false);
          }
          eng.dialVisualAlpha = 1;
          eng.dialSpinBoost = 0;
          eng.phase = 'SUMMARY';
          setUiPhase('SUMMARY');
        }
      } else if (eng.phase === 'PLAYING' && screenRef.current === 'PLAYING') {
        const audioClock = audioEngine.syncClock();
        const offsetSec = p.audioOffsetMs / 1000;
        if (audioClock !== null && !eng.sandboxModeId) {
          eng.songTime = Math.max(0, audioClock + offsetSec);
        } else {
          eng.songTime += dt;
        }

        if (now - lastHudSync > 120) {
          lastHudSync = now;
          setUiSongTime(eng.songTime);
          const sec = getSectionAtProgress(song, eng.songTime / Math.max(1, song.durationSec));
          if (sec !== eng.songSection) {
            eng.songSection = sec;
            setUiSection(sec);
          }
        }

        if (!eng.sandboxModeId && eng.songTime >= song.durationSec) {
          finalizeRunSummary(true);
        } else {
          // If cruising cleanly through an intro or song breakdown gap, cue the next target on schedule!
          if (eng.waitingForCue && !eng.sandboxModeId) {
            const upcoming = eng.beatmap[eng.beatmapIndex];
            if (!upcoming) {
              finalizeRunSummary(true);
            } else if (upcoming.hitTime - eng.songTime <= 1.35) {
              spawnNextWave(false, null);
            }
          }

          // Tutorial Coach Banner stays synced at 1.0x audio speed (zero slow-mo clock drift!)
          if (eng.activeLesson) {
            eng.activeLessonTimer -= dt;
            if (eng.activeLessonTimer <= 0) {
              eng.activeLesson = null;
              setUiActiveLesson(null);
            }
          }

          if (
            eng.isTutorialRun &&
            !eng.tutorialGuideDisabled &&
            !eng.activeLesson &&
            eng.targets.length > 0
          ) {
            const nextLesson = TUTORIAL_LESSONS.find(
              (l) =>
                !eng.shownLessonIds.has(l.id) &&
                eng.waveIndex >= l.minWaveIndex &&
                (l.triggerMode === 'ANY' || l.triggerMode === eng.waveModeId),
            );
            if (nextLesson) {
              const t0 = eng.targets[0];
              const timeAhead = t0.targetHitTime ? t0.targetHitTime - eng.songTime : 0.8;
              if (timeAhead <= 1.6) {
                eng.shownLessonIds.add(nextLesson.id);
                eng.activeLesson = nextLesson;
                eng.activeLessonTimer = 3.8;
                audioEngine.playLessonSlowCue(p.soundEnabled);
                setUiActiveLesson(nextLesson);
              }
            }
          }

          eng.dialTimeScale = 1.0;
          const simDt = dt;
          eng.waveElapsed += simDt;

          if (eng.waveModeId === 'BRAKE_DRIFT') {
            const mod = 0.68 + 0.50 * Math.abs(Math.sin(eng.waveElapsed * 3.4));
            eng.angularSpeed = eng.baseAngularSpeed * mod;
          } else if (eng.waveModeId !== 'METEOR_SLASH') {
            eng.angularSpeed = eng.baseAngularSpeed;
          }

          // Update Hold Arcs & Fever Spinners
          for (let i = eng.targets.length - 1; i >= 0; i--) {
            const t = eng.targets[i];
            if (t.isFeverSpinner) {
              t.feverRemainingSec = (t.feverRemainingSec || 1.2) - dt;
              if ((t.feverRemainingSec || 0) <= 0) {
                if ((t.feverHits || 0) >= 2) {
                  eng.targets.splice(i, 1);
                  awardHitSuccess('GOOD', 0, 0, 'FEVER CHARGED');
                  eng.waveIndex += 1;
                  spawnNextWave(false, eng.sandboxModeId);
                } else {
                  triggerMiss('FEVER MISSED', t);
                }
                break;
              }
              continue;
            }

            if (t.isHold && t.isHolding) {
              const dur = Math.max(0.25, t.holdDurationSec || 0.85);
              t.holdElapsedSec = (t.holdElapsedSec || 0) + simDt;
              const prog = t.holdElapsedSec / dur;
              audioEngine.updateHoldShimmer(prog);
              if (prog >= 1.12) {
                // Auto-complete cleanly right at the end of the ribbon if user holds cleanly through cap
                audioEngine.stopHoldShimmer();
                eng.targets.splice(i, 1);
                awardHitSuccess('GREAT', 0.1, 3, 'HOLD COMPLETE');
                eng.waveIndex += 1;
                spawnNextWave(false, eng.sandboxModeId);
                break;
              }
              continue;
            }

            if (eng.waveModeId === 'SPRING_BOUNCE') {
              t.angle = wrapAngle(t.baseAngle + Math.sin(eng.waveElapsed * 2.8) * 0.42);
            }
            if (eng.waveModeId === 'DECAY_ARC') {
              t.halfWidth = Math.max(0.11, t.initialHalfWidth - eng.waveElapsed * 0.085);
            }
            if (eng.waveModeId === 'GHOST_PULSE' || p.equippedMods.includes('HD')) {
              const dist = Math.abs(signedAngleDiff(eng.spinnerAngle, t.angle));
              t.alpha = dist < 0.95 ? Math.max(0.12, (dist / 0.95) * 0.75) : 1.0;
            }
          }

          eng.spinnerAngle = wrapAngle(
            eng.spinnerAngle + eng.direction * eng.angularSpeed * simDt,
          );

          if (eng.portal) {
            if (
              !eng.portal.warped &&
              Math.abs(signedAngleDiff(eng.spinnerAngle, eng.portal.entryAngle)) <= eng.portal.halfWidth
            ) {
              eng.portal.warped = true;
              eng.portal.warpFlashTimer = 0.16;
              eng.spinnerAngle = eng.portal.exitAngle;
              eng.hitEffects.push({
                timer: 0.28,
                duration: 0.28,
                angle: eng.portal.exitAngle,
                isPerfect: false,
                label: 'WARP',
                color: '#e879f9',
              });
            }
          }

          if (eng.waveModeId === 'ONE_PASS' || p.equippedMods.includes('SD')) {
            const targetsToCheck =
              eng.waveModeId === 'ORDERED_SEQ' && eng.targets.length > 0
                ? [eng.targets[0]]
                : eng.targets.filter((t) => !t.isHolding && !t.isFeverSpinner);
            for (let i = 0; i < targetsToCheck.length; i++) {
              const t = targetsToCheck[i];
              const overNow =
                Math.abs(signedAngleDiff(eng.spinnerAngle, t.angle)) <= t.halfWidth + NEEDLE_TOLERANCE;
              if (overNow) {
                t.enteredWindow = true;
              } else if (t.enteredWindow) {
                triggerMiss('OVERSHOT ONE-PASS', t, p.equippedMods.includes('SD'));
                break;
              }
            }
          } else if (!eng.sandboxModeId && eng.targets.length > 0) {
            // Audio-Synced Beat Expiry Recovery: if the music beat passes past late grace
            // without player tapping, softly record miss & smoothly advance to NEXT synced beat
            // so gameplay never freezes behind the song!
            const pendingExpire = eng.targets.filter((t) => !t.isHolding && !t.isFeverSpinner);
            if (pendingExpire.length > 0) {
              const lastExpire = Math.max(...pendingExpire.map((t) => t.expireTime ?? 999999));
              if (eng.songTime > lastExpire) {
                triggerMiss('BEAT MISSED', pendingExpire[0]);
              }
            }
          }
        }
      }

      const cs = canvasStateRef.current;
      cs.phase = eng.phase;
      cs.spinnerAngle = eng.spinnerAngle;
      cs.direction = eng.direction;
      cs.angularSpeed = eng.angularSpeed;
      cs.waveModeId = eng.waveModeId;
      cs.targets = eng.targets;
      cs.hazards = eng.hazards;
      cs.portal = eng.portal;
      cs.hitEffects = eng.hitEffects;
      cs.hitErrorTicks = eng.hitErrorTicks;
      cs.hubStatusText = eng.hubStatusText;
      cs.hubStatusColor = eng.hubStatusColor;
      cs.hubStatusTimer = eng.hubStatusTimer;
      cs.shakeX = eng.shakeX;
      cs.missDegrees = eng.missDegrees;
      cs.missNearestEdge = eng.missNearestEdge;
      cs.missSignedSpan = eng.missSignedSpan;
      cs.missReasonText = eng.missReason;
      cs.dialVisualAlpha = eng.dialVisualAlpha;
      cs.bassEnergy = p.bgFxMode === 'dynamic' ? audioEngine.getBassEnergy() : 0;
      if (p.bgFxMode === 'dynamic') {
        audioEngine.getSpectrumBins(cs.spectrumBins);
      } else {
        cs.spectrumBins.fill(0);
      }
      cs.beatPulse = eng.beatPulse;
      cs.streak = eng.streak;
      cs.songProgressRatio = eng.songTime / Math.max(1, song.durationSec);
      cs.songSections = song.sections;
      cs.songSection = eng.songSection;
      cs.songTime = eng.songTime;
      cs.lessonSlowActive = eng.lessonSlowActive;
      cs.activeLesson = eng.activeLesson;
      cs.flashlightActive = p.equippedMods.includes('FL');

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [awardHitSuccess, finalizeRunSummary, getActiveSong, spawnNextWave, triggerMiss]);

  // Overlay & Screen Navigation Management
  const openPause = useCallback(
    (tab: PauseTabId = 'main') => {
      flushRunProfileDeltas();
      setModsOpen(false);
      if (!pauseOpenRef.current) {
        phaseBeforeOverlayRef.current =
          screenRef.current === 'PLAYING' ? engineRef.current.phase : 'IDLE';
        if (screenRef.current === 'PLAYING' && engineRef.current.phase === 'PLAYING') {
          engineRef.current.phase = 'PAUSED';
          setUiPhase('PAUSED');
          audioEngine.stop();
        }
      }
      setPauseTab(tab);
      setPauseOpen(true);
    },
    [flushRunProfileDeltas],
  );

  const closePause = useCallback(
    (startSelectedSong = false) => {
      setListeningSlot(0);
      setPauseOpen(false);
      if (startSelectedSong) {
        setScreen('PLAYING');
        resetRound(true, null);
        return;
      }
      if (screenRef.current === 'PLAYING' && phaseBeforeOverlayRef.current === 'PLAYING') {
        const eng = engineRef.current;
        const p = profileRef.current;
        const song = getActiveSong(p);
        eng.phase = 'PLAYING';
        setUiPhase('PLAYING');
        audioEngine.startAtOffset(
          song,
          eng.songTime,
          p.musicEnabled,
          p.musicVolume,
          p.soundEnabled,
          p.sfxVolume,
          Boolean(eng.sandboxModeId),
          1.0,
        );
      }
    },
    [getActiveSong, resetRound],
  );

  const openMods = useCallback(() => {
    flushRunProfileDeltas();
    setPauseOpen(false);
    if (!modsOpenRef.current) {
      phaseBeforeOverlayRef.current =
        screenRef.current === 'PLAYING' ? engineRef.current.phase : 'IDLE';
      if (screenRef.current === 'PLAYING' && engineRef.current.phase === 'PLAYING') {
        engineRef.current.phase = 'PAUSED';
        setUiPhase('PAUSED');
        audioEngine.stop();
      }
    }
    setModsOpen(true);
  }, [flushRunProfileDeltas]);

  const closeMods = useCallback(() => {
    setModsOpen(false);
    if (screenRef.current === 'PLAYING' && phaseBeforeOverlayRef.current === 'PLAYING') {
      const eng = engineRef.current;
      const p = profileRef.current;
      const song = getActiveSong(p);
      eng.phase = 'PLAYING';
      setUiPhase('PLAYING');
      audioEngine.startAtOffset(
        song,
        eng.songTime,
        p.musicEnabled,
        p.musicVolume,
        p.soundEnabled,
        p.sfxVolume,
        Boolean(eng.sandboxModeId),
        1.0,
      );
    }
  }, [getActiveSong]);

  const openShopScreen = useCallback(() => {
    flushRunProfileDeltas();
    setPauseOpen(false);
    setModsOpen(false);
    if (screenRef.current === 'PLAYING' && engineRef.current.phase === 'PLAYING') {
      engineRef.current.phase = 'PAUSED';
      setUiPhase('PAUSED');
      audioEngine.stop();
    }
    if (screenRef.current !== 'SHOP') {
      setPreviousScreen(screenRef.current);
      setScreen('SHOP');
    }
  }, [flushRunProfileDeltas]);

  const exitSubScreen = useCallback(() => {
    const dest =
      previousScreen === 'SONG_SELECT' || previousScreen === 'PLAYING'
        ? previousScreen
        : 'TITLE';
    setScreen(dest);
  }, [previousScreen]);

  // Global Keyboard Shortcuts (Press + Release for Hold Arc!)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (listeningSlot > 0) {
        e.preventDefault();
        e.stopPropagation();
        if (e.code !== 'Escape') {
          const label = formatKeyLabel(e);
          updateProfile((prev) =>
            listeningSlot === 1
              ? { ...prev, trigger1Code: e.code, trigger1Label: label }
              : { ...prev, trigger2Code: e.code, trigger2Label: label },
          );
          audioEngine.playHit(
            profileRef.current.soundEnabled,
            profileRef.current.hitSfxMode,
            1,
            true,
            getActiveSong().scaleNotes,
          );
        }
        setListeningSlot(0);
        return;
      }

      if (e.code === 'Escape') {
        e.preventDefault();
        if (modsOpenRef.current) closeMods();
        else if (pauseOpenRef.current) closePause(false);
        else if (screenRef.current === 'PLAYING') openPause('main');
        else if (
          screenRef.current === 'SETTINGS' ||
          screenRef.current === 'INDEX' ||
          screenRef.current === 'SHOP'
        ) {
          exitSubScreen();
        } else if (screenRef.current === 'SONG_SELECT') {
          audioEngine.stop();
          setScreen('TITLE');
        }
        return;
      }

      if (pauseOpenRef.current || modsOpenRef.current) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (screenRef.current !== 'PLAYING') return;

      const p = profileRef.current;
      if (e.code === p.trigger1Code || e.code === p.trigger2Code) {
        e.preventDefault();
        handleTriggerPress();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (screenRef.current !== 'PLAYING') return;
      const p = profileRef.current;
      if (e.code === p.trigger1Code || e.code === p.trigger2Code) {
        handleTriggerRelease();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [
    closeMods,
    closePause,
    exitSubScreen,
    getActiveSong,
    handleTriggerPress,
    handleTriggerRelease,
    listeningSlot,
    openPause,
    updateProfile,
  ]);

  // Navigation & Unlocks
  const launchWithWarp = useCallback(
    (song: SongDefinition, diffId: DifficultyId) => {
      warpTimersRef.current.forEach((id) => window.clearTimeout(id));
      warpTimersRef.current = [];
      audioEngine.playUiLaunch(profileRef.current.soundEnabled);
      setWarpLaunchLabel(`${song.title} · ${song.chillOnly ? 'CHILL' : diffId}`);
      const t1 = window.setTimeout(() => {
        setScreen('PLAYING');
        resetRound(true, null);
      }, 240);
      const t2 = window.setTimeout(() => {
        setWarpLaunchLabel(null);
      }, 480);
      warpTimersRef.current.push(t1, t2);
    },
    [resetRound],
  );

  const previewSong = useCallback(
    (songId: string, withAudioPreview = true) => {
      const p = profileRef.current;
      const song = songsRef.current.find((s) => s.id === songId) || songsRef.current[0];
      const nextDiff = song.chillOnly ? 'CHILL' : p.selectedDifficulty;
      updateProfile({ selectedSongId: song.id, selectedDifficulty: nextDiff });
      orbitEvents.emit('onTrackChange', { songId: song.id, title: song.title, difficulty: nextDiff });
      if (withAudioPreview && p.musicEnabled) {
        const previewOffset = Math.min(Math.max(12, song.durationSec * 0.28), Math.max(0, song.durationSec - 15));
        audioEngine.startAtOffset(
          song,
          previewOffset,
          true,
          p.musicVolume,
          p.soundEnabled,
          p.sfxVolume,
          true,
          0.72,
        );
      }
    },
    [updateProfile],
  );

  const enterSongSelect = useCallback(() => {
    flushRunProfileDeltas();
    setPauseOpen(false);
    setModsOpen(false);
    setSummaryData(null);
    setScreen('SONG_SELECT');
    const active = getActiveSong();
    if (profileRef.current.musicEnabled) {
      previewSong(active.id, true);
    }
  }, [flushRunProfileDeltas, getActiveSong, previewSong]);

  const handlePlayPrimary = useCallback(() => {
    audioEngine.unlock();
    const p = profileRef.current;
    if (!p.tutorialSongCompleted) {
      const tutSong = songsRef.current.find((s) => s.id === 'moments_passing') || songsRef.current[0];
      updateProfile({ selectedSongId: tutSong.id, selectedDifficulty: 'CHILL' });
      launchWithWarp(tutSong, 'CHILL');
      return;
    }
    const active = getActiveSong(p);
    launchWithWarp(active, getEffectiveDifficulty(p, active));
  }, [getActiveSong, getEffectiveDifficulty, launchWithWarp, updateProfile]);

  const handleUnlockDifficulty = useCallback(
    (diffId: DifficultyId, cost: number) => {
      updateProfile((prev) => {
        if (prev.unlockedDiffs.includes(diffId)) return { ...prev, selectedDifficulty: diffId };
        if (!prev.devUnlocked && prev.orbs < cost) return prev;
        return {
          ...prev,
          orbs: prev.devUnlocked ? prev.orbs : prev.orbs - cost,
          unlockedDiffs: [...prev.unlockedDiffs, diffId],
          selectedDifficulty: diffId,
        };
      });
    },
    [updateProfile],
  );

  const handleUnlockSong = useCallback(
    (songId: string, cost: number) => {
      updateProfile((prev) => {
        if (prev.unlockedSongs.includes(songId)) return { ...prev, selectedSongId: songId };
        if (!prev.devUnlocked && prev.orbs < cost) return prev;
        return {
          ...prev,
          orbs: prev.devUnlocked ? prev.orbs : prev.orbs - cost,
          unlockedSongs: [...prev.unlockedSongs, songId],
          selectedSongId: songId,
        };
      });
    },
    [updateProfile],
  );

  const handleUnlockTheme = useCallback(
    (themeId: ThemeId, cost: number) => {
      updateProfile((prev) => {
        if (prev.unlockedThemes.includes(themeId)) return { ...prev, theme: themeId };
        if (!prev.devUnlocked && prev.orbs < cost) return prev;
        return {
          ...prev,
          orbs: prev.devUnlocked ? prev.orbs : prev.orbs - cost,
          unlockedThemes: [...prev.unlockedThemes, themeId],
          theme: themeId,
        };
      });
    },
    [updateProfile],
  );

  const handleUnlockMod = useCallback(
    (code: ModCode, cost: number) => {
      updateProfile((prev) => {
        if (prev.purchasedMods.includes(code)) return prev;
        if (!prev.devUnlocked && prev.orbs < cost) return prev;
        return {
          ...prev,
          orbs: prev.devUnlocked ? prev.orbs : prev.orbs - cost,
          purchasedMods: [...prev.purchasedMods, code],
          equippedMods:
            prev.equippedMods.length < 3 && !prev.equippedMods.includes(code)
              ? [...prev.equippedMods, code]
              : prev.equippedMods,
        };
      });
    },
    [updateProfile],
  );

  const handleToggleMod = useCallback(
    (code: ModCode) => {
      updateProfile((prev) => {
        const mod = MOD_CATALOG.find((m) => m.code === code);
        if (!mod) return prev;
        if (!prev.devUnlocked && mod.orbCost > 0 && !prev.purchasedMods.includes(code)) return prev;
        if (!prev.devUnlocked && prev.totalHits < mod.unlockHits) return prev;

        const cur = prev.equippedMods;
        const next = cur.includes(code)
          ? cur.filter((c) => c !== code)
          : cur.length < 3
          ? [...cur, code]
          : cur;
        return { ...prev, equippedMods: next };
      });
    },
    [updateProfile],
  );

  const handleUploadCustomAudio = useCallback(
    async (file: File, ngIdTag: string) => {
      setCustomAudioStatus(`Decoding ${file.name}...`);
      const customId = `custom_${Date.now()}`;
      const decoded = await audioEngine.decodeCustomFile(customId, file);
      if (!decoded) {
        setCustomAudioStatus('Could not decode audio file.');
        return;
      }
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim();
      const newSong: SongDefinition = {
        id: customId,
        num: String(songsRef.current.length).padStart(2, '0'),
        newgroundsId: ngIdTag || 'CUSTOM',
        artist: 'Imported Audio',
        title: cleanName || 'Custom Track',
        genre: 'Custom MP3',
        category: 'custom',
        bpm: decoded.estimatedBpm,
        keySig: 'AUTO',
        scaleNotes: [60, 62, 64, 67, 69, 72],
        durationSec: decoded.durationSec,
        audioUrl: '',
        bgImageUrl: HERO_DISCO_IMAGE,
        orbCost: 0,
        chillOnly: false,
        isCustom: true,
        customOnsets: decoded.onsets,
        stars: { CHILL: '1.5★', NORMAL: '3.0★', HARD: '4.5★', INSANE: '6.0★', DEMON: '7.5★' },
        desc: `Imported local track (${decoded.estimatedBpm} BPM · ${decoded.onsets.length} detected beats).`,
        sections: [
          { startPct: 0, label: 'INTRO' },
          { startPct: 0.25, label: 'DROP' },
          { startPct: 0.6, label: 'BREAKDOWN' },
          { startPct: 0.85, label: 'OUTRO' },
        ],
      };
      setSongs((prev) => [...prev, newSong]);
      updateProfile((prev) => ({
        ...prev,
        selectedSongId: customId,
        unlockedSongs: [...prev.unlockedSongs, customId],
      }));
      setCustomAudioStatus(`Loaded "${newSong.title}" (${decoded.estimatedBpm} BPM).`);
    },
    [updateProfile],
  );

  const activeSong = getActiveSong();
  const activeDifficulty = getEffectiveDifficulty(profile, activeSong);
  const activeTheme = CHASSIS_THEMES[profile.theme] || CHASSIS_THEMES.tokyo_pink;
  const activeBgSetting = profile.levelBgSettings[activeSong.id];
  const activeModeInfo = useMemo(
    () => WAVE_MODES.find((m) => m.id === uiWaveMode) || WAVE_MODES[0],
    [uiWaveMode],
  );

  const streakMult = getStreakMultiplier(uiStreak);
  const totalMult = computeTotalMultiplier(activeDifficulty, profile.equippedMods, uiStreak);
  const songProgressPct = (uiSongTime / Math.max(1, activeSong.durationSec)) * 100;
  const songTimerText = `${formatTimeSec(uiSongTime)} / ${formatTimeSec(activeSong.durationSec)}`;

  const promptHint = uiSandboxMode
    ? `Practice Mode (${activeModeInfo.name}) — Press ${profile.trigger1Label} or click ring to start`
    : `Press ${profile.trigger1Label}, ${profile.trigger2Label}, or click ring to launch`;

  return (
    <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-[#07080d] text-[#f5f7fa]">
      <BackgroundBackdrop
        defaultImageUrl={screen === 'TITLE' ? activeSong.bgImageUrl || HERO_DISCO_IMAGE : activeSong.bgImageUrl}
        levelSetting={activeBgSetting}
        bgFxMode={profile.bgFxMode}
        forceDimPct={screen === 'TITLE' ? 58 : undefined}
        forceBlurPx={screen === 'TITLE' ? 2 : undefined}
        accentRgb={activeTheme.bgAccentRgb}
      />

      {screen === 'TITLE' && (
        <TitleScreen
          profile={profile}
          activeSong={activeSong}
          onPlayPrimary={handlePlayPrimary}
          onEnterSongSelect={enterSongSelect}
          onOpenOrbVault={() => {
            setPreviousScreen('TITLE');
            setScreen('SHOP');
          }}
          onOpenSettings={() => {
            setPreviousScreen('TITLE');
            setScreen('SETTINGS');
          }}
          onOpenIndex={() => {
            setPreviousScreen('TITLE');
            setScreen('INDEX');
          }}
          onToggleMusic={() => {
            const next = !profile.musicEnabled;
            updateProfile({ musicEnabled: next });
            audioEngine.updateVolumes(next, profile.musicVolume, profile.soundEnabled, profile.sfxVolume);
          }}
          onHoverTick={() => audioEngine.playUiTick(profile.soundEnabled)}
        />
      )}

      {screen === 'SETTINGS' && (
        <SettingsScreen
          profile={profile}
          listeningSlot={listeningSlot}
          onStartRebind={(slot) => setListeningSlot(slot)}
          onBackToTitle={() => {
            setListeningSlot(0);
            setScreen('TITLE');
          }}
          onTogglePointer={() => updateProfile({ allowPointerTap: !profile.allowPointerTap })}
          onReplayTutorial={() => {
            updateProfile({ selectedSongId: 'moments_passing', selectedDifficulty: 'CHILL' });
            setScreen('PLAYING');
            resetRound(true, null);
          }}
          onUpdateAudioOffset={(ms) => updateProfile({ audioOffsetMs: ms })}
          onToggleMusic={() => {
            const next = !profile.musicEnabled;
            updateProfile({ musicEnabled: next });
            audioEngine.updateVolumes(next, profile.musicVolume, profile.soundEnabled, profile.sfxVolume);
          }}
          onMusicVolume={(vol) => {
            updateProfile({ musicVolume: vol });
            audioEngine.updateVolumes(profile.musicEnabled, vol, profile.soundEnabled, profile.sfxVolume);
          }}
          onToggleSound={() => {
            const next = !profile.soundEnabled;
            updateProfile({ soundEnabled: next });
            audioEngine.updateVolumes(profile.musicEnabled, profile.musicVolume, next, profile.sfxVolume);
          }}
          onSfxVolume={(vol) => {
            updateProfile({ sfxVolume: vol });
            audioEngine.updateVolumes(profile.musicEnabled, profile.musicVolume, profile.soundEnabled, vol);
          }}
          onSelectHitSfx={(mode) => {
            updateProfile({ hitSfxMode: mode });
            audioEngine.playHit(true, mode, 2, true, activeSong.scaleNotes);
          }}
          onSelectTheme={(tid) => updateProfile({ theme: tid })}
          onSelectBgFx={(mode) => updateProfile({ bgFxMode: mode })}
          onOpenShop={() => {
            setPreviousScreen('SETTINGS');
            setScreen('SHOP');
          }}
          onDevUnlock={(code) => {
            if (code.trim() === DEV_PASSCODE) {
              updateProfile({ devUnlocked: true });
              return true;
            }
            return false;
          }}
          onResetCareer={() => {
            updateProfile({ ...INITIAL_PROFILE });
            setScreen('TITLE');
          }}
          onResetDefaults={() => {
            updateProfile((prev) => ({
              ...prev,
              trigger1Code: INITIAL_PROFILE.trigger1Code,
              trigger1Label: INITIAL_PROFILE.trigger1Label,
              trigger2Code: INITIAL_PROFILE.trigger2Code,
              trigger2Label: INITIAL_PROFILE.trigger2Label,
              allowPointerTap: INITIAL_PROFILE.allowPointerTap,
              musicEnabled: INITIAL_PROFILE.musicEnabled,
              musicVolume: INITIAL_PROFILE.musicVolume,
              soundEnabled: INITIAL_PROFILE.soundEnabled,
              sfxVolume: INITIAL_PROFILE.sfxVolume,
              hitSfxMode: INITIAL_PROFILE.hitSfxMode,
              audioOffsetMs: INITIAL_PROFILE.audioOffsetMs,
              bgFxMode: INITIAL_PROFILE.bgFxMode,
              theme: INITIAL_PROFILE.theme,
              equippedMods: [],
            }));
          }}
          onTestTick={() => audioEngine.playUiTick(profile.soundEnabled)}
        />
      )}

      {screen === 'INDEX' && (
        <IndexScreen
          profile={profile}
          songs={songs}
          onBack={() => setScreen('TITLE')}
          onLaunchSandbox={(modeId) => {
            setScreen('PLAYING');
            resetRound(true, modeId);
          }}
        />
      )}

      {screen === 'SHOP' && (
        <OrbShopScreen
          profile={profile}
          songs={songs}
          onBack={exitSubScreen}
          onUnlockDifficulty={handleUnlockDifficulty}
          onUnlockSong={handleUnlockSong}
          onUnlockTheme={handleUnlockTheme}
          onEquipTheme={(themeId) => {
            updateProfile({ theme: themeId });
            audioEngine.playHit(profile.soundEnabled, profile.hitSfxMode, 2, true, activeSong.scaleNotes);
          }}
          onUnlockMod={handleUnlockMod}
          onToggleEquipMod={handleToggleMod}
        />
      )}

      {screen === 'SONG_SELECT' && (
        <SongSelectScreen
          profile={profile}
          songs={songs}
          customAudioStatus={customAudioStatus}
          onBackToTitle={() => {
            audioEngine.stop();
            setScreen('TITLE');
          }}
          onPreviewSong={(id) => previewSong(id, true)}
          onRandomSong={() => {
            const pool = songs.filter(
              (s) => profile.devUnlocked || s.orbCost === 0 || profile.unlockedSongs.includes(s.id),
            );
            if (pool.length === 0) return;
            const pick = pool[Math.floor(Math.random() * pool.length)];
            previewSong(pick.id, true);
          }}
          onToggleMusic={() => {
            const next = !profile.musicEnabled;
            updateProfile({ musicEnabled: next });
            audioEngine.updateVolumes(next, profile.musicVolume, profile.soundEnabled, profile.sfxVolume);
            if (!next) audioEngine.stop();
            else previewSong(activeSong.id, true);
          }}
          onSelectDifficulty={(diffId) => {
            updateProfile({ selectedDifficulty: diffId });
          }}
          onStartGame={() => {
            launchWithWarp(activeSong, activeDifficulty);
          }}
          onOpenMods={openMods}
          onOpenOrbVault={openShopScreen}
          onUnlockDifficulty={handleUnlockDifficulty}
          onUnlockSong={handleUnlockSong}
          onUpdateLevelBg={(songId, patch) => {
            updateProfile((prev) => ({
              ...prev,
              levelBgSettings: {
                ...prev.levelBgSettings,
                [songId]: {
                  ...(prev.levelBgSettings[songId] || { dimPct: 64, blurPx: 3 }),
                  ...patch,
                },
              },
            }));
          }}
          onResetLevelBg={(songId) => {
            updateProfile((prev) => {
              const next = { ...prev.levelBgSettings };
              delete next[songId];
              return { ...prev, levelBgSettings: next };
            });
          }}
          onUploadCustomAudio={handleUploadCustomAudio}
        />
      )}

      {screen === 'PLAYING' && (
        <>
          <TopBar
            activeSong={activeSong}
            activeDifficulty={activeDifficulty}
            equippedModsCount={profile.equippedMods.length}
            beatLedIndex={uiBeatLed}
            songTimerText={songTimerText}
            songProgressPct={songProgressPct}
            onBackToSongSelect={enterSongSelect}
            onOpenMods={openMods}
            onOpenPause={() => openPause('main')}
          />

          <OrbitStage
            renderStateRef={canvasStateRef}
            phase={uiPhase}
            themeId={profile.theme}
            bgFxMode={profile.bgFxMode}
            allowPointerTap={profile.allowPointerTap}
            onTriggerPress={handleTriggerPress}
            onTriggerRelease={handleTriggerRelease}
            score={uiScore}
            hp={uiHp}
            streak={uiStreak}
            bestScore={profile.bestScore}
            accuracyPct={uiAccuracy}
            unbankedOrbs={uiUnbankedOrbs}
            streakMult={streakMult}
            totalMult={totalMult}
            modeName={activeModeInfo.name}
            modeColor={activeModeInfo.color}
            shields={uiShields}
            noFailActive={profile.equippedMods.includes('NF')}
            isTutorialRun={uiIsTutorialRun}
            tutorialLives={uiTutorialLives}
            activeLesson={uiActiveLesson}
            showTutorialCompleteStripe={showTutorialCompleteStripe}
            promptHint={promptHint}
            trigger1Code={profile.trigger1Code}
            trigger1Label={profile.trigger1Label}
            trigger2Code={profile.trigger2Code}
            trigger2Label={profile.trigger2Label}
            onSkipTutorial={() => {
              engineRef.current.tutorialGuideDisabled = true;
              engineRef.current.lessonSlowActive = false;
              engineRef.current.activeLesson = null;
              engineRef.current.dialTimeScale = 1.0;
              setUiActiveLesson(null);
            }}
          />
        </>
      )}

      {/* Right-Side In-Round Pause & Settings Drawer */}
      <PauseDrawer
        open={pauseOpen}
        activeTab={pauseTab}
        onChangeTab={setPauseTab}
        profile={profile}
        songTitle={activeSong.title}
        listeningSlot={listeningSlot}
        onStartRebind={(slot) => setListeningSlot(slot)}
        onResume={() => closePause(false)}
        onRetryRound={() => {
          setPauseOpen(false);
          resetRound(true, engineRef.current.sandboxModeId);
        }}
        onGoToSongSelect={enterSongSelect}
        onGoToTitle={() => {
          setPauseOpen(false);
          audioEngine.stop();
          setScreen('TITLE');
        }}
        onOpenOrbVault={openShopScreen}
        onTogglePointer={() => updateProfile({ allowPointerTap: !profile.allowPointerTap })}
        onUpdateAudioOffset={(ms) => updateProfile({ audioOffsetMs: ms })}
        onToggleMusic={() => {
          const next = !profile.musicEnabled;
          updateProfile({ musicEnabled: next });
          audioEngine.updateVolumes(next, profile.musicVolume, profile.soundEnabled, profile.sfxVolume);
        }}
        onMusicVolume={(vol) => {
          updateProfile({ musicVolume: vol });
          audioEngine.updateVolumes(profile.musicEnabled, vol, profile.soundEnabled, profile.sfxVolume);
        }}
        onToggleSound={() => {
          const next = !profile.soundEnabled;
          updateProfile({ soundEnabled: next });
          audioEngine.updateVolumes(profile.musicEnabled, profile.musicVolume, next, profile.sfxVolume);
        }}
        onSfxVolume={(vol) => {
          updateProfile({ sfxVolume: vol });
          audioEngine.updateVolumes(profile.musicEnabled, profile.musicVolume, profile.soundEnabled, vol);
        }}
        onSelectHitSfx={(mode) => {
          updateProfile({ hitSfxMode: mode });
          audioEngine.playHit(true, mode, 2, true, activeSong.scaleNotes);
        }}
        onSelectTheme={(tid) => updateProfile({ theme: tid })}
        onSelectBgFx={(mode) => updateProfile({ bgFxMode: mode })}
      />

      <ModDrawer
        open={modsOpen}
        equippedMods={profile.equippedMods}
        purchasedMods={profile.purchasedMods}
        totalHits={profile.totalHits}
        devUnlocked={profile.devUnlocked}
        activeDifficulty={activeDifficulty}
        onToggleMod={handleToggleMod}
        onClearMods={() => updateProfile({ equippedMods: [] })}
        onOpenShop={openShopScreen}
        onClose={closeMods}
      />

      <RunSummaryModal
        summary={uiPhase === 'SUMMARY' ? summaryData : null}
        onRetry={() => resetRound(true, engineRef.current.sandboxModeId)}
        onOpenSongSelect={enterSongSelect}
        onOpenOrbVault={() => {
          setSummaryData(null);
          openShopScreen();
        }}
      />

      <ZoomWarpTransition active={Boolean(warpLaunchLabel)} label={warpLaunchLabel || ''} />
    </div>
  );
}
