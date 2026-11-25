import React from 'react';
import { Disc3, Lock } from 'lucide-react';

interface DiscCartridgeProps {
  imageUrl: string;
  num: string;
  title: string;
  size?: 'sm' | 'md' | 'hero';
  spinning?: boolean;
  locked?: boolean;
  beatPulse?: boolean;
  className?: string;
}

const SIZE_MAP: Record<'sm' | 'md' | 'hero', string> = {
  sm: 'h-12 w-12',
  md: 'h-20 w-20',
  hero: 'h-52 w-52 sm:h-72 sm:w-72 lg:h-[332px] lg:w-[332px]',
};

/**
 * 90s Tokyo Disco Vinyl / Optical Turntable Disc centerpiece.
 */
export const DiscCartridge: React.FC<DiscCartridgeProps> = ({
  imageUrl,
  num,
  title,
  size = 'md',
  spinning = false,
  locked = false,
  beatPulse = false,
  className = '',
}) => {
  const isHero = size === 'hero';

  return (
    <div
      className={`relative shrink-0 select-none ${SIZE_MAP[size]} ${className}`}
      style={{
        transform: beatPulse ? 'scale(1.024)' : 'scale(1)',
        transition: 'transform 140ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Subtle Turntable Neon Glow Aura (inset-0 so it never overflows button box) */}
      {isHero && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            boxShadow:
              '0 0 54px rgba(var(--bg-accent-rgb, 255, 59, 130), 0.24), inset 0 0 0 1px rgba(255,255,255,0.12)',
          }}
        />
      )}

      {/* Rotating Vinyl / Optical Platter */}
      <div
        className={`relative h-full w-full overflow-hidden rounded-full border border-white/25 bg-[#0a0c13] shadow-2xl ${
          spinning ? 'animate-vinyl-cw' : ''
        }`}
      >
        {/* Subtle holographic CD / vinyl groove sheen */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full opacity-45"
          style={{
            background:
              'conic-gradient(from 35deg, transparent 0deg, rgba(255,255,255,0.24) 30deg, transparent 68deg, rgba(34,211,238,0.22) 140deg, transparent 210deg, rgba(255,59,130,0.24) 280deg, transparent 360deg)',
          }}
        />

        {/* Strobe & Vinyl Groove Rings */}
        <div className="pointer-events-none absolute inset-[4%] rounded-full border border-dashed border-white/15" />
        <div className="pointer-events-none absolute inset-[9%] rounded-full border border-white/10" />
        <div className="pointer-events-none absolute inset-[13.5%] rounded-full border border-white/5" />

        {/* Inner Track Artwork Label */}
        <div className="absolute inset-[17%] overflow-hidden rounded-full border border-white/30 bg-[#0e111a]">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title}
              referrerPolicy="no-referrer"
              className={`h-full w-full object-cover ${locked ? 'grayscale opacity-35' : ''}`}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1b2234] to-[#0b0e16]">
              <Disc3 className="h-1/2 w-1/2 text-white/30" />
            </div>
          )}

          {locked && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <Lock className="h-5 w-5 text-[#fbbf24]" />
            </div>
          )}
        </div>
      </div>

      {/* Stationary Machined Center Spindle */}
      <div
        className={`pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-[#090b10] shadow-inner ${
          isHero ? 'h-[25%] w-[25%]' : 'h-[31%] w-[31%]'
        }`}
      >
        <div className="flex flex-col items-center justify-center text-center">
          <span
            className={`tabular-nums font-extrabold tracking-widest text-[var(--accent-bright)] ${
              isHero ? 'text-xs' : 'text-[8px]'
            }`}
          >
            {num}
          </span>
          {isHero && (
            <span className="mt-0.5 text-[9px] font-semibold tracking-wider text-white/60">
              DISC
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
