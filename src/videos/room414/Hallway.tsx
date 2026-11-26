import React from 'react';
import {Box, Door, Sconce, Spot, WallWithDoors, std} from '../../three/Common';
import {Character, Outfit} from '../../three/Character';
import {carpetTexture, wallpaperTexture} from '../../three/textures';
import {clamp, easeInOut, hash} from '../../lib/timeline';
import {ShotId, cue} from './cues';

const Z_NEAR = 8;
const Z_FAR = -46;
const ZC = (Z_NEAR + Z_FAR) / 2;
const LEN = Z_NEAR - Z_FAR;
const HALF = 1.3;
const H = 2.8;

const leftDoors = Array.from({length: 13}, (_, i) => 4 - i * 4); // 4, 0, -4, -8 (414), -12 (416) ...
const rightDoors = Array.from({length: 13}, (_, i) => 2 - i * 4); // 2, -2, -6, -10 (415) ...
const leftNumber = (z: number) => String(414 + (-z - 8) / 2);
const rightNumber = (z: number) => String(415 + (-z - 10) / 2);

type V2 = [number, number];
/** Walk along a polyline at constant speed; returns position, heading and distance walked. */
const follow = (pts: V2[], speed: number, elapsed: number) => {
  let d = Math.max(0, elapsed) * speed;
  const walked = d;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const seg = Math.hypot(bx - ax, bz - az);
    if (d <= seg || i === pts.length - 2) {
      const u = Math.min(1, d / seg);
      return {x: ax + (bx - ax) * u, z: az + (bz - az) * u, heading: Math.atan2(bx - ax, bz - az), walked, moving: elapsed > 0 && d < seg + 0.001};
    }
    d -= seg;
  }
  const [x, z] = pts[pts.length - 1];
  return {x, z, heading: 0, walked, moving: false};
};

const SPEED = 1.0;

/** Guests who leave their rooms, in the order they come out. */
const GUESTS: {door: 'L' | 'R'; z: number; at: number; outfit: Outfit; lane: number}[] = [
  {door: 'L', z: -12, at: cue.guestsStart + 0.3, outfit: 'guest', lane: -0.18},
  {door: 'R', z: -10, at: cue.guestsStart + 1.1, outfit: 'guest2', lane: 0.2},
  {door: 'R', z: -14, at: cue.guestsStart + 2.4, outfit: 'guest3', lane: -0.15},
  {door: 'L', z: -16, at: cue.guestsStart + 4.0, outfit: 'guest', lane: 0.17},
  {door: 'R', z: -18, at: cue.guestsStart + 5.4, outfit: 'guest2', lane: -0.16},
];

const doorOpenAt = (side: 'L' | 'R', z: number): number | null => {
  if (side === 'L' && z === -12) return cue.opens - 0.25;
  const g = GUESTS.find((x) => x.door === side && x.z === z);
  return g ? g.at - 0.9 : null;
};

const bellhopAt = (t: number) => {
  if (t < cue.moves) return {x: -0.62, z: -8, heading: -Math.PI / 2, walk: 0};
  const toNext = follow([[-0.62, -8], [-0.1, -9.2], [-0.1, -11.4], [-0.72, -12]], 1.6, t - cue.moves);
  if (t < cue.guestsStart) {
    const settled = !toNext.moving;
    return {x: toNext.x, z: toNext.z, heading: settled ? -Math.PI / 2 : toNext.heading, walk: settled ? 0 : toNext.walked * 7};
  }
  const away = follow([[-0.72, -12], [0.0, -12.9], [0.0, -60]], SPEED, t - cue.guestsStart);
  return {x: away.x, z: away.z, heading: away.heading, walk: away.walked * 7};
};

export const Hallway: React.FC<{t: number; shot: ShotId}> = ({t, shot}) => {
  const carpet = carpetTexture();
  carpet.repeat.set(2, LEN / 2);
  const paper = wallpaperTexture();
  paper.repeat.set(LEN / 1.2, 1);
  const wallMat = std('#433d33', 0.85, 0, {map: paper});

  // lights flicker when the hallway empties
  let flicker = 1;
  if (shot === 'empty') {
    const k = Math.floor(t * 14);
    flicker = hash(k) > 0.72 ? 0.25 + hash(k + 3) * 0.3 : 0.9 + hash(k * 1.3) * 0.1;
  }

  const roomsLit = shot !== 'empty';
  const knocking = t > cue.knocks2[0] - 0.6 && t < cue.opens + 0.3;
  let knockBump = 0;
  for (const k of cue.knocks2) knockBump += Math.exp(-Math.pow((t - (k - 0.05)) / 0.06, 2));

  const b = bellhopAt(t);
  const showPeople = shot !== 'empty';
  const peep = shot === 'peephole' || shot === 'grin';
  const grinOn = clamp((t - cue.smiling) / 0.5);

  return (
    <group>
      <color attach="background" args={['#040405']} />
      <fogExp2 attach="fog" args={['#050507', 0.052]} />
      <hemisphereLight args={['#2b3240', '#0b0705', 0.25 * flicker]} />

      {/* floor, ceiling, end walls */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, ZC]} receiveShadow>
        <planeGeometry args={[HALF * 2, LEN]} />
        <meshStandardMaterial map={carpet} roughness={1} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, H, ZC]} material={std('#1a1816', 1)}>
        <planeGeometry args={[HALF * 2, LEN]} />
      </mesh>
      <mesh position={[0, H / 2, Z_FAR]} material={std('#0c0b0a', 1)}>
        <planeGeometry args={[HALF * 2, H]} />
      </mesh>
      <mesh position={[0, H / 2, Z_NEAR]} rotation={[0, Math.PI, 0]} material={std('#0c0b0a', 1)}>
        <planeGeometry args={[HALF * 2, H]} />
      </mesh>

      {/* left wall (414 is here), local +z faces the corridor */}
      <group position={[-HALF, 0, ZC]} rotation={[0, Math.PI / 2, 0]}>
        <WallWithDoors length={LEN} height={H} doors={leftDoors.map((z) => ({x: -(z - ZC)}))} material={wallMat} base={std('#1b1410', 0.6)} />
        <Box size={[LEN, 0.1, 0.06]} position={[0, H - 0.05, 0.03]} material={std('#221a14', 0.6)} cast={false} />
        {leftDoors.map((z) => {
          const at = doorOpenAt('L', z);
          const open = at === null ? 0 : easeInOut(clamp((t - at) / 1.4)) * 1.25;
          const isNext = z === -12;
          return (
            <Door key={z} x={-(z - ZC)} number={leftNumber(z)} open={open} interior={roomsLit && open > 0 ? 'warm' : 'dark'} shake={isNext && knocking ? -knockBump * 0.008 : 0}>
              {isNext && showPeople && t < GUESTS[0].at - 0.9 && t > cue.opens - 0.4 && (
                <Character outfit="guest" face="sleepwalk" position={[0, 0, -0.55]} breathe={t} />
              )}
            </Door>
          );
        })}
        {leftDoors.map((z) => (
          <Sconce key={`s${z}`} position={[-(z - 2 - ZC), 1.85, 0]} intensity={flicker} />
        ))}
      </group>

      {/* right wall */}
      <group position={[HALF, 0, ZC]} rotation={[0, -Math.PI / 2, 0]}>
        <WallWithDoors length={LEN} height={H} doors={rightDoors.map((z) => ({x: z - ZC}))} material={wallMat} base={std('#1b1410', 0.6)} />
        <Box size={[LEN, 0.1, 0.06]} position={[0, H - 0.05, 0.03]} material={std('#221a14', 0.6)} cast={false} />
        {rightDoors.map((z) => {
          const at = doorOpenAt('R', z);
          const open = at === null ? 0 : easeInOut(clamp((t - at) / 1.4)) * 1.25;
          return <Door key={z} x={z - ZC} number={rightNumber(z)} open={open} interior={roomsLit && open > 0 ? 'warm' : 'dark'} />;
        })}
        {rightDoors.map((z) => (
          <Sconce key={`s${z}`} position={[z - 2 - ZC, 1.85, 0]} intensity={flicker} />
        ))}
      </group>

      {/* light pools from the ceiling */}
      {[4, -2, -8, -14, -20, -26].map((z) => (
        <pointLight key={z} position={[0, 2.55, z]} intensity={3.2 * flicker} distance={9} decay={1.9} color="#ffc489" />
      ))}
      <Spot position={[0.2, 2.7, -9.5]} target={[-0.3, 0, -11.5]} angle={1.0} penumbra={0.9} intensity={5 * flicker} color="#ffd3a0" distance={9} shadow />

      {/* warm light spilling out of the rooms that opened */}
      {roomsLit &&
        GUESTS.concat([{door: 'L', z: -12, at: cue.opens - 0.25 + 0.9, outfit: 'guest', lane: 0}]).map((g, i) =>
          t > g.at - 0.9 ? (
            <pointLight key={i} position={[g.door === 'L' ? -HALF + 0.3 : HALF - 0.3, 1.4, g.z]} intensity={1.2 * easeInOut(clamp((t - g.at + 0.9) / 1.2))} distance={3.5} decay={2} color="#ffae63" />
          ) : null,
        )}

      {/* the bellhop */}
      {showPeople && (
        <Character
          outfit="bellhop"
          face={peep ? (grinOn > 0 || shot === 'grin' ? 'grin' : 'blank') : 'grin'}
          faceOpacity={peep && shot !== 'grin' ? grinOn : 1}
          position={shot === 'grin' ? [-0.78, 0, -8] : peep ? [-0.62, 0, -8] : [b.x, 0, b.z]}
          rotationY={peep ? -Math.PI / 2 : b.heading}
          walk={peep ? 0 : b.walk}
          stride={0.32}
          headRoll={peep ? (shot === 'grin' ? 0.32 : grinOn * 0.18 + Math.sin(t * 0.5) * 0.02) : 0}
          headPitch={shot === 'grin' ? 0.02 : peep ? -0.04 : 0}
          hunch={shot === 'grin' ? 0.08 : 0}
          armR={knocking && !peep ? -1.4 - knockBump * 0.22 : 0}
          armROut={knocking && !peep ? -0.15 : 0}
          breathe={t}
        />
      )}

      {/* the guests following him */}
      {showPeople &&
        GUESTS.map((g, i) => {
          const sx = g.door === 'L' ? -1 : 1;
          const p = follow(
            [
              [sx * 1.85, g.z],
              [sx * 0.8, g.z],
              [g.lane, g.z - 0.8],
              [g.lane, -60],
            ],
            SPEED,
            t - g.at,
          );
          if (t < g.at - 0.9) return null;
          return (
            <Character
              key={i}
              outfit={g.outfit}
              face="sleepwalk"
              position={[p.x, 0, p.z]}
              rotationY={t < g.at ? (g.door === 'L' ? Math.PI / 2 : -Math.PI / 2) : p.heading}
              walk={p.walked * 7}
              stride={0.22}
              armL={-0.25}
              armR={-0.25}
              headPitch={0.12}
              breathe={t + i}
            />
          );
        })}
    </group>
  );
};

