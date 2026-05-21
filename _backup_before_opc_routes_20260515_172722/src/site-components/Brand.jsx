"use client";
import React from "react";
import Image from "./_Builtin/Image";
import Link from "./_Builtin/Link";

export function Brand(
    {
        as: _Component = Link
    }
) {
    return (
        <_Component
            block="inline"
            button={false}
            className="brand"
            id="w-node-d9edca0f-ca85-01e2-d28e-9f4c99b6d82d-99b6d82d"
            options={{
                href: "https://miraka.ch/"
            }}><Image
                alt="Miraka & Co plain text black logo on a transparent background."
                className="logo"
                height="auto"
                loading="lazy"
                src="https://cdn.prod.website-files.com/68dc2b9c31cb83ac9f84a1af/68e0480bc44f1d28032afb51_LOGO%20MIRAKA%20%26%20CO%20PLAIN%20TEXT.png"
                width="auto" /></_Component>
    );
}