import React from 'react';

interface IconProps {
  className?: string;
}

/**
 * Clean monochrome white-first orbital Saturn planet + 4-point star emblem
 * matching the ORBIT UI icon system. Colorizable via CSS text-* utilities.
 */
export const OrbIcon: React.FC<IconProps> = ({ className = 'h-4 w-4 text-white' }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      {/* 4-point star sparkle upper-left */}
      <path
        d="M5.4 2.4L6.25 4.75L8.6 5.6L6.25 6.45L5.4 8.8L4.55 6.45L2.2 5.6L4.55 4.75L5.4 2.4Z"
        fill="currentColor"
      />
      {/* Central Orb sphere */}
      <circle cx="13" cy="13" r="4.5" fill="currentColor" />
      {/* Tilted orbital halo ring */}
      <ellipse
        cx="13"
        cy="13"
        rx="9.5"
        ry="3.6"
        transform="rotate(-30 13 13)"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
};

/**
 * Clean geometric open-book + rising star emblem for The Index.
 */
export const IndexIcon: React.FC<IconProps> = ({ className = 'h-5 w-5 text-white' }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      {/* Center rising 4-point sparkle */}
      <path
        d="M12 2.2L12.9 4.55L15.2 5.45L12.9 6.35L12 8.7L11.1 6.35L8.8 5.45L11.1 4.55L12 2.2Z"
        fill="currentColor"
      />
      {/* Left open book page */}
      <path
        d="M3.2 8.2L11.6 11.4V20.5L3.2 17.3V8.2Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      {/* Right open book page */}
      <path
        d="M20.8 8.2L12.4 11.4V20.5L20.8 17.3V8.2Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
    </svg>
  );
};
