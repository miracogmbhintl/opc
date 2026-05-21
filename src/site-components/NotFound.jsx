"use client";
import React from "react";
import Block from "./_Builtin/Block";
import Heading from "./_Builtin/Heading";
import Link from "./_Builtin/Link";

export function NotFound(
    {
        as: _Component = Block
    }
) {
    return (
        <_Component className="utility-page-wrap" tag="div"><Block className="utility-page-content" tag="div"><Heading className="text---heading" tag="h2">{"404"}</Heading><Block tag="div">{"Oops! Nothing is here."}</Block><Link
                    block="inline"
                    button={false}
                    options={{
                        href: "https://miraka.ch/"
                    }}><Block className="back-to-home-button" tag="div">{"<-- Back to Home"}</Block></Link></Block></_Component>
    );
}