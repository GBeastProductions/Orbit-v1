import React from 'react';
import { Lock, X } from 'lucide-react';
import { MOD_CATALOG } from '../data/catalog';
import { computeTotalMultiplier } from '../engine/beatmap';
import { DifficultyId, ModCode } from '../types/game';

interface ModDrawerProps {
  open: boolean;
  equippedMods: ModCode[];
  totalHits: number;
  devUnlocked: boolean;
  activeDifficulty: DifficultyId;
  onToggleMod: (code: ModCode) => void;
  onClearMods: () => void;
  onClose: () => void;
}

export const ModDrawer: React.FC<ModDrawerProps> = React.memo(
  ({
    open,
    equippedMods,
    totalHits,
    devUnlocked,
    activeDifficulty,
    onToggleMod,
    onClearMods,
    onClose,
  }) => {
    const baseWithMods = computeTotalMultiplier(activeDifficulty, equippedMods, 0);

    return (
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="modDrawerTitle"
        aria-hidden={!open}
        className={`fixed bottom-0 left-1/2 z-50 flex max-h-[80dvh] w-[min(96vw,780px)] flex-col border-t-2 border-[var(--accent-bright)] bg-[#0b0e16]/98 shadow-2xl transition-transform duration-200 ease-out ${
          open
            ? '-translate-x-1/2 translate-y-0'
            : '-translate-x-1/2 translate-y-[104%] pointer-events-none'
        }`}
      >
        {open && (
          <>
            <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-[#121624] px-6 py-4">
              <div className="min-w-0">
                <h3
                  id="modDrawerTitle"
                  className="font-display text-base font-extrabold tracking-tight text-white"
                >
                  Mod Setup · モッド設定
                </h3>
                <p className="mt-0.5 text-xs text-[#a1abbe] tabular-nums">
                  {equippedMods.length}/3 Active · {baseWithMods.toFixed(2)}x Total Multiplier
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onClearMods}
                  className="tactile-btn border border-white/15 bg-[#181e30] px-3.5 py-1.5 text-xs font-semibold text-[#d1d5db] hover:text-white cursor-pointer whitespace-nowrap"
                >
                  Clear All
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="tactile-btn border border-white/15 bg-[#181e30] p-2 text-[#d1d5db] hover:text-white cursor-pointer"
                  aria-label="Close Mod Setup"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="orbit-scroll grid grid-cols-1 gap-2.5 overflow-y-auto p-5 sm:grid-cols-2">
              {MOD_CATALOG.map((mod) => {
                const active = equippedMods.includes(mod.code);
                const locked = !devUnlocked && totalHits < mod.unlockHits;
                const fullAndNotActive = !active && equippedMods.length >= 3;

                return (
                  <button
                    key={mod.id}
                    type="button"
                    disabled={locked || fullAndNotActive}
                    onClick={() => onToggleMod(mod.code)}
                    className={`tactile-btn flex items-start justify-between gap-3 border p-3.5 text-left cursor-pointer disabled:cursor-not-allowed ${
                      active
                        ? 'border-[var(--accent-bright)] bg-[var(--accent-dim)]'
                        : locked
                        ? 'border-white/8 bg-[#0b0e17] opacity-75'
                        : fullAndNotActive
                        ? 'border-white/8 bg-[#0d111b] opacity-55'
                        : 'border-white/10 bg-[#101420] hover:border-white/25'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-extrabold text-[var(--accent-bright)]">
                          {mod.code}
                        </span>
                        <span className="font-display text-sm font-bold text-white truncate">
                          {mod.name}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-[#b6bfd1]">
                        {mod.desc}
                      </p>
                    </div>
                    <div className="shrink-0 text-right tabular-nums">
                      {locked ? (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-[#fbbf24] whitespace-nowrap">
                          <Lock className="h-3 w-3" />
                          <span>{mod.unlockHits} Hits</span>
                        </span>
                      ) : (
                        <span
                          className={`text-xs font-extrabold whitespace-nowrap ${
                            mod.mult >= 1 ? 'text-[#22d3ee]' : 'text-[#fbbf24]'
                          }`}
                        >
                          {mod.mult.toFixed(2)}x
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>
    );
  },
);
