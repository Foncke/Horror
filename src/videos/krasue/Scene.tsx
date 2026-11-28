import React, {useMemo} from 'react';
import * as THREE from 'three';
import {Spot} from '../../three/Common';
import {canvasTexture} from '../../three/textures';
import {clamp, easeInOut, hash, lerp} from '../../lib/timeline';
import {Human} from '../phipop/Human';
import {Banana, Box, Mist, StiltHouse, fogPuffTexture, m, plain, planks} from '../phipop/Village';
import {Krasue} from './Krasue';
import {
  AT_WINDOW, BED, FAR, HER_HOUSE, MAT, Mood, NECK_SITTING, PATH_Z, PORCH, RISE_AT, RISE_HOUSE, ShotId, cue, farPos, riseHeight, turnYaw,
} from './cues';

type V3 = [number, number, number];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

// --- sky ------------------------------------------------------------------------
const SKIES: Record<Mood, {top: string; horizon: string; stars: number; fog: string; density: number}> = {
  night: {top: '#03070d', horizon: '#1c2a30', stars: 1, fog: '#18282e', density: 0.055},
  dusk: {top: '#1d2440', horizon: '#c0704c', stars: 0, fog: '#7a5a5c', density: 0.045},
  day: {top: '#6aa0d8', horizon: '#f2dcae', stars: 0, fog: '#e0d2b0', density: 0.018},
  dawn: {top: '#2c3a5a', horizon: '#f08a4a', stars: 0, fog: '#9a7a70', density: 0.035},
};
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
        c += vec3(step(0.995, h(g)) * uStars * smoothstep(0.1, 0.5, vDir.y)) * 0.8;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
const Sky: React.FC<{mood: Mood}> = ({mood}) => {
  const mat = useMemo(skyMat, []);
  const s = SKIES[mood];
  mat.uniforms.uTop.value.set(s.top);
  mat.uniforms.uHorizon.value.set(s.horizon);
  mat.uniforms.uStars.value = s.stars;
  return (
    <mesh material={mat} scale={90} frustumCulled={false}>
      <sphereGeometry args={[1, 32, 16]} />
    </mesh>
  );
};

const wetEarth = () =>
  canvasTexture(
    'kr-wet-earth',
    512,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = '#3a2c20';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 3500; i++) {
        ctx.fillStyle = ['#2a2018', '#4a3826', '#5a4630', '#24301c', '#6a4a22'][i % 5];
        const x = hash(i * 1.7) * w;
        const y = hash(i * 2.9) * h;
        ctx.beginPath();
        ctx.ellipse(x, y, 2 + hash(i) * 7, 1 + hash(i * 3) * 4, hash(i * 5) * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    {repeat: [24, 24]},
  );

// --- forest ------------------------------------------------------------------------
const cyl = new THREE.CylinderGeometry(1, 1, 1, 10);
const ballGeo = new THREE.SphereGeometry(1, 18, 12);

/** A clump of tall leaning bamboo. */
const Bamboo: React.FC<{p: V3; n?: number; h?: number; t: number}> = ({p, n = 9, h = 8, t}) => {
  const stem = plain('#4a6a34', 0.6);
  const leaf = m('bamboo-leaf', () => new THREE.MeshStandardMaterial({color: '#2f4a24', roughness: 0.9, side: THREE.DoubleSide}));
  return (
    <group position={p}>
      {Array.from({length: n}, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        const r = 0.15 + hash(i + p[0]) * 0.35;
        const lean = 0.08 + hash(i * 3 + p[2]) * 0.15 + Math.sin(t * 0.5 + i) * 0.01;
        const hh = h * (0.75 + hash(i * 5) * 0.4);
        return (
          <group key={i} position={[Math.cos(a) * r, 0, Math.sin(a) * r]} rotation={[Math.sin(a) * lean, 0, -Math.cos(a) * lean]}>
            <mesh geometry={cyl} material={stem} position={[0, hh / 2, 0]} scale={[0.04, hh, 0.04]} castShadow />
            <mesh geometry={ballGeo} material={leaf} position={[0, hh * 0.85, 0]} scale={[0.9, 1.4, 0.9]} castShadow />
          </group>
        );
      })}
    </group>
  );
};

/** A big old tree: thick trunk, a dark heavy crown. */
const BigTree: React.FC<{p: V3; s?: number}> = ({p, s = 1}) => (
  <group position={p} scale={s}>
    <mesh geometry={cyl} material={plain('#2a2018', 0.9)} position={[0, 3, 0]} scale={[0.35, 6, 0.35]} castShadow />
    {[[0, 7, 0, 3], [1.6, 6.2, 0.4, 2.2], [-1.5, 6.4, -0.3, 2.4], [0.3, 8.3, 0.2, 2]].map(([x, y, z, r], i) => (
      <mesh key={i} geometry={ballGeo} material={plain('#16241a', 0.95)} position={[x, y, z]} scale={[r, r * 0.8, r]} castShadow />
    ))}
  </group>
);

/** A temple roof far off in the mist: tiered roofs with curling finials. */
const Temple: React.FC<{p: V3}> = ({p}) => {
  const roof = plain('#7a3a1e', 0.8);
  const trim = plain('#c9a24a', 0.5);
  return (
    <group position={p}>
      <Box p={[0, 1.5, 0]} s={[8, 3, 5]} mat={plain('#d8d2c4')} />
      {[0, 1, 2].map((k) => (
        <group key={k} position={[0, 3.4 + k * 1.3, 0]} scale={[1 - k * 0.22, 1, 1 - k * 0.2]}>
          {[-1, 1].map((s) => (
            <Box key={s} p={[s * 2.2, 0.6, 0]} s={[4.8, 0.15, 6]} r={[0, 0, -s * 0.5]} mat={roof} />
          ))}
          {/* chofa: the curling bird-like finials at the roof ends */}
          {[-1, 1].map((s) => (
            <mesh key={'c' + s} geometry={cyl} material={trim} position={[0, 1.95, s * 2.9]} rotation={[s * 0.4, 0, 0]} scale={[0.08, 0.9, 0.08]} />
          ))}
        </group>
      ))}
    </group>
  );
};

/** Houses of this village: thorns on every window, red lanterns on the porches. */
const HOUSES: {p: V3; rotY: number; lit: number; lantern: number}[] = [
  {p: HER_HOUSE, rotY: -Math.PI / 2, lit: 0.6, lantern: 1},
  {p: RISE_HOUSE, rotY: Math.PI / 2, lit: 0.5, lantern: 1},
  {p: [4.3, 0, -10], rotY: -Math.PI / 2, lit: 0.4, lantern: 0.8},
  {p: [-4.4, 0, -16], rotY: Math.PI / 2, lit: 0.35, lantern: 0},
  {p: [4.6, 0, -23], rotY: -Math.PI / 2, lit: 0, lantern: 0.6},
  {p: [-4.0, 0, 8], rotY: Math.PI / 2, lit: 0.3, lantern: 1},
  {p: [4.4, 0, 10], rotY: -Math.PI / 2, lit: 0, lantern: 0},
];

const ForestVillage: React.FC<{t: number; mood: Mood; laneMist?: boolean}> = ({t, mood, laneMist = false}) => {
  const ground = m('kr-ground', () => new THREE.MeshStandardMaterial({map: wetEarth(), roughness: 0.55, color: '#a09080'}));
  const night = mood === 'night' ? 1 : 0;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={ground} receiveShadow>
        <planeGeometry args={[140, 140]} />
      </mesh>
      {/* a narrow, muddy lane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -8]} material={plain('#4a3a28', 0.5)} receiveShadow>
        <planeGeometry args={[2.0, 60]} />
      </mesh>
      {HOUSES.map((h, i) => (
        <StiltHouse key={i} p={h.p} rotY={h.rotY} lit={night ? h.lit : 0} thorns lantern={mood === 'day' ? 0 : h.lantern} />
      ))}
      {/* bamboo and big trees press in on every side */}
      {[[-7, 0, 4], [7.5, 0, -4], [-7.5, 0, -10], [7.2, 0, 5.5], [-6.8, 0, -21], [7.8, 0, -17], [-2.6, 0, 12], [2.8, 0, -28], [-2.8, 0, -30]].map((p, i) => (
        <Bamboo key={i} p={p as V3} t={t} h={7 + hash(i) * 3} />
      ))}
      {[[-11, 0, -2], [11, 0, -8], [-10, 0, -18], [10.5, 0, 2], [-12, 0, 10], [12, 0, -26], [-9, 0, -32], [9, 0, -36], [-4, 0, -40], [4.5, 0, -42], [0, 0, -46]].map((p, i) => (
        <BigTree key={i} p={p as V3} s={0.9 + hash(i * 3) * 0.5} />
      ))}
      {[[-2.4, 0, 2.5], [2.5, 0, -6], [-2.5, 0, -13], [2.6, 0, 6]].map((p, i) => (
        <Banana key={i} p={p as V3} s={0.9} t={t} />
      ))}
      <Temple p={[0, 0, -62]} />
      {/* mist in the forest on both sides, kept out of the lane so no camera ever passes through a puff */}
      {(laneMist ? [[-18, -7], [-7, 7], [7, 18]] : [[-18, -7], [7, 18]]).map(([a, b], i) => (
        <Mist key={i} t={t} color={mood === 'day' ? '#f0e6d0' : mood === 'dawn' ? '#d0a090' : mood === 'dusk' ? '#8a6a6a' : '#3a5a64'} opacity={mood === 'day' ? 0.12 : 0.3} area={[a, b, -48, 18]} count={30} />
      ))}
    </group>
  );
};

// --- the bedroom ---------------------------------------------------------------------
const curtainTexture = () =>
  canvasTexture('kr-curtain', 128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#b8a890';
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 8) {
      ctx.fillStyle = x % 16 ? 'rgba(60,40,30,0.12)' : 'rgba(255,240,210,0.08)';
      ctx.fillRect(x, 0, 4, h);
    }
  });

/** Curtain panel with soft folds; `open` slides it aside. Lit from behind by `glow` (red). */
const Curtain: React.FC<{x: number; side: number; open: number; glow: number}> = ({x, side, open, glow}) => {
  const mat = useMemo(() => {
    const g = new THREE.PlaneGeometry(0.62, 1.25, 24, 1);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 40) * 0.018);
    g.computeVertexNormals();
    return {g, m: new THREE.MeshStandardMaterial({map: curtainTexture(), roughness: 1, side: THREE.DoubleSide, emissive: new THREE.Color('#ff2a10')})};
  }, []);
  mat.m.emissiveIntensity = glow;
  return <mesh geometry={mat.g} material={mat.m} position={[x + side * (0.26 + open * 0.42), 1.42, 1.62]} scale={[1 - open * 0.55, 1, 1]} />;
};

const silhouetteTex = () =>
  canvasTexture('kr-silhouette', 256, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.filter = 'blur(10px)';
    ctx.fillStyle = 'rgba(10,2,2,0.95)';
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.2, w * 0.2, h * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    // long hair falling from the head in uneven strands
    for (let i = 0; i < 26; i++) {
      const x = w / 2 + (i / 25 - 0.5) * w * 0.5;
      const len = h * (0.45 + hash(i * 3.3) * 0.4);
      ctx.strokeStyle = 'rgba(10,2,2,0.85)';
      ctx.lineWidth = 7 + hash(i) * 6;
      ctx.beginPath();
      ctx.moveTo(x, h * 0.18);
      ctx.quadraticCurveTo(x + (hash(i * 7) - 0.5) * 30, h * 0.18 + len * 0.6, x + (hash(i * 5) - 0.5) * 40, h * 0.18 + len);
      ctx.stroke();
    }
    ctx.filter = 'none';
  });
const silhouetteMats = new Map<number, THREE.MeshBasicMaterial>();
const silhouetteMat = (a: number) => {
  const k = Math.round(a * 30);
  if (!silhouetteMats.has(k)) silhouetteMats.set(k, new THREE.MeshBasicMaterial({map: silhouetteTex(), transparent: true, opacity: (k / 30) * 0.85, depthWrite: false, side: THREE.DoubleSide}));
  return silhouetteMats.get(k)!;
};

const Bedroom: React.FC<{t: number; shot: ShotId; mood: Mood}> = ({t, shot, mood}) => {
  const wall = planks();
  const floor = planks();
  const curtainsClosed = shot === 'curtains' || shot === 'midnight' || shot === 'split' || shot === 'return' || shot === 'food' || shot === 'elder';
  const open = curtainsClosed ? 0 : 1;
  // the red glow through the curtains at the end, and the head pressing close at "hovering"
  const endGlow = shot === 'curtains' ? 0.05 + 0.08 * easeInOut(clamp((t - cue.so) / 3.5)) : 0;
  const shadowIn = shot === 'curtains' ? easeInOut(clamp((t - cue.hovering) / 1.2)) : 0;
  const winX = 0.3;
  return (
    <group position={BED}>
      {/* room shell: 4 x 3.5, front wall with a window (looking out over the trees, +z) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={floor} receiveShadow>
        <planeGeometry args={[4, 3.5]} />
      </mesh>
      <Box p={[0, 2.5, 0]} s={[4, 0.05, 3.5]} mat={plain('#22170f')} cast={false} />
      <Box p={[-2, 1.25, 0]} s={[0.06, 2.5, 3.5]} mat={wall} />
      <Box p={[2, 1.25, 0]} s={[0.06, 2.5, 3.5]} mat={wall} />
      <Box p={[0, 1.25, -1.75]} s={[4, 2.5, 0.06]} mat={wall} />
      {/* front wall around the window opening (x 0.3 +-0.5, y 0.9..1.95) */}
      <Box p={[-1.1, 1.25, 1.75]} s={[1.8, 2.5, 0.06]} mat={wall} />
      <Box p={[1.4, 1.25, 1.75]} s={[1.2, 2.5, 0.06]} mat={wall} />
      <Box p={[winX, 0.45, 1.75]} s={[1.0, 0.9, 0.06]} mat={wall} />
      <Box p={[winX, 2.22, 1.75]} s={[1.0, 0.55, 0.06]} mat={wall} />
      {/* frame and open shutters */}
      {[-0.52, 0.52].map((dx) => (
        <Box key={dx} p={[winX + dx, 1.42, 1.76]} s={[0.05, 1.1, 0.09]} mat={plain('#3a2618')} />
      ))}
      {[-1, 1].map((s) => (
        <Box key={s} p={[winX + s * 0.78, 1.42, 1.86]} s={[0.5, 1.05, 0.03]} r={[0, s * 0.35, 0]} mat={planks()} />
      ))}
      {/* thorny branches across the outside of this window too (not while you look out through it) */}
      <group position={[winX, 1.42, 1.82]} visible={shot !== 'window' && shot !== 'turn'}>
        {[0.6, -0.55, 0.12].map((r, i) => (
          <mesh key={i} geometry={cyl} material={plain('#1c140e')} rotation={[0, 0, Math.PI / 2 + r]} scale={[0.012, 1.25, 0.012]} />
        ))}
      </group>
      <Curtain x={winX} side={-1} open={open} glow={endGlow} />
      <Curtain x={winX} side={1} open={open} glow={endGlow} />
      <Box p={[winX, 2.06, 1.62]} s={[1.5, 0.03, 0.03]} mat={plain('#2a1a10')} />
      {/* her shadow through the curtain: a soft head, long hair hanging, blurred by the fabric */}
      {shadowIn > 0 && (
        <mesh position={[winX + 0.04, 1.32, 1.6]} material={silhouetteMat(shadowIn)} scale={[0.55, 1.0, 1]}>
          <planeGeometry args={[1, 1]} />
        </mesh>
      )}

      {/* her mat and mosquito net, a low table with food */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[MAT[0], 0.012, MAT[2]]}>
        <planeGeometry args={[1.0, 2.0]} />
        <meshStandardMaterial color="#9a8458" roughness={1} />
      </mesh>
      {(shot === 'food' || shot === 'elder') && (
        <group position={[-0.6, 0, -0.3]}>
          <mesh material={plain('#9aa0a4', 0.3)} position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.14, 0.12, 0.02, 32]} />
          </mesh>
          {/* cooked rice and a dish, steaming, untouched */}
          <mesh material={plain('#efe9dc', 0.9)} position={[-0.03, 0.06, 0]} scale={[0.07, 0.05, 0.07]}>
            <sphereGeometry args={[1, 16, 12]} />
          </mesh>
          {[[0.08, 0.02, '#a0521c'], [-0.07, 0.07, '#3e7a2a'], [0.04, -0.08, '#b8301c']].map(([x, z, c], i) => (
            <group key={i} position={[x as number, 0.03, z as number]}>
              <mesh material={plain('#d8d2c4', 0.5)}>
                <cylinderGeometry args={[0.04, 0.03, 0.025, 20]} />
              </mesh>
              <mesh material={plain(c as string, 0.5)} position={[0, 0.01, 0]} scale={[0.034, 0.012, 0.034]}>
                <sphereGeometry args={[1, 14, 8]} />
              </mesh>
            </group>
          ))}
          <mesh material={plain('#a8844e')} position={[0.22, 0.08, -0.05]}>
            <cylinderGeometry args={[0.05, 0.07, 0.15, 16]} />
          </mesh>
        </group>
      )}

      {/* lights */}
      {mood === 'night' && <Spot position={[winX, 1.9, 2.6]} target={[MAT[0], 0, MAT[2]]} intensity={shot === 'curtains' ? 1.5 : 9} angle={0.7} penumbra={0.8} distance={7} decay={1.3} color="#6f9ab8" shadow />}
      {mood === 'night' && <hemisphereLight args={['#1d3a48', '#0b0806', 0.45]} />}
      {mood === 'night' && shot !== 'curtains' && <pointLight position={[0.6, 1.9, 0.8]} intensity={3} distance={5} decay={1.4} color="#7fa8c8" />}
      {mood === 'dawn' && <Spot position={[winX + 0.4, 1.7, 3.0]} target={[MAT[0] + 0.2, 0, MAT[2] - 0.2]} intensity={22} angle={0.5} penumbra={0.4} distance={9} decay={1.2} color="#ffa860" shadow />}
      {mood === 'dawn' && <hemisphereLight args={['#5a4a50', '#120c08', 0.5]} />}
      {mood === 'day' && <Spot position={[winX + 0.3, 1.8, 3.0]} target={[-0.6, 0, -0.3]} intensity={18} angle={0.6} penumbra={0.6} distance={9} decay={1.2} color="#ffe2b0" shadow />}
      {mood === 'day' && <hemisphereLight args={['#c8b8a0', '#3a2a1e', 0.9]} />}
      {shot === 'elder' && <pointLight position={[1.0, 0.3, -0.2]} intensity={4} distance={4} decay={1.7} color="#ff9a48" />}
      {shot === 'curtains' && <pointLight position={[winX, 1.45, 2.1]} intensity={6 * endGlow} distance={5} decay={1.5} color="#ff2a14" />}
      {shot === 'curtains' && <pointLight position={[0.2, 1.8, -0.5]} intensity={0.6} distance={3} decay={1.6} color="#5a6a80" />}

      {/* people */}
      {(shot === 'midnight' || shot === 'split') && (
        // sitting on her mat at midnight, her back half to you
        <Human face="neutral" position={[MAT[0], 0, MAT[2]]} rotationY={-0.6} hipY={0.14} thigh={-1.45} knee={2.7} spread={0.45} armL={-0.35} armR={-0.35} elbowL={-0.6} elbowR={-0.6} noHead={shot === 'split'} breathe={t} />
      )}
      {shot === 'split' && (
        // the head lifts away from the neck, the red glow showing beneath
        <Krasue t={t} position={add(NECK_SITTING, [0, 0.16 + 0.35 * easeInOut(clamp((t - cue.splits) / 1.0)), 0])} rotationY={-0.6} glow={clamp((t - cue.splits + 0.2) / 0.8)} bob={0.2} light={0.6} />
      )}
      {shot === 'return' && (
        <>
          {/* her headless body sitting in the dark; the head comes down to meet it */}
          <Human face="neutral" position={[MAT[0], 0, MAT[2]]} rotationY={-0.6} hipY={0.14} thigh={-1.45} knee={2.7} spread={0.45} armL={-0.3} armR={-0.3} elbowL={-0.6} elbowR={-0.6} noHead />
          <Krasue t={t} position={add(NECK_SITTING, [0, lerp(1.1, 0.16, easeInOut(clamp((t - cue.before) / 4.5))), 0])} rotationY={-0.6} glow={lerp(1, 0.2, clamp((t - cue.before) / 5))} bob={0.3} />
        </>
      )}
      {shot === 'elder' && <Human outfit="elder" face="elder" position={[1.2, 0, -0.6]} rotationY={-0.15} hipY={0.14} thigh={-1.45} knee={2.7} spread={0.5} armL={-0.5} armR={-0.5} elbowL={-0.9} elbowR={-0.9} breathe={t} />}
      {shot === 'food' && (
        // her pale hand drawing back from the cooked food
        <Human face="tired" position={[-0.6, 0, -0.95]} rotationY={0.1} hipY={0.14} thigh={-1.45} knee={2.7} spread={0.45} armL={-0.9} armR={lerp(-1.1, -0.6, easeInOut(clamp((t - cue.never) / 1.2)))} elbowL={-0.6} elbowR={-0.5} headPitch={0.3} breathe={t} hairDrift={t} />
      )}

      {/* outside the window: the trees, the mist, and the thing drifting among them */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 14]}>
        <planeGeometry args={[60, 30]} />
        <meshStandardMaterial color="#20281c" roughness={1} />
      </mesh>
      {[[-3.5, 0, 9], [5.5, 0, 11], [-4.5, 0, 16], [7, 0, 17], [-6, 0, 19], [9, 0, 22], [9.5, 0, 14], [-8, 0, 13]].map((p, i) => (
        <BigTree key={i} p={p as V3} s={0.8 + hash(i) * 0.4} />
      ))}
      <Mist t={t} color="#2a3a44" opacity={0.3} area={[-10, 10, 5, 24]} y={[0.5, 4]} count={30} />
      {(shot === 'window' || shot === 'turn' || shot === 'stare') && (
        <Krasue t={t} position={farPos(t)} rotationY={shot === 'stare' ? Math.PI : turnYaw(t)} glow={shot === 'stare' ? 0.75 : 1} light={shot === 'stare' ? 0.5 : 1.2} halo={shot === 'window' ? 1.6 : shot === 'turn' ? 0.7 : 0} />
      )}
      {shot === 'curtains' && t > cue.hovering - 0.5 && <Krasue t={t} position={AT_WINDOW} rotationY={Math.PI} glow={1} light={0.4} />}
    </group>
  );
};

// --- the whole scene -------------------------------------------------------------------
export const KrasueScene: React.FC<{t: number; shot: ShotId; set: 'village' | 'bedroom' | 'black'; mood: Mood}> = ({t, shot, set, mood}) => {
  const sky = SKIES[mood];
  if (set === 'black') return <color attach="background" args={['#000000']} />;
  return (
    <group>
      <color attach="background" args={[sky.fog]} />
      <fogExp2 attach="fog" args={[sky.fog, set === 'bedroom' ? sky.density * 1.2 : sky.density]} />
      {set === 'bedroom' && mood !== 'night' ? null : null}
      {set === 'village' && (
        <>
          <Sky mood={mood} />
          <ForestVillage t={t} mood={mood} laneMist={shot === 'title'} />
          <hemisphereLight args={[mood === 'day' ? '#cfe2f5' : mood === 'dusk' ? '#8a6a70' : mood === 'dawn' ? '#c09080' : '#204658', mood === 'day' ? '#a0805a' : '#0a0706', mood === 'day' ? 2.4 : mood === 'night' ? 0.95 : 1.4]} />
          <directionalLight
            position={mood === 'dawn' ? [-4, 3, -30] : mood === 'dusk' ? [-10, 4, -20] : mood === 'day' ? [-8, 12, 6] : [-6, 10, -8]}
            intensity={mood === 'day' ? 5 : mood === 'night' ? 1.0 : 3}
            color={mood === 'day' ? '#ffe0b0' : mood === 'dusk' ? '#ff9a60' : mood === 'dawn' ? '#ffa060' : '#7fb0d0'}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-left={-16}
            shadow-camera-right={16}
            shadow-camera-top={16}
            shadow-camera-bottom={-16}
          />
          {/* people in the village */}
          {(shot === 'street' || shot === 'smile') && (
            <>
              <Human face={shot === 'smile' && t > cue.smiles ? 'smile' : 'neutral'} position={[0.3, 0, -2.2]} rotationY={0} armL={0.05} armR={0.05} breathe={t} hairDrift={t} />
              <pointLight position={[0.9, 1.9, -1.2]} intensity={1.6} distance={3} decay={1.6} color="#ffb070" />
            </>
          )}
          {shot === 'crowd' && (
            <>
              <Human face="smile" position={[0.3, 0, -2.2]} rotationY={0.3} breathe={t} />
              <Human outfit="man" face="neutral" position={[-0.7, 0, -1.4]} rotationY={0.8} walk={t * 3.4} stride={0.25} />
              <Human outfit="elder" face="elder" position={[0.95, 0, -3.1]} rotationY={-0.5} />
              <Human face="neutral" position={[-0.4, 0, -4.2]} rotationY={0.2} walk={t * 3.2} stride={0.25} />
              <Human outfit="man" face="neutral" position={[1.2, 0, -0.8]} rotationY={-1.6} walk={t * 3} stride={0.25} />
            </>
          )}
          {shot === 'day' && <Human face="smile" position={PORCH} rotationY={-Math.PI / 2 + 0.25} armL={0.05} armR={-0.15} elbowL={-0.2} elbowR={-0.5} headYaw={-0.2} breathe={t} />}
          {shot === 'tired' && (
            <>
              <Human face="tired" position={PORCH} rotationY={-Math.PI / 2 + 0.3} headPitch={0.2} breathe={t * 0.6} hairDrift={t} />
              <pointLight position={[PORCH[0] - 0.8, PORCH[1] + 1.6, PORCH[2] + 0.4]} intensity={1.2} distance={2.5} decay={1.6} color="#d8c0a0" />
            </>
          )}
          {/* the head rising out over the roof into the night sky */}
          {(shot === 'rise' || shot === 'organs') && <Krasue t={t} position={[RISE_AT[0], riseHeight(t), RISE_AT[2]]} rotationY={0.7} glow={shot === 'organs' ? 0.8 : 1} light={shot === 'organs' ? 0.8 : 1.4} halo={shot === 'rise' ? 0.8 : 0.25} />}
          {/* out on the forest path, drifting through the dark */}
          {(shot === 'path' || shot === 'hunt') && <Krasue t={t} position={shot === 'path' ? [Math.sin(t * 0.3) * 0.8, 1.7, PATH_Z - 4 + (t - cue.driven) * 0.5] : [lerp(-1.6, 1.6, clamp((t - cue.search + 0.2) / 4.5)), 1.25, PATH_Z - 0.6]} rotationY={shot === 'path' ? 0.2 : -Math.PI / 2} glow={1} light={1.8} halo={shot === 'path' ? 0.9 : 0.5} />}
          {/* far off in the title shot: a red glow drifting above the trees */}
          {shot === 'title' && <Krasue t={t} position={[-2.2 + (t - cue.call) * 0.5, 3.6, -10]} rotationY={Math.PI} glow={1} light={0.8} halo={1.5} />}
        </>
      )}
      {set === 'bedroom' && (
        <>
          <Sky mood={mood} />
          <Bedroom t={t} shot={shot} mood={mood} />
        </>
      )}
    </group>
  );
};

export const fogPuff = fogPuffTexture;
export const _unused = {FAR, lerp};
