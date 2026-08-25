import { FunctionsHttpError } from '@supabase/supabase-js';

/**
 * When a Supabase Edge Function responds with a non-2xx status, supabase-js
 * wraps it in a generic error ("non-2xx status code") and hides the real body
 * we returned (`{ ok: false, error: '...' }`) inside `error.context` (the raw
 * Response) — this reads it back out so callers can show the real reason
 * instead of the generic message.
 */
export async function readFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      if (typeof body?.error === 'string') return body.error;
    } catch {
      // el cuerpo no era JSON — se usa el fallback
    }
  }
  return error instanceof Error ? error.message : fallback;
}
