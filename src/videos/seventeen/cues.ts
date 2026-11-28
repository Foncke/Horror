import timingsJson from '../../../projects/seventeen/timings.json';
import {Cam} from '../../three/Common';
import {Timings, clamp, easeInOut, easeOut, lerp, makeCues} from '../../lib/timeline';

export const timings = timingsJson as Timings;
const c = makeCues(timings);
const L = (i: number) => c.line(i).start;
const W = (li: number, w: string, nth = 0) => c.word(li, w, nth).start;
const E = (li: number, w: string, nth = 0) => c.word(li, w, nth).end;

/** Named moments, all taken from the voiceover. */
export const cue = {
  timer: W(0, 'timer'),
  now: W(0, 'now'),
  blink: W(1, 'blink'),
  knock: W(1, 'knock'),
  wood: W(1, 'wood'),
  lastNight: L(2),
  said: W(2, 'said'),
  laughed: W(3, 'laughed'),
  lampOff: E(3, 'lamp') - 0.12,
  looked: W(3, 'looked'),
  seven: W(5, 'seven'),
  doorway: W(5, 'doorway'),
  black: W(5, 'black'),
  even: W(5, 'even'),
  twelve: W(6, 'twelve'),
  something: W(6, 'something'),
  leaned: W(6, 'leaned'),
  chin: W(6, 'chin'),
  smiled: W(6, 'smiled'),
  teeth: W(6, 'teeth'),
  spun: W(7, 'spun'),
  room: W(7, 'the', 0),
  scariest: L(8),
  noteGone: W(8, 'note'),
  phone: W(8, 'phone'),
  flickered: W(8, 'flickered'),
  showing: W(8, 'showing'),
  head: E(8, 'head'),
  up: W(9, 'your'),
  dont: W(9, 'don'),
  behind: W(9, 'behind'),
  last: c.line(9).end,
  end: 69.88, // the whole voiceover; the cut lands straight back on the first frame when it loops
};

export type ShotId =
  | 'hook' | 'timer' | 'eyes' | 'door' | 'answer' | 'room' | 'noteMid' | 'noteText' | 'laugh' | 'lamp' | 'dark'
  | 'tired' | 'seven' | 'blackDoor' | 'hallway' | 'twelve' | 'lean' | 'chin' | 'teeth' | 'spin' | 'empty'
  | 'gone' | 'phoneOn' | 'feed' | 'up' | 'behind';

export type Shot = {id: ShotId; start: number; end: number};
const LEAD = 0.12;

const order: [ShotId, number][] = [
  ['hook', 0],
  ['timer', W(0, 'start') - LEAD],
  ['eyes', L(1) - LEAD],
  ['door', W(1, 'and') - LEAD],
  ['answer', W(1, 'do', 1) - LEAD],
  ['room', L(2) - 0.02],
  ['noteMid', W(2, 'no', 1) - LEAD],
  ['noteText', W(2, 'it') - LEAD],
  ['laugh', L(3) - 0.05],
  ['lamp', W(3, 'turned') - LEAD],
  ['dark', W(3, 'and') - LEAD],
  ['tired', L(4) - LEAD],
  ['seven', L(5) - LEAD],
  ['blackDoor', W(5, 'the', 1) - LEAD],
  ['hallway', cue.even - LEAD],
  ['twelve', L(6) - 0.05],
  ['lean', cue.something - LEAD],
  ['chin', W(6, 'its') - LEAD],
  ['teeth', W(6, 'and') - LEAD],
  ['spin', L(7) - LEAD],
  ['empty', cue.room - LEAD],
  ['gone', L(8) - LEAD],
  ['phoneOn', W(8, 'and') - LEAD],
  ['feed', cue.showing - LEAD],
  ['up', L(9) - LEAD],
  ['behind', cue.dont - LEAD],
];

export const shots: Shot[] = order.map(([id, start], i) => ({
  id,
  start: Math.max(0, start),
  end: i + 1 < order.length ? order[i + 1][1] : cue.end,
}));

export const shotAt = (t: number) => shots.find((s) => t >= s.start && t < s.end) ?? shots[shots.length - 1];

/** Present-day shots (talking to you): lamp on, bedroom door shut. */
export const isPresent = (id: ShotId) => ['hook', 'timer', 'eyes', 'door', 'answer', 'up', 'behind'].includes(id);

// --- layout -----------------------------------------------------------------
export const ROOM = {W: 3.6, D: 4.2, H: 2.6};
export const MIRROR_Z = -ROOM.D / 2 + 0.02; // glass plane
export const MIRROR = {w: 1.0, h: 1.12, y: 1.5};
export const SEAT: V3 = [0, 0, -1.0]; // the narrator's stool; he faces the mirror (-z)
export const FACE: V3 = [0, 1.37, -1.18]; // front of his face
export const HEAD: V3 = [0, 1.37, -1.0]; // centre of his head
export const DOOR_X = -0.72; // bedroom door, on the wall behind him (z = +D/2), over his left shoulder in the mirror
export const NOTE: V3 = [0.29, 1.72, MIRROR_Z + 0.004];
export const PHONE: V3 = [0.24, 0.912, -1.72];
export const LAMP: V3 = [-0.42, 0.9, -1.88];

/** Where a point appears in the mirror (its virtual image behind the glass). */
export const mirrored = (p: V3): V3 => [p[0], p[1], 2 * MIRROR_Z - p[2]];

/** The lamp: on, then off with the click. */
export const lampOn = (t: number, id: ShotId) => (isPresent(id) ? 1 : t < cue.lampOff ? 1 : 0);

/** In the reflection the doorway fills with black. */
export const doorBlack = (t: number) => easeInOut(clamp((t - (cue.black - 1.1)) / 1.25));

/** The thing: its head comes down out of the dark over his left shoulder. */
export const leanAt = (t: number, id: ShotId) => {
  if (id === 'behind') return easeOut(clamp((t - (cue.dont - 0.15)) / 1.05));
  if (id === 'feed') return 1;
  return easeInOut(clamp((t - (cue.something + 0.1)) / 2.7));
};
export const grinAt = (t: number, id: ShotId) => {
  if (id === 'behind' || id === 'feed') return 1;
  return easeInOut(clamp((t - (cue.smiled - 0.05)) / 0.9));
};

/** His body turning round (rotation about y; pi = facing the mirror). */
export const spinAt = (t: number) => Math.PI * (1 - easeInOut(clamp((t - (cue.spun - 0.05)) / 0.38)));

type V3 = [number, number, number];
const mix3 = (a: V3, b: V3, u: number): V3 => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
const add = (...vs: V3[]): V3 => vs.reduce((a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], [0, 0, 0]);

const handheld = (t: number, amp = 0.01): V3 => [
  (Math.sin(t * 0.9) * 0.6 + Math.sin(t * 2.3 + 1) * 0.25) * amp,
  (Math.sin(t * 1.1 + 2) * 0.6 + Math.sin(t * 2.9) * 0.2) * amp,
  0,
];
const linear = (u: number) => u;

export type Cam17 = Cam & {real?: boolean};

const move = (from: Cam, to: Cam, u: number, t: number, amp = 0.006, ease = linear): Cam => {
  const e = ease(u);
  const h = handheld(t, amp);
  return {
    pos: add(mix3(from.pos, to.pos, e), h),
    target: add(mix3(from.target, to.target, e), [h[0] * 0.5, h[1] * 0.5, 0]),
    fov: lerp(from.fov ?? 40, to.fov ?? 40, e),
    roll: lerp(from.roll ?? 0, to.roll ?? 0, e) + Math.sin(t * 0.7) * amp * 0.3,
  };
};

/** Camera between him and the mirror, looking at his face (the "talking to you" framing). */
const faceOn = (dist: number, dy = 0, dx = 0): V3 => [FACE[0] + dx, FACE[1] + dy, FACE[2] - dist];
/** Over his right shoulder, looking into the glass (kept clear of his head). */
const OVER: V3 = [0.36, 1.5, -0.6];
const OVER_IN: V3 = [0.35, 1.47, -0.74];

export const cameraAt = (t: number): Cam17 => {
  const s = shotAt(t);
  const u = clamp((t - s.start) / (s.end - s.start));
  const vFace = mirrored(FACE);
  const vIt = mirrored([-0.34, 1.31, -0.97]);
  const vDoor = mirrored([DOOR_X, 1.12, ROOM.D / 2]);
  switch (s.id) {
    case 'hook':
    case 'up':
      return move({pos: faceOn(0.86, 0.04, 0.03), target: add(FACE, [0, -0.04, 0]), fov: 50}, {pos: faceOn(0.8, 0.03, 0.02), target: add(FACE, [0, -0.03, 0]), fov: 45}, u, t, 0.004);
    case 'behind':
      return {...move({pos: faceOn(0.86, 0.04, -0.1), target: add(FACE, [-0.17, -0.06, 0.1]), fov: 50}, {pos: faceOn(0.84, 0.04, -0.1), target: add(FACE, [-0.17, -0.06, 0.1]), fov: 48}, u, t, 0.003), real: true};
    case 'timer':
      return move({pos: add(PHONE, [0.03, 0.44, 0.28]), target: PHONE, fov: 36}, {pos: add(PHONE, [0.02, 0.38, 0.22]), target: PHONE, fov: 34}, u, t, 0.002);
    case 'eyes':
      return move({pos: faceOn(0.5, -0.03), target: add(FACE, [0, -0.035, 0]), fov: 30}, {pos: faceOn(0.4, -0.03), target: add(FACE, [0, -0.035, 0]), fov: 29}, u, t, 0.0015);
    case 'door':
      return move({pos: [DOOR_X + 0.6, 0.72, ROOM.D / 2 - 1.7], target: [DOOR_X, 0.95, ROOM.D / 2], fov: 50}, {pos: [DOOR_X + 0.52, 0.72, ROOM.D / 2 - 1.42], target: [DOOR_X, 0.95, ROOM.D / 2], fov: 48}, u, t, 0.003);
    case 'answer':
      return move({pos: faceOn(0.82, 0.04, -0.08), target: add(FACE, [0, -0.03, 0]), fov: 44}, {pos: faceOn(0.76, 0.04, -0.06), target: add(FACE, [0, -0.03, 0]), fov: 40}, u, t, 0.003);
    case 'room':
      return move({pos: [1.0, 1.8, 1.55], target: [0.0, 1.25, -2.0], fov: 50}, {pos: [0.78, 1.7, 0.75], target: [0.1, 1.4, -2.0], fov: 44}, u, t, 0.004, easeInOut);
    case 'noteMid':
      return move({pos: [0.46, 1.7, -1.22], target: NOTE, fov: 36}, {pos: [0.42, 1.71, -1.4], target: NOTE, fov: 34}, u, t, 0.002);
    case 'noteText': {
      const top = add(NOTE, [0, 0.075, 0]);
      const bot = add(NOTE, [0, -0.075, 0]);
      return move({pos: add(top, [0.02, 0.0, 0.34]), target: top, fov: 30}, {pos: add(bot, [0.02, 0.0, 0.3]), target: bot, fov: 30}, u, t, 0.0012, easeInOut);
    }
    case 'laugh':
    case 'dark':
      return move({pos: OVER, target: add(vFace, [-0.05, 0.05, 0]), fov: 40}, {pos: add(OVER, [0, 0, -0.04]), target: add(vFace, [-0.05, 0.05, 0]), fov: 37}, u, t, 0.003);
    case 'lamp':
      return move({pos: [-0.78, 1.42, -1.02], target: add(LAMP, [0.05, 0.22, 0]), fov: 40}, {pos: [-0.74, 1.4, -1.1], target: add(LAMP, [0.05, 0.22, 0]), fov: 37}, u, t, 0.002);
    case 'tired':
      return move({pos: OVER, target: add(vFace, [-0.03, 0.04, 0]), fov: 34}, {pos: OVER_IN, target: add(vFace, [-0.02, 0.02, 0]), fov: 24}, u, t, 0.002);
    case 'seven':
    case 'twelve':
      return move({pos: OVER_IN, target: add(vFace, [-0.3, 0.0, -0.9]), fov: 30}, {pos: OVER_IN, target: add(vFace, [-0.3, 0.0, -0.9]), fov: 28}, u, t, 0.002);
    case 'blackDoor':
      // over his left shoulder, so the doorway in the glass is clear of his head
      return move({pos: [-0.3, 1.84, -0.64], target: mix3(vFace, vDoor, 0.3), fov: 34}, {pos: [-0.3, 1.82, -0.72], target: mix3(vFace, vDoor, 0.42), fov: 27}, u, t, 0.0015, easeInOut);
    case 'hallway':
      return move({pos: [0.72, 1.55, -1.86], target: [DOOR_X * 0.5, 1.15, ROOM.D / 2], fov: 54}, {pos: [0.7, 1.55, -1.8], target: [DOOR_X * 0.55, 1.15, ROOM.D / 2], fov: 50}, u, t, 0.003);
    case 'lean':
      return move({pos: OVER, target: add(vFace, [-0.18, 0.18, -0.1]), fov: 32}, {pos: OVER_IN, target: add(vFace, [-0.18, 0.0, -0.1]), fov: 27}, u, t, 0.002);
    case 'chin':
      return move({pos: OVER_IN, target: add(vFace, [-0.17, -0.05, -0.1]), fov: 22}, {pos: OVER_IN, target: add(vFace, [-0.17, -0.05, -0.1]), fov: 19}, u, t, 0.0015);
    case 'teeth':
      return move({pos: OVER_IN, target: add(vIt, [0, -0.02, 0]), fov: 15}, {pos: OVER_IN, target: add(vIt, [0, -0.03, 0]), fov: 11.5}, u, t, 0.001);
    case 'spin': {
      const k = clamp((t - cue.spun) / 0.5);
      const on = t > cue.spun ? 1 - k : 0;
      const shake: V3 = [Math.sin(t * 41) * 0.012 * on, Math.sin(t * 37) * 0.01 * on, 0];
      return move({pos: add([1.15, 1.5, -1.35], shake), target: [0, 1.25, -0.95], fov: 50}, {pos: add([1.1, 1.5, -1.3], shake), target: [0, 1.25, -0.95], fov: 48}, u, t, 0.004);
    }
    case 'empty':
      return move({pos: add(HEAD, [0, 0.04, 0.12]), target: [DOOR_X * 0.5, 1.0, ROOM.D / 2], fov: 62}, {pos: add(HEAD, [0, 0.04, 0.18]), target: [DOOR_X * 0.55, 0.98, ROOM.D / 2], fov: 58}, u, t, 0.004);
    case 'gone':
      return move({pos: [0.5, 1.64, -1.1], target: add(NOTE, [-0.08, -0.06, 0]), fov: 42}, {pos: [0.44, 1.68, -1.36], target: add(NOTE, [0, -0.02, 0]), fov: 34}, u, t, 0.002, easeInOut);
    case 'phoneOn':
      return move({pos: add(PHONE, [-0.06, 0.44, 0.34]), target: PHONE, fov: 36}, {pos: add(PHONE, [-0.05, 0.38, 0.28]), target: PHONE, fov: 34}, u, t, 0.002);
    case 'feed':
      // the phone's view: high behind him; the thing bent over his shoulder, its grin in the mirror
      return {...move({pos: [0.36, 1.95, 0.0], target: [-0.1, 1.36, -2.08], fov: 36}, {pos: [0.34, 1.92, -0.1], target: [-0.1, 1.36, -2.08], fov: 32}, u, t, 0.0015), real: true};
    default:
      return {pos: [0, 1.5, 1], target: HEAD, fov: 40};
  }
};
