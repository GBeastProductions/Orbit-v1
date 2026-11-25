import React, { useId } from 'react';

interface OrbIconProps {
  className?: string;
}

export const OrbIcon: React.FC<OrbIconProps> = ({ className = 'h-4 w-4' }) => {
  const uid = useId().replace(/:/g, '');
  const gradCore = `orbCore-${uid}`;
  const gradRing = `orbRing-${uid}`;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <defs>
        <radialGradient id={gradCore} cx="38%" cy="32%" r="65%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="35%" stopColor="#fde047" />
          <stop offset="78%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#ec4899" />
        </radialGradient>
        <linearGradient id={gradRing} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="50%" stopColor="#ff6ea3" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      {/* Tilted Orbital Halo */}
      <ellipse
        cx="12"
        cy="12"
        rx="10.2"
        ry="4.2"
        transform="rotate(-24 12 12)"
        stroke={`url(#${gradRing})`}
        strokeWidth="1.65"
        strokeLinecap="round"
        opacity="0.92"
      />
      {/* Central Faceted Orb */}
      <circle cx="12" cy="12" r="5.6" fill={`url(#${gradCore})`} />
      {/* Inner Specular Facet */}
      <path
        d="M9.6 9.8C10.5 8.8 11.9 8.4 13.1 8.8"
        stroke="#ffffff"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.95"
      />
      {/* Orbiting Sparkle Satellite */}
      <circle cx="19.8" cy="8.5" r="1.35" fill="#22d3ee" />
    </svg>
  );
};
