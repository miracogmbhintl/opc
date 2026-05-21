import * as React from 'react';
export type ElementProps<T extends keyof HTMLElementTagNameMap> = React.HTMLAttributes<HTMLElementTagNameMap[T]>;
export type Props<T extends keyof HTMLElementTagNameMap, U = unknown> = ElementProps<T> & React.PropsWithChildren<U>;
export type TagProps = Props<keyof HTMLElementTagNameMap, {
    tag?: React.ElementType;
    grid?: unknown;
}>;
export type LinkProps = Props<'a', {
    options?: {
        href: string;
        target?: '_self' | '_blank';
        preload?: 'none' | 'prefetch' | 'prerender';
    };
    className?: string;
    button?: boolean;
    block?: string;
}>;
