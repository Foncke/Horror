import {Audio} from '@remotion/media';
import {ThreeCanvas} from '@remotion/three';
import React, {useEffect, useState} from 'react';
import {AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Captions} from '../../components/Captions';
import {loadFonts} from '../../lib/fonts';
import {CameraRig} from '../../three/Common';
import {Post} from '../../three/Post';
import {Forest, fadeAt} from './Forest';
import {cue, shotAt, timings, viewAt} from './cues';

export const FPS = 60;
export const DURATION_FRAMES = Math.ceil(cue.end * FPS);

export const FoundYou: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const t = frame / fps;
  // fonts must be ready before the map and compass are painted
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    loadFonts().then(() => setFontsReady(true));
  }, []);

  const shot = shotAt(t);
  const view = viewAt(t);
  const black = t >= cue.cut; // hard cut to black after "Found you."
  const close = ['yell', 'behind', 'breath', 'stare'].includes(shot.id);

  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      {fontsReady && !black && (
        <ThreeCanvas width={width} height={height} shadows dpr={1} gl={{antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance'}} camera={{fov: 40, near: 0.02, far: 120}}>
          <CameraRig cam={view.cam} />
          <Forest t={t} shot={shot.id} view={view} />
          <Post time={t} fade={fadeAt(t)} vignette={close ? 1.2 : 1.05} bloomStrength={0.75} bloomRadius={0.6} bloomThreshold={shot.id === 'stare' || shot.id === 'tilt' || shot.id === 'figure' ? 0.95 : 0.8} exposure={1.05} />
        </ThreeCanvas>
      )}

      {!black && (
        <Captions
          words={timings.words}
          emphasis={['silent', 'froze', 'shoulder', 'lost', 'gone', 'found', 'you']}
          accent={['october']}
          accentColor="#f0a35c"
          y={0.68}
          yAt={(s) => (['yell', 'behind', 'breath', 'stare'].includes(shotAt(s).id) ? 0.8 : 0.68)}
        />
      )}

      <Audio src={staticFile('foundyou/soundtrack.wav')} />
    </AbsoluteFill>
  );
};
