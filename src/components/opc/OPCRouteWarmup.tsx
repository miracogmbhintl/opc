import { useEffect } from 'react';

const WARMUP_ROUTES = [
  '/dashboard',
  '/anfragen',
  '/anfragen-schaeden',
  '/kunden',
  '/kunde-anlegen',
  '/einsatz-planen',
  '/einsaetze',
  '/berichte-dateien',
  '/kalender',
  '/qr-codes',
  '/work-os',
  '/work-os/boards',
  '/einstellungen',
  '/forgot-password',
  '/reset-password',
  '/set-password',
  '/emergency-login',
];

declare global {
  interface Window {
    __opcRouteWarmupDone?: boolean;
  }
}

export default function OPCRouteWarmup() {
  useEffect(() => {
    if (window.__opcRouteWarmupDone) return;

    window.__opcRouteWarmupDone = true;

    const warmup = () => {
      WARMUP_ROUTES.forEach((route, index) => {
        if (route === window.location.pathname) return;

        window.setTimeout(() => {
          fetch(route, {
            method: 'GET',
            credentials: 'include',
            cache: 'force-cache',
          }).catch(() => {
            // Ignore warmup failures. Real navigation will still load normally.
          });
        }, index * 250);
      });
    };

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(warmup, { timeout: 2500 });
    } else {
      window.setTimeout(warmup, 1500);
    }
  }, []);

  return null;
}
