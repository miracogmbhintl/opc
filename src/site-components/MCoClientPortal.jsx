"use client";
import React from "react";
import Block from "./_Builtin/Block";
import FormButton from "./_Builtin/FormButton";
import FormErrorMessage from "./_Builtin/FormErrorMessage";
import FormForm from "./_Builtin/FormForm";
import FormSuccessMessage from "./_Builtin/FormSuccessMessage";
import FormTextInput from "./_Builtin/FormTextInput";
import FormWrapper from "./_Builtin/FormWrapper";
import Heading from "./_Builtin/Heading";
import Image from "./_Builtin/Image";
import Link from "./_Builtin/Link";
import Paragraph from "./_Builtin/Paragraph";
import Span from "./_Builtin/Span";

export function MCoClientPortal(
    {
        as: _Component = Block
    }
) {
    return (
        <_Component className="wbs-section-6" tag="div"><Block className="wbs-container-6" tag="div"><Block className="wbs-cta-component" tag="div"><Block className="wbs-cta-8" tag="div"><Block
                            className="wbs-cta-8-content"
                            id="w-node-_7d13fca2-842f-6b4b-fdec-9e2953962590-5396258c"
                            tag="div"><Heading className="wbs-cta-8-title" tag="h2"><Span className="text-span-44">{"M&CO"}</Span>{" "}<br />{"Client Portal"}</Heading><Paragraph className="wbs-cta-8-description">{"Behalten Sie den Überblick über Ihre Projekte, Kommunikation, Dateien und Fortschritt vereint in einem Portal."}</Paragraph><Block className="wbs-pricing-3-list" tag="div"><Block className="wbs-pricing-3-list-item portal" tag="div"><Image
                                        alt=""
                                        className="wbs-pricing-3-list-icon"
                                        height="auto"
                                        loading="lazy"
                                        src="https://cdn.prod.website-files.com/68dc2b9c31cb83ac9f84a1af/690791ce4c44c34dc33110e6_background%20f2f2f2%2069076e12e93f5178d62599fb_55b5882e9556c5c2b8af22356fc3c2d5_seal-check.svg"
                                        width="auto" /><Block tag="div"><Block className="text-block-14" tag="div">{"Projektübersicht"}</Block><Block className="text-block-13" tag="div">{"Alle Meilensteine und Fortschritte auf einen Blick."}</Block></Block></Block><Block className="wbs-pricing-3-list-item portal" tag="div"><Image
                                        alt=""
                                        className="wbs-pricing-3-list-icon"
                                        height="auto"
                                        loading="lazy"
                                        src="https://cdn.prod.website-files.com/68dc2b9c31cb83ac9f84a1af/690791ce4c44c34dc33110e6_background%20f2f2f2%2069076e12e93f5178d62599fb_55b5882e9556c5c2b8af22356fc3c2d5_seal-check.svg"
                                        width="auto" /><Block tag="div"><Block className="text-block-15" tag="div">{"Direkte Kommunikation"}</Block><Block className="text-block-13" tag="div">{"Nachrichten & Updates ohne E-Mail-Chaos."}</Block></Block></Block><Block className="wbs-pricing-3-list-item portal" tag="div"><Image
                                        alt=""
                                        className="wbs-pricing-3-list-icon"
                                        height="auto"
                                        loading="lazy"
                                        src="https://cdn.prod.website-files.com/68dc2b9c31cb83ac9f84a1af/690791ce4c44c34dc33110e6_background%20f2f2f2%2069076e12e93f5178d62599fb_55b5882e9556c5c2b8af22356fc3c2d5_seal-check.svg"
                                        width="auto" /><Block tag="div"><Block className="text-block-16" tag="div">{"Dateiverwaltung"}</Block><Block className="text-block-13" tag="div">{"Zugriff auf Dokumente, Rechnungen und Design-Dateien."}</Block></Block></Block><Block className="wbs-pricing-3-list-item portal" tag="div"><Image
                                        alt=""
                                        className="wbs-pricing-3-list-icon"
                                        height="auto"
                                        loading="lazy"
                                        src="https://cdn.prod.website-files.com/68dc2b9c31cb83ac9f84a1af/690791ce4c44c34dc33110e6_background%20f2f2f2%2069076e12e93f5178d62599fb_55b5882e9556c5c2b8af22356fc3c2d5_seal-check.svg"
                                        width="auto" /><Block tag="div"><Block className="text-block-17" tag="div">{"Live-Status"}</Block><Block className="text-block-13" tag="div">{"Automatische Benachrichtigungen bei jedem Fortschritt."}</Block></Block></Block><Block className="wbs-pricing-3-list-item portal" tag="div"><Image
                                        alt=""
                                        className="wbs-pricing-3-list-icon"
                                        height="auto"
                                        loading="lazy"
                                        src="https://cdn.prod.website-files.com/68dc2b9c31cb83ac9f84a1af/690791ce4c44c34dc33110e6_background%20f2f2f2%2069076e12e93f5178d62599fb_55b5882e9556c5c2b8af22356fc3c2d5_seal-check.svg"
                                        width="auto" /><Block tag="div"><Block className="text-block-17" tag="div">{"Analytics"}</Block><Block className="text-block-13" tag="div">{"Performance tracking powered by google analytics"}</Block></Block></Block><Block className="wbs-pricing-3-list-item portal" tag="div"><Image
                                        alt=""
                                        className="wbs-pricing-3-list-icon"
                                        height="auto"
                                        loading="lazy"
                                        src="https://cdn.prod.website-files.com/68dc2b9c31cb83ac9f84a1af/690791ce4c44c34dc33110e6_background%20f2f2f2%2069076e12e93f5178d62599fb_55b5882e9556c5c2b8af22356fc3c2d5_seal-check.svg"
                                        width="auto" /><Block tag="div"><Block className="text-block-18" tag="div">{"Rechnungs- & Zahlungsstatus"}</Block><Block className="text-block-13" tag="div">{"Transparent und in Echtzeit."}</Block></Block></Block><Block className="wbs-pricing-3-list-item portal" tag="div"><Image
                                        alt=""
                                        className="wbs-pricing-3-list-icon"
                                        height="auto"
                                        loading="lazy"
                                        src="https://cdn.prod.website-files.com/68dc2b9c31cb83ac9f84a1af/690791ce4c44c34dc33110e6_background%20f2f2f2%2069076e12e93f5178d62599fb_55b5882e9556c5c2b8af22356fc3c2d5_seal-check.svg"
                                        width="auto" /><Block tag="div"><Block className="text-block-19" tag="div">{"Erinnerungen & Follow-ups"}</Block><Block className="text-block-13" tag="div">{"Nie wieder Deadlines verpassen."}</Block></Block></Block></Block><Block
                                className="wbs-cta-8-button"
                                id="w-node-_7d13fca2-842f-6b4b-fdec-9e29539625cb-5396258c"
                                tag="div"><Link
                                    block="inline"
                                    button={false}
                                    options={{
                                        href: "#"
                                    }}><Image
                                        alt=""
                                        className="wbs-app-button"
                                        height="auto"
                                        loading="lazy"
                                        src="https://cdn.prod.website-files.com/68dc2b9c31cb83ac9f84a1af/69078d1e6f598345e689af66_ba30985e7bc9f7297092bf09586aaf0d_app-store.svg"
                                        width="auto" /></Link><Link
                                    block="inline"
                                    button={false}
                                    options={{
                                        href: "#"
                                    }}><Image
                                        alt=""
                                        className="wbs-app-button"
                                        height="auto"
                                        loading="lazy"
                                        src="https://cdn.prod.website-files.com/68dc2b9c31cb83ac9f84a1af/69078d1e6f598345e689af65_0d9f02235a3145d3d5b5d13d29beea6a_google-play.svg"
                                        width="auto" /></Link></Block></Block><Block
                            className="wbs-cta-8-image"
                            id="w-node-_7d13fca2-842f-6b4b-fdec-9e29539625d0-5396258c"
                            tag="div"><Image
                                alt=""
                                height="auto"
                                loading="lazy"
                                src="https://cdn.prod.website-files.com/68dc2b9c31cb83ac9f84a1af/69078d1e6f598345e689af64_21dcd173a43c967c74662620cbeca088_element-01.svg"
                                width="auto" /></Block></Block></Block></Block></_Component>
    );
}