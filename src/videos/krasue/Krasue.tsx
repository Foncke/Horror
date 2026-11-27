import React, {useMemo} from 'react';
import * as THREE from 'three';
import {canvasTexture} from '../../three/textures';
import {Human, LongHair, twitch} from '../phipop/Human';

const haloTex = () =>
  canvasTexture('kr-halo', 128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,60,30,0.9)');
    g.addColorStop(0.35, 'rgba(255,30,10,0.35)');
    g.addColorStop(1, 'rgba(255,20,10,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });

/**
 * The Krasue: a woman's severed head floating in the dark, long wet hair hanging around it, and beneath it the
 * organs that come with it (heart, lungs, stomach, a loop of intestine) as a pulsing red glow, dripping.
 * Shown only as glowing shapes, never as detailed anatomy. Head centre at the group origin, faces +z.
 */
const organMat = (glow: number, k: number) => {
  const m = new THREE.MeshStandardMaterial({color: '#3a0606', roughness: 0.25, metalness: 0.0, emissive: new THREE.Color('#ff1a0a')});
  m.emissiveIntensity = glow * k;
  return m;
};

const gutCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0.03, -0.42, 0.02),
  new THREE.Vector3(-0.07, -0.52, 0.04),
  new THREE.Vector3(0.06, -0.6, -0.02),
  new THREE.Vector3(-0.05, -0.7, 0.03),
  new THREE.Vector3(0.04, -0.8, 0.0),
  new THREE.Vector3(-0.02, -0.92, 0.02),
  new THREE.Vector3(0.01, -1.05, 0.0),
]);
const gutGeo = new THREE.TubeGeometry(gutCurve, 80, 0.017, 10, false);
const ball = new THREE.SphereGeometry(1, 24, 16);
const cordGeo = new THREE.CylinderGeometry(0.012, 0.016, 0.28, 10);

export const Krasue: React.FC<{
  t: number;
  position?: [number, number, number];
  rotationY?: number;
  glow?: number; // 0..1 how bright the organs burn
  headYaw?: number; // extra head turn (radians) on top of the body facing
  headPitch?: number;
  bob?: number; // how much it drifts up and down
  light?: number; // strength of the red light it throws
  scale?: number;
  halo?: number; // the lantern-like glow seen from afar
}> = ({t, position = [0, 0, 0], rotationY = 0, glow = 1, headYaw = 0, headPitch = 0, bob = 1, light = 1, scale = 1, halo = 0}) => {
  const haloMat = useMemo(() => new THREE.SpriteMaterial({map: haloTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending}), []);
  const beat = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * 0.9)), 6); // a slow heartbeat
  const pulse = 0.75 + 0.25 * beat;
  const mats = useMemo(() => ({heart: organMat(1, 1), lung: organMat(1, 0.5), gut: organMat(1, 0.65), stomach: organMat(1, 0.7)}), []);
  haloMat.opacity = Math.min(1, glow * (0.75 + 0.25 * beat));
  mats.heart.emissiveIntensity = glow * 2.2 * pulse;
  mats.lung.emissiveIntensity = glow * 0.7 * pulse;
  mats.gut.emissiveIntensity = glow * 0.9 * (0.85 + 0.15 * beat);
  mats.stomach.emissiveIntensity = glow * 0.9;
  const y = Math.sin(t * 0.8) * 0.06 * bob + Math.sin(t * 1.9) * 0.015 * bob;
  const sway = Math.sin(t * 0.7) * 0.08;
  return (
    <group position={[position[0], position[1] + y, position[2]]} rotation={[0, rotationY, sway * 0.3]} scale={scale}>
      {/* the head, with a long curtain of wet hair */}
      <group rotation={[headPitch, headYaw + twitch(t, 4) * 0.6, twitch(t, 9) * 0.5]}>
        <Human headOnly face="krasue" hairDrift={t} />
        <LongHair length={2.4} sway={Math.sin(t * 0.9)} />
      </group>
      {/* what hangs beneath it: a torn cord, the heart, lungs, stomach and a loop of intestine, all glowing */}
      <group rotation={[sway, 0, -sway * 0.6]}>
        <mesh geometry={cordGeo} material={mats.gut} position={[0, -0.24, 0.0]} />
        <mesh geometry={ball} material={mats.heart} position={[0.02, -0.36, 0.03]} scale={[0.042 * pulse, 0.05 * pulse, 0.04 * pulse]} />
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={ball} material={mats.lung} position={[s * 0.06, -0.33, -0.01]} scale={[0.04, 0.07, 0.035]} />
        ))}
        <mesh geometry={ball} material={mats.stomach} position={[0.04, -0.47, 0.02]} scale={[0.055, 0.04, 0.04]} />
        <mesh geometry={gutGeo} material={mats.gut} rotation={[0, Math.sin(t * 0.6) * 0.3, 0]} />
        {/* slow drips falling from the lowest point */}
        {Array.from({length: 5}, (_, i) => {
          const ph = (t * 0.7 + i / 5) % 1;
          return <mesh key={i} geometry={ball} material={mats.gut} position={[0.01, -1.07 - ph * 1.6, 0]} scale={[0.008, 0.012, 0.008].map((v) => v * (1 - ph * 0.5)) as [number, number, number]} />;
        })}
        {halo > 0 && <sprite material={haloMat} position={[0, -0.4, 0.05]} scale={[1.3 * halo, 1.6 * halo, 1]} />}
        {light > 0 && <pointLight position={[0, -0.45, 0.05]} intensity={3.5 * light * glow * (0.8 + 0.2 * beat)} distance={4} decay={1.6} color="#ff2a14" />}
      </group>
    </group>
  );
};
