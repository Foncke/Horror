import {Audio} from '@remotion/media';
import {ThreeCanvas} from '@remotion/three';
import React, {useEffect, useState} from 'react';
import {AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Captions} from '../../components/Captions';
import {loadFonts} from '../../lib/fonts';
import {clamp, easeInOut, easeOut, lerp} from '../../lib/timeline';
import {CameraRig} from '../../three/Common';
import {Post} from '../../three/Post';
import {HouseSet} from './House';
import {Human, twitch} from './Human';
import {Mist, VillageSet} from './Village';
import {VoidSet} from './Void';
import {ShotId, cameraAt, cue, daylight, shotAt, timings} from './cues';

export const FPS = 60;
export const DURATION_FRAMES = Math.ceil(cue.end * FPS);

/** People and light in the village shots. */
const VillageShot: React.FC<{t: number; shot: ShotId}> = ({t, shot}) => {
  const day = daylight(shot);
  const inDoor = shot === 'neighbor' || shot === 'day' || shot === 'smileclose';
  return (
    <group>
      <VillageSet t={t} day={day} />
      <color attach="background" args={[day ? '#e8d6b0' : '#071118']} />
      <fogExp2 attach="fog" args={[day ? '#e2d3b4' : '#0b1c24', day ? 0.018 : 0.05]} />
      <hemisphereLight args={[day ? '#cfe2f5' : '#204658', day ? '#a0805a' : '#090706', day ? 2.6 : 0.7]} />
      <directionalLight
        position={day ? [-8, 12, 6] : [-6, 10, -8]}
        intensity={day ? 5.5 : 1.1}
        color={day ? '#ffe0b0' : '#7fb0d0'}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />
      {!day && <Mist t={t} color="#4f7480" opacity={0.28} area={[-10, 10, -30, 25]} />}
      {inDoor && (
        <>
          <Human face="smile" position={[2.37, 1.7, 0.79]} rotationY={-Math.PI / 2 + 0.1} armL={-0.1} armR={-0.15} headYaw={0.1} breathe={t} hairDrift={t} />
          {!day && <pointLight position={[3.6, 2.9, 0.75]} intensity={5} distance={4} decay={1.5} color="#ff9a48" />}
          {/* soft key on her face */}
          <pointLight position={[1.4, 3.4, 1.1]} intensity={day ? 1.5 : 2.2} distance={3} decay={1.6} color={day ? '#fff0d8' : '#ffb070'} />
        </>
      )}
      {shot === 'creep' && <pointLight position={[-0.6, 1.4, 1.2]} intensity={2.4} distance={4} decay={1.5} color="#9fc0d8" />}
      {shot === 'creep' && (
        // crouched low, creeping away down the misty lane
        <Human face="possessed" position={[-0.8, 0, lerp(1.6, -0.6, clamp((t - cue.itHijacks) / 5))]} rotationY={Math.PI} hipY={0.8} thigh={-0.22} knee={0.5} spread={0.04} hunch={0.72} armL={-0.35} armR={-0.45} elbowL={-0.25} elbowR={-0.3} walk={((t - (cue.itHijacks - 0.5)) * Math.PI * 2) / 1.8} stride={0.32} headPitch={-0.55} headYaw={2.75 * easeInOut(clamp((t - (cue.hunt - 1.7)) / 1.0)) + twitch(t)} headRoll={twitch(t, 3) * 0.8} hairDrift={t} />
      )}
    </group>
  );
};

/** Big title: the Thai name, then PHI POP. */
const Title: React.FC<{t: number}> = ({t}) => {
  const a = easeOut(clamp((t - cue.called + 0.05) / 0.7));
  const out = 1 - easeInOut(clamp((t - (cue.unlike - 0.6)) / 0.5));
  const sub = easeOut(clamp((t - cue.called - 2.0) / 0.6));
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-start', paddingTop: 330, opacity: a * out}}>
      <div style={{fontFamily: 'Noto Sans Thai', fontWeight: 800, fontSize: 210, color: '#f2e6cf', lineHeight: 1.1, textShadow: '0 8px 40px rgba(0,0,0,0.9)', transform: 'scale(' + (0.92 + 0.08 * a) + ')'}}>
        {'ผีปอบ'}
      </div>
      <div style={{fontFamily: 'Oswald', fontWeight: 700, fontSize: 92, color: '#e0563a', letterSpacing: '0.18em', marginTop: 6, textShadow: '0 6px 30px rgba(0,0,0,0.9)'}}>PHI POP</div>
      <div style={{fontFamily: 'Inter', fontWeight: 700, fontSize: 38, color: 'rgba(242,230,207,0.85)', marginTop: 18, letterSpacing: '0.08em', opacity: sub, textShadow: '0 4px 20px rgba(0,0,0,0.9)'}}>
        THE FLESH-EATING SPIRIT OF ISAN
      </div>
    </AbsoluteFill>
  );
};

/** A label that pops at the top of the frame (the reference's on-screen text). */
const Label: React.FC<{t: number; from: number; to: number; text: string; color?: string; lines?: {at: number; text: string}[]}> = ({t, from, to, text, color = '#f2e6cf', lines = []}) => {
  if (t < from - 0.05 || t > to + 0.4) return null;
  const a = easeOut(clamp((t - from) / 0.4)) * (1 - clamp((t - to) / 0.35));
  return (
    <AbsoluteFill style={{alignItems: 'center', paddingTop: 250, opacity: a}}>
      <div style={{fontFamily: 'Oswald', fontWeight: 700, fontSize: 74, letterSpacing: '0.16em', color, textShadow: '0 6px 30px rgba(0,0,0,0.95)', transform: 'translateY(' + (1 - a) * -20 + 'px)'}}>{text}</div>
      {lines.map((l) => {
        const b = easeOut(clamp((t - l.at) / 0.4));
        return (
          <div key={l.text} style={{fontFamily: 'Inter', fontWeight: 800, fontSize: 44, color: '#f2e6cf', marginTop: 16, opacity: b, transform: 'translateX(' + (1 - b) * 30 + 'px)', textShadow: '0 4px 24px rgba(0,0,0,0.95)'}}>
            {l.text}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const PhiPop: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const t = frame / fps;
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    loadFonts().then(() => setFontsReady(true));
  }, []);

  const shot = shotAt(t);
  const cam = {...cameraAt(t), near: 0.05, far: 200}; // wider depth range than the other videos: the sky sits 90 m out
  const black = t >= cue.cut; // hard cut after "don't turn on the light."
  const fade = easeInOut(clamp(t / 0.8));
  const close = ['eyes', 'trapped', 'trapped2', 'avert', 'elder', 'smileclose', 'situp'].includes(shot.id);
  const day = daylight(shot.id);

  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      {fontsReady && !black && (
        <ThreeCanvas width={width} height={height} shadows dpr={1} gl={{antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance'}} camera={{fov: 40, near: 0.05, far: 200}}>
          <CameraRig cam={cam} />
          {shot.set === 'village' && <VillageShot t={t} shot={shot.id} />}
          {shot.set === 'house' && <HouseSet t={t} shot={shot.id} />}
          {shot.set === 'void' && <VoidSet t={t} shot={shot.id} />}
          <Post time={t} fade={fade} paint={0.9} grade={day ? 0.4 : 1} vignette={close ? 1.25 : 1.1} bloomStrength={0.55} bloomRadius={0.55} bloomThreshold={shot.id === 'drop' ? 0.95 : 0.82} exposure={day ? 1.25 : 1.15} />
        </ThreeCanvas>
      )}

      {!black && (
        <>
          {shot.id === 'title' && <Title t={t} />}
          <Label t={t} from={cue.byDay} to={cue.until - 0.3} text="BY DAY" color="#f0c87a" />
          <Label t={t} from={cue.until} to={cue.worst - 0.3} text="AFTER MIDNIGHT" color="#e0563a" />
          <Label
            t={t}
            from={cue.elders + 0.2}
            to={cue.tonight - 0.3}
            text="THE SIGNS"
            color="#e0563a"
            lines={[
              {at: cue.never, text: '1. NEVER LOOKS YOU IN THE EYE'},
              {at: cue.andThey + 0.2, text: '2. WAKES UP STARVING AT 3 A.M.'},
            ]}
          />
          <Captions
            words={timings.words}
            emphasis={['monster', 'skin', 'curse', 'midnight', 'entrails', 'flesh', 'saliva', 'gone', 'chewing', 'light']}
            accent={['phi', 'pop', 'isan']}
            accentColor="#e0563a"
            y={0.7}
            hidden={[[cue.called - 0.1, cue.unlike - 0.3]]}
          />
        </>
      )}

      <Audio src={staticFile('phipop/soundtrack.wav')} />
    </AbsoluteFill>
  );
};
