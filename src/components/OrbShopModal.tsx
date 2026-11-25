import React from 'react';
import { motion } from 'motion/react';
import { Check, Coins, Lock, Snowflake, X } from 'lucide-react';
import { CHASSIS_THEMES, DIFFICULTIES, DIFFICULTY_ORDER } from '../data/catalog';
import { DifficultyId, PlayerProfile, SongDefinition, ThemeId } from '../types/game';

interface OrbShopModalProps {
  open: boolean;
  profile: PlayerProfile;
  songs: SongDefinition[];
  onUnlockDifficulty: (diffId: DifficultyId, cost: number) => void;
  onUnlockSong: (songId: string, cost: number) => void;
  onUnlockTheme: (themeId: ThemeId, cost: number) => void;
  onEquipTheme: (themeId: ThemeId) => void;
  onClose: () => void;
}

export const OrbShopModal: React.FC<OrbShopModalProps> = ({
  open,
  profile,
  songs,
  onUnlockDifficulty,
  onUnlockSong,
  onUnlockTheme,
  onEquipTheme,
  onClose,
}) => {
  if (!open) return null;

  const unlockableSongs = songs.filter((s) => s.orbCost > 0);
  const allThemes = Object.keys(CHASSIS_THEMES) as ThemeId[];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="orbVaultTitle"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="flex max-h-[86dvh] w-full max-w-3xl flex-col border border-white/15 bg-[#0b0e16] shadow-2xl"
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-[#121624] px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <Coins className="h-5 w-5 shrink-0 text-[#fbbf24]" />
            <div className="min-w-0">
              <h2
                id="orbVaultTitle"
                className="font-display text-lg font-extrabold tracking-tight text-white"
              >
                Orb Shop &amp; Unlocks · ショップ
              </h2>
              <p className="text-xs text-[#a1abbe]">
                Earn Orbs from PERFECT hits and C-rank+ clears to unlock Christmas tracks, difficulties, and themes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="tabular-nums text-sm font-black text-[#fbbf24]">
              {profile.orbs.toLocaleString()} Orbs
            </span>
            <button
              type="button"
              onClick={onClose}
              className="tactile-btn border border-white/15 bg-[#181e30] p-2 text-[#d1d5db] hover:text-white cursor-pointer"
              aria-label="Close Orb Shop"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="orbit-scroll flex-1 space-y-6 overflow-y-auto p-6">
          {/* Unlockable Tracks (Christmas & Bonus Arcade) */}
          <div>
            <h3 className="font-display mb-3 text-sm font-extrabold text-white">
              Unlockable Tracks · Christmas &amp; Arcade
            </h3>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {unlockableSongs.map((song) => {
                const unlocked =
                  profile.devUnlocked || profile.unlockedSongs.includes(song.id);
                const canAfford = profile.orbs >= song.orbCost;

                return (
                  <div
                    key={song.id}
                    className={`flex items-center justify-between gap-3 border bg-[#101420] p-3 ${
                      song.category === 'christmas'
                        ? 'border-[#38bdf8]/25 border-l-2 border-l-[#38bdf8]'
                        : 'border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={song.bgImageUrl}
                        alt={song.title}
                        referrerPolicy="no-referrer"
                        className="h-10 w-10 shrink-0 border border-white/15 object-cover"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {song.category === 'christmas' && (
                            <Snowflake className="h-3.5 w-3.5 shrink-0 text-[#38bdf8]" />
                          )}
                          <span className="font-display truncate text-sm font-bold text-white">
                            {song.title}
                          </span>
                        </div>
                        <span className="block truncate text-xs text-[#b6bfd1]">
                          {song.artist} · {song.category === 'christmas' ? 'Christmas' : 'Arcade'}
                        </span>
                      </div>
                    </div>

                    {unlocked ? (
                      <span className="flex items-center gap-1 text-xs font-bold text-[#34d399] whitespace-nowrap shrink-0">
                        <Check className="h-3.5 w-3.5" />
                        <span>Owned</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={!canAfford}
                        onClick={() => onUnlockSong(song.id, song.orbCost)}
                        className="tactile-btn shrink-0 border border-[#fbbf24] bg-[#fbbf24] px-3 py-1.5 text-xs font-black text-[#140c02] hover:bg-[#fde047] disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap tabular-nums"
                      >
                        {song.orbCost} Orbs
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Difficulty Tiers */}
          <div className="border-t border-white/10 pt-5">
            <h3 className="font-display mb-3 text-sm font-extrabold text-white">
              Difficulty Tiers
            </h3>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
              {DIFFICULTY_ORDER.map((diffId) => {
                const cfg = DIFFICULTIES[diffId];
                const unlocked =
                  profile.devUnlocked || profile.unlockedDiffs.includes(diffId);
                const canAfford = profile.orbs >= cfg.orbCost;

                return (
                  <div
                    key={diffId}
                    className="flex flex-col justify-between gap-2 border border-white/10 bg-[#101420] p-3"
                  >
                    <div>
                      <span className="font-display block text-sm font-extrabold text-white">
                        {cfg.name}
                      </span>
                      <span className="tabular-nums text-[11px] text-[#a1abbe]">
                        {cfg.mult.toFixed(2)}x Mult
                      </span>
                    </div>
                    {unlocked ? (
                      <span className="text-xs font-bold text-[#34d399]">Unlocked</span>
                    ) : (
                      <button
                        type="button"
                        disabled={!canAfford}
                        onClick={() => onUnlockDifficulty(diffId, cfg.orbCost)}
                        className="tactile-btn flex items-center justify-center gap-1 border border-[#fbbf24] bg-[#fbbf24] px-2.5 py-1.5 text-xs font-black text-[#140c02] hover:bg-[#fde047] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer tabular-nums"
                      >
                        <Lock className="h-3 w-3" />
                        <span>{cfg.orbCost}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tokyo Disco Chassis Themes */}
          <div className="border-t border-white/10 pt-5">
            <h3 className="font-display mb-3 text-sm font-extrabold text-white">
              Cabinet Themes · テーマ
            </h3>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {allThemes.map((tid) => {
                const theme = CHASSIS_THEMES[tid];
                const owned =
                  profile.devUnlocked ||
                  theme.orbCost === 0 ||
                  profile.unlockedThemes.includes(tid);
                const equipped = profile.theme === tid;

                return (
                  <div
                    key={tid}
                    className={`flex items-center justify-between gap-3 border p-3 ${
                      equipped
                        ? 'border-[var(--accent-bright)] bg-[#171c2b]'
                        : 'border-white/10 bg-[#101420]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="h-5 w-5 shrink-0 border border-white/25"
                        style={{ backgroundColor: theme.primary }}
                      />
                      <div className="min-w-0">
                        <span className="block truncate text-xs font-bold text-white">
                          {theme.label}
                        </span>
                        <span className="block truncate text-[11px] text-[#a1abbe]">
                          {theme.jpLabel}
                        </span>
                      </div>
                    </div>

                    {equipped ? (
                      <span className="text-xs font-bold text-[var(--accent-bright)] whitespace-nowrap">
                        Active
                      </span>
                    ) : owned ? (
                      <button
                        type="button"
                        onClick={() => onEquipTheme(tid)}
                        className="tactile-btn border border-white/20 bg-[#191f30] px-3 py-1 text-xs font-bold text-white hover:border-white/40 cursor-pointer whitespace-nowrap"
                      >
                        Equip
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={profile.orbs < theme.orbCost}
                        onClick={() => onUnlockTheme(tid, theme.orbCost)}
                        className="tactile-btn border border-[#fbbf24] bg-[#fbbf24] px-3 py-1 text-xs font-black text-[#140c02] hover:bg-[#fde047] disabled:opacity-40 cursor-pointer whitespace-nowrap tabular-nums"
                      >
                        {theme.orbCost} Orbs
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
