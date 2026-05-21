'use client';
import React from 'react';
import { BgVideoContext } from './shared/bgVideoContext';
const BackgroundVideoPlayPauseButtonPaused = React.forwardRef(function BackgroundVideoPlayPauseButtonPaused({ children }, ref) {
    const { isPlaying } = React.useContext(BgVideoContext);
    return (React.createElement("span", { hidden: isPlaying, ref: ref }, children));
});
export default BackgroundVideoPlayPauseButtonPaused;
