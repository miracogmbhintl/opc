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

// OPC_WORKABILITY_VIEW_TRANSITION_COMPAT_V2
// Legacy page shells replace document.startViewTransition() to suppress motion.
// Astro 5 can call startViewTransition({ update, types }); the old shim ignored
// update(), which can change the URL without swapping the DOM and leave a blank page.
// This repair also forces the primary sidebar/mobile navigation through a normal
// document load while we remove the legacy shims page-by-page in the larger audit.
function injectOpcRuntimeSafety() {
  const runtimeScript = String.raw`
    (() => {
      const installViewTransitionCompatibility = () => {
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

      const installPrimaryNavigationFallback = () => {
        if (window.__OPC_PRIMARY_NAV_HARD_RELOAD__) return;
        window.__OPC_PRIMARY_NAV_HARD_RELOAD__ = true;

        document.addEventListener('click', (event) => {
          if (event.defaultPrevented || event.button !== 0) return;
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

          const target = event.target instanceof Element ? event.target : null;
          const link = target?.closest?.('.miraka-sidebar-desktop a[href], .miraka-mobile-nav a[href]');
          if (!(link instanceof HTMLAnchorElement)) return;
          if (link.target && link.target !== '_self') return;

          let url;
          try {
            url = new URL(link.href, window.location.href);
          } catch {
            return;
          }

          if (url.origin !== window.location.origin) return;
          const current = window.location.pathname + window.location.search + window.location.hash;
          const next = url.pathname + url.search + url.hash;
          if (current === next) {
            event.preventDefault();
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          window.location.assign(next);
        }, true);
      };

      installViewTransitionCompatibility();
      installPrimaryNavigationFallback();
      document.addEventListener('astro:page-load', installViewTransitionCompatibility);
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
