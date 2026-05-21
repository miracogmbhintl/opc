'use client';
import React from 'react';
import { onKeyDownInputHandlers } from './shared/formUtils';
const SearchButton = React.forwardRef(function SearchButton({ value = '', className = '', ...props }, ref) {
    return React.createElement('input', {
        ...props,
        type: 'submit',
        value,
        className: className + ' w-button',
        onKeyDown: onKeyDownInputHandlers,
        ref,
    });
});
export default SearchButton;
