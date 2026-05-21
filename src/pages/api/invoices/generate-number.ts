/**
 * API Endpoint: Generate Invoice Number
 * Route: /api/invoices/generate-number
 * Purpose: Generate next sequential invoice number for given date
 * Format: XXMMYY (e.g., 010126 for first invoice in January 2026)
 */

import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../../lib/supabase-admin';

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    // Initialize Supabase admin client
    const supabase = getSupabaseAdmin(locals?.runtime?.env);

    // Check authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse query params
    const url = new URL(request.url);
    const dateParam = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
    
    // Try to use RPC function first
    try {
      const { data, error } = await supabase.rpc('generate_invoice_number', {
        for_date: dateParam
      });

      if (!error && data) {
        return new Response(JSON.stringify({ invoice_number: data }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch (rpcError) {
      console.log('RPC function not available, falling back to manual generation');
    }

    // Fallback: Generate manually
    const date = new Date(dateParam);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    
    // Get count of invoices in this month/year
    const { data: invoices, error: queryError } = await supabase
      .from('invoices')
      .select('invoice_number')
      .ilike('invoice_number', `__${month}${year}`);

    if (queryError) {
      throw queryError;
    }

    // Calculate next sequence number
    let maxSequence = 0;
    if (invoices && invoices.length > 0) {
      invoices.forEach((inv: any) => {
        const sequence = parseInt(inv.invoice_number.substring(0, 2), 10);
        if (sequence > maxSequence) {
          maxSequence = sequence;
        }
      });
    }

    const nextSequence = String(maxSequence + 1).padStart(2, '0');
    const invoiceNumber = `${nextSequence}${month}${year}`;

    return new Response(JSON.stringify({ invoice_number: invoiceNumber }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error generating invoice number:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to generate invoice number',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

