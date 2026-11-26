import React, {useMemo} from 'react';
import * as THREE from 'three';
import {Box, Door, Spot, WallWithDoors, glow, std, wood, woodTrim} from '../../three/Common';
import {Character} from '../../three/Character';
import {FaceKind, drawCard, wallpaperTexture} from '../../three/textures';
import {clamp, easeInOut, smooth} from '../../lib/timeline';
import {ShotId, cue} from './cues';

const W = 4.2; // x: -2.1..2.1
const D = 5; // z: -2.5..2.5
const H = 2.7;
const ENTRY_X = -0.62; // door A (to the hallway)
const BATH_X = 0.68; // door B (bathroom)

const RULE = 'If someone knocks after midnight, do not answer. We do not have night staff.';

/** How much of the rule has been typed, following the narrator word by word. */
const ruleChars = (t: number) => {
  const words = RULE.split(' ');
  const spoken = cue.ruleWords;
  let chars = 0;
  for (let i = 0; i < words.length && i < spoken.length; i++) {
    const w = spoken[i];
    const len = words[i].length + 1;
    if (t >= w.end) chars += len;
    else if (t > w.start) chars += len * clamp((t - w.start) / Math.max(0.12, w.end - w.start));
    else break;
  }
  return chars;
};

/** Light leaking under the entry door, with shadows of feet that can step into it. */
const underDoorMaterial = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {uLight: {value: 1}, uFeet: {value: 0}, uTime: {value: 0}, uSpill: {value: 0}},
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uLight, uFeet, uTime, uSpill; varying vec2 vUv;
      void main(){
        float x = vUv.x;
        float edge = smoothstep(0.0, 0.06, x) * smoothstep(1.0, 0.94, x);
        float a1 = (x - 0.36) / 0.09; float a2 = (x - 0.64) / 0.09;
        float foot1 = exp(-a1 * a1);
        float foot2 = exp(-a2 * a2);
        float shadow = 1.0 - uFeet * 0.97 * clamp(foot1 + foot2, 0.0, 1.0);
        float d = uSpill > 0.5 ? vUv.y : 0.0;
        float sx = (x - 0.5) / 0.38; float side = uSpill > 0.5 ? exp(-sx * sx * sx * sx) : 1.0;
        float fall = uSpill > 0.5 ? exp(-d * 6.0) * 0.45 * side : 1.0;
        vec3 col = vec3(1.0, 0.72, 0.42) * 2.0 * uLight * shadow * edge * fall;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });

export const Room: React.FC<{t: number; shot: ShotId}> = ({t, shot}) => {
  const paper = wallpaperTexture();
  const wallMat = std('#8a7f70', 0.9, 0, {map: paper});

  // card texture, redrawn as the rule is typed
  const card = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 640;
    c.height = 880;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return {canvas: c, tex, last: -1};
  }, []);
  const chars = shot === 'pillow' ? 0 : t < cue.ruleWords[0].start ? 0 : ruleChars(t) + (t > cue.ruleWords[cue.ruleWords.length - 1].end ? 999 : 0);
  const blink = Math.floor(t * 2.2) % 2;
  const stamp = Math.floor(chars) * 2 + blink;
  if (stamp !== card.last) {
    drawCard(card.canvas.getContext('2d')!, card.canvas.width, card.canvas.height, chars >= RULE.length ? RULE.length : chars + (blink ? 0 : 0.0001));
    card.tex.needsUpdate = true;
    card.last = stamp;
  }

  const under = useMemo(underDoorMaterial, []);
  const spill = useMemo(() => {
    const m = underDoorMaterial();
    m.uniforms.uSpill.value = 1;
    return m;
  }, []);
  // under the door: footsteps arrive for "room service", later the light dies and two shadows return
  let feet = 0;
  let light = 1;
  if (shot === 'under1' || shot === 'knock') feet = shot === 'under1' ? 1 : 0;
  if (shot === 'under2') {
    light = 1 - 0.85 * smooth((t - cue.dark) / 0.5) + 0.85 * smooth((t - cue.two + 0.1) / 0.35);
    feet = smooth((t - cue.two + 0.1) / 0.35);
  }
  if (shot === 'choice') feet = 1;
  for (const m of [under, spill]) {
    m.uniforms.uLight.value = light;
    m.uniforms.uFeet.value = feet;
    m.uniforms.uTime.value = t;
  }

  // door rattle on each knock
  let rattle = 0;
  for (const k of cue.knocks1) {
    const d = t - (k - 0.04);
    if (d >= 0 && d < 0.3) rattle += Math.sin(d * 120) * Math.exp(-d * 18) * 0.006;
  }

  // you
  let face: FaceKind = 'calm';
  let yawToDoor = 0;
  if (shot === 'laugh') face = 'laugh';
  if (shot === 'worried') {
    face = 'worried';
    yawToDoor = -0.45;
  }
  if (shot === 'scared') {
    face = 'scared';
    yawToDoor = 0.25;
  }
  const laughBob = shot === 'laugh' ? Math.abs(Math.sin(t * 9)) * 0.05 * (1 - clamp((t - (cue.knocks1[0] - 1.2)) / 0.5)) : 0;
  const standing = shot === 'choice';
  const showYou = shot === 'laugh' || shot === 'knock' || shot === 'worried' || shot === 'scared' || shot === 'choice';

  const lampOn = 1;

  return (
    <group>
      <color attach="background" args={['#030304']} />
      <fogExp2 attach="fog" args={['#040405', 0.06]} />
      <hemisphereLight args={['#3a4560', '#140e0a', 0.55]} />
      {/* dim ceiling light so the room reads in the dark */}
      <pointLight position={[0.1, 2.45, 0.9]} intensity={7} distance={7} decay={1.5} color="#ffcf9e" />
      {/* key light on your face for the close-ups */}
      {showYou && <Spot position={[-0.5, 1.9, 0.9]} target={standing ? [0.05, 1.4, 0.7] : [0.4, 1.35, -0.42]} angle={0.35} penumbra={1} intensity={standing ? 2 : 2.2} color="#ffd6ad" distance={4} />}

      {/* shell */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={std('#2a2420', 1)}>
        <planeGeometry args={[W, D]} />
      </mesh>
      <mesh position={[0, H, 0]} rotation={[Math.PI / 2, 0, 0]} material={std('#1a1918', 1)}>
        <planeGeometry args={[W, D]} />
      </mesh>
      <mesh position={[0, H / 2, -D / 2]} receiveShadow material={wallMat}>
        <planeGeometry args={[W, H]} />
      </mesh>
      <mesh position={[-W / 2, H / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow material={wallMat}>
        <planeGeometry args={[D, H]} />
      </mesh>
      <mesh position={[W / 2, H / 2, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow material={wallMat}>
        <planeGeometry args={[D, H]} />
      </mesh>

      {/* front wall with both doors; rotated so local +z faces into the room (local x = -world x) */}
      <group position={[0, 0, D / 2]} rotation={[0, Math.PI, 0]}>
        <WallWithDoors length={W} height={H} doors={[{x: -ENTRY_X, width: 0.9}, {x: -BATH_X, width: 0.85}]} material={wallMat} base={std('#1c1611', 0.6)} />
        {/* A: the door to the hallway */}
        <Door x={-ENTRY_X} width={0.9} interior="dark" shake={rattle} />
        <mesh position={[-ENTRY_X, 0.012, 0.006]} material={under}>
          <planeGeometry args={[0.9, 0.024]} />
        </mesh>
        <mesh position={[-ENTRY_X, 0.003, 0.4]} rotation={[-Math.PI / 2, 0, Math.PI]} material={spill}>
          <planeGeometry args={[1.1, 0.8]} />
        </mesh>
        {/* B: the bathroom, left ajar */}
        <Door x={-BATH_X} width={0.85} open={0.5}>
          {/* something pale in the dark, only ever half seen */}
          <group position={[0.3, 0, -1.25]} rotation={[0, -0.3, 0]}>
            <Character outfit="guest" face="calm" breathe={t} shadows={false} />
          </group>
        </Door>
      </group>

      {/* bed */}
      <Box size={[1.75, 0.36, 2.15]} position={[0.4, 0.18, -1.45]} material={wood()} />
      <Box size={[1.62, 0.22, 2.0]} position={[0.4, 0.47, -1.45]} material={std('#d8d2c4', 0.9)} />
      <Box size={[1.66, 0.07, 1.35]} position={[0.4, 0.6, -1.0]} material={std('#7d2a2a', 0.95)} />
      <Box size={[1.9, 1.25, 0.1]} position={[0.4, 0.62, -2.45]} material={std('#3b2a22', 0.85)} />
      {[0.02, 0.78].map((x) => (
        <mesh key={x} position={[x, 0.66, -2.12]} rotation={[0.25, 0, 0]} scale={[0.33, 0.07, 0.18]} material={std('#ece6da', 0.95)} castShadow receiveShadow>
          <sphereGeometry args={[1, 32, 16]} />
        </mesh>
      ))}
      {/* the card */}
      <mesh position={[0.4, 0.765, -2.05]} rotation={[-Math.PI / 2 + 0.26, 0, 0.05]} castShadow>
        <planeGeometry args={[0.16, 0.22]} />
        <meshStandardMaterial map={card.tex} roughness={0.85} />
      </mesh>

      {/* nightstand + lamp */}
      <Box size={[0.5, 0.56, 0.42]} position={[-0.85, 0.28, -2.2]} material={woodTrim()} />
      <mesh position={[-0.85, 0.66, -2.2]} material={std('#6a5a40', 0.4, 0.6)}>
        <cylinderGeometry args={[0.05, 0.07, 0.2, 20]} />
      </mesh>
      <mesh position={[-0.85, 0.86, -2.2]} material={glow('#ffd2a0', 1.5 * lampOn)}>
        <cylinderGeometry args={[0.1, 0.16, 0.22, 28, 1, true]} />
      </mesh>
      <Spot position={[-0.85, 1.15, -2.1]} target={[0.4, 0.4, -0.6]} angle={1.15} penumbra={1} intensity={7 * lampOn} color="#ffbf80" distance={7} decay={1.7} shadow />
      <pointLight position={[-0.85, 0.9, -2.0]} intensity={1.2 * lampOn} distance={3} decay={2} color="#ffb070" />

      {/* curtained window on the right wall, a cold line of moonlight between the curtains */}
      <group position={[W / 2 - 0.05, 1.45, -0.6]} rotation={[0, -Math.PI / 2, 0]}>
        <Box size={[0.8, 2.3, 0.08]} position={[-0.42, 0, 0]} material={std('#4a1c22', 1)} />
        <Box size={[0.8, 2.3, 0.08]} position={[0.42, 0, 0]} material={std('#4a1c22', 1)} />
        <mesh position={[0, 0, -0.02]} material={glow('#7f9cd6', 1.4)}>
          <planeGeometry args={[0.06, 2.2]} />
        </mesh>
      </group>
      <Spot position={[1.9, 1.6, -0.6]} target={[-0.5, 0.3, 0.2]} angle={0.5} penumbra={1} intensity={2.5} color="#7f9cd6" distance={6} />

      {/* you */}
      {showYou && <Character
        outfit="you"
        face={face}
        sit={!standing}
        position={standing ? [0.05, 0, 0.7] : [0.4, laughBob, -0.42]}
        rotationY={0}
        headYaw={yawToDoor}
        headPitch={shot === 'laugh' ? -0.12 : 0}
        armL={standing ? 0 : -0.55}
        armR={standing ? 0 : -0.55}
        breathe={t * (shot === 'scared' ? 2.2 : 1)}
      />}
    </group>
  );
};
