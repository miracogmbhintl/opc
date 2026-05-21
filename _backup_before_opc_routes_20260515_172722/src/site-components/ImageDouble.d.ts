import * as React from "react";
import * as Types from "./types";

declare function ImageDouble(
    props: {
        as?: React.ElementType;
        image1?: Types.Asset.Image;
        image2?: Types.Asset.Image;
        link1?: Types.Basic.Link;
        link2?: Types.Basic.Link;
        text1?: React.ReactNode;
        text2?: React.ReactNode;
    }
): React.JSX.Element