import type { APIRoute } from 'astro';
import {
  officeErrorResponse,
  officeJson,
  requireOpcOfficeAuth,
} from '../../../../lib/opc-office-auth';
import { getOpcServerEnvValue } from '../../../../lib/opc-server-env';

export const prerender = false;

const DEFAULT_ENGINE_URL = 'https://office.opc.miraka.ch';

export const GET: APIRoute = async ({ request, locals, cookies }) => {
  try {
    await requireOpcOfficeAuth({ request, locals, cookies });

    const serverUrl = (
      getOpcServerEnvValue(locals, 'EURO_OFFICE_URL') || DEFAULT_ENGINE_URL
    ).replace(/\/+$/, '');
    const jwtSecret = getOpcServerEnvValue(locals, 'EURO_OFFICE_JWT_SECRET');
    const configured = Boolean(serverUrl && jwtSecret.length >= 24);

    if (!configured) {
      return officeJson({
        success: true,
        configured: false,
        reachable: false,
        status: 'configuration_required',
        message: 'Der Office-Editor wird noch eingerichtet.',
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${serverUrl}/healthcheck`, {
        method: 'GET',
        headers: { Accept: 'text/plain' },
        signal: controller.signal,
      });
      const body = await response.text();
      const reachable = response.ok && body.trim().toLowerCase() === 'true';

      return officeJson({
        success: true,
        configured: true,
        reachable,
        status: reachable ? 'ready' : 'starting',
        message: reachable
          ? 'Word, Excel und PowerPoint sind bereit.'
          : 'Der Office-Editor startet gerade.',
      });
    } catch {
      return officeJson({
        success: true,
        configured: true,
        reachable: false,
        status: 'unreachable',
        message: 'Der Office-Editor ist momentan nicht erreichbar.',
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    return officeErrorResponse(error);
  }
};
