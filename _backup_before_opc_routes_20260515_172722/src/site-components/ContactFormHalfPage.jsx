"use client";
import React from "react";
import Block from "./_Builtin/Block";
import FormBlockLabel from "./_Builtin/FormBlockLabel";
import FormButton from "./_Builtin/FormButton";
import FormCheckboxInput from "./_Builtin/FormCheckboxInput";
import FormCheckboxWrapper from "./_Builtin/FormCheckboxWrapper";
import FormErrorMessage from "./_Builtin/FormErrorMessage";
import FormForm from "./_Builtin/FormForm";
import FormInlineLabel from "./_Builtin/FormInlineLabel";
import FormRadioInput from "./_Builtin/FormRadioInput";
import FormRadioWrapper from "./_Builtin/FormRadioWrapper";
import FormSelect from "./_Builtin/FormSelect";
import FormSuccessMessage from "./_Builtin/FormSuccessMessage";
import FormTextarea from "./_Builtin/FormTextarea";
import FormTextInput from "./_Builtin/FormTextInput";
import FormWrapper from "./_Builtin/FormWrapper";
import Grid from "./_Builtin/Grid";
import Link from "./_Builtin/Link";

export function ContactFormHalfPage(
    {
        as: _Component = Block
    }
) {
    return (
        <_Component className="rl-padding-global-9" tag="div"><Block className="rl-container-large-8" tag="div"><Block className="rl-padding-section-large-7" tag="div"><FormWrapper
                        className="rl_contact6_form-block"
                        id="w-node-ac11684c-d2a4-8eef-b14b-69b8010b80ee-010b80eb"><FormForm
                            className="rl_contact6_form"
                            data-name="M&CO KONTAKT"
                            data-redirect="/brand-framework"
                            id="wf-form-M-CO-KONTAKT"
                            method="get"
                            name="wf-form-M-CO-KONTAKT"
                            redirect="/brand-framework"><Block className="rl_contact6_form-field-2col" tag="div"><Block className="rl_contact6_form-field-wrapper" tag="div"><FormBlockLabel className="rl-field-label" htmlFor="first_name">{"Vorname"}</FormBlockLabel><FormTextInput
                                        autoFocus={false}
                                        className="rl-form-input-2"
                                        data-name="first_name"
                                        disabled={false}
                                        id="first_name"
                                        maxLength={256}
                                        name="first_name"
                                        required={true}
                                        type="text" /></Block><Block className="rl_contact6_form-field-wrapper" tag="div"><FormBlockLabel className="rl-field-label" htmlFor="last_name">{"Nachname"}</FormBlockLabel><FormTextInput
                                        autoFocus={false}
                                        className="rl-form-input-2"
                                        data-name="last_name"
                                        disabled={false}
                                        id="last_name"
                                        maxLength={256}
                                        name="last_name"
                                        required={true}
                                        type="text" /></Block></Block><Block className="rl_contact6_form-field-2col" tag="div"><Block className="rl_contact6_form-field-wrapper" tag="div"><FormBlockLabel className="rl-field-label" htmlFor="email">{"Email Adresse"}</FormBlockLabel><FormTextInput
                                        autoFocus={false}
                                        className="rl-form-input-2"
                                        data-name="email"
                                        disabled={false}
                                        id="email"
                                        maxLength={256}
                                        name="email"
                                        required={true}
                                        type="email" /></Block><Block className="rl_contact6_form-field-wrapper" tag="div"><FormBlockLabel className="rl-field-label" htmlFor="phone">{"Telefon Nummer"}</FormBlockLabel><FormTextInput
                                        autoFocus={false}
                                        className="rl-form-input-2"
                                        data-name="phone"
                                        disabled={false}
                                        id="phone"
                                        maxLength={256}
                                        name="phone"
                                        required={false}
                                        type="tel" /></Block></Block><Block className="rl_contact6_form-field-wrapper" tag="div"><Block className="rl_contact6_spacing-block-5" tag="div" /><FormBlockLabel className="rl-field-label" htmlFor="Contact-2-Select">{"Womit können wir Sie helfen?"}</FormBlockLabel><Block className="rl_contact6_spacing-block-6" tag="div" /><Grid className="rl-form-radio-2col" tag="div"><FormRadioWrapper
                                        className="rl-form-radio"
                                        id="w-node-ac11684c-d2a4-8eef-b14b-69b8010b810c-010b80eb"><FormRadioInput
                                            className="rl-form-radio-icon"
                                            customClassName="w-form-formradioinput--inputType-custom"
                                            data-name="inquiry_topic"
                                            form={{
                                                type: "radio-input",
                                                name: "inquiry_topic"
                                            }}
                                            id="Branding-2"
                                            inputType="custom"
                                            name="inquiry_topic"
                                            required={false}
                                            type="radio"
                                            value="Branding" /><FormInlineLabel className="rl-form-radio-label" htmlFor="Contact 6 Radio -8">{"Branding"}</FormInlineLabel></FormRadioWrapper><FormRadioWrapper className="rl-form-radio"><FormRadioInput
                                            className="rl-form-radio-icon"
                                            customClassName="w-form-formradioinput--inputType-custom"
                                            data-name="inquiry_topic"
                                            form={{
                                                type: "radio-input",
                                                name: "inquiry_topic"
                                            }}
                                            id="Web-Design-Web-Development"
                                            inputType="custom"
                                            name="inquiry_topic"
                                            required={false}
                                            type="radio"
                                            value="Web Design / Web Development" /><FormInlineLabel className="rl-form-radio-label" htmlFor="Contact 6 Radio -8">{"Web Design / Web Dev"}</FormInlineLabel></FormRadioWrapper><FormRadioWrapper className="rl-form-radio"><FormRadioInput
                                            className="rl-form-radio-icon"
                                            customClassName="w-form-formradioinput--inputType-custom"
                                            data-name="inquiry_topic"
                                            form={{
                                                type: "radio-input",
                                                name: "inquiry_topic"
                                            }}
                                            id="App-Design-App-Development"
                                            inputType="custom"
                                            name="inquiry_topic"
                                            required={false}
                                            type="radio"
                                            value="App Design / App Development" /><FormInlineLabel className="rl-form-radio-label" htmlFor="Contact 6 Radio -8">{"App Design / App Dev"}</FormInlineLabel></FormRadioWrapper><FormRadioWrapper
                                        className="rl-form-radio"
                                        id="w-node-ac11684c-d2a4-8eef-b14b-69b8010b8118-010b80eb"><FormRadioInput
                                            className="rl-form-radio-icon"
                                            customClassName="w-form-formradioinput--inputType-custom"
                                            data-name="inquiry_topic"
                                            form={{
                                                type: "radio-input",
                                                name: "inquiry_topic"
                                            }}
                                            id="Social-Media"
                                            inputType="custom"
                                            name="inquiry_topic"
                                            required={false}
                                            type="radio"
                                            value="Social Media" /><FormInlineLabel className="rl-form-radio-label" htmlFor="Contact 6 Radio -8">{"Social Media"}</FormInlineLabel></FormRadioWrapper><FormRadioWrapper
                                        className="rl-form-radio"
                                        id="w-node-ac11684c-d2a4-8eef-b14b-69b8010b811c-010b80eb"><FormRadioInput
                                            className="rl-form-radio-icon"
                                            customClassName="w-form-formradioinput--inputType-custom"
                                            data-name="inquiry_topic"
                                            form={{
                                                type: "radio-input",
                                                name: "inquiry_topic"
                                            }}
                                            id="Workflow-Automations"
                                            inputType="custom"
                                            name="inquiry_topic"
                                            required={false}
                                            type="radio"
                                            value="Workflow Automations" /><FormInlineLabel className="rl-form-radio-label" htmlFor="Contact 6 Radio -8">{"Workflow Automations"}</FormInlineLabel></FormRadioWrapper><FormRadioWrapper
                                        className="rl-form-radio"
                                        id="w-node-ac11684c-d2a4-8eef-b14b-69b8010b8120-010b80eb"><FormRadioInput
                                            className="rl-form-radio-icon"
                                            customClassName="w-form-formradioinput--inputType-custom"
                                            data-name="inquiry_topic"
                                            form={{
                                                type: "radio-input",
                                                name: "inquiry_topic"
                                            }}
                                            id="Advertisement"
                                            inputType="custom"
                                            name="inquiry_topic"
                                            required={false}
                                            type="radio"
                                            value="Advertisement" /><FormInlineLabel className="rl-form-radio-label" htmlFor="Contact 6 Radio -8">{"Advertisement"}</FormInlineLabel></FormRadioWrapper><FormRadioWrapper
                                        className="rl-form-radio"
                                        id="w-node-ac11684c-d2a4-8eef-b14b-69b8010b8124-010b80eb"><FormRadioInput
                                            className="rl-form-radio-icon"
                                            customClassName="w-form-formradioinput--inputType-custom"
                                            data-name="inquiry_topic"
                                            form={{
                                                type: "radio-input",
                                                name: "inquiry_topic"
                                            }}
                                            id="Weiteres"
                                            inputType="custom"
                                            name="inquiry_topic"
                                            required={false}
                                            type="radio"
                                            value="Weiteres" /><FormInlineLabel className="rl-form-radio-label" htmlFor="Contact 6 Radio -8">{"Weiteres"}</FormInlineLabel></FormRadioWrapper></Grid><Block className="rl_contact6_spacing-block-5" tag="div" /></Block><Block className="rl_contact6_form-field-wrapper" tag="div"><FormBlockLabel className="rl-field-label" htmlFor="message">{"Ihre Nachricht"}</FormBlockLabel><FormTextarea
                                    autoFocus={false}
                                    className="rl-form-text-area"
                                    data-name="message"
                                    id="message"
                                    maxLength={5000}
                                    name="message"
                                    placeholder="Hier eingeben."
                                    required={true} /></Block><FormCheckboxWrapper
                                className="rl-form-checkbox w-node-ac11684c-d2a4-8eef-b14b-69b8010b812d-010b80eb"
                                id="Contact-6-Checkbox"><FormCheckboxInput
                                    checked={true}
                                    className="rl-form-checkbox-icon"
                                    customClassName="w-checkbox-input--inputType-custom"
                                    data-name="privacy_consent, email_marketing_consent"
                                    form={{
                                        type: "checkbox-input",
                                        name: "privacy_consent, email_marketing_consent"
                                    }}
                                    id="privacy_consent-email_marketing_consent"
                                    inputType="custom"
                                    name="privacy_consent-email_marketing_consent"
                                    required={true}
                                    type="checkbox" /><FormInlineLabel className="rl-checkbox-label-small" htmlFor="Contact 6 Checkbox-2">{"Ich akzeptiere die "}<Link
                                        block=""
                                        button={false}
                                        className="link-9"
                                        options={{
                                            href: "#"
                                        }}>{"Datenschutzerklärung"}</Link>{" und "}<Link
                                        block=""
                                        button={false}
                                        className="link-10"
                                        options={{
                                            href: "#"
                                        }}>{"AGB"}</Link>{" und erlaube Miraka & Co. Intl. mir gelegentlich E-Mails zu Projekten, Geschäftsberichten und Angeboten zu senden. Keine Werbung, kein Spam. Abmeldung jederzeit möglich."}</FormInlineLabel></FormCheckboxWrapper><Block
                                className="rl_contact6_button-wrapper"
                                id="w-node-ac11684c-d2a4-8eef-b14b-69b8010b8137-010b80eb"
                                tag="div"><Block className="rl_contact6_spacing-block-7" tag="div" /><FormButton
                                    className="rl-button-5"
                                    data-wait="Bitte warten..."
                                    id="w-node-ac11684c-d2a4-8eef-b14b-69b8010b8139-010b80eb"
                                    type="submit"
                                    value="Anfragen" /></Block></FormForm><FormSuccessMessage className="rl-success-message-2"><Block className="rl-success-text-2" tag="div">{"Thank you! Your submission has been received!"}</Block></FormSuccessMessage><FormErrorMessage className="rl-error-message-2"><Block className="rl-error-text-2" tag="div">{"Oops! Something went wrong while submitting the form."}</Block></FormErrorMessage></FormWrapper></Block></Block></_Component>
    );
}