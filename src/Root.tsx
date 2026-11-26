import React from 'react';
import {Composition} from 'remotion';
import {DURATION_FRAMES, FPS, Room414} from './videos/room414/Room414';

export const Root: React.FC = () => (
  <>
    <Composition id="Room414" component={Room414} durationInFrames={DURATION_FRAMES} fps={FPS} width={1080} height={1920} />
  </>
);
