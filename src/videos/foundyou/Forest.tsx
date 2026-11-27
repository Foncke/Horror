import React, {useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {Character} from '../../three/Character';
import {Spot, std} from '../../three/Common';
import {canvasTexture, FaceKind} from '../../three/textures';
import {clamp, easeInOut, hash, lerp} from '../../lib/timeline';
import {MIMIC, MIMIC_SCALE, PINE, PINE_R, RIDGE, ShotId, View, cue, dusk, flashOn, leanIn, mimicVisible, neckBend} from './cues';

type V3 = [number, number, number];
const col = (a: string, b: string, u: number) => new THREE.Color(a).lerp(new THREE.Color(b), u);

// --- textures -----------------------------------------------------------------
const groundTexture = () =>
  canvasTexture(
    'forest-floor',
    512,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = '#2a2219';
      ctx.fillRect(0, 0, w, h);
      let seed = 9;
      const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 2600; i++) {
        const x = r() * w;
        const y = r() * h;
        const a = r() * Math.PI;
        ctx.strokeStyle = ['#3d2c1c', '#4a3520', '#1d1812', '#5a4026', '#2f3a24'][Math.floor(r() * 5)];
        ctx.lineWidth = 1 + r() * 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * 10, y + Math.sin(a) * 10);
        ctx.stroke();
      }
      for (let i = 0; i < 160; i++) {
        ctx.fillStyle = ['#6b3d1f', '#7a4a22', '#4d3018'][Math.floor(r() * 3)];
        ctx.beginPath();
        ctx.ellipse(r() * w, r() * h, 4 + r() * 5, 2 + r() * 3, r() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    {repeat: [28, 28]},
  );

const barkTexture = () =>
  canvasTexture(
    'bark',
    128,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = '#2b1e15';
      ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 6) {
        ctx.fillStyle = `rgba(${10 + ((x * 37) % 30)},${8 + ((x * 13) % 18)},6,0.7)`;
        ctx.fillRect(x, 0, 2 + ((x * 7) % 4), h);
      }
    },
    {repeat: [3, 4]},
  );

const fogTexture = () =>
  canvasTexture('fog-puff', 256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    let seed = 3;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 28; i++) {
      const x = w * (0.2 + r() * 0.6);
      const y = h * (0.3 + r() * 0.4);
      const rad = w * (0.12 + r() * 0.2);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, 'rgba(255,255,255,0.22)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  });

const mapTexture = () =>
  canvasTexture('trail-map', 512, 360, (ctx, w, h) => {
    ctx.fillStyle = '#e6d7b4';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(120,90,50,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.ellipse(w * 0.62, h * 0.45, 40 + i * 28, 26 + i * 18, 0.3, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = '#7a2a1c';
    ctx.lineWidth = 5;
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    ctx.moveTo(30, h - 40);
    ctx.bezierCurveTo(140, h - 120, 200, 120, 330, 150);
    ctx.bezierCurveTo(420, 170, 450, 90, 490, 40);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#7a2a1c';
    ctx.font = '700 40px "Special Elite"';
    ctx.fillText('X', 318, 140);
    ctx.font = '400 24px "Special Elite"';
    ctx.fillStyle = '#3a2a1a';
    ctx.fillText('RIDGE TRAIL', 40, 50);
    ctx.fillText('main trail?', 360, 300);
  });

const compassTexture = () =>
  canvasTexture('compass-face', 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#efe9dc';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 36px Oswald';
    [['N', 0], ['E', 90], ['S', 180], ['W', 270]].forEach(([l, a]) => {
      const r = ((a as number) * Math.PI) / 180;
      ctx.fillText(l as string, w / 2 + Math.sin(r) * 92, h / 2 - Math.cos(r) * 92);
    });
    for (let i = 0; i < 36; i++) {
      const r = (i * Math.PI) / 18;
      ctx.fillRect(w / 2 + Math.sin(r) * 116 - 1, h / 2 - Math.cos(r) * 116 - 4, 2, 8);
    }
  });

// --- trees --------------------------------------------------------------------
type Tree = {x: number; z: number; s: number; r: number; seed: number};

const makeTrees = (): Tree[] => {
  const out: Tree[] = [];
  for (let i = 0; i < 1600 && out.length < 460; i++) {
    const x = (hash(i * 3.1) - 0.5) * 56;
    const z = (hash(i * 7.7 + 1) - 0.5) * 104 + 10;
    if (Math.abs(x) < 1.6) continue; // the trail
    if (Math.hypot(x - PINE[0], z - PINE[2]) < 2.4) continue; // room around the big pine
    if (Math.hypot(x, z) < 2.2 || Math.hypot(x - RIDGE[0], z - RIDGE[2]) < 2.4) continue;
    if (Math.abs(x) < 3.4 && z > 13 && z < 22) continue; // ridge shots
    if (Math.abs(x) < 2.4 && z > 19 && z < 29) continue; // the walk in the hook
    if (out.some((t) => Math.hypot(t.x - x, t.z - z) < 1.6)) continue;
    out.push({x, z, s: 0.8 + hash(i * 1.3) * 0.6, r: 0.12 + hash(i * 2.9) * 0.16, seed: i});
  }
  return out;
};

const TIERS = 8;
const coneGeo = new THREE.ConeGeometry(1, 1, 10, 1);
const trunkGeo = new THREE.CylinderGeometry(1, 1.15, 1, 10, 1);

const Pines: React.FC<{needles: THREE.Material; bark: THREE.Material}> = ({needles, bark}) => {
  const trees = useMemo(makeTrees, []);
  const trunks = useRef<THREE.InstancedMesh>(null);
  const cones = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    trees.forEach((t, i) => {
      m.compose(new THREE.Vector3(t.x, 6 * t.s, t.z), q, new THREE.Vector3(t.r, 12 * t.s, t.r));
      trunks.current!.setMatrixAt(i, m);
      for (let k = 0; k < TIERS; k++) {
        const y = (3.6 + k * 1.05) * t.s;
        const rad = (1.25 - k * 0.14) * t.s * (0.85 + hash(t.seed + k) * 0.3);
        const hgt = 2.2 * t.s;
        q.setFromEuler(new THREE.Euler(0, hash(t.seed * 5 + k) * 6, (hash(t.seed + k * 9) - 0.5) * 0.06));
        m.compose(new THREE.Vector3(t.x, y, t.z), q, new THREE.Vector3(rad, hgt, rad));
        cones.current!.setMatrixAt(i * TIERS + k, m);
      }
      q.identity();
    });
    trunks.current!.instanceMatrix.needsUpdate = true;
    cones.current!.instanceMatrix.needsUpdate = true;
  }, [trees]);
  return (
    <>
      <instancedMesh ref={trunks} args={[trunkGeo, bark, trees.length]} castShadow receiveShadow />
      <instancedMesh ref={cones} args={[coneGeo, needles, trees.length * TIERS]} castShadow receiveShadow />
    </>
  );
};

/** The massive pine the figure hides behind. */
const BigPine: React.FC<{needles: THREE.Material; bark: THREE.Material}> = ({needles, bark}) => (
  <group position={PINE}>
    <mesh geometry={trunkGeo} material={bark} position={[0, 7, 0]} scale={[PINE_R, 14, PINE_R]} castShadow receiveShadow />
    {/* roots flaring into the ground */}
    {[0, 1.3, 2.5, 3.8, 5.1].map((a) => (
      <mesh key={a} geometry={trunkGeo} material={bark} position={[Math.cos(a) * 0.45, 0.15, Math.sin(a) * 0.45]} rotation={[Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1]} scale={[0.14, 0.7, 0.14]} castShadow receiveShadow />
    ))}
    {Array.from({length: 8}, (_, k) => (
      <mesh key={k} geometry={coneGeo} material={needles} position={[0, 5.2 + k * 1.15, 0]} scale={[1.7 - k * 0.18, 2.4, 1.7 - k * 0.18]} castShadow receiveShadow />
    ))}
  </group>
);

// --- flashlight beam ------------------------------------------------------------
const BEAM_LEN = 14;
const beamGeo = (() => {
  const g = new THREE.ConeGeometry(BEAM_LEN * Math.tan(0.3), BEAM_LEN, 48, 1, true);
  g.translate(0, -BEAM_LEN / 2, 0); // apex at the origin, opening along -y
  return g;
})();

const beamMaterial = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {uStrength: {value: 0.1}, uColor: {value: new THREE.Color('#fff0d6')}},
    vertexShader: `
      varying float vAlong; varying vec3 vN; varying vec3 vView;
      void main(){
        vAlong = clamp(-position.y / ${BEAM_LEN.toFixed(1)}, 0.0, 1.0);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uStrength; uniform vec3 uColor;
      varying float vAlong; varying vec3 vN; varying vec3 vView;
      // safe normalize: at the tip of the cone a vector can be zero, and NaN pixels get
      // smeared into black blotches by the bloom pass (the black flashes in the first render)
      vec3 safeN(vec3 v){ float l = length(v); return l > 1e-5 ? v / l : vec3(0.0, 0.0, 1.0); }
      void main(){
        float facing = pow(clamp(abs(dot(safeN(vN), safeN(vView))), 0.0, 1.0), 1.6);
        float a = clamp(vAlong, 0.0, 1.0);
        float fall = pow(1.0 - a, 1.7) * smoothstep(0.0, 0.08, a);
        vec3 c = uColor * uStrength * facing * fall;
        if (!(c.r >= 0.0 && c.g >= 0.0 && c.b >= 0.0)) c = vec3(0.0); // never let a NaN through
        gl_FragColor = vec4(c, 1.0);
      }`,
  });

const Beam: React.FC<{from: V3; to: V3; strength: number}> = ({from, to, strength}) => {
  const mat = useMemo(beamMaterial, []);
  mat.uniforms.uStrength.value = strength;
  const dir = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
  return <mesh geometry={beamGeo} material={mat} position={from} quaternion={q} frustumCulled={false} />;
};

// --- sky ------------------------------------------------------------------------
const skyMaterial = () =>
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {uHorizon: {value: new THREE.Color()}, uZenith: {value: new THREE.Color()}, uGlow: {value: new THREE.Color()}, uGlowAmt: {value: 0}},
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 uHorizon, uZenith, uGlow; uniform float uGlowAmt; varying vec3 vDir;
      void main(){
        float h = clamp(vDir.y * 1.6, 0.0, 1.0);
        vec3 c = mix(uHorizon, uZenith, h);
        float sun = pow(max(dot(normalize(vDir), normalize(vec3(-0.25, 0.05, -1.0))), 0.0), 6.0);
        c += uGlow * uGlowAmt * (sun * 0.9 + (1.0 - h) * 0.25);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });

// --- the scene --------------------------------------------------------------------
const FogPuffs: React.FC<{t: number; color: THREE.Color; opacity: number}> = ({t, color, opacity}) => {
  const tex = fogTexture();
  const puffs = useMemo(
    () =>
      Array.from({length: 70}, (_, i) => ({
        x: (hash(i * 4.1) - 0.5) * 30,
        z: (hash(i * 2.3 + 5) - 0.5) * 50 + 4,
        y: 0.6 + hash(i * 6.7) * 1.6,
        s: 5 + hash(i * 8.9) * 7,
        v: (hash(i) - 0.5) * 0.12,
      })),
    [],
  );
  const mat = useMemo(() => new THREE.SpriteMaterial({map: tex, transparent: true, depthWrite: false, fog: true}), [tex]);
  mat.color.copy(color);
  mat.opacity = opacity;
  return (
    <>
      {puffs.map((p, i) => (
        <sprite key={i} material={mat} position={[p.x + t * p.v, p.y, p.z]} scale={[p.s, p.s * 0.45, 1]} />
      ))}
    </>
  );
};

export const Forest: React.FC<{t: number; shot: ShotId; view: View}> = ({t, shot, view}) => {
  const d = dusk(t);
  const night = 1 - d;
  const fogColor = col('#06080d', '#4f4a58', d);
  const sky = useMemo(skyMaterial, []);
  sky.uniforms.uHorizon.value.copy(fogColor); // no seam where the fog meets the sky
  sky.uniforms.uZenith.value.copy(col('#03050a', '#2c3550', d));
  sky.uniforms.uGlow.value.set('#ff9a50');
  sky.uniforms.uGlowAmt.value = d * d;

  const needles = std('#1a2a1e', 0.9);
  const bark = std('#ffffff', 0.95, 0, {map: barkTexture(), color: new THREE.Color('#8a7a6a')});
  const ground = std('#ffffff', 1, 0, {map: groundTexture(), color: new THREE.Color('#9a8a78')});

  const on = flashOn(t) && shot !== 'black';
  const hikerHere: V3 = shot === 'ridge' || shot === 'gear' ? RIDGE : [0, 0, shot === 'boots' ? 0.25 * (1 - clamp((t - cue.crunch) / 3)) : 0];
  const showHiker = !view.pov;

  // her face
  let face: FaceKind = 'worried';
  if (shot === 'ridge' || shot === 'gear') face = 'calm';
  if (shot === 'yell' || shot === 'behind' || shot === 'breath') face = 'scared';

  // the mimic
  const lean = leanIn(t);
  let mimicPos: V3 = MIMIC;
  let mimicYaw = 0; // faces +z, toward you
  let mimicFace: FaceKind = 'void';
  let hunch = 0;
  let roll = neckBend(t);
  if (shot === 'breath') {
    mimicPos = [0.4, 0, lerp(1.0, 0.5, lean)];
    mimicYaw = Math.PI;
    hunch = 0.42 * lean;
    roll = -0.85;
    mimicFace = t > cue.found - 0.15 ? 'voidGrin' : 'void';
  }
  const showMimic = mimicVisible(shot) && !(shot === 'sweep' && t < cue.froze - 0.4);

  return (
    <group>
      <color attach="background" args={[fogColor.getStyle()]} />
      <fogExp2 attach="fog" args={[fogColor.getStyle(), lerp(0.062, 0.05, d)]} />
      <mesh material={sky} scale={60} frustumCulled={false}>
        <sphereGeometry args={[1, 32, 16]} />
      </mesh>

      <hemisphereLight args={[col('#1e2a40', '#8a90b0', d).getStyle(), '#0b0908', lerp(0.5, 1.1, d)]} />
      <directionalLight position={[-6, 4, -20]} intensity={2.2 * d * d} color="#ffa060" />
      {/* the night is not quite black: a faint cold fill */}
      <pointLight position={[0, 6, 4]} intensity={night * 4} distance={30} decay={1.2} color="#5a6a90" />

      {on && (
        <>
          <Spot position={view.beam.pos} target={view.beam.target} intensity={shot === 'gear' ? 0.7 : shot === 'stare' || shot === 'tilt' ? 22 : shot === 'figure' ? 30 : shot === 'sweep' ? 80 : 170} angle={0.3} penumbra={0.55} distance={30} decay={1.4} color="#fff0d8" shadow />
          {shot !== 'gear' && <Beam from={view.beam.pos} to={view.beam.target} strength={view.pov ? 0.05 : 0.11} />}
        </>
      )}
      {/* soft key on faces in the close third-person shots */}
      {(shot === 'yell' || shot === 'behind' || shot === 'breath' || shot === 'stop') && (
        <Spot position={[0.35, 1.75, -1.4]} target={[0.05, 1.5, 0.1]} intensity={shot === 'breath' ? 4 : 3} angle={0.4} penumbra={1} distance={4} color="#c8d4f0" />
      )}

      {/* ground and trail */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={ground} receiveShadow>
        <planeGeometry args={[90, 140]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 6]} material={std('#4a3a2a', 1)} receiveShadow>
        <planeGeometry args={[1.3, 70]} />
      </mesh>

      <Pines needles={needles} bark={bark} />
      <BigPine needles={needles} bark={bark} />
      <FogPuffs t={t} color={col('#2a3242', '#a89aa0', d)} opacity={lerp(0.32, 0.3, d)} />

      {/* her */}
      {showHiker && (
        <group>
          <Character
            outfit="hiker"
            face={face}
            position={hikerHere}
            rotationY={Math.PI}
            headPitch={shot === 'ridge' || shot === 'gear' ? 0.45 : shot === 'boots' ? 0.3 : 0}
            headYaw={shot === 'stop' ? Math.sin(t * 0.6) * 0.35 : shot === 'behind' ? -0.15 : 0}
            armL={shot === 'ridge' || shot === 'gear' ? -1.0 : -0.15}
            armR={shot === 'ridge' || shot === 'gear' ? -1.0 : -1.15}
            walk={shot === 'boots' ? t * 2.2 : 0}
            stride={shot === 'boots' ? 0.25 : 0}
            breathe={t * (shot === 'ridge' || shot === 'gear' ? 1 : 2.4)}
          />
          {(shot === 'ridge' || shot === 'gear') && (
            <group position={[RIDGE[0], 1.0, RIDGE[2] - 0.42]} rotation={[-1.05, 0, 0]}>
              <mesh>
                <planeGeometry args={[0.36, 0.25]} />
                <meshStandardMaterial map={mapTexture()} roughness={0.95} side={THREE.DoubleSide} />
              </mesh>
              <group position={[0.07, -0.03, 0.012]}>
                <mesh rotation={[Math.PI / 2, 0, 0]} material={std('#3a3d42', 0.4, 0.6)}>
                  <cylinderGeometry args={[0.042, 0.042, 0.014, 32]} />
                </mesh>
                <mesh position={[0, 0, 0.0075]}>
                  <circleGeometry args={[0.037, 32]} />
                  <meshStandardMaterial map={compassTexture()} roughness={0.6} />
                </mesh>
                {/* the needle can't settle */}
                <mesh position={[0, 0, 0.009]} rotation={[0, 0, Math.sin(t * 2.7) * 0.6 + Math.sin(t * 7.1) * 0.15]} material={std('#c0281e', 0.5)}>
                  <planeGeometry args={[0.006, 0.06]} />
                </mesh>
              </group>
            </group>
          )}
        </group>
      )}

      {/* the thing that copies her */}
      {showMimic && (
        <group position={mimicPos} rotation={[0, mimicYaw, 0]} scale={MIMIC_SCALE}>
          <Character outfit="mimic" face={mimicFace} neckRoll={roll} hunch={hunch} armL={0} armR={0} breathe={0} shadows />
        </group>
      )}
    </group>
  );
};

export const fadeAt = (t: number) => (t >= cue.cut ? 0 : easeInOut(clamp(t / 1.0)));
