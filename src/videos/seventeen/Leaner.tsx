import React, {useEffect, useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {hash, lerp} from '../../lib/timeline';
import {faceTextureHi} from '../../three/textures';

/**
 * The thing behind the reflection: a tall shape in black with a long pale neck that bends down
 * over your shoulder, a narrow pale head, pitch-black eyes and a grin with far too many teeth.
 * Everything it draws lives on layer 1, so only cameras that enable layer 1 (the mirror, the phone) see it.
 */
type V3 = [number, number, number];
export const IT_BASE: V3 = [-0.2, 0, -0.42];
/** Head centre when it has leaned all the way in (beside his head, chin over his left collarbone). */
export const IT_HEAD: V3 = [-0.34, 1.31, -0.96];
const IT_HEAD_UP: V3 = [-0.22, 2.5, -0.5];

const HEAD_R = 0.165;
const HEAD_SCALE: V3 = [0.86, 1.24, 0.9];

const mats = {
  skin: new THREE.MeshStandardMaterial({color: '#b3aea5', roughness: 0.9}),
  body: new THREE.MeshStandardMaterial({color: '#09090b', roughness: 0.95}),
  void: new THREE.MeshBasicMaterial({color: '#000000'}),
  hood: new THREE.MeshStandardMaterial({color: '#0b0b0d', roughness: 1, side: THREE.DoubleSide}),
};
const geo = {
  head: new THREE.SphereGeometry(HEAD_R, 64, 48),
  face: new THREE.SphereGeometry(HEAD_R * 1.006, 64, 32, Math.PI / 2 - 1.25, 2.5, 0.2 * Math.PI, 0.62 * Math.PI),
  eye: new THREE.SphereGeometry(1, 24, 16),
  limb: new THREE.CapsuleGeometry(1, 1, 6, 14),
  ball: new THREE.SphereGeometry(1, 24, 16),
  // a black hood round the back and top of the head, open at the face
  hood: new THREE.SphereGeometry(HEAD_R * 1.16, 48, 32, Math.PI / 2 + 1.02, Math.PI * 2 - 2.04, 0, Math.PI * 0.8),
};

const faceMat = (kind: 'leaner' | 'leanerTeeth') =>
  new THREE.MeshStandardMaterial({map: faceTextureHi(kind), transparent: true, depthWrite: false, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2});

const mix = (a: V3, b: V3, u: number): V3 => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];

/** Put everything under this group on layer 1 only. */
export const Layer1: React.FC<{children: React.ReactNode}> = ({children}) => {
  const ref = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    ref.current?.traverse((o) => o.layers.set(1));
  });
  return <group ref={ref}>{children}</group>;
};

export const Leaner: React.FC<{
  lean: number; // 0 standing straight up in the dark, 1 head down beside yours
  grin: number; // 0 closed, 1 open
  t: number;
  lookAt?: V3; // where its face points (defaults to straight into the mirror)
}> = ({lean, grin, t, lookAt}) => {
  // the head: down a long curve from above, ending beside his head
  const arc = Math.sin(Math.PI * lean) * 0.12;
  const head = mix(IT_HEAD_UP, IT_HEAD, lean);
  head[2] -= arc * 0.6;
  // small twitches once it has arrived (held for 5 frames each, never single-frame blips)
  const step = Math.floor(t * 12);
  const tw = lean > 0.95 ? (hash(step * 1.7) > 0.86 ? (hash(step) - 0.5) * 0.16 : 0) : 0;

  const shoulder: V3 = [IT_BASE[0], 2.0 - 0.05 * lean, IT_BASE[2] - 0.08 * lean];
  const back: V3 = [head[0] + 0.01, head[1] + 0.1, head[2] + 0.11]; // where the neck meets the back of the skull

  const neck = useMemo(() => {
    const p1: V3 = mix([shoulder[0], 2.2, shoulder[2] - 0.02], [shoulder[0] - 0.04, 2.32, shoulder[2] - 0.2], lean);
    const p2: V3 = mix([shoulder[0] - 0.01, 2.34, shoulder[2] - 0.05], [back[0] + 0.02, 1.98, back[2] + 0.1], lean);
    const curve = new THREE.CatmullRomCurve3([shoulder, p1, p2, back].map((p) => new THREE.Vector3(...p)), false, 'centripetal');
    return new THREE.TubeGeometry(curve, 64, 0.075, 16, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lean, head[0], head[1], head[2]]);
  useEffect(() => () => neck.dispose(), [neck]);

  const facing = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(...head);
    const target = lookAt ?? [head[0] + 0.05, head[1] + 0.03, head[2] - 1];
    o.lookAt(...target);
    o.rotateZ(0.22 + tw); // head cocked toward his
    o.rotateX(-0.06);
    return o.quaternion.clone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [head[0], head[1], head[2], lookAt?.[0], lookAt?.[1], lookAt?.[2], tw]);

  const closed = useMemo(() => faceMat('leaner'), []);
  const open = useMemo(() => faceMat('leanerTeeth'), []);
  closed.opacity = 1 - grin;
  open.opacity = grin;

  return (
    <Layer1>
      {/* legs and body: a thin column of black */}
      <group position={IT_BASE}>
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={geo.limb} material={mats.body} position={[s * 0.08, 0.55, 0]} scale={[0.05, 0.5, 0.05]} castShadow />
        ))}
        <group position={[0, 1.08, 0]} rotation={[-0.12 * lean, 0, 0]}>
          <mesh geometry={geo.limb} material={mats.body} position={[0, 0.45, 0]} scale={[0.15, 0.36, 0.1]} castShadow />
          {/* long arms hanging past the knees */}
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.17, 0.88, 0]} rotation={[-0.15 * lean, 0, s * 0.06]}>
              <mesh geometry={geo.limb} material={mats.body} position={[0, -0.5, 0]} scale={[0.032, 0.48, 0.032]} castShadow />
              <mesh geometry={geo.limb} material={mats.skin} position={[0, -1.08, 0]} scale={[0.026, 0.08, 0.018]} />
            </group>
          ))}
        </group>
      </group>
      {/* the neck: pale, too long, bending forward and down */}
      <mesh geometry={neck} material={mats.body} castShadow />
      <mesh geometry={geo.ball} material={mats.body} position={shoulder} scale={[0.2, 0.1, 0.13]} />
      {/* the head */}
      <group position={head} quaternion={facing}>
        <group scale={HEAD_SCALE}>
          <mesh geometry={geo.head} material={mats.skin} castShadow />
          <mesh geometry={geo.hood} material={mats.hood} position={[0, 0.012, -0.01]} />
          <mesh geometry={geo.face} material={closed} visible={grin < 0.999} />
          <mesh geometry={geo.face} material={open} visible={grin > 0.001} />
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={geo.eye} material={mats.void} position={[s * 0.05, 0.004, 0.157]} rotation={[0, s * 0.32, s * 0.42]} scale={[0.022, 0.044, 0.018]} />
          ))}
        </group>
      </group>
    </Layer1>
  );
};
