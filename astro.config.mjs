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

// OPC_WORKABILITY_VIEW_TRANSITION_COMPAT_V1
// Several legacy page shells replace document.startViewTransition() to suppress
// animation. Astro 5 can call startViewTransition({ update, types }); the old shim
// ignored update(), which changes the URL without swapping the DOM and leaves a
// blank page. Re-install a compatible no-motion implementation after every page load.
function injectOpcRuntimeSafety() {
  const runtimeScript = String.raw`
    (() => {
      const install = () => {
        if (typeof window === 'undefined' || typeof document === 'undefined') return;
        if (!window.__OPC_NO_MOTION_VIEW_TRANSITIONS__) return;

        const noMotionTransition = (input) => {
          const update =
            typeof input === 'function'
              ? input
              : input && typeof input.update === 'function'
                ? input.update
                : null;

          let updateCallbackDone;
          try {
            updateCallbackDone = Promise.resolve(update ? update() : undefined);
          } catch (error) {
            updateCallbackDone = Promise.reject(error);
          }

          const requestedTypes =
            input && typeof input === 'object' && Array.isArray(input.types)
              ? input.types
              : [];

          return {
            ready: Promise.resolve(),
            updateCallbackDone,
            finished: updateCallbackDone.then(() => undefined),
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

      install();
      document.addEventListener('astro:page-load', install);
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
