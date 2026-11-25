import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Check, Lock, SlidersHorizontal, Snowflake, Sparkles } from 'lucide-react';
import {
  CHASSIS_THEMES,
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  MOD_CATALOG,
} from '../data/catalog';
import { DifficultyId, ModCode, PlayerProfile, SongDefinition, ThemeId } from '../types/game';
import { OrbIcon } from './OrbIcon';

type ShopTab = 'all' | 'tracks' | 'mods' | 'themes' | 'tiers';

interface OrbShopScreenProps {
  profile: PlayerProfile;
  songs: SongDefinition[];
  onBack: () => void;
  onUnlockDifficulty: (diffId: DifficultyId, cost: number) => void;
  onUnlockSong: (songId: string, cost: number) => void;
  onUnlockTheme: (themeId: ThemeId, cost: number) => void;
  onEquipTheme: (themeId: ThemeId) => void;
  onUnlockMod: (code: ModCode, cost: number) => void;
  onToggleEquipMod: (code: ModCode) => void;
}

const SHOP_TABS: { id: ShopTab; label: string }[] = [
  { id: 'all', label: 'All Showcase' },
  { id: 'tracks', label: 'Tracks & Christmas' },
  { id: 'mods', label: 'Arcade Mods' },
  { id: 'themes', label: 'Cabinet Themes' },
  { id: 'tiers', label: 'Difficulty Tiers' },
];

export const OrbShopScreen: React.FC<OrbShopScreenProps> = ({
  profile,
  songs,
  onBack,
  onUnlockDifficulty,
  onUnlockSong,
  onUnlockTheme,
  onEquipTheme,
  onUnlockMod,
  onToggleEquipMod,
}) => {
  const [tab, setTab] = useState<ShopTab>('all');

  const unlockableSongs = songs.filter((s) => s.orbCost > 0);
  const shopMods = MOD_CATALOG.filter((m) => m.orbCost > 0);
  const allThemes = Object.keys(CHASSIS_THEMES) as ThemeId[];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.22 }}
      className="relative z-10 flex h-dvh w-full flex-col overflow-hidden"
    >
      {/* Golden-Pink Tokyo Atelier Spotlight Scrim */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 82% 18%, rgba(251, 191, 36, 0.14) 0%, rgba(255, 59, 130, 0.08) 38%, rgba(7, 8, 13, 0.94) 80%)',
        }}
      />

      {/* Top 3-Zone Header */}
      <header className="relative z-20 flex h-[60px] shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-[#080a11]/92 px-4 sm:px-8">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="tactile-btn lazer-slant-sm flex items-center border border-white/15 bg-[#121624] px-3.5 py-2 text-xs font-bold text-white hover:border-[var(--accent-bright)] cursor-pointer whitespace-nowrap shrink-0"
          >
            <span className="lazer-unslant-sm flex items-center gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </span>
          </button>
          <div className="flex items-baseline gap-2.5 min-w-0 truncate">
            <h1 className="font-display text-lg sm:text-2xl font-black tracking-tight text-white whitespace-nowrap">
              Orb Boutique
            </h1>
            <span className="hidden sm:inline text-xs font-semibold tracking-[0.2em] text-[#fbbf24] whitespace-nowrap">
              オーブショップ
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="lazer-slant-sm border border-[#fbbf24]/50 bg-[#1c1608] px-4 py-1.5 text-sm font-black text-[#fbbf24] tabular-nums">
            <span className="lazer-unslant-sm flex items-center gap-2">
              <OrbIcon className="h-4 w-4" />
              <span>{profile.orbs.toLocaleString()} Orbs</span>
            </span>
          </div>
        </div>
      </header>

      {/* Slanted Category Wing Strip */}
      <div className="relative z-20 flex shrink-0 items-center gap-2 overflow-x-auto border-b border-white/10 bg-[#0c101b]/90 px-4 py-3 sm:px-8">
        {SHOP_TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`tactile-btn lazer-slant border px-4 py-1.5 text-xs font-extrabold cursor-pointer whitespace-nowrap shrink-0 ${
                active
                  ? 'border-[#fbbf24] bg-[#fbbf24] text-[#140c02]'
                  : 'border-white/14 bg-[#121726] text-[#b6bfd1] hover:border-white/30 hover:text-white'
              }`}
            >
              <span className="lazer-unslant block">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Boutique Showcase */}
      <main className="orbit-scroll relative z-20 mx-auto w-full max-w-[1320px] flex-1 space-y-8 overflow-y-auto px-4 py-6 sm:px-8">
        {/* Featured Winter Spotlight (shown on 'all' or 'tracks') */}
        {(tab === 'all' || tab === 'tracks') && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display flex items-center gap-2 text-lg font-black text-white">
                <Snowflake className="h-4 w-4 text-[#38bdf8]" />
                <span>Unlockable Tracks · Christmas &amp; Arcade</span>
              </h2>
              <span className="text-xs text-[#a1abbe]">Unlock songs with Orbs to play anytime</span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {unlockableSongs.map((song) => {
                const unlocked = profile.devUnlocked || profile.unlockedSongs.includes(song.id);
                const canAfford = profile.orbs >= song.orbCost;
                const isChristmas = song.category === 'christmas';

                return (
                  <div
                    key={song.id}
                    className={`lazer-slant-sm group relative overflow-hidden border bg-[#0f1320] p-4 ${
                      isChristmas ? 'border-[#38bdf8]/45' : 'border-white/15'
                    }`}
                  >
                    {/* Right diagonal cover art bleed */}
                    <img
                      src={song.bgImageUrl}
                      alt=""
                      aria-hidden="true"
                      referrerPolicy="no-referrer"
                      className="pointer-events-none absolute inset-y-0 right-0 h-full w-1/2 object-cover opacity-22 transition-opacity group-hover:opacity-35"
                    />
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0f1320] via-[#0f1320]/88 to-transparent"
                    />

                    <div className="lazer-unslant-sm relative z-10 flex h-full flex-col justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider">
                          <span className={isChristmas ? 'text-[#38bdf8]' : 'text-[var(--accent-bright)]'}>
                            {isChristmas ? 'Christmas Special' : 'Arcade Stage'}
                          </span>
                          <span className="text-white/30">·</span>
                          <span className="text-[#a1abbe] tabular-nums">{song.bpm} BPM</span>
                        </div>
                        <h3 className="font-display mt-1 text-lg font-black text-white">{song.title}</h3>
                        <p className="text-xs text-[#a1abbe]">{song.artist} · {song.genre}</p>
                        <p className="mt-2 line-clamp-2 text-xs text-[#b6bfd1]">{song.desc}</p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-white/10">
                        {unlocked ? (
                          <span className="flex items-center gap-1.5 text-xs font-extrabold text-[#34d399]">
                            <Check className="h-4 w-4" />
                            <span>Unlocked in Library</span>
                          </span>
                        ) : (
                          <>
                            <span className="flex items-center gap-1.5 text-xs font-bold text-[#fbbf24] tabular-nums">
                              <OrbIcon className="h-4 w-4" />
                              <span>{song.orbCost} Orbs</span>
                            </span>
                            <button
                              type="button"
                              disabled={!canAfford}
                              onClick={() => onUnlockSong(song.id, song.orbCost)}
                              className="tactile-btn border border-[#fbbf24] bg-[#fbbf24] px-4 py-1.5 text-xs font-black text-[#140c02] hover:bg-[#fde047] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            >
                              Purchase
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Shop-Exclusive Arcade Mods */}
        {(tab === 'all' || tab === 'mods') && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display flex items-center gap-2 text-lg font-black text-white">
                <SlidersHorizontal className="h-4 w-4 text-[#a855f7]" />
                <span>Boutique Arcade Mods · 特別モッド</span>
              </h2>
              <span className="text-xs text-[#a1abbe]">Equip purchased Mods directly inside Track Select or Stage HUD</span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {shopMods.map((mod) => {
                const owned = profile.devUnlocked || profile.purchasedMods.includes(mod.code);
                const equipped = profile.equippedMods.includes(mod.code);
                const canAfford = profile.orbs >= mod.orbCost;

                return (
                  <div
                    key={mod.id}
                    className={`lazer-slant-sm border p-4 ${
                      equipped
                        ? 'border-[var(--accent-bright)] bg-[#19152b]'
                        : 'border-white/14 bg-[#101420]'
                    }`}
                  >
                    <div className="lazer-unslant-sm flex h-full flex-col justify-between gap-4">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sm font-black text-[#a855f7]">
                            [{mod.code}]
                          </span>
                          <span className="tabular-nums text-xs font-bold text-[#22d3ee]">
                            {mod.mult.toFixed(2)}x Score
                          </span>
                        </div>
                        <h3 className="font-display mt-1 text-lg font-black text-white">{mod.name}</h3>
                        <p className="mt-1.5 text-xs leading-relaxed text-[#b6bfd1]">{mod.desc}</p>
                      </div>

                      <div className="flex items-center justify-between border-t border-white/10 pt-3">
                        {owned ? (
                          <button
                            type="button"
                            onClick={() => onToggleEquipMod(mod.code)}
                            className={`tactile-btn w-full border py-2 text-xs font-extrabold cursor-pointer ${
                              equipped
                                ? 'border-[var(--accent-bright)] bg-[var(--accent)] text-[var(--accent-on)]'
                                : 'border-white/20 bg-[#171d2e] text-white hover:border-[var(--accent-bright)]'
                            }`}
                          >
                            {equipped ? 'Equipped (Click to Unequip)' : 'Owned · Equip Mod'}
                          </button>
                        ) : (
                          <>
                            <span className="flex items-center gap-1.5 text-xs font-bold text-[#fbbf24] tabular-nums">
                              <OrbIcon className="h-4 w-4" />
                              <span>{mod.orbCost} Orbs</span>
                            </span>
                            <button
                              type="button"
                              disabled={!canAfford}
                              onClick={() => onUnlockMod(mod.code, mod.orbCost)}
                              className="tactile-btn border border-[#fbbf24] bg-[#fbbf24] px-4 py-1.5 text-xs font-black text-[#140c02] hover:bg-[#fde047] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            >
                              Unlock Mod
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Cabinet Themes with Visual Disc Swatches */}
        {(tab === 'all' || tab === 'themes') && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display flex items-center gap-2 text-lg font-black text-white">
                <Sparkles className="h-4 w-4 text-[var(--accent-bright)]" />
                <span>Cabinet Themes · テーマ ({allThemes.length})</span>
              </h2>
              <span className="text-xs text-[#a1abbe]">Changes needle trails, canvas ring color &amp; UI accents</span>
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
              {allThemes.map((themeId) => {
                const t = CHASSIS_THEMES[themeId];
                const owned =
                  profile.devUnlocked || t.orbCost === 0 || profile.unlockedThemes.includes(themeId);
                const active = profile.theme === themeId;
                const canAfford = profile.orbs >= t.orbCost;

                return (
                  <div
                    key={themeId}
                    className={`lazer-slant-sm border p-4 ${
                      active
                        ? 'border-[var(--accent-bright)] bg-[#161c2d]'
                        : 'border-white/12 bg-[#101420]'
                    }`}
                  >
                    <div className="lazer-unslant-sm flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        {/* Miniature Disc Ring Swatch */}
                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-4 bg-[#07080d]"
                          style={{
                            borderColor: t.primary,
                            boxShadow: `0 0 14px rgba(${t.bgAccentRgb}, 0.45)`,
                          }}
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: t.secondary }}
                          />
                        </div>
                        <div className="min-w-0">
                          <span className="font-display block truncate text-sm font-extrabold text-white">
                            {t.label}
                          </span>
                          <span className="block truncate text-[11px] text-[#a1abbe]">
                            {t.jpLabel}
                          </span>
                        </div>
                      </div>

                      {active ? (
                        <div className="border border-[var(--accent-bright)]/40 bg-[var(--accent-dim)] py-1.5 text-center text-xs font-extrabold text-white">
                          Active Theme
                        </div>
                      ) : owned ? (
                        <button
                          type="button"
                          onClick={() => onEquipTheme(themeId)}
                          className="tactile-btn border border-white/20 bg-[#171d2e] py-1.5 text-xs font-bold text-white hover:border-white/40 cursor-pointer"
                        >
                          Equip Theme
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!canAfford}
                          onClick={() => onUnlockTheme(themeId, t.orbCost)}
                          className="tactile-btn flex items-center justify-center gap-1.5 border border-[#fbbf24] bg-[#fbbf24] py-1.5 text-xs font-black text-[#140c02] hover:bg-[#fde047] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer tabular-nums"
                        >
                          <OrbIcon className="h-3.5 w-3.5" />
                          <span>{t.orbCost} Orbs</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Difficulty Tiers */}
        {(tab === 'all' || tab === 'tiers') && (
          <section className="pb-4">
            <h2 className="font-display mb-3 text-lg font-black text-white">
              Difficulty Tiers · 難易度ランク
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {DIFFICULTY_ORDER.map((diffId) => {
                const cfg = DIFFICULTIES[diffId];
                const unlocked = profile.devUnlocked || profile.unlockedDiffs.includes(diffId);
                const canAfford = profile.orbs >= cfg.orbCost;

                return (
                  <div
                    key={diffId}
                    className="lazer-slant-sm flex flex-col justify-between border border-white/12 bg-[#101420] p-4"
                  >
                    <div className="lazer-unslant-sm flex h-full flex-col justify-between gap-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-display text-base font-black text-white">
                            {cfg.name}
                          </span>
                          <span className="tabular-nums text-xs font-bold text-[#22d3ee]">
                            {cfg.mult.toFixed(2)}x
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs text-[#a1abbe]">{cfg.desc}</p>
                      </div>

                      {unlocked ? (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-[#34d399]">
                          <Check className="h-3.5 w-3.5" />
                          <span>Unlocked</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={!canAfford}
                          onClick={() => onUnlockDifficulty(diffId, cfg.orbCost)}
                          className="tactile-btn flex items-center justify-center gap-1.5 border border-[#fbbf24] bg-[#fbbf24] py-2 text-xs font-black text-[#140c02] hover:bg-[#fde047] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer tabular-nums"
                        >
                          <Lock className="h-3.5 w-3.5" />
                          <span>{cfg.orbCost} Orbs</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </motion.div>
  );
};
