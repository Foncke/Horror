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
    uGrain: {value: 0},
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

/**
 * Painted look (used by Phi Pop only): a Kuwahara filter that flattens surfaces into brush-like patches,
 * soft ink lines on strong edges, and a teal-shadow / orange-highlight colour grade. No noise or grain.
 */
const PaintShader = {
  uniforms: {
    tDiffuse: {value: null},
    uRes: {value: new THREE.Vector2(1080, 1920)},
    uPaint: {value: 0},
    uInk: {value: 0.35},
    uGrade: {value: 0},
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uRes;
    uniform float uPaint, uInk, uGrade;
    varying vec2 vUv;
    const int R = 4;
    float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
    void main() {
      vec2 px = 1.0 / uRes;
      vec3 src = texture2D(tDiffuse, vUv).rgb;
      // Kuwahara: average of the least-varied of four quadrants
      vec3 m[4]; vec3 s[4];
      for (int k = 0; k < 4; k++) { m[k] = vec3(0.0); s[k] = vec3(0.0); }
      for (int j = -R; j <= R; j++) {
        for (int i = -R; i <= R; i++) {
          vec3 c = texture2D(tDiffuse, vUv + vec2(float(i), float(j)) * px * 2.6).rgb;
          vec3 c2 = c * c;
          if (i <= 0 && j <= 0) { m[0] += c; s[0] += c2; }
          if (i >= 0 && j <= 0) { m[1] += c; s[1] += c2; }
          if (i <= 0 && j >= 0) { m[2] += c; s[2] += c2; }
          if (i >= 0 && j >= 0) { m[3] += c; s[3] += c2; }
        }
      }
      float n = float((R + 1) * (R + 1));
      vec3 best = src; float minV = 1e9;
      for (int k = 0; k < 4; k++) {
        vec3 mean = m[k] / n;
        vec3 v = abs(s[k] / n - mean * mean);
        float vv = v.r + v.g + v.b;
        if (vv < minV) { minV = vv; best = mean; }
      }
      vec3 col = mix(src, best, uPaint);
      // soft ink on strong edges (Sobel on luminance)
      float tl = lum(texture2D(tDiffuse, vUv + px * vec2(-2.0, -2.0)).rgb), tr = lum(texture2D(tDiffuse, vUv + px * vec2(2.0, -2.0)).rgb);
      float bl = lum(texture2D(tDiffuse, vUv + px * vec2(-2.0, 2.0)).rgb), br = lum(texture2D(tDiffuse, vUv + px * vec2(2.0, 2.0)).rgb);
      float edge = length(vec2(tr + br - tl - bl, bl + br - tl - tr));
      col *= 1.0 - uInk * uPaint * smoothstep(0.08, 0.35, edge);
      // colour grade: teal shadows, warm highlights, a touch less saturation, more contrast
      float l = lum(col);
      vec3 graded = col;
      graded = mix(graded, vec3(l), 0.18);
      graded += mix(vec3(-0.02, 0.025, 0.05), vec3(0.06, 0.02, -0.04), smoothstep(0.15, 0.75, l));
      graded = (graded - 0.5) * 1.12 + 0.5;
      col = mix(col, graded, uGrade);
      gl_FragColor = vec4(max(col, 0.0), 1.0);
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
  /** painted look strength 0..1 (default off) */
  paint?: number;
  /** teal/orange colour grade 0..1 (default off) */
  grade?: number;
};

/** Takes over rendering: scene -> bloom -> tone mapping -> lens finish (grain, vignette, fades). */
export const Post: React.FC<FinishProps> = (p) => {
  const {gl, scene, camera, size} = useThree();

  const {composer, bloom, finish, paint} = useMemo(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    const c = new EffectComposer(gl);
    c.setPixelRatio(1);
    c.addPass(new RenderPass(scene, camera));
    const b = new UnrealBloomPass(new THREE.Vector2(size.width / 2, size.height / 2), 0.9, 0.6, 0.75);
    c.addPass(b);
    c.addPass(new OutputPass());
    const pt = new ShaderPass(PaintShader);
    pt.enabled = false;
    c.addPass(pt);
    const f = new ShaderPass(FinishShader);
    c.addPass(f);
    return {composer: c, bloom: b, finish: f, paint: pt};
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
  u.uGrain.value = p.grain ?? 0; // no film grain unless a video asks for it
  u.uVignette.value = p.vignette ?? 1;
  u.uTint.value.set(...(p.tint ?? [1, 1, 1]));
  u.uTintAmount.value = p.tintAmount ?? 0;
  u.uPeephole.value = p.peephole ? 1 : 0;
  paint.enabled = (p.paint ?? 0) > 0 || (p.grade ?? 0) > 0;
  paint.uniforms.uPaint.value = p.paint ?? 0;
  paint.uniforms.uGrade.value = p.grade ?? 0;
  paint.uniforms.uRes.value.set(size.width, size.height);

  useFrame(() => composer.render(), 1);
  return null;
};
