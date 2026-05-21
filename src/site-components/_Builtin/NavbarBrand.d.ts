import * as React from 'react';
import { LinkProps } from './Link';
type NavbarBrandProps = LinkProps;
export type { NavbarBrandProps };
declare const NavbarBrand: React.ForwardRefExoticComponent<import("./shared/types").ElementProps<"a"> & {
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
export default NavbarBrand;
