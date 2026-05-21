import React from 'react';
type BackgroundVideoWrapperProps = {
    tag?: keyof HTMLElementTagNameMap;
    className?: string;
    sources?: string[];
    posterImage?: string;
    autoPlay?: boolean;
    loop?: boolean;
    children?: React.ReactNode;
};
export type { BackgroundVideoWrapperProps };
declare const BackgroundVideoWrapper: any;
export default BackgroundVideoWrapper;
