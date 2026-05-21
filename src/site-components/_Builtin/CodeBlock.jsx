'use client';
import * as React from 'react';
const CodeBlock = React.forwardRef(function CodeBlock(props, ref) {
    return React.createElement("pre", { ...props, ref: ref });
});
export default CodeBlock;
