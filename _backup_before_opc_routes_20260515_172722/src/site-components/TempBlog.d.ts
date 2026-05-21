import * as React from "react";
import * as Types from "./types";

declare function TempBlog(
    props: {
        as?: React.ElementType;
        articleDate?: React.ReactNode;
        articleOwnerNme?: React.ReactNode;
        auhorName?: React.ReactNode;
        creditsTextFullLength?: React.ReactNode;
        facebookPostLink?: Types.Basic.Link;
        linkedinArticle?: Types.Basic.Link;
        mainImage?: Types.Asset.Image;
        name?: React.ReactNode;
        originalLink?: Types.Basic.Link;
        slug?: React.ReactNode;
        twitterPostLink?: Types.Basic.Link;
    }
): React.JSX.Element