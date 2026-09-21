import type { APIRoute } from 'astro';
import { verifyExportVerification } from '../../../../../lib/opc-data-export-security';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  return verifyExportVerification(request, locals);
};
