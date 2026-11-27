import React, {useMemo} from 'react';
import * as THREE from 'three';
import {Spot} from '../../three/Common';
import {clamp, easeInOut, lerp} from '../../lib/timeline';
import {Hand, Human, HumanFace, Seg, twitch} from './Human';
import {Box, m, plain, planks} from './Village';
import {HOUSE, ShotId, cue, tremble} from './cues';

type V3 = [number, number, number];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

const matTexture = () => {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#b89a62';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 8) {
    ctx.fillStyle = y % 16 ? 'rgba(90,60,30,0.35)' : 'rgba(255,240,200,0.15)';
    ctx.fillRect(0, y, 256, 4);
  }
  ctx.strokeStyle = '#7a2f26';
  ctx.lineWidth = 10;
  ctx.strokeRect(10, 10, 236, 236);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

const Plate: React.FC<{p: V3; r?: number}> = ({p, r = 0.13}) => (
  <group position={p}>
    <mesh material={plain('#9aa0a4', 0.3)} receiveShadow castShadow>
      <cylinderGeometry args={[r, r * 0.85, 0.02, 32]} />
    </mesh>
  </group>
);
const Bowl: React.FC<{p: V3}> = ({p}) => (
  <mesh position={p} material={m('bowl', () => new THREE.MeshStandardMaterial({color: '#a8aeb2', metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide}))} castShadow>
    <sphereGeometry args={[0.07, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
  </mesh>
);

/** Oil lamp with a flickering flame. */
const Lamp: React.FC<{p: V3; t: number; on: number}> = ({p, t, on}) => {
  const flick = 0.92 + Math.sin(t * 5.3) * 0.035 + Math.sin(t * 11.7) * 0.02;
  return (
    <group position={p}>
      <mesh material={plain('#6a4a2a', 0.5)}>
        <cylinderGeometry args={[0.05, 0.07, 0.08, 16]} />
      </mesh>
      {on > 0 && (
        <>
          <mesh position={[0, 0.08, 0]} material={m('flame', () => new THREE.MeshBasicMaterial({color: '#ffcc77'}))} scale={[0.012, 0.03 * flick, 0.012]}>
            <sphereGeometry args={[1, 12, 8]} />
          </mesh>
          <pointLight position={[0, 0.15, 0]} intensity={4.5 * on * flick} distance={6} decay={1.7} color="#ff9a48" castShadow />
        </>
      )}
    </group>
  );
};

/** Mosquito net over a sleeping mat. */
const Net: React.FC<{p: V3}> = ({p}) => {
  const net = m('net2', () => new THREE.MeshStandardMaterial({color: '#e8e4dc', transparent: true, opacity: 0.22, side: THREE.FrontSide, roughness: 1, depthWrite: false}));
  return (
    <mesh position={add(p, [0, 0.85, 0.05])} material={net}>
      <boxGeometry args={[1.15, 1.7, 2.15]} />
    </mesh>
  );
};

/** Wall clock; `hours` as a fraction (3 = three o'clock). */
const Clock: React.FC<{p: V3; hours: number}> = ({p, hours}) => {
  const face = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#e9e0cc';
    ctx.beginPath();
    ctx.arc(128, 128, 126, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a2018';
    ctx.font = '700 34px Oswald';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 1; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.fillText(String(i), 128 + Math.sin(a) * 96, 128 - Math.cos(a) * 96);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  const hourA = -(hours / 12) * Math.PI * 2;
  const minA = -((hours % 1) * Math.PI * 2);
  return (
    <group position={p}>
      <mesh material={plain('#3a2a1e', 0.6)} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.04, 40]} />
      </mesh>
      <mesh position={[0, 0, 0.022]}>
        <circleGeometry args={[0.18, 40]} />
        <meshStandardMaterial map={face} roughness={0.7} />
      </mesh>
      <group position={[0, 0, 0.026]} rotation={[0, 0, hourA]}>
        <Box p={[0, 0.05, 0]} s={[0.014, 0.1, 0.004]} mat={plain('#120d0a')} cast={false} />
      </group>
      <group position={[0, 0, 0.03]} rotation={[0, 0, minA]}>
        <Box p={[0, 0.07, 0]} s={[0.009, 0.14, 0.004]} mat={plain('#120d0a')} cast={false} />
      </group>
    </group>
  );
};

/** Forearm + hand reaching from the camera side (POV), with a little tremble. */
const PovArm: React.FC<{from: V3; to: V3; curl: number; side: number}> = ({from, to, curl, side}) => {
  const dir = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const len = dir.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize());
  return (
    <group position={from} quaternion={q}>
      <Seg len={len} r={0.03} color="#868780" />
      <group position={[0, -len, 0]} rotation={[0, side * 0.3, 0]}>
        <Hand skin="#868780" curl={curl} side={side} />
      </group>
    </group>
  );
};

export const HouseSet: React.FC<{t: number; shot: ShotId}> = ({t, shot}) => {
  const floor = planks();
  const wall = planks();
  const matTex = useMemo(matTexture, []);
  const isTrapped = shot === 'trapped' || shot === 'trapped2';
  const lampOn = shot === 'partner' || shot === 'dinner' || shot === 'elder' ? 1 : 0;

  // the host: where she is and what she looks like in each shot
  const sleeping = shot === 'sleeper' || shot === 'midnight' || shot === 'eyes';
  const wake = t > cue.wakes - 0.05;
  const hostFace: HumanFace = shot === 'eyes' ? (wake ? 'wake' : 'sleep') : shot === 'sleeper' || shot === 'midnight' ? 'sleep' : 'wake';

  return (
    <group position={HOUSE}>
      <color attach="background" args={['#05080b']} />
      <fogExp2 attach="fog" args={['#071016', 0.08]} />
      <hemisphereLight args={['#1d3a48', '#0b0806', lampOn ? 0.35 : 0.55]} />
      {/* moonlight through the window */}
      <Spot position={[-2.4, 2.2, 1.6]} target={[-0.8, 0, -0.8]} intensity={lampOn ? 4 : 14} angle={0.6} penumbra={0.8} distance={9} decay={1.3} color="#6f9ab8" shadow />

      {/* main room shell */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.25]} material={floor} receiveShadow>
        <planeGeometry args={[5, 4.5]} />
      </mesh>
      <Box p={[0, 2.6, 0.25]} s={[5, 0.05, 4.5]} mat={plain('#2a1d14')} cast={false} />
      <Box p={[-2.5, 1.3, 0.25]} s={[0.06, 2.6, 4.5]} mat={wall} />
      <Box p={[2.5, 1.3, 0.25]} s={[0.06, 2.6, 4.5]} mat={wall} />
      <Box p={[0, 1.3, 2.5]} s={[5, 2.6, 0.06]} mat={wall} />
      {/* back wall with a doorway into the corridor */}
      <Box p={[-1.475, 1.3, -2]} s={[2.05, 2.6, 0.06]} mat={wall} />
      <Box p={[1.475, 1.3, -2]} s={[2.05, 2.6, 0.06]} mat={wall} />
      <Box p={[0, 2.35, -2]} s={[0.9, 0.5, 0.06]} mat={wall} />
      {/* window (left wall) with moonlight */}
      <mesh position={[-2.46, 1.5, 1.6]} rotation={[0, Math.PI / 2, 0]} material={m('moonwin', () => new THREE.MeshBasicMaterial({color: '#4f7d99'}))}>
        <planeGeometry args={[0.8, 0.7]} />
      </mesh>

      {/* corridor and kitchen */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -4.5]} material={floor} receiveShadow>
        <planeGeometry args={[3.2, 5]} />
      </mesh>
      <Box p={[-0.5, 1.3, -3]} s={[0.06, 2.6, 2]} mat={wall} />
      <Box p={[0.5, 1.3, -3]} s={[0.06, 2.6, 2]} mat={wall} />
      <Box p={[0, 2.6, -4.5]} s={[3.2, 0.05, 5]} mat={plain('#1d140e')} cast={false} />
      <Box p={[-1.6, 1.3, -5.5]} s={[0.06, 2.6, 3]} mat={wall} />
      <Box p={[1.6, 1.3, -5.5]} s={[0.06, 2.6, 3]} mat={wall} />
      <Box p={[0, 1.3, -7]} s={[3.2, 2.6, 0.06]} mat={wall} />
      <Box p={[-1.05, 1.3, -4]} s={[1.1, 2.6, 0.06]} mat={wall} />
      <Box p={[1.05, 1.3, -4]} s={[1.1, 2.6, 0.06]} mat={wall} />
      {/* the light switch you must not touch */}
      <group position={[0.465, 1.3, -3.8]} rotation={[0, -Math.PI / 2, 0]}>
        <Box p={[0, 0, 0]} s={[0.08, 0.12, 0.015]} mat={plain('#d8d2c4', 0.5)} cast={false} />
        <Box p={[0, 0.012, 0.012]} s={[0.022, 0.035, 0.015]} mat={plain('#efe9dc', 0.4)} cast={false} />
      </group>
      {/* kitchen: counter, clay jars, shelf, fridge */}
      <Box p={[0.3, 0.45, -6.6]} s={[2.0, 0.9, 0.6]} mat={plain('#5a3e2a')} />
      <Box p={[0.3, 0.92, -6.6]} s={[2.05, 0.05, 0.65]} mat={plain('#3a2a1e')} />
      {[-0.4, -0.15, 1.0].map((x, i) => (
        <mesh key={x} position={[x, 1.08, -6.7]} material={plain('#7a4a2e', 0.8)} scale={[0.1, 0.13 + i * 0.03, 0.1]} castShadow>
          <sphereGeometry args={[1, 18, 12]} />
        </mesh>
      ))}
      <Box p={[0.3, 1.7, -6.9]} s={[1.6, 0.04, 0.25]} mat={plain('#3a2a1e')} />
      <group position={[-1.1, 0, -6.55]}>
        <Box p={[0, 0.85, 0]} s={[0.6, 1.7, 0.6]} mat={plain('#c9c6bd', 0.4)} />
        {/* door swings open toward the room; cold light inside */}
        {shot === 'fridge' || isTrapped || shot === 'hands' || shot === 'hallway' || shot === 'switch' ? (
          <>
            {!isTrapped && shot !== 'hands' && (
              <group position={[0.3, 0.85, 0.3]} rotation={[0, 1.6, 0]}>
                <Box p={[-0.3, 0, 0.02]} s={[0.6, 1.7, 0.05]} mat={plain('#d0cdc4', 0.4)} />
              </group>
            )}
            <mesh position={[0, 0.85, 0.27]} material={m('fridgein2', () => new THREE.MeshBasicMaterial({color: '#62808c'}))}>
              <planeGeometry args={[0.52, 1.6]} />
            </mesh>
            <pointLight position={[0, 1.15, 0.36]} intensity={2.4} distance={5} decay={1.5} color="#bfe3ff" castShadow />
          </>
        ) : (
          <Box p={[0, 0.85, 0.31]} s={[0.6, 1.7, 0.03]} mat={plain('#d0cdc4', 0.4)} />
        )}
      </group>
      {/* raw meat on a board: only ever a dark wet shape */}
      <Box p={[0.0, 0.96, -6.5]} s={[0.45, 0.03, 0.3]} mat={plain('#4a3020')} />
      <mesh position={[0.0, 1.0, -6.5]} material={m('meat', () => new THREE.MeshStandardMaterial({color: '#3a1010', roughness: 0.25}))} scale={[0.14, 0.04, 0.09]}>
        <sphereGeometry args={[1, 16, 10]} />
      </mesh>

      {/* living room: wall clock, mats, dinner, lamp */}
      <Clock p={[0.3, 1.95, -1.96]} hours={shot === 'clock' ? lerp(2.97, 3.0, clamp((t - cue.andThey) / 1.6)) : 11.8} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-1.2, 0.012, -1.0]}>
        <planeGeometry args={[1.0, 2.1]} />
        <meshStandardMaterial map={matTex} roughness={1} />
      </mesh>
      <mesh position={[-1.2, 0.06, -1.85]} material={plain('#e6e0d4')} scale={[0.28, 0.06, 0.14]}>
        <sphereGeometry args={[1, 20, 12]} />
      </mesh>
      <Net p={[-1.2, 0, -1.0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[1.0, 0.012, 0.4]}>
        <planeGeometry args={[1.6, 1.6]} />
        <meshStandardMaterial map={matTex} roughness={1} />
      </mesh>
      <Plate p={[0.75, 0.02, 0.5]} />
      <Plate p={[1.25, 0.02, 0.25]} />
      <Plate p={[1.0, 0.02, 0.85]} />
      <Bowl p={[1.0, 0.07, 0.45]} />
      <mesh position={[1.3, 0.09, 0.65]} material={plain('#a8844e')} castShadow>
        <cylinderGeometry args={[0.06, 0.08, 0.16, 16]} />
      </mesh>
      <Lamp p={[1.55, 0.04, 0.0]} t={t} on={lampOn} />
      {(shot === 'partner' || shot === 'dinner') && <pointLight position={[2.0, 1.1, 1.6]} intensity={shot === 'partner' ? 5 : 2.5} distance={4} decay={1.6} color="#ffb070" />}
      {shot === 'dinner' && <pointLight position={[1.0, 1.5, 1.9]} intensity={3.5} distance={4} decay={1.4} color="#ffc890" />}
      {(shot === 'sleeper' || shot === 'midnight' || shot === 'situp' || shot === 'clock') && <pointLight position={[-0.3, 1.6, 0.4]} intensity={shot === 'clock' ? 3 : 5} distance={5} decay={1.4} color="#7fa8c8" />}

      {/* people */}
      {sleeping && (
        // the host asleep under the net, head on the pillow
        <Human face={hostFace} rotationX={-Math.PI / 2} position={[-1.2, 0.14, -0.28]} armL={0.1} armR={0.1} headRoll={hostFace === 'wake' ? twitch(t, 8) : 0} breathe={t} />
      )}
      {(shot === 'partner' || shot === 'dinner') && (
        <Human outfit="man" face="neutral" position={shot === 'partner' ? [1.0, 0, 0.6] : [1.15, 0, -0.15]} rotationY={shot === 'partner' ? 0.1 : 0.2} hipY={0.14} thigh={-1.45} knee={2.7} spread={0.5} armL={-0.4} armR={-0.6} elbowL={-0.9} elbowR={-1.0} headYaw={shot === 'partner' ? 0.25 * easeInOut(clamp((t - cue.partner) / 1.2)) : -0.3} breathe={t} />
      )}
      {shot === 'dinner' && (
        <>
          <Human face="smile" position={[1.55, 0, 0.95]} rotationY={-1.9} hipY={0.14} thigh={-1.45} knee={2.7} spread={0.5} armL={-0.5} armR={-0.8} elbowL={-0.8} elbowR={-1.1} headYaw={0.5} breathe={t} />
          <Human outfit="elder" face="elder" position={[0.35, 0, 0.55]} rotationY={1.6} hipY={0.14} thigh={-1.45} knee={2.7} spread={0.5} armL={-0.4} armR={-0.6} elbowL={-0.9} elbowR={-0.9} breathe={t} />
        </>
      )}
      {shot === 'elder' && (
        <>
          <Human outfit="elder" face="elder" position={[1.8, 0, -0.3]} rotationY={-0.15} hipY={0.14} thigh={-1.45} knee={2.7} spread={0.5} armL={-0.5} armR={-0.5} elbowL={-0.9} elbowR={-0.9} headPitch={0.05} breathe={t} />
          <Lamp p={[1.6, 0.04, 0.3]} t={t} on={1} />
        </>
      )}
      {shot === 'situp' && (
        // she sits bolt upright on her mat at three in the morning
        <Human face="wake" position={[-1.2, 0.05, -1.55]} rotationY={0.1} hipY={0.14} thigh={-1.5} knee={0.1} hunch={lerp(-1.45, 0.05, easeInOut(clamp((t - cue.three + 0.25) / 0.9)))} armL={-0.2} armR={-0.2} headPitch={-0.1} headYaw={twitch(t, 6)} headRoll={twitch(t, 9) * 0.8} />
      )}
      {(shot === 'fridge' || isTrapped || shot === 'hallway' || shot === 'switch') && (
        // crouched at the open fridge, lit only by its cold light
        <Human face={isTrapped ? 'possessed' : 'possessed'} position={shot === 'hallway' || shot === 'switch' ? [-0.1, 0, -5.95] : [-1.05, 0, -5.6]} rotationY={Math.PI} hipY={0.45} thigh={-1.9} knee={2.4} spread={0.3} hunch={0.5} armL={isTrapped ? -0.2 : -1.2} armR={isTrapped ? -0.25 : -1.5} elbowL={-0.3} elbowR={-0.5} headPitch={isTrapped ? -0.15 : -0.2} headYaw={(shot === 'fridge' ? 2.75 * easeInOut(clamp((t - (cue.worst - 1.8)) / 1.1)) : shot === 'hallway' ? 2.75 * easeInOut(clamp((t - (cue.kitchen - 0.4)) / 0.9)) : shot === 'switch' ? 2.75 : 0) + twitch(t)} headRoll={twitch(t, 5) * 0.8} curl={0.6} hairDrift={t} />
      )}
      {shot === 'trapped2' && (
        <>
          <Human face="wake" position={[0, 0, -3.2]} headYaw={twitch(t, 3)} headRoll={twitch(t, 11) * 0.9} breathe={t * 2} hairDrift={t} />
          <Spot position={[0.2, 2.1, -2.0]} target={[0, 1.59, -3.2]} intensity={3} angle={0.3} penumbra={1} distance={4} color="#8fb8e0" />
        </>
      )}
      {shot === 'avert' && (
        // cold blue light; the eyes slide away from yours
        <>
          <Human face="avert" position={[0.4, 0, -1.2]} headYaw={-0.12 + twitch(t, 1)} headRoll={twitch(t, 4) * 0.7} breathe={t} hairDrift={t} />
          <Spot position={[0.1, 2.0, 0.2]} target={[0.4, 1.59, -1.2]} intensity={4} angle={0.3} penumbra={1} distance={4} color="#8fb8e0" />
        </>
      )}
      {shot === 'hands' && (
        // at the counter: her hands work over the dark shape on their own while she can only watch
        <>
          <Human
            face="possessed"
            position={[0.0, 0, -5.95]}
            rotationY={Math.PI}
            hunch={0.35}
            armL={-0.75 + Math.sin(t * 4.1) * 0.08}
            armR={-0.8 + Math.sin(t * 3.7 + 1) * 0.08}
            outL={0.05}
            outR={0.05}
            elbowL={-0.7 + Math.sin(t * 5.3) * 0.12}
            elbowR={-0.75 + Math.sin(t * 4.6 + 2) * 0.12}
            curl={0.55 + Math.sin(t * 6) * 0.3}
            headPitch={0.55}
            headYaw={twitch(t, 2)}
            headRoll={twitch(t, 7) * 0.9}
            hairDrift={t}
          />
          <pointLight position={[-0.6, 1.3, -5.7]} intensity={2.2} distance={3} decay={1.6} color="#bfe3ff" />
          <pointLight position={[0.4, 1.4, -6.6]} intensity={0.8} distance={2} decay={1.6} color="#7fa0b8" />
        </>
      )}
      {shot === 'switch' && (
        <PovArm from={[0.05, 1.05, -3.25]} to={[lerp(0.25, 0.43, easeInOut(clamp((t - cue.dont + 0.1) / 1.0))), 1.27, lerp(-3.55, -3.78, easeInOut(clamp((t - cue.dont + 0.1) / 1.0)))]} curl={0.25} side={1} />
      )}
      {shot === 'fridge' && <pointLight position={[-0.55, 1.35, -4.7]} intensity={1.6 * easeInOut(clamp((t - (cue.worst - 1.8)) / 1.1))} distance={2.5} decay={1.5} color="#9fc0d8" />}
      {(shot === 'hallway' || shot === 'switch') && <pointLight position={[0, 1.2, -5.0]} intensity={4.5} distance={4.5} decay={1.6} color="#9fc8e8" />}
      {shot === 'switch' && <pointLight position={[0.0, 1.6, -3.2]} intensity={1.2} distance={2} decay={1.6} color="#7f9fb8" />}
    </group>
  );
};
