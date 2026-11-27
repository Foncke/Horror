import React from 'react';
import * as THREE from 'three';
import {Character} from '../../three/Character';
import {Box, Door, Spot, WallWithDoors, glow, std, woodTrim} from '../../three/Common';
import {FaceKind, clockTexture} from '../../three/textures';
import {clamp, easeInOut, lerp} from '../../lib/timeline';
import {
  CLOSET_X, FIGURE_SCALE, FIGURE_X, HEAD, ROOM, ShotId, closetOpen, cue, figureHead, figureHunch, figureLean,
  figureVisible, figureZ, fingers,
} from './cues';

const {W, D, H} = ROOM;
const DOOR_W = 0.9;
const DOOR_H = 2.1;

/** Your head on the pillow: a group turned so the face looks at the ceiling, tilted a little toward the foot of the bed. */
const LIE = -Math.PI / 2 + 0.15;
const headGroupPos = (): [number, number, number] => [HEAD[0], HEAD[1] - 1.48 * Math.cos(LIE), HEAD[2] - 1.48 * Math.sin(LIE)];

/** Four pale fingers curling round the free edge of the closet door (door-local coordinates). */
const Fingers: React.FC<{open: number; reveal: number}> = ({open, reveal}) => {
  if (reveal <= 0) return null;
  const edge: [number, number, number] = [-DOOR_W / 2 + DOOR_W * Math.cos(open) - 0.015, 0, -0.02 - DOOR_W * Math.sin(open)];
  const skin = std('#bfbbb2', 0.85);
  const z = lerp(-0.07, 0.036, reveal);
  return (
    <group position={edge} rotation={[0, open, 0]}>
      {[1.22, 1.262, 1.302, 1.338].map((y, i) => {
        const len = [0.042, 0.052, 0.05, 0.036][i];
        return (
          <group key={y} position={[[0, 0.006, 0.004, -0.004][i], y, 0]} rotation={[0, [0.12, 0.05, 0.08, 0.18][i], -0.06 + i * 0.04]}>
            <mesh material={skin} position={[0.012, 0, z - 0.02]}>
              <sphereGeometry args={[0.0125, 12, 8]} />
            </mesh>
            <mesh material={skin} position={[0.012 - len / 2 * reveal, 0, z]} rotation={[0, 0, Math.PI / 2]}>
              <capsuleGeometry args={[0.0105, len, 6, 10]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

export const Bedroom: React.FC<{t: number; shot: ShotId}> = ({t, shot}) => {
  const wall = std('#3b404c', 0.95);
  const open = closetOpen(t);

  // you, on the pillow
  let face: FaceKind = 'worried';
  if (shot === 'clock') face = 'sleepwalk';
  if (shot === 'frozen') face = 'scared';
  if (shot === 'eyes') face = t > cue.slowly ? 'scaredDown' : 'scared';
  if (shot === 'scream') face = 'scared';
  const showYou = ['clock', 'wake', 'frozen', 'eyes', 'scream'].includes(shot);
  const shiver = shot === 'scream' ? Math.sin(t * 47) * 0.004 : shot === 'frozen' ? Math.sin(t * 31) * 0.0015 : 0;

  // the double
  const lean = figureLean(t);
  const hunch = figureHunch(t);
  const head = figureHead(t);
  const lookDown = Math.atan2(head[1] - HEAD[1], head[2] - HEAD[2]);
  const doubleFace: FaceKind = t < cue.smile + 0.35 ? 'double' : 'doubleWide';
  const showFigure = figureVisible(t);

  // something waiting in the closet once the door opens
  const closetGuest = clamp((t - cue.creaked) / 2.5);

  const clockText = t < cue.three ? '2:59' : '3:00';
  const closeOnYou = shot === 'wake' || shot === 'eyes' || shot === 'scream' || shot === 'clock';
  const closeOnIt = shot === 'double' || shot === 'speak';

  return (
    <group>
      <color attach="background" args={['#020203']} />
      <fogExp2 attach="fog" args={['#04050a', 0.075]} />
      <hemisphereLight args={['#3a4868', '#0c0a08', 0.7]} />

      {/* moonlight through the window on the right wall, across the bed toward the closet */}
      <Spot position={[W / 2 - 0.08, 1.95, -0.55]} target={[-0.5, 0.7, 1.2]} angle={0.8} penumbra={0.9} intensity={24} color="#8ea6dc" distance={9} decay={1.3} shadow />
      {/* moonlight bouncing onto the closet wall so the door reads in the dark */}
      <Spot position={[1.0, 2.4, 0.2]} target={[CLOSET_X, 1.1, D / 2]} angle={0.55} penumbra={1} intensity={7} color="#7d93c8" distance={6} decay={1.2} />
      {/* faint cold fill so the room reads in the dark */}
      <pointLight position={[0.2, 2.3, -0.6]} intensity={5} distance={6} decay={1.4} color="#6f80aa" />
      {/* the clock's red glow */}
      <pointLight position={[-0.96, 0.66, -1.8]} intensity={0.9} distance={1.6} decay={2} color="#ff3020" />
      {/* close-up key lights */}
      {closeOnYou && <Spot position={[0.55, 1.85, -1.2]} target={HEAD} angle={0.35} penumbra={1} intensity={6} color="#9fb2e2" distance={3.5} />}
      {showFigure && <Spot position={[-0.35, 1.25, -1.35]} target={head} angle={closeOnIt ? 0.3 : 0.4} penumbra={1} intensity={closeOnIt ? 1.8 : 1.0} color="#b8c6ea" distance={4.5} />}

      {/* shell */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={std('#231a14', 0.75)}>
        <planeGeometry args={[W, D]} />
      </mesh>
      <mesh position={[0, 0.004, -0.3]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={std('#2c2f38', 1)}>
        <planeGeometry args={[2.4, 1.7]} />
      </mesh>
      <mesh position={[0, H, 0]} rotation={[Math.PI / 2, 0, 0]} material={std('#1c1e24', 1)}>
        <planeGeometry args={[W, D]} />
      </mesh>
      <mesh position={[0, H / 2, -D / 2]} receiveShadow material={wall}>
        <planeGeometry args={[W, H]} />
      </mesh>
      <mesh position={[-W / 2, H / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow material={wall}>
        <planeGeometry args={[D, H]} />
      </mesh>
      <mesh position={[W / 2, H / 2, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow material={wall}>
        <planeGeometry args={[D, H]} />
      </mesh>

      {/* the wall in front of the bed, with the closet; turned so local +z faces into the room (local x = -world x) */}
      <group position={[0, 0, D / 2]} rotation={[0, Math.PI, 0]}>
        <WallWithDoors length={W} height={H} doors={[{x: -CLOSET_X, width: DOOR_W, height: DOOR_H}]} material={wall} base={std('#17181c', 0.6)} />
        <Door x={-CLOSET_X} width={DOOR_W} height={DOOR_H} open={open} paint="#a9a69d" hardware={false}>
          <Fingers open={open} reveal={shot === 'creak' ? 0 : fingers(t)} />
          {closetGuest > 0 && (
            <>
              <group position={[0.14, 0, -0.95]}>
                <Character outfit="pajamas" face="calm" breathe={t * 0.4} shadows={false} faceOpacity={closetGuest} />
              </group>
              <pointLight position={[0.0, 1.9, -0.25]} intensity={0.55 * closetGuest} distance={1.6} decay={2} color="#8a9cc8" />
            </>
          )}
        </Door>
      </group>

      {/* window: cold glass between dark curtains */}
      <group position={[W / 2 - 0.02, 1.45, -0.55]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh position={[0, 0, -0.01]} material={glow('#5f78b4', 0.9)}>
          <planeGeometry args={[0.9, 1.2]} />
        </mesh>
        <Box size={[0.03, 1.2, 0.03]} position={[0, 0, 0]} material={std('#15161a', 0.8)} />
        <Box size={[0.9, 0.03, 0.03]} position={[0, 0.1, 0]} material={std('#15161a', 0.8)} />
        <Box size={[0.42, 2.1, 0.06]} position={[-0.6, -0.15, 0.06]} material={std('#1f2433', 1)} />
        <Box size={[0.42, 2.1, 0.06]} position={[0.6, -0.15, 0.06]} material={std('#1f2433', 1)} />
      </group>

      {/* bed: head against the back wall, foot toward the closet */}
      <Box size={[1.6, 0.34, 2.15]} position={[0, 0.17, -1.2]} material={woodTrim()} />
      <Box size={[1.5, 0.22, 2.05]} position={[0, 0.45, -1.22]} material={std('#cfc9bc', 0.95)} />
      <Box size={[1.72, 1.15, 0.08]} position={[0, 0.58, -2.26]} material={std('#2a1d16', 0.7)} />
      <mesh position={[0, 0.66, -2.0]} rotation={[0.2, 0, 0]} scale={[0.42, 0.08, 0.2]} material={std('#e4ded2', 0.95)} castShadow receiveShadow>
        <sphereGeometry args={[1, 32, 16]} />
      </mesh>
      {/* blanket over your body: flat cover plus soft mounds for torso and legs */}
      <Box size={[1.58, 0.06, 1.55]} position={[0, 0.585, -0.95]} material={std('#4a2a33', 1)} />
      <mesh position={[0, 0.6, -1.18]} scale={[0.43, 0.2, 0.55]} material={std('#4a2a33', 1)} castShadow receiveShadow>
        <sphereGeometry args={[1, 40, 24]} />
      </mesh>
      <mesh position={[0, 0.6, -0.5]} scale={[0.37, 0.13, 0.45]} material={std('#4a2a33', 1)} castShadow receiveShadow>
        <sphereGeometry args={[1, 40, 24]} />
      </mesh>
      <Box size={[1.52, 0.05, 0.16]} position={[0, 0.66, -1.68]} rotation={[0.25, 0, 0]} material={std('#ddd7cb', 0.95)} />

      {/* nightstand + clock */}
      <Box size={[0.45, 0.55, 0.4]} position={[-1.15, 0.275, -1.85]} material={woodTrim()} />
      <Box size={[0.08, 0.09, 0.2]} position={[-1.1, 0.595, -1.84]} material={std('#0b0b0c', 0.5)} />
      <mesh position={[-1.0585, 0.597, -1.84]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.18, 0.078]} />
        <meshStandardMaterial map={clockTexture(clockText)} emissiveMap={clockTexture(clockText)} emissive={new THREE.Color('#ffffff')} emissiveIntensity={0.8} />
      </mesh>

      {/* dresser by the closet */}
      <Box size={[0.5, 0.95, 1.0]} position={[-W / 2 + 0.25, 0.475, 0.9]} material={woodTrim()} />

      {/* you */}
      {showYou && (
        <group position={headGroupPos()} rotation={[LIE, 0, 0]}>
          <group position={[shiver, 0, 0]}>
            <Character outfit="pajamas" face={face} headOnly shadows={false} />
          </group>
        </group>
      )}

      {/* the double, wearing your pajamas, at the foot of your bed */}
      {showFigure && (
        <group position={[FIGURE_X, 0, figureZ(t)]} rotation={[0, Math.PI, 0]} scale={FIGURE_SCALE}>
          <Character
            outfit="double"
            face={doubleFace}
            hunch={hunch}
            headPitch={lookDown - hunch * 1.05}
            headRoll={0.06 + 0.1 * easeInOut(clamp((t - cue.question) / 1.5))}
            armL={lerp(0, -hunch - 0.2, lean)}
            armR={lerp(0, -hunch - 0.2, lean)}
            breathe={t * 0.25}
          />
        </group>
      )}
    </group>
  );
};
