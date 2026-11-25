import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Coins, Home, Play, RotateCcw, X } from 'lucide-react';
import { CHASSIS_THEMES, WAVE_MODES } from '../data/catalog';
import {
  BgFxMode,
  HitSfxMode,
  PauseTabId,
  PlayerProfile,
  ThemeId,
  WaveModeId,
} from '../types/game';
import { ArcadeSwitch } from './LazerChrome';

interface PausePanelProps {
  open: boolean;
  activeTab: PauseTabId;
  onChangeTab: (tab: PauseTabId) => void;
  mustChooseTrack: boolean;
  profile: PlayerProfile;
  listeningSlot: 0 | 1 | 2;
  onStartRebind: (slot: 1 | 2) => void;
  onResume: () => void;
  onGoToSongSelect: () => void;
  onGoToTitle: () => void;
  onOpenOrbVault: () => void;
  onTogglePointer: () => void;
  onReplayTutorial: () => void;
  onUpdateAudioOffset: (ms: number) => void;
  onToggleMusic: () => void;
  onMusicVolume: (vol: number) => void;
  onToggleSound: () => void;
  onSfxVolume: (vol: number) => void;
  onSelectHitSfx: (mode: HitSfxMode) => void;
  onSelectTheme: (theme: ThemeId) => void;
  onSelectBgFx: (mode: BgFxMode) => void;
  onDevUnlock: (code: string) => boolean;
  onResetCareer: () => void;
  onResetDefaults: () => void;
  onTestWaveSandbox: (modeId: WaveModeId) => void;
}

const TAB_ITEMS: { id: PauseTabId; label: string }[] = [
  { id: 'main', label: 'Overview' },
  { id: 'ctrl', label: 'Controls' },
  { id: 'audio', label: 'Audio' },
  { id: 'disp', label: 'Display & Themes' },
  { id: 'index', label: 'Wave Guide' },
];

export const PausePanel: React.FC<PausePanelProps> = ({
  open,
  activeTab,
  onChangeTab,
  mustChooseTrack,
  profile,
  listeningSlot,
  onStartRebind,
  onResume,
  onGoToSongSelect,
  onGoToTitle,
  onOpenOrbVault,
  onTogglePointer,
  onReplayTutorial,
  onUpdateAudioOffset,
  onToggleMusic,
  onMusicVolume,
  onToggleSound,
  onSfxVolume,
  onSelectHitSfx,
  onSelectTheme,
  onSelectBgFx,
  onDevUnlock,
  onResetCareer,
  onResetDefaults,
  onTestWaveSandbox,
}) => {
  const [passInput, setPassInput] = useState('');
  const [passStatus, setPassStatus] = useState('');

  if (!open) return null;

  const avgAccuracy =
    profile.totalHits + profile.totalMisses > 0
      ? (profile.totalHits / (profile.totalHits + profile.totalMisses)) * 100
      : 100;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pausePanelTitle"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/82 p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="flex max-h-[86dvh] w-full max-w-3xl flex-col border border-white/15 bg-[#0b0e16] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-[#121624] px-6 py-4">
          <div>
            <h2
              id="pausePanelTitle"
              className="font-display text-lg font-extrabold tracking-tight text-white"
            >
              Cabinet Menu · 設定
            </h2>
            <p className="text-xs text-[#a1abbe]">
              Configure audio, keybinds, display themes, or practice any orbital wave mechanic.
            </p>
          </div>
          <button
            type="button"
            onClick={onResume}
            className="tactile-btn border border-white/15 bg-[#181e30] p-2 text-[#d1d5db] hover:text-white cursor-pointer"
            aria-label="Resume or Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Functional Tab Strip */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-white/10 bg-[#0e121d] px-6 py-2.5">
          {TAB_ITEMS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChangeTab(tab.id)}
                className={`tactile-btn lazer-slant-sm border px-4 py-1.5 text-xs font-bold cursor-pointer whitespace-nowrap ${
                  active
                    ? 'border-[var(--accent-bright)] bg-[var(--accent)] text-[var(--accent-on)]'
                    : 'border-white/10 bg-[#141928] text-[#a1abbe] hover:text-white'
                }`}
              >
                <span className="lazer-unslant-sm block">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="orbit-scroll flex-1 overflow-y-auto p-6">
          {activeTab === 'main' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="border border-white/10 bg-[#101420] p-3.5">
                  <span className="block text-xs text-[#a1abbe]">Best Score</span>
                  <span className="tabular-nums mt-1 block text-xl font-black text-white">
                    {profile.bestScore.toLocaleString()}
                  </span>
                </div>
                <div className="border border-white/10 bg-[#101420] p-3.5">
                  <span className="block text-xs text-[#a1abbe]">Peak Combo</span>
                  <span className="tabular-nums mt-1 block text-xl font-black text-[#22d3ee]">
                    {profile.bestStreak}x
                  </span>
                </div>
                <div className="border border-white/10 bg-[#101420] p-3.5">
                  <span className="block text-xs text-[#a1abbe]">Hit Rate</span>
                  <span className="tabular-nums mt-1 block text-xl font-black text-[#34d399]">
                    {avgAccuracy.toFixed(1)}%
                  </span>
                </div>
                <div className="border border-white/10 bg-[#101420] p-3.5">
                  <span className="block text-xs text-[#a1abbe]">Orb Balance</span>
                  <span className="tabular-nums mt-1 block text-xl font-black text-[#fbbf24]">
                    {profile.orbs.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={onResume}
                  className="tactile-btn lazer-slant-sm flex items-center border border-[var(--accent-bright)] bg-[var(--accent)] px-5 py-2.5 text-xs font-extrabold text-[var(--accent-on)] hover:bg-[var(--accent-bright)] cursor-pointer whitespace-nowrap"
                >
                  <span className="lazer-unslant-sm flex items-center gap-1.5">
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>{mustChooseTrack ? 'Close Menu' : 'Resume'}</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={onGoToSongSelect}
                  className="tactile-btn border border-white/15 bg-[#141928] px-4 py-2.5 text-xs font-bold text-white hover:border-[var(--accent-bright)] cursor-pointer whitespace-nowrap"
                >
                  Track Select
                </button>
                <button
                  type="button"
                  onClick={onOpenOrbVault}
                  className="tactile-btn flex items-center gap-1.5 border border-[#fbbf24]/40 bg-[#1c1608] px-4 py-2.5 text-xs font-bold text-[#fbbf24] hover:border-[#fbbf24] cursor-pointer whitespace-nowrap"
                >
                  <Coins className="h-3.5 w-3.5" />
                  <span>Orb Shop</span>
                </button>
                <button
                  type="button"
                  onClick={onGoToTitle}
                  className="tactile-btn flex items-center gap-1.5 border border-white/15 bg-[#141928] px-4 py-2.5 text-xs font-bold text-[#d1d5db] hover:text-white cursor-pointer whitespace-nowrap"
                >
                  <Home className="h-3.5 w-3.5" />
                  <span>Title Screen</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'ctrl' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between border border-white/10 bg-[#101420] p-4">
                  <div>
                    <span className="block text-sm font-bold text-white">Primary Trigger</span>
                    <span className="text-xs text-[#a1abbe]">Tap or hold key 1</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onStartRebind(1)}
                    className="tactile-btn border border-white/20 bg-[#171d2e] px-4 py-2 font-mono text-xs font-bold text-white hover:border-[var(--accent-bright)] cursor-pointer"
                  >
                    {listeningSlot === 1 ? 'Press Key...' : profile.trigger1Label}
                  </button>
                </div>

                <div className="flex items-center justify-between border border-white/10 bg-[#101420] p-4">
                  <div>
                    <span className="block text-sm font-bold text-white">Secondary Trigger</span>
                    <span className="text-xs text-[#a1abbe]">Alternate double-tap key</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onStartRebind(2)}
                    className="tactile-btn border border-white/20 bg-[#171d2e] px-4 py-2 font-mono text-xs font-bold text-white hover:border-[var(--accent-bright)] cursor-pointer"
                  >
                    {listeningSlot === 2 ? 'Press Key...' : profile.trigger2Label}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between border border-white/10 bg-[#101420] p-4">
                <div>
                  <span className="block text-sm font-bold text-white">Mouse / Touch Ring Tap</span>
                  <span className="text-xs text-[#a1abbe]">Allow clicking or tapping directly on the Orbit stage</span>
                </div>
                <ArcadeSwitch checked={profile.allowPointerTap} onToggle={onTogglePointer} />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={onReplayTutorial}
                  className="tactile-btn flex items-center gap-1.5 border border-white/15 bg-[#141928] px-4 py-2 text-xs font-bold text-white hover:border-[var(--accent-bright)] cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Replay Calibration Tutorial</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onResetDefaults}
                    className="tactile-btn border border-white/15 bg-[#141928] px-3.5 py-2 text-xs text-[#d1d5db] hover:text-white cursor-pointer"
                  >
                    Reset Settings
                  </button>
                  <button
                    type="button"
                    onClick={onResetCareer}
                    className="tactile-btn border border-[#ef4444]/40 bg-[#2a0c10] px-3.5 py-2 text-xs font-bold text-[#fca5a5] hover:border-[#ef4444] cursor-pointer"
                  >
                    Reset Save Data
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'audio' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border border-white/10 bg-[#101420] p-4">
                <div className="flex-1 pr-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-bold text-white">Music Volume</span>
                    <span className="tabular-nums text-xs text-[#a1abbe]">{profile.musicVolume}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={profile.musicVolume}
                    onChange={(e) => onMusicVolume(Number(e.target.value))}
                    className="w-full accent-[var(--accent)]"
                  />
                </div>
                <ArcadeSwitch checked={profile.musicEnabled} onToggle={onToggleMusic} />
              </div>

              <div className="flex items-center justify-between border border-white/10 bg-[#101420] p-4">
                <div className="flex-1 pr-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-bold text-white">Hit SFX Volume</span>
                    <span className="tabular-nums text-xs text-[#a1abbe]">{profile.sfxVolume}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={profile.sfxVolume}
                    onChange={(e) => onSfxVolume(Number(e.target.value))}
                    className="w-full accent-[var(--accent)]"
                  />
                </div>
                <ArcadeSwitch checked={profile.soundEnabled} onToggle={onToggleSound} />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="border border-white/10 bg-[#101420] p-4">
                  <span className="block text-sm font-bold text-white mb-2">Hit Sound Pack</span>
                  <div className="flex gap-2">
                    {(['switch', 'harmonic', 'rimshot'] as HitSfxMode[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => onSelectHitSfx(m)}
                        className={`tactile-btn flex-1 border py-1.5 text-xs font-bold capitalize cursor-pointer ${
                          profile.hitSfxMode === m
                            ? 'border-[var(--accent-bright)] bg-[var(--accent)] text-[var(--accent-on)]'
                            : 'border-white/12 bg-[#161b29] text-[#a1abbe]'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border border-white/10 bg-[#101420] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-white">Audio Calibration Offset</span>
                    <span className="tabular-nums text-xs font-bold text-[#22d3ee]">
                      {profile.audioOffsetMs > 0 ? `+${profile.audioOffsetMs}ms` : `${profile.audioOffsetMs}ms`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-150}
                    max={150}
                    step={5}
                    value={profile.audioOffsetMs}
                    onChange={(e) => onUpdateAudioOffset(Number(e.target.value))}
                    className="w-full accent-[var(--accent)]"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'disp' && (
            <div className="space-y-5">
              <div>
                <span className="block text-sm font-bold text-white mb-2.5">Background Effects</span>
                <div className="grid grid-cols-3 gap-2.5">
                  {(['dynamic', 'clean', 'minimal'] as BgFxMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onSelectBgFx(mode)}
                      className={`tactile-btn border py-2.5 text-xs font-bold capitalize cursor-pointer ${
                        profile.bgFxMode === mode
                          ? 'border-[var(--accent-bright)] bg-[var(--accent)] text-[var(--accent-on)]'
                          : 'border-white/12 bg-[#101420] text-[#a1abbe] hover:text-white'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-sm font-bold text-white mb-2.5">Cabinet Color Theme</span>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {(Object.keys(CHASSIS_THEMES) as ThemeId[]).map((tid) => {
                    const t = CHASSIS_THEMES[tid];
                    const owned =
                      profile.devUnlocked ||
                      t.orbCost === 0 ||
                      profile.unlockedThemes.includes(tid);
                    const active = profile.theme === tid;

                    return (
                      <button
                        key={tid}
                        type="button"
                        disabled={!owned}
                        onClick={() => onSelectTheme(tid)}
                        className={`tactile-btn flex items-center gap-2.5 border p-3 text-left cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                          active
                            ? 'border-[var(--accent-bright)] bg-[#171d2e]'
                            : 'border-white/10 bg-[#101420] hover:border-white/25'
                        }`}
                      >
                        <span
                          className="h-4 w-4 shrink-0 border border-white/25"
                          style={{ backgroundColor: t.primary }}
                        />
                        <div className="min-w-0">
                          <span className="block truncate text-xs font-bold text-white">
                            {t.label}
                          </span>
                          <span className="block truncate text-[10px] text-[#a1abbe]">
                            {owned ? t.jpLabel : `${t.orbCost} Orbs`}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-white/10 pt-4">
                <span className="block text-xs font-semibold text-[#a1abbe] mb-2">
                  Developer Unlock Passcode
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={passInput}
                    onChange={(e) => setPassInput(e.target.value)}
                    placeholder="Enter passcode..."
                    className="flex-1 border border-white/15 bg-[#07080d] px-3 py-2 text-xs text-white outline-none focus:border-[var(--accent-bright)]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const ok = onDevUnlock(passInput);
                      setPassStatus(ok ? 'All content unlocked.' : 'Invalid passcode.');
                    }}
                    className="tactile-btn border border-white/20 bg-[#171d2e] px-4 py-2 text-xs font-bold text-white hover:border-[var(--accent-bright)] cursor-pointer"
                  >
                    Unlock
                  </button>
                </div>
                {passStatus && (
                  <p className="mt-1.5 text-xs text-[#22d3ee]">{passStatus}</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'index' && (
            <div className="space-y-3">
              <p className="text-xs text-[#a1abbe]">
                Click any mechanic to test it immediately in practice sandbox mode.
              </p>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {WAVE_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => onTestWaveSandbox(mode.id)}
                    className="tactile-btn flex items-start justify-between gap-3 border border-white/10 bg-[#101420] p-3.5 text-left hover:border-white/30 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0"
                          style={{ backgroundColor: mode.color }}
                        />
                        <span className="font-display text-sm font-bold text-white">
                          {mode.name}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#a1abbe]">{mode.desc}</p>
                    </div>
                    <span className="shrink-0 text-[11px] font-bold text-[#22d3ee] whitespace-nowrap">
                      Practice →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
