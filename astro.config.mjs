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
          injectScript('page', `import "${scriptPath}";`);
        }
      },
    },
  };
}

// OPC_VIEW_TRANSITION_COMPAT_V2
// Legacy page shells replace document.startViewTransition() to suppress motion.
// Astro 5 may pass { update, types } instead of a plain callback. The old shim
// ignored update(), so a client-side route change could update the URL without
// swapping the DOM, leaving the app blank. This global repair preserves no-motion
// behavior while supporting both forms of the View Transitions API.
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
    host: true,
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
      external: ['html2canvas'],
      noExternal: ['@supabase/supabase-js', '@supabase/gotrue-js'],
    },
    server: {
      watch: {
        usePolling: true,
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
      alias: import.meta.env.PROD
        ? {
            'react-dom/server': 'react-dom/server.edge',
          }
        : undefined,
    },
  },
});
