import {Audio} from '@remotion/media';
import {ThreeCanvas} from '@remotion/three';
import React, {useEffect, useState} from 'react';
import {AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Captions} from '../../components/Captions';
import {loadFonts} from '../../lib/fonts';
import {clamp, easeInOut, easeOut} from '../../lib/timeline';
import {CameraRig} from '../../three/Common';
import {Post} from '../../three/Post';
import {NewHair} from '../phipop/Human';
import {KrasueScene} from './Scene';
import {cameraAt, cue, moodOf, shotAt, timings} from './cues';

export const FPS = 60;
export const DURATION_FRAMES = Math.ceil(cue.end * FPS);

/** Title: the Thai name, then KRASUE. */
const Title: React.FC<{t: number}> = ({t}) => {
  const a = easeOut(clamp((t - cue.call + 0.05) / 0.6));
  const out = 1 - easeInOut(clamp((t - (cue.byDay - 0.3)) / 0.3));
  const sub = easeOut(clamp((t - cue.call - 0.7) / 0.5));
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-start', paddingTop: 330, opacity: a * out}}>
      <div style={{fontFamily: 'Noto Sans Thai', fontWeight: 800, fontSize: 200, color: '#f2e6cf', lineHeight: 1.1, textShadow: '0 8px 40px rgba(0,0,0,0.9)', transform: 'scale(' + (0.92 + 0.08 * a) + ')'}}>
        {'กระสือ'}
      </div>
      <div style={{fontFamily: 'Oswald', fontWeight: 700, fontSize: 92, color: '#b3121a', letterSpacing: '0.18em', marginTop: 6, textShadow: '0 6px 30px rgba(0,0,0,0.9)'}}>KRASUE</div>
      <div style={{fontFamily: 'Inter', fontWeight: 700, fontSize: 36, color: 'rgba(242,230,207,0.85)', marginTop: 18, letterSpacing: '0.08em', opacity: sub, textShadow: '0 4px 20px rgba(0,0,0,0.9)'}}>
        THE FLOATING HEAD OF THAI FOLKLORE
      </div>
    </AbsoluteFill>
  );
};

/** A label at the top of the frame. */
const Label: React.FC<{t: number; from: number; to: number; text: string; color?: string; lines?: {at: number; text: string}[]}> = ({t, from, to, text, color = '#f2e6cf', lines = []}) => {
  if (t < from - 0.05 || t > to + 0.4) return null;
  const a = easeOut(clamp((t - from) / 0.4)) * (1 - clamp((t - to) / 0.35));
  return (
    <AbsoluteFill style={{alignItems: 'center', paddingTop: 250, opacity: a}}>
      <div style={{fontFamily: 'Oswald', fontWeight: 700, fontSize: 74, letterSpacing: '0.16em', color, textShadow: '0 6px 30px rgba(0,0,0,0.95)'}}>{text}</div>
      {lines.map((l) => {
        const b = easeOut(clamp((t - l.at) / 0.4));
        return (
          <div key={l.text} style={{fontFamily: 'Inter', fontWeight: 800, fontSize: 42, color: '#f2e6cf', marginTop: 14, opacity: b, transform: 'translateX(' + (1 - b) * 30 + 'px)', textShadow: '0 4px 24px rgba(0,0,0,0.95)'}}>
            {l.text}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const KrasueFilm: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const t = frame / fps;
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    loadFonts().then(() => setFontsReady(true));
  }, []);

  const shot = shotAt(t);
  const mood = moodOf(shot.id);
  const cam = cameraAt(t);
  const black = t >= cue.cut; // hard cut on the tap at the glass
  const fade = easeInOut(clamp(t / 0.8));
  const close = ['smile', 'stare', 'elder', 'tired', 'organs', 'split'].includes(shot.id);

  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      {fontsReady && !black && (
        <ThreeCanvas width={width} height={height} shadows dpr={1} gl={{antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance'}} camera={{fov: 40, near: 0.05, far: 200}}>
          <CameraRig cam={cam} />
          <NewHair.Provider value={true}>
            <KrasueScene t={t} shot={shot.id} set={shot.set} mood={mood} />
          </NewHair.Provider>
          <Post time={t} fade={fade} paint={0.9} grade={mood === 'day' ? 0.4 : 1} vignette={close ? 1.25 : 1.1} bloomStrength={0.6} bloomRadius={0.55} bloomThreshold={0.82} exposure={mood === 'day' ? 1.2 : mood === 'night' ? 1.4 : 1.15} />
        </ThreeCanvas>
      )}

      {!black && (
        <>
          {shot.id === 'title' && <Title t={t} />}
          <Label t={t} from={cue.byDay} to={cue.but - 0.45} text="BY DAY" color="#f0c87a" />
          <Label t={t} from={cue.but} to={cue.her4 - 0.5} text="AT MIDNIGHT" color="#b3121a" />
          <Label
            t={t}
            from={cue.elders + 0.2}
            to={cue.so - 0.5}
            text="THE SIGNS"
            color="#b3121a"
            lines={[
              {at: cue.exhausted, text: '1. SHE LOOKS EXHAUSTED'},
              {at: cue.avoid, text: '2. SHE AVOIDS THE SUN'},
              {at: cue.never, text: '3. SHE NEVER TOUCHES COOKED FOOD'},
            ]}
          />
          <Captions
            words={timings.words}
            emphasis={['horrifying', 'splits', 'apart', 'intestines', 'babies', 'severed', 'staring', 'agony', 'curtains', 'midnight']}
            accent={['krasue', 'splits', 'apart', 'severed', "don't", 'open', 'curtains']}
            accentColor="#c41a22"
            y={0.7}
            yAt={(s) => (['smile', 'stare', 'elder', 'tired', 'split', 'organs'].includes(shotAt(s).id) ? 0.84 : 0.7)}
            hidden={[[cue.call - 0.1, cue.byDay - 0.02]]}
          />
        </>
      )}

      <Audio src={staticFile('krasue/soundtrack.wav')} />
    </AbsoluteFill>
  );
};
