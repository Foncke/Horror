import React from 'react';
import {spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {clamp} from '../lib/timeline';

/** Choice label (letter badge + text) with a line drawn to a point in the scene. */
export const Callout: React.FC<{
  letter: string;
  text: string;
  color: string;
  at: number; // seconds when it appears
  anchor: {x: number; y: number};
  label: {x: number; y: number};
}> = ({letter, text, color, at, anchor, label}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const local = frame - Math.round(at * fps);
  if (local < 0) return null;
  const pop = spring({frame: local, fps, config: {damping: 14, mass: 0.6, stiffness: 160}});
  const draw = clamp(local / (0.35 * fps));
  const dx = anchor.x - label.x;
  const dy = anchor.y - label.y;
  const len = Math.hypot(dx, dy);
  const pulse = 1 + 0.25 * Math.max(0, Math.sin(local / 9));
  return (
    <>
      <svg width="1080" height="1920" style={{position: 'absolute', inset: 0}}>
        <line x1={label.x} y1={label.y} x2={label.x + dx * draw} y2={label.y + dy * draw} stroke="white" strokeWidth={3} strokeOpacity={0.9} strokeDasharray={len} />
        {draw >= 1 && (
          <>
            <circle cx={anchor.x} cy={anchor.y} r={16 * pulse} fill={color} opacity={0.25} />
            <circle cx={anchor.x} cy={anchor.y} r={8} fill={color} stroke="white" strokeWidth={3} />
          </>
        )}
      </svg>
      <div
        style={{
          position: 'absolute',
          left: label.x,
          top: label.y,
          transform: `translate(-50%, -50%) scale(${0.6 + 0.4 * pop})`,
          opacity: clamp(pop * 1.5),
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '14px 26px 14px 14px',
          background: 'rgba(12,12,16,0.82)',
          border: '2px solid rgba(255,255,255,0.85)',
          borderRadius: 40,
          boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
          whiteSpace: 'nowrap',
        }}
      >
        <div style={{width: 52, height: 52, borderRadius: 26, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter', fontWeight: 800, fontSize: 30, color: '#111'}}>{letter}</div>
        <div style={{fontFamily: 'Inter', fontWeight: 800, fontSize: 36, color: 'white', letterSpacing: '0.01em'}}>{text}</div>
      </div>
    </>
  );
};
