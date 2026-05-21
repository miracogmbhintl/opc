"use client";
import React from "react";
import Block from "./_Builtin/Block";
import Grid from "./_Builtin/Grid";
import Heading from "./_Builtin/Heading";
import HtmlEmbed from "./_Builtin/HtmlEmbed";
import Image from "./_Builtin/Image";
import Link from "./_Builtin/Link";
import RichText from "./_Builtin/RichText";

export function TempBlog(
    {
        as: _Component = Block,
        articleDate = "This is some text inside of a div block.",
        articleOwnerNme = "This is some text inside of a div block.",
        auhorName = "This is some text inside of a div block.",
        creditsTextFullLength = "This is some text inside of a div block.",

        facebookPostLink = {
            href: "#"
        },

        linkedinArticle = {
            href: "#"
        },

        mainImage = "",
        name = "Heading",

        originalLink = {
            href: "#"
        },

        slug = "This is some text inside of a div block.",

        twitterPostLink = {
            href: "#"
        }
    }
) {
    return (
        <_Component className="rl_section_blogpost1-2" tag="header"><Block className="rl-padding-global-11" tag="div"><Block className="rl-container-large-9" tag="div"><Block className="rl-padding-section-large-9" tag="div"><Block className="rl_blogpost1_component-2" tag="div"><Block className="rl_blogpost1_title-wrapper-2" tag="div"><Block className="rl_blogpost1_breadcrumb-2" tag="div"><Link
                                        block="inline"
                                        button={false}
                                        className="rl-breadcrumb-link-2"
                                        options={{
                                            href: "#"
                                        }}><Block className="rl-breadcrumb-text-2" tag="div">{"support"}</Block></Link><HtmlEmbed
                                        className="rl-breadcrumb-divider-2"
                                        content=""
                                        value="%3Csvg%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2016%2016%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%0A%3Cpath%20d%3D%22M6%203L11%208L6%2013%22%20stroke%3D%22CurrentColor%22%20stroke-width%3D%221.5%22%2F%3E%0A%3C%2Fsvg%3E" /><Link
                                        block="inline"
                                        button={false}
                                        className="rl-breadcrumb-link-active-2"
                                        options={{
                                            href: "#"
                                        }}><Block className="rl-breadcrumb-text-2" tag="div">{slug}</Block></Link></Block><Block className="rl_blogpost1_spacing-block-1-2" tag="div" /><Heading className="rl-heading-style-h2-6" tag="h1">{name}</Heading><Block className="rl_blogpost1_spacing-block-2-2" tag="div" /><Block className="rl_blogpost1_content-top-2" tag="div"><Block className="rl_blogpost1_author-wrapper-2" tag="div"><Block className="rl_blogpost1_author-image-wrapper-2" tag="div"><Image
                                                alt=""
                                                className="rl_blogpost1_author-image-2"
                                                height="auto"
                                                loading="lazy"
                                                src="https://cdn.prod.website-files.com/68dc2b9c31cb83ac9f84a1af/68fcee426f6ca9f3c11de324_insta%20profile%20pic%202.png"
                                                width="auto" /></Block><Block className="rl_blogpost1_details-wrapper-2" tag="div"><Block className="rl_blogpost1_author-text-2" tag="div">{articleOwnerNme}</Block><Block className="rl_blogpost1_date-wrapper-2" tag="div"><Block className="rl-text-style-small-2" tag="div">{articleDate}</Block><Block className="rl_blogpost1_text-divider-2" tag="div">{"•"}</Block><Block className="rl-text-style-small-2" tag="div">{"5 min read"}</Block></Block></Block></Block><Grid className="rl_blogpost1_share-2" tag="div"><Link
                                            block="inline"
                                            button={false}
                                            className="rl_blogpost1_social-link-2"
                                            options={originalLink}><HtmlEmbed
                                                className="rl_blogpost1_social-icon-2"
                                                content=""
                                                value="%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%0A%3Cpath%20fill-rule%3D%22evenodd%22%20clip-rule%3D%22evenodd%22%20d%3D%22M20.9999%207.66008V8.00008C21.0007%209.06616%2020.576%2010.0885%2019.8199%2010.84L16.9999%2013.67C16.4738%2014.1911%2015.6261%2014.1911%2015.1%2013.67L15%2013.56C14.8094%2013.3656%2014.8094%2013.0544%2015%2012.86L18.4399%209.42006C18.807%209.03938%2019.0083%208.52883%2018.9999%208.00008V7.66008C19.0003%207.12705%2018.788%206.61589%2018.4099%206.2401L17.7599%205.59011C17.3841%205.21207%2016.873%204.99969%2016.3399%205.00011H15.9999C15.4669%204.99969%2014.9558%205.21207%2014.58%205.59011L11.14%209.00007C10.9456%209.19064%2010.6344%209.19064%2010.44%209.00007L10.33%208.89007C9.8089%208.36394%209.8089%207.51623%2010.33%206.99009L13.16%204.15012C13.9165%203.40505%2014.9382%202.99133%2015.9999%203.00014H16.3399C17.4011%202.9993%2018.4191%203.42018%2019.1699%204.17012L19.8299%204.83012C20.5798%205.5809%2021.0007%206.59891%2020.9999%207.66008ZM8.64993%2013.94L13.9399%208.65008C14.0338%208.55543%2014.1616%208.50218%2014.2949%208.50218C14.4282%208.50218%2014.556%208.55543%2014.6499%208.65008L15.3499%209.35007C15.4445%209.44395%2015.4978%209.57175%2015.4978%209.70507C15.4978%209.83839%2015.4445%209.96618%2015.3499%2010.0601L10.0599%2015.35C9.96604%2015.4447%209.83824%2015.4979%209.70492%2015.4979C9.57161%2015.4979%209.44381%2015.4447%209.34993%2015.35L8.64993%2014.65C8.55528%2014.5561%208.50204%2014.4283%208.50204%2014.295C8.50204%2014.1617%208.55528%2014.0339%208.64993%2013.94ZM13.5599%2015C13.3655%2014.8094%2013.0543%2014.8094%2012.8599%2015L9.42993%2018.41C9.0517%2018.7905%208.53645%2019.003%207.99995%2018.9999H7.65995C7.12691%2019.0004%206.61576%2018.788%206.23997%2018.41L5.58997%2017.76C5.21194%2017.3842%204.99956%2016.873%204.99998%2016.34V16C4.99956%2015.4669%205.21194%2014.9558%205.58997%2014.58L9.00993%2011.14C9.2005%2010.9456%209.2005%2010.6345%209.00993%2010.44L8.89993%2010.33C8.3738%209.80894%207.52609%209.80894%206.99996%2010.33L4.17999%2013.16C3.42392%2013.9116%202.99916%2014.9339%203%2016V16.35C3.00182%2017.4077%203.42249%2018.4216%204.16999%2019.1699L4.82998%2019.8299C5.58076%2020.5799%206.59878%2021.0008%207.65995%2020.9999H7.99995C9.05338%2021.0061%2010.0667%2020.5964%2010.8199%2019.8599L13.6699%2017.01C14.191%2016.4838%2014.191%2015.6361%2013.6699%2015.11L13.5599%2015Z%22%20fill%3D%22CurrentColor%22%2F%3E%0A%3C%2Fsvg%3E" /></Link><Link
                                            block="inline"
                                            button={false}
                                            className="rl_blogpost1_social-link-2"
                                            options={linkedinArticle}><HtmlEmbed
                                                className="rl_blogpost1_social-icon-2"
                                                content=""
                                                value="%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%0A%3Cpath%20fill-rule%3D%22evenodd%22%20clip-rule%3D%22evenodd%22%20d%3D%22M5%203H19C20.1046%203%2021%203.89543%2021%205V19C21%2020.1046%2020.1046%2021%2019%2021H5C3.89543%2021%203%2020.1046%203%2019V5C3%203.89543%203.89543%203%205%203ZM8%2018C8.27614%2018%208.5%2017.7761%208.5%2017.5V10.5C8.5%2010.2239%208.27614%2010%208%2010H6.5C6.22386%2010%206%2010.2239%206%2010.5V17.5C6%2017.7761%206.22386%2018%206.5%2018H8ZM7.25%209C6.42157%209%205.75%208.32843%205.75%207.5C5.75%206.67157%206.42157%206%207.25%206C8.07843%206%208.75%206.67157%208.75%207.5C8.75%208.32843%208.07843%209%207.25%209ZM17.5%2018C17.7761%2018%2018%2017.7761%2018%2017.5V12.9C18.0325%2011.3108%2016.8576%209.95452%2015.28%209.76C14.177%209.65925%2013.1083%2010.1744%2012.5%2011.1V10.5C12.5%2010.2239%2012.2761%2010%2012%2010H10.5C10.2239%2010%2010%2010.2239%2010%2010.5V17.5C10%2017.7761%2010.2239%2018%2010.5%2018H12C12.2761%2018%2012.5%2017.7761%2012.5%2017.5V13.75C12.5%2012.9216%2013.1716%2012.25%2014%2012.25C14.8284%2012.25%2015.5%2012.9216%2015.5%2013.75V17.5C15.5%2017.7761%2015.7239%2018%2016%2018H17.5Z%22%20fill%3D%22CurrentColor%22%2F%3E%0A%3C%2Fsvg%3E" /></Link><Link
                                            block="inline"
                                            button={false}
                                            className="rl_blogpost1_social-link-2"
                                            options={twitterPostLink}><HtmlEmbed
                                                className="rl_blogpost1_social-icon-2"
                                                content=""
                                                value="%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%0A%3Cpath%20d%3D%22M20.9728%206.7174C20.5084%207.33692%2019.947%207.87733%2019.3103%208.31776C19.3103%208.47959%2019.3103%208.64142%2019.3103%208.81225C19.3154%2011.7511%2018.1415%2014.5691%2016.0518%2016.6345C13.962%2018.6999%2011.1312%2019.8399%208.19405%2019.7989C6.49599%2019.8046%204.81967%2019.4169%203.29642%2018.6661C3.21428%2018.6302%203.16131%2018.549%203.16162%2018.4593V18.3604C3.16162%2018.2313%203.26623%2018.1267%203.39527%2018.1267C5.06442%2018.0716%206.67402%2017.4929%207.99634%2016.4724C6.48553%2016.4419%205.12619%2015.5469%204.5006%2014.1707C4.46901%2014.0956%204.47884%2014.0093%204.52657%2013.9432C4.57429%2013.8771%204.653%2013.8407%204.73425%2013.8471C5.19342%2013.8932%205.65718%2013.8505%206.1002%2013.7212C4.43239%2013.375%203.17921%2011.9904%202.99986%2010.2957C2.99349%2010.2144%203.02992%2010.1357%203.096%2010.0879C3.16207%2010.0402%203.24824%2010.0303%203.32338%2010.062C3.77094%2010.2595%204.25409%2010.3635%204.74324%2010.3676C3.28184%209.40846%202.65061%207.58405%203.20655%205.92622C3.26394%205.76513%203.40181%205.64612%203.5695%205.61294C3.73718%205.57975%203.90996%205.63728%204.02432%205.76439C5.99639%207.86325%208.70604%209.11396%2011.5819%209.25279C11.5083%208.95885%2011.4721%208.65676%2011.4741%208.35372C11.501%206.76472%2012.4842%205.34921%2013.9634%204.76987C15.4425%204.19054%2017.1249%204.56203%2018.223%205.71044C18.9714%205.56785%2019.695%205.31645%2020.3707%204.96421C20.4202%204.93331%2020.483%204.93331%2020.5325%204.96421C20.5634%205.01373%2020.5634%205.07652%2020.5325%205.12604C20.2052%205.87552%2019.6523%206.50412%2018.9509%206.92419C19.5651%206.85296%2020.1685%206.70807%2020.7482%206.49264C20.797%206.45942%2020.8611%206.45942%2020.9099%206.49264C20.9508%206.51134%2020.9814%206.54711%2020.9935%206.59042C21.0056%206.63373%2020.998%206.68018%2020.9728%206.7174Z%22%20fill%3D%22CurrentColor%22%2F%3E%0A%3C%2Fsvg%3E" /></Link><Link
                                            block="inline"
                                            button={false}
                                            className="rl_blogpost1_social-link-2"
                                            options={facebookPostLink}><HtmlEmbed
                                                className="rl_blogpost1_social-icon-2"
                                                content=""
                                                value="%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%0A%3Cpath%20d%3D%22M16.5%206H13.5C12.9477%206%2012.5%206.44772%2012.5%207V10H16.5C16.6137%209.99748%2016.7216%2010.0504%2016.7892%2010.1419C16.8568%2010.2334%2016.8758%2010.352%2016.84%2010.46L16.1%2012.66C16.0318%2012.8619%2015.8431%2012.9984%2015.63%2013H12.5V20.5C12.5%2020.7761%2012.2761%2021%2012%2021H9.5C9.22386%2021%209%2020.7761%209%2020.5V13H7.5C7.22386%2013%207%2012.7761%207%2012.5V10.5C7%2010.2239%207.22386%2010%207.5%2010H9V7C9%204.79086%2010.7909%203%2013%203H16.5C16.7761%203%2017%203.22386%2017%203.5V5.5C17%205.77614%2016.7761%206%2016.5%206Z%22%20fill%3D%22CurrentColor%22%2F%3E%0A%3C%2Fsvg%3E" /></Link></Grid></Block></Block><Block className="rl_blogpost1_spacing-block-3-2" tag="div" /><Block className="rl_blogpost1_image-wrapper-2" tag="div"><Image
                                    alt=""
                                    className="rl_blogpost1_image-2"
                                    height="auto"
                                    loading="lazy"
                                    src={mainImage}
                                    width="auto" /></Block><Block className="rl_blogpost1_spacing-block-4-2" tag="div" /><Block className="rl_blogpost1_content-2" tag="div"><RichText className="rl-text-rich-text-2" slot="" tag="div" /><Block className="rl_blogpost1_spacing-block-5-2" tag="div" /><Block className="rl_blogpost1_content-bottom-2" tag="div"><Block className="rl_blogpost1_share-wrapper-2" tag="div"><Block className="rl-heading-style-h6-3" tag="div">{"Share this post"}</Block><Block className="rl_blogpost1_spacing-block-6-2" tag="div" /><Grid className="rl_blogpost1_share-2" tag="div"><Link
                                                block="inline"
                                                button={false}
                                                className="rl_blogpost1_social-link-2"
                                                id="w-node-_8283a533-ef6a-51c3-efc4-03bd674fa5d2-674fa5a0"
                                                options={originalLink}><HtmlEmbed
                                                    className="rl_blogpost1_social-icon-2"
                                                    content=""
                                                    value="%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%0A%3Cpath%20fill-rule%3D%22evenodd%22%20clip-rule%3D%22evenodd%22%20d%3D%22M20.9999%207.66008V8.00008C21.0007%209.06616%2020.576%2010.0885%2019.8199%2010.84L16.9999%2013.67C16.4738%2014.1911%2015.6261%2014.1911%2015.1%2013.67L15%2013.56C14.8094%2013.3656%2014.8094%2013.0544%2015%2012.86L18.4399%209.42006C18.807%209.03938%2019.0083%208.52883%2018.9999%208.00008V7.66008C19.0003%207.12705%2018.788%206.61589%2018.4099%206.2401L17.7599%205.59011C17.3841%205.21207%2016.873%204.99969%2016.3399%205.00011H15.9999C15.4669%204.99969%2014.9558%205.21207%2014.58%205.59011L11.14%209.00007C10.9456%209.19064%2010.6344%209.19064%2010.44%209.00007L10.33%208.89007C9.8089%208.36394%209.8089%207.51623%2010.33%206.99009L13.16%204.15012C13.9165%203.40505%2014.9382%202.99133%2015.9999%203.00014H16.3399C17.4011%202.9993%2018.4191%203.42018%2019.1699%204.17012L19.8299%204.83012C20.5798%205.5809%2021.0007%206.59891%2020.9999%207.66008ZM8.64993%2013.94L13.9399%208.65008C14.0338%208.55543%2014.1616%208.50218%2014.2949%208.50218C14.4282%208.50218%2014.556%208.55543%2014.6499%208.65008L15.3499%209.35007C15.4445%209.44395%2015.4978%209.57175%2015.4978%209.70507C15.4978%209.83839%2015.4445%209.96618%2015.3499%2010.0601L10.0599%2015.35C9.96604%2015.4447%209.83824%2015.4979%209.70492%2015.4979C9.57161%2015.4979%209.44381%2015.4447%209.34993%2015.35L8.64993%2014.65C8.55528%2014.5561%208.50204%2014.4283%208.50204%2014.295C8.50204%2014.1617%208.55528%2014.0339%208.64993%2013.94ZM13.5599%2015C13.3655%2014.8094%2013.0543%2014.8094%2012.8599%2015L9.42993%2018.41C9.0517%2018.7905%208.53645%2019.003%207.99995%2018.9999H7.65995C7.12691%2019.0004%206.61576%2018.788%206.23997%2018.41L5.58997%2017.76C5.21194%2017.3842%204.99956%2016.873%204.99998%2016.34V16C4.99956%2015.4669%205.21194%2014.9558%205.58997%2014.58L9.00993%2011.14C9.2005%2010.9456%209.2005%2010.6345%209.00993%2010.44L8.89993%2010.33C8.3738%209.80894%207.52609%209.80894%206.99996%2010.33L4.17999%2013.16C3.42392%2013.9116%202.99916%2014.9339%203%2016V16.35C3.00182%2017.4077%203.42249%2018.4216%204.16999%2019.1699L4.82998%2019.8299C5.58076%2020.5799%206.59878%2021.0008%207.65995%2020.9999H7.99995C9.05338%2021.0061%2010.0667%2020.5964%2010.8199%2019.8599L13.6699%2017.01C14.191%2016.4838%2014.191%2015.6361%2013.6699%2015.11L13.5599%2015Z%22%20fill%3D%22CurrentColor%22%2F%3E%0A%3C%2Fsvg%3E" /></Link><Link
                                                block="inline"
                                                button={false}
                                                className="rl_blogpost1_social-link-2"
                                                options={linkedinArticle}><HtmlEmbed
                                                    className="rl_blogpost1_social-icon-2"
                                                    content=""
                                                    value="%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%0A%3Cpath%20fill-rule%3D%22evenodd%22%20clip-rule%3D%22evenodd%22%20d%3D%22M5%203H19C20.1046%203%2021%203.89543%2021%205V19C21%2020.1046%2020.1046%2021%2019%2021H5C3.89543%2021%203%2020.1046%203%2019V5C3%203.89543%203.89543%203%205%203ZM8%2018C8.27614%2018%208.5%2017.7761%208.5%2017.5V10.5C8.5%2010.2239%208.27614%2010%208%2010H6.5C6.22386%2010%206%2010.2239%206%2010.5V17.5C6%2017.7761%206.22386%2018%206.5%2018H8ZM7.25%209C6.42157%209%205.75%208.32843%205.75%207.5C5.75%206.67157%206.42157%206%207.25%206C8.07843%206%208.75%206.67157%208.75%207.5C8.75%208.32843%208.07843%209%207.25%209ZM17.5%2018C17.7761%2018%2018%2017.7761%2018%2017.5V12.9C18.0325%2011.3108%2016.8576%209.95452%2015.28%209.76C14.177%209.65925%2013.1083%2010.1744%2012.5%2011.1V10.5C12.5%2010.2239%2012.2761%2010%2012%2010H10.5C10.2239%2010%2010%2010.2239%2010%2010.5V17.5C10%2017.7761%2010.2239%2018%2010.5%2018H12C12.2761%2018%2012.5%2017.7761%2012.5%2017.5V13.75C12.5%2012.9216%2013.1716%2012.25%2014%2012.25C14.8284%2012.25%2015.5%2012.9216%2015.5%2013.75V17.5C15.5%2017.7761%2015.7239%2018%2016%2018H17.5Z%22%20fill%3D%22CurrentColor%22%2F%3E%0A%3C%2Fsvg%3E" /></Link><Link
                                                block="inline"
                                                button={false}
                                                className="rl_blogpost1_social-link-2"
                                                options={twitterPostLink}><HtmlEmbed
                                                    className="rl_blogpost1_social-icon-2"
                                                    content=""
                                                    value="%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%0A%3Cpath%20d%3D%22M20.9728%206.7174C20.5084%207.33692%2019.947%207.87733%2019.3103%208.31776C19.3103%208.47959%2019.3103%208.64142%2019.3103%208.81225C19.3154%2011.7511%2018.1415%2014.5691%2016.0518%2016.6345C13.962%2018.6999%2011.1312%2019.8399%208.19405%2019.7989C6.49599%2019.8046%204.81967%2019.4169%203.29642%2018.6661C3.21428%2018.6302%203.16131%2018.549%203.16162%2018.4593V18.3604C3.16162%2018.2313%203.26623%2018.1267%203.39527%2018.1267C5.06442%2018.0716%206.67402%2017.4929%207.99634%2016.4724C6.48553%2016.4419%205.12619%2015.5469%204.5006%2014.1707C4.46901%2014.0956%204.47884%2014.0093%204.52657%2013.9432C4.57429%2013.8771%204.653%2013.8407%204.73425%2013.8471C5.19342%2013.8932%205.65718%2013.8505%206.1002%2013.7212C4.43239%2013.375%203.17921%2011.9904%202.99986%2010.2957C2.99349%2010.2144%203.02992%2010.1357%203.096%2010.0879C3.16207%2010.0402%203.24824%2010.0303%203.32338%2010.062C3.77094%2010.2595%204.25409%2010.3635%204.74324%2010.3676C3.28184%209.40846%202.65061%207.58405%203.20655%205.92622C3.26394%205.76513%203.40181%205.64612%203.5695%205.61294C3.73718%205.57975%203.90996%205.63728%204.02432%205.76439C5.99639%207.86325%208.70604%209.11396%2011.5819%209.25279C11.5083%208.95885%2011.4721%208.65676%2011.4741%208.35372C11.501%206.76472%2012.4842%205.34921%2013.9634%204.76987C15.4425%204.19054%2017.1249%204.56203%2018.223%205.71044C18.9714%205.56785%2019.695%205.31645%2020.3707%204.96421C20.4202%204.93331%2020.483%204.93331%2020.5325%204.96421C20.5634%205.01373%2020.5634%205.07652%2020.5325%205.12604C20.2052%205.87552%2019.6523%206.50412%2018.9509%206.92419C19.5651%206.85296%2020.1685%206.70807%2020.7482%206.49264C20.797%206.45942%2020.8611%206.45942%2020.9099%206.49264C20.9508%206.51134%2020.9814%206.54711%2020.9935%206.59042C21.0056%206.63373%2020.998%206.68018%2020.9728%206.7174Z%22%20fill%3D%22CurrentColor%22%2F%3E%0A%3C%2Fsvg%3E" /></Link><Link
                                                block="inline"
                                                button={false}
                                                className="rl_blogpost1_social-link-2"
                                                options={facebookPostLink}><HtmlEmbed
                                                    className="rl_blogpost1_social-icon-2"
                                                    content=""
                                                    value="%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%0A%3Cpath%20d%3D%22M16.5%206H13.5C12.9477%206%2012.5%206.44772%2012.5%207V10H16.5C16.6137%209.99748%2016.7216%2010.0504%2016.7892%2010.1419C16.8568%2010.2334%2016.8758%2010.352%2016.84%2010.46L16.1%2012.66C16.0318%2012.8619%2015.8431%2012.9984%2015.63%2013H12.5V20.5C12.5%2020.7761%2012.2761%2021%2012%2021H9.5C9.22386%2021%209%2020.7761%209%2020.5V13H7.5C7.22386%2013%207%2012.7761%207%2012.5V10.5C7%2010.2239%207.22386%2010%207.5%2010H9V7C9%204.79086%2010.7909%203%2013%203H16.5C16.7761%203%2017%203.22386%2017%203.5V5.5C17%205.77614%2016.7761%206%2016.5%206Z%22%20fill%3D%22CurrentColor%22%2F%3E%0A%3C%2Fsvg%3E" /></Link></Grid></Block><Block className="rl_blogpost1_tag-list-wrapper-2" tag="div"><Block className="rl_blogpost1_tag-list-2" tag="div"><Link
                                                block="inline"
                                                button={false}
                                                className="rl_blogpost1_tag-item-2"
                                                options={{
                                                    href: "https://miraka.ch/"
                                                }}><Block className="rl_blogpost1_tag-text-2" tag="div">{"Home"}</Block></Link><Link
                                                block="inline"
                                                button={false}
                                                className="rl_blogpost1_tag-item-2"
                                                options={{
                                                    href: "https://miraka.ch/about"
                                                }}><Block className="rl_blogpost1_tag-text-2" tag="div">{"About Us"}</Block></Link><Link
                                                block="inline"
                                                button={false}
                                                className="rl_blogpost1_tag-item-2"
                                                options={{
                                                    href: "https://miraka.ch/news"
                                                }}><Block className="rl_blogpost1_tag-text-2" tag="div">{"News"}</Block></Link><Link
                                                block="inline"
                                                button={false}
                                                className="rl_blogpost1_tag-item-2"
                                                options={{
                                                    href: "https://miraka.ch/contact"
                                                }}><Block className="rl_blogpost1_tag-text-2" tag="div">{"Contact"}</Block></Link></Block></Block></Block><Block className="rl_blogpost1_spacing-block-7-2" tag="div" /><Block className="rl_blogpost1_divider-2" tag="div" /><Block className="rl_blogpost1_spacing-block-8-2" tag="div" /><Block className="rl_blogpost1_author-wrapper-2" tag="div"><Block className="rl_blogpost1_author-image-wrapper-2" tag="div"><Image
                                            alt=""
                                            className="rl_blogpost1_author-image-2"
                                            height="auto"
                                            loading="lazy"
                                            src="https://cdn.prod.website-files.com/68dc2b9c31cb83ac9f84a1af/68fcee426f6ca9f3c11de324_insta%20profile%20pic%202.png"
                                            width="auto" /></Block><Block className="rl_blogpost1_details-wrapper-2" tag="div"><Block className="rl_blogpost1_author-text-large-2" tag="div">{auhorName}</Block><Block className="rl-text-style-regular-7" tag="div">{creditsTextFullLength}</Block></Block></Block></Block></Block></Block></Block></Block></_Component>
    );
}