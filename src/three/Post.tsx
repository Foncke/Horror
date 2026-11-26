import {useFrame, useThree} from '@react-three/fiber';
import React, {useEffect, useMemo} from 'react';
import * as THREE from 'three';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {ShaderPass} from 'three/examples/jsm/postprocessing/ShaderPass.js';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

const FinishShader = {
  uniforms: {
    tDiffuse: {value: null},
    uTime: {value: 0},
    uGrain: {value: 0.07},
    uVignette: {value: 1.0},
    uFade: {value: 1.0},
    uTint: {value: new THREE.Vector3(1, 1, 1)},
    uTintAmount: {value: 0},
    uAberration: {value: 0.0015},
    uPeephole: {value: 0},
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uGrain, uVignette, uFade, uTintAmount, uAberration, uPeephole;
    uniform vec3 uTint;
    varying vec2 vUv;
    float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      // aspect-correct coordinates (frame is 9:16)
      vec2 ca = c * vec2(1.0, 16.0 / 9.0);
      if (uPeephole > 0.0) {
        // fisheye lens of a door viewer
        float r = length(ca);
        float k = 1.0 + 0.55 * r * r;
        uv = 0.5 + c / k;
        c = uv - 0.5;
      }
      vec2 dir = c * uAberration * 2.0;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + dir).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - dir).b;
      col = mix(col, col * uTint, uTintAmount);
      float v = smoothstep(1.05, 0.25, length(ca * vec2(1.0, 0.82)));
      col *= mix(1.0, v, uVignette);
      if (uPeephole > 0.0) {
        float r = length(ca);
        float lens = smoothstep(0.47, 0.44, r);
        float rim = smoothstep(0.40, 0.47, r) * lens;
        col *= lens * (1.0 - 0.6 * rim);
      }
      float g = rand(vUv * vec2(1080.0, 1920.0) + fract(uTime * 7.31) * 100.0) - 0.5;
      col += g * uGrain;
      gl_FragColor = vec4(col * uFade, 1.0);
    }
  `,
};

export type FinishProps = {
  time: number;
  fade?: number;
  grain?: number;
  vignette?: number;
  tint?: [number, number, number];
  tintAmount?: number;
  peephole?: boolean;
  bloomStrength?: number;
  bloomRadius?: number;
  bloomThreshold?: number;
  exposure?: number;
};

/** Takes over rendering: scene -> bloom -> tone mapping -> lens finish (grain, vignette, fades). */
export const Post: React.FC<FinishProps> = (p) => {
  const {gl, scene, camera, size} = useThree();

  const {composer, bloom, finish} = useMemo(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    const c = new EffectComposer(gl);
    c.setPixelRatio(1);
    c.addPass(new RenderPass(scene, camera));
    const b = new UnrealBloomPass(new THREE.Vector2(size.width / 2, size.height / 2), 0.9, 0.6, 0.75);
    c.addPass(b);
    c.addPass(new OutputPass());
    const f = new ShaderPass(FinishShader);
    c.addPass(f);
    return {composer: c, bloom: b, finish: f};
  }, [gl, scene, camera, size.width, size.height]);

  useEffect(() => {
    composer.setSize(size.width, size.height);
    return () => composer.dispose();
  }, [composer, size.width, size.height]);

  gl.toneMappingExposure = p.exposure ?? 1;
  bloom.strength = p.bloomStrength ?? 0.9;
  bloom.radius = p.bloomRadius ?? 0.6;
  bloom.threshold = p.bloomThreshold ?? 0.75;
  const u = finish.uniforms;
  u.uTime.value = p.time;
  u.uFade.value = p.fade ?? 1;
  u.uGrain.value = p.grain ?? 0.07;
  u.uVignette.value = p.vignette ?? 1;
  u.uTint.value.set(...(p.tint ?? [1, 1, 1]));
  u.uTintAmount.value = p.tintAmount ?? 0;
  u.uPeephole.value = p.peephole ? 1 : 0;

  useFrame(() => composer.render(), 1);
  return null;
};
