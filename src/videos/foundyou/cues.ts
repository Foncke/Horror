import timingsJson from '../../../projects/foundyou/timings.json';
import {Cam} from '../../three/Common';
import {Timings, clamp, easeInOut, easeOut, hash, lerp, makeCues} from '../../lib/timeline';

export const timings = timingsJson as Timings;
const c = makeCues(timings);
const L = (i: number) => c.line(i).start;
const LEAD = 0.12;
const LASTW = timings.words[timings.words.length - 1];

/** Named moments in the story, all taken from the voiceover. */
export const cue = {
  look: c.word(0, 'look').start,
  turn: c.word(0, 'turn').start,
  missed: c.word(1, 'missed').start,
  sunGone: c.word(1, 'gone').start,
  wasnt: c.word(1, 'wasn').start,
  flashlight: c.word(1, 'flashlight').start,
  silent: c.word(2, 'silent').start,
  crunch: c.word(2, 'crunch').start,
  froze: c.word(3, 'froze').start,
  answer: c.word(5, 'they', 1).start,
  instead: c.word(5, 'instead').start,
  head: c.word(5, 'head').start,
  shoulder: c.word(5, 'shoulder').start,
  areYouLost: c.word(6, 'are').start,
  spun: c.word(7, 'spun').start,
  heart: c.word(7, 'heart').start,
  whipped: c.word(7, 'whipped').start,
  gone: c.word(7, 'gone').start,
  until: c.word(8, 'until').start,
  felt: c.word(8, 'felt').start,
  whispered: c.word(8, 'whispered').start,
  found: c.word(8, 'found').start,
  /** hard cut to black right after "Found you." (same moment as the mix) */
  cut: LASTW.end + 0.06,
  end: LASTW.end + 0.06 + 2.6,
};

export type ShotId =
  | 'hook' | 'ridge' | 'gear' | 'stop' | 'boots' | 'sweep' | 'figure' | 'yell' | 'stare' | 'tilt'
  | 'behind' | 'spin' | 'shaking' | 'breath' | 'black';

export type Shot = {id: ShotId; start: number; end: number};

const order: [ShotId, number][] = [
  ['hook', 0],
  ['ridge', L(1) - LEAD],
  ['gear', cue.wasnt - 0.1],
  ['stop', L(2) - LEAD],
  ['sweep', L(3) - LEAD],
  ['figure', L(4) - LEAD],
  ['yell', L(5) - LEAD],
  ['stare', cue.answer - 0.1],
  ['tilt', cue.instead - 0.1],
  ['behind', L(6) - LEAD],
  ['spin', L(7) - LEAD],
  ['shaking', L(8) - LEAD],
  ['breath', cue.felt - 0.1],
  ['black', cue.cut],
];

export const shots: Shot[] = order.map(([id, start], i) => ({
  id,
  start: Math.max(0, start),
  end: i + 1 < order.length ? order[i + 1][1] : cue.end,
}));

export const shotAt = (t: number) => shots.find((s) => t >= s.start && t < s.end) ?? shots[shots.length - 1];

// --- the place ----------------------------------------------------------------
type V3 = [number, number, number];
/** Where she reads the map on the ridge trail (setup). */
export const RIDGE: V3 = [0, 0, 16];
/** The massive pine, twenty feet ahead of where she stops (she stands at the origin facing -z). */
export const PINE: V3 = [0.35, 0, -6.5];
export const PINE_R = 0.55;
/** The thing behind the pine. */
export const MIMIC: V3 = [-0.32, 0, -7.0];
export const MIMIC_SCALE = 1.12;
export const EYE = 1.56; // her eye height
export const mimicHead = (): V3 => [MIMIC[0], (0.62 + 0.86) * MIMIC_SCALE, MIMIC[2]];

/** How far the mimic's head has bent toward its shoulder (radians). */
export const neckBend = (t: number) => 1.45 * easeInOut(clamp((t - cue.head - 0.2) / (cue.shoulder - cue.head + 0.4)));

/** Mimic leaning in behind her ear at the end. */
export const leanIn = (t: number) => easeOut(clamp((t - cue.felt) / (cue.whispered - cue.felt + 0.3)));

/** 0 at night, 1 in golden dusk. The hook is blue dusk; the setup starts golden and the sun sets on "gone". */
export const dusk = (t: number) => {
  if (t < L(1) - LEAD) return 0.3;
  return 1 - easeInOut(clamp((t - cue.sunGone + 0.6) / 2.2));
};

export const flashOn = (t: number) => t < L(1) - LEAD || t >= cue.flashlight;

export const mimicVisible = (s: ShotId) => ['figure', 'stare', 'tilt', 'behind', 'breath'].includes(s) || (s === 'sweep');

// --- cameras ------------------------------------------------------------------
const lerp3 = (a: V3, b: V3, u: number): V3 => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
const add = (...vs: V3[]): V3 => vs.reduce((a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], [0, 0, 0]);

const handheld = (t: number, amp = 0.01): V3 => [
  (Math.sin(t * 0.9) * 0.6 + Math.sin(t * 2.3 + 1) * 0.25) * amp,
  (Math.sin(t * 1.1 + 2) * 0.6 + Math.sin(t * 2.9) * 0.2) * amp,
  0,
];
/** Nervous tremble: faster, smaller, noisier. */
const tremble = (t: number, amp: number): V3 => [
  (Math.sin(t * 13.1) * 0.5 + Math.sin(t * 23.7 + 1) * 0.3 + (hash(Math.floor(t * 30)) - 0.5) * 0.4) * amp,
  (Math.sin(t * 11.3 + 2) * 0.5 + Math.sin(t * 19.1) * 0.3 + (hash(Math.floor(t * 30) + 7) - 0.5) * 0.4) * amp,
  0,
];

/** First-person camera from a position, a heading (yaw, 0 = looking down -z, + turns left) and a pitch. */
const pov = (pos: V3, yaw: number, pitch: number, fov: number, roll = 0): Cam => ({
  pos,
  target: [pos[0] - Math.sin(yaw) * Math.cos(pitch) * 10, pos[1] + Math.sin(pitch) * 10, pos[2] - Math.cos(yaw) * Math.cos(pitch) * 10],
  fov,
  roll,
});
const yawTo = (from: V3, to: V3) => Math.atan2(-(to[0] - from[0]), -(to[2] - from[2]));
const pitchTo = (from: V3, to: V3) => Math.atan2(to[1] - from[1], Math.hypot(to[0] - from[0], to[2] - from[2]));

const linear = (u: number) => u;
const move = (from: Cam, to: Cam, u: number, t: number, amp = 0.01, ease = easeInOut): Cam => {
  const e = ease(u);
  const h = handheld(t, amp);
  return {
    pos: add(lerp3(from.pos, to.pos, e), h),
    target: add(lerp3(from.target, to.target, e), [h[0] * 0.5, h[1] * 0.5, 0]),
    fov: lerp(from.fov ?? 40, to.fov ?? 40, e),
    roll: lerp(from.roll ?? 0, to.roll ?? 0, e),
  };
};

const HERE: V3 = [0, EYE, 0];

export type View = {cam: Cam; beam: {pos: V3; target: V3}; pov: boolean};

/** Flashlight held low and to the right of the eyes, pointing where you look (plus a shake). */
const povBeam = (cam: Cam, t: number, shake: number) => {
  const d: V3 = [cam.target[0] - cam.pos[0], cam.target[1] - cam.pos[1], cam.target[2] - cam.pos[2]];
  const len = Math.hypot(...d);
  const f: V3 = [d[0] / len, d[1] / len, d[2] / len];
  const r: V3 = [-f[2], 0, f[0]]; // right, on the ground plane
  const rl = Math.hypot(r[0], r[2]) || 1;
  const pos = add(cam.pos, [(r[0] / rl) * 0.24, -0.3, (r[2] / rl) * 0.24], [f[0] * 0.2, f[1] * 0.2, f[2] * 0.2]);
  const j = tremble(t + 3, shake);
  return {pos, target: add(cam.pos, [f[0] * 10 + j[0] * 10, f[1] * 10 + j[1] * 10, f[2] * 10])};
};

/** Her own flashlight in third-person shots: from her right hand, pointing ahead of her. */
const handBeam = (at: V3, facingYaw: number, pitch: number, t: number, shake = 0.01) => {
  const j = tremble(t + 5, shake);
  const pos: V3 = [at[0] - Math.cos(facingYaw) * 0.26, 1.08, at[2] + Math.sin(facingYaw) * 0.26 - Math.cos(facingYaw) * 0.42];
  return {pos, target: [pos[0] - Math.sin(facingYaw + j[0]) * 10, pos[1] + (pitch + j[1]) * 10, pos[2] - Math.cos(facingYaw + j[0]) * 10] as V3};
};

/** Everything the camera and flashlight do at time t. */
export const viewAt = (t: number): View => {
  const s = shotAt(t);
  const u = clamp((t - s.start) / (s.end - s.start));
  switch (s.id) {
    case 'hook': {
      // walking the trail in fog; on "look" your eyes drift up to the canopy, on "turn" you turn round
      const z = lerp(27, 20.5, u);
      const bob = Math.sin(t * 7.2) * 0.025;
      const up = easeInOut(clamp((t - cue.look + 0.1) / 1.4)) * (1 - easeInOut(clamp((t - cue.turn + 0.2) / 0.9)));
      const back = easeInOut(clamp((t - cue.turn) / 1.3));
      const cam = pov([Math.sin(t * 0.8) * 0.04, EYE + bob, z], back * Math.PI + Math.sin(t * 0.5) * 0.05, -0.04 + up * 0.75, 46);
      return {cam, beam: povBeam({...cam, target: pov(cam.pos, back * Math.PI, -0.12 + up * 0.5, 46).target}, t, 0.004), pov: true};
    }
    case 'ridge': {
      const cam = move({pos: [2.3, 1.3, 19.4], target: [0, 1.25, 15.4], fov: 44}, {pos: [1.9, 1.4, 18.6], target: [0, 1.25, 15.4], fov: 40}, u, t, 0.008, linear);
      return {cam, beam: handBeam(RIDGE, 0, -0.3, t), pov: false};
    }
    case 'gear': {
      const cam = move({pos: [0.55, 1.66, 16.35], target: [-0.04, 0.98, 15.58], fov: 40}, {pos: [0.5, 1.6, 16.22], target: [-0.04, 0.98, 15.6], fov: 36}, u, t, 0.004, linear);
      return {cam, beam: {pos: [0.12, 1.45, RIDGE[2] - 0.1], target: [0.02, 0.95, RIDGE[2] - 0.45]}, pov: false};
    }
    case 'stop': {
      const cam = move({pos: [0.42, 1.5, -1.9], target: [0, 1.45, 0], fov: 40}, {pos: [0.32, 1.5, -1.45], target: [0, 1.47, 0], fov: 38}, u, t, 0.006, linear);
      return {cam, beam: handBeam([0, 0, 0], 0.35 * Math.sin(t * 0.6), -0.08, t, 0.012), pov: false};
    }
    case 'boots': {
      const cam = move({pos: [1.0, 0.4, -1.7], target: [0, 0.25, 0.1], fov: 46}, {pos: [0.9, 0.36, -1.5], target: [0, 0.25, 0.05], fov: 44}, u, t, 0.004, linear);
      return {cam, beam: {pos: [-0.25, 1.05, -0.35], target: [0.05, 0, -0.75]}, pov: false};
    }
    case 'sweep': {
      // the beam sweeps across the treeline, then snaps onto the pine on "froze"
      const onPine = yawTo(HERE, PINE) + 0.04;
      const sweep = lerp(1.05, -0.75, easeInOut(clamp((t - s.start) / (cue.froze - s.start - 0.15))));
      const snap = easeOut(clamp((t - cue.froze + 0.12) / 0.25));
      const yaw = lerp(sweep, onPine, snap);
      const cam = pov(add(HERE, tremble(t, 0.003)), yaw, -0.02 + snap * 0.02, 46);
      return {cam, beam: povBeam(cam, t, 0.006 + snap * 0.01), pov: true};
    }
    case 'figure': {
      const target = mimicHead();
      const from = add(HERE, [0, 0, 0]);
      const to: V3 = [0, EYE, -0.9];
      const p = add(lerp3(from, to, easeInOut(u)), tremble(t, 0.003));
      const cam = pov(p, yawTo(p, target), pitchTo(p, target) * 0.6, lerp(44, 34, easeInOut(u)));
      return {cam, beam: povBeam(cam, t, 0.012), pov: true};
    }
    case 'yell': {
      const cam = move({pos: [0.18, 1.5, -1.25], target: [0, 1.48, 0], fov: 40}, {pos: [0.14, 1.5, -1.0], target: [0, 1.48, 0], fov: 38}, u, t, 0.006, linear);
      return {cam, beam: handBeam([0, 0, 0], yawTo([0, 0, 0], MIMIC) , -0.02, t, 0.015), pov: false};
    }
    case 'stare': {
      const h = mimicHead();
      const cam = move({pos: [h[0] + 0.2, h[1] - 0.05, h[2] + 1.9], target: h, fov: 36}, {pos: [h[0] + 0.16, h[1] - 0.04, h[2] + 1.55], target: h, fov: 34}, u, t, 0.003, linear);
      cam.pos = add(cam.pos, tremble(t, 0.006));
      return {cam, beam: povBeam({pos: [0, EYE, -1.0], target: h}, t, 0.02), pov: false};
    }
    case 'tilt': {
      const h = mimicHead();
      const cam = move({pos: [h[0] + 0.3, h[1] - 0.2, h[2] + 2.6], target: [h[0] - 0.1, h[1] - 0.25, h[2]], fov: 40}, {pos: [h[0] + 0.25, h[1] - 0.18, h[2] + 2.1], target: [h[0] - 0.12, h[1] - 0.25, h[2]], fov: 38}, u, t, 0.003, linear);
      cam.pos = add(cam.pos, tremble(t, 0.004));
      return {cam, beam: povBeam({pos: [0, EYE, -1.0], target: add(h, [-0.15, -0.15, 0])}, t, 0.018), pov: false};
    }
    case 'behind': {
      // her face, and the black woods behind her where the voice comes from
      const cam = move({pos: [-0.12, 1.5, -1.15], target: [0, 1.5, 0.4], fov: 42}, {pos: [-0.08, 1.5, -0.85], target: [0, 1.5, 0.4], fov: 40}, u, t, 0.004, linear);
      return {cam, beam: handBeam([0, 0, 0], yawTo([0, 0, 0], MIMIC), -0.02, t, 0.02), pov: false};
    }
    case 'spin': {
      // whip round to the dark behind you; heart pounding; whip back to the pine: nothing there
      const round = easeInOut(clamp((t - cue.spun + 0.15) / 0.4));
      const back = easeInOut(clamp((t - cue.whipped + 0.1) / 0.35));
      const search = Math.sin((t - cue.spun) * 0.9) * 0.45 * (1 - back);
      const yaw = lerp(lerp(yawTo(HERE, PINE), Math.PI + search, round), yawTo(HERE, PINE) + 0.04, back);
      const beat = t > cue.heart && t < cue.whipped ? Math.max(0, Math.sin((t - cue.heart) * Math.PI * 2 / 0.62)) ** 8 * 0.012 : 0;
      const cam = pov(add(HERE, tremble(t, 0.004), [0, -beat, 0]), yaw, -0.03, 46);
      return {cam, beam: povBeam(cam, t, 0.012), pov: true};
    }
    case 'shaking': {
      // sweeping the light in every direction, until something touches your neck
      const still = easeInOut(clamp((t - cue.until + 0.2) / 0.8));
      const yaw = (Math.sin(t * 1.7) * 1.4 + Math.sin(t * 3.1 + 1) * 0.5) * (1 - still);
      const cam = pov(add(HERE, tremble(t, 0.006 * (1 - still * 0.6))), yaw, -0.05 + Math.sin(t * 2.3) * 0.08 * (1 - still), 48);
      return {cam, beam: povBeam(cam, t, 0.02), pov: true};
    }
    case 'breath': {
      const cam = move({pos: [-0.2, 1.5, -1.3], target: [0.12, 1.52, 0.2], fov: 46}, {pos: [-0.16, 1.5, -1.05], target: [0.14, 1.53, 0.2], fov: 44}, clamp((t - s.start) / 7), t, 0.003, linear);
      return {cam, beam: handBeam([0, 0, 0], 0.5, -0.45, t, 0.02), pov: false};
    }
    default:
      return {cam: pov(HERE, 0, 0, 40), beam: {pos: HERE, target: [0, 1, -5]}, pov: true};
  }
};
