import React from 'react';
import { MASCOT, GRADIENT_ID, mascotRects } from '../mascot.js';

const RECTS = mascotRects();
const BODY = RECTS.filter((r) => r.ch !== 'e');
const EYES = RECTS.filter((r) => r.ch === 'e');

/**
 * The logo character. Eyes are grouped so a blink scales them as one shape;
 * scaling each row separately would leave two thin lines instead of a blink.
 */
export default function Mascot({ className = '' }) {
  const { size, gradient, fills } = MASCOT;
  return (
    <svg
      className={`mascot ${className}`}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="FlowJS"
    >
      <defs>
        <linearGradient
          id={GRADIENT_ID}
          gradientUnits="userSpaceOnUse"
          x1={gradient.x1} y1={gradient.y1} x2={gradient.x2} y2={gradient.y2}
        >
          {gradient.stops.map(([offset, color]) => <stop key={offset} offset={offset} stopColor={color} />)}
        </linearGradient>
      </defs>

      {BODY.map((r) => (
        <rect
          key={`${r.x}-${r.y}`}
          x={r.x} y={r.y} width={r.w} height="1"
          fill={r.ch === '#' ? `url(#${GRADIENT_ID})` : fills[r.ch]}
        />
      ))}

      <g className="mascot__eyes" fill={fills.e}>
        {EYES.map((r) => <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height="1" />)}
      </g>
    </svg>
  );
}
