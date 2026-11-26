import React, {useMemo} from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Chunk, Word, chunkWords, clamp, hash} from '../lib/timeline';

type Props = {
  words: Word[];
  /** words (lowercase, no punctuation) that get an impact pulse */
  emphasis?: string[];
  /** words tinted with the accent colour */
  accent?: string[];
  accentColor?: string;
  /** vertical centre of the captions, 0..1 of the frame height */
  y?: number;
  /** hide captions between these times (seconds) */
  hidden?: [number, number][];
  /** optional per-time vertical position, overrides y */
  yAt?: (t: number) => number;
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9']/g, '');

const EXIT = 0.13; // seconds a chunk takes to leave

/**
 * Fluid word-by-word captions: each word rises in from a soft blur on a spring
 * exactly when it is spoken; the chunk drifts up and dissolves as the next arrives.
 */
export const Captions: React.FC<Props> = ({words, emphasis = [], accent = [], accentColor = '#f3b770', y = 0.63, hidden = [], yAt}) => {
  const frame = useCurrentFrame();
  const {fps, height} = useVideoConfig();
  const t = frame / fps;
  const chunks = useMemo(() => chunkWords(words), [words]);

  const active: {chunk: Chunk; index: number}[] = [];
  chunks.forEach((chunk, index) => {
    if (t >= chunk.start - 0.06 && t < chunk.end + EXIT) active.push({chunk, index});
  });
  if (hidden.some(([a, b]) => t >= a && t < b)) return null;

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {active.map(({chunk, index}) => {
        const exitP = clamp((t - chunk.end) / EXIT);
        // constant gentle drift so the text never looks frozen
        const drift = Math.sin(t * 1.3 + index) * 3;
        return (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: 70,
              right: 70,
              top: height * (yAt ? yAt(chunk.start) : y),
              transform: `translateY(calc(-50% + ${drift - exitP * 46}px))`,
              opacity: (1 - exitP) * (1 - exitP),
              filter: exitP > 0 ? `blur(${exitP * 8}px)` : undefined,
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              columnGap: 22,
              rowGap: 4,
              textAlign: 'center',
            }}
          >
            {chunk.words.map((w, i) => {
              const local = frame - Math.round((w.start - 0.03) * fps);
              const p = local < 0 ? 0 : spring({frame: local, fps, config: {damping: 15, mass: 0.55, stiffness: 170}});
              const key = norm(w.text);
              const isEmph = emphasis.includes(key);
              const isAccent = accent.includes(key);
              let scale = 0.9 + 0.1 * p;
              let shakeX = 0;
              let shakeY = 0;
              if (isEmph && local >= 0) {
                const pulse = spring({frame: local, fps, config: {damping: 9, mass: 0.4, stiffness: 260}});
                scale *= 1.22 - 0.22 * pulse;
                const decay = Math.exp(-local / 7);
                shakeX = (hash(local + i * 7) - 0.5) * 14 * decay;
                shakeY = (hash(local * 3.1 + i) - 0.5) * 10 * decay;
              }
              return (
                <span
                  key={i}
                  style={{
                    display: 'inline-block',
                    fontFamily: 'Inter',
                    fontWeight: 800,
                    fontSize: 76,
                    lineHeight: 1.05,
                    letterSpacing: '-0.01em',
                    textTransform: 'uppercase',
                    color: isAccent ? accentColor : '#ffffff',
                    opacity: clamp(p * 1.4),
                    transform: `translate(${shakeX}px, ${(1 - p) * 34 + shakeY}px) scale(${scale})`,
                    filter: p < 0.98 ? `blur(${(1 - p) * 10}px)` : undefined,
                    textShadow: '0 4px 28px rgba(0,0,0,0.85), 0 1px 3px rgba(0,0,0,0.9)',
                  }}
                >
                  {w.text.replace(/^[—"“]+|["”]+$/g, '').replace(/—/g, '')}
                </span>
              );
            })}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
