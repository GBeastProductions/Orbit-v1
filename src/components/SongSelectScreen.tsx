import React, { useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Coins,
  ImagePlus,
  Lock,
  Play,
  Shuffle,
  SlidersHorizontal,
  Snowflake,
  Upload,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  SONG_CATEGORIES,
} from '../data/catalog';
import {
  computeModMultiplier,
  computeNextMilestone,
  formatTimeSec,
} from '../engine/beatmap';
import {
  DifficultyId,
  LevelBackgroundSetting,
  PlayerProfile,
  SongCategory,
  SongDefinition,
} from '../types/game';
import { DiscCartridge } from './DiscCartridge';

interface SongSelectScreenProps {
  profile: PlayerProfile;
  songs: SongDefinition[];
  customAudioStatus: string;
  onBackToTitle: () => void;
  onPreviewSong: (songId: string) => void;
  onRandomSong: () => void;
  onToggleMusic: () => void;
  onSelectDifficulty: (diffId: DifficultyId) => void;
  onStartGame: () => void;
  onOpenMods: () => void;
  onOpenOrbVault: () => void;
  onUnlockDifficulty: (diffId: DifficultyId, cost: number) => void;
  onUnlockSong: (songId: string, cost: number) => void;
  onUpdateLevelBg: (songId: string, patch: Partial<LevelBackgroundSetting>) => void;
  onResetLevelBg: (songId: string) => void;
  onUploadCustomAudio: (file: File, ngIdTag: string, targetSongId?: string) => Promise<void>;
}

const RANK_COLORS: Record<string, string> = {
  SS: 'text-[#fde047]',
  S: 'text-[#fbbf24]',
  A: 'text-[#34d399]',
  B: 'text-[#22d3ee]',
  C: 'text-[#c084fc]',
  D: 'text-[#fb923c]',
  F: 'text-[#ef4444]',
};

async function resizeImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxW = 1280;
        const scale = img.width > maxW ? maxW / img.width : 1;
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas unavailable'));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => reject(new Error('Invalid image'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsDataURL(file);
  });
}

export const SongSelectScreen: React.FC<SongSelectScreenProps> = React.memo(
  ({
    profile,
    songs,
    customAudioStatus,
    onBackToTitle,
    onPreviewSong,
    onRandomSong,
    onToggleMusic,
    onSelectDifficulty,
    onStartGame,
    onOpenMods,
    onOpenOrbVault,
    onUnlockDifficulty,
    onUnlockSong,
    onUpdateLevelBg,
    onResetLevelBg,
    onUploadCustomAudio,
  }) => {
    const [activeCategory, setActiveCategory] = useState<'all' | SongCategory>('all');
    const [showStageEditor, setShowStageEditor] = useState(false);
    const bgFileInputRef = useRef<HTMLInputElement>(null);
    const mp3FileInputRef = useRef<HTMLInputElement>(null);

    const selectedSong =
      songs.find((s) => s.id === profile.selectedSongId) || songs[0];

    const filteredSongs = useMemo(() => {
      if (activeCategory === 'all') return songs;
      return songs.filter((s) => s.category === activeCategory);
    }, [songs, activeCategory]);

    const effectiveDiffId: DifficultyId = selectedSong.chillOnly
      ? 'CHILL'
      : profile.selectedDifficulty;
    const activeDiff = DIFFICULTIES[effectiveDiffId] || DIFFICULTIES.CHILL;
    const songRecord = profile.songRecords[selectedSong.id];
    const bgSetting = profile.levelBgSettings[selectedSong.id] || {
      dimPct: 64,
      blurPx: 3,
    };
    const songUnlocked =
      profile.devUnlocked ||
      selectedSong.orbCost === 0 ||
      profile.unlockedSongs.includes(selectedSong.id);
    const diffUnlocked =
      profile.devUnlocked || profile.unlockedDiffs.includes(effectiveDiffId);
    const canLaunch = songUnlocked && diffUnlocked;
    const activeArtSrc = bgSetting.customImageDataUrl || selectedSong.bgImageUrl;

    const milestone = songRecord
      ? computeNextMilestone(
          songRecord.bestAccuracy,
          songRecord.bestRank === 'SS' || songRecord.bestRank === 'S' ? 0 : 1,
          songRecord.bestRank !== 'F',
          effectiveDiffId,
        )
      : null;

    const modMult = computeModMultiplier(profile.equippedMods);

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.22 }}
        className="relative z-10 flex h-dvh w-full flex-col justify-between overflow-hidden"
      >
        {/* Directional Readability Scrim */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#07080d]/92 via-[#07080d]/72 to-[#07080d]/84"
        />

        {/* Top Bar (3-Zone Contract) */}
        <header className="relative z-20 flex h-[56px] sm:h-[60px] shrink-0 items-center justify-between gap-2 sm:gap-4 border-b border-white/10 bg-[#080a11]/90 px-3 sm:px-8">
          <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
            <button
              type="button"
              onClick={onBackToTitle}
              className="tactile-btn lazer-slant-sm flex items-center gap-1.5 border border-white/15 bg-[#121624] px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-bold text-white hover:border-[var(--accent-bright)] cursor-pointer whitespace-nowrap shrink-0"
            >
              <span className="lazer-unslant-sm flex items-center gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Title</span>
              </span>
            </button>
            <div className="hidden min-[430px]:flex items-baseline gap-2.5 min-w-0 truncate">
              <h1 className="font-display text-base sm:text-xl font-extrabold tracking-tight text-white whitespace-nowrap">
                Track Select
              </h1>
              <span className="hidden md:inline text-xs font-semibold tracking-[0.18em] text-[var(--accent-bright)] whitespace-nowrap">
                トラック選択
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <input
              ref={mp3FileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  onUploadCustomAudio(file, 'CUSTOM');
                  setActiveCategory('custom');
                  e.target.value = '';
                }
              }}
            />
            <button
              type="button"
              onClick={() => mp3FileInputRef.current?.click()}
              className="tactile-btn lazer-slant-sm hidden sm:flex items-center border border-white/15 bg-[#121624] px-3.5 py-2 text-xs font-semibold text-[#e5e7eb] hover:border-[#22d3ee] cursor-pointer whitespace-nowrap"
            >
              <span className="lazer-unslant-sm flex items-center gap-1.5">
                <Upload className="h-3.5 w-3.5 text-[#22d3ee]" />
                <span>Import MP3</span>
              </span>
            </button>

            <button
              type="button"
              onClick={onRandomSong}
              className="tactile-btn lazer-slant-sm flex items-center border border-white/15 bg-[#121624] px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-semibold text-[#e5e7eb] hover:border-[var(--accent-bright)] cursor-pointer whitespace-nowrap"
              title="Random Track"
            >
              <span className="lazer-unslant-sm flex items-center gap-1.5">
                <Shuffle className="h-3.5 w-3.5 text-[var(--accent-bright)]" />
                <span className="hidden md:inline">Random</span>
              </span>
            </button>

            <button
              type="button"
              onClick={onToggleMusic}
              className="tactile-btn lazer-slant-sm flex items-center border border-white/15 bg-[#121624] px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold text-white hover:border-[var(--accent-bright)] cursor-pointer whitespace-nowrap"
              aria-label={profile.musicEnabled ? 'Mute Audio' : 'Enable Audio'}
            >
              <span className="lazer-unslant-sm flex items-center">
                {profile.musicEnabled ? (
                  <Volume2 className="h-4 w-4 text-[var(--accent-bright)]" />
                ) : (
                  <VolumeX className="h-4 w-4 text-[#68738a]" />
                )}
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenOrbVault}
              className="tactile-btn lazer-slant-sm flex items-center border border-[#fbbf24]/40 bg-[#1c1608] px-3 sm:px-3.5 py-1.5 sm:py-2 text-xs font-bold text-[#fbbf24] hover:border-[#fbbf24] cursor-pointer whitespace-nowrap tabular-nums"
            >
              <span className="lazer-unslant-sm flex items-center gap-1.5">
                <Coins className="h-3.5 w-3.5" />
                <span>{profile.orbs.toLocaleString()}</span>
              </span>
            </button>
          </div>
        </header>

        {/* Main 2-Column Stage: Left Active Track Wedge + Right Category & Carousel */}
        <main className="relative z-20 mx-auto grid w-full max-w-[1380px] flex-1 grid-cols-1 gap-4 sm:gap-6 overflow-y-auto lg:overflow-hidden px-3 py-3 sm:px-8 lg:grid-cols-12 lg:py-5 orbit-scroll">
          {/* LEFT WEDGE (5 cols): Active Song Details, Difficulty Selector, Record & Mod Strip */}
          <section className="flex flex-col justify-between gap-4 lg:overflow-y-auto orbit-scroll pr-1 lg:col-span-5">
            <div className="space-y-3.5 sm:space-y-4">
              {/* Featured Track Art Banner */}
              <div className="relative aspect-[16/8.5] w-full overflow-hidden border border-white/15 bg-[#0e111a] shadow-lg">
                {activeArtSrc ? (
                  <img
                    src={activeArtSrc}
                    alt={selectedSong.title}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-[#1f122a] to-[#0b101b]" />
                )}
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-[#07080d] via-[#07080d]/35 to-transparent"
                />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3.5 sm:p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[11px] sm:text-xs font-semibold text-[#d1d5db] tabular-nums">
                      <span>Disc {selectedSong.num}</span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">{selectedSong.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{selectedSong.bpm} BPM</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatTimeSec(selectedSong.durationSec)}</span>
                    </div>
                    <h2 className="font-display mt-0.5 truncate text-xl sm:text-3xl font-black tracking-tight text-white">
                      {selectedSong.title}
                    </h2>
                    <p className="truncate text-xs sm:text-sm font-medium text-[#b6bfd1]">
                      {selectedSong.artist} · {selectedSong.genre}
                    </p>
                  </div>

                  {songRecord && (
                    <div className="shrink-0 text-right">
                      <span className="block text-[10px] font-semibold uppercase tracking-widest text-[#a1abbe]">
                        Best Rank
                      </span>
                      <span
                        className={`font-display text-3xl font-black leading-none ${
                          RANK_COLORS[songRecord.bestRank] || 'text-white'
                        }`}
                      >
                        {songRecord.bestRank}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <p className="text-xs sm:text-sm leading-relaxed text-[#b6bfd1]">
                {selectedSong.desc}
              </p>

              {/* Difficulty Tabs (Single-Line, Crisp Contrast) */}
              <div>
                <div className="mb-2 flex items-center justify-between text-xs text-[#a1abbe]">
                  <span className="font-semibold">Difficulty</span>
                  <span className="tabular-nums text-white font-semibold">
                    {activeDiff.name} · {activeDiff.mult.toFixed(2)}x Score
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {DIFFICULTY_ORDER.map((diffId) => {
                    const cfg = DIFFICULTIES[diffId];
                    const disabled = selectedSong.chillOnly && diffId !== 'CHILL';
                    const isSelected = effectiveDiffId === diffId;
                    const isUnlocked =
                      profile.devUnlocked || profile.unlockedDiffs.includes(diffId);
                    const stars = selectedSong.stars[diffId] || '—';

                    return (
                      <button
                        key={diffId}
                        type="button"
                        disabled={disabled}
                        onClick={() => onSelectDifficulty(diffId)}
                        className={`tactile-btn lazer-slant-sm flex flex-col items-center justify-center border px-1.5 py-2 text-center cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${
                          isSelected
                            ? 'border-[var(--accent-bright)] bg-[var(--accent)] text-[var(--accent-on)]'
                            : isUnlocked
                            ? 'border-white/15 bg-[#121726] text-white hover:border-white/35'
                            : 'border-white/10 bg-[#101420] text-[#9aa5ba] hover:border-[#fbbf24]/50'
                        }`}
                      >
                        <span className="lazer-unslant-sm flex flex-col items-center w-full min-w-0">
                          <span className="flex items-center gap-0.5 text-[10px] sm:text-[11px] font-extrabold tracking-wide whitespace-nowrap">
                            {!isUnlocked && !disabled && <Lock className="h-2.5 w-2.5 text-[#fbbf24] shrink-0" />}
                            <span>{cfg.name}</span>
                          </span>
                          <span
                            className={`tabular-nums mt-0.5 text-[10px] font-semibold whitespace-nowrap ${
                              isSelected ? 'text-white/95' : 'text-[#9aa5ba]'
                            }`}
                          >
                            {stars}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-[#808ba1]">{activeDiff.desc}</p>
              </div>

              {/* Personal Best & Next Rank Forecast */}
              <div className="border-t border-white/10 pt-3">
                {songRecord ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs tabular-nums">
                      <span className="text-[#a1abbe]">
                        Best Score <strong className="ml-1 text-white">{songRecord.bestScore.toLocaleString()}</strong>
                        <span className="mx-2 text-white/25">·</span>
                        Accuracy <strong className="ml-1 text-[#22d3ee]">{songRecord.bestAccuracy.toFixed(1)}%</strong>
                        <span className="mx-2 text-white/25">·</span>
                        Combo <strong className="ml-1 text-white">{songRecord.bestCombo}x</strong>
                      </span>
                    </div>
                    {milestone && milestone.nextRank && (
                      <div>
                        <div className="mb-1 flex items-center justify-between text-[11px] text-[#a1abbe]">
                          <span>{milestone.gapLabel}</span>
                          <span className="tabular-nums text-white font-semibold">
                            {Math.round(milestone.progressPct)}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden bg-white/10">
                          <div
                            className="h-full bg-[var(--accent-bright)] transition-all duration-300"
                            style={{ width: `${milestone.progressPct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-[#808ba1]">
                    Unplayed on this profile. Clear with C-rank or higher to bank earned Orbs.
                  </p>
                )}
              </div>

              {/* Compact Mod & Stage Background Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
                <div className="text-xs text-[#b6bfd1] tabular-nums">
                  <span className="font-semibold text-white">Mods:</span>{' '}
                  {profile.equippedMods.length > 0
                    ? `${profile.equippedMods.join(' + ')} (${modMult.toFixed(2)}x)`
                    : 'None (1.00x)'}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowStageEditor((v) => !v)}
                    className="tactile-btn border border-white/15 bg-[#111521] px-3 py-1.5 text-xs font-semibold text-[#d1d5db] hover:border-white/30 cursor-pointer whitespace-nowrap"
                  >
                    {showStageEditor ? 'Hide Backdrop' : 'Backdrop Tuner'}
                  </button>
                  <button
                    type="button"
                    onClick={onOpenMods}
                    className="tactile-btn border border-white/15 bg-[#151a28] px-3.5 py-1.5 text-xs font-bold text-white hover:border-[var(--accent-bright)] cursor-pointer whitespace-nowrap"
                  >
                    <span className="flex items-center gap-1.5">
                      <SlidersHorizontal className="h-3.5 w-3.5 text-[var(--accent-bright)]" />
                      <span>Mods</span>
                    </span>
                  </button>
                </div>
              </div>

              {showStageEditor && (
                <div className="space-y-3 border border-white/10 bg-[#0d1018]/95 p-3.5 text-xs">
                  <div className="grid grid-cols-2 gap-4">
                    <label className="block">
                      <span className="flex justify-between text-[#a1abbe] mb-1">
                        <span>Background Dim</span>
                        <span className="tabular-nums text-white">{bgSetting.dimPct}%</span>
                      </span>
                      <input
                        type="range"
                        min={20}
                        max={92}
                        value={bgSetting.dimPct}
                        onChange={(e) =>
                          onUpdateLevelBg(selectedSong.id, { dimPct: Number(e.target.value) })
                        }
                        className="w-full accent-[var(--accent)]"
                      />
                    </label>
                    <label className="block">
                      <span className="flex justify-between text-[#a1abbe] mb-1">
                        <span>Stage Blur</span>
                        <span className="tabular-nums text-white">{bgSetting.blurPx}px</span>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={14}
                        value={bgSetting.blurPx}
                        onChange={(e) =>
                          onUpdateLevelBg(selectedSong.id, { blurPx: Number(e.target.value) })
                        }
                        className="w-full accent-[var(--accent)]"
                      />
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={bgFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const url = await resizeImageToDataUrl(file);
                            onUpdateLevelBg(selectedSong.id, { customImageDataUrl: url });
                          } catch {
                            // Ignore invalid image
                          }
                          e.target.value = '';
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => bgFileInputRef.current?.click()}
                      className="tactile-btn flex items-center gap-1.5 border border-white/15 bg-[#161b29] px-3 py-1.5 text-xs font-semibold text-white hover:border-[var(--accent-bright)] cursor-pointer"
                    >
                      <ImagePlus className="h-3.5 w-3.5" />
                      <span>Custom Cover</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onResetLevelBg(selectedSong.id)}
                      className="tactile-btn border border-white/10 bg-[#111521] px-3 py-1.5 text-xs text-[#a1abbe] hover:text-white cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              )}

              {customAudioStatus && (
                <p className="text-xs font-medium text-[#22d3ee]">{customAudioStatus}</p>
              )}
            </div>
          </section>

          {/* RIGHT CAROUSEL (7 cols): Category Tabs + Slanted Track List */}
          <section className="relative flex flex-col lg:overflow-hidden lg:col-span-7">
            {/* Functional Category Filter Bar */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {SONG_CATEGORIES.map((cat) => {
                const isActive = activeCategory === cat.id;
                const isChristmas = cat.id === 'christmas';
                const catSongs =
                  cat.id === 'all' ? songs : songs.filter((s) => s.category === cat.id);
                const count = catSongs.length;
                if (cat.id === 'custom' && count === 0) return null;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setActiveCategory(cat.id);
                      if (catSongs.length > 0 && !catSongs.some((s) => s.id === selectedSong.id)) {
                        onPreviewSong(catSongs[0].id);
                      }
                    }}
                    className={`tactile-btn lazer-slant-sm border px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs font-bold cursor-pointer whitespace-nowrap shrink-0 ${
                      isActive
                        ? isChristmas
                          ? 'border-[#38bdf8] bg-[#0284c7] text-white'
                          : 'border-[var(--accent-bright)] bg-[var(--accent)] text-[var(--accent-on)]'
                        : 'border-white/12 bg-[#101420]/90 text-[#b6bfd1] hover:border-white/30 hover:text-white'
                    }`}
                  >
                    <span className="lazer-unslant-sm flex items-center gap-1.5">
                      {isChristmas && <Snowflake className="h-3.5 w-3.5 text-[#bae6fd]" />}
                      <span>{cat.label}</span>
                      <span className="tabular-nums opacity-75">({count})</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Scrollable Slanted Track Carousel */}
            <div className="relative flex-1 overflow-hidden">
              <div className="orbit-scroll h-full space-y-2.5 overflow-y-auto px-2 pb-6">
                {filteredSongs.map((song) => {
                  const isSelected = song.id === selectedSong.id;
                  const unlocked =
                    profile.devUnlocked ||
                    song.orbCost === 0 ||
                    profile.unlockedSongs.includes(song.id);
                  const rec = profile.songRecords[song.id];
                  const art =
                    profile.levelBgSettings[song.id]?.customImageDataUrl || song.bgImageUrl;
                  const starLabel =
                    song.stars[song.chillOnly ? 'CHILL' : effectiveDiffId] ||
                    song.stars.CHILL ||
                    '';
                  const isChristmasTrack = song.category === 'christmas';

                  return (
                    <button
                      key={song.id}
                      type="button"
                      onClick={() => onPreviewSong(song.id)}
                      className={`tactile-btn lazer-slant-sm group relative flex w-full items-center justify-between gap-4 overflow-hidden border px-4 py-2.5 text-left cursor-pointer ${
                        isSelected
                          ? 'border-[var(--accent-bright)] border-l-4 border-l-[var(--accent-bright)] bg-[#171d2f] translate-x-1'
                          : isChristmasTrack
                          ? 'border-white/12 border-l-[3px] border-l-[#38bdf8]/65 bg-[#0d121d] hover:border-[#38bdf8]/50'
                          : 'border-white/10 bg-[#0d111b] hover:border-white/25 hover:bg-[#131826]'
                      }`}
                    >
                      {/* osu!lazer Diagonal Artwork Strip Peek */}
                      {art && (
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-y-0 right-0 w-[56%] overflow-hidden"
                        >
                          <img
                            src={art}
                            alt=""
                            referrerPolicy="no-referrer"
                            className={`h-full w-full object-cover transition-opacity duration-200 ${
                              isSelected ? 'opacity-38' : 'opacity-20 group-hover:opacity-32'
                            } ${!unlocked ? 'grayscale' : ''}`}
                          />
                          <div
                            className={`absolute inset-0 ${
                              isSelected
                                ? 'bg-gradient-to-r from-[#171d2f] via-[#171d2f]/80 to-[#171d2f]/30'
                                : 'bg-gradient-to-r from-[#0d111b] via-[#0d111b]/82 to-[#0d111b]/35'
                            }`}
                          />
                        </div>
                      )}

                      <div className="lazer-unslant-sm relative z-10 flex w-full items-center justify-between gap-4 min-w-0">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <DiscCartridge
                            imageUrl={art}
                            num={song.num}
                            title={song.title}
                            size="sm"
                            spinning={isSelected}
                            locked={!unlocked}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-display truncate text-sm sm:text-base font-extrabold text-white">
                                {song.title}
                              </span>
                              {isChristmasTrack && (
                                <Snowflake className="h-3.5 w-3.5 shrink-0 text-[#38bdf8]" />
                              )}
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-xs text-[#b6bfd1] truncate tabular-nums">
                              <span className="truncate">{song.artist}</span>
                              <span aria-hidden="true">·</span>
                              <span>{song.bpm} BPM</span>
                              <span aria-hidden="true">·</span>
                              <span>{formatTimeSec(song.durationSec)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 sm:gap-4 shrink-0 tabular-nums">
                          {starLabel && (
                            <span className="text-xs font-semibold text-[#d1d5db]">
                              {starLabel}
                            </span>
                          )}
                          {!unlocked ? (
                            <span className="flex items-center gap-1 text-xs font-bold text-[#fbbf24] whitespace-nowrap">
                              <Lock className="h-3.5 w-3.5" />
                              <span>{song.orbCost} Orbs</span>
                            </span>
                          ) : rec ? (
                            <span
                              className={`font-display text-lg font-black ${
                                RANK_COLORS[rec.bestRank] || 'text-white'
                              }`}
                            >
                              {rec.bestRank}
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-[#9aa5ba]">Ready</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {/* Soft bottom scroll fade */}
              <div
                aria-hidden="true"
                className="pointer-events-none hidden lg:block absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#07080d]/90 to-transparent"
              />
            </div>
          </section>
        </main>

        {/* Bottom Dock: Secondary Tools (Left) + Bold Slanted Launch Wing (Right) */}
        <footer className="relative z-20 flex h-[64px] sm:h-[68px] shrink-0 items-center justify-between gap-2 sm:gap-4 border-t border-white/10 bg-[#080a11]/95 px-3 sm:px-8">
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={onOpenOrbVault}
              className="tactile-btn lazer-slant-sm border border-white/15 bg-[#121624] px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-bold text-white hover:border-[#fbbf24] cursor-pointer whitespace-nowrap"
            >
              <span className="lazer-unslant-sm flex items-center gap-1.5">
                <Coins className="h-3.5 w-3.5 text-[#fbbf24]" />
                <span>Orb Shop</span>
              </span>
            </button>
            <button
              type="button"
              onClick={onOpenMods}
              className="tactile-btn lazer-slant-sm border border-white/15 bg-[#121624] px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-bold text-white hover:border-[var(--accent-bright)] cursor-pointer whitespace-nowrap"
            >
              <span className="lazer-unslant-sm flex items-center gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5 text-[var(--accent-bright)]" />
                <span>Mods</span>
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {!songUnlocked ? (
              <button
                type="button"
                disabled={profile.orbs < selectedSong.orbCost}
                onClick={() => onUnlockSong(selectedSong.id, selectedSong.orbCost)}
                className="tactile-btn lazer-slant flex items-center border border-[#fbbf24] bg-[#fbbf24] px-4 sm:px-7 py-2 sm:py-2.5 text-xs sm:text-sm font-black text-[#140c02] hover:bg-[#fde047] disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
              >
                <span className="lazer-unslant flex items-center gap-1.5 sm:gap-2">
                  <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span>Unlock · {selectedSong.orbCost}</span>
                </span>
              </button>
            ) : !diffUnlocked ? (
              <button
                type="button"
                disabled={profile.orbs < activeDiff.orbCost}
                onClick={() => onUnlockDifficulty(effectiveDiffId, activeDiff.orbCost)}
                className="tactile-btn lazer-slant flex items-center border border-[#fbbf24] bg-[#fbbf24] px-4 sm:px-7 py-2 sm:py-2.5 text-xs sm:text-sm font-black text-[#140c02] hover:bg-[#fde047] disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
              >
                <span className="lazer-unslant flex items-center gap-1.5 sm:gap-2">
                  <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span>Unlock {activeDiff.name} · {activeDiff.orbCost}</span>
                </span>
              </button>
            ) : (
              <button
                type="button"
                disabled={!canLaunch}
                onClick={onStartGame}
                className="tactile-btn lazer-slant flex items-center border border-[var(--accent-bright)] bg-[var(--accent)] px-5 sm:px-8 py-2 sm:py-2.5 text-xs sm:text-base font-black tracking-wide text-[var(--accent-on)] hover:bg-[var(--accent-bright)] cursor-pointer whitespace-nowrap"
              >
                <span className="lazer-unslant flex items-center gap-1.5 sm:gap-2">
                  <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-current" />
                  <span>Launch Stage</span>
                </span>
              </button>
            )}
          </div>
        </footer>
      </motion.div>
    );
  },
);
