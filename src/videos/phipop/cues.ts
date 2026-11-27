import timingsJson from '../../../projects/phipop/timings.json';
import {Cam} from '../../three/Common';
import {Timings, clamp, easeInOut, hash, lerp, makeCues} from '../../lib/timeline';

export const timings = timingsJson as Timings;
const c = makeCues(timings);
const w = (li: number, p: string, n = 0) => c.word(li, p, n).start;
const LASTW = timings.words[timings.words.length - 1];

/** Named moments, all taken from the voiceover. */
export const cue = {
  wait: w(0, 'or'),
  neighbor: w(1, 'neighbor'),
  partner: w(1, 'partner'),
  or1: w(1, 'or'),
  called: w(2, 'it'),
  unlike: w(3, 'unlike'),
  itIs: w(3, 'it', 0),
  backfires: w(3, 'backfires'),
  rotting: w(3, 'rotting'),
  crawls: w(3, 'crawls'),
  byDay: w(4, 'by'),
  theySmile: w(4, 'they', 0),
  and4: w(4, 'and', 1),
  until: w(5, 'until'),
  thats: w(6, 'that'),
  wakes: w(6, 'wakes'),
  itHijacks: w(6, 'it'),
  hunt: w(6, 'to', 1),
  worst: w(6, 'and', 1),
  trapped: w(6, 'trapped'),
  watching: w(6, 'watching'),
  tear: w(6, 'tear'),
  ifIt: w(7, 'if'),
  slowly: w(7, 'it', 1),
  before: w(7, 'before'),
  drop: w(7, 'drop'),
  elders: w(8, 'elders'),
  never: w(9, 'they'),
  andThey: w(9, 'and'),
  three: w(9, 'three'),
  tonight: w(10, 'so'),
  kitchen: w(10, 'kitchen'),
  dont: w(10, 'don'),
  /** hard cut to black right after "light." (same moment as the mix) */
  cut: LASTW.end + 0.06,
  end: LASTW.end + 0.06 + 2.4,
};

export type SetName = 'village' | 'house' | 'void';
export type ShotId =
  | 'village' | 'underbed' | 'neighbor' | 'partner' | 'sleeper' | 'title' | 'shrine' | 'sorcerer' | 'xray1'
  | 'day' | 'smileclose' | 'dinner' | 'midnight' | 'eyes' | 'creep' | 'fridge' | 'trapped' | 'trapped2' | 'hands' | 'empty'
  | 'xray2' | 'drop' | 'elder' | 'avert' | 'clock' | 'situp' | 'hallway' | 'switch' | 'black';

export type Shot = {id: ShotId; set: SetName; start: number; end: number};

const order: [ShotId, SetName, number][] = [
  ['village', 'village', 0],
  ['underbed', 'village', cue.wait - 0.1],
  ['neighbor', 'village', cue.neighbor - 0.25],
  ['partner', 'house', cue.partner - 0.15],
  ['sleeper', 'house', cue.or1 - 0.1],
  ['title', 'village', cue.called - 0.1],
  ['shrine', 'void', cue.unlike - 0.1],
  ['sorcerer', 'void', cue.itIs - 0.1],
  ['xray1', 'void', cue.rotting - 0.1],
  ['day', 'village', cue.byDay - 0.1],
  ['smileclose', 'village', cue.theySmile - 0.1],
  ['dinner', 'house', cue.and4 - 0.1],
  ['midnight', 'house', cue.until - 0.1],
  ['eyes', 'house', cue.thats - 0.1],
  ['creep', 'village', cue.itHijacks - 0.1],
  ['fridge', 'house', cue.hunt - 0.1],
  ['trapped', 'house', cue.worst - 0.1],
  ['trapped2', 'house', cue.trapped - 0.1],
  ['hands', 'house', cue.watching - 0.1],
  ['empty', 'village', cue.ifIt - 0.1],
  ['xray2', 'void', cue.slowly - 0.1],
  ['drop', 'void', cue.before - 0.1],
  ['elder', 'house', cue.elders - 0.1],
  ['avert', 'house', cue.never - 0.1],
  ['clock', 'house', cue.andThey - 0.1],
  ['situp', 'house', cue.three - 0.25],
  ['hallway', 'house', cue.tonight - 0.1],
  ['switch', 'house', cue.dont - 0.1],
  ['black', 'void', cue.cut],
];

export const shots: Shot[] = order.map(([id, set, start], i) => ({id, set, start: Math.max(0, start), end: i + 1 < order.length ? order[i + 1][2] : cue.end}));
export const shotAt = (t: number) => shots.find((s) => t >= s.start && t < s.end) ?? shots[shots.length - 1];

// --- places ------------------------------------------------------------------------
type V3 = [number, number, number];
/** The village: a dirt lane along z with stilt houses on both sides. */
export const LANE_Z = 0;
/** Inside the house (far from the village so the sets never overlap). */
export const HOUSE: V3 = [60, 0, 0];
/** Bedroom mat, dinner mat, kitchen, inside the house (offsets from HOUSE). */
export const BED: V3 = [-1.2, 0, -1.2];
export const DINNER: V3 = [1.0, 0, 0.6];
export const KITCHEN: V3 = [0, 0, -5.2];
/** Empty black space for the X-ray, the shrine and the drop. */
export const VOID: V3 = [-60, 0, 0];

/** Night (0) or day (1). */
export const daylight = (s: ShotId) => (s === 'day' || s === 'smileclose' ? 1 : 0);

// --- cameras --------------------------------------------------------------------------
const lerp3 = (a: V3, b: V3, u: number): V3 => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
const add = (...vs: V3[]): V3 => vs.reduce((a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], [0, 0, 0]);
const drift = (t: number, amp: number): V3 => [Math.sin(t * 0.7) * amp, Math.sin(t * 0.9 + 1) * amp * 0.7, 0];
export const tremble = (t: number, amp: number): V3 => [
  (Math.sin(t * 13.1) * 0.5 + Math.sin(t * 23.7 + 1) * 0.3 + (hash(Math.floor(t * 30)) - 0.5) * 0.4) * amp,
  (Math.sin(t * 11.3 + 2) * 0.5 + Math.sin(t * 19.1) * 0.3 + (hash(Math.floor(t * 30) + 7) - 0.5) * 0.4) * amp,
  0,
];

/** The reference's motion: a slow, steady push-in on every still. */
const push = (from: Cam, to: Cam, u: number, t: number, amp = 0.004): Cam => {
  const e = easeInOut(u * 0.85 + 0.075);
  const d = drift(t, amp);
  return {
    pos: add(lerp3(from.pos, to.pos, e), d),
    target: add(lerp3(from.target, to.target, e), [d[0] * 0.4, d[1] * 0.4, 0]),
    fov: lerp(from.fov ?? 40, to.fov ?? 40, e),
    roll: lerp(from.roll ?? 0, to.roll ?? 0, e),
  };
};
const at = (base: V3, p: V3): V3 => add(base, p);
const H = (p: V3) => at(HOUSE, p);
const V = (p: V3) => at(VOID, p);

/** Camera for any moment of the film. */
export const cameraAt = (t: number): Cam => {
  const s = shotAt(t);
  const u = clamp((t - s.start) / (s.end - s.start));
  switch (s.id) {
    case 'village':
      return push({pos: [1.5, 2.2, 22], target: [0, 2.0, 0], fov: 46}, {pos: [1.0, 2.0, 15], target: [0, 2.1, 0], fov: 42}, u, t);
    case 'underbed':
      // under a stilt house, between its posts, looking out at the misty lane
      return push({pos: [-4.95, 0.35, 2.5], target: [0, 0.7, 0.8], fov: 50}, {pos: [-4.7, 0.34, 2.3], target: [0, 0.72, 0.8], fov: 46}, u, t, 0.002);
    case 'neighbor':
      return push({pos: [-0.6, 2.3, 2.6], target: [2.4, 2.75, 0.8], fov: 40}, {pos: [0.0, 2.45, 2.05], target: [2.4, 2.8, 0.8], fov: 36}, u, t);
    case 'partner':
      return push({pos: H([1.35, 1.0, 2.3]), target: H([1.0, 0.75, 0.6]), fov: 38}, {pos: H([1.3, 0.95, 2.0]), target: H([1.0, 0.78, 0.6]), fov: 34}, u, t);
    case 'sleeper':
      return push({pos: H([1.6, 1.5, 1.8]), target: H([-1.2, 0.25, -1.2]), fov: 44}, {pos: H([0.9, 1.3, 0.9]), target: H([-1.2, 0.25, -1.2]), fov: 40}, u, t);
    case 'title':
      return push({pos: [-2.5, 6, 26], target: [0, 1.5, -4], fov: 50}, {pos: [-1.5, 5.0, 20], target: [0, 1.6, -4], fov: 46}, u, t, 0.006);
    case 'shrine':
      return push({pos: V([0.6, 1.25, 1.6]), target: V([0, 0.95, 0]), fov: 40}, {pos: V([0.4, 1.15, 1.15]), target: V([0, 0.95, 0]), fov: 36}, u, t);
    case 'sorcerer':
      return push({pos: V([0.1, 1.3, 2.4]), target: V([0, 1.15, 0]), fov: 42}, {pos: V([0.05, 1.3, 1.8]), target: V([0, 1.2, 0]), fov: 38}, u, t);
    case 'xray1':
    case 'xray2':
      return push({pos: V([0, 1.05, 3.6]), target: V([0, 1.0, 0]), fov: 40}, {pos: V([0, 1.1, 3.0]), target: V([0, 1.05, 0]), fov: 38}, u, t, 0.003);
    case 'day':
      return push({pos: [-1.6, 1.8, 5.6], target: [2.4, 2.4, 0.8], fov: 46}, {pos: [-1.0, 1.9, 4.8], target: [2.4, 2.5, 0.8], fov: 42}, u, t);
    case 'smileclose':
      return push({pos: [1.3, 3.5, 1.1], target: [2.37, 3.22, 0.79], fov: 34}, {pos: [1.5, 3.47, 1.05], target: [2.37, 3.23, 0.79], fov: 32}, u, t, 0.002);
    case 'dinner':
      return push({pos: H([1.0, 1.05, 2.3]), target: H([1.0, 0.55, 0.45]), fov: 46}, {pos: H([1.0, 1.0, 2.05]), target: H([1.0, 0.58, 0.45]), fov: 42}, u, t);
    case 'midnight':
      return push({pos: H([1.9, 2.1, 2.0]), target: H([-1.0, 0.2, -1.0]), fov: 48}, {pos: H([1.6, 1.9, 1.6]), target: H([-1.0, 0.25, -1.0]), fov: 44}, u, t, 0.002);
    case 'eyes':
    case 'situp': {
      // close on her face on the pillow (eyes snap open); "situp": she rises into frame
      const head = H([-1.2 + 0.0, 0.2, -1.2 - 0.7]);
      if (s.id === 'situp') return push({pos: H([-1.1, 0.9, -0.35]), target: H([-1.2, 0.72, -1.55]), fov: 42}, {pos: H([-1.12, 0.88, -0.55]), target: H([-1.2, 0.78, -1.55]), fov: 40}, u, t, 0.002);
      return push({pos: at(head, [0.05, 0.62, 0.32]), target: head, fov: 32}, {pos: at(head, [0.04, 0.5, 0.26]), target: head, fov: 28}, u, t, 0.0015);
    }
    case 'creep':
      // following her down the lane, closing in as her head comes round
      return push({pos: [-0.4, 1.0, 4.6], target: [-0.8, 0.8, -2.5], fov: 44}, {pos: [-0.7, 1.15, 1.8], target: [-0.8, 1.05, -1.2], fov: 40}, u, t);
    case 'fridge':
      return push({pos: H([-0.55, 1.15, -4.35]), target: H([-1.05, 0.75, -6.4]), fov: 46}, {pos: H([-0.6, 1.1, -4.6]), target: H([-1.05, 0.78, -6.4]), fov: 42}, u, t, 0.002);
    case 'trapped': {
      const head = H([-1.05, 1.06, -5.9]);
      return push({pos: at(head, [0.6, 0.02, -0.6]), target: head, fov: 34}, {pos: at(head, [0.5, 0.02, -0.5]), target: head, fov: 32}, u, t, 0.0015);
    }
    case 'trapped2':
    {
      // her face in the dark corridor, staring out: whoever is inside can't look away
      const head = H([0, 1.59, -3.2]);
      return push({pos: at(head, [0.03, 0.0, 0.95]), target: head, fov: 30}, {pos: at(head, [0.02, 0.0, 0.62]), target: head, fov: 28}, u, t, 0.0015);
    }
    case 'hands': {
      // through her own eyes, looking down at her hands at the kitchen counter
      // across the counter: her hands at work, her face bowed over them
      return push({pos: H([0.95, 1.42, -6.22]), target: H([0.0, 1.2, -6.22]), fov: 50}, {pos: H([0.82, 1.4, -6.22]), target: H([0.0, 1.22, -6.22]), fov: 46}, u, t, 0.003);
    }
    case 'empty':
      return push({pos: [0.2, 1.6, -6], target: [0, 1.4, -30], fov: 46}, {pos: [0.2, 1.6, -8], target: [0, 1.4, -30], fov: 44}, u, t, 0.003);
    case 'drop':
      return push({pos: V([0.0, 0.44, 0.7]), target: V([0, 0.42, 0]), fov: 38}, {pos: V([0.0, 0.43, 0.6]), target: V([0, 0.42, 0]), fov: 36}, u, t, 0.0015);
    case 'elder': {
      const head = H([1.8, 0.85, -0.3]);
      return push({pos: at(head, [-0.15, 0.03, 0.85]), target: head, fov: 32}, {pos: at(head, [-0.1, 0.02, 0.65]), target: head, fov: 30}, u, t, 0.002);
    }
    case 'avert': {
      const head = H([0.4, 1.59, -1.2]);
      return push({pos: at(head, [0.02, 0.0, 0.7]), target: head, fov: 28}, {pos: at(head, [0.02, 0.0, 0.52]), target: head, fov: 26}, u, t, 0.0015);
    }
    case 'clock':
      return push({pos: H([0.3, 1.9, 0.2]), target: H([0.3, 1.95, -1.98]), fov: 30}, {pos: H([0.3, 1.92, -0.4]), target: H([0.3, 1.95, -1.98]), fov: 28}, u, t, 0.0015);
    case 'hallway':
      // creeping down the dark corridor toward the kitchen
      return {pos: add(lerp3(H([0, 1.55, -1.8]), H([0, 1.52, -3.0]), easeInOut(u)), [Math.sin(t * 3.2) * 0.01, Math.abs(Math.sin(t * 3.2)) * 0.012, 0]), target: H([0.05, 1.3, -8]), fov: 46};
    case 'switch':
      return push({pos: H([-0.25, 1.4, -3.2]), target: H([0.46, 1.3, -3.8]), fov: 40}, {pos: H([-0.15, 1.38, -3.32]), target: H([0.46, 1.3, -3.8]), fov: 36}, u, t, 0.002);
    default:
      return {pos: [0, 1, 5], target: [0, 1, 0], fov: 40};
  }
};
