import {useThree} from '@react-three/fiber';
import React, {useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {plateTexture} from './textures';

const mats = new Map<string, THREE.Material>();
export const std = (color: string, rough = 0.8, metal = 0, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
  const key = `${color}-${rough}-${metal}-${JSON.stringify(extra)}`;
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({color, roughness: rough, metalness: metal, ...extra}));
  return mats.get(key) as THREE.MeshStandardMaterial;
};
export const glow = (color: string, intensity: number) => std(color, 1, 0, {emissive: new THREE.Color(color), emissiveIntensity: intensity});
export const brass = () => std('#c79a4e', 0.32, 1);
export const wood = () => std('#2a1a12', 0.55);
export const woodTrim = () => std('#3b261a', 0.5);

export const Box: React.FC<{size: [number, number, number]; position?: [number, number, number]; rotation?: [number, number, number]; material: THREE.Material; cast?: boolean; receive?: boolean}> = ({size, position, rotation, material, cast = true, receive = true}) => (
  <mesh position={position} rotation={rotation} material={material} castShadow={cast} receiveShadow={receive}>
    <boxGeometry args={size} />
  </mesh>
);

export type DoorProps = {
  x: number; // centre along the wall (local x)
  number?: string;
  open?: number; // radians, swings inward (away from viewer)
  width?: number;
  height?: number;
  interior?: 'dark' | 'warm';
  interiorGlow?: number;
  shake?: number; // knock rattle offset
  children?: React.ReactNode; // things placed inside the doorway (local coords, -z is inside)
};

/** A hotel door facing local +z, set into a wall at z = 0. */
export const Door: React.FC<DoorProps> = ({x, number, open = 0, width = 0.95, height = 2.15, interior = 'dark', interiorGlow = 1, shake = 0, children}) => {
  const plate = number ? plateTexture(number) : null;
  // only the inner faces, so whoever stands inside the doorway can be seen
  const inside = interior === 'warm' ? std('#f0a35c', 1, 0, {emissive: new THREE.Color('#f0a35c'), emissiveIntensity: 0.22 * interiorGlow, side: THREE.BackSide}) : std('#050506', 1, 0, {side: THREE.BackSide});
  return (
    <group position={[x, 0, 0]}>
      {/* casing */}
      <Box size={[0.09, height + 0.09, 0.07]} position={[-width / 2 - 0.045, (height + 0.09) / 2, 0.01]} material={woodTrim()} />
      <Box size={[0.09, height + 0.09, 0.07]} position={[width / 2 + 0.045, (height + 0.09) / 2, 0.01]} material={woodTrim()} />
      <Box size={[width + 0.18, 0.09, 0.07]} position={[0, height + 0.045, 0.01]} material={woodTrim()} />
      {/* the space behind the door */}
      <mesh position={[0, height / 2, -0.9]} material={inside}>
        <boxGeometry args={[width + 0.4, height + 0.2, 1.7]} />
      </mesh>
      {children}
      {/* leaf, hinged on the left */}
      <group position={[-width / 2, 0, -0.02 + shake]} rotation={[0, open, 0]}>
        <group position={[width / 2, 0, 0]}>
          <Box size={[width, height, 0.045]} position={[0, height / 2, 0]} material={wood()} />
          <Box size={[width * 0.7, height * 0.36, 0.012]} position={[0, height * 0.73, 0.027]} material={woodTrim()} />
          <Box size={[width * 0.7, height * 0.36, 0.012]} position={[0, height * 0.29, 0.027]} material={woodTrim()} />
          <mesh position={[width / 2 - 0.1, 1.0, 0.05]} material={brass()} castShadow>
            <sphereGeometry args={[0.032, 20, 14]} />
          </mesh>
          <mesh position={[0, 1.55, 0.026]} rotation={[Math.PI / 2, 0, 0]} material={brass()}>
            <cylinderGeometry args={[0.016, 0.016, 0.012, 20]} />
          </mesh>
          {plate && (
            <mesh position={[0, 1.78, 0.025]}>
              <planeGeometry args={[0.22, 0.11]} />
              <meshStandardMaterial map={plate} metalness={0.8} roughness={0.35} />
            </mesh>
          )}
        </group>
      </group>
    </group>
  );
};

/** Wall plane along local x (facing +z) with rectangular holes cut where doors go. */
export const WallWithDoors: React.FC<{length: number; height: number; doors: {x: number; width?: number; height?: number}[]; material: THREE.Material; base?: THREE.Material}> = ({length, height, doors, material, base}) => {
  const pieces = useMemo(() => {
    const out: {x: number; y: number; w: number; h: number}[] = [];
    const sorted = [...doors].sort((a, b) => a.x - b.x);
    let cursor = -length / 2;
    for (const d of sorted) {
      const w = (d.width ?? 0.95) + 0.18;
      const h = (d.height ?? 2.15) + 0.09;
      const left = d.x - w / 2;
      if (left > cursor) out.push({x: (cursor + left) / 2, y: height / 2, w: left - cursor, h: height});
      out.push({x: d.x, y: (h + height) / 2, w, h: height - h});
      cursor = d.x + w / 2;
    }
    if (cursor < length / 2) out.push({x: (cursor + length / 2) / 2, y: height / 2, w: length / 2 - cursor, h: height});
    return out;
  }, [doors, length, height]);
  return (
    <group>
      {pieces.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, 0]} material={material} receiveShadow>
          <planeGeometry args={[p.w, p.h]} />
        </mesh>
      ))}
      {base &&
        pieces
          .filter((p) => p.h === height)
          .map((p, i) => (
            <mesh key={`b${i}`} position={[p.x, 0.06, 0.006]} material={base}>
              <planeGeometry args={[p.w, 0.12]} />
            </mesh>
          ))}
    </group>
  );
};

/** Warm wall lamp: glowing shade (picked up by bloom) on a brass plate. */
export const Sconce: React.FC<{position: [number, number, number]; rotationY?: number; intensity?: number}> = ({position, rotationY = 0, intensity = 1}) => (
  <group position={position} rotation={[0, rotationY, 0]}>
    <Box size={[0.1, 0.22, 0.02]} position={[0, 0, 0.01]} material={brass()} cast={false} />
    <mesh position={[0, 0.03, 0.09]} material={glow('#ffc78a', 2.6 * intensity)}>
      <cylinderGeometry args={[0.06, 0.085, 0.16, 24, 1, true]} />
    </mesh>
    <mesh position={[0, 0.03, 0.09]} material={glow('#fff1d6', 4 * intensity)}>
      <sphereGeometry args={[0.03, 12, 8]} />
    </mesh>
  </group>
);

export type Cam = {pos: [number, number, number]; target: [number, number, number]; fov?: number; roll?: number};

/** Puts the scene camera where the current shot wants it (runs before R3F draws the frame). */
export const CameraRig: React.FC<{cam: Cam}> = ({cam}) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useLayoutEffect(() => {
    camera.position.set(...cam.pos);
    camera.up.set(Math.sin(cam.roll ?? 0), Math.cos(cam.roll ?? 0), 0);
    camera.lookAt(...cam.target);
    camera.fov = cam.fov ?? 40;
    camera.near = 0.02;
    camera.far = 80;
    camera.updateProjectionMatrix();
  });
  return null;
};

/** Project a world point to pixel coordinates for a given camera (for HTML callouts). */
export const project = (cam: Cam, point: [number, number, number], width: number, height: number) => {
  const c = new THREE.PerspectiveCamera(cam.fov ?? 40, width / height, 0.02, 80);
  c.position.set(...cam.pos);
  c.up.set(Math.sin(cam.roll ?? 0), Math.cos(cam.roll ?? 0), 0);
  c.lookAt(...cam.target);
  c.updateMatrixWorld();
  const v = new THREE.Vector3(...point).project(c);
  return {x: (v.x * 0.5 + 0.5) * width, y: (-v.y * 0.5 + 0.5) * height};
};

/** Spotlight whose target is part of the scene, so it really points where we aim it. */
export const Spot: React.FC<{
  position: [number, number, number];
  target: [number, number, number];
  color?: string;
  intensity?: number;
  angle?: number;
  penumbra?: number;
  distance?: number;
  decay?: number;
  shadow?: boolean;
}> = ({position, target, color = '#ffffff', intensity = 1, angle = 0.8, penumbra = 0.8, distance = 10, decay = 1.8, shadow = false}) => {
  const light = useMemo(() => {
    const l = new THREE.SpotLight();
    l.shadow.mapSize.set(1024, 1024);
    l.shadow.bias = -0.0004;
    l.shadow.radius = 4;
    return l;
  }, []);
  light.position.set(...position);
  light.target.position.set(...target);
  light.color.set(color);
  light.intensity = intensity;
  light.angle = angle;
  light.penumbra = penumbra;
  light.distance = distance;
  light.decay = decay;
  light.castShadow = shadow;
  return (
    <>
      <primitive object={light} />
      <primitive object={light.target} />
    </>
  );
};
