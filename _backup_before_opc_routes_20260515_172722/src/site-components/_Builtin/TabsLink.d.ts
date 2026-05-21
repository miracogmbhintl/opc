import * as React from 'react';
import { Props } from './shared/types';
type TabsLinkProps = Props<'a', {
    'data-w-tab': string;
    block?: string;
}>;
export type { TabsLinkProps };
declare const TabsLink: React.ForwardRefExoticComponent<import("./shared/types").ElementProps<"a"> & {
    'data-w-tab': string;
    block?: string;
} & {
    children?: React.ReactNode | undefined;
} & React.RefAttributes<HTMLAnchorElement>>;
export default TabsLink;
