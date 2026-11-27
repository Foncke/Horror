import React, {useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {clamp, easeInOut, easeOut, lerp} from '../../lib/timeline';
import {Human} from './Human';
import {Box, StiltHouse, fogPuffTexture, m, plain} from './Village';
import {ShotId, VOID, cue} from './cues';

type V3 = [number, number, number];

/** Candle with a flame that flickers; `flare` makes it leap, `out` kills it. */
const Candle: React.FC<{p: V3; t: number; h?: number; flare?: number; out?: number}> = ({p, t, h = 0.18, flare = 0, out = 0}) => {
  const k = (0.85 + Math.sin(t * 11 + p[0] * 40) * 0.1 + Math.sin(t * 27 + p[2] * 30) * 0.06) * (1 + flare * 2.5) * (1 - out);
  return (
    <group position={p}>
      <mesh material={plain('#e8dcc0', 0.6)} position={[0, h / 2, 0]} castShadow>
        <cylinderGeometry args={[0.022, 0.024, h, 16]} />
      </mesh>
      {k > 0.02 && (
        <mesh position={[0, h + 0.025 * (1 + flare), 0]} material={m('cflame', () => new THREE.MeshBasicMaterial({color: '#ffd28a'}))} scale={[0.01 * (1 + flare * 0.6), 0.024 * k, 0.01 * (1 + flare * 0.6)]}>
          <sphereGeometry args={[1, 12, 8]} />
        </mesh>
      )}
    </group>
  );
};

/** Incense smoke: a few soft puffs rising and drifting. */
const Smoke: React.FC<{p: V3; t: number}> = ({p, t}) => {
  const mat = useMemo(() => new THREE.SpriteMaterial({map: fogPuffTexture(), transparent: true, depthWrite: false, opacity: 0.35, color: '#9aa8b0'}), []);
  return (
    <>
      {Array.from({length: 6}, (_, i) => {
        const ph = (t * 0.25 + i / 6) % 1;
        return <sprite key={i} material={mat} position={[p[0] + Math.sin(ph * 6 + i) * 0.05, p[1] + ph * 0.9, p[2]]} scale={[0.25 + ph * 0.5, 0.2 + ph * 0.3, 1]} />;
      })}
    </>
  );
};

/** Glowing outline material for the X-ray body. */
const xrayMaterial = (color: string, strength: number) =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    uniforms: {uColor: {value: new THREE.Color(color)}, uStrength: {value: strength}},
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uStrength; varying vec3 vN; varying vec3 vV;
      void main(){
        float l = length(vN); vec3 n = l > 1e-5 ? vN / l : vec3(0.0, 0.0, 1.0);
        float rim = pow(1.0 - clamp(abs(dot(n, normalize(vV))), 0.0, 1.0), 2.2);
        gl_FragColor = vec4(uColor * uStrength * (0.06 + rim), 1.0);
      }`,
  });

/** A human body seen like an X-ray: glowing outline, organs inside that can go dark. */
const Xray: React.FC<{t: number; shot: ShotId}> = ({t, shot}) => {
  const body = useRef<THREE.Group>(null);
  const glow = useMemo(() => xrayMaterial('#5fd6e0', 1.3), []);
  useLayoutEffect(() => {
    body.current?.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.material = glow;
        mesh.castShadow = false;
      }
    });
  });
  const organ = (color: string, k: number) => m(`organ-${color}-${k.toFixed(2)}`, () => new THREE.MeshBasicMaterial({color: new THREE.Color(color).multiplyScalar(k), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false}));
  // xray2: the organs go dark one after another while the body folds over
  const fade = (i: number) => (shot === 'xray2' ? 1 - easeInOut(clamp((t - cue.slowly - 0.6 - i * 1.1) / 1.0)) : 1);
  const hollow = shot === 'xray2' ? easeInOut(clamp((t - cue.slowly) / 5)) : 0;
  // xray1: something dark crawls up into the chest
  const crawl = shot === 'xray1' ? easeOut(clamp((t - cue.crawls + 0.6) / 2.2)) : 0;
  const organs: {p: V3; s: V3; c: string}[] = [
    {p: [0.03, 1.33, 0.03], s: [0.045, 0.055, 0.04], c: '#ff6a3a'}, // heart
    {p: [-0.06, 1.38, 0.0], s: [0.06, 0.1, 0.05], c: '#ff9a6a'}, // lungs
    {p: [0.07, 1.38, 0.0], s: [0.06, 0.1, 0.05], c: '#ff9a6a'},
    {p: [0.05, 1.15, 0.03], s: [0.07, 0.05, 0.045], c: '#ffb070'}, // stomach
    {p: [-0.05, 1.18, 0.02], s: [0.08, 0.04, 0.05], c: '#e88a50'}, // liver
    {p: [0.0, 1.03, 0.03], s: [0.1, 0.06, 0.05], c: '#ff8a5a'}, // intestines
  ];
  return (
    <group position={[0, 0, 0]}>
      <group ref={body}>
        <Human face="neutral" hunch={0.35 * hollow} armL={-0.5 * hollow} armR={-0.6 * hollow} elbowL={-1.2 * hollow} elbowR={-1.3 * hollow} headPitch={0.4 * hollow} breathe={t} />
      </group>
      <group position={[0, 0.93, 0]} rotation={[0.35 * hollow, 0, 0]}>
        <group position={[0, -0.93, 0]}>
          {organs.map((o, i) => (
            <mesh key={i} position={o.p} scale={o.s} material={organ(o.c, 0.55 * fade(i))}>
              <sphereGeometry args={[1, 20, 14]} />
            </mesh>
          ))}
          {crawl > 0 &&
            Array.from({length: 9}, (_, i) => {
              const u = clamp(crawl * 1.2 - i * 0.04);
              const y = lerp(0.2, 1.3, u);
              return (
                <mesh key={i} position={[Math.sin(u * 9 + i) * 0.04, y - i * 0.03, 0.02]} scale={0.03 - i * 0.002} material={plain('#020203', 1)}>
                  <sphereGeometry args={[1, 12, 8]} />
                </mesh>
              );
            })}
        </group>
      </group>
    </group>
  );
};

/** Ripple on the water in the cup. */
const waterMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: {uT: {value: 0}, uHit: {value: -10}},
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float uT, uHit; varying vec2 vUv;
      void main(){
        float r = length(vUv - 0.5) * 2.0;
        float age = uT - uHit;
        float wave = age > 0.0 ? sin((r - age * 0.6) * 60.0) * exp(-age * 1.5) * smoothstep(age * 0.6 + 0.05, age * 0.6 - 0.15, r) : 0.0;
        vec3 deep = vec3(0.02, 0.05, 0.07);
        vec3 c = deep + vec3(0.25, 0.4, 0.45) * max(wave, 0.0) + vec3(0.05, 0.09, 0.1) * (1.0 - r);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });

const Drop: React.FC<{t: number}> = ({t}) => {
  const water = useMemo(waterMaterial, []);
  const hitAt = cue.drop + 0.25;
  water.uniforms.uT.value = t;
  water.uniforms.uHit.value = hitAt;
  // the drop gathers on the lip above, falls slowly, and vanishes into the water
  const fall = easeInOut(clamp((t - (hitAt - 1.4)) / 1.4));
  const y = lerp(0.66, 0.29, fall * fall);
  const stretch = 1 + fall * 0.6;
  return (
    <group>
      <mesh position={[0, 0.15, 0]} material={m('cup', () => new THREE.MeshStandardMaterial({color: '#b0b6ba', metalness: 0.9, roughness: 0.25, side: THREE.DoubleSide}))}>
        <cylinderGeometry args={[0.1, 0.085, 0.3, 48, 1, true]} />
      </mesh>
      <mesh position={[0, 0.29, 0]} rotation={[-Math.PI / 2, 0, 0]} material={water}>
        <circleGeometry args={[0.098, 48]} />
      </mesh>
      {t < hitAt && (
        <mesh position={[0, y, 0]} scale={[0.008, 0.008 * stretch, 0.008]} material={m('drop2', () => new THREE.MeshStandardMaterial({color: '#8fa8b2', roughness: 0.15, metalness: 0, transparent: true, opacity: 0.8}))}>
          <sphereGeometry args={[1, 20, 16]} />
        </mesh>
      )}
      {/* a pale chin and lips just above, out of focus at the top of frame */}
      <mesh position={[0, 0.78, -0.02]} scale={[0.11, 0.09, 0.1]} material={plain('#868780', 0.7)}>
        <sphereGeometry args={[1, 32, 20]} />
      </mesh>
      <mesh position={[0, 0.7, 0.06]} scale={[0.035, 0.008, 0.01]} material={plain('#3d3436', 0.5)}>
        <sphereGeometry args={[1, 16, 10]} />
      </mesh>
    </group>
  );
};

export const VoidSet: React.FC<{t: number; shot: ShotId}> = ({t, shot}) => {
  const flare = shot === 'sorcerer' ? clamp(1 - Math.abs(t - cue.backfires - 0.1) / 0.35) : 0;
  const out = shot === 'sorcerer' ? clamp((t - cue.backfires - 0.35) / 0.25) : 0;
  const candleLight = shot === 'shrine' || shot === 'sorcerer';
  return (
    <group position={VOID}>
      <color attach="background" args={['#020304']} />
      <fogExp2 attach="fog" args={['#020304', 0.12]} />
      <hemisphereLight args={['#14303a', '#000000', shot === 'drop' ? 0.25 : 0.15]} />

      {(shot === 'shrine' || shot === 'sorcerer') && (
        <group>
          <Box p={[0, 0.4, 0]} s={[0.9, 0.8, 0.5]} mat={plain('#3a2214', 0.8)} />
          {/* a small spirit house on a post, as found by Thai homes */}
          <group position={[0, 0.8, -0.1]} scale={0.09}>
            <StiltHouse p={[0, 0, 0]} w={3} d={2.4} lit={0} door={false} />
          </group>
          {[-0.32, -0.18, 0.18, 0.32, -0.25, 0.25].map((x, i) => (
            <Candle key={i} p={[x, 0.8, 0.12 - (i > 3 ? 0.12 : 0)]} t={t} h={0.12 + (i % 3) * 0.05} flare={flare} out={out} />
          ))}
          <Box p={[0, 0.83, 0.15]} s={[0.012, 0.06, 0.012]} mat={plain('#7a2a1e')} />
          {shot === 'shrine' && <Smoke p={[0, 0.9, 0.15]} t={t} />}
          {candleLight && <pointLight position={[0, 1.05, 0.3]} intensity={(0.9 + flare * 4) * (1 - out) + 0.05} distance={4} decay={1.6} color={flare > 0.3 ? '#9ff0e0' : '#ffb060'} castShadow />}
          {shot === 'sorcerer' && (
            // a robed figure behind the altar, hands raised over the flames, rim-lit so his whole shape reads
            <>
              <pointLight position={[0.0, 1.9, -1.4]} intensity={10} distance={3} decay={1.3} color="#5fb8c8" />
              <Human outfit="robe" face="neutral" position={[0, 0, -0.55]} armL={-1.6 + flare * -0.3} armR={-1.6 + flare * -0.3} outL={0.25} outR={0.25} elbowL={-0.4} elbowR={-0.4} headPitch={0.35} curl={0.2} breathe={t} />
            </>
          )}
        </group>
      )}
      {(shot === 'xray1' || shot === 'xray2') && (
        <>
          <Xray t={t} shot={shot} />
          {/* a faint grid behind, like a scan */}
          <mesh position={[0, 1.0, -0.6]} material={m('grid', () => new THREE.MeshBasicMaterial({color: '#0a2a30', wireframe: true, transparent: true, opacity: 0.35}))}>
            <planeGeometry args={[4, 4, 24, 24]} />
          </mesh>
        </>
      )}
      {shot === 'drop' && (
        <>
          <Drop t={t} />
          <pointLight position={[0.3, 0.75, 0.45]} intensity={6} distance={2.5} decay={1.4} color="#bfe3ff" />
          <pointLight position={[-0.4, 0.55, -0.3]} intensity={3} distance={2.5} decay={1.4} color="#ff9a48" />
        </>
      )}
    </group>
  );
};
