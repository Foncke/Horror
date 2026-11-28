import {useThree} from '@react-three/fiber';
import {Audio} from '@remotion/media';
import {ThreeCanvas} from '@remotion/three';
import React, {useEffect, useLayoutEffect, useState} from 'react';
import * as THREE from 'three';
import {AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Captions} from '../../components/Captions';
import {loadFonts} from '../../lib/fonts';
import {clamp, easeInOut, easeOut} from '../../lib/timeline';
import {Post} from '../../three/Post';
import {Bedroom} from './Bedroom';
import {Cam17, cameraAt, cue, isPresent, mirrored, shotAt, timings} from './cues';
import {project} from '../../three/Common';

export const FPS = 60;
export const DURATION_FRAMES = Math.ceil(cue.end * FPS);

/** Like CameraRig, plus layer 1 (the thing) for the shots where the camera itself can see it. */
const Rig: React.FC<{cam: Cam17}> = ({cam}) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useLayoutEffect(() => {
    camera.position.set(...cam.pos);
    camera.up.set(Math.sin(cam.roll ?? 0), Math.cos(cam.roll ?? 0), 0);
    camera.lookAt(...cam.target);
    camera.fov = cam.fov ?? 40;
    camera.near = 0.02;
    camera.far = 60;
    camera.updateProjectionMatrix();
    camera.layers.set(0);
    if (cam.real) camera.layers.enable(1);
  });
  return null;
};

/** Big elapsed-time stamp: 00:07, 00:12, 00:17. */
const Stamp: React.FC<{t: number; at: number; text: string; red?: boolean; hold?: number}> = ({t, at, text, red, hold = 1.6}) => {
  const k = t - at;
  if (k < -0.05 || k > hold + 0.35) return null;
  const inP = easeOut(clamp((k + 0.05) / 0.22));
  const outP = 1 - easeInOut(clamp((k - hold) / 0.35));
  return (
    <AbsoluteFill style={{alignItems: 'center', top: 250, height: 260}}>
      <div
        style={{
          fontFamily: 'Inter',
          fontWeight: 800,
          fontSize: 150,
          letterSpacing: '0.02em',
          fontVariantNumeric: 'tabular-nums',
          color: red ? '#ff3b30' : '#ffffff',
          opacity: inP * outP,
          transform: `scale(${1.08 - 0.08 * inP})`,
          textShadow: red ? '0 0 40px rgba(255,40,30,0.55), 0 4px 24px rgba(0,0,0,0.9)' : '0 0 30px rgba(170,200,255,0.35), 0 4px 24px rgba(0,0,0,0.9)',
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

/** The phone's camera screen laid over the feed shot. */
const FeedUI: React.FC<{t: number; start: number; face: {x: number; y: number}}> = ({t, start, face}) => {
  const k = t - start;
  // a clean glitch as it cuts in: a few bright bars for 5-frame steps, no noise
  const step = Math.floor(k * 12);
  const bars = step < 3 ? [[0.18, 0.05], [0.47, 0.025], [0.71, 0.07]].map(([y, h], i) => ({y: y + step * 0.07 * (i - 1), h})) : [];
  const secs = Math.floor(7 + k);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <AbsoluteFill style={{border: '3px solid rgba(255,255,255,0.18)', margin: 40, borderRadius: 54}} />
      <div style={{position: 'absolute', top: 110, left: 90, display: 'flex', alignItems: 'center', gap: 16}}>
        <div style={{width: 26, height: 26, borderRadius: 13, background: '#ff2d2d', opacity: Math.floor(k * 2) % 2 ? 0.35 : 1, boxShadow: '0 0 18px rgba(255,45,45,0.8)'}} />
        <div style={{fontFamily: 'Inter', fontWeight: 800, fontSize: 44, color: 'white', letterSpacing: '0.08em'}}>LIVE</div>
      </div>
      <div style={{position: 'absolute', top: 116, right: 90, fontFamily: 'Inter', fontWeight: 700, fontSize: 36, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.06em', fontVariantNumeric: 'tabular-nums'}}>
        03:00:{String(secs).padStart(2, '0')}
      </div>
      <div style={{position: 'absolute', bottom: 120, left: 0, right: 0, textAlign: 'center', fontFamily: 'Inter', fontWeight: 700, fontSize: 32, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.3em'}}>
        REAR CAMERA
      </div>
      {/* the phone's face detection locks onto the face in the mirror (not his) */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy], i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: face.x + sx * 95 - 30,
            top: face.y + sy * 110 - 30,
            width: 60,
            height: 60,
            borderLeft: sx < 0 ? '4px solid rgba(255,214,10,0.85)' : undefined,
            borderRight: sx > 0 ? '4px solid rgba(255,214,10,0.85)' : undefined,
            borderTop: sy < 0 ? '4px solid rgba(255,214,10,0.85)' : undefined,
            borderBottom: sy > 0 ? '4px solid rgba(255,214,10,0.85)' : undefined,
          }}
        />
      ))}
      {bars.map((b, i) => (
        <div key={i} style={{position: 'absolute', left: 0, right: 0, top: `${b.y * 100}%`, height: `${b.h * 100}%`, background: 'rgba(220,235,255,0.55)', mixBlendMode: 'screen'}} />
      ))}
    </AbsoluteFill>
  );
};

export const Seventeen: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const t = frame / fps;
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    loadFonts().then(() => setFontsReady(true));
  }, []);

  const shot = shotAt(t);
  const cam = cameraAt(t);
  const present = isPresent(shot.id);
  const feed = shot.id === 'feed';

  // no fade in (the end loops straight into the start); a hard cut at the very end
  let fade = 1;
  // the lamp click: a brief dip as the room goes dark
  if (shot.id === 'lamp') fade *= t > cue.lampOff ? 0.85 + 0.15 * easeInOut(clamp((t - cue.lampOff) / 0.4)) : 1;

  const titleP = shot.id === 'room' ? easeOut(clamp((t - shot.start - 0.3) / 0.6)) * (1 - easeInOut(clamp((t - (shot.end - 0.6)) / 0.5))) : 0;

  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      {fontsReady && (
        <ThreeCanvas width={width} height={height} shadows dpr={1} gl={{antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance'}} camera={{fov: 40, near: 0.02, far: 60}}>
          <Rig cam={cam} />
          <Bedroom t={t} shot={shot.id} />
          <Post
            time={t}
            fade={fade}
            vignette={feed ? 0.7 : 1.1}
            bloomStrength={['timer', 'phoneOn'].includes(shot.id) ? 0.2 : 0.6}
            bloomRadius={0.6}
            bloomThreshold={0.92}
            exposure={feed ? 1.45 : present ? 1.05 : 1.12}
            tint={feed ? [0.78, 1.0, 0.92] : present ? [1.04, 0.98, 0.94] : [0.9, 0.97, 1.12]}
            tintAmount={feed ? 0.75 : 0.35}
            aberration={feed ? 0.004 : undefined}
          />
        </ThreeCanvas>
      )}

      {feed && <FeedUI t={t} start={shot.start} face={project(cam, mirrored([-0.34, 1.33, -0.96]), width, height)} />}

      <Stamp t={t} at={cue.seven} text="00:07" />
      <Stamp t={t} at={cue.twelve} text="00:12" />
      <Stamp t={t} at={cue.up + 0.55} text="00:17" red hold={1.5} />

      {titleP > 0 && (
        <AbsoluteFill style={{alignItems: 'center', top: 230}}>
          <div style={{opacity: titleP, transform: `translateY(${(1 - titleP) * 20}px)`, textAlign: 'center'}}>
            <div style={{fontFamily: 'Inter', fontWeight: 800, fontSize: 132, color: '#fff', letterSpacing: '-0.01em', textShadow: '0 6px 40px rgba(0,0,0,0.9)'}}>17 SECONDS</div>
            <div style={{width: 260 * titleP, height: 6, background: '#e5322b', margin: '14px auto 0', borderRadius: 3}} />
          </div>
        </AbsoluteFill>
      )}

      <Captions
        words={timings.words}
        emphasis={['blink', 'knock', 'black', 'tall', 'teeth', 'empty', 'gone', 'head', 'behind']}
        accent={['seventeensecond', 'seven', 'twelve', 'seventeen', 'teeth', 'behind', 'black']}
        accentColor="#ff4a3d"
        y={0.7}
        yAt={(s) => (['noteText', 'noteMid'].includes(shotAt(s).id) ? 0.84 : shotAt(s).id === 'feed' ? 0.78 : 0.7)}
      />

      <Audio src={staticFile('seventeen/soundtrack.wav')} />
    </AbsoluteFill>
  );
};
