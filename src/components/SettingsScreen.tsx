import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Keyboard,
  Monitor,
  RotateCcw,
  ShieldCheck,
  Volume2,
} from 'lucide-react';
import { CHASSIS_THEMES } from '../data/catalog';
import { BgFxMode, HitSfxMode, PlayerProfile, ThemeId } from '../types/game';
import { ArcadeSwitch } from './LazerChrome';
import { OrbIcon } from './OrbIcon';

type SettingsSection = 'controls' | 'audio' | 'display' | 'profile';

interface SettingsScreenProps {
  profile: PlayerProfile;
  listeningSlot: 0 | 1 | 2;
  onStartRebind: (slot: 1 | 2) => void;
  onBackToTitle: () => void;
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
  onOpenShop: () => void;
  onDevUnlock: (code: string) => boolean;
  onResetCareer: () => void;
  onResetDefaults: () => void;
  onTestTick: () => void;
}

const SECTIONS: { id: SettingsSection; label: string; sub: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: 'controls', label: 'Controls & Input', sub: 'Trigger keys & live key test', Icon: Keyboard },
  { id: 'audio', label: 'Audio & Calibration', sub: 'Volumes, hit SFX & ms offset', Icon: Volume2 },
  { id: 'display', label: 'Display & Themes', sub: 'Cabinet glow & stage FX', Icon: Monitor },
  { id: 'profile', label: 'Profile & Unlocks', sub: 'Save reset & passcode', Icon: ShieldCheck },
];

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  profile,
  listeningSlot,
  onStartRebind,
  onBackToTitle,
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
  onOpenShop,
  onDevUnlock,
  onResetCareer,
  onResetDefaults,
  onTestTick,
}) => {
  const [section, setSection] = useState<SettingsSection>('controls');
  const [pressedTest, setPressedTest] = useState<'k1' | 'k2' | null>(null);
  const [passInput, setPassInput] = useState('');
  const [passStatus, setPassStatus] = useState('');
  const [tapCalTimes, setTapCalTimes] = useState<number[]>([]);
  const tapResetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.repeat || listeningSlot !== 0) return;
      if (e.code === profile.trigger1Code) {
        setPressedTest('k1');
        onTestTick();
      } else if (e.code === profile.trigger2Code) {
        setPressedTest('k2');
        onTestTick();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === profile.trigger1Code || e.code === profile.trigger2Code) {
        setPressedTest(null);
      }
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [listeningSlot, onTestTick, profile.trigger1Code, profile.trigger2Code]);

  const handleTapCalibrate = () => {
    const now = performance.now();
    onTestTick();
    if (tapResetTimerRef.current) window.clearTimeout(tapResetTimerRef.current);
    tapResetTimerRef.current = window.setTimeout(() => setTapCalTimes([]), 2200);

    setTapCalTimes((prev) => {
      const next = [...prev, now].slice(-6);
      if (next.length >= 4) {
        const intervals: number[] = [];
        for (let i = 1; i < next.length; i++) {
          intervals.push(next[i] - next[i - 1]);
        }
        const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        // Measure deviation from 500ms (120 BPM metronome intuition) clamped nicely to -60..+60ms
        const jitter = Math.round(((avg % 500) - 250) * 0.15);
        const nudged = Math.max(-150, Math.min(150, Math.round(jitter / 5) * 5));
        onUpdateAudioOffset(nudged);
      }
      return next;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="relative z-10 flex h-dvh w-full flex-col overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#07080d]/95 via-[#090d17]/88 to-[#07080d]/95"
      />

      {/* Top 3-Zone Header */}
      <header className="relative z-20 flex h-[60px] shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-[#080a11]/92 px-4 sm:px-8">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={onBackToTitle}
            className="tactile-btn lazer-slant-sm flex items-center border border-white/15 bg-[#121624] px-3.5 py-2 text-xs font-bold text-white hover:border-[var(--accent-bright)] cursor-pointer whitespace-nowrap"
          >
            <span className="lazer-unslant-sm flex items-center gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Title</span>
            </span>
          </button>
          <div className="flex items-baseline gap-2.5 whitespace-nowrap">
            <h1 className="font-display text-lg sm:text-2xl font-black tracking-tight text-white">
              Cabinet Settings
            </h1>
            <span className="hidden sm:inline text-xs font-semibold tracking-[0.2em] text-[var(--accent-bright)]">
              システム設定
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onResetDefaults}
            className="tactile-btn lazer-slant-sm border border-white/15 bg-[#121624] px-3.5 py-2 text-xs font-semibold text-[#d1d5db] hover:border-white/35 hover:text-white cursor-pointer whitespace-nowrap"
          >
            <span className="lazer-unslant-sm block">Restore Defaults</span>
          </button>
        </div>
      </header>

      {/* Main Split Console: Left Sloped Category Rail + Right Parameter Workbench */}
      <main className="relative z-20 mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-4 overflow-hidden px-4 py-4 sm:px-8 sm:py-5 lg:grid lg:grid-cols-12 lg:gap-6">
        {/* Left Navigation Blades */}
        <nav
          aria-label="Settings Categories"
          className="flex shrink-0 flex-row gap-2 overflow-x-auto pb-1 lg:col-span-4 lg:flex-col lg:gap-3 lg:overflow-visible lg:pb-0"
        >
          {SECTIONS.map((item) => {
            const Icon = item.Icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`tactile-btn lazer-slant-sm flex shrink-0 items-center justify-between gap-3 border px-3.5 py-2 text-left cursor-pointer lg:w-full lg:px-4 lg:py-3 ${
                  active
                    ? 'border-[var(--accent-bright)] bg-[var(--accent)] text-[var(--accent-on)] shadow-[0_8px_28px_rgba(var(--bg-accent-rgb,255,59,130),0.24)]'
                    : 'border-white/12 bg-[#101420]/90 text-white hover:border-white/30 hover:bg-[#161c2e]'
                }`}
              >
                <span className="lazer-unslant-sm flex items-center gap-2.5 lg:gap-3 min-w-0">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      active ? 'text-white' : 'text-[var(--accent-bright)]'
                    }`}
                  />
                  <span className="min-w-0">
                    <span className="font-display block text-xs sm:text-base font-extrabold leading-tight whitespace-nowrap">
                      {item.label}
                    </span>
                    <span
                      className={`hidden lg:block text-[11px] truncate ${
                        active ? 'text-white/90' : 'text-[#a1abbe]'
                      }`}
                    >
                      {item.sub}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        {/* Right Workbench */}
        <section className="orbit-scroll flex-1 overflow-y-auto border border-white/12 bg-[#0d111b]/95 p-5 sm:p-7 lg:col-span-8">
          {section === 'controls' && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-xl font-black text-white">
                  Dual-Trigger Keybinds
                </h2>
                <p className="mt-1 text-xs text-[#a1abbe]">
                  Bind two ergonomic keys for fast Double Taps, Beat Bursts, and Vinyl Fever mashes. Hold either key cleanly to ride Hold Arcs.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex items-center justify-between border border-white/12 bg-[#121726] p-4">
                  <div>
                    <span className="block text-sm font-bold text-white">Primary Trigger</span>
                    <span className="text-xs text-[#a1abbe]">Main tap &amp; hold action</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onStartRebind(1)}
                    data-pressed={pressedTest === 'k1'}
                    className={`tactile-btn border px-4 py-2 font-mono text-xs font-extrabold cursor-pointer ${
                      listeningSlot === 1
                        ? 'border-[#fde047] bg-[#2a2206] text-[#fde047]'
                        : pressedTest === 'k1'
                        ? 'border-[var(--accent-bright)] bg-[var(--accent)] text-white'
                        : 'border-white/20 bg-[#181f33] text-white hover:border-[var(--accent-bright)]'
                    }`}
                  >
                    {listeningSlot === 1 ? 'PRESS ANY KEY...' : profile.trigger1Label}
                  </button>
                </div>

                <div className="flex items-center justify-between border border-white/12 bg-[#121726] p-4">
                  <div>
                    <span className="block text-sm font-bold text-white">Secondary Trigger</span>
                    <span className="text-xs text-[#a1abbe]">Alternate double-tap key</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onStartRebind(2)}
                    data-pressed={pressedTest === 'k2'}
                    className={`tactile-btn border px-4 py-2 font-mono text-xs font-extrabold cursor-pointer ${
                      listeningSlot === 2
                        ? 'border-[#fde047] bg-[#2a2206] text-[#fde047]'
                        : pressedTest === 'k2'
                        ? 'border-[var(--accent-bright)] bg-[var(--accent)] text-white'
                        : 'border-white/20 bg-[#181f33] text-white hover:border-[var(--accent-bright)]'
                    }`}
                  >
                    {listeningSlot === 2 ? 'PRESS ANY KEY...' : profile.trigger2Label}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between border border-white/12 bg-[#121726] p-4">
                <div>
                  <span className="block text-sm font-bold text-white">Mouse / Touch Ring Click</span>
                  <span className="text-xs text-[#a1abbe]">
                    Allow pressing and holding directly inside the Orbit playfield
                  </span>
                </div>
                <ArcadeSwitch checked={profile.allowPointerTap} onToggle={onTogglePointer} />
              </div>

              <div className="border-t border-white/10 pt-5 flex flex-wrap items-center justify-between gap-4">
                <p className="text-xs text-[#808ba1]">
                  Live input check: tap <strong className="text-white">{profile.trigger1Label}</strong> or{' '}
                  <strong className="text-white">{profile.trigger2Label}</strong> right now to confirm switch actuation.
                </p>
                <button
                  type="button"
                  onClick={onReplayTutorial}
                  className="tactile-btn flex items-center gap-2 border border-white/15 bg-[#151b2b] px-4 py-2 text-xs font-bold text-white hover:border-[var(--accent-bright)] cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Launch Calibration Tutorial</span>
                </button>
              </div>
            </div>
          )}

          {section === 'audio' && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-xl font-black text-white">
                  Studio Audio &amp; Sync Calibration
                </h2>
                <p className="mt-1 text-xs text-[#a1abbe]">
                  All 15 MP3 tracks play at studio 1.0x pitch across every difficulty tier. Fine-tune output and Bluetooth/hardware latency here.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between border border-white/12 bg-[#121726] p-4">
                  <div className="flex-1 pr-5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-bold text-white">Soundtrack Music Volume</span>
                      <span className="tabular-nums text-xs font-bold text-[#22d3ee]">{profile.musicVolume}%</span>
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

                <div className="flex items-center justify-between border border-white/12 bg-[#121726] p-4">
                  <div className="flex-1 pr-5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-bold text-white">Hitsound &amp; Hold Shimmer Volume</span>
                      <span className="tabular-nums text-xs font-bold text-[#22d3ee]">{profile.sfxVolume}%</span>
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
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="border border-white/12 bg-[#121726] p-4">
                  <span className="block text-sm font-bold text-white mb-2.5">Hitsound Profile (Click to Audition)</span>
                  <div className="flex gap-2">
                    {(['switch', 'harmonic', 'rimshot'] as HitSfxMode[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => onSelectHitSfx(m)}
                        className={`tactile-btn lazer-slant-sm flex-1 border py-2 text-xs font-bold capitalize cursor-pointer ${
                          profile.hitSfxMode === m
                            ? 'border-[var(--accent-bright)] bg-[var(--accent)] text-[var(--accent-on)]'
                            : 'border-white/12 bg-[#181f33] text-[#a1abbe] hover:text-white'
                        }`}
                      >
                        <span className="lazer-unslant-sm block">{m}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border border-white/12 bg-[#121726] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-white">Audio Sync Offset</span>
                    <span className="tabular-nums text-xs font-extrabold text-[#22d3ee]">
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
                  <div className="mt-2.5 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleTapCalibrate}
                      className="tactile-btn border border-white/15 bg-[#181f33] px-3 py-1 text-[11px] font-bold text-white hover:border-[#22d3ee] cursor-pointer"
                    >
                      Tap 4x to Calibrate ({tapCalTimes.length}/4)
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateAudioOffset(0)}
                      className="text-[11px] text-[#a1abbe] hover:text-white underline cursor-pointer"
                    >
                      Reset 0ms
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {section === 'display' && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-xl font-black text-white">
                  Cabinet Styling &amp; Stage FX
                </h2>
                <p className="mt-1 text-xs text-[#a1abbe]">
                  Customize reactive stage telemetry rings and swap unlocked Tokyo Arcade cabinet glow themes.
                </p>
              </div>

              <div>
                <span className="block text-sm font-bold text-white mb-2.5">Background &amp; Spectrum Intensity</span>
                <div className="grid grid-cols-3 gap-3">
                  {(['dynamic', 'clean', 'minimal'] as BgFxMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onSelectBgFx(mode)}
                      className={`tactile-btn lazer-slant-sm border py-2.5 text-xs font-bold capitalize cursor-pointer ${
                        profile.bgFxMode === mode
                          ? 'border-[var(--accent-bright)] bg-[var(--accent)] text-[var(--accent-on)]'
                          : 'border-white/12 bg-[#121726] text-[#a1abbe] hover:text-white'
                      }`}
                    >
                      <span className="lazer-unslant-sm block">{mode}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="text-sm font-bold text-white">Cabinet Themes ({Object.keys(CHASSIS_THEMES).length})</span>
                  <button
                    type="button"
                    onClick={onOpenShop}
                    className="flex items-center gap-1.5 text-xs font-bold text-[#fbbf24] hover:underline cursor-pointer"
                  >
                    <OrbIcon className="h-3.5 w-3.5" />
                    <span>Unlock More in Orb Shop</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
                        className={`tactile-btn flex flex-col gap-2 border p-3 text-left cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                          active
                            ? 'border-[var(--accent-bright)] bg-[#181f33]'
                            : 'border-white/10 bg-[#121726] hover:border-white/30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className="h-4 w-8 border border-white/25"
                            style={{ backgroundColor: t.primary }}
                          />
                          {active && (
                            <span className="text-[10px] font-extrabold text-[var(--accent-bright)]">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="block truncate text-xs font-bold text-white">{t.label}</span>
                          <span className="block truncate text-[10px] text-[#a1abbe]">
                            {owned ? t.jpLabel : `${t.orbCost} Orbs`}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {section === 'profile' && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-xl font-black text-white">
                  Profile Maintenance &amp; Developer Access
                </h2>
                <p className="mt-1 text-xs text-[#a1abbe]">
                  Manage local arcade save state or unlock all tracks, tiers, themes, and mods for testing.
                </p>
              </div>

              <div className="border border-white/12 bg-[#121726] p-4">
                <span className="block text-sm font-bold text-white mb-2">
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
                      setPassStatus(ok ? 'All tracks, mods, and themes unlocked.' : 'Invalid passcode.');
                    }}
                    className="tactile-btn border border-white/20 bg-[#181f33] px-4 py-2 text-xs font-bold text-white hover:border-[var(--accent-bright)] cursor-pointer"
                  >
                    Unlock
                  </button>
                </div>
                {passStatus && <p className="mt-2 text-xs text-[#22d3ee]">{passStatus}</p>}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 border border-[#ef4444]/30 bg-[#1a0b0e] p-4">
                <div>
                  <span className="block text-sm font-bold text-[#fca5a5]">Reset Local Career Save</span>
                  <span className="text-xs text-[#a1abbe]">
                    Clears scores, Orbs, unlocked tracks, badges, and mechanic stats.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onResetCareer}
                  className="tactile-btn border border-[#ef4444]/60 bg-[#2e0c12] px-4 py-2 text-xs font-extrabold text-[#fecaca] hover:bg-[#ef4444] hover:text-white cursor-pointer"
                >
                  Wipe Save Data
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </motion.div>
  );
};
