import type { APIRoute } from 'astro';
import { startExportVerification } from '../../../../../lib/opc-data-export-security';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  return startExportVerification(request, locals);
};
