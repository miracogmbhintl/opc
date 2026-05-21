import * as React from 'react';
import { TagProps } from './shared/types';
type NavbarContainerProps = TagProps & {
    toggleOpen?: () => void;
    isOpen?: boolean;
    children: React.ReactNode;
};
export type { NavbarContainerProps };
declare const NavbarContainer: React.ForwardRefExoticComponent<import("./shared/types").ElementProps<keyof HTMLElementTagNameMap> & {
    tag?: React.ElementType;
    grid?: unknown;
} & {
    children?: React.ReactNode | undefined;
} & {
    toggleOpen?: () => void;
    isOpen?: boolean;
    children: React.ReactNode;
} & React.RefAttributes<HTMLElement>>;
export default NavbarContainer;
