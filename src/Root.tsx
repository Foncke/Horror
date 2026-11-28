import React from 'react';
import {Composition} from 'remotion';
import {DURATION_FRAMES, FPS, Room414} from './videos/room414/Room414';
import {DURATION_FRAMES as KRASUE_FRAMES, FPS as KRASUE_FPS, KrasueFilm} from './videos/krasue/KrasueFilm';
import {DURATION_FRAMES as PHI_POP_FRAMES, FPS as PHI_POP_FPS, PhiPop} from './videos/phipop/PhiPop';
import {DURATION_FRAMES as FOUND_YOU_FRAMES, FPS as FOUND_YOU_FPS, FoundYou} from './videos/foundyou/FoundYou';
import {DURATION_FRAMES as SEVENTEEN_FRAMES, FPS as SEVENTEEN_FPS, Seventeen} from './videos/seventeen/Seventeen';
import {DURATION_FRAMES as THREE_AM_FRAMES, FPS as THREE_AM_FPS, ThreeAM} from './videos/3am/ThreeAM';

export const Root: React.FC = () => (
  <>
    <Composition id="Room414" component={Room414} durationInFrames={DURATION_FRAMES} fps={FPS} width={1080} height={1920} />
    <Composition id="ThreeAM" component={ThreeAM} durationInFrames={THREE_AM_FRAMES} fps={THREE_AM_FPS} width={1080} height={1920} />
    <Composition id="FoundYou" component={FoundYou} durationInFrames={FOUND_YOU_FRAMES} fps={FOUND_YOU_FPS} width={1080} height={1920} />
    <Composition id="PhiPop" component={PhiPop} durationInFrames={PHI_POP_FRAMES} fps={PHI_POP_FPS} width={1080} height={1920} />
    <Composition id="Krasue" component={KrasueFilm} durationInFrames={KRASUE_FRAMES} fps={KRASUE_FPS} width={1080} height={1920} />
    <Composition id="Seventeen" component={Seventeen} durationInFrames={SEVENTEEN_FRAMES} fps={SEVENTEEN_FPS} width={1080} height={1920} />
  </>
);
