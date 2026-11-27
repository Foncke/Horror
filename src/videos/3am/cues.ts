import timingsJson from '../../../projects/3am/timings.json';
import {Cam} from '../../three/Common';
import {Timings, clamp, easeInOut, lerp, makeCues} from '../../lib/timeline';

export const timings = timingsJson as Timings;
const c = makeCues(timings);
const L = (i: number) => c.line(i).start;
const LEAD = 0.12; // cut slightly before the line is spoken

/** Named moments in the story, all taken from the voiceover. */
const finalEnd = c.line(10).end;
export const cue = {
  three: c.word(0, 'three').start,
  closet0: c.word(0, 'inside').start,
  whispered: c.word(4, 'whispered').start,
  foot: c.word(4, 'foot').start,
  dontLook: c.word(4, 'do', 1).start,
  slowly: c.word(5, 'slowly').start,
  shifted: c.word(5, 'shifted').start,
  downward: c.word(5, 'downward').start,
  standing: L(6),
  tall: c.word(6, 'tall').start,
  smile: c.word(7, 'smile').start,
  wide: c.word(7, 'wide').start,
  leaned: c.word(8, 'leaned').start,
  resting: c.word(8, 'resting').start,
  question: L(9),
  scream: c.word(10, 'scream').start,
  because: c.word(10, 'because').start,
  creaked: c.word(10, 'creaked').start,
  finalEnd,
  choiceA: finalEnd + 0.6,
  choiceB: finalEnd + 1.2,
  outStart: finalEnd + 4.6,
  end: finalEnd + 8.0,
};

export type ShotId =
  | 'clock' | 'wake' | 'closetPeek' | 'frozen' | 'crack' | 'voice' | 'fingers' | 'eyes'
  | 'tilt' | 'figure' | 'double' | 'lean' | 'speak' | 'scream' | 'creak';

export type Shot = {id: ShotId; start: number; end: number};

const order: [ShotId, number][] = [
  ['clock', 0],
  ['wake', c.word(0, 'to').start - 0.1],
  ['closetPeek', cue.closet0 - 0.1],
  ['frozen', L(1) - LEAD],
  ['crack', L(2) - LEAD],
  ['voice', L(3) - LEAD],
  ['fingers', L(4) - LEAD],
  ['eyes', cue.dontLook - 0.1],
  ['tilt', cue.shifted - 0.1],
  ['figure', cue.tall - 0.1],
  ['double', L(7) - LEAD],
  ['lean', L(8) - LEAD],
  ['speak', L(9) - LEAD],
  ['scream', L(10) - LEAD],
  ['creak', cue.because - 0.1],
];

export const shots: Shot[] = order.map(([id, start], i) => ({
  id,
  start: Math.max(0, start),
  end: i + 1 < order.length ? order[i + 1][1] : cue.end,
}));

export const shotAt = (t: number) => shots.find((s) => t >= s.start && t < s.end) ?? shots[shots.length - 1];

// --- layout of the bedroom (shared with Bedroom.tsx) -------------------------
export const ROOM = {W: 3.6, D: 4.6, H: 2.6};
export const CLOSET_X = -0.45; // closet door centre, on the wall in front of the bed (z = D/2)
export const FIGURE_X = 0.22;
export const HEAD: V3 = [0, 0.88, -1.86]; // your head on the pillow
export const POV: V3 = [0, 1.0, -1.74]; // your eyes, looking down the bed

/** How the double stands: further back, then leaning over the foot of the bed. */
export const figureLean = (t: number) => easeInOut(clamp((t - cue.leaned + 0.15) / 1.6));
export const figureZ = (t: number) => lerp(0.32, 0.12, figureLean(t));
export const FIGURE_SCALE = 1.2;
const HUNCH = 0.62;
/** World position of the double's head (follows the lean). */
export const figureHead = (t: number): V3 => {
  const h = HUNCH * figureLean(t);
  const hip = 0.62 * FIGURE_SCALE;
  const neck = 0.86 * FIGURE_SCALE;
  return [FIGURE_X, hip + neck * Math.cos(h), figureZ(t) - neck * Math.sin(h)];
};
export const figureHunch = (t: number) => HUNCH * figureLean(t);

/** Closet door: a crack, then it swings open behind the double. */
export const closetOpen = (t: number) => lerp(0.2, 1.45, easeInOut(clamp((t - cue.creaked + 0.35) / 2.8)));

/** Pale fingers curling round the closet door. */
export const fingers = (t: number) => easeInOut(clamp((t - cue.whispered + 0.2) / 1.4));

/** Whether the double is in the room yet (you only see it once you look down). */
export const figureVisible = (t: number) => t >= shots.find((s) => s.id === 'tilt')!.start;

type V3 = [number, number, number];
const mix3 = (a: V3, b: V3, u: number): V3 => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
const add = (...vs: V3[]): V3 => vs.reduce((a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], [0, 0, 0]);

/** Slow handheld drift so no shot is ever perfectly still. */
const handheld = (t: number, amp = 0.01): V3 => [
  (Math.sin(t * 0.9) * 0.6 + Math.sin(t * 2.3 + 1) * 0.25) * amp,
  (Math.sin(t * 1.1 + 2) * 0.6 + Math.sin(t * 2.9) * 0.2) * amp,
  0,
];

const linear = (u: number) => u;

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

/** Camera above your face, looking down at it from the foot-of-the-bed side. */
const faceCam = (dist: number, x: number): V3 => [HEAD[0] + x, HEAD[1] + dist * 0.82, HEAD[2] + dist * 0.57];

const CRACK: V3 = [CLOSET_X - 0.42, 1.3, ROOM.D / 2];
const CLOSET_MID: V3 = [CLOSET_X, 1.2, ROOM.D / 2];

/** Camera for any moment of the film. */
export const cameraAt = (t: number): Cam => {
  const s = shotAt(t);
  const u = clamp((t - s.start) / (s.end - s.start));
  switch (s.id) {
    case 'clock':
      return move({pos: [-0.35, 0.95, -1.25], target: [-1.0, 0.62, -1.84], fov: 40}, {pos: [-0.5, 0.86, -1.42], target: [-1.02, 0.62, -1.84], fov: 36}, u, t, 0.003, linear);
    case 'wake':
      return move({pos: faceCam(1.45, 0.06), target: HEAD, fov: 50}, {pos: faceCam(1.2, 0.03), target: HEAD, fov: 46}, u, t, 0.005, linear);
    case 'closetPeek':
      return move({pos: POV, target: [CLOSET_X, 1.25, ROOM.D / 2], fov: 44}, {pos: add(POV, [0, 0.01, 0.12]), target: [CLOSET_X, 1.25, ROOM.D / 2], fov: 40}, u, t, 0.006, linear);
    case 'frozen':
      return move({pos: [1.25, 2.3, 0.35], target: [0, 0.7, -1.3], fov: 42}, {pos: [1.05, 2.15, 0.05], target: [0, 0.75, -1.4], fov: 37}, u, t, 0.006, linear);
    case 'crack':
      return move({pos: POV, target: CLOSET_MID, fov: 44}, {pos: add(POV, [-0.05, 0.02, 0.3]), target: CRACK, fov: 30}, u, t, 0.006);
    case 'voice':
      return move({pos: [CRACK[0] + 0.35, 1.32, 1.05], target: CRACK, fov: 38}, {pos: [CRACK[0] + 0.3, 1.32, 1.35], target: CRACK, fov: 34}, u, t, 0.004, linear);
    case 'fingers':
      return move({pos: [CRACK[0] + 0.32, 1.32, 1.45], target: CRACK, fov: 34}, {pos: [CRACK[0] + 0.28, 1.32, 1.62], target: CRACK, fov: 30}, u, t, 0.003, linear);
    case 'eyes':
    case 'scream':
      return move({pos: faceCam(1.35, 0.02), target: HEAD, fov: 46}, {pos: faceCam(1.15, 0.02), target: HEAD, fov: 43}, u, t, s.id === 'scream' ? 0.008 : 0.003, linear);
    case 'tilt':
      // your eyes slide down from the ceiling to the foot of the bed
      return move({pos: POV, target: [0.05, 2.6, 0.9], fov: 46}, {pos: POV, target: [FIGURE_X * 0.6, 1.3, 0.6], fov: 44}, u, t, 0.003);
    case 'figure':
      return move({pos: POV, target: [FIGURE_X * 0.7, 1.35, 0.6], fov: 44}, {pos: add(POV, [0, 0.02, 0.25]), target: [FIGURE_X * 0.8, 1.5, 0.6], fov: 38}, u, t, 0.004, linear);
    case 'double': {
      const head = figureHead(t);
      const push = Math.max(u * 0.5, easeInOut(clamp((t - cue.smile + 0.2) / 1.6)));
      return move({pos: add(head, [-0.14, -0.08, -1.45]), target: head, fov: 50}, {pos: add(head, [-0.06, -0.05, -1.05]), target: head, fov: 48}, push, t, 0.003, linear);
    }
    case 'lean':
      return move({pos: add(POV, [0, -0.04, 0]), target: [FIGURE_X * 0.6, 1.25, 0.3], fov: 48}, {pos: add(POV, [0, -0.05, 0.08]), target: [FIGURE_X * 0.8, 1.35, 0], fov: 44}, u, t, 0.005, linear);
    case 'speak': {
      const head = figureHead(t);
      return move({pos: add(head, [-0.06, -0.4, -1.15]), target: head, fov: 50}, {pos: add(head, [-0.04, -0.32, -0.92]), target: head, fov: 48, roll: 0.03}, u, t, 0.003, linear);
    }
    case 'creak':
      // sitting back against the headboard: its face close, the closet opening behind it
      return move({pos: [0.0, 1.22, -2.12], target: [0.06, 1.32, 2.3], fov: 54}, {pos: [0.0, 1.2, -2.0], target: [0.06, 1.3, 2.3], fov: 52}, clamp((t - s.start) / 9), t, 0.004, linear);
    default:
      return {pos: POV, target: [0, 1.2, 2], fov: 40};
  }
};
