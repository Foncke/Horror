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
import {Bedroom} from './Bedroom';
import {CLOSET_X, ROOM, cameraAt, cue, figureHead, shotAt, timings} from './cues';

export const FPS = 60;
export const DURATION_FRAMES = Math.ceil(cue.end * FPS);

export const ThreeAM: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const t = frame / fps;
  // fonts must be ready before the clock face is painted
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    loadFonts().then(() => setFontsReady(true));
  }, []);

  const shot = shotAt(t);
  const cam = cameraAt(t);

  // fade in from black, a quick dip before the reveal, fade out before the end card
  let fade = easeInOut(clamp(t / 1.2));
  const d = Math.abs(t - (cue.standing - 0.05));
  if (shot.id === 'tilt' && d < 0.12) fade *= 0.35 + 0.65 * easeInOut(d / 0.12);
  fade *= 1 - easeInOut(clamp((t - cue.outStart) / 0.9));

  const close = ['double', 'speak', 'eyes', 'scream', 'wake'].includes(shot.id);

  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      {fontsReady && (
        <ThreeCanvas width={width} height={height} shadows dpr={1} gl={{antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance'}} camera={{fov: 40, near: 0.02, far: 80}}>
          <CameraRig cam={cam} />
          <Bedroom t={t} shot={shot.id} />
          <Post
            time={t}
            fade={fade}
            vignette={close ? 1.15 : 1}
            bloomStrength={shot.id === 'clock' ? 0.75 : 0.7}
            bloomRadius={0.6}
            bloomThreshold={shot.id === 'clock' ? 0.7 : 0.88}
            exposure={['figure', 'double', 'speak', 'tilt', 'lean', 'creak'].includes(shot.id) ? 0.95 : 1.1}
            tint={[0.9, 0.97, 1.12]}
            tintAmount={0.35}
          />
        </ThreeCanvas>
      )}

      {shot.id === 'creak' && t < cue.outStart + 0.3 && (
        <>
          <Callout letter="A" text="THE BED" color="#f5c542" at={cue.choiceA} anchor={project(cam, figureHead(t), width, height)} label={{x: 300, y: 1480}} />
          <Callout letter="B" text="THE CLOSET" color="#4f8cff" at={cue.choiceB} anchor={project(cam, [CLOSET_X - 0.1, 1.35, ROOM.D / 2 + 0.45], width, height)} label={{x: 780, y: 430}} />
        </>
      )}

      <Captions
        words={timings.words}
        emphasis={['paralysis', 'black', 'wide', 'scream', 'downward']}
        accent={['three', 'am']}
        accentColor="#ff5a48"
        y={0.66}
        yAt={(s) => (['double', 'speak'].includes(shotAt(s).id) ? 0.8 : 0.66)}
      />

      {t > cue.outStart + 0.6 && (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', opacity: easeInOut(clamp((t - cue.outStart - 0.6) / 0.6))}}>
          <div style={{fontFamily: 'Inter', fontWeight: 800, fontSize: 110, color: 'white', letterSpacing: '-0.02em'}}>A or B?</div>
          <div style={{fontFamily: 'Inter', fontWeight: 700, fontSize: 38, color: 'rgba(255,255,255,0.6)', marginTop: 18, letterSpacing: '0.12em'}}>TELL ME IN THE COMMENTS</div>
        </AbsoluteFill>
      )}

      <Audio src={staticFile('3am/soundtrack.wav')} />
    </AbsoluteFill>
  );
};
