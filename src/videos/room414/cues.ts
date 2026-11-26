import timingsJson from '../../../projects/room414/timings.json';
import {Cam} from '../../three/Common';
import {Timings, clamp, easeInOut, hash, lerp, makeCues} from '../../lib/timeline';

export const timings = timingsJson as Timings;
const c = makeCues(timings);
const L = (i: number) => c.line(i).start;
const LEAD = 0.12; // cut slightly before the line is spoken

/** Named moments in the story, all taken from the voiceover. */
export const cue = {
  keySlide: c.word(1, 'slides').start,
  room414: c.word(1, 'room').start,
  knocks1: [0, 1, 2].map((i) => c.word(6, 'knock', i).start),
  smiling: c.word(9, 'smiling').start,
  moves: c.word(10, 'moves').start,
  knocks2: [0, 1, 2].map((i) => c.word(10, 'knock', i).start),
  opens: c.word(11, 'opens').start,
  guestsStart: L(12),
  empty: L(13),
  whisper: L(15),
  dark: c.word(17, 'dark').start,
  two: c.word(17, 'two').start,
  back: c.word(17, 'back').start,
  choiceA: L(19),
  choiceB: L(20),
  final: L(21),
  finalEnd: c.line(21).end,
  ruleWords: timings.words.filter((w) => w.line === 4),
  end: timings.duration + 2,
};

export type SetName = 'lobby' | 'hall' | 'room' | 'black';
export type ShotId =
  | 'lobby' | 'clerk' | 'key' | 'hall' | 'pillow' | 'card' | 'laugh' | 'knock' | 'under1' | 'worried'
  | 'peephole' | 'hallKnock' | 'opens' | 'guests' | 'empty' | 'bathroom' | 'gap' | 'scared' | 'under2' | 'grin' | 'choice';

export type Shot = {id: ShotId; set: SetName; start: number; end: number};

const order: [ShotId, SetName, number][] = [
  ['lobby', 'lobby', 0],
  ['clerk', 'lobby', L(1) - LEAD],
  ['key', 'lobby', c.word(1, 'he').start - 0.1],
  ['hall', 'hall', L(2) - LEAD],
  ['pillow', 'room', L(3) - LEAD],
  ['card', 'room', L(4) - LEAD],
  ['laugh', 'room', L(5) - LEAD],
  ['knock', 'room', L(6) - LEAD],
  ['under1', 'room', L(7) - LEAD],
  ['worried', 'room', L(8) - LEAD],
  ['peephole', 'hall', L(9) - LEAD],
  ['hallKnock', 'hall', L(10) - LEAD],
  ['opens', 'hall', L(11) - LEAD],
  ['guests', 'hall', L(12) - LEAD],
  ['empty', 'hall', L(13) - LEAD],
  ['bathroom', 'room', L(14) - LEAD],
  ['gap', 'room', L(15) - LEAD],
  ['scared', 'room', L(16) - LEAD],
  ['under2', 'room', L(17) - LEAD],
  ['grin', 'hall', cue.back - 0.08],
  ['choice', 'room', L(18) - LEAD],
];

export const shots: Shot[] = order.map(([id, set, start], i) => ({
  id,
  set,
  start: Math.max(0, start),
  end: i + 1 < order.length ? order[i + 1][2] : cue.end,
}));

export const shotAt = (t: number) => shots.find((s) => t >= s.start && t < s.end) ?? shots[shots.length - 1];

type V3 = [number, number, number];
const mix3 = (a: V3, b: V3, u: number): V3 => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];

/** Slow handheld drift so no shot is ever perfectly still. */
const handheld = (t: number, amp = 0.01): V3 => [
  (Math.sin(t * 0.9) * 0.6 + Math.sin(t * 2.3 + 1) * 0.25) * amp,
  (Math.sin(t * 1.1 + 2) * 0.6 + Math.sin(t * 2.9) * 0.2) * amp,
  0,
];

/** Sharp shake after each knock. */
const knockShake = (t: number, knocks: number[], amp: number): V3 => {
  let x = 0;
  let y = 0;
  for (const k of knocks) {
    const d = t - (k - 0.04);
    if (d >= 0 && d < 0.5) {
      const e = Math.exp(-d * 11) * amp;
      x += (hash(Math.floor(d * 60) + k) - 0.5) * e;
      y += (hash(Math.floor(d * 60) * 1.7 + k) - 0.5) * e;
    }
  }
  return [x, y, 0];
};

const add = (...vs: V3[]): V3 => vs.reduce((a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], [0, 0, 0]);

const move = (from: Cam, to: Cam, u: number, t: number, amp = 0.01, ease = easeInOut): Cam => {
  const e = ease(u);
  const h = handheld(t, amp);
  return {
    pos: add(mix3(from.pos, to.pos, e), h),
    target: add(mix3(from.target, to.target, e), [h[0] * 0.5, h[1] * 0.5, 0]),
    fov: lerp(from.fov ?? 40, to.fov ?? 40, e),
    roll: lerp(from.roll ?? 0, to.roll ?? 0, e) + Math.sin(t * 0.7) * amp * 0.3,
  };
};

const linear = (u: number) => u;

/** Camera for any moment of the film. */
export const cameraAt = (t: number): Cam => {
  const s = shotAt(t);
  const u = clamp((t - s.start) / (s.end - s.start));
  switch (s.id) {
    case 'lobby':
      return move({pos: [0.6, 1.75, 6.2], target: [0, 1.25, -3], fov: 46}, {pos: [0.2, 1.6, 2.6], target: [0, 1.3, -3], fov: 42}, u, t, 0.012, linear);
    case 'clerk':
      return move({pos: [1.0, 1.62, -1.15], target: [0, 1.2, -3.55], fov: 36}, {pos: [0.8, 1.58, -1.45], target: [0, 1.22, -3.55], fov: 34}, u, t, 0.006, linear);
    case 'key': {
      const late = clamp((t - cue.room414 + 0.2) / 1.2);
      return move({pos: [0.32, 1.42, -2.2], target: [0.05, 1.08, -2.85], fov: 36}, {pos: [0.22, 1.3, -2.38], target: [0.1, 1.09, -2.66], fov: 28}, Math.max(u * 0.6, late), t, 0.004, linear);
    }
    case 'hall':
      return move({pos: [0, 1.55, 5.5], target: [0, 1.5, -30], fov: 44}, {pos: [0, 1.5, -0.5], target: [0, 1.48, -30], fov: 42}, u, t, 0.015, linear);
    case 'pillow':
      return move({pos: [0.42, 1.75, 0.6], target: [0.4, 0.72, -2.0], fov: 38}, {pos: [0.42, 1.25, -1.05], target: [0.4, 0.74, -2.05], fov: 34}, u, t, 0.008);
    case 'card':
      return move({pos: [0.4, 1.36, -1.89], target: [0.4, 0.765, -2.05], fov: 34}, {pos: [0.4, 1.3, -1.905], target: [0.4, 0.765, -2.05], fov: 33}, u, t, 0.002, linear);
    case 'laugh':
      return move({pos: [-0.35, 1.3, 1.15], target: [0.4, 1.05, -0.4], fov: 38}, {pos: [-0.25, 1.28, 0.95], target: [0.4, 1.08, -0.4], fov: 36}, u, t, 0.008, linear);
    case 'knock': {
      const base = move({pos: [0.45, 1.45, 0.2], target: [-0.62, 1.15, 2.5], fov: 44}, {pos: [0.2, 1.42, 0.8], target: [-0.62, 1.1, 2.5], fov: 42}, u, t, 0.008, linear);
      return {...base, pos: add(base.pos, knockShake(t, cue.knocks1, 0.05))};
    }
    case 'under1':
    case 'under2':
      return move({pos: [-0.5, 0.24, 0.55], target: [-0.62, 0.05, 2.5], fov: 40}, {pos: [-0.54, 0.2, 0.85], target: [-0.62, 0.04, 2.5], fov: 38}, u, t, 0.004, linear);
    case 'worried':
      return move({pos: [-0.3, 1.5, 0.75], target: [0.35, 1.28, -0.42], fov: 36}, {pos: [-0.2, 1.48, 0.55], target: [0.35, 1.3, -0.42], fov: 34}, u, t, 0.006, linear);
    case 'scared':
      return move({pos: [0.5, 1.42, 0.75], target: [0.4, 1.3, -0.42], fov: 30}, {pos: [0.47, 1.4, 0.5], target: [0.4, 1.32, -0.42], fov: 28}, u, t, 0.01, linear);
    case 'peephole': {
      // you look out through the door viewer of 414 (left wall, z = -8)
      const lean = easeInOut(clamp((t - cue.smiling + 0.3) / 2.5));
      return {pos: [-1.27, 1.52, -8], target: [2, 1.1 - lean * 0.05, -8], fov: 92 - lean * 14, roll: Math.sin(t * 0.8) * 0.01};
    }
    case 'grin':
      return {pos: [-1.27, 1.5, -8], target: [2, 1.32, -8], fov: 62 - u * 8, roll: Math.sin(t * 0.8) * 0.01};
    case 'hallKnock': {
      const base = move({pos: [0.75, 1.45, -5.2], target: [-1.0, 1.3, -11.5], fov: 40}, {pos: [0.6, 1.4, -6.6], target: [-1.0, 1.3, -11.8], fov: 36}, u, t, 0.008, linear);
      return {...base, pos: add(base.pos, knockShake(t, cue.knocks2, 0.012))};
    }
    case 'opens':
      return move({pos: [0.55, 1.35, -8.6], target: [-1.25, 1.2, -12.2], fov: 36}, {pos: [0.45, 1.3, -9.4], target: [-1.25, 1.2, -12.2], fov: 33}, u, t, 0.006, linear);
    case 'guests':
      return move({pos: [0.1, 1.35, -5.6], target: [0, 1.15, -30], fov: 40}, {pos: [0.05, 1.3, -7.6], target: [0, 1.15, -30], fov: 40}, u, t, 0.01, linear);
    case 'empty':
      return move({pos: [0, 1.45, -4.5], target: [0, 1.4, -30], fov: 42}, {pos: [0, 1.45, -5.0], target: [0, 1.4, -30], fov: 42}, u, t, 0.004, linear);
    case 'bathroom':
      return move({pos: [-0.1, 1.55, -0.6], target: [0.5, 1.15, 2.5], fov: 50}, {pos: [0.15, 1.5, 0.7], target: [0.38, 1.3, 2.5], fov: 42}, u, t, 0.008);
    case 'gap':
      return move({pos: [0.1, 1.5, 1.35], target: [0.3, 1.42, 2.7], fov: 34}, {pos: [0.13, 1.5, 1.6], target: [0.3, 1.45, 2.7], fov: 31}, u, t, 0.003, linear);
    case 'choice': {
      const p = move({pos: [0.03, 1.66, -2.1], target: [0.03, 1.15, 2.5], fov: 64}, {pos: [0.03, 1.6, -1.3], target: [0.03, 1.18, 2.5], fov: 60}, u, t, 0.006, linear);
      return p;
    }
    default:
      return {pos: [0, 1.5, 0], target: [0, 1.5, -1], fov: 40};
  }
};
