(() => {
  if (window.__OPC_PRIVATE_JOB_MEDIA_RUNTIME__) {
    window.__OPC_PRIVATE_JOB_MEDIA_RUNTIME__.activate();
    return;
  }

  window.__OPC_PRIVATE_JOB_MEDIA_BRIDGE__ = true;

  const marker = '/storage/v1/object/public/opc-job-media/';
  const endpoint = '/api/opc/jobs/media-file?path=';
  const originalOpen = window.open.bind(window);
  let observer = null;

  function isMediaRoute() {
    const path = window.location.pathname;
    return path.startsWith('/einsatz/') || path.startsWith('/bericht/');
  }

  function protectedUrl(raw) {
    const value = String(raw || '').trim();
    if (!value || value.startsWith(endpoint)) return '';

    try {
      const url = new URL(value, window.location.href);
      const markerIndex = url.pathname.indexOf(marker);
      if (markerIndex < 0) return '';

      const path = decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
      if (!path || path.includes('..') || path.includes('\\')) return '';

      return `${endpoint}${encodeURIComponent(path)}`;
    } catch {
      return '';
    }
  }

  function rewriteAttribute(element, attribute) {
    if (!(element instanceof Element) || !element.hasAttribute(attribute)) return;
    const current = element.getAttribute(attribute) || '';
    const replacement = protectedUrl(current);
    if (replacement && replacement !== current) element.setAttribute(attribute, replacement);
  }

  function rewriteNode(node) {
    if (!(node instanceof Element)) return;

    for (const attribute of ['src', 'href', 'poster']) {
      rewriteAttribute(node, attribute);
    }

    for (const element of node.querySelectorAll('[src], [href], [poster]')) {
      for (const attribute of ['src', 'href', 'poster']) {
        rewriteAttribute(element, attribute);
      }
    }
  }

  window.open = (url, target, features) => {
    if (!isMediaRoute()) return originalOpen(url, target, features);
    const replacement = protectedUrl(url);
    return originalOpen(replacement || url, target, features);
  };

  function disconnectObserver() {
    if (!observer) return;
    observer.disconnect();
    observer = null;
  }

  function activate() {
    if (!isMediaRoute()) {
      disconnectObserver();
      return;
    }

    rewriteNode(document.documentElement);

    if (!observer) {
      observer = new MutationObserver((mutations) => {
        if (!isMediaRoute()) {
          disconnectObserver();
          return;
        }

        for (const mutation of mutations) {
          if (mutation.type === 'attributes') {
            rewriteAttribute(mutation.target, mutation.attributeName || '');
            continue;
          }

          for (const addedNode of mutation.addedNodes) rewriteNode(addedNode);
        }
      });

      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['src', 'href', 'poster'],
      });
    }
  }

  function deactivate() {
    disconnectObserver();
  }

  window.__OPC_PRIVATE_JOB_MEDIA_RUNTIME__ = { activate, deactivate };
  document.addEventListener('astro:page-load', activate);
  document.addEventListener('astro:before-swap', deactivate);
  activate();
})();
