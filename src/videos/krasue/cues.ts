import timingsJson from '../../../projects/krasue/timings.json';
import {Cam} from '../../three/Common';
import {Timings, clamp, easeInOut, hash, lerp, makeCues} from '../../lib/timeline';

export const timings = timingsJson as Timings;
const c = makeCues(timings);
const w = (li: number, p: string, n = 0) => c.word(li, p, n).start;
const L = (i: number) => c.line(i).start;
const LASTW = timings.words[timings.words.length - 1];

/** Hard cut to black on a soft tap on the glass, just after "...don't open the curtains." */
const TAP = LASTW.end + 0.42;

export const cue = {
  villagers: w(0, 'villagers'),
  she1: L(1),
  smiles: w(1, 'smiles'),
  blends: w(1, 'blends'),
  call: L(2),
  krasue2: w(2, 'krasue'),
  byDay: L(3),
  but: w(3, 'but'),
  splits: w(3, 'splits'),
  her4: L(4),
  trailing: w(4, 'trailing'),
  driven: L(5),
  search: w(5, 'search'),
  if6: L(6),
  until: w(6, 'until'),
  turns: w(6, 'turns'),
  and6: w(6, 'and', 0),
  before: L(7),
  because: w(7, 'because'),
  dies: w(7, 'dies'),
  elders: L(8),
  she9: L(9),
  exhausted: w(9, 'exhausted'),
  avoid: w(9, 'avoid'),
  never: w(9, 'never'),
  so: L(10),
  hovering: w(10, 'hovering'),
  dont: w(10, 'don'),
  tap: TAP,
  cut: TAP + 0.08,
  end: TAP + 0.08 + 2.2,
};

export type SetName = 'village' | 'bedroom' | 'black';
export type ShotId =
  | 'thorns' | 'village' | 'street' | 'smile' | 'crowd' | 'title' | 'day' | 'midnight' | 'split' | 'rise' | 'organs'
  | 'path' | 'hunt' | 'window' | 'turn' | 'stare' | 'return' | 'dawn' | 'emptyroom' | 'elder' | 'tired' | 'food' | 'curtains' | 'black';

export type Shot = {id: ShotId; set: SetName; start: number; end: number};

const order: [ShotId, SetName, number][] = [
  ['thorns', 'village', 0],
  ['village', 'village', cue.villagers - 0.15],
  ['street', 'village', cue.she1 - 0.12],
  ['smile', 'village', cue.smiles - 0.25],
  ['crowd', 'village', cue.blends - 0.25],
  ['title', 'village', cue.call - 0.1],
  ['day', 'village', cue.byDay - 0.12],
  ['midnight', 'bedroom', cue.but - 0.12],
  ['split', 'bedroom', cue.splits - 0.5],
  ['rise', 'village', cue.her4 - 0.1],
  ['organs', 'village', cue.trailing - 0.15],
  ['path', 'village', cue.driven - 0.1],
  ['hunt', 'village', cue.search - 0.2],
  ['window', 'bedroom', cue.if6 - 0.12],
  ['turn', 'bedroom', cue.until - 0.15],
  ['stare', 'bedroom', cue.and6 - 0.1],
  ['return', 'bedroom', cue.before - 0.12],
  ['dawn', 'village', cue.because - 0.12],
  ['emptyroom', 'bedroom', cue.dies - 0.3],
  ['elder', 'bedroom', cue.elders - 0.12],
  ['tired', 'village', cue.she9 - 0.1],
  ['food', 'bedroom', cue.never - 0.12],
  ['curtains', 'bedroom', cue.so - 0.12],
  ['black', 'black', cue.cut],
];

export const shots: Shot[] = order.map(([id, set, start], i) => ({id, set, start: Math.max(0, start), end: i + 1 < order.length ? order[i + 1][2] : cue.end}));
export const shotAt = (t: number) => shots.find((s) => t >= s.start && t < s.end) ?? shots[shots.length - 1];

/** Night, dusk, day or dawn for each shot. */
export type Mood = 'night' | 'dusk' | 'day' | 'dawn';
export const moodOf = (s: ShotId): Mood =>
  s === 'street' || s === 'smile' || s === 'crowd' ? 'dusk' : s === 'day' || s === 'tired' || s === 'food' ? 'day' : s === 'dawn' || s === 'emptyroom' ? 'dawn' : 'night';

// --- places ---------------------------------------------------------------------
type V3 = [number, number, number];
/** The bedroom (far from the village so the sets never overlap); its window looks out over the trees (+z). */
export const BED: V3 = [60, 0, 0];
const B = (p: V3): V3 => [BED[0] + p[0], BED[1] + p[1], BED[2] + p[2]];
/** Where she sits at night, on her mat. */
export const MAT: V3 = [-0.8, 0, -0.75];
/** The head's neck point when she sits (for the split and the return). */
export const NECK_SITTING: V3 = [MAT[0], 0.14 + 0.05 + 0.55, MAT[2]];
/** Outside the bedroom window, out among the trees, where she drifts at three in the morning. */
export const FAR: V3 = [2.6, 2.4, 13];
/** Just outside the window, behind the curtains, at the end. */
export const AT_WINDOW: V3 = [0.3, 1.45, 2.15];

/** The village house she lives in (front faces the lane, -x) and where she stands on its porch. */
export const HER_HOUSE: V3 = [4.0, 0, 2.0];
export const PORCH: V3 = [2.0, 1.7, 1.8];
/** The house the head rises from at midnight. */
export const RISE_HOUSE: V3 = [-4.2, 0, -3.0];
/** The forest path beyond the village. */
export const PATH_Z = -34;

// --- the Krasue's movement ----------------------------------------------------
/** Head height above the roof as she rises into the night sky. */
export const riseHeight = (t: number) => lerp(2.3, 7.0, easeInOut(clamp((t - cue.her4) / 4.8)));
/** Where the head rises: just in front of the porch of the house across the lane. */
export const RISE_AT: V3 = [-2.3, 0, -3.0];
/** At the window: she has her back to you (a red glow among the trees), then turns round on "turns". */
export const turnYaw = (t: number) => (t < cue.turns - 0.05 ? 0.15 * Math.sin(t * 0.7) : Math.PI * (1 - Math.exp(-(t - cue.turns + 0.05) * 18)));
/** Drifting across the trees, far out. */
export const farPos = (t: number): V3 => [FAR[0] + Math.sin(t * 0.25) * 1.2 - (t - cue.if6) * 0.12, FAR[1] + Math.sin(t * 0.6) * 0.2, FAR[2]];

// --- cameras ------------------------------------------------------------------------
const lerp3 = (a: V3, b: V3, u: number): V3 => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
const add = (...vs: V3[]): V3 => vs.reduce((a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], [0, 0, 0]);
const drift = (t: number, amp: number): V3 => [Math.sin(t * 0.7) * amp, Math.sin(t * 0.9 + 1) * amp * 0.7, 0];
export const tremble = (t: number, amp: number): V3 => [
  (Math.sin(t * 13.1) * 0.5 + Math.sin(t * 23.7 + 1) * 0.3 + (hash(Math.floor(t * 30)) - 0.5) * 0.4) * amp,
  (Math.sin(t * 11.3 + 2) * 0.5 + Math.sin(t * 19.1) * 0.3 + (hash(Math.floor(t * 30) + 7) - 0.5) * 0.4) * amp,
  0,
];
/** Slow push-in on every shot, like the reference. */
const push = (from: Cam, to: Cam, u: number, t: number, amp = 0.004): Cam => {
  const e = easeInOut(u * 0.85 + 0.075);
  const d = drift(t, amp);
  return {
    pos: add(lerp3(from.pos, to.pos, e), d),
    target: add(lerp3(from.target, to.target, e), [d[0] * 0.4, d[1] * 0.4, 0]),
    fov: lerp(from.fov ?? 40, to.fov ?? 40, e),
    near: 0.05,
    far: 200,
  };
};

export const cameraAt = (t: number): Cam => {
  const s = shotAt(t);
  const u = clamp((t - s.start) / (s.end - s.start));
  switch (s.id) {
    case 'thorns':
      // thorny branches nailed across a shuttered window
      return push({pos: [1.2, 2.95, 1.05], target: [2.45, 2.9, 0.7], fov: 36}, {pos: [1.55, 2.92, 0.95], target: [2.45, 2.9, 0.7], fov: 32}, u, t, 0.002);
    case 'village':
      return push({pos: [-0.6, 2.4, 14], target: [0, 2.0, -6], fov: 46}, {pos: [-0.4, 2.2, 9], target: [0, 2.1, -6], fov: 42}, u, t);
    case 'street':
      return push({pos: [0.25, 1.55, 3.0], target: [0.3, 1.45, -2.2], fov: 38}, {pos: [0.28, 1.56, 1.6], target: [0.3, 1.52, -2.2], fov: 34}, u, t, 0.002);
    case 'smile':
      return push({pos: [0.33, 1.6, -1.25], target: [0.3, 1.58, -2.2], fov: 32}, {pos: [0.32, 1.59, -1.45], target: [0.3, 1.58, -2.2], fov: 30}, u, t, 0.0015);
    case 'crowd':
      return push({pos: [-1.2, 1.75, 2.6], target: [0.2, 1.3, -2.5], fov: 46}, {pos: [-1.0, 1.7, 2.0], target: [0.2, 1.35, -2.5], fov: 42}, u, t);
    case 'title':
      return push({pos: [-1.5, 6.5, 20], target: [0, 2.5, -8], fov: 50}, {pos: [-1.0, 5.5, 15], target: [0, 2.6, -8], fov: 46}, u, t, 0.005);
    case 'day':
      return push({pos: [-1.5, 2.3, 4.4], target: [2.0, 2.95, 1.8], fov: 44}, {pos: [-1.0, 2.35, 3.8], target: [2.0, 3.0, 1.8], fov: 40}, u, t);
    case 'midnight':
      return push({pos: B([1.3, 1.45, 1.0]), target: B([MAT[0], 0.7, MAT[2]]), fov: 42}, {pos: B([1.0, 1.35, 0.7]), target: B([MAT[0], 0.75, MAT[2]]), fov: 38}, u, t, 0.002);
    case 'split': {
      // close behind her shoulder: the head starts to lift away from the neck
      const n = B(NECK_SITTING);
      // from in front of her: her face as the head lifts away from the neck
      return push({pos: add(n, [-0.75, 0.25, 1.15]), target: add(n, [0, 0.05, 0]), fov: 40}, {pos: add(n, [-0.62, 0.3, 0.98]), target: add(n, [0, 0.25, 0]), fov: 38}, u, t, 0.002);
    }
    case 'rise':
      return push({pos: [0.4, 1.4, 2.0], target: [RISE_AT[0], 3.8, RISE_AT[2]], fov: 50}, {pos: [0.3, 1.4, 1.6], target: [RISE_AT[0], 5.6, RISE_AT[2]], fov: 48}, u, t, 0.003);
    case 'organs': {
      // close on the floating head, tilting down to what hangs beneath it
      const h: V3 = [RISE_AT[0], riseHeight(t), RISE_AT[2]];
      return push({pos: add(h, [0.35, 0.05, 1.3]), target: add(h, [0, 0, 0]), fov: 38}, {pos: add(h, [0.3, -0.35, 1.2]), target: add(h, [0, -0.6, 0]), fov: 40}, u, t, 0.002);
    }
    case 'path':
      return push({pos: [0.6, 0.45, PATH_Z + 8], target: [0, 1.0, PATH_Z - 6], fov: 44}, {pos: [0.5, 0.42, PATH_Z + 6], target: [0, 1.1, PATH_Z - 6], fov: 40}, u, t, 0.003);
    case 'hunt':
      // down at the wet leaves as the red light passes overhead, drips falling
      return push({pos: [0.4, 0.22, PATH_Z + 1.8], target: [0, 0.85, PATH_Z - 0.6], fov: 48}, {pos: [0.35, 0.2, PATH_Z + 1.5], target: [0, 0.95, PATH_Z - 0.6], fov: 46}, u, t, 0.002);
    case 'window': {
      // from inside: out through the window to a red glow drifting among the trees, slowly zooming in
      const f = farPos(t);
      // right up at the open window, so nothing crosses the view
      return {pos: B([0.3, 1.45, 1.72]), target: B([f[0] * 0.6, f[1] * 0.9, f[2]]), fov: lerp(40, 24, easeInOut(u)), near: 0.05, far: 200};
    }
    case 'turn': {
      const f = farPos(t);
      return {pos: add(B([0.3, 1.45, 1.75]), tremble(t, 0.002)), target: B(f), fov: lerp(14, 11, easeInOut(u)), near: 0.05, far: 200};
    }
    case 'stare': {
      // right in front of it: the severed head staring back
      const f = B(farPos(t));
      return push({pos: add(f, [0.04, 0.02, -0.9]), target: f, fov: 34}, {pos: add(f, [0.02, 0.01, -0.58]), target: f, fov: 32}, u, t, 0.0015);
    }
    case 'return':
      return push({pos: B([1.4, 1.5, 1.1]), target: B([MAT[0], 1.0, MAT[2]]), fov: 44}, {pos: B([1.2, 1.45, 0.9]), target: B([MAT[0], 0.95, MAT[2]]), fov: 40}, u, t, 0.002);
    case 'dawn':
      return push({pos: [0.3, 2.4, 13], target: [0, 2.6, -20], fov: 46}, {pos: [0.3, 2.3, 10], target: [0, 2.7, -20], fov: 44}, u, t, 0.003);
    case 'emptyroom':
      return push({pos: B([1.5, 0.65, 1.2]), target: B([MAT[0], 0.15, MAT[2]]), fov: 44}, {pos: B([1.3, 0.6, 1.0]), target: B([MAT[0], 0.15, MAT[2]]), fov: 42}, u, t, 0.002);
    case 'elder': {
      const head = B([1.2, 0.85, -0.6]);
      return push({pos: add(head, [-0.15, 0.03, 0.85]), target: head, fov: 32}, {pos: add(head, [-0.1, 0.02, 0.66]), target: head, fov: 30}, u, t, 0.0015);
    }
    case 'tired': {
      const head: V3 = [PORCH[0], PORCH[1] + 1.59, PORCH[2]];
      return push({pos: add(head, [-1.05, -0.1, 0.42]), target: add(head, [0, 0.12, 0]), fov: 36}, {pos: add(head, [-0.85, -0.08, 0.34]), target: add(head, [0, 0.12, 0]), fov: 34}, u, t, 0.0015);
    }
    case 'food':
      return push({pos: B([-0.15, 0.55, 0.15]), target: B([-0.6, 0.05, -0.3]), fov: 40}, {pos: B([-0.25, 0.5, 0.05]), target: B([-0.6, 0.05, -0.3]), fov: 38}, u, t, 0.0015);
    case 'curtains':
      return push({pos: B([0.1, 1.3, -1.5]), target: B([0.3, 1.4, 1.6]), fov: 46}, {pos: B([0.15, 1.33, -0.9]), target: B([0.3, 1.42, 1.6]), fov: 44}, u, t, 0.0015);
    default:
      return {pos: [0, 1, 5], target: [0, 1, 0], fov: 40, near: 0.05, far: 200};
  }
};
