import type { MiddlewareHandler } from 'astro';

/**
 * Global error-catching middleware for Cloudflare Workers
 * This prevents uncaught exceptions from crashing the entire Worker
 */
export const onRequest: MiddlewareHandler = async (context, next) => {
  try {
    // Pass environment variables to locals for SSR access
    if (context.locals.runtime?.env) {
      // Make env accessible throughout the app
      context.locals.env = context.locals.runtime.env;
    }
    
    return await next();
  } catch (err) {
    // Log the error for debugging
    console.error('[Worker Error]:', err);
    
    // In production, return a proper error response
    if (import.meta.env.PROD) {
      return new Response(
        JSON.stringify({
          error: 'Internal Server Error',
          message: err instanceof Error ? err.message : 'Unknown error',
          stack: err instanceof Error ? err.stack : undefined,
        }),
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }
    
    // In dev, re-throw to see full stack trace
    throw err;
  }
};
