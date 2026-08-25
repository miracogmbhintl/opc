import {defineConfig} from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// Patches node_modules/vite/dist/client/client.mjs
function patchViteErrorOverlay() {
  return {
    name: 'patch-vite-error-overlay',
    transform(code, id) {
      if (id.includes('vite/dist/client/client.mjs')) {
        return code.replace(
          /const editorLink = this\.createLink\(`Open in editor\${[^}]*}\`, void 0\);[\s\S]*?codeHeader\.appendChild\(editorLink\);/g,
          ''
        );
      }
    },
  };
}

/**
 * Astro integration to inject development-only scripts
 */
function injectDevScript(options = {}) {
  const {scriptPath} = options;

  if (!scriptPath) {
    throw new Error('injectDevScript requires a scriptPath');
  }

  return {
    name: 'inject-dev-script',
    hooks: {
      'astro:config:setup': ({injectScript, command, logger}) => {
        if (command === 'dev') {
          logger.info(`Injecting dev script: ${scriptPath}`);

          // Inject as ES module
          injectScript('page', `import "${scriptPath}";`);
        }
      },
    },
  };
}

// OPC_VIEW_TRANSITION_COMPAT_V2
// A legacy no-motion shim is still embedded in older page shells. Astro 5 can call
// document.startViewTransition() with an options object ({ update, types }) instead
// of only a callback function. The legacy shim ignored options.update(), preventing
// the DOM swap and leaving a blank page. Repair that shim globally without enabling
// visual motion or changing normal full-page navigation.
function injectOpcRuntimeSafety() {
  const runtimeScript = String.raw`
    (() => {
      const installOpcViewTransitionCompatibility = () => {
        if (typeof window === 'undefined' || typeof document === 'undefined') return;
        if (!window.__OPC_NO_MOTION_VIEW_TRANSITIONS__) return;

        const noMotionTransition = (transitionInput) => {
          const update =
            typeof transitionInput === 'function'
              ? transitionInput
              : transitionInput && typeof transitionInput.update === 'function'
                ? transitionInput.update
                : null;

          let updateCallbackDone;

          try {
            updateCallbackDone = Promise.resolve(update ? update() : undefined);
          } catch (error) {
            updateCallbackDone = Promise.reject(error);
          }

          const ready = Promise.resolve();
          const finished = updateCallbackDone.then(() => undefined);
          const requestedTypes =
            transitionInput && typeof transitionInput === 'object' && Array.isArray(transitionInput.types)
              ? transitionInput.types
              : [];

          return {
            ready,
            updateCallbackDone,
            finished,
            skipTransition() {},
            types: new Set(requestedTypes),
          };
        };

        try {
          Object.defineProperty(document, 'startViewTransition', {
            configurable: true,
            writable: true,
            value: noMotionTransition,
          });
        } catch {
          document.startViewTransition = noMotionTransition;
        }
      };

      installOpcViewTransitionCompatibility();
      document.addEventListener('astro:page-load', installOpcViewTransitionCompatibility);
    })();
  `;

  return {
    name: 'opc-runtime-safety',
    hooks: {
      'astro:config:setup': ({injectScript}) => {
        injectScript('page', runtimeScript);
      },
    },
  };
}

// https://astro.build/config
export default defineConfig({
  base: '',
  output: 'server',
  devToolbar: {
    enabled: false,
  },
  server: {
    port: 3000,
    host: true, // Listen on all network interfaces (0.0.0.0)
    strictPort: true,
  },
  adapter: cloudflare({
    mode: 'directory'
  }),
  prefetch: false,

  integrations: [
    react(),
    injectDevScript({scriptPath: '/generated/dev-only.js'}),
    injectOpcRuntimeSafety(),
  ],
  vite: {
    plugins: [tailwindcss(), patchViteErrorOverlay()],
    ssr: {
      // Externalize packages that have Node-only APIs
      // These should not be bundled into the Worker
      external: ['html2canvas'],
      // Don't attempt to transform these in SSR
      noExternal: ['@supabase/supabase-js', '@supabase/gotrue-js'],
    },
    server: {
      watch: {
        usePolling: true, // Enable polling for file watching in Docker
        interval: 1000,
        ignored: [
          '**/lost+found/**',
          '**/dist/**',
          '**/node_modules/**',
          '**/src/site-components/**',
        ],
      },
    },
    resolve: {
      // Use react-dom/server.edge instead of react-dom/server.browser for React 19.
      // Without this, MessageChannel from node:worker_threads needs to be polyfilled.
      alias: import.meta.env.PROD
        ? {
            'react-dom/server': 'react-dom/server.edge',
          }
        : undefined,
    },
  },
});
