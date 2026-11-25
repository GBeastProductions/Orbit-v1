import React from 'react';
import { motion } from 'motion/react';
import { Award, ListMusic, RotateCcw } from 'lucide-react';
import { computeNextMilestone } from '../engine/beatmap';
import { RunSummaryData } from '../types/game';
import { OrbIcon } from './OrbIcon';

interface RunSummaryModalProps {
  summary: RunSummaryData | null;
  onRetry: () => void;
  onOpenSongSelect: () => void;
  onOpenOrbVault: () => void;
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

export const RunSummaryModal: React.FC<RunSummaryModalProps> = ({
  summary,
  onRetry,
  onOpenSongSelect,
  onOpenOrbVault,
}) => {
  if (!summary) return null;

  const rankClass =
    summary.isSilverRank && (summary.rank === 'SS' || summary.rank === 'S')
      ? 'text-[#e5e7eb]'
      : RANK_COLORS[summary.rank] || 'text-white';

  const milestone = computeNextMilestone(
    summary.accuracy,
    summary.missCount,
    summary.cleared,
    summary.difficulty,
  );

  const binCount = 15;
  const bins = new Array<number>(binCount).fill(0);
  for (const s of summary.offsetSamples) {
    const norm = Math.max(-1, Math.min(0.999, s));
    const idx = Math.floor(((norm + 1) / 2) * binCount);
    bins[Math.max(0, Math.min(binCount - 1, idx))] += 1;
  }
  const maxBin = Math.max(1, ...bins);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="runSummaryTitle"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/84 p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto orbit-scroll border border-white/15 bg-[#0b0e16] shadow-2xl"
      >
        {/* Top Rank Header */}
        <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-[#121624] px-6 py-5">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-bright)]">
              {summary.cleared ? 'Stage Cleared · クリア' : `Stage Failed · ${summary.missReason || 'Missed'}`}
            </p>
            <h2
              id="runSummaryTitle"
              className="font-display mt-1 truncate text-2xl font-black text-white"
            >
              {summary.songTitle}
            </h2>
            <p className="text-xs text-[#a1abbe]">
              {summary.artist} · {summary.difficulty}
              {summary.isNewBest && ' · New Personal Best'}
            </p>
          </div>

          <div className="shrink-0 text-right">
            <span className="block text-[11px] font-semibold uppercase tracking-widest text-[#a1abbe]">
              Rank
            </span>
            <span className={`font-display text-5xl font-black leading-none ${rankClass}`}>
              {summary.rank}
            </span>
          </div>
        </div>

        {/* Metrics Body */}
        <div className="space-y-5 p-6">
          <div className="grid grid-cols-3 gap-3 border-b border-white/10 pb-4 tabular-nums">
            <div>
              <span className="block text-xs text-[#a1abbe]">Score</span>
              <span className="mt-0.5 block text-2xl font-black text-white">
                {summary.score.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="block text-xs text-[#a1abbe]">Accuracy</span>
              <span className="mt-0.5 block text-2xl font-black text-[#22d3ee]">
                {summary.accuracy.toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="block text-xs text-[#a1abbe]">Max Combo</span>
              <span className="mt-0.5 block text-2xl font-black text-[#fbbf24]">
                {summary.maxCombo}x
              </span>
            </div>
          </div>

          {/* Judgment Breakdown */}
          <div className="grid grid-cols-4 gap-2 text-center tabular-nums">
            <div className="border border-white/10 bg-[#101420] p-2.5">
              <span className="block text-[11px] text-[#a1abbe]">Perfect</span>
              <span className="text-base font-extrabold text-white">{summary.perfectCount}</span>
            </div>
            <div className="border border-white/10 bg-[#101420] p-2.5">
              <span className="block text-[11px] text-[#a1abbe]">Great</span>
              <span className="text-base font-extrabold text-[#34d399]">{summary.greatCount}</span>
            </div>
            <div className="border border-white/10 bg-[#101420] p-2.5">
              <span className="block text-[11px] text-[#a1abbe]">Good</span>
              <span className="text-base font-extrabold text-[#22d3ee]">{summary.goodCount}</span>
            </div>
            <div className="border border-white/10 bg-[#101420] p-2.5">
              <span className="block text-[11px] text-[#a1abbe]">Miss</span>
              <span className="text-base font-extrabold text-[#ef4444]">{summary.missCount}</span>
            </div>
          </div>

          {/* Hit Timing Distribution */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs text-[#a1abbe]">
              <span>Hit Timing Spread (Early ◀ 0° ▶ Late)</span>
              <span className="tabular-nums text-white">Avg {summary.avgOffsetDeg.toFixed(1)}°</span>
            </div>
            <div className="flex h-10 items-end gap-1 border-b border-white/10 pb-1">
              {bins.map((count, i) => {
                const pct = count > 0 ? Math.max(14, Math.round((count / maxBin) * 100)) : 6;
                const isCenter = Math.abs(i - 7) <= 1;
                return (
                  <div key={i} className="flex h-full flex-1 items-end">
                    <div
                      className={`w-full ${
                        count === 0
                          ? 'bg-white/10'
                          : isCenter
                          ? 'bg-white'
                          : 'bg-[var(--accent)]'
                      }`}
                      style={{ height: `${pct}%` }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Newly Unlocked Trophy Badges */}
          {summary.newlyEarnedBadges.length > 0 && (
            <div className="border border-[#fbbf24]/45 bg-[#1c1608]/80 p-3.5">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#fbbf24]">
                <Award className="h-4 w-4" />
                <span>Trophy Badge{summary.newlyEarnedBadges.length > 1 ? 's' : ''} Unlocked</span>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {summary.newlyEarnedBadges.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between border border-white/10 bg-[#0d1018] px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-bold text-white block truncate">{b.title}</span>
                      <span className="text-[11px] text-[#a1abbe] block truncate">{b.desc}</span>
                    </div>
                    <span className="ml-2 font-black text-[#fbbf24] whitespace-nowrap tabular-nums">
                      +{b.orbReward}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Orbs & Next Rank Forecast */}
          <div className="flex flex-col gap-2 border border-white/10 bg-[#101420] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-[#fbbf24] tabular-nums">
                <OrbIcon className="h-4 w-4" />
                <span>
                  {summary.cashOutApproved
                    ? `+${summary.cashedOutOrbs} Orbs Banked`
                    : summary.badgeBonusOrbs > 0
                    ? `+${summary.badgeBonusOrbs} Badge Orbs (${summary.unbankedOrbs} run Orbs need C-Rank+)`
                    : `${summary.unbankedOrbs} Orbs Unbanked (Needs C-Rank+)`}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#a1abbe]">{milestone.gapLabel}</p>
            </div>
            <button
              type="button"
              onClick={onOpenOrbVault}
              className="tactile-btn shrink-0 border border-[#fbbf24]/40 bg-[#1c1608] px-3.5 py-2 text-xs font-bold text-[#fbbf24] hover:border-[#fbbf24] cursor-pointer whitespace-nowrap"
            >
              Open Orb Shop
            </button>
          </div>

          {/* Footer Actions */}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onOpenSongSelect}
              className="tactile-btn flex items-center gap-2 border border-white/15 bg-[#141928] px-5 py-2.5 text-xs font-bold text-white hover:border-white/35 cursor-pointer whitespace-nowrap"
            >
              <ListMusic className="h-4 w-4" />
              <span>Track Select</span>
            </button>
            <button
              type="button"
              onClick={onRetry}
              className="tactile-btn lazer-slant flex items-center border border-[var(--accent-bright)] bg-[var(--accent)] px-6 py-2.5 text-xs font-black text-[var(--accent-on)] hover:bg-[var(--accent-bright)] cursor-pointer whitespace-nowrap"
            >
              <span className="lazer-unslant flex items-center gap-2">
                <RotateCcw className="h-4 w-4" />
                <span>Retry Stage</span>
              </span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
