import React, {useMemo} from 'react';
import * as THREE from 'three';
import {Box, Sconce, Spot, brass, glow, std, wood, woodTrim} from '../../three/Common';
import {Character} from '../../three/Character';
import {canvasTexture, plateTexture} from '../../three/textures';
import {clamp, easeInOut} from '../../lib/timeline';
import {cue} from './cues';

const rainMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: {uTime: {value: 0}},
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uTime; varying vec2 vUv;
      float h(float n){ return fract(sin(n*91.7)*43758.5453); }
      void main(){
        vec3 sky = mix(vec3(0.02,0.035,0.07), vec3(0.09,0.13,0.22), vUv.y);
        float streaks = 0.0;
        for (int i = 0; i < 3; i++) {
          float fi = float(i);
          float cols = 60.0 + fi * 25.0;
          float col = floor(vUv.x * cols);
          float speed = 0.6 + h(col + fi * 13.0) * 0.9;
          float y = fract(vUv.y * (1.5 + fi) + uTime * speed + h(col * 3.1 + fi));
          float line = smoothstep(0.08, 0.0, abs(fract(vUv.x * cols) - 0.5)) * smoothstep(0.0, 0.25, y) * smoothstep(0.35, 0.25, y);
          streaks += line * (0.35 - fi * 0.08);
        }
        // a distant street lamp blurred through the wet glass
        float lamp = exp(-pow(length((vUv - vec2(0.7, 0.62)) * vec2(1.0, 0.6)) * 4.0, 2.0)) * 0.5;
        vec3 col = sky + vec3(0.55,0.65,0.8) * streaks * 0.5 + vec3(1.0,0.7,0.4) * lamp;
        gl_FragColor = vec4(col * 1.4, 1.0);
      }`,
  });

const clockTexture = () =>
  canvasTexture('clock', 512, 512, (ctx, w) => {
    const r = w / 2;
    ctx.fillStyle = '#e8e0cc';
    ctx.beginPath();
    ctx.arc(r, r, r - 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2b2015';
    ctx.lineWidth = 16;
    ctx.stroke();
    ctx.fillStyle = '#2b2015';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.fillRect(r + Math.sin(a) * (r - 60) - 6, r - Math.cos(a) * (r - 60) - 20, 12, 40);
    }
    ctx.lineCap = 'round';
    ctx.lineWidth = 18;
    ctx.beginPath(); // hour hand on 3
    ctx.moveTo(r, r);
    ctx.lineTo(r + r * 0.48, r);
    ctx.stroke();
    ctx.lineWidth = 11;
    ctx.beginPath(); // minute hand on 12
    ctx.moveTo(r, r);
    ctx.lineTo(r, r - r * 0.72);
    ctx.stroke();
  });

const Key: React.FC<{position: [number, number, number]; rotationY: number}> = ({position, rotationY}) => {
  const tag = plateTexture('414');
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} material={brass()} castShadow>
        <torusGeometry args={[0.018, 0.004, 12, 32]} />
      </mesh>
      <Box size={[0.008, 0.006, 0.07]} position={[0, 0, -0.05]} material={brass()} />
      <Box size={[0.014, 0.006, 0.008]} position={[0.008, 0, -0.075]} material={brass()} />
      <Box size={[0.012, 0.006, 0.008]} position={[0.007, 0, -0.06]} material={brass()} />
      {/* diamond tag on a short ring */}
      <group position={[0, 0.001, 0.06]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh material={std('#7a1a1f', 0.5)} castShadow>
          <boxGeometry args={[0.07, 0.045, 0.006]} />
        </mesh>
        <mesh position={[0, 0, 0.0035]}>
          <planeGeometry args={[0.058, 0.03]} />
          <meshStandardMaterial map={tag} metalness={0.7} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
};

export const Lobby: React.FC<{t: number}> = ({t}) => {
  const rain = useMemo(rainMaterial, []);
  rain.uniforms.uTime.value = t;
  const slide = easeInOut(clamp((t - cue.keySlide - 0.1) / 0.9));

  return (
    <group>
      <color attach="background" args={['#050506']} />
      <fogExp2 attach="fog" args={['#060608', 0.05]} />
      <hemisphereLight args={['#4a5670', '#1a120c', 0.9]} />

      {/* room */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={std('#17120e', 0.28, 0.1)}>
        <planeGeometry args={[12, 16]} />
      </mesh>
      <mesh position={[0, 3.4, 0]} rotation={[Math.PI / 2, 0, 0]} material={std('#121112', 1)}>
        <planeGeometry args={[12, 16]} />
      </mesh>
      <mesh position={[0, 1.7, -5]} receiveShadow material={std('#2c2620', 0.9)}>
        <planeGeometry args={[12, 3.4]} />
      </mesh>
      <mesh position={[4, 1.7, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow material={std('#2a241e', 0.9)}>
        <planeGeometry args={[16, 3.4]} />
      </mesh>
      <mesh position={[-4, 1.7, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow material={std('#2a241e', 0.9)}>
        <planeGeometry args={[16, 3.4]} />
      </mesh>

      {/* tall rainy windows on the left wall */}
      {[-1.2, 2.2].map((z) => (
        <group key={z} position={[-3.97, 1.65, z]} rotation={[0, Math.PI / 2, 0]}>
          <mesh material={rain}>
            <planeGeometry args={[1.4, 2.4]} />
          </mesh>
          <Box size={[1.55, 0.08, 0.06]} position={[0, 1.24, 0.02]} material={woodTrim()} />
          <Box size={[1.55, 0.08, 0.06]} position={[0, -1.24, 0.02]} material={woodTrim()} />
          <Box size={[0.06, 2.5, 0.05]} position={[0, 0, 0.02]} material={woodTrim()} />
          <Box size={[1.4, 0.05, 0.05]} position={[0, 0.3, 0.02]} material={woodTrim()} />
        </group>
      ))}
      <Spot position={[-3.6, 2.6, 0.5]} target={[0, 0.5, -1.5]} angle={0.9} penumbra={1} intensity={6} color="#6f86b8" distance={12} decay={1.6} />

      {/* key cubbies behind the desk, one slot empty */}
      <group position={[0, 1.55, -4.92]}>
        <Box size={[2.6, 1.6, 0.06]} position={[0, 0, 0]} material={wood()} />
        {Array.from({length: 40}).map((_, i) => {
          const col = i % 8;
          const row = Math.floor(i / 8);
          const x = (col - 3.5) * 0.3;
          const y = (row - 2) * 0.29;
          return (
            <group key={i} position={[x, y, 0.05]}>
              <Box size={[0.28, 0.27, 0.05]} material={woodTrim()} cast={false} />
              {i !== 21 && <Box size={[0.015, 0.09, 0.012]} position={[0, -0.03, 0.035]} material={brass()} cast={false} />}
            </group>
          );
        })}
      </group>
      <mesh position={[0, 2.75, -4.9]}>
        <circleGeometry args={[0.24, 48]} />
        <meshStandardMaterial map={clockTexture()} roughness={0.6} />
      </mesh>

      {/* the front desk */}
      <Box size={[3.4, 1.05, 0.12]} position={[0, 0.525, -2.72]} material={woodTrim()} />
      <Box size={[3.6, 0.06, 0.85]} position={[0, 1.08, -3.05]} material={std('#3a2216', 0.28)} />
      <Box size={[3.4, 0.9, 0.08]} position={[0, 0.45, -3.4]} material={wood()} />
      {/* desk lamp */}
      <group position={[1.05, 1.11, -3.15]}>
        <Box size={[0.16, 0.02, 0.12]} material={brass()} />
        <Box size={[0.02, 0.3, 0.02]} position={[0, 0.15, 0]} material={brass()} />
        <mesh position={[0, 0.32, 0.03]} rotation={[0, 0, Math.PI / 2]} material={std('#8a6a3a', 0.35, 0.8)}>
          <cylinderGeometry args={[0.06, 0.06, 0.32, 24, 1, false, 0, Math.PI]} />
        </mesh>
        <mesh position={[0, 0.3, 0.03]} material={glow('#ffd9a0', 5)}>
          <sphereGeometry args={[0.025, 12, 8]} />
        </mesh>
      </group>
      <Spot position={[1.05, 1.42, -3.0]} target={[0.3, 1.08, -2.75]} angle={0.75} penumbra={0.9} intensity={7} color="#ffcf98" distance={5} decay={1.8} shadow />
      {/* cold rim light from the windows so the clerk reads as a silhouette */}
      <Spot position={[-2.5, 2.4, -2.6]} target={[0, 1.4, -3.6]} angle={0.5} penumbra={1} intensity={5} color="#7d95c8" distance={6} />
      <pointLight position={[0.3, 1.9, -2.2]} intensity={3} color="#ffb98a" distance={5} decay={2} />
      {/* two dim wall lamps either side of the cubbies */}
      {[-2.0, 2.0].map((x) => (
        <group key={x}>
          <Sconce position={[x, 2.1, -4.98]} intensity={0.9} />
          <pointLight position={[x, 2.1, -4.6]} intensity={3.5} color="#ffbf85" distance={5} decay={1.8} />
        </group>
      ))}
      {/* bell */}
      <mesh position={[-0.7, 1.11, -2.85]} material={brass()} castShadow>
        <sphereGeometry args={[0.055, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      {/* the clerk: head down, never looks up */}
      <Character
        outfit="clerk"
        face="blank"
        position={[0, 0, -3.62]}
        headPitch={0.62 + Math.sin(t * 0.6) * 0.015}
        armR={-0.95 + Math.sin(t * 5) * 0.04}
        armL={-0.8}
        hunch={0.12}
        breathe={t}
      />
      <Key position={[0.02 + slide * 0.1, 1.115, -3.0 + slide * 0.3]} rotationY={0.4 - slide * 0.25} />
    </group>
  );
};
