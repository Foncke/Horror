import React from 'react';
import {Composition} from 'remotion';
import {DURATION_FRAMES, FPS, Room414} from './videos/room414/Room414';
import {DURATION_FRAMES as THREE_AM_FRAMES, FPS as THREE_AM_FPS, ThreeAM} from './videos/3am/ThreeAM';

export const Root: React.FC = () => (
  <>
    <Composition id="Room414" component={Room414} durationInFrames={DURATION_FRAMES} fps={FPS} width={1080} height={1920} />
    <Composition id="ThreeAM" component={ThreeAM} durationInFrames={THREE_AM_FRAMES} fps={THREE_AM_FPS} width={1080} height={1920} />
  </>
);
