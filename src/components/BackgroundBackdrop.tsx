import React from 'react';
import { BgFxMode, LevelBackgroundSetting } from '../types/game';

interface BackgroundBackdropProps {
  defaultImageUrl: string;
  levelSetting?: LevelBackgroundSetting;
  bgFxMode: BgFxMode;
  forceDimPct?: number;
  forceBlurPx?: number;
  accentRgb?: string;
}

export const BackgroundBackdrop: React.FC<BackgroundBackdropProps> = React.memo(
  ({
    defaultImageUrl,
    levelSetting,
    bgFxMode,
    forceDimPct,
    forceBlurPx,
    accentRgb = '255, 59, 130',
  }) => {
    const imageSrc = levelSetting?.customImageDataUrl || defaultImageUrl;
    const dimPct = forceDimPct !== undefined ? forceDimPct : levelSetting?.dimPct ?? 64;
    const blurPx = forceBlurPx !== undefined ? forceBlurPx : levelSetting?.blurPx ?? 3;

    return (
      <div
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#07080d] isolate"
        aria-hidden="true"
      >
        {imageSrc && (
          <img
            src={imageSrc}
            alt=""
            decoding="async"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
            style={{
              filter: bgFxMode === 'minimal' || blurPx <= 0 ? 'none' : `blur(${blurPx}px)`,
              transform:
                blurPx > 0 && bgFxMode !== 'minimal'
                  ? 'translate3d(0,0,0) scale(1.05)'
                  : 'translate3d(0,0,0) scale(1)',
              willChange: 'transform',
            }}
          />
        )}

        {/* Measured readability scrim */}
        <div
          className="absolute inset-0 bg-[#07080d] transition-opacity duration-200"
          style={{ opacity: Math.min(0.96, Math.max(0.2, dimPct / 100)) }}
        />

        {/* Subtle 90s Tokyo disco ambient floor wash + CRT scanlines */}
        {bgFxMode === 'dynamic' && (
          <>
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(circle at 26% 52%, rgba(${accentRgb}, 0.16) 0%, rgba(34, 211, 238, 0.06) 44%, transparent 78%)`,
              }}
            />
            <div className="disco-grid absolute inset-0 opacity-35" />
            <div className="tokyo-scanlines absolute inset-0 opacity-55" />
          </>
        )}
      </div>
    );
  },
);
