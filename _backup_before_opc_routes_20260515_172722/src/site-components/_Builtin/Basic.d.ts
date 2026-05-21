import * as React from 'react';
export type ElementProps<T extends keyof HTMLElementTagNameMap> = React.HTMLAttributes<HTMLElementTagNameMap[T]>;
export type Props<T extends keyof HTMLElementTagNameMap, U = unknown> = ElementProps<T> & React.PropsWithChildren<U>;
export declare const Block: React.ForwardRefExoticComponent<{
    tag?: React.ElementType;
} & {
    children?: React.ReactNode | undefined;
} & React.HTMLAttributes<HTMLOrSVGElement> & React.RefAttributes<HTMLElement>>;
export declare const Span: React.ForwardRefExoticComponent<ElementProps<"span"> & {
    children?: React.ReactNode | undefined;
} & React.RefAttributes<HTMLSpanElement>>;
export declare const Blockquote: React.ForwardRefExoticComponent<ElementProps<"blockquote"> & {
    children?: React.ReactNode | undefined;
} & React.RefAttributes<HTMLQuoteElement>>;
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
export declare const Link: React.ForwardRefExoticComponent<ElementProps<"a"> & {
    options?: {
        href: string;
        target?: "_self" | "_blank";
        preload?: "none" | "prefetch" | "prerender";
    };
    className?: string;
    button?: boolean;
    block?: string;
} & {
    children?: React.ReactNode | undefined;
} & React.RefAttributes<HTMLAnchorElement>>;
export declare const List: React.ForwardRefExoticComponent<ElementProps<"ul"> & {
    tag?: React.ElementType;
    unstyled?: boolean;
} & {
    children?: React.ReactNode | undefined;
} & React.RefAttributes<HTMLElement>>;
export declare const ListItem: React.ForwardRefExoticComponent<ElementProps<"li"> & {
    children?: React.ReactNode | undefined;
} & React.RefAttributes<HTMLLIElement>>;
type ImageProps = React.DetailedHTMLProps<React.ImgHTMLAttributes<HTMLImageElement>, HTMLImageElement>;
export declare const Image: React.ForwardRefExoticComponent<Omit<ImageProps, "ref"> & React.RefAttributes<HTMLImageElement>>;
export declare const Section: React.ForwardRefExoticComponent<ElementProps<"section"> & {
    tag?: React.ElementType;
    grid?: unknown;
} & {
    children?: React.ReactNode | undefined;
} & React.RefAttributes<HTMLElement>>;
export type TagProps = Props<keyof HTMLElementTagNameMap, {
    tag?: React.ElementType;
    grid?: unknown;
}>;
export declare const Container: React.ForwardRefExoticComponent<ElementProps<keyof HTMLElementTagNameMap> & {
    tag?: React.ElementType;
    grid?: unknown;
} & {
    children?: React.ReactNode | undefined;
} & React.RefAttributes<HTMLElement>>;
export declare const BlockContainer: React.ForwardRefExoticComponent<ElementProps<keyof HTMLElementTagNameMap> & {
    tag?: React.ElementType;
    grid?: unknown;
} & {
    children?: React.ReactNode | undefined;
} & React.RefAttributes<HTMLElement>>;
export declare const HFlex: React.ForwardRefExoticComponent<ElementProps<keyof HTMLElementTagNameMap> & {
    tag?: React.ElementType;
    grid?: unknown;
} & {
    children?: React.ReactNode | undefined;
} & React.RefAttributes<HTMLElement>>;
export declare const VFlex: React.ForwardRefExoticComponent<ElementProps<keyof HTMLElementTagNameMap> & {
    tag?: React.ElementType;
    grid?: unknown;
} & {
    children?: React.ReactNode | undefined;
} & React.RefAttributes<HTMLElement>>;
export declare const Layout: React.ForwardRefExoticComponent<ElementProps<keyof HTMLElementTagNameMap> & {
    tag?: React.ElementType;
    grid?: unknown;
} & {
    children?: React.ReactNode | undefined;
} & React.RefAttributes<HTMLElement>>;
export declare const Cell: React.ForwardRefExoticComponent<ElementProps<keyof HTMLElementTagNameMap> & {
    tag?: React.ElementType;
    grid?: unknown;
} & {
    children?: React.ReactNode | undefined;
} & React.RefAttributes<HTMLElement>>;
export declare const HtmlEmbed: React.ForwardRefExoticComponent<ElementProps<"div"> & {
    tag?: React.ElementType;
    value: string;
} & {
    children?: React.ReactNode | undefined;
} & React.RefAttributes<HTMLElement>>;
export declare const Grid: React.ForwardRefExoticComponent<ElementProps<keyof HTMLElementTagNameMap> & {
    tag?: React.ElementType;
    grid?: unknown;
} & {
    children?: React.ReactNode | undefined;
} & React.RefAttributes<HTMLElement>>;
export declare const Icon: React.ForwardRefExoticComponent<ElementProps<"div"> & {
    widget: {
        icon: string;
        type?: string;
    };
} & {
    children?: React.ReactNode | undefined;
} & React.RefAttributes<HTMLDivElement>>;
type ColumnProps = Props<'div', {
    tag: React.ElementType;
    columnClasses?: string;
}>;
export declare const Column: React.ForwardRefExoticComponent<ElementProps<"div"> & {
    tag: React.ElementType;
    columnClasses?: string;
} & {
    children?: React.ReactNode | undefined;
} & React.RefAttributes<HTMLElement>>;
export declare const Row: React.ForwardRefExoticComponent<ElementProps<"div"> & {
    children: React.ReactElement<ColumnProps>[];
    tag: React.ElementType;
    columns: {
        [key: string]: string;
    };
    value?: string;
} & {
    children?: React.ReactNode | undefined;
} & React.RefAttributes<HTMLElement>>;
export declare const DOM: React.ForwardRefExoticComponent<ElementProps<"div"> & {
    tag: string;
} & {
    children?: React.ReactNode | undefined;
} & React.RefAttributes<HTMLElement>>;
export declare const NotSupported: React.ForwardRefExoticComponent<ElementProps<"div"> & {
    _atom?: string;
} & {
    children?: React.ReactNode | undefined;
} & React.RefAttributes<HTMLDivElement>>;
export {};
