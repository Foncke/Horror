import React, {useMemo} from 'react';
import * as THREE from 'three';
import {canvasTexture} from '../../three/textures';

/**
 * A villager with realistic proportions (Phi Pop only; the other videos keep their toy figures).
 * Feet at the group origin, faces +z. About 1.58 m tall when standing.
 */
export type HumanFace = 'smile' | 'neutral' | 'sleep' | 'possessed' | 'avert' | 'wake' | 'elder' | 'gaunt';
export type Outfit = 'sari' | 'man' | 'elder' | 'robe';

export type HumanPose = {
  hipY?: number; // 0.88 standing, ~0.45 crouching, ~0.14 sitting on a mat
  thigh?: number; // thigh pitch, - lifts the knees forward
  knee?: number; // + bends the shin back
  spread?: number; // knees apart
  hunch?: number; // torso pitch, + leans forward
  armL?: number; // shoulder pitch, - raises forward
  armR?: number;
  outL?: number;
  outR?: number;
  elbowL?: number; // - bends the forearm forward/up
  elbowR?: number;
  curl?: number; // finger curl 0..1
  headPitch?: number; // + looks down
  headYaw?: number;
  headRoll?: number;
  breathe?: number;
};

type Look = {skin: string; top: string; skirt: string; border: string; hair: string; long: boolean; messy: boolean; bun: boolean};

const LOOKS = (outfit: Outfit, face: HumanFace): Look => {
  const possessed = face === 'possessed' || face === 'avert' || face === 'wake' || face === 'gaunt';
  if (outfit === 'man') return {skin: '#9c6845', top: '#cfc6b2', skirt: '#2c2a27', border: '#2c2a27', hair: '#141110', long: false, messy: false, bun: false};
  if (outfit === 'robe') return {skin: '#7d6250', top: '#141110', skirt: '#141110', border: '#141110', hair: '#0d0b0a', long: false, messy: false, bun: false};
  if (outfit === 'elder') return {skin: '#93623f', top: '#5b3a2a', skirt: '#d9cfbd', border: '#7a2a24', hair: '#bdb8b0', long: false, messy: false, bun: true};
  return {skin: possessed ? '#868780' : '#a8754f', top: '#7a2a2c', skirt: '#d6ccb8', border: '#8a2b26', hair: '#0d0b0a', long: true, messy: possessed, bun: false};
};

// --- faces --------------------------------------------------------------------
const drawFace = (kind: HumanFace, skin: string, ctx: CanvasRenderingContext2D, w: number, h: number) => {
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2;
  const eyeY = 247;
  const possessed = kind === 'possessed' || kind === 'avert' || kind === 'wake' || kind === 'gaunt';
  const ink = 'rgba(25,16,12,0.95)';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // soft shading: cheekbones, nose bridge, under the nose
  const shade = (x: number, y: number, rx: number, ry: number, a: number, color = '40,22,14') => {
    const g = ctx.createRadialGradient(x, y, 1, x, y, Math.max(rx, ry));
    g.addColorStop(0, `rgba(${color},${a})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const s of [-1, 1]) shade(cx + s * 30, eyeY + 50, 22, 70, 0.22); // sides of the nose
  shade(cx, eyeY + 120, 40, 14, 0.25);
  if (possessed) {
    for (const s of [-1, 1]) {
      shade(cx + s * 122, eyeY + 4, 105, 82, 1.0, '8,6,8'); // sunken black sockets
      shade(cx + s * 122, eyeY + 4, 80, 60, 0.9, '5,4,6');
      shade(cx + s * 160, eyeY + 140, 60, 80, 0.45, '20,18,22'); // hollow cheeks
    }
  }
  if (kind === 'elder') {
    ctx.strokeStyle = 'rgba(60,35,25,0.45)';
    ctx.lineWidth = 4;
    for (const s of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.arc(cx + s * 175, eyeY + 2, 22 + k * 9, s < 0 ? Math.PI * 0.75 : -Math.PI * 0.25, s < 0 ? Math.PI * 1.25 : Math.PI * 0.25);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(cx + s * 40, eyeY + 110);
      ctx.quadraticCurveTo(cx + s * 70, eyeY + 160, cx + s * 62, eyeY + 200);
      ctx.stroke();
    }
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(cx - 70, eyeY - 105 - k * 16);
      ctx.quadraticCurveTo(cx, eyeY - 112 - k * 16, cx + 70, eyeY - 105 - k * 16);
      ctx.stroke();
    }
  }

  // eyes
  for (const s of [-1, 1]) {
    const ex = cx + s * 122;
    const open = kind === 'sleep' ? 0 : kind === 'wake' ? 1.25 : kind === 'smile' ? 0.7 : 1;
    if (open === 0) {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(ex - 48, eyeY + 2);
      ctx.quadraticCurveTo(ex, eyeY + 18, ex + 48, eyeY + 2);
      ctx.stroke();
      continue;
    }
    const ry = 27 * open;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(ex - 64, eyeY);
    ctx.quadraticCurveTo(ex, eyeY - ry * 1.6, ex + 64, eyeY - 2);
    ctx.quadraticCurveTo(ex, eyeY + ry * 1.25, ex - 64, eyeY);
    ctx.closePath();
    ctx.fillStyle = possessed ? '#c9c2a3' : '#eee6dc';
    ctx.fill();
    ctx.clip();
    // iris and pupil: possessed eyes are tiny pinpricks; "avert" looks away from you
    const look = kind === 'avert' ? 30 : 0;
    const ix = ex + look;
    if (possessed) {
      ctx.fillStyle = '#1a1512';
      ctx.beginPath();
      ctx.arc(ix, eyeY - 2, 7, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#3a2416';
      ctx.beginPath();
      ctx.arc(ix, eyeY - 3, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0c0807';
      ctx.beginPath();
      ctx.arc(ix, eyeY - 3, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(ix + 6, eyeY - 10, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // upper lid line and lashes
    ctx.strokeStyle = ink;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(ex - 68, eyeY + 1);
    ctx.quadraticCurveTo(ex, eyeY - ry * 1.65, ex + 68, eyeY - 3);
    ctx.stroke();
    if (possessed) {
      ctx.strokeStyle = 'rgba(120,20,20,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(ex - 46, eyeY + 6);
      ctx.quadraticCurveTo(ex, eyeY + ry * 1.3, ex + 46, eyeY + 4);
      ctx.stroke();
    }
  }
  // brows
  ctx.strokeStyle = ink;
  ctx.lineWidth = kind === 'elder' ? 9 : 14;
  for (const s of [-1, 1]) {
    const lift = kind === 'wake' ? -14 : 0;
    ctx.beginPath();
    ctx.moveTo(cx + s * 70, eyeY - 52 + lift + (possessed ? 6 : 0));
    ctx.quadraticCurveTo(cx + s * 125, eyeY - 74 + lift, cx + s * 180, eyeY - 56 + lift);
    ctx.stroke();
  }
  // nose
  ctx.strokeStyle = 'rgba(60,32,20,0.75)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(cx - 26, eyeY + 92);
  ctx.quadraticCurveTo(cx, eyeY + 106, cx + 26, eyeY + 92);
  ctx.stroke();
  // mouth
  const my = eyeY + 172;
  if (kind === 'smile') {
    ctx.fillStyle = '#6e2f2a';
    ctx.beginPath();
    ctx.moveTo(cx - 52, my - 6);
    ctx.quadraticCurveTo(cx, my + 34, cx + 52, my - 6);
    ctx.quadraticCurveTo(cx, my + 8, cx - 52, my - 6);
    ctx.fill();
    ctx.fillStyle = '#f1ebe2';
    ctx.beginPath();
    ctx.moveTo(cx - 40, my - 1);
    ctx.quadraticCurveTo(cx, my + 14, cx + 40, my - 1);
    ctx.quadraticCurveTo(cx, my + 6, cx - 40, my - 1);
    ctx.fill();
  } else {
    ctx.fillStyle = possessed ? '#3d3436' : '#7a3a33';
    ctx.beginPath();
    ctx.moveTo(cx - 40, my);
    ctx.quadraticCurveTo(cx, my - 10, cx + 40, my);
    ctx.quadraticCurveTo(cx, my + (kind === 'wake' ? 26 : 14), cx - 40, my);
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,14,12,0.8)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - 40, my);
    ctx.quadraticCurveTo(cx, my + 3, cx + 40, my);
    ctx.stroke();
  }
  // a bindi for the women
  if (!possessed && kind !== 'elder') {
    ctx.fillStyle = '#8f1d1d';
    ctx.beginPath();
    ctx.arc(cx, eyeY - 70, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  void skin;
};

const faceTex = (kind: HumanFace, skin: string) => canvasTexture(`human-face-${kind}`, 1024, 512, (ctx, w, h) => drawFace(kind, skin, ctx, w, h));

// --- geometry -----------------------------------------------------------------
const HEAD_R = 0.1;
const geo = {
  cap: new THREE.CapsuleGeometry(1, 1, 6, 16),
  ball: new THREE.SphereGeometry(1, 32, 20),
  head: new THREE.SphereGeometry(HEAD_R, 48, 32),
  face: new THREE.SphereGeometry(HEAD_R * 1.004, 64, 32, Math.PI / 2 - 1.25, 2.5, 0.2 * Math.PI, 0.62 * Math.PI),
  scalp: new THREE.SphereGeometry(HEAD_R * 1.07, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.56),
  skirt: (() => {
    const pts = [new THREE.Vector2(0.15, 0.0), new THREE.Vector2(0.165, -0.2), new THREE.Vector2(0.2, -0.5), new THREE.Vector2(0.24, -0.84), new THREE.Vector2(0.245, -0.86)];
    return new THREE.LatheGeometry(pts, 32);
  })(),
  nose: new THREE.SphereGeometry(1, 16, 12),
  torso: (() => {
    const pts = [
      [0.0, 0.0], [0.13, 0.0], [0.135, 0.05], [0.12, 0.14], [0.125, 0.22], [0.145, 0.3], [0.15, 0.38], [0.155, 0.43], [0.13, 0.48], [0.06, 0.52], [0.0, 0.53],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const g = new THREE.LatheGeometry(pts, 40);
    g.scale(1, 1, 0.62);
    return g;
  })(),
  band: new THREE.BoxGeometry(1, 1, 1),
};

const matCache = new Map<string, THREE.MeshStandardMaterial>();
const mat = (color: string, rough = 0.85) => {
  const k = `${color}-${rough}`;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({color, roughness: rough, side: THREE.DoubleSide}));
  return matCache.get(k)!;
};

/** Capsule hanging down -y from the origin. */
export const Seg: React.FC<{len: number; r: number; color: string; cast?: boolean}> = ({len, r, color, cast = true}) => (
  <mesh geometry={geo.cap} material={mat(color)} position={[0, -len / 2, 0]} scale={[r, Math.max(0.001, len / 2 - r), r]} castShadow={cast} receiveShadow />
);

export const Hand: React.FC<{skin: string; curl: number; side: number}> = ({skin, curl, side}) => (
  <group>
    <mesh geometry={geo.ball} material={mat(skin)} position={[0, -0.035, 0]} scale={[0.026, 0.038, 0.012]} castShadow />
    {[-1.5, -0.5, 0.5, 1.5].map((k) => (
      <group key={k} position={[k * 0.011, -0.068, 0.002]} rotation={[-curl * 1.3, 0, k * 0.05]}>
        <Seg len={0.05 - Math.abs(k) * 0.006} r={0.0052} color={skin} />
        <group position={[0, -0.045, 0]} rotation={[-curl * 1.1, 0, 0]}>
          <Seg len={0.032} r={0.0048} color={skin} />
        </group>
      </group>
    ))}
    <group position={[side * 0.03, -0.035, 0.012]} rotation={[-0.4 - curl * 0.5, 0, -side * 0.7]}>
      <Seg len={0.05} r={0.007} color={skin} />
    </group>
  </group>
);

const Arm: React.FC<{side: number; pitch: number; out: number; elbow: number; curl: number; look: Look; sleeve: string}> = ({side, pitch, out, elbow, curl, look, sleeve}) => (
  <group position={[side * 0.155, 0.44, 0]} rotation={[pitch, 0, side * (0.05 + out)]}>
    <Seg len={0.28} r={0.033} color={look.skin} />
    <mesh geometry={geo.cap} material={mat(sleeve)} position={[0, -0.06, 0]} scale={[0.038, 0.05, 0.038]} castShadow />
    <group position={[0, -0.27, 0]} rotation={[elbow, 0, 0]}>
      <Seg len={0.25} r={0.027} color={look.skin} />
      <group position={[0, -0.25, 0]}>
        <Hand skin={look.skin} curl={curl} side={side} />
      </group>
    </group>
  </group>
);

export const Human: React.FC<HumanPose & {outfit?: Outfit; face: HumanFace; position?: [number, number, number]; rotationY?: number; rotationX?: number; hairDrift?: number}> = ({
  outfit = 'sari',
  face,
  position = [0, 0, 0],
  rotationY = 0,
  rotationX = 0,
  hairDrift = 0,
  hipY = 0.88,
  thigh = 0,
  knee = 0,
  spread = 0,
  hunch = 0,
  armL = 0,
  armR = 0,
  outL = 0,
  outR = 0,
  elbowL = 0,
  elbowR = 0,
  curl = 0.3,
  headPitch = 0,
  headYaw = 0,
  headRoll = 0,
  breathe = 0,
}) => {
  const look = LOOKS(outfit, face);
  const faceMat = useMemo(
    () => new THREE.MeshStandardMaterial({map: faceTex(face, look.skin), transparent: true, depthWrite: false, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2}),
    [face, look.skin],
  );
  const standing = thigh > -0.35;
  const legColor = outfit === 'man' ? look.skirt : look.skirt;
  const chest = 1 + Math.sin(breathe * 1.5) * 0.012;
  const sleeve = outfit === 'man' ? look.top : look.top;
  return (
    <group position={position} rotation={[rotationX, rotationY, 0]}>
      {/* legs */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.085, hipY, 0]} rotation={[thigh, 0, s * (0.02 + spread)]}>
          <Seg len={0.43} r={0.062} color={legColor} />
          <group position={[0, -0.43, 0]} rotation={[knee, 0, 0]}>
            <Seg len={0.41} r={0.045} color={standing && outfit !== 'man' ? look.skin : legColor} />
            <mesh geometry={geo.ball} material={mat(look.skin)} position={[0, -0.42, 0.045]} rotation={[-knee - thigh, 0, 0]} scale={[0.04, 0.025, 0.11]} castShadow />
          </group>
        </group>
      ))}
      {/* crouching or sitting: the sari drapes over the thighs and knees */}
      {outfit !== 'man' && !standing && (
        <mesh
          geometry={geo.ball}
          material={mat(look.skirt)}
          position={[0, hipY - 0.215 * Math.cos(thigh), -0.215 * Math.sin(thigh)]}
          rotation={[thigh + Math.PI / 2, 0, 0]}
          scale={[0.15 + spread * 0.2, 0.25, 0.09]}
          castShadow
          receiveShadow
        />
      )}
      {/* pelvis */}
      <mesh geometry={geo.ball} material={mat(legColor)} position={[0, hipY + 0.02, 0]} scale={[0.17, 0.12, 0.12]} castShadow />
      {/* sari skirt falls to the ankles when standing */}
      {outfit !== 'man' && standing && (
        <group position={[0, hipY + 0.06, 0]}>
          <mesh geometry={geo.skirt} material={mat(look.skirt)} castShadow receiveShadow />
          <mesh geometry={geo.skirt} material={mat(look.border)} position={[0, -0.84, 0]} scale={[1.01, 0.04, 1.01]} />
        </group>
      )}

      {/* body */}
      <group position={[0, hipY + 0.05, 0]} rotation={[hunch, 0, 0]}>
        <mesh geometry={geo.torso} material={mat(look.top)} scale={[1, chest, 1]} castShadow receiveShadow />
        {outfit !== 'man' && (
          // the sari's loose end: a flat band across the chest and over the left shoulder
          <group>
            <mesh geometry={geo.band} material={mat(look.top === '#7a2a2c' ? '#b9ad97' : look.skirt)} position={[0.03, 0.27, 0.078]} rotation={[0.05, 0, -0.5]} scale={[0.13, 0.48, 0.01]} castShadow />
            <mesh geometry={geo.band} material={mat(look.border)} position={[0.085, 0.28, 0.084]} rotation={[0.05, 0, -0.5]} scale={[0.01, 0.48, 0.004]} />
            <mesh geometry={geo.band} material={mat(look.skirt)} position={[-0.11, 0.33, -0.04]} rotation={[0.3, 0, 0.15]} scale={[0.1, 0.42, 0.012]} castShadow />
          </group>
        )}
        {outfit === 'elder' && <mesh geometry={geo.ball} material={mat('#3b2a22')} position={[0, 0.42, -0.02]} scale={[0.22, 0.1, 0.14]} castShadow />}
        <Arm side={-1} pitch={armL} out={outL} elbow={elbowL} curl={curl} look={look} sleeve={outfit === 'man' ? look.top : look.skin} />
        <Arm side={1} pitch={armR} out={outR} elbow={elbowR} curl={curl} look={look} sleeve={outfit === 'man' ? look.top : look.skin} />
        {/* neck and head */}
        <mesh geometry={geo.cap} material={mat(look.skin)} position={[0, 0.55, 0]} scale={[0.036, 0.04, 0.036]} castShadow />
        <group position={[0, 0.66, 0.01]} rotation={[headPitch, headYaw, headRoll]}>
          <group scale={[0.86, 1.12, 0.98]}>
            <mesh geometry={geo.head} material={mat(look.skin, 0.75)} castShadow />
            <mesh geometry={geo.face} material={faceMat} />
          </group>
          <mesh geometry={geo.nose} material={mat(look.skin, 0.75)} position={[0, -0.014, 0.09]} scale={[0.008, 0.016, 0.008]} />
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={geo.ball} material={mat(look.skin)} position={[s * 0.087, -0.005, -0.005]} scale={[0.012, 0.025, 0.016]} />
          ))}
          {/* hair */}
          <mesh geometry={geo.scalp} material={mat(look.hair, 0.95)} position={[0, 0.012, -0.012]} rotation={[-0.45, 0, 0]} scale={[0.92, 1.1, 1.0]} castShadow />
          {outfit === 'robe' && <mesh geometry={geo.ball} material={mat('#141110')} position={[0, 0.03, -0.02]} scale={[0.125, 0.15, 0.135]} castShadow />}
          {look.bun && <mesh geometry={geo.ball} material={mat(look.hair, 0.6)} position={[0, 0.03, -0.11]} scale={0.05} castShadow />}
          {look.long && (
            <group>
              <mesh geometry={geo.cap} material={mat(look.hair, 0.6)} position={[0, -0.2, -0.065]} rotation={[0.1 + hairDrift * 0.05, 0, 0]} scale={[0.1, 0.2, 0.04]} castShadow />
              {[-1, 1].map((s) => (
                <mesh key={s} geometry={geo.cap} material={mat(look.hair, 0.6)} position={[s * 0.085, -0.13, 0.0]} rotation={[0.05, 0, s * (0.08 + hairDrift * 0.03)]} scale={[0.028, 0.14, 0.03]} castShadow />
              ))}
              {/* loose locks over the shoulders */}
              {[-0.07, -0.045, 0.045, 0.07].map((x, i) => (
                <mesh key={'l' + x} geometry={geo.cap} material={mat(look.hair, 0.6)} position={[x * 1.25, -0.17, 0.005]} rotation={[0.15, 0, (x > 0 ? -1 : 1) * 0.05 + Math.sin(hairDrift + i) * 0.04]} scale={[0.008, 0.17, 0.008]} castShadow />
              ))}
              {look.messy &&
                // matted strands hanging over the face
                [-0.055, -0.03, -0.012, 0.02, 0.04, 0.062].map((x, i) => (
                  <mesh key={x} geometry={geo.cap} material={mat(look.hair, 0.6)} position={[x, -0.035 - (i % 3) * 0.015, 0.094 - Math.abs(x) * 0.35]} rotation={[0.12, 0, (x > 0 ? -1 : 1) * 0.08 + Math.sin(hairDrift + i * 1.7) * 0.06]} scale={[0.003, 0.1 + (i % 2) * 0.03, 0.003]} />
                ))}
            </group>
          )}
        </group>
      </group>
    </group>
  );
};

/** World height of the head centre for a standing human (for aiming cameras). */
export const HEAD_Y = 0.88 + 0.05 + 0.66;
