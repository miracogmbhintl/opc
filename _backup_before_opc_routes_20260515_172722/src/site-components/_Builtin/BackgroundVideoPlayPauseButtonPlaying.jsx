'use client';
import React from 'react';
import { BgVideoContext } from './shared/bgVideoContext';
const BackgroundVideoPlayPauseButtonPlaying = React.forwardRef(function BackgroundVideoPlayPauseButtonPlaying({ children }, ref) {
    const { isPlaying } = React.useContext(BgVideoContext);
    return (React.createElement("span", { hidden: !isPlaying, ref: ref }, children));
});
export default BackgroundVideoPlayPauseButtonPlaying;
