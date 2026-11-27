import React, {useMemo} from 'react';
import * as THREE from 'three';
import {FaceKind, faceTexture} from '../../three/textures';

/**
 * The thing in the woods: a tall, gaunt, grey skinwalker wearing a dark animal pelt.
 * Feet at the group origin, faces +z, about 2.15 m tall. Head centre at SKINWALKER_HEAD_Y when upright.
 */
export const SKIN_HIP = 1.0;
export const SKIN_NECK = 0.72; // from hip to the base of the neck
export const SKIN_HEAD = 0.26; // from the base of the neck to the head centre
export const SKINWALKER_HEAD_Y = SKIN_HIP + SKIN_NECK + SKIN_HEAD;

const HEAD_R = 0.17;
const HEAD_SCALE: [number, number, number] = [0.85, 1.3, 0.95]; // long, narrow skull

const geo = {
  limb: new THREE.CapsuleGeometry(1, 1, 6, 12),
  ball: new THREE.SphereGeometry(1, 32, 20),
  head: new THREE.SphereGeometry(HEAD_R, 48, 32),
  face: new THREE.SphereGeometry(HEAD_R * 1.006, 64, 32, Math.PI / 2 - 1.25, 2.5, 0.2 * Math.PI, 0.62 * Math.PI),
  hood: new THREE.SphereGeometry(HEAD_R * 1.12, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.55),
  cone: new THREE.ConeGeometry(1, 1, 10),
  neck: new THREE.CylinderGeometry(0.03, 0.04, 0.2, 12),
};

const mats = {
  skin: new THREE.MeshStandardMaterial({color: '#80827c', roughness: 0.9}),
  rib: new THREE.MeshStandardMaterial({color: '#5e605a', roughness: 0.9}),
  fur: new THREE.MeshStandardMaterial({color: '#2a2018', roughness: 1}),
  furDark: new THREE.MeshStandardMaterial({color: '#1a140f', roughness: 1}),
  claw: new THREE.MeshStandardMaterial({color: '#141210', roughness: 0.4}),
  void: new THREE.MeshBasicMaterial({color: '#000000'}),
};

/** A capsule from the origin going down -y, of a given length and radius. */
const Bone: React.FC<{len: number; r: number; mat?: THREE.Material; cast?: boolean}> = ({len, r, mat = mats.skin, cast = true}) => (
  <mesh geometry={geo.limb} material={mat} position={[0, -len / 2, 0]} scale={[r, Math.max(0.001, len / 2 - r) , r]} castShadow={cast} />
);

/** Long arm: shoulder pitch `pitch` (- raises forward), bent a little at the elbow, claws at the end. */
const Arm: React.FC<{side: number; pitch: number; out: number}> = ({side, pitch, out}) => (
  <group position={[side * 0.19, 0.66, 0]} rotation={[pitch, 0, side * (0.08 + out)]}>
    <Bone len={0.46} r={0.034} />
    <group position={[0, -0.46, 0]} rotation={[-0.18, 0, 0]}>
      <mesh geometry={geo.ball} material={mats.skin} scale={0.04} />
      <Bone len={0.48} r={0.03} />
      <group position={[0, -0.5, 0]}>
        <mesh geometry={geo.ball} material={mats.skin} scale={[0.045, 0.06, 0.03]} />
        {[-1.5, -0.5, 0.5, 1.5].map((k) => (
          <group key={k} position={[k * 0.017, -0.05, 0.01]} rotation={[0.25, 0, k * 0.08]}>
            <Bone len={0.11} r={0.009} />
            <mesh geometry={geo.cone} material={mats.claw} position={[0, -0.13, 0.004]} rotation={[Math.PI, 0, 0]} scale={[0.008, 0.06, 0.008]} />
          </group>
        ))}
      </group>
    </group>
  </group>
);

export type SkinwalkerPose = {
  hunch?: number;
  neckRoll?: number;
  headPitch?: number;
  headYaw?: number;
  headRoll?: number;
  armL?: number;
  armR?: number;
  armROut?: number;
  breathe?: number;
};

export const Skinwalker: React.FC<SkinwalkerPose & {face: FaceKind; position?: [number, number, number]; rotationY?: number}> = ({
  face,
  position = [0, 0, 0],
  rotationY = 0,
  hunch = 0,
  neckRoll = 0,
  headPitch = 0,
  headYaw = 0,
  headRoll = 0,
  armL = 0,
  armR = 0,
  armROut = 0,
  breathe = 0,
}) => {
  const faceMat = useMemo(
    () => new THREE.MeshStandardMaterial({map: faceTexture(face), transparent: true, depthWrite: false, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2}),
    [face],
  );
  const chest = 1 + Math.sin(breathe * 1.2) * 0.015;
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* long thin legs, knees a little bent */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.09, SKIN_HIP, 0]} rotation={[0.08, 0, s * 0.03]}>
          <Bone len={0.5} r={0.05} />
          <group position={[0, -0.5, 0]} rotation={[-0.16, 0, 0]}>
            <mesh geometry={geo.ball} material={mats.skin} scale={0.05} />
            <Bone len={0.5} r={0.042} />
            <mesh geometry={geo.ball} material={mats.skin} position={[0, -0.5, 0.06]} scale={[0.05, 0.03, 0.12]} castShadow />
          </group>
        </group>
      ))}

      {/* body, bending forward at the hip */}
      <group position={[0, SKIN_HIP, 0]} rotation={[hunch, 0, 0]}>
        <mesh geometry={geo.limb} material={mats.skin} position={[0, 0.36, 0]} scale={[0.13 * 1.1, 0.25 * chest, 0.13 * 0.7]} castShadow />
        {/* ribs showing through the skin */}
        {[0.3, 0.37, 0.44, 0.51].map((y, i) => (
          <mesh key={y} geometry={geo.limb} material={mats.rib} position={[0, y, 0.082]} rotation={[0, 0, Math.PI / 2]} scale={[0.011, 0.085 - i * 0.004, 0.011]} />
        ))}
        {/* the pelt: draped over the shoulders and down the back */}
        <mesh geometry={geo.ball} material={mats.fur} position={[0, 0.63, -0.07]} scale={[0.25, 0.13, 0.16]} castShadow />
        {/* ragged fringe hanging off the pelt */}
        {Array.from({length: 11}, (_, i) => {
          const a = -2.4 + (i / 10) * 4.8; // around the shoulders and back, open at the chest
          const len = 0.12 + ((i * 37) % 5) * 0.03;
          return (
            <mesh key={i} geometry={geo.cone} material={i % 2 ? mats.fur : mats.furDark} position={[Math.sin(a) * 0.22, 0.55 - len / 2, -0.07 - Math.cos(a) * 0.13]} rotation={[Math.PI + Math.cos(a) * 0.25, 0, Math.sin(a) * 0.3]} scale={[0.045, len, 0.03]} castShadow />
          );
        })}
        <mesh geometry={geo.limb} material={mats.fur} position={[0, 0.34, -0.1]} rotation={[0.08, 0, 0]} scale={[0.15, 0.22, 0.05]} castShadow />
        <mesh geometry={geo.limb} material={mats.furDark} position={[0, -0.05, -0.14]} rotation={[0.25, 0, 0]} scale={[0.05, 0.22, 0.04]} castShadow />

        <Arm side={-1} pitch={armL} out={0} />
        <Arm side={1} pitch={armR} out={armROut} />

        {/* neck and head, bending sideways at the base of the neck */}
        <group position={[0, SKIN_NECK, 0]} rotation={[0, 0, neckRoll]}>
          <mesh geometry={geo.neck} material={mats.skin} position={[0, 0.08, 0]} castShadow />
          <group position={[0, SKIN_HEAD, 0]} rotation={[headPitch, headYaw, headRoll]}>
            <group scale={HEAD_SCALE}>
              <mesh geometry={geo.head} material={mats.skin} castShadow />
              <mesh geometry={geo.face} material={faceMat} />
              {[-1, 1].map((s) => (
                // pitch-black eyes: unlit, so the flashlight never reflects in them
                <mesh key={s} geometry={geo.ball} material={mats.void} position={[s * 0.0457, -0.003, 0.1654]} rotation={[0, s * 0.27, s * 0.12]} scale={[0.042, 0.055, 0.02]} />
              ))}
            </group>
            {/* the animal skin pulled over its head, ears up */}
            <mesh geometry={geo.hood} material={mats.fur} position={[0, 0.05, -0.05]} rotation={[-0.6, 0, 0]} scale={[1.02, 1.5, 1.15]} castShadow />
            {/* the animal's muzzle lying over its forehead, and its ears standing up */}
            <mesh geometry={geo.cone} material={mats.furDark} position={[0, 0.24, 0.1]} rotation={[1.2, 0, 0]} scale={[0.05, 0.19, 0.04]} castShadow />
            <mesh geometry={geo.ball} material={mats.claw} position={[0, 0.205, 0.2]} scale={0.014} />
            {[-1, 1].map((s) => (
              <mesh key={s} geometry={geo.cone} material={mats.fur} position={[s * 0.08, 0.3, -0.06]} rotation={[-0.15, 0, -s * 0.3]} scale={[0.045, 0.17, 0.03]} castShadow />
            ))}
          </group>
        </group>
      </group>
    </group>
  );
};
