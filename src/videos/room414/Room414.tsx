import {Audio} from '@remotion/media';
import {ThreeCanvas} from '@remotion/three';
import React, {useEffect, useState} from 'react';
import {AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Callout} from '../../components/Callout';
import {Captions} from '../../components/Captions';
import {loadFonts} from '../../lib/fonts';
import {clamp, easeInOut} from '../../lib/timeline';
import {CameraRig, project} from '../../three/Common';
import {Post} from '../../three/Post';
import {Hallway} from './Hallway';
import {Lobby} from './Lobby';
import {Room} from './Room';
import {cameraAt, cue, shotAt, timings} from './cues';

export const FPS = 60;
export const DURATION_FRAMES = Math.ceil(cue.end * FPS);

const ENTRY: [number, number, number] = [-0.62, 1.2, 2.5];
const BATH: [number, number, number] = [0.6, 1.35, 2.5];

export const Room414: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const t = frame / fps;
  // fonts must be ready before the 3D textures (door numbers, the card) are painted
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    loadFonts().then(() => setFontsReady(true));
  }, []);

  const shot = shotAt(t);
  const cam = cameraAt(t);

  // fade in from black, quick dips on the biggest scene changes, fade out at the end
  let fade = easeInOut(clamp(t / 1.0));
  for (const at of [cue.empty, cue.whisper - 0.12]) {
    const d = Math.abs(t - at + 0.12);
    if (d < 0.18) fade *= easeInOut(d / 0.18);
  }
  const outStart = cue.finalEnd + 0.35;
  fade *= 1 - easeInOut(clamp((t - outStart) / 0.9));

  const peep = shot.id === 'peephole' || shot.id === 'grin';

  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      {fontsReady && (
      <ThreeCanvas width={width} height={height} shadows dpr={1} gl={{antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance'}} camera={{fov: 40, near: 0.02, far: 80}}>
        <CameraRig cam={cam} />
        {shot.set === 'lobby' && <Lobby t={t} />}
        {shot.set === 'hall' && <Hallway t={t} shot={shot.id} />}
        {shot.set === 'room' && <Room t={t} shot={shot.id} />}
        <Post
          time={t}
          fade={fade}
          peephole={peep}
          vignette={peep ? 0.4 : 1}
          bloomStrength={shot.id === 'hall' || shot.id === 'empty' ? 1.15 : peep ? 0.55 : 0.8}
          bloomRadius={0.65}
          bloomThreshold={peep ? 0.85 : shot.set === 'lobby' ? 0.82 : 0.72}
          exposure={shot.set === 'lobby' ? 1.05 : 1}
          tint={peep ? [0.85, 0.95, 1.15] : [1, 1, 1]}
          tintAmount={peep ? 0.6 : 0}
        />
      </ThreeCanvas>
      )}

      {shot.id === 'choice' && t < outStart + 0.3 && (
        <>
          <Callout letter="A" text="OPEN THE DOOR" color="#f5c542" at={cue.choiceA} anchor={project(cam, ENTRY, width, height)} label={{x: 760, y: 470}} />
          <Callout letter="B" text="STAY INSIDE" color="#4f8cff" at={cue.choiceB} anchor={project(cam, BATH, width, height)} label={{x: 320, y: 1520}} />
        </>
      )}

      <Captions
        words={timings.words}
        emphasis={['knock', 'wide', 'opens', 'alone', 'back', 'empty', 'awake']}
        accent={['414', 'rule']}
        y={0.66}
        yAt={(s) => (['peephole', 'grin'].includes(shotAt(s).id) ? 0.82 : 0.66)}
      />

      {t > outStart + 0.6 && (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', opacity: easeInOut(clamp((t - outStart - 0.6) / 0.6))}}>
          <div style={{fontFamily: 'Inter', fontWeight: 800, fontSize: 110, color: 'white', letterSpacing: '-0.02em'}}>A or B?</div>
          <div style={{fontFamily: 'Inter', fontWeight: 700, fontSize: 38, color: 'rgba(255,255,255,0.6)', marginTop: 18, letterSpacing: '0.12em'}}>TELL ME IN THE COMMENTS</div>
        </AbsoluteFill>
      )}

      <Audio src={staticFile('room414/soundtrack.wav')} />
    </AbsoluteFill>
  );
};
