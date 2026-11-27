import React, {useMemo} from 'react';
import * as THREE from 'three';
import {FaceKind, faceTexture} from './textures';

/** Toy-like vinyl figure: big sphere head, soft capsule body. Feet at the group origin, ~1.6 m tall. */
export type Outfit = 'you' | 'clerk' | 'bellhop' | 'guest' | 'guest2' | 'guest3' | 'pajamas' | 'double' | 'hiker' | 'mimic';

export type Pose = {
  headPitch?: number; // + looks down
  headYaw?: number;
  headRoll?: number;
  armL?: number; // shoulder pitch, - raises forward
  armR?: number;
  armROut?: number;
  walk?: number; // walk cycle phase in radians (0 = standing)
  stride?: number;
  sit?: boolean;
  breathe?: number; // time in seconds for idle breathing
  hunch?: number;
  neckRoll?: number; // head bends sideways at the neck (+ toward the figure's left shoulder)
};

const geo = {
  head: new THREE.SphereGeometry(0.21, 64, 48),
  face: new THREE.SphereGeometry(0.2112, 64, 32, Math.PI / 2 - 1.25, 2.5, 0.2 * Math.PI, 0.62 * Math.PI),
  torso: new THREE.CapsuleGeometry(0.2, 0.36, 12, 32),
  limb: new THREE.CapsuleGeometry(0.058, 0.4, 8, 16),
  leg: new THREE.CapsuleGeometry(0.075, 0.42, 8, 16),
  hand: new THREE.SphereGeometry(0.068, 24, 16),
  hatTop: new THREE.CylinderGeometry(0.15, 0.16, 0.12, 40),
  hatBand: new THREE.CylinderGeometry(0.162, 0.162, 0.035, 40),
  capCrown: new THREE.SphereGeometry(0.224, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.53),
  capBrim: new THREE.CylinderGeometry(0.2, 0.2, 0.02, 40, 1, false, -0.9, 1.8),
  button: new THREE.SphereGeometry(0.018, 12, 8),
  eye: new THREE.SphereGeometry(1, 24, 16),
  hairBack: new THREE.CapsuleGeometry(0.2, 0.24, 12, 32),
  hairLock: new THREE.CapsuleGeometry(0.052, 0.28, 8, 16),
  bow: new THREE.SphereGeometry(1, 20, 12),
};
const voidMat = new THREE.MeshBasicMaterial({color: '#000000'});

const mats = new Map<string, THREE.Material>();
const mat = (key: string, make: () => THREE.Material) => {
  if (!mats.has(key)) mats.set(key, make());
  return mats.get(key)!;
};
const vinyl = (color: string, rough = 0.38) =>
  mat(`vinyl-${color}-${rough}`, () => new THREE.MeshPhysicalMaterial({color, roughness: rough, clearcoat: 0.6, clearcoatRoughness: 0.35}));
const cloth = (color: string) => mat(`cloth-${color}`, () => new THREE.MeshStandardMaterial({color, roughness: 0.92}));
const gold = () => mat('gold', () => new THREE.MeshStandardMaterial({color: '#c99a45', metalness: 1, roughness: 0.3}));

const OUTFIT: Record<Outfit, {skin: string; body: string; arm: string; legs: string; hands: string}> = {
  you: {skin: '#ebe7df', body: '#5d626c', arm: '#5d626c', legs: '#2c3038', hands: '#ebe7df'},
  clerk: {skin: '#ebe7df', body: '#1d2b25', arm: '#1d2b25', legs: '#151a18', hands: '#ebe7df'},
  bellhop: {skin: '#09090b', body: '#5b1419', arm: '#5b1419', legs: '#1a0c0e', hands: '#f1eee8'},
  guest: {skin: '#ebe7df', body: '#dcd7cd', arm: '#dcd7cd', legs: '#dcd7cd', hands: '#ebe7df'},
  guest2: {skin: '#ebe7df', body: '#8f9db0', arm: '#8f9db0', legs: '#56606d', hands: '#ebe7df'},
  guest3: {skin: '#ebe7df', body: '#b08f7a', arm: '#b08f7a', legs: '#5d4a3d', hands: '#ebe7df'},
  // 3 A.M.: you (a girl) and your double wear the same pink pajamas; the double is paler
  pajamas: {skin: '#ebe7df', body: '#c97ba3', arm: '#c97ba3', legs: '#b26d93', hands: '#ebe7df'},
  double: {skin: '#c4c1b9', body: '#c97ba3', arm: '#c97ba3', legs: '#b26d93', hands: '#c4c1b9'},
  // Found You: the hiker and the thing that copies her (same clothes, paler skin)
  hiker: {skin: '#ebe7df', body: '#2f6a6c', arm: '#2f6a6c', legs: '#3b3a35', hands: '#ebe7df'},
  mimic: {skin: '#c9c6bf', body: '#2f6a6c', arm: '#2f6a6c', legs: '#3b3a35', hands: '#c9c6bf'},
};
const HAIR: Partial<Record<Outfit, string>> = {pajamas: '#3a2418', double: '#3a2418', hiker: '#5a321f', mimic: '#5a321f'};
/** Knit beanie and backpack for the hiking outfits. */
const HIKING: Partial<Record<Outfit, boolean>> = {hiker: true, mimic: true};
/** Outfits drawn as a girl: long hair, a bow, lashes and blush. */
const GIRLY: Partial<Record<Outfit, boolean>> = {pajamas: true, double: true, hiker: true, mimic: true};

type Props = Pose & {
  outfit: Outfit;
  face?: FaceKind;
  position?: [number, number, number];
  rotationY?: number;
  faceGlow?: number;
  faceOpacity?: number;
  shadows?: boolean;
  /** draw only the head (e.g. someone tucked under a blanket) */
  headOnly?: boolean;
};

export const Character: React.FC<Props> = ({outfit, face = 'calm', position = [0, 0, 0], rotationY = 0, faceGlow = 0, faceOpacity = 1, shadows = true, headOnly = false, ...pose}) => {
  const o = OUTFIT[outfit];
  const walk = pose.walk ?? 0;
  const stride = pose.stride ?? (walk ? 0.45 : 0);
  const swing = Math.sin(walk) * stride;
  const bob = walk ? Math.abs(Math.cos(walk)) * 0.03 : 0;
  const breathe = Math.sin((pose.breathe ?? 0) * 1.6) * 0.008;
  const sit = pose.sit ?? false;
  const hip = sit ? 0.5 : 0.62;
  const hunch = pose.hunch ?? 0;

  const faceMat = useMemo(() => {
    const tex = faceTexture(face, GIRLY[outfit] ?? false);
    if (face === 'grin') {
      return new THREE.MeshStandardMaterial({
        map: tex,
        emissiveMap: tex,
        emissive: new THREE.Color('#ffffff'),
        transparent: true,
        depthWrite: false,
        roughness: 0.2,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      });
    }
    return new THREE.MeshStandardMaterial({map: tex, transparent: true, depthWrite: false, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2});
  }, [face, outfit]);
  faceMat.opacity = faceOpacity;
  if (face === 'grin') faceMat.emissiveIntensity = (0.9 + faceGlow) * faceOpacity;

  const cast = shadows;
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <group position={[0, bob, 0]}>
        {/* legs */}
        {!headOnly && [-1, 1].map((s) => (
          <group key={s} position={[s * 0.1, hip, 0]} rotation={[sit ? -Math.PI / 2 : s * swing, 0, 0]}>
            <mesh geometry={geo.leg} material={cloth(o.legs)} position={[0, -0.27, 0]} castShadow={cast} />
          </group>
        ))}
        {/* torso */}
        <group position={[0, hip, 0]} rotation={[hunch, 0, 0]}>
          {!headOnly && <mesh geometry={geo.torso} material={cloth(o.body)} position={[0, 0.36, 0]} scale={[1, 1 + breathe, 0.82]} castShadow={cast} />}
          {outfit === 'bellhop' &&
            [0.5, 0.38, 0.26].map((y) => <mesh key={y} geometry={geo.button} material={gold()} position={[0, y, 0.165]} />)}
          {/* arms */}
          {!headOnly && [-1, 1].map((s) => {
            const base = s === -1 ? (pose.armL ?? 0) : (pose.armR ?? 0);
            const out = s === 1 ? (pose.armROut ?? 0) : 0;
            return (
              <group key={s} position={[s * 0.25, 0.6, 0]} rotation={[base - s * swing * 0.8, 0, s * (0.1 + out)]}>
                <mesh geometry={geo.limb} material={cloth(o.arm)} position={[0, -0.25, 0]} castShadow={cast} />
                <mesh geometry={geo.hand} material={vinyl(o.hands)} position={[0, -0.5, 0]} castShadow={cast} />
              </group>
            );
          })}
          {HIKING[outfit] && !headOnly && (
            <group position={[0, 0.42, -0.2]}>
              <mesh material={cloth('#7a4a2a')} castShadow={cast} scale={[0.3, 0.42, 0.16]}>
                <boxGeometry args={[1, 1, 1]} />
              </mesh>
              <mesh material={cloth('#5e3820')} position={[0, 0.14, -0.06]} scale={[0.32, 0.12, 0.12]}>
                <boxGeometry args={[1, 1, 1]} />
              </mesh>
            </group>
          )}
          {/* head, on a neck that can bend sideways */}
          <group position={[0, 0.65, 0]} rotation={[0, 0, pose.neckRoll ?? 0]}>
          <group position={[0, 0.21, 0]} rotation={[pose.headPitch ?? 0, pose.headYaw ?? 0, pose.headRoll ?? 0]}>
            <mesh geometry={geo.head} material={outfit === 'double' || outfit === 'mimic' ? cloth(o.skin) : vinyl(o.skin, outfit === 'bellhop' ? 0.12 : 0.38)} castShadow={cast} />
            {(face === 'double' || face === 'doubleWide' || face === 'void' || face === 'voidGrin') &&
              [-1, 1].map((s) => (
                // pitch-black eyes: unlit, so no light ever reflects in them
                <mesh key={s} geometry={geo.eye} material={voidMat} position={[s * 0.0565, -0.004, 0.2043]} rotation={[0, s * 0.27, s * 0.12]} scale={[0.04, 0.05, 0.022]} />
              ))}
            <mesh geometry={geo.face} material={faceMat} />
            {outfit === 'bellhop' && (
              <group position={[0, 0.2, -0.01]} rotation={[-0.12, 0, 0.08]}>
                <mesh geometry={geo.hatTop} material={cloth('#5b1419')} castShadow={cast} />
                <mesh geometry={geo.hatBand} material={gold()} position={[0, -0.035, 0]} />
              </group>
            )}
            {HAIR[outfit] && (
              <mesh geometry={geo.capCrown} material={cloth(HAIR[outfit]!)} position={[0, 0.03, -0.035]} rotation={[GIRLY[outfit] ? -0.45 : -0.62, 0, 0]} scale={[1.03, 1.0, 1.05]} castShadow={cast} />
            )}
            {GIRLY[outfit] && (
              <group>
                {/* long hair down the back, locks framing the face */}
                <mesh geometry={geo.hairBack} material={cloth(HAIR[outfit]!)} position={[0, -0.13, -0.07]} scale={[1.1, 1, 0.62]} castShadow={cast} />
                {[-1, 1].map((s) => (
                  <mesh key={s} geometry={geo.hairLock} material={cloth(HAIR[outfit]!)} position={[s * 0.182, -0.15, -0.005]} rotation={[0.08, 0, s * 0.1]} castShadow={cast} />
                ))}
                {/* a pink bow */}
                {!HIKING[outfit] && <group position={[0.145, 0.185, 0.06]} rotation={[0.2, 0.5, -0.7]}>
                  {[-1, 1].map((s) => (
                    <mesh key={s} geometry={geo.bow} material={cloth('#ff8fb8')} position={[s * 0.034, 0, 0]} rotation={[0, 0, s * 0.35]} scale={[0.036, 0.026, 0.014]} />
                  ))}
                  <mesh geometry={geo.bow} material={cloth('#e0609a')} scale={[0.014, 0.014, 0.016]} />
                </group>}
              </group>
            )}
            {outfit === 'clerk' && (
              <group>
                <mesh geometry={geo.capCrown} material={cloth('#14201b')} position={[0, 0, 0]} castShadow={cast} />
                <mesh geometry={geo.capBrim} material={cloth('#0f1814')} position={[0, -0.02, 0.06]} scale={[1.05, 1, 1.55]} />
              </group>
            )}
            {HIKING[outfit] && (
              <group position={[0, 0.045, -0.02]} rotation={[-0.3, 0, 0]}>
                <mesh geometry={geo.capCrown} material={cloth('#c4572b')} scale={[1.06, 1.08, 1.06]} castShadow={cast} />
                <mesh material={cloth('#c4572b')} position={[0, 0.25, 0]}>
                  <sphereGeometry args={[0.045, 16, 12]} />
                </mesh>
              </group>
            )}
          </group>
          </group>
        </group>
      </group>
    </group>
  );
};
