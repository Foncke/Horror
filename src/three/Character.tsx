import React, {useMemo} from 'react';
import * as THREE from 'three';
import {FaceKind, faceTexture} from './textures';

/** Toy-like vinyl figure: big sphere head, soft capsule body. Feet at the group origin, ~1.6 m tall. */
export type Outfit = 'you' | 'clerk' | 'bellhop' | 'guest' | 'guest2' | 'guest3';

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
};

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
};

type Props = Pose & {
  outfit: Outfit;
  face?: FaceKind;
  position?: [number, number, number];
  rotationY?: number;
  faceGlow?: number;
  faceOpacity?: number;
  shadows?: boolean;
};

export const Character: React.FC<Props> = ({outfit, face = 'calm', position = [0, 0, 0], rotationY = 0, faceGlow = 0, faceOpacity = 1, shadows = true, ...pose}) => {
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
    const tex = faceTexture(face);
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
  }, [face]);
  faceMat.opacity = faceOpacity;
  if (face === 'grin') faceMat.emissiveIntensity = (0.9 + faceGlow) * faceOpacity;

  const cast = shadows;
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <group position={[0, bob, 0]}>
        {/* legs */}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.1, hip, 0]} rotation={[sit ? -Math.PI / 2 : s * swing, 0, 0]}>
            <mesh geometry={geo.leg} material={cloth(o.legs)} position={[0, -0.27, 0]} castShadow={cast} />
          </group>
        ))}
        {/* torso */}
        <group position={[0, hip, 0]} rotation={[hunch, 0, 0]}>
          <mesh geometry={geo.torso} material={cloth(o.body)} position={[0, 0.36, 0]} scale={[1, 1 + breathe, 0.82]} castShadow={cast} />
          {outfit === 'bellhop' &&
            [0.5, 0.38, 0.26].map((y) => <mesh key={y} geometry={geo.button} material={gold()} position={[0, y, 0.165]} />)}
          {/* arms */}
          {[-1, 1].map((s) => {
            const base = s === -1 ? (pose.armL ?? 0) : (pose.armR ?? 0);
            const out = s === 1 ? (pose.armROut ?? 0) : 0;
            return (
              <group key={s} position={[s * 0.25, 0.6, 0]} rotation={[base - s * swing * 0.8, 0, s * (0.1 + out)]}>
                <mesh geometry={geo.limb} material={cloth(o.arm)} position={[0, -0.25, 0]} castShadow={cast} />
                <mesh geometry={geo.hand} material={vinyl(o.hands)} position={[0, -0.5, 0]} castShadow={cast} />
              </group>
            );
          })}
          {/* head */}
          <group position={[0, 0.86, 0]} rotation={[pose.headPitch ?? 0, pose.headYaw ?? 0, pose.headRoll ?? 0]}>
            <mesh geometry={geo.head} material={vinyl(o.skin, outfit === 'bellhop' ? 0.12 : 0.38)} castShadow={cast} />
            <mesh geometry={geo.face} material={faceMat} />
            {outfit === 'bellhop' && (
              <group position={[0, 0.2, -0.01]} rotation={[-0.12, 0, 0.08]}>
                <mesh geometry={geo.hatTop} material={cloth('#5b1419')} castShadow={cast} />
                <mesh geometry={geo.hatBand} material={gold()} position={[0, -0.035, 0]} />
              </group>
            )}
            {outfit === 'clerk' && (
              <group>
                <mesh geometry={geo.capCrown} material={cloth('#14201b')} position={[0, 0, 0]} castShadow={cast} />
                <mesh geometry={geo.capBrim} material={cloth('#0f1814')} position={[0, -0.02, 0.06]} scale={[1.05, 1, 1.55]} />
              </group>
            )}
          </group>
        </group>
      </group>
    </group>
  );
};
