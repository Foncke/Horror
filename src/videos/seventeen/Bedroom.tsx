import React, {useMemo} from 'react';
import * as THREE from 'three';
import {Reflector} from 'three/examples/jsm/objects/Reflector.js';
import {Character} from '../../three/Character';
import {Box, Door, Spot, WallWithDoors, glow, std, woodTrim} from '../../three/Common';
import {FaceKind, noteTexture, phoneTexture} from '../../three/textures';
import {Layer1, Leaner} from './Leaner';
import {
  DOOR_X, HEAD, LAMP, MIRROR, MIRROR_Z, NOTE, PHONE, ROOM, SEAT, ShotId, cue, doorBlack, grinAt, isPresent, lampOn, leanAt,
  spinAt,
} from './cues';

const {W, D, H} = ROOM;
const DOOR_W = 0.9;
const DOOR_H = 2.1;

/** The mirror: a real reflection that also sees layer 1 (the thing behind you). */
const Mirror: React.FC = () => {
  const mirror = useMemo(() => {
    const r = new Reflector(new THREE.PlaneGeometry(MIRROR.w, MIRROR.h), {
      textureWidth: 1440,
      textureHeight: 2560,
      color: new THREE.Color('#6c6e72'),
      clipBias: 0.002,
      multisample: 4,
    });
    const get = r.getReflectionCamera;
    r.getReflectionCamera = (camera: THREE.Camera) => {
      const c = get.call(r, camera);
      c.layers.enable(0);
      c.layers.enable(1);
      return c;
    };
    return r;
  }, []);
  return <primitive object={mirror} position={[0, MIRROR.y, MIRROR_Z]} />;
};

/** Phone screen text for a moment of the film. */
const phoneScreen = (t: number, shot: ShotId) => {
  if (shot === 'timer' || t < cue.lastNight) {
    const left = Math.max(0, 17 - Math.max(0, t - cue.now));
    const s = Math.floor(left);
    const cs = Math.floor((left - s) * 100);
    return `00:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  }
  if (t < cue.flickered) return 'off';
  // flickers on in 5-frame steps, then stays on
  const k = Math.floor((t - cue.flickered) * 12);
  if (k < 6) return [1, 0, 1, 1, 0, 1][k] ? 'live' : 'off';
  return 'live';
};

export const Bedroom: React.FC<{t: number; shot: ShotId}> = ({t, shot}) => {
  const present = isPresent(shot);
  const lamp = lampOn(t, shot);
  const dark = !present && lamp === 0;
  const wall = std('#383c47', 0.95);

  // him
  let face: FaceKind = 'tired';
  if (present) face = 'stare';
  if (shot === 'laugh') face = 'smirk';
  if (shot === 'blackDoor' && t > cue.black - 0.6) face = 'stare';
  if (['hallway', 'twelve'].includes(shot)) face = 'stare';
  if (['lean', 'chin', 'teeth', 'spin'].includes(shot)) face = t > cue.leaned ? 'fear' : 'stare';
  const facing = shot === 'spin' || shot === 'empty' ? spinAt(t) : Math.PI;
  const shiver = ['chin', 'teeth'].includes(shot) ? Math.sin(t * 43) * 0.0025 : 0;
  const lookDown = shot === 'feed' || shot === 'phoneOn' ? 0.42 : present ? -0.02 : 0.02;
  const showHim = shot !== 'empty';

  // it
  const lean = leanAt(t, shot);
  const showIt = ['lean', 'chin', 'teeth', 'feed', 'behind'].includes(shot) && lean > 0;

  // the door: shut in the present (a line of light underneath), open onto the lit hallway last night
  const doorOpen = present ? 0 : 1.2;
  const noteThere = t < cue.scariest - 0.2;
  const screen = phoneScreen(t, shot);
  const screenOn = screen !== 'off';

  return (
    <group>
      <color attach="background" args={['#020203']} />
      <fogExp2 attach="fog" args={['#05060a', 0.06]} />
      <hemisphereLight args={['#3a4560', '#0c0a08', dark ? 0.45 : 0.6]} />

      {/* the lamp on the dresser */}
      <pointLight position={[LAMP[0], LAMP[1] + 0.3, LAMP[2] + 0.06]} intensity={(present ? 1.3 : 2.6) * lamp} distance={5} decay={1.6} color="#ffb070" castShadow={false} />
      {/* moonlight from the window on the right */}
      <Spot position={[W / 2 - 0.1, 1.95, -0.7]} target={[-0.4, 0.9, -1.2]} angle={0.75} penumbra={0.9} intensity={dark ? 12 : 4} color="#8ea6dc" distance={8} decay={1.3} shadow />
      {/* a soft cold key on his face (and whatever is beside it) when the lamp is off */}
      {!present && <Spot position={[0.55, 2.2, -1.95]} target={[-0.12, 1.32, -1.0]} angle={0.42} penumbra={1} intensity={dark ? 3.2 : 0.6} color="#a9b8e0" distance={4} decay={1.4} />}
      {/* the hallway light, spilling in through the open door */}
      {!present && (
        <>
          <pointLight position={[DOOR_X, 2.25, D / 2 + 0.7]} intensity={6} distance={4} decay={1.5} color="#ffc489" />
          <Spot position={[DOOR_X + 0.1, 2.0, D / 2 + 0.5]} target={[DOOR_X + 0.5, 0, 0.6]} angle={0.5} penumbra={0.7} intensity={9} color="#ffbe80" distance={6} decay={1.4} shadow />
        </>
      )}
      {/* in the present, a dim warm fill from the lamp side so his face reads */}
      {present && <Spot position={[-0.35, 1.6, -1.85]} target={HEAD} angle={0.5} penumbra={1} intensity={0.8} color="#ffbf8a" distance={3} decay={1.4} />}
      {/* the shut door, faintly lit by the lamp */}
      {present && <Spot position={[-0.1, 1.9, -1.4]} target={[DOOR_X, 1.0, D / 2]} angle={0.35} penumbra={1} intensity={2.6} color="#ffb97c" distance={6} decay={1.2} />}

      {/* shell */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={std('#2a2019', 0.7)}>
        <planeGeometry args={[W, D]} />
      </mesh>
      <mesh position={[0, 0.004, -0.4]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={std('#33363f', 1)}>
        <planeGeometry args={[2.0, 1.6]} />
      </mesh>
      <mesh position={[0, H, 0]} rotation={[Math.PI / 2, 0, 0]} material={std('#1c1e24', 1)}>
        <planeGeometry args={[W, D]} />
      </mesh>
      <mesh position={[0, H / 2, -D / 2]} receiveShadow material={wall}>
        <planeGeometry args={[W, H]} />
      </mesh>
      <mesh position={[-W / 2, H / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow material={wall}>
        <planeGeometry args={[D, H]} />
      </mesh>
      <mesh position={[W / 2, H / 2, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow material={wall}>
        <planeGeometry args={[D, H]} />
      </mesh>

      {/* the wall behind him, with the bedroom door (local +z faces into the room, local x = -world x) */}
      <group position={[0, 0, D / 2]} rotation={[0, Math.PI, 0]}>
        <WallWithDoors length={W} height={H} doors={[{x: -DOOR_X, width: DOOR_W, height: DOOR_H}]} material={wall} base={std('#17181c', 0.6)} />
        <Door x={-DOOR_X} width={DOOR_W} height={DOOR_H} open={doorOpen} paint="#8d7a66" interior={present ? 'dark' : 'warm'} interiorGlow={2.2}>
          {/* in the reflection only: the doorway fills with black */}
          {!present && doorBlack(t) > 0 && (
            <Layer1>
              <mesh position={[0, DOOR_H / 2, -0.06]} material={std('#000000', 1, 0, {transparent: true, opacity: doorBlack(t), depthWrite: false, emissive: new THREE.Color('#000')})} renderOrder={5}>
                <planeGeometry args={[DOOR_W + 0.02, DOOR_H + 0.02]} />
              </mesh>
            </Layer1>
          )}
          {present && (
            <mesh position={[0, 0.006, 0.0]} rotation={[-Math.PI / 2, 0, 0]} material={glow('#ffb36b', 1.6)}>
              <planeGeometry args={[DOOR_W - 0.04, 0.03]} />
            </mesh>
          )}
        </Door>
      </group>

      {/* window: cold glass between dark curtains */}
      <group position={[W / 2 - 0.02, 1.5, -0.7]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh position={[0, 0, -0.01]} material={glow('#5a70a8', 0.75)}>
          <planeGeometry args={[0.85, 1.15]} />
        </mesh>
        <Box size={[0.03, 1.15, 0.03]} position={[0, 0, 0]} material={std('#15161a', 0.8)} />
        <Box size={[0.85, 0.03, 0.03]} position={[0, 0.1, 0]} material={std('#15161a', 0.8)} />
        <Box size={[0.4, 2.0, 0.06]} position={[-0.58, -0.12, 0.06]} material={std('#1d2231', 1)} />
        <Box size={[0.4, 2.0, 0.06]} position={[0.58, -0.12, 0.06]} material={std('#1d2231', 1)} />
      </group>

      {/* bed along the right wall, headboard against the back wall */}
      <Box size={[1.3, 0.34, 1.95]} position={[W / 2 - 0.7, 0.17, D / 2 - 1.05]} material={woodTrim()} />
      <Box size={[1.22, 0.2, 1.86]} position={[W / 2 - 0.7, 0.44, D / 2 - 1.07]} material={std('#cfc9bc', 0.95)} />
      <Box size={[1.26, 0.08, 1.3]} position={[W / 2 - 0.7, 0.56, D / 2 - 1.35]} material={std('#2f3a4d', 1)} />
      <Box size={[1.38, 1.0, 0.08]} position={[W / 2 - 0.7, 0.5, D / 2 - 0.05]} material={std('#2a1d16', 0.7)} />
      <mesh position={[W / 2 - 0.7, 0.62, D / 2 - 0.32]} scale={[0.4, 0.08, 0.18]} material={std('#e4ded2', 0.95)} castShadow receiveShadow>
        <sphereGeometry args={[1, 32, 16]} />
      </mesh>

      {/* a tall wardrobe on the left wall */}
      <Box size={[0.6, 2.0, 1.1]} position={[-W / 2 + 0.3, 1.0, 0.2]} material={woodTrim()} />
      <Box size={[0.01, 1.9, 0.005]} position={[-W / 2 + 0.605, 1.0, 0.2]} material={std('#120c08', 0.6)} />

      {/* dresser against the mirror wall */}
      <Box size={[1.3, 0.9, 0.5]} position={[0, 0.45, -D / 2 + 0.25]} material={woodTrim()} />
      {[0.22, 0.55].map((y) => (
        <group key={y}>
          <Box size={[1.22, 0.28, 0.01]} position={[0, y, -D / 2 + 0.505]} material={std('#33221a', 0.55)} cast={false} />
          {[-0.32, 0.32].map((x) => (
            <mesh key={x} position={[x, y, -D / 2 + 0.52]} material={std('#9c8a6b', 0.35, 0.8)}>
              <sphereGeometry args={[0.016, 12, 8]} />
            </mesh>
          ))}
        </group>
      ))}

      {/* the mirror and its frame */}
      <Mirror />
      <Box size={[MIRROR.w + 0.08, 0.04, 0.03]} position={[0, MIRROR.y + MIRROR.h / 2 + 0.02, MIRROR_Z]} material={std('#1c130e', 0.5)} />
      <Box size={[MIRROR.w + 0.08, 0.04, 0.03]} position={[0, MIRROR.y - MIRROR.h / 2 - 0.02, MIRROR_Z]} material={std('#1c130e', 0.5)} />
      <Box size={[0.04, MIRROR.h, 0.03]} position={[-MIRROR.w / 2 - 0.02, MIRROR.y, MIRROR_Z]} material={std('#1c130e', 0.5)} />
      <Box size={[0.04, MIRROR.h, 0.03]} position={[MIRROR.w / 2 + 0.02, MIRROR.y, MIRROR_Z]} material={std('#1c130e', 0.5)} />

      {/* the note taped to the glass; later only the tape and two torn corners are left */}
      <group position={NOTE}>
        {noteThere && (
          <mesh position={[0, 0, 0.002]} rotation={[0, 0, -0.035]}>
            <planeGeometry args={[0.17, 0.226]} />
            <meshStandardMaterial map={noteTexture()} roughness={0.9} />
          </mesh>
        )}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.07, 0.112, 0.004]} rotation={[0, 0, s * 0.5 - 0.035]}>
            {!noteThere && (
              <mesh position={[0, -0.006, -0.001]} rotation={[0, 0, s * 0.3]}>
                <circleGeometry args={[0.016, 3]} />
                <meshStandardMaterial color="#d8d4ca" roughness={0.9} />
              </mesh>
            )}
            <mesh>
              <planeGeometry args={[0.06, 0.022]} />
              <meshStandardMaterial color="#efe8cf" roughness={0.5} transparent opacity={0.6} />
            </mesh>
          </group>
        ))}
      </group>

      {/* lamp */}
      <group position={LAMP}>
        <mesh position={[0, 0.015, 0]} material={std('#1a1714', 0.4, 0.5)}>
          <cylinderGeometry args={[0.07, 0.08, 0.03, 24]} />
        </mesh>
        <mesh position={[0, 0.16, 0]} material={std('#1a1714', 0.4, 0.5)}>
          <cylinderGeometry args={[0.01, 0.01, 0.28, 10]} />
        </mesh>
        <mesh position={[0, 0.33, 0]} material={lamp > 0 ? glow('#ffc68a', 0.9) : std('#6a5e50', 0.9, 0, {side: THREE.DoubleSide})}>
          <cylinderGeometry args={[0.07, 0.12, 0.16, 28, 1, true]} />
        </mesh>
        {lamp > 0 && (
          <mesh position={[0, 0.3, 0]} material={glow('#fff0d6', 3)}>
            <sphereGeometry args={[0.03, 12, 8]} />
          </mesh>
        )}
      </group>

      {/* phone, face up on the dresser */}
      <group position={PHONE} rotation={[0, 0.18, 0]}>
        <Box size={[0.076, 0.009, 0.158]} material={std('#0c0c0e', 0.35, 0.3)} />
        <mesh position={[0, 0.0048, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.07, 0.15]} />
          <meshStandardMaterial map={phoneTexture(screen)} emissiveMap={phoneTexture(screen)} emissive={new THREE.Color('#ffffff')} emissiveIntensity={screenOn ? 0.16 : 0} roughness={0.7} />
        </mesh>
      </group>

      {/* stool */}
      <mesh position={[SEAT[0], 0.44, SEAT[2]]} material={woodTrim()} castShadow receiveShadow>
        <cylinderGeometry args={[0.19, 0.19, 0.05, 32]} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[SEAT[0] + Math.cos(i * 1.57 + 0.78) * 0.13, 0.21, SEAT[2] + Math.sin(i * 1.57 + 0.78) * 0.13]} material={woodTrim()}>
          <cylinderGeometry args={[0.018, 0.018, 0.42, 10]} />
        </mesh>
      ))}

      {/* him, sitting at the mirror */}
      {showHim && (
        <group position={[SEAT[0] + shiver, -0.03, SEAT[2]]} rotation={[0, facing, 0]}>
          <Character
            outfit="sleeper"
            face={face}
            faceHi
            sit
            armL={-0.55}
            armR={-0.55}
            headPitch={lookDown}
            headYaw={shot === 'answer' ? 0.14 : 0}
            breathe={t * 0.5}
          />
        </group>
      )}

      {/* it */}
      {showIt && (
        <>
          <Leaner lean={lean} grin={grinAt(t, shot)} t={t} />
          <Spot position={[0.25, 2.3, -1.9]} target={[-0.34, 1.3, -0.96]} angle={0.3} penumbra={1} intensity={present ? 1.6 : 2.2} color="#b8c6ea" distance={4} decay={1.4} />
        </>
      )}
    </group>
  );
};

