import React from 'react';
import { ArrowLeft, Pause, SlidersHorizontal } from 'lucide-react';
import { DifficultyId, SongDefinition } from '../types/game';

interface TopBarProps {
  activeSong: SongDefinition;
  activeDifficulty: DifficultyId;
  equippedModsCount: number;
  beatLedIndex: number;
  songTimerText: string;
  songProgressPct: number;
  onBackToSongSelect: () => void;
  onOpenMods: () => void;
  onOpenPause: () => void;
}

export const TopBar: React.FC<TopBarProps> = React.memo(
  ({
    activeSong,
    activeDifficulty,
    equippedModsCount,
    beatLedIndex,
    songTimerText,
    songProgressPct,
    onBackToSongSelect,
    onOpenMods,
    onOpenPause,
  }) => {
    return (
      <header className="relative z-20 flex h-[54px] shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-[#080a11]/90 px-4 sm:px-7">
        {/* Left Zone: Back to Tracks */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBackToSongSelect}
            className="tactile-btn lazer-slant-sm flex items-center border border-white/15 bg-[#121624] px-3.5 py-1.5 text-xs font-bold text-white hover:border-[var(--accent-bright)] cursor-pointer whitespace-nowrap shrink-0"
          >
            <span className="lazer-unslant-sm flex items-center gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Tracks</span>
            </span>
          </button>

          <div className="hidden sm:flex items-center gap-2 min-w-0 truncate text-xs text-[#a1abbe]">
            <span className="font-display font-bold text-white truncate max-w-[180px]">
              {activeSong.title}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-[var(--accent-bright)] whitespace-nowrap">
              {activeSong.chillOnly ? 'CHILL' : activeDifficulty}
            </span>
          </div>
        </div>

        {/* Center Zone: Beat LEDs + Song Timer */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden md:flex items-center gap-1.5" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`h-1.5 w-4 transition-colors duration-100 ${
                  beatLedIndex === i
                    ? 'bg-[var(--accent-bright)]'
                    : 'bg-white/15'
                }`}
              />
            ))}
          </div>
          <span className="tabular-nums text-xs font-bold text-[#e5e7eb] whitespace-nowrap">
            {songTimerText}
          </span>
        </div>

        {/* Right Zone: Mods + Pause */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenMods}
            className="tactile-btn lazer-slant-sm flex items-center border border-white/15 bg-[#121624] px-3 py-1.5 text-xs font-bold text-[#e5e7eb] hover:border-[var(--accent-bright)] cursor-pointer whitespace-nowrap"
          >
            <span className="lazer-unslant-sm flex items-center gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5 text-[var(--accent-bright)]" />
              <span>{equippedModsCount > 0 ? `Mods (${equippedModsCount})` : 'Mods'}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={onOpenPause}
            className="tactile-btn lazer-slant-sm flex items-center border border-white/15 bg-[#121624] px-3.5 py-1.5 text-xs font-bold text-white hover:border-[var(--accent-bright)] cursor-pointer whitespace-nowrap"
          >
            <span className="lazer-unslant-sm flex items-center gap-1.5">
              <Pause className="h-3.5 w-3.5" />
              <span>Pause</span>
            </span>
          </button>
        </div>

        {/* Hairline Song Progress Bar along Bottom Edge */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-white/5"
        >
          <div
            className="h-full bg-[var(--accent-bright)] transition-all duration-150"
            style={{ width: `${Math.max(0, Math.min(100, songProgressPct))}%` }}
          />
        </div>
      </header>
    );
  },
);
