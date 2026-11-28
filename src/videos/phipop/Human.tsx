import React, {useMemo} from 'react';
import * as THREE from 'three';
import {canvasTexture} from '../../three/textures';

/**
 * A Thai villager from Isan with realistic proportions (Phi Pop only; the other videos keep their toy figures).
 * Women wear a pha sin (woven tube skirt) and a blouse; men an indigo mor hom shirt with a checked pha khao ma
 * at the waist; the elder a white blouse, dark pha sin and a sabai shawl, hair cropped short.
 * Feet at the group origin, faces +z. About 1.58 m tall when standing.
 */
export type HumanFace = 'smile' | 'neutral' | 'sleep' | 'possessed' | 'avert' | 'wake' | 'elder' | 'krasue' | 'tired';
export type Outfit = 'woman' | 'man' | 'elder' | 'robe';

export type HumanPose = {
  hipY?: number; // 0.88 standing, ~0.45 crouching, ~0.14 sitting on a mat
  thigh?: number; // thigh pitch, - lifts the knees forward
  knee?: number; // + bends the shin back
  spread?: number; // knees apart
  hunch?: number; // torso pitch, + leans forward
  armL?: number; // shoulder pitch, - raises forward
  armR?: number;
  outL?: number;
  outR?: number;
  elbowL?: number; // - bends the forearm forward/up
  elbowR?: number;
  curl?: number; // finger curl 0..1
  headPitch?: number; // + looks down
  headYaw?: number;
  headRoll?: number;
  breathe?: number;
  walk?: number; // walk-cycle phase in radians (0 = standing still)
  headOnly?: boolean; // draw only the head (and hair), with its centre at the group origin
  noHead?: boolean; // draw the body without its head
  stride?: number; // how far the legs swing when walking
};

const isPossessed = (f: HumanFace) => f === 'possessed' || f === 'avert' || f === 'wake' || f === 'krasue';

type Hair = 'long' | 'bun' | 'crop' | 'short' | 'hood';
type Look = {skin: string; top: string; skirt: string; pattern: 'woman' | 'elder' | null; hair: string; style: Hair; messy: boolean; sabai: boolean; waistCloth: boolean};

const LOOKS = (outfit: Outfit, face: HumanFace): Look => {
  const possessed = isPossessed(face);
  if (outfit === 'man') return {skin: '#b5825a', top: '#2b3550', skirt: '#22232a', pattern: null, hair: '#121010', style: 'short', messy: false, sabai: false, waistCloth: true};
  if (outfit === 'robe') return {skin: '#8a6a52', top: '#2a2420', skirt: '#2a2420', pattern: null, hair: '#0d0b0a', style: 'hood', messy: false, sabai: false, waistCloth: false};
  if (outfit === 'elder') return {skin: '#a8784f', top: '#e2dbcd', skirt: '#2a2434', pattern: 'elder', hair: '#5a5650', style: 'crop', messy: false, sabai: true, waistCloth: false};
  if (face === 'krasue') return {skin: '#c9c7bf', top: '#3a4a5c', skirt: '#4a1a22', pattern: 'woman', hair: '#070606', style: 'long', messy: true, sabai: false, waistCloth: false};
  if (face === 'tired') return {skin: '#b99a80', top: '#3a4a5c', skirt: '#4a1a22', pattern: 'woman', hair: '#0c0a09', style: 'long', messy: true, sabai: false, waistCloth: false};
  // the host: neat bun by day; hair down and matted once the spirit has her
  return {
    skin: possessed ? '#76806f' : '#c4926a',
    top: '#3f5f7f',
    skirt: '#6a1f2a',
    pattern: 'woman',
    hair: '#0c0a09',
    style: possessed || face === 'sleep' ? 'long' : 'bun',
    messy: possessed,
    sabai: false,
    waistCloth: false,
  };
};

// --- textures -------------------------------------------------------------------
/** Woven pha sin: horizontal bands of mudmee (ikat) zigzags and a plain hem. */
const phaSin = (kind: 'woman' | 'elder') =>
  canvasTexture(
    `phasin-${kind}`,
    128,
    512,
    (ctx, w, h) => {
      const base = kind === 'woman' ? '#6a1f2a' : '#2a2434';
      const a = kind === 'woman' ? '#c9a24a' : '#6f6a8a';
      const b = kind === 'woman' ? '#2f6f72' : '#4a4560';
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      // body of the skirt: thin ikat stripes
      for (let y = 40; y < h * 0.78; y += 34) {
        ctx.strokeStyle = y % 68 ? a : b;
        ctx.lineWidth = 5;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 16) ctx.lineTo(x, y + (x % 32 ? 6 : -6));
        ctx.stroke();
      }
      // the woven border near the hem (tin sin)
      ctx.fillStyle = b;
      ctx.fillRect(0, h * 0.8, w, h * 0.08);
      ctx.fillStyle = a;
      for (let x = 0; x < w; x += 16) ctx.fillRect(x + 4, h * 0.82, 8, h * 0.04);
      ctx.fillStyle = kind === 'woman' ? '#3a0f16' : '#18141f';
      ctx.fillRect(0, h * 0.9, w, h * 0.1);
    },
    {repeat: [5, 1]},
  );

const rng = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** Hair on the scalp: strands combed down from the crown, parted at the front (u = 0.5),
 *  solid underneath and ending in a ragged, uneven hairline. Light grey: the material tints it. */
const scalpStrands = () =>
  canvasTexture('hair-scalp4', 512, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const r = rng(7);
    ctx.fillStyle = 'rgb(105,105,105)';
    ctx.fillRect(0, 0, w, h * 0.84);
    ctx.lineCap = 'round';
    for (let i = 0; i < 2200; i++) {
      const x = r() * w;
      const len = h * (0.82 + r() * 0.18);
      const d = (x - w / 2) / (w * 0.22);
      const lean = Math.abs(d) < 1 ? Math.sign(d) * (1 - Math.abs(d)) * 26 : 0; // swept away from the parting
      const v = 80 + Math.floor(r() * 150);
      ctx.strokeStyle = 'rgba(' + v + ',' + v + ',' + v + ',' + (0.55 + r() * 0.45) + ')';
      ctx.lineWidth = 1 + r() * 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + lean * 0.6, len * 0.4, x + lean, len * 0.75, x + lean + (r() - 0.5) * 4, len);
      ctx.stroke();
    }
    // the parting itself: a thin darker line from the crown to the front
    ctx.strokeStyle = 'rgba(40,40,40,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.15);
    ctx.lineTo(w / 2, h * 0.7);
    ctx.stroke();
  });

/** Long hair: dense strands in the middle, thinning out to loose strands at both edges, ragged ends. */
const hairStrands = () =>
  canvasTexture('hair-strands3', 512, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const r = rng(11);
    ctx.lineCap = 'round';
    for (let i = 0; i < 1500; i++) {
      const x = r() * w;
      const edge = Math.min(x, w - x) / (w * 0.12); // < 1 near the open front edges
      if (edge < 1 && r() > edge * edge) continue;
      const len = h * (0.68 + r() * 0.32);
      const sway = (r() - 0.5) * 12;
      const v = 80 + Math.floor(r() * 150);
      ctx.strokeStyle = 'rgba(' + v + ',' + v + ',' + v + ',' + (0.6 + r() * 0.4) + ')';
      ctx.lineWidth = 1.5 + r() * 2.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + sway, len * 0.35, x - sway, len * 0.7, x + sway * 0.5, len);
      ctx.stroke();
    }
    // a little sheen near the top
    for (let i = 0; i < 90; i++) {
      const x = w * 0.1 + r() * w * 0.8;
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.15 + r() * 0.2) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, h * 0.04);
      ctx.lineTo(x + (r() - 0.5) * 6, h * (0.2 + r() * 0.25));
      ctx.stroke();
    }
  });

/** A loose lock: a bundle of strands, thick at the root and thinning to a few wisps at the tip. */
const lockStrands = () =>
  canvasTexture('hair-lock3', 64, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const r = rng(29);
    ctx.lineCap = 'round';
    for (let i = 0; i < 40; i++) {
      const x = w / 2 + (r() - 0.5) * w * 0.7;
      const y0 = r() * h * 0.08;
      const len = h * (0.45 + r() * 0.55);
      const tip = w / 2 + (x - w / 2) * 0.4 + (r() - 0.5) * 8; // the strands gather towards the tip
      const v = 80 + Math.floor(r() * 150);
      ctx.strokeStyle = 'rgba(' + v + ',' + v + ',' + v + ',' + (0.6 + r() * 0.4) + ')';
      ctx.lineWidth = 1.2 + r() * 1.8;
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.bezierCurveTo(x, len * 0.4, tip, len * 0.75, tip, len);
      ctx.stroke();
    }
  });

/** Phi Pop's hair (v1). Long black hair: many fine strands, a little sheen, a ragged uneven end. */
const hairStrandsV1 = () =>
  canvasTexture('hair-strands', 256, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    let seed = 11;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 420; i++) {
      const x = r() * w;
      const len = h * (0.72 + r() * 0.28);
      const sway = (r() - 0.5) * 14;
      const shade = 8 + Math.floor(r() * 22);
      ctx.strokeStyle = 'rgba(' + shade + ',' + shade + ',' + (shade + 4) + ',' + (0.55 + r() * 0.45) + ')';
      ctx.lineWidth = 1.5 + r() * 2.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + sway, len * 0.35, x - sway, len * 0.7, x + sway * 0.5, len);
      ctx.stroke();
    }
    // faint cold sheen
    for (let i = 0; i < 60; i++) {
      const x = r() * w;
      ctx.strokeStyle = 'rgba(120,140,160,' + (0.08 + r() * 0.1) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, h * 0.05);
      ctx.lineTo(x + (r() - 0.5) * 6, h * (0.3 + r() * 0.3));
      ctx.stroke();
    }
  });

/** A loose lock: a few separate strands with gaps between them. */
const lockStrandsV1 = () =>
  canvasTexture('hair-lock', 64, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    let seed = 29;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 22; i++) {
      const x = 6 + r() * (w - 12);
      const len = h * (0.6 + r() * 0.4);
      const sway = (r() - 0.5) * 10;
      ctx.strokeStyle = 'rgba(10,10,12,' + (0.7 + r() * 0.3) + ')';
      ctx.lineWidth = 2 + r() * 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + sway, len * 0.4, x - sway, len * 0.75, x + sway * 0.4, len);
      ctx.stroke();
    }
  });

/** Checked pha khao ma cloth. */
const khaoMa = () =>
  canvasTexture(
    'khaoma2',
    64,
    64,
    (ctx, w, h) => {
      ctx.fillStyle = '#7d7466';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(120,30,30,0.85)';
      ctx.fillRect(0, 0, w / 2, h);
      ctx.fillStyle = 'rgba(40,60,140,0.55)';
      ctx.fillRect(0, 0, w, h / 2);
    },
    {repeat: [10, 2]},
  );

// --- faces --------------------------------------------------------------------
const drawFace = (kind: HumanFace, ctx: CanvasRenderingContext2D, w: number) => {
  ctx.clearRect(0, 0, w, 512);
  const cx = w / 2;
  const eyeY = 247;
  const possessed = isPossessed(kind);
  const ink = 'rgba(22,14,10,0.95)';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const shade = (x: number, y: number, rx: number, ry: number, a: number, color = '60,34,20') => {
    const g = ctx.createRadialGradient(x, y, 1, x, y, Math.max(rx, ry));
    g.addColorStop(0, `rgba(${color},${a})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  // soft, broad nose and cheek shading
  for (const s of [-1, 1]) shade(cx + s * 34, eyeY + 60, 26, 62, 0.2);
  shade(cx, eyeY + 118, 52, 16, 0.22);
  for (const s of [-1, 1]) shade(cx + s * 175, eyeY + 70, 70, 60, 0.12, '160,70,50'); // warm cheeks

  if (possessed) {
    // sunken black sockets, hollow cheeks, and dark veins crawling out from the eyes and mouth
    for (const s of [-1, 1]) {
      shade(cx + s * 120, eyeY + 2, 112, 88, 1.0, '6,6,8');
      shade(cx + s * 120, eyeY + 2, 82, 60, 1.0, '3,3,4');
      shade(cx + s * 165, eyeY + 140, 64, 84, 0.55, '18,24,20');
    }
    ctx.strokeStyle = 'rgba(20,32,24,0.85)';
    const vein = (x: number, y: number, ang: number, len: number, wdt: number, depth: number) => {
      if (depth <= 0 || len < 8) return;
      const x2 = x + Math.cos(ang) * len;
      const y2 = y + Math.sin(ang) * len;
      ctx.lineWidth = wdt;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo((x + x2) / 2 + Math.sin(ang * 7) * 8, (y + y2) / 2 + Math.cos(ang * 5) * 8, x2, y2);
      ctx.stroke();
      vein(x2, y2, ang + 0.45, len * 0.62, wdt * 0.7, depth - 1);
      vein(x2, y2, ang - 0.5, len * 0.58, wdt * 0.7, depth - 1);
    };
    for (const s of [-1, 1]) {
      vein(cx + s * 150, eyeY + 50, Math.PI / 2 + s * 0.5, 55, 5, 4);
      vein(cx + s * 95, eyeY - 55, -Math.PI / 2 - s * 0.35, 50, 4, 3);
      vein(cx + s * 200, eyeY, s > 0 ? 0.2 : Math.PI - 0.2, 45, 4, 3);
      vein(cx + s * 40, eyeY + 190, Math.PI / 2 + s * 0.3, 40, 4, 3);
    }
  }
  if (kind === 'tired') {
    for (const s of [-1, 1]) shade(cx + s * 122, eyeY + 30, 80, 42, 0.55, '40,24,30'); // dark rings under the eyes
  }
  if (kind === 'elder') {
    ctx.strokeStyle = 'rgba(70,40,25,0.45)';
    ctx.lineWidth = 4;
    for (const s of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.arc(cx + s * 178, eyeY + 2, 20 + k * 9, s < 0 ? Math.PI * 0.75 : -Math.PI * 0.25, s < 0 ? Math.PI * 1.25 : Math.PI * 0.25);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(cx + s * 44, eyeY + 112);
      ctx.quadraticCurveTo(cx + s * 72, eyeY + 160, cx + s * 64, eyeY + 200);
      ctx.stroke();
    }
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(cx - 70, eyeY - 108 - k * 16);
      ctx.quadraticCurveTo(cx, eyeY - 114 - k * 16, cx + 70, eyeY - 108 - k * 16);
      ctx.stroke();
    }
  }

  // eyes: almond-shaped; possessed eyes are solid black (the glowing pupil is a separate mesh)
  for (const s of [-1, 1]) {
    const ex = cx + s * 122;
    const open = kind === 'sleep' ? 0 : kind === 'wake' || kind === 'krasue' ? 1.3 : kind === 'smile' ? 0.55 : kind === 'tired' ? 0.5 : 0.85;
    if (open === 0) {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(ex - 50, eyeY);
      ctx.quadraticCurveTo(ex, eyeY + 12, ex + 50, eyeY - 2);
      ctx.stroke();
      continue;
    }
    const ry = 24 * open;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(ex - s * 62, eyeY + 4);
    ctx.quadraticCurveTo(ex - s * 10, eyeY - ry * 1.55, ex + s * 62, eyeY - 6);
    ctx.quadraticCurveTo(ex, eyeY + ry * 1.05, ex - s * 62, eyeY + 4);
    ctx.closePath();
    ctx.fillStyle = possessed ? '#050505' : '#efe7dc';
    ctx.fill();
    ctx.clip();
    if (!possessed) {
      const ix = ex;
      ctx.fillStyle = '#2a1a10';
      ctx.beginPath();
      ctx.arc(ix, eyeY - 4, 23, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0a0706';
      ctx.beginPath();
      ctx.arc(ix, eyeY - 4, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(ix + 7, eyeY - 11, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // upper lid
    ctx.strokeStyle = ink;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(ex - s * 64, eyeY + 4);
    ctx.quadraticCurveTo(ex - s * 10, eyeY - ry * 1.6, ex + s * 66, eyeY - 7);
    ctx.stroke();
  }
  // brows: straight and fine (heavy and pulled down when possessed)
  ctx.strokeStyle = ink;
  ctx.lineWidth = kind === 'elder' ? 8 : possessed ? 13 : 10;
  for (const s of [-1, 1]) {
    const y0 = eyeY - (kind === 'wake' ? 70 : possessed ? 50 : 62);
    ctx.beginPath();
    ctx.moveTo(cx + s * 66, y0 + (possessed ? 10 : 0));
    ctx.quadraticCurveTo(cx + s * 120, y0 - 10, cx + s * 182, y0 + 2);
    ctx.stroke();
  }
  // nose: soft wings
  ctx.strokeStyle = 'rgba(70,38,22,0.7)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(cx - 34, eyeY + 96);
  ctx.quadraticCurveTo(cx - 18, eyeY + 110, cx, eyeY + 104);
  ctx.quadraticCurveTo(cx + 18, eyeY + 110, cx + 34, eyeY + 96);
  ctx.stroke();
  // mouth
  const my = eyeY + 172;
  if (kind === 'smile') {
    ctx.fillStyle = '#7a3a33';
    ctx.beginPath();
    ctx.moveTo(cx - 56, my - 8);
    ctx.quadraticCurveTo(cx, my + 32, cx + 56, my - 8);
    ctx.quadraticCurveTo(cx, my + 6, cx - 56, my - 8);
    ctx.fill();
    ctx.fillStyle = '#f1ebe2';
    ctx.beginPath();
    ctx.moveTo(cx - 42, my - 3);
    ctx.quadraticCurveTo(cx, my + 12, cx + 42, my - 3);
    ctx.quadraticCurveTo(cx, my + 4, cx - 42, my - 3);
    ctx.fill();
  } else if (kind === 'krasue') {
    // the jaw hangs far too low: a long dark gape, a row of stained teeth, dark streaks down the chin
    ctx.fillStyle = '#0a0404';
    ctx.beginPath();
    ctx.moveTo(cx - 62, my - 6);
    ctx.quadraticCurveTo(cx, my - 22, cx + 62, my - 6);
    ctx.quadraticCurveTo(cx + 40, my + 120, cx, my + 150);
    ctx.quadraticCurveTo(cx - 40, my + 120, cx - 62, my - 6);
    ctx.fill();
    ctx.fillStyle = '#8a7a5a';
    for (let i = -5; i <= 5; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * 10 - 4, my - 8);
      ctx.lineTo(cx + i * 10 + 4, my - 8);
      ctx.lineTo(cx + i * 10, my + 12 - Math.abs(i) * 1.2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(70,6,6,0.92)';
    for (const [dx, len] of [[-36, 120], [-12, 175], [20, 150], [44, 95]]) {
      ctx.beginPath();
      ctx.moveTo(cx + dx - 7, my + 40);
      ctx.quadraticCurveTo(cx + dx - 5, my + 40 + len * 0.6, cx + dx - 2, my + 40 + len);
      ctx.arc(cx + dx, my + 40 + len, 3.5, Math.PI, 0, true);
      ctx.quadraticCurveTo(cx + dx + 5, my + 40 + len * 0.6, cx + dx + 7, my + 40);
      ctx.fill();
    }
  } else if (possessed) {
    // a slack, half-open mouth with a glimpse of teeth; dark stains run from the corners down the chin
    ctx.fillStyle = '#120808';
    ctx.beginPath();
    ctx.moveTo(cx - 58, my);
    ctx.quadraticCurveTo(cx, my - 14, cx + 58, my + 4);
    ctx.quadraticCurveTo(cx, my + (kind === 'wake' ? 48 : 30), cx - 58, my);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,190,160,0.8)';
    ctx.lineWidth = 3;
    for (let i = -4; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * 11, my - 6);
      ctx.lineTo(cx + i * 11, my + 6);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(60,8,8,0.9)';
    for (const [dx, len] of [[-50, 70], [-22, 110], [38, 85]]) {
      ctx.beginPath();
      ctx.moveTo(cx + dx - 8, my + 6);
      ctx.quadraticCurveTo(cx + dx - 6, my + len * 0.6, cx + dx - 3, my + len);
      ctx.arc(cx + dx, my + len, 4, Math.PI, 0, true);
      ctx.quadraticCurveTo(cx + dx + 6, my + len * 0.6, cx + dx + 8, my + 6);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = '#8a463d';
    ctx.beginPath();
    ctx.moveTo(cx - 46, my);
    ctx.quadraticCurveTo(cx, my - 14, cx + 46, my);
    ctx.quadraticCurveTo(cx, my + 20, cx - 46, my);
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,16,12,0.8)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - 46, my);
    ctx.quadraticCurveTo(cx, my + 3, cx + 46, my);
    ctx.stroke();
  }
};

const faceTex = (kind: HumanFace) => canvasTexture(`thai-face-${kind}`, 1024, 512, (ctx, w) => drawFace(kind, ctx, w));

// --- geometry -----------------------------------------------------------------
const HEAD_R = 0.1;

/** Hair that hugs the skull: thickest at the crown, thinning to nothing at the hairline (so it never reads as
 *  a helmet). front/side/back: how far down the hair reaches (polar angle as a fraction of pi) facing forward,
 *  over the ears and at the nape. lift: extra volume at the crown. Front is +z; the seam sits at the back. */
const hairCap = (front: number, side: number, back: number, lift: number) => {
  const A = 72;
  const S = 18;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= S; j++) {
    const k = j / S;
    for (let i = 0; i <= A; i++) {
      const u = i / A;
      const a = (u - 0.5) * Math.PI * 2;
      const c = Math.cos(a);
      const reach = c >= 0 ? side + (front - side) * Math.pow(c, 1.5) : side + (back - side) * Math.pow(-c, 0.7); // falls quickly behind the ears to the nape
      const polar = k * reach * Math.PI;
      const rad = HEAD_R * (1.014 + lift * Math.pow(1 - k, 1.4));
      const nx = Math.sin(polar) * Math.sin(a);
      const ny = Math.cos(polar);
      const nz = Math.sin(polar) * Math.cos(a);
      pos.push(rad * nx, rad * ny, rad * nz);
      nor.push(nx, ny, nz);
      uv.push(u, 1 - k);
    }
  }
  for (let j = 0; j < S; j++)
    for (let i = 0; i < A; i++) {
      const p0 = j * (A + 1) + i;
      const p1 = p0 + A + 1;
      idx.push(p0, p1, p0 + 1, p0 + 1, p1, p1 + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
};
const geo = {
  cap: new THREE.CapsuleGeometry(1, 1, 6, 16),
  ball: new THREE.SphereGeometry(1, 32, 20),
  head: new THREE.SphereGeometry(HEAD_R, 48, 32),
  face: new THREE.SphereGeometry(HEAD_R * 1.004, 64, 32, Math.PI / 2 - 1.25, 2.5, 0.2 * Math.PI, 0.62 * Math.PI),
  scalp: new THREE.SphereGeometry(HEAD_R * 1.07, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.56),
  skirt: (() => {
    const pts = [new THREE.Vector2(0.15, 0.0), new THREE.Vector2(0.162, -0.2), new THREE.Vector2(0.18, -0.5), new THREE.Vector2(0.2, -0.84), new THREE.Vector2(0.202, -0.86)];
    return new THREE.LatheGeometry(pts, 32);
  })(),
  nose: new THREE.SphereGeometry(1, 16, 12),
  torso: (() => {
    const pts = [
      [0.0, 0.0], [0.13, 0.0], [0.135, 0.05], [0.12, 0.14], [0.125, 0.22], [0.145, 0.3], [0.15, 0.38], [0.155, 0.43], [0.13, 0.48], [0.06, 0.52], [0.0, 0.53],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const g = new THREE.LatheGeometry(pts, 40);
    g.scale(1, 1, 0.62);
    return g;
  })(),
  band: new THREE.BoxGeometry(1, 1, 1),
  ring: new THREE.CylinderGeometry(1, 1, 1, 32, 1, true),
  // hair falling round the back and sides of the head (open at the face)
  curtain: new THREE.CylinderGeometry(0.092, 0.15, 0.62, 48, 8, true, 1.15, Math.PI * 2 - 2.3),
  curtainV1: new THREE.CylinderGeometry(0.104, 0.17, 0.62, 40, 6, true, 1.05, Math.PI * 2 - 2.1),
  capLong: hairCap(0.41, 0.68, 0.9, 0.02),
  capBun: hairCap(0.41, 0.63, 0.88, 0.018),
  capShort: hairCap(0.4, 0.58, 0.86, 0.014),
  capCrop: hairCap(0.39, 0.56, 0.84, 0.01),
  lock: new THREE.PlaneGeometry(1, 1, 1, 6),
};

const matCache = new Map<string, THREE.Material>();
const mat = (color: string, rough = 0.85) => {
  const k = `${color}-${rough}`;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({color, roughness: rough, side: THREE.DoubleSide}));
  return matCache.get(k)!;
};
const textured = (key: string, map: THREE.Texture) => {
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({map, roughness: 0.9, side: THREE.DoubleSide}));
  return matCache.get(key)!;
};
const glowPupil = new THREE.MeshBasicMaterial({color: '#e9f3b8'});
const glowRed = new THREE.MeshBasicMaterial({color: '#ff2a14'});
/** Strand material tinted by the hair colour (the textures are light grey). Cut out, not blended, so it
 *  never sorts wrong or flickers. */
const strandMat = (key: string, tex: () => THREE.Texture, color: string, alphaTest: number) => {
  const k = key + color;
  if (!matCache.has(k))
    matCache.set(k, new THREE.MeshPhysicalMaterial({map: tex(), color: new THREE.Color(color).multiplyScalar(2.6).add(new THREE.Color(0.045, 0.038, 0.034)), roughness: 0.7, specularIntensity: 0.25, alphaTest, side: THREE.DoubleSide}));
  return matCache.get(k)!;
};
// the cap is pulled forward in depth more than the painted face (which uses polygonOffset -2), so at grazing angles
// the face never draws over the hair at the hairline
const scalpMat = (color: string) => {
  const m = strandMat('hair-scalp-', scalpStrands, color, 0.35);
  m.polygonOffset = true;
  m.polygonOffsetFactor = -6;
  m.polygonOffsetUnits = -6;
  return m;
};
const hairMat = (color: string) => strandMat('hair-long-', hairStrands, color, 0.3);
const lockMat = (color: string) => strandMat('hair-lock-', lockStrands, color, 0.35);

const lockMatV1 = () => {
  if (!matCache.has('hair-lock')) matCache.set('hair-lock', new THREE.MeshStandardMaterial({map: lockStrandsV1(), roughness: 0.55, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide}));
  return matCache.get('hair-lock')!;
};
const hairMatV1 = () => {
  if (!matCache.has('hair-strands')) matCache.set('hair-strands', new THREE.MeshStandardMaterial({map: hairStrandsV1(), color: '#ffffff', roughness: 0.55, transparent: true, alphaTest: 0.25, side: THREE.DoubleSide}));
  return matCache.get('hair-strands')!;
};

/** Which hair the villagers get: Phi Pop keeps its original hair (false); Krasue turns on the rebuilt hair. */
export const NewHair = React.createContext(false);

/** Capsule hanging down -y from the origin. */
export const Seg: React.FC<{len: number; r: number; color: string; cast?: boolean}> = ({len, r, color, cast = true}) => (
  <mesh geometry={geo.cap} material={mat(color)} position={[0, -len / 2, 0]} scale={[r, Math.max(0.001, len / 2 - r), r]} castShadow={cast} receiveShadow />
);

export const Hand: React.FC<{skin: string; curl: number; side: number}> = ({skin, curl, side}) => (
  <group>
    <mesh geometry={geo.ball} material={mat(skin)} position={[0, -0.035, 0]} scale={[0.026, 0.038, 0.012]} castShadow />
    {[-1.5, -0.5, 0.5, 1.5].map((k) => (
      <group key={k} position={[k * 0.011, -0.068, 0.002]} rotation={[-curl * 1.3, 0, k * 0.05]}>
        <Seg len={0.05 - Math.abs(k) * 0.006} r={0.0052} color={skin} />
        <group position={[0, -0.045, 0]} rotation={[-curl * 1.1, 0, 0]}>
          <Seg len={0.032} r={0.0048} color={skin} />
        </group>
      </group>
    ))}
    <group position={[side * 0.03, -0.035, 0.012]} rotation={[-0.4 - curl * 0.5, 0, -side * 0.7]}>
      <Seg len={0.05} r={0.007} color={skin} />
    </group>
  </group>
);

const Arm: React.FC<{side: number; pitch: number; out: number; elbow: number; curl: number; look: Look}> = ({side, pitch, out, elbow, curl, look}) => (
  <group position={[side * 0.155, 0.44, 0]} rotation={[pitch, 0, side * (0.05 + out)]}>
    <Seg len={0.28} r={0.033} color={look.skin} />
    {/* sleeve to just above the elbow */}
    <mesh geometry={geo.cap} material={mat(look.top)} position={[0, -0.09, 0]} scale={[0.039, 0.08, 0.039]} castShadow />
    <group position={[0, -0.27, 0]} rotation={[elbow, 0, 0]}>
      <Seg len={0.25} r={0.027} color={look.skin} />
      <group position={[0, -0.25, 0]}>
        <Hand skin={look.skin} curl={curl} side={side} />
      </group>
    </group>
  </group>
);

export const Human: React.FC<HumanPose & {outfit?: Outfit; face: HumanFace; position?: [number, number, number]; rotationY?: number; rotationX?: number; hairDrift?: number}> = ({
  outfit = 'woman',
  face,
  position = [0, 0, 0],
  rotationY = 0,
  rotationX = 0,
  hairDrift = 0,
  hipY = 0.88,
  thigh = 0,
  knee = 0,
  spread = 0,
  hunch = 0,
  armL = 0,
  armR = 0,
  outL = 0,
  outR = 0,
  elbowL = 0,
  elbowR = 0,
  curl = 0.3,
  headPitch = 0,
  headYaw = 0,
  headRoll = 0,
  breathe = 0,
  walk = 0,
  stride = 0,
  headOnly = false,
  noHead = false,
}) => {
  const newHair = React.useContext(NewHair);
  const look0 = LOOKS(outfit, face);
  const look = !newHair && outfit === 'elder' ? {...look0, hair: '#cfcac2'} : look0;
  const swingOf = (s: number) => Math.sin(walk + (s > 0 ? 0 : Math.PI)) * stride;
  const liftOf = (s: number) => Math.max(0, Math.sin(walk + (s > 0 ? 0 : Math.PI) + Math.PI / 2)) * stride * 1.6;
  const bob = stride > 0 ? Math.abs(Math.cos(walk)) * 0.025 : 0;
  const faceMat = useMemo(
    () => new THREE.MeshStandardMaterial({map: faceTex(face), transparent: true, depthWrite: false, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2}),
    [face],
  );
  const skirtMat = look.pattern ? textured(`skirt-${look.pattern}`, phaSin(look.pattern)) : mat(look.skirt);
  const standing = thigh > -0.35;
  const skirted = outfit === 'woman' || outfit === 'elder';
  const chest = 1 + Math.sin(breathe * 1.5) * 0.012;
  const possessed = isPossessed(face);
  const lookAside = face === 'avert' ? 0.012 : 0;
  const headNode = (
        <group position={[0, 0.66, 0.01]} rotation={[headPitch, headYaw, headRoll]}>
          <group scale={[0.86, 1.12, 0.98]}>
            <mesh geometry={geo.head} material={mat(look.skin, 0.75)} castShadow />
            <mesh geometry={geo.face} material={faceMat} />
            {possessed &&
              [-1, 1].map((s) => (
                // tiny pale pupils that shine in the dark
                <mesh key={s} geometry={geo.ball} material={face === 'krasue' ? glowRed : glowPupil} position={[s * 0.0294 + lookAside, -0.001, 0.0972]} scale={face === 'krasue' ? 0.0095 : face === 'wake' ? 0.0068 : 0.0058} />
              ))}
          </group>
          <mesh geometry={geo.nose} material={mat(look.skin, 0.75)} position={[0, -0.016, 0.089]} scale={[0.011, 0.014, 0.008]} />
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={geo.ball} material={mat(look.skin)} position={[s * 0.087, -0.005, -0.005]} scale={[0.012, 0.025, 0.016]} />
          ))}
          {newHair ? (
            <>
          {/* hair: a cap that hugs the skull (same shape as the head) */}
          {look.style !== 'hood' && (
            <group scale={[0.86, 1.12, 0.98]}>
              <mesh
                geometry={look.style === 'long' ? geo.capLong : look.style === 'bun' ? geo.capBun : look.style === 'crop' ? geo.capCrop : geo.capShort}
                material={scalpMat(look.hair)}
                castShadow
              />
            </group>
          )}
          {look.style === 'hood' && (
            // a hood open at the face, falling to the shoulders
            <group>
              <mesh geometry={geo.scalp} material={mat('#221c19')} position={[0, 0.02, -0.02]} rotation={[-0.15, 0, 0]} scale={[1.3, 1.45, 1.35]} castShadow />
              <mesh geometry={geo.curtain} material={mat('#221c19')} position={[0, -0.16, -0.02]} scale={[1.2, 0.6, 1.25]} castShadow />
            </group>
          )}
          {look.style === 'bun' && (
            // a low bun at the nape, wrapped in strands
            <mesh geometry={geo.ball} material={scalpMat(look.hair)} position={[0, -0.035, -0.1]} rotation={[-0.4, 0, 0]} scale={[0.046, 0.04, 0.038]} castShadow />
          )}
          {look.style === 'long' && (
            <group>
              {/* a curtain of long black hair round the back and sides, down past the shoulders */}
              <mesh geometry={geo.curtain} material={hairMat(look.hair)} position={[0, -0.3, -0.008]} rotation={[0.06 + Math.sin(hairDrift * 0.7) * 0.02, 0, 0]} scale={[0.94, 1, 1.06]} castShadow />
              {look.messy &&
                // loose locks rooted under the hair: one stray lock (tired), or three with one across an eye (possessed)
                (face === 'tired'
                  ? [{x: -0.056, y: 0.05, z: 0.05, w: 0.03, l: 0.22, r: -0.16, tilt: -0.3}]
                  : [
                      {x: -0.056, y: 0.05, z: 0.05, w: 0.03, l: 0.3, r: -0.12, tilt: -0.3},
                      {x: 0.03, y: 0.066, z: 0.072, w: 0.018, l: 0.32, r: -0.04, tilt: -0.42},
                      {x: 0.056, y: 0.05, z: 0.05, w: 0.028, l: 0.26, r: 0.12, tilt: -0.3},
                    ]
                ).map((k, i) => (
                  <group key={i} position={[k.x, k.y, k.z]} rotation={[k.tilt, 0, k.r + Math.sin(hairDrift * 0.9 + i * 2) * 0.03]}>
                    <mesh geometry={geo.lock} material={lockMat(look.hair)} position={[0, -k.l / 2, 0]} scale={[k.w, k.l, 1]} />
                  </group>
                ))}
            </group>
          )}
            </>
          ) : (
            <>
          {/* hair */}
          {look.style !== 'hood' && (
            <mesh geometry={geo.scalp} material={mat(look.hair, 0.95)} position={[0, 0.012, -0.012]} rotation={[look.style === 'crop' ? -0.3 : -0.45, 0, 0]} scale={look.style === 'crop' || look.style === 'short' ? [0.9, 1.0, 0.98] : [0.92, 1.1, 1.0]} castShadow />
          )}
          {look.style === 'hood' && (
            // a hood open at the face, falling to the shoulders
            <group>
              <mesh geometry={geo.scalp} material={mat('#221c19')} position={[0, 0.02, -0.02]} rotation={[-0.15, 0, 0]} scale={[1.3, 1.45, 1.35]} castShadow />
              <mesh geometry={geo.curtainV1} material={mat('#221c19')} position={[0, -0.16, -0.02]} scale={[1.2, 0.6, 1.25]} castShadow />
            </group>
          )}
          {look.style === 'bun' && (
            <group>
              <mesh geometry={geo.ball} material={mat(look.hair, 0.8)} position={[0, 0.0, -0.11]} scale={[0.055, 0.05, 0.05]} castShadow />
              {/* hair swept down over the ears to the nape */}
              {[-1, 1].map((s) => (
                <mesh key={s} geometry={geo.ball} material={mat(look.hair, 0.8)} position={[s * 0.074, -0.03, -0.035]} rotation={[0.3, 0, s * 0.15]} scale={[0.03, 0.07, 0.06]} castShadow />
              ))}
            </group>
          )}
          {look.style === 'long' && (
            <group>
              {/* a curtain of long black hair round the back and sides, down past the shoulders */}
              <mesh geometry={geo.curtainV1} material={hairMatV1()} position={[0, -0.25, -0.012]} rotation={[0.06 + Math.sin(hairDrift * 0.7) * 0.02, 0, 0]} castShadow />
              {look.messy &&
                // a few loose locks falling over the face (one across an eye)
                [
                  {x: -0.055, w: 0.032, l: 0.36, z: 0.095, r: 0.1},
                  {x: 0.028, w: 0.026, l: 0.4, z: 0.1, r: -0.06},
                  {x: 0.062, w: 0.03, l: 0.33, z: 0.088, r: -0.14},
                ].map((k, i) => (
                  <mesh key={i} geometry={geo.lock} material={lockMatV1()} position={[k.x, 0.03 - k.l / 2, k.z]} rotation={[-0.08, 0, k.r + Math.sin(hairDrift * 0.9 + i * 2) * 0.04]} scale={[k.w, k.l, 1]} />
                ))}
            </group>
          )}
            </>
          )}
        </group>
  );
  if (headOnly) return <group position={position} rotation={[rotationX, rotationY, 0]}><group position={[0, -0.66, -0.01]}>{headNode}</group></group>;
  return (
    <group position={position} rotation={[rotationX, rotationY, 0]}>
      <group position={[0, bob, 0]}>
      {/* legs */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.085, hipY, 0]} rotation={[thigh - swingOf(s), 0, s * (0.02 + spread)]}>
          <mesh geometry={geo.cap} material={skirted ? skirtMat : mat(look.skirt)} position={[0, -0.215, 0]} scale={[0.062, 0.153, 0.062]} castShadow receiveShadow />
          <group position={[0, -0.43, 0]} rotation={[knee + liftOf(s), 0, 0]}>
            <Seg len={0.41} r={0.045} color={skirted && standing ? look.skin : skirted ? look.skin : look.skirt} />
            <mesh geometry={geo.ball} material={mat(look.skin)} position={[0, -0.42, 0.045]} rotation={[-knee - thigh, 0, 0]} scale={[0.04, 0.025, 0.11]} castShadow />
          </group>
        </group>
      ))}
      {/* crouching or sitting: the skirt drapes over the thighs and knees */}
      {skirted && !standing && (
        <mesh geometry={geo.ball} material={skirtMat} position={[0, hipY - 0.215 * Math.cos(thigh), -0.215 * Math.sin(thigh)]} rotation={[thigh + Math.PI / 2, 0, 0]} scale={[0.15 + spread * 0.2, 0.25, 0.09]} castShadow receiveShadow />
      )}
      {/* pelvis */}
      <mesh geometry={geo.ball} material={skirted ? skirtMat : mat(look.skirt)} position={[0, hipY + 0.02, 0]} scale={skirted && standing ? [0.14, 0.1, 0.1] : [0.17, 0.12, 0.12]} castShadow />
      {/* pha sin: a straight woven tube skirt to the ankles */}
      {skirted && standing && (
        <group position={[0, hipY + 0.06, 0]}>
          <mesh geometry={geo.skirt} material={skirtMat} castShadow receiveShadow />
          <mesh material={skirtMat} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.152, 32]} />
          </mesh>
        </group>
      )}
      {/* pha khao ma tied round the waist */}
      {look.waistCloth && <mesh geometry={geo.ring} material={textured('khaoma', khaoMa())} position={[0, hipY + 0.1, 0]} scale={[0.15, 0.09, 0.105]} castShadow />}

      {/* body */}
      <group position={[0, hipY + 0.05, 0]} rotation={[hunch, 0, 0]}>
        <mesh geometry={geo.torso} material={mat(look.top)} scale={[1, chest, 1]} castShadow receiveShadow />
        {look.sabai && (
          // the elder's sabai: a white shawl across the chest and over the left shoulder
          <mesh geometry={geo.band} material={mat('#efe9dc')} position={[0.03, 0.27, 0.078]} rotation={[0.05, 0, -0.55]} scale={[0.11, 0.5, 0.01]} castShadow />
        )}
        <Arm side={-1} pitch={armL + swingOf(1) * 0.6} out={outL} elbow={elbowL} curl={curl} look={look} />
        <Arm side={1} pitch={armR + swingOf(-1) * 0.6} out={outR} elbow={elbowR} curl={curl} look={look} />
        {/* neck and head */}
        <mesh geometry={geo.cap} material={mat(look.skin)} position={[0, 0.55, 0]} scale={[0.036, 0.04, 0.036]} castShadow />
        {!noHead && headNode}
      </group>
      </group>
    </group>
  );
};

/** Extra long, wet hair hanging from a floating head (the Krasue): a longer strand curtain. */
export const LongHair: React.FC<{length?: number; sway?: number; color?: string}> = ({length = 2.2, sway = 0, color = '#070606'}) => (
  <group>
    <mesh geometry={geo.curtain} material={hairMat(color)} position={[0, 0.0 - 0.31 * length, -0.008]} rotation={[0.04 + sway * 0.03, 0, sway * 0.02]} scale={[0.96, length, 1.08]} castShadow />
    {[-0.07, -0.03, 0.035, 0.072].map((x, i) => (
      <mesh key={i} geometry={geo.lock} material={lockMat(color)} position={[x, 0.02 - 0.22 * length, 0.09 - Math.abs(x) * 0.4]} rotation={[-0.06, 0, (x > 0 ? -1 : 1) * 0.08 + Math.sin(sway + i * 2) * 0.05]} scale={[0.035, 0.44 * length, 1]} />
    ))}
  </group>
);

/** World height of the head centre for a standing human (for aiming cameras). */
export const HEAD_Y = 0.88 + 0.05 + 0.66;

/** Sudden small snaps of a possessed head, held for a moment, then back (radians). */
export const twitch = (t: number, seed = 0) => {
  const period = 1.1;
  const k = Math.floor((t + seed) / period);
  const ph = t + seed - k * period;
  const r = Math.sin(k * 12.9898 + seed * 78.233) * 43758.5453;
  const h1 = r - Math.floor(r);
  const r2 = Math.sin(k * 7.13 + seed * 3.1) * 15731.743;
  const h2 = r2 - Math.floor(r2);
  if (h1 < 0.4 || ph > 0.2) return 0;
  return (h2 - 0.5) * 0.6 * (ph < 0.04 ? ph / 0.04 : 1 - Math.max(0, ph - 0.12) / 0.08);
};
