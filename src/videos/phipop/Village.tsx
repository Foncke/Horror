import React, {useMemo} from 'react';
import * as THREE from 'three';
import {canvasTexture} from '../../three/textures';
import {hash, lerp} from '../../lib/timeline';

type V3 = [number, number, number];

// --- textures -----------------------------------------------------------------
export const planksTexture = () =>
  canvasTexture(
    'pp-planks',
    256,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = '#6b4a33';
      ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 32) {
        const v = 0.75 + hash(x) * 0.35;
        ctx.fillStyle = `rgb(${Math.round(107 * v)},${Math.round(74 * v)},${Math.round(51 * v)})`;
        ctx.fillRect(x + 1, 0, 30, h);
        ctx.fillStyle = 'rgba(20,12,8,0.75)';
        ctx.fillRect(x, 0, 2, h);
        for (let k = 0; k < 6; k++) {
          ctx.strokeStyle = 'rgba(40,25,15,0.35)';
          ctx.beginPath();
          ctx.moveTo(x + 4 + hash(x + k) * 22, 0);
          ctx.lineTo(x + 4 + hash(x + k * 3) * 22, h);
          ctx.stroke();
        }
      }
    },
    {repeat: [3, 1]},
  );

const earthTexture = () =>
  canvasTexture(
    'pp-earth',
    512,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = '#7a5a3e';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 3000; i++) {
        const x = hash(i * 1.1) * w;
        const y = hash(i * 2.3) * h;
        ctx.fillStyle = ['#6a4c33', '#8a6a4a', '#5a4030', '#927255'][i % 4];
        ctx.fillRect(x, y, 2 + hash(i) * 4, 2 + hash(i * 5) * 3);
      }
    },
    {repeat: [20, 20]},
  );

const leafTexture = () =>
  canvasTexture('pp-banana-leaf', 128, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#3f6b2e';
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.quadraticCurveTo(w * 1.05, h * 0.4, w / 2, h);
    ctx.quadraticCurveTo(-w * 0.05, h * 0.4, w / 2, 0);
    ctx.fill();
    ctx.strokeStyle = 'rgba(25,45,18,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    for (let y = 20; y < h; y += 14) {
      ctx.beginPath();
      ctx.moveTo(w / 2, y);
      ctx.lineTo(w * 0.12, y + 22);
      ctx.moveTo(w / 2, y);
      ctx.lineTo(w * 0.88, y + 22);
      ctx.stroke();
    }
    // torn slits like real banana leaves
    ctx.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 7; k++) {
      const y = 60 + k * 62 + hash(k) * 20;
      ctx.fillRect(k % 2 ? w * 0.55 : 0, y, w * 0.45, 3);
    }
    ctx.globalCompositeOperation = 'source-over';
  });

export const fogPuffTexture = () =>
  canvasTexture('pp-fog', 256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = w * (0.2 + hash(i * 3.1) * 0.6);
      const y = h * (0.3 + hash(i * 5.7) * 0.4);
      const r = w * (0.12 + hash(i * 7.3) * 0.2);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.22)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  });

const mats = new Map<string, THREE.Material>();
export const m = (key: string, make: () => THREE.Material) => {
  if (!mats.has(key)) mats.set(key, make());
  return mats.get(key)!;
};
export const plain = (color: string, rough = 0.9) => m(`p-${color}-${rough}`, () => new THREE.MeshStandardMaterial({color, roughness: rough}));
export const planks = () => m('planks', () => new THREE.MeshStandardMaterial({map: planksTexture(), roughness: 0.9, color: '#b0a090'}));
export const windowGlow = (k: number) =>
  m(`win-${k.toFixed(2)}`, () => new THREE.MeshStandardMaterial({color: '#ffb066', emissive: new THREE.Color('#ff9a40'), emissiveIntensity: 1.6 * k}));

// --- pieces ---------------------------------------------------------------------
const box = new THREE.BoxGeometry(1, 1, 1);
const cyl = new THREE.CylinderGeometry(1, 1, 1, 12);

export const Box: React.FC<{p: V3; s: V3; r?: V3; mat: THREE.Material; cast?: boolean}> = ({p, s, r, mat, cast = true}) => (
  <mesh geometry={box} material={mat} position={p} scale={s} rotation={r} castShadow={cast} receiveShadow />
);

/** A wooden house raised on stilts, gable roof, a lit or dark window, steps up to the door (faces +z). */
export const StiltHouse: React.FC<{p: V3; rotY?: number; w?: number; d?: number; lit?: number; door?: boolean}> = ({p, rotY = 0, w = 4, d = 3, lit = 0, door = true}) => {
  const floorY = 1.7;
  const wallH = 2.1;
  const roof = plain('#3b2f28', 0.95);
  const post = plain('#3d2b1e', 0.9);
  return (
    <group position={p} rotation={[0, rotY, 0]}>
      {[-1, 1].flatMap((sx) => [-1, 0, 1].map((sz) => (
        <mesh key={`${sx}${sz}`} geometry={cyl} material={post} position={[sx * (w / 2 - 0.15), floorY / 2, sz * (d / 2 - 0.15)]} scale={[0.09, floorY, 0.09]} castShadow receiveShadow />
      )))}
      <Box p={[0, floorY, 0]} s={[w + 0.3, 0.12, d + 0.3]} mat={post} />
      {/* walls */}
      <Box p={[0, floorY + wallH / 2, -d / 2]} s={[w, wallH, 0.08]} mat={planks()} />
      <Box p={[-w / 2, floorY + wallH / 2, 0]} s={[0.08, wallH, d]} mat={planks()} />
      <Box p={[w / 2, floorY + wallH / 2, 0]} s={[0.08, wallH, d]} mat={planks()} />
      {/* front wall with a doorway and a window */}
      <Box p={[-w / 4 - 0.25, floorY + wallH / 2, d / 2]} s={[w / 2 - 0.5, wallH, 0.08]} mat={planks()} />
      <Box p={[w / 4 + 0.45, floorY + wallH / 2, d / 2]} s={[w / 2 - 0.9, wallH, 0.08]} mat={planks()} />
      <Box p={[0.1, floorY + wallH - 0.12, d / 2]} s={[0.9, 0.24, 0.08]} mat={planks()} />
      {!door && <mesh geometry={box} material={planks()} position={[0.1, floorY + 0.9, d / 2 - 0.02]} scale={[0.85, 1.8, 0.04]} />}
      {door && <Box p={[0.1, floorY + 1.05, -d / 2 + 0.06]} s={[w - 0.2, wallH, 0.02]} mat={plain('#120c08', 1)} cast={false} />}
      <mesh geometry={box} material={lit > 0 ? windowGlow(lit) : plain('#0a0908', 1)} position={[-w / 4 - 0.3, floorY + 1.2, d / 2 + 0.055]} scale={[0.7, 0.55, 0.01]} />
      {[-0.18, 0, 0.18].map((x) => (
        <Box key={x} p={[-w / 4 - 0.3 + x, floorY + 1.2, d / 2 + 0.075]} s={[0.035, 0.55, 0.03]} mat={post} />
      ))}
      {/* gable roof with deep eaves */}
      {[-1, 1].map((s) => (
        <Box key={s} p={[s * (w / 4 + 0.1), floorY + wallH + 0.55, 0]} s={[w / 2 + 0.6, 0.07, d + 1.0]} r={[0, 0, -s * 0.52]} mat={roof} />
      ))}
      <mesh geometry={new THREE.CylinderGeometry(0, 1, 1, 3)} material={planks()} position={[0, floorY + wallH + 0.48, d / 2]} rotation={[Math.PI / 2, 0, 0]} scale={[w / 2 + 0.05, 0.08, 1.0]} />
      {/* steps */}
      {Array.from({length: 6}, (_, i) => (
        <Box key={i} p={[0.1, floorY - 0.15 - i * 0.28, d / 2 + 0.3 + i * 0.24]} s={[0.9, 0.06, 0.26]} mat={post} />
      ))}
      {/* clay water jar and baskets under the house */}
      <mesh geometry={new THREE.SphereGeometry(1, 20, 14)} material={plain('#7a4a2e', 0.8)} position={[w / 2 - 0.7, 0.35, -0.3]} scale={[0.3, 0.35, 0.3]} castShadow />
      {lit > 0 && <pointLight position={[-w / 4 - 0.3, floorY + 1.2, d / 2 + 0.6]} intensity={6 * lit} distance={7} decay={1.6} color="#ff9a48" />}
    </group>
  );
};

/** Banana plant: a soft trunk and drooping torn leaves. */
export const Banana: React.FC<{p: V3; s?: number; t: number}> = ({p, s = 1, t}) => {
  const leaf = m('banana-leaf', () => new THREE.MeshStandardMaterial({map: leafTexture(), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8}));
  return (
    <group position={p} scale={s}>
      <mesh geometry={cyl} material={plain('#5a6a3a')} position={[0, 1.0, 0]} scale={[0.1, 2.0, 0.1]} castShadow />
      {Array.from({length: 6}, (_, i) => {
        const a = (i / 6) * Math.PI * 2 + hash(i + p[0]) * 0.5;
        const sway = Math.sin(t * 0.8 + i) * 0.04;
        return (
          <group key={i} position={[0, 2.0, 0]} rotation={[0, a, 0]}>
            <mesh material={leaf} position={[0, 0.25, 0.55]} rotation={[-1.0 - hash(i * 3) * 0.4 + sway, 0, 0]} castShadow>
              <planeGeometry args={[0.45, 1.5]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

/** Coconut palm: a leaning ringed trunk and a crown of fronds. */
export const Palm: React.FC<{p: V3; h?: number; lean?: number; t: number}> = ({p, h = 7, lean = 0.12, t}) => {
  const frond = m('palm-frond', () => new THREE.MeshStandardMaterial({map: leafTexture(), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.85, color: '#9ab080'}));
  return (
    <group position={p} rotation={[0, 0, lean]}>
      <mesh geometry={cyl} material={plain('#5b4a3a')} position={[0, h / 2, 0]} scale={[0.14, h, 0.14]} castShadow />
      {Array.from({length: 9}, (_, i) => (
        <group key={i} position={[0, h, 0]} rotation={[0, (i / 9) * Math.PI * 2, 0]}>
          <mesh material={frond} position={[0, 0, 1.1]} rotation={[-1.9 + Math.sin(t * 0.6 + i) * 0.03, 0, 0]} scale={[1.1, 1.7, 1]} castShadow>
            <planeGeometry args={[0.5, 1.6]} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

/** Drifting fog puffs. */
export const Mist: React.FC<{t: number; color: string; opacity: number; area: [number, number, number, number]; y?: [number, number]; count?: number}> = ({t, color, opacity, area, y = [0.4, 2.2], count = 50}) => {
  const tex = fogPuffTexture();
  const mat = useMemo(() => new THREE.SpriteMaterial({map: tex, transparent: true, depthWrite: false, fog: true}), [tex]);
  mat.color.set(color);
  mat.opacity = opacity;
  const puffs = useMemo(
    () => Array.from({length: count}, (_, i) => ({x: lerp(area[0], area[1], hash(i * 4.1)), z: lerp(area[2], area[3], hash(i * 2.3 + 5)), y: lerp(y[0], y[1], hash(i * 6.7)), s: 4 + hash(i * 8.9) * 6, v: (hash(i) - 0.5) * 0.15})),
    [count, area, y],
  );
  return (
    <>
      {puffs.map((q, i) => (
        <sprite key={i} material={mat} position={[q.x + t * q.v, q.y, q.z]} scale={[q.s, q.s * 0.45, 1]} />
      ))}
    </>
  );
};

/** Sky dome: night (stars, moon glow) or warm day. */
const skyMat = () =>
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {uTop: {value: new THREE.Color()}, uHorizon: {value: new THREE.Color()}, uStars: {value: 0}},
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 uTop, uHorizon; uniform float uStars; varying vec3 vDir;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        float y = clamp(vDir.y * 1.4, 0.0, 1.0);
        vec3 c = mix(uHorizon, uTop, y);
        vec2 g = floor(vDir.xz / max(vDir.y, 0.05) * 90.0);
        float s = step(0.995, h(g)) * uStars * smoothstep(0.1, 0.5, vDir.y);
        c += vec3(s) * 0.8;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });

export const Sky: React.FC<{day: number}> = ({day}) => {
  const mat = useMemo(skyMat, []);
  mat.uniforms.uTop.value.set(day ? '#6aa0d8' : '#050b14');
  mat.uniforms.uHorizon.value.set(day ? '#f3d9a8' : '#14303c');
  mat.uniforms.uStars.value = day ? 0 : 1;
  return (
    <mesh material={mat} scale={90} frustumCulled={false}>
      <sphereGeometry args={[1, 32, 16]} />
    </mesh>
  );
};

/** Houses along the lane (x = side of the lane, z along it). */
export const HOUSES: {p: V3; rotY: number; lit: number}[] = [
  {p: [4.3, 0, 0.5], rotY: -Math.PI / 2 + 0.1, lit: 1},
  {p: [-4.6, 0, 2.0], rotY: Math.PI / 2 - 0.05, lit: 0.6},
  {p: [4.6, 0, -6.5], rotY: -Math.PI / 2, lit: 0.8},
  {p: [-4.8, 0, -5.0], rotY: Math.PI / 2 + 0.08, lit: 0},
  {p: [5.0, 0, -13.5], rotY: -Math.PI / 2 - 0.1, lit: 0.5},
  {p: [-5.2, 0, -12.5], rotY: Math.PI / 2, lit: 0.9},
  {p: [4.8, 0, 8.0], rotY: -Math.PI / 2, lit: 0},
  {p: [-5.0, 0, 9.5], rotY: Math.PI / 2, lit: 0.4},
  {p: [5.2, 0, -21], rotY: -Math.PI / 2, lit: 0},
  {p: [-5.4, 0, -20], rotY: Math.PI / 2, lit: 0.7},
];

export const VillageSet: React.FC<{t: number; day: number; lights?: number}> = ({t, day, lights = 1}) => {
  const ground = m('earth', () => new THREE.MeshStandardMaterial({map: earthTexture(), roughness: 1, color: '#9a8a78'}));
  return (
    <group>
      <Sky day={day} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={ground} receiveShadow>
        <planeGeometry args={[120, 120]} />
      </mesh>
      {/* lane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -5]} material={plain('#8a6a4c', 1)} receiveShadow>
        <planeGeometry args={[2.6, 80]} />
      </mesh>
      {HOUSES.map((h, i) => (
        <StiltHouse key={i} p={h.p} rotY={h.rotY} lit={day ? 0 : h.lit * lights} />
      ))}
      {[[-2.6, 0, 6], [2.7, 0, 3.8], [-2.9, 0, -2.5], [2.9, 0, -9.5], [-3.0, 0, -16], [7.5, 0, -3], [-7.8, 0, 5], [2.6, 0, -17]].map((p, i) => (
        <Banana key={i} p={p as V3} s={0.9 + hash(i) * 0.4} t={t} />
      ))}
      {[[-8, 0, -1], [8.5, 0, 3], [-9, 0, -10], [9, 0, -16], [-7.5, 0, 12], [7.8, 0, 12], [-10, 0, -24], [10, 0, -26]].map((p, i) => (
        <Palm key={i} p={p as V3} h={6 + hash(i * 3) * 3} lean={(hash(i * 5) - 0.5) * 0.4} t={t} />
      ))}
      {/* low fence and bushes */}
      {Array.from({length: 14}, (_, i) => (
        <Box key={i} p={[2.0, 0.45, 8 - i * 1.6]} s={[0.06, 0.9, 0.06]} mat={plain('#4a3a2a')} />
      ))}
      <Box p={[2.0, 0.7, -2.4]} s={[0.04, 0.05, 22]} mat={plain('#4a3a2a')} />
      {[[-2.2, 0, 1], [2.3, 0, -5], [-2.4, 0, -9], [2.2, 0, 10]].map((p, i) => (
        <mesh key={i} geometry={new THREE.SphereGeometry(1, 16, 12)} material={plain('#2f4a24')} position={[p[0], 0.4, p[2]]} scale={[0.8, 0.5, 0.7]} castShadow />
      ))}
    </group>
  );
};
