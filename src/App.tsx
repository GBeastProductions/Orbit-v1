import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audioEngine } from './audio/audioEngine';
import { BackgroundBackdrop } from './components/BackgroundBackdrop';
import { ZoomWarpTransition } from './components/LazerChrome';
import { ModDrawer } from './components/ModDrawer';
import { CanvasRenderState, OrbitStage } from './components/OrbitStage';
import { OrbShopModal } from './components/OrbShopModal';
import { PausePanel } from './components/PausePanel';
import { RunSummaryModal } from './components/RunSummaryModal';
import { SongSelectScreen } from './components/SongSelectScreen';
import { TitleScreen } from './components/TitleScreen';
import { TopBar } from './components/TopBar';
import {
  CHASSIS_THEMES,
  DEV_PASSCODE,
  DIFFICULTIES,
  HERO_DISCO_IMAGE,
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
  LevelBackgroundSetting,
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
  const [customAudioStatus, setCustomAudioStatus] = useState('');
  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseTab, setPauseTab] = useState<PauseTabId>('main');
  const [modsOpen, setModsOpen] = useState(false);
  const [orbShopOpen, setOrbShopOpen] = useState(false);
  const [mustChooseTrack, setMustChooseTrack] = useState(false);
  const [listeningSlot, setListeningSlot] = useState<0 | 1 | 2>(0);
  const [summaryData, setSummaryData] = useState<RunSummaryData | null>(null);
  const [showTutorialCompleteStripe, setShowTutorialCompleteStripe] = useState(false);
  const [warpLaunchLabel, setWarpLaunchLabel] = useState<string | null>(null);
  const warpTimersRef = useRef<number[]>([]);

  const [uiScore, setUiScore] = useState(0);
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
  const orbShopOpenRef = useRef(orbShopOpen);
  orbShopOpenRef.current = orbShopOpen;
  const phaseBeforeOverlayRef = useRef<GamePhase>('IDLE');
  const lastInputTimestampRef = useRef(0);
  const lastTutorialStripeRef = useRef(false);

  const engineRef = useRef<RuntimeEngine>({
    phase: 'IDLE',
    score: 0,
    streak: 0,
    maxStreakInRun: 0,
    unbankedOrbs: 0,
    shields: 0,
    spinnerAngle: -Math.PI / 2,
    direction: 1,
    baseAngularSpeed: 1.5,
    angularSpeed: 1.5,
    waveModeId: 'CW_GREEN',
    waveIndex: 0,
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
  });

  const canvasStateRef = useRef<CanvasRenderState>({
    phase: 'IDLE',
    spinnerAngle: -Math.PI / 2,
    direction: 1,
    angularSpeed: 1.5,
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
    lessonSlowActive: false,
    activeLesson: null,
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

  const flushRunProfileDeltas = useCallback(() => {
    const eng = engineRef.current;
    if (
      eng.pendingHits === 0 &&
      eng.pendingPerfects === 0 &&
      eng.pendingMisses === 0 &&
      eng.pendingOffsetDegSum === 0
    ) {
      return;
    }
    const hits = eng.pendingHits;
    const perfects = eng.pendingPerfects;
    const offsetSum = eng.pendingOffsetDegSum;
    const misses = eng.pendingMisses;
    const early = eng.pendingEarlyMisses;
    const late = eng.pendingLateMisses;
    eng.pendingHits = 0;
    eng.pendingPerfects = 0;
    eng.pendingOffsetDegSum = 0;
    eng.pendingMisses = 0;
    eng.pendingEarlyMisses = 0;
    eng.pendingLateMisses = 0;

    updateProfile((prev) => ({
      ...prev,
      totalHits: prev.totalHits + hits,
      totalPerfects: prev.totalPerfects + perfects,
      offsetDegSum: prev.offsetDegSum + offsetSum,
      totalMisses: prev.totalMisses + misses,
      earlyMisses: prev.earlyMisses + early,
      lateMisses: prev.lateMisses + late,
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

  const computeAngularSpeed = useCallback(
    (diffId: DifficultyId, mods: ModCode[], stepSec: number, modeId: WaveModeId) => {
      const diff = DIFFICULTIES[diffId] || DIFFICULTIES.CHILL;
      let speed = diff.baseSpeed;
      if (mods.includes('DT')) speed *= 1.18;
      if (mods.includes('EZ')) speed *= 0.88;
      if (modeId === 'PURPLE_SURGE') speed *= 1.38;
      if (stepSec > 0) {
        const beatFit = Math.max(1.2, Math.min(4.6, 2.35 / Math.max(0.32, stepSec)));
        speed = speed * 0.55 + beatFit * 0.45;
      }
      return speed;
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
      const cashedOutOrbs = cashOutApproved ? eng.unbankedOrbs + rankBonusOrbs : 0;

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

      const nextOrbs = p.orbs + cashedOutOrbs;
      const nextTotalOrbs = p.totalOrbsEarned + cashedOutOrbs;
      const nextTutorialDone =
        p.tutorialSongCompleted ||
        (cleared && song.id === 'moments_passing' && !eng.sandboxModeId);

      if (cleared) {
        audioEngine.playLevelClear(p.soundEnabled);
      }

      const hitsDelta = eng.pendingHits;
      const perfectsDelta = eng.pendingPerfects;
      const offsetDelta = eng.pendingOffsetDegSum;
      const missesDelta = eng.pendingMisses;
      const earlyDelta = eng.pendingEarlyMisses;
      const lateDelta = eng.pendingLateMisses;
      eng.pendingHits = 0;
      eng.pendingPerfects = 0;
      eng.pendingOffsetDegSum = 0;
      eng.pendingMisses = 0;
      eng.pendingEarlyMisses = 0;
      eng.pendingLateMisses = 0;

      updateProfile((prev) => ({
        ...prev,
        tutorialSongCompleted: nextTutorialDone,
        orbs: nextOrbs,
        totalOrbsEarned: nextTotalOrbs,
        songRecords: nextRecords,
        tierBestScores: nextTierBests,
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
        cashedOutOrbs,
        cashOutApproved,
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

      let note: BeatmapNote | null = null;
      if (eng.phase === 'PLAYING' && !eng.sandboxModeId) {
        if (eng.beatmapIndex < eng.beatmap.length) {
          note = eng.beatmap[eng.beatmapIndex];
          eng.beatmapIndex += 1;
          eng.songSection = note.section;
          setUiSection(note.section);
        } else {
          finalizeRunSummary(true);
          return;
        }
      }

      const modeId: WaveModeId = overrideMode || (note ? note.modeId : 'CW_GREEN');
      eng.waveModeId = modeId;
      eng.waveElapsed = 0;
      eng.hazards = [];
      eng.portal = null;
      setUiWaveMode(modeId);

      if (modeId === 'CCW_RED') eng.direction = -1;
      else if (modeId === 'CW_GREEN') eng.direction = 1;

      eng.baseAngularSpeed = computeAngularSpeed(
        diffId,
        p.equippedMods,
        note ? note.stepSec : 0.9,
        modeId,
      );
      eng.angularSpeed = eng.baseAngularSpeed;

      const baseHW = getBaseHalfWidth(diffId, p.equippedMods);
      let primaryOffset: number;
      if (modeId === 'CASCADE_CHAIN') {
        primaryOffset = 1.05 + Math.random() * 0.65;
      } else if (note && !eng.sandboxModeId) {
        const beatTravel = note.stepSec * eng.baseAngularSpeed;
        primaryOffset = Math.max(1.0, Math.min(5.05, beatTravel * (0.94 + Math.random() * 0.12)));
      } else {
        const minOff = isFirstNote ? 1.65 : 1.45;
        primaryOffset = minOff + Math.random() * (4.55 - minOff);
      }
      const primaryAngle = wrapAngle(eng.spinnerAngle + eng.direction * primaryOffset);

      if (modeId === 'MULTI_CLUSTER') {
        const secondAngle = wrapAngle(primaryAngle + eng.direction * 1.5);
        eng.targets = [
          {
            id: 1,
            angle: primaryAngle,
            baseAngle: primaryAngle,
            halfWidth: baseHW * 0.9,
            initialHalfWidth: baseHW * 0.9,
            tapsLeft: 1,
            seqNum: 0,
            alpha: 1,
            enteredWindow: false,
          },
          {
            id: 2,
            angle: secondAngle,
            baseAngle: secondAngle,
            halfWidth: baseHW * 0.9,
            initialHalfWidth: baseHW * 0.9,
            tapsLeft: 1,
            seqNum: 0,
            alpha: 1,
            enteredWindow: false,
          },
        ];
      } else if (modeId === 'ORDERED_SEQ') {
        const a1 = wrapAngle(eng.spinnerAngle + eng.direction * 1.35);
        const a2 = wrapAngle(a1 + eng.direction * 1.35);
        const a3 = wrapAngle(a2 + eng.direction * 1.35);
        const hw = baseHW * 0.85;
        eng.targets = [
          { id: 1, angle: a1, baseAngle: a1, halfWidth: hw, initialHalfWidth: hw, tapsLeft: 1, seqNum: 1, alpha: 1, enteredWindow: false },
          { id: 2, angle: a2, baseAngle: a2, halfWidth: hw, initialHalfWidth: hw, tapsLeft: 1, seqNum: 2, alpha: 1, enteredWindow: false },
          { id: 3, angle: a3, baseAngle: a3, halfWidth: hw, initialHalfWidth: hw, tapsLeft: 1, seqNum: 3, alpha: 1, enteredWindow: false },
        ];
      } else if (modeId === 'OSU_PORTAL') {
        const entryA = wrapAngle(eng.spinnerAngle + eng.direction * 1.4);
        const exitA = wrapAngle(entryA + Math.PI);
        const targetA = wrapAngle(exitA + eng.direction * 1.35);
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
          },
        ];
      } else {
        const hw =
          modeId === 'SNIPER_MICRO'
            ? Math.max(0.1, baseHW * 0.58)
            : modeId === 'DECAY_ARC'
            ? baseHW * 1.18
            : baseHW;
        eng.targets = [
          {
            id: 1,
            angle: primaryAngle,
            baseAngle: primaryAngle,
            halfWidth: hw,
            initialHalfWidth: hw,
            tapsLeft: modeId === 'DOUBLE_TAP' ? 2 : 1,
            seqNum: 0,
            alpha: 1,
            enteredWindow: false,
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
    [computeAngularSpeed, finalizeRunSummary, getActiveSong, getBaseHalfWidth, getEffectiveDifficulty],
  );

  const resetRound = useCallback(
    (autoStart: boolean, sandboxMode: WaveModeId | null = null) => {
      const eng = engineRef.current;
      const p = profileRef.current;
      const song = getActiveSong(p);
      const diffId = getEffectiveDifficulty(p, song);

      eng.score = 0;
      eng.streak = 0;
      eng.maxStreakInRun = 0;
      eng.unbankedOrbs = 0;
      eng.shields = p.equippedMods.includes('SH') ? 1 : 0;
      eng.spinnerAngle = -Math.PI / 2;
      eng.direction = 1;
      eng.waveIndex = 0;
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
    (reasonText: string, targetRef?: TargetSector) => {
      const eng = engineRef.current;
      const p = profileRef.current;

      if (eng.lessonSlowActive) {
        eng.lessonSlowActive = false;
        eng.activeLesson = null;
        eng.dialTimeScale = 1.0;
        setUiActiveLesson(null);
      }

      if (eng.shields > 0) {
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

      if (eng.isTutorialRun) {
        eng.tutorialLives -= 1;
        setUiTutorialLives(eng.tutorialLives);
        if (eng.tutorialLives > 0) {
          eng.streak = 0;
          eng.missCount += 1;
          setUiStreak(0);
          setUiAccuracy(computeCurrentAccuracy(eng));
          eng.shakeTime = 0.28;
          eng.shakeAmplitude = 9;
          eng.hubStatusText = `${eng.tutorialLives} LIVES`;
          eng.hubStatusColor = '#f59e0b';
          eng.hubStatusTimer = 0.85;
          audioEngine.playShieldBreak(p.soundEnabled);
          spawnNextWave(false, null);
          return;
        }
      }

      audioEngine.playMiss(p.soundEnabled);
      eng.missCount += 1;
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

      eng.missReason = reasonText;
      eng.shakeTime = 0.34;
      eng.shakeAmplitude = 11;

      orbitEvents.emit('onMiss', {
        reason: reasonText,
        degrees: eng.missDegrees,
        songId: getActiveSong(p).id,
      });

      finalizeRunSummary(false);
    },
    [finalizeRunSummary, getActiveSong, spawnNextWave],
  );

  const handleTriggerAction = useCallback(() => {
    if (screenRef.current !== 'PLAYING') return;
    if (pauseOpenRef.current || modsOpenRef.current || orbShopOpenRef.current) return;

    const nowMs = performance.now();
    if (nowMs - lastInputTimestampRef.current < 18) return;
    lastInputTimestampRef.current = nowMs;

    const eng = engineRef.current;
    const p = profileRef.current;
    if (eng.phase === 'IDLE' || eng.phase === 'SUMMARY') {
      audioEngine.ensureContext();
      resetRound(true, eng.sandboxModeId);
      return;
    }
    if (eng.phase !== 'PLAYING') return;

    for (let i = 0; i < eng.hazards.length; i++) {
      const h = eng.hazards[i];
      if (Math.abs(signedAngleDiff(eng.spinnerAngle, h.angle)) <= h.halfWidth + 0.01) {
        triggerMiss('HAZARD HIT', eng.targets[0]);
        return;
      }
    }

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
      const dirErr = nearest ? signedAngleDiff(eng.spinnerAngle, nearest.angle) * eng.direction : 0;
      triggerMiss(dirErr < 0 ? 'TOO EARLY' : 'TOO LATE', nearest);
      return;
    }

    const hitTarget = eng.targets[matchedIdx];
    if (eng.waveModeId === 'ORDERED_SEQ' && matchedIdx !== 0) {
      triggerMiss('WRONG ORDER', hitTarget);
      return;
    }

    if (eng.lessonSlowActive) {
      eng.lessonSlowActive = false;
      eng.activeLesson = null;
      eng.dialTimeScale = 1.0;
      setUiActiveLesson(null);
    }

    const ratio = bestAbsDelta / Math.max(0.01, hitTarget.halfWidth);
    const tier: JudgmentTier = ratio <= 0.24 ? 'PERFECT' : ratio <= 0.62 ? 'GREAT' : 'GOOD';
    const isPerfect = tier === 'PERFECT';
    const fxColor = tier === 'PERFECT' ? '#ffffff' : tier === 'GREAT' ? '#34d399' : '#22d3ee';

    const signedErr = signedAngleDiff(eng.spinnerAngle, hitTarget.angle) * eng.direction;
    const offsetSigned = Math.max(
      -1,
      Math.min(1, signedErr / Math.max(0.05, hitTarget.halfWidth + NEEDLE_TOLERANCE)),
    );
    eng.hitErrorTicks.push({ offsetSigned, color: fxColor, age: 0 });
    if (eng.hitErrorTicks.length > 16) eng.hitErrorTicks.shift();

    const song = getActiveSong(p);
    const diffId = getEffectiveDifficulty(p, song);

    if (hitTarget.tapsLeft > 1) {
      hitTarget.tapsLeft -= 1;
      hitTarget.halfWidth *= 0.85;
      audioEngine.playHit(p.soundEnabled, p.hitSfxMode, eng.streak, isPerfect, song.scaleNotes);
      eng.hitEffects.push({
        timer: 0.34,
        duration: 0.34,
        angle: eng.spinnerAngle,
        isPerfect,
        label: 'TAP AGAIN',
        color: '#22d3ee',
      });
      eng.hubStatusText = 'TAP AGAIN';
      eng.hubStatusColor = '#22d3ee';
      eng.hubStatusTimer = 0.35;
      return;
    }

    eng.targets.splice(matchedIdx, 1);
    eng.streak += 1;
    eng.maxStreakInRun = Math.max(eng.maxStreakInRun, eng.streak);

    const pts = computeHitPoints(tier, diffId, p.equippedMods, eng.streak);
    eng.score += pts;

    if (tier === 'PERFECT') {
      eng.perfectCount += 1;
      if (!eng.sandboxModeId) {
        eng.unbankedOrbs += 1;
        setUiUnbankedOrbs(eng.unbankedOrbs);
      }
    } else if (tier === 'GREAT') {
      eng.greatCount += 1;
    } else {
      eng.goodCount += 1;
    }

    const offsetDeg = bestAbsDelta * (180 / Math.PI);
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
      timer: 0.42,
      duration: 0.42,
      angle: eng.spinnerAngle,
      isPerfect,
      label: isPerfect && !eng.sandboxModeId ? `${tier} +${pts} (+1 Orb)` : `${tier} +${pts}`,
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

    if (eng.targets.length > 0) return;

    eng.waveIndex += 1;
    spawnNextWave(false, eng.sandboxModeId);
  }, [
    getActiveSong,
    getEffectiveDifficulty,
    resetRound,
    spawnNextWave,
    triggerMiss,
  ]);

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
          if (
            eng.isTutorialRun &&
            !eng.tutorialGuideDisabled &&
            !eng.lessonSlowActive &&
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
              const signedAhead = signedAngleDiff(t0.angle, eng.spinnerAngle) * eng.direction;
              if (signedAhead > 0.15 && signedAhead < 0.92) {
                eng.shownLessonIds.add(nextLesson.id);
                eng.lessonSlowActive = true;
                eng.activeLesson = nextLesson;
                eng.dialTimeScale = 0.28;
                audioEngine.playLessonSlowCue(p.soundEnabled);
                setUiActiveLesson(nextLesson);
              }
            }
          }

          const targetDialScale = eng.lessonSlowActive ? 0.28 : 1.0;
          eng.dialTimeScale += (targetDialScale - eng.dialTimeScale) * Math.min(1, dt * 10);
          const simDt = dt * eng.dialTimeScale;
          eng.waveElapsed += simDt;

          if (eng.waveModeId === 'BRAKE_DRIFT') {
            const mod = 0.55 + 0.65 * Math.abs(Math.sin(eng.waveElapsed * 3.4));
            eng.angularSpeed = eng.baseAngularSpeed * mod;
          } else {
            eng.angularSpeed = eng.baseAngularSpeed;
          }

          for (let i = 0; i < eng.targets.length; i++) {
            const t = eng.targets[i];
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
                : eng.targets;
            for (let i = 0; i < targetsToCheck.length; i++) {
              const t = targetsToCheck[i];
              const overNow =
                Math.abs(signedAngleDiff(eng.spinnerAngle, t.angle)) <= t.halfWidth + NEEDLE_TOLERANCE;
              if (overNow) {
                t.enteredWindow = true;
              } else if (t.enteredWindow) {
                triggerMiss('OVERSHOT ONE-PASS', t);
                break;
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
      cs.lessonSlowActive = eng.lessonSlowActive;
      cs.activeLesson = eng.activeLesson;

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [finalizeRunSummary, getActiveSong, triggerMiss]);

  // Overlay Management
  const openPause = useCallback(
    (tab: PauseTabId = 'main') => {
      flushRunProfileDeltas();
      setModsOpen(false);
      setOrbShopOpen(false);
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
      setMustChooseTrack(false);
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
    [getActiveSong, mustChooseTrack, resetRound],
  );

  const openMods = useCallback(() => {
    flushRunProfileDeltas();
    setPauseOpen(false);
    setOrbShopOpen(false);
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

  const openOrbVault = useCallback(() => {
    flushRunProfileDeltas();
    setPauseOpen(false);
    setModsOpen(false);
    if (!orbShopOpenRef.current) {
      phaseBeforeOverlayRef.current =
        screenRef.current === 'PLAYING' ? engineRef.current.phase : 'IDLE';
      if (screenRef.current === 'PLAYING' && engineRef.current.phase === 'PLAYING') {
        engineRef.current.phase = 'PAUSED';
        setUiPhase('PAUSED');
        audioEngine.stop();
      }
    }
    setOrbShopOpen(true);
  }, [flushRunProfileDeltas]);

  const closeOrbVault = useCallback(() => {
    setOrbShopOpen(false);
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

  // Global Keyboard Shortcuts
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
        if (orbShopOpenRef.current) closeOrbVault();
        else if (modsOpenRef.current) closeMods();
        else if (pauseOpenRef.current) closePause(false);
        else if (screenRef.current === 'PLAYING') openPause('main');
        else if (screenRef.current === 'SONG_SELECT') {
          audioEngine.stop();
          setScreen('TITLE');
        }
        return;
      }

      if (pauseOpenRef.current || modsOpenRef.current || orbShopOpenRef.current) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (screenRef.current !== 'PLAYING') return;

      const p = profileRef.current;
      if (e.code === p.trigger1Code || e.code === p.trigger2Code) {
        e.preventDefault();
        handleTriggerAction();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    closeMods,
    closeOrbVault,
    closePause,
    getActiveSong,
    handleTriggerAction,
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
    setOrbShopOpen(false);
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
          onOpenOrbVault={openOrbVault}
          onOpenSettings={() => openPause('ctrl')}
          onOpenIndex={() => openPause('index')}
          onToggleMusic={() => {
            const next = !profile.musicEnabled;
            updateProfile({ musicEnabled: next });
            audioEngine.updateVolumes(next, profile.musicVolume, profile.soundEnabled, profile.sfxVolume);
          }}
          onHoverTick={() => audioEngine.playUiTick(profile.soundEnabled)}
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
            const pool = songs.filter((s) => profile.devUnlocked || s.orbCost === 0 || profile.unlockedSongs.includes(s.id));
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
          onOpenOrbVault={openOrbVault}
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
            onTriggerTap={handleTriggerAction}
            score={uiScore}
            streak={uiStreak}
            bestScore={profile.bestScore}
            accuracyPct={uiAccuracy}
            unbankedOrbs={uiUnbankedOrbs}
            streakMult={streakMult}
            totalMult={totalMult}
            modeName={activeModeInfo.name}
            modeColor={activeModeInfo.color}
            shields={uiShields}
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

      <PausePanel
        open={pauseOpen}
        activeTab={pauseTab}
        onChangeTab={setPauseTab}
        mustChooseTrack={mustChooseTrack}
        profile={profile}
        listeningSlot={listeningSlot}
        onStartRebind={(slot) => setListeningSlot(slot)}
        onResume={() => closePause(false)}
        onGoToSongSelect={enterSongSelect}
        onGoToTitle={() => {
          setPauseOpen(false);
          audioEngine.stop();
          setScreen('TITLE');
        }}
        onOpenOrbVault={openOrbVault}
        onTogglePointer={() => updateProfile({ allowPointerTap: !profile.allowPointerTap })}
        onReplayTutorial={() => {
          setPauseOpen(false);
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
        onDevUnlock={(code) => {
          if (code.trim() === DEV_PASSCODE) {
            updateProfile({ devUnlocked: true });
            return true;
          }
          return false;
        }}
        onResetCareer={() => {
          setPauseOpen(false);
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
        onTestWaveSandbox={(modeId) => {
          setMustChooseTrack(false);
          setPauseOpen(false);
          setScreen('PLAYING');
          resetRound(true, modeId);
        }}
      />

      <ModDrawer
        open={modsOpen}
        equippedMods={profile.equippedMods}
        totalHits={profile.totalHits}
        devUnlocked={profile.devUnlocked}
        activeDifficulty={activeDifficulty}
        onToggleMod={(code) => {
          const cur = profile.equippedMods;
          const next = cur.includes(code)
            ? cur.filter((c) => c !== code)
            : cur.length < 3
            ? [...cur, code]
            : cur;
          updateProfile({ equippedMods: next });
        }}
        onClearMods={() => updateProfile({ equippedMods: [] })}
        onClose={closeMods}
      />

      <OrbShopModal
        open={orbShopOpen}
        profile={profile}
        songs={songs}
        onUnlockDifficulty={handleUnlockDifficulty}
        onUnlockSong={handleUnlockSong}
        onUnlockTheme={handleUnlockTheme}
        onEquipTheme={(themeId) => {
          updateProfile({ theme: themeId });
          audioEngine.playHit(profile.soundEnabled, profile.hitSfxMode, 2, true, activeSong.scaleNotes);
        }}
        onClose={closeOrbVault}
      />

      <RunSummaryModal
        summary={uiPhase === 'SUMMARY' ? summaryData : null}
        onRetry={() => resetRound(true, engineRef.current.sandboxModeId)}
        onOpenSongSelect={enterSongSelect}
        onOpenOrbVault={() => {
          setSummaryData(null);
          openOrbVault();
        }}
      />

      <ZoomWarpTransition active={Boolean(warpLaunchLabel)} label={warpLaunchLabel || ''} />
    </div>
  );
}
