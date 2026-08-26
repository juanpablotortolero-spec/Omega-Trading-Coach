// Calendario económico server-side. El feed de ForexFactory no tiene CORS
// habilitado, así que antes se llamaba desde el navegador a través de un
// proxy CORS público (corsproxy.io) — frágil en producción (rate limits,
// bloqueos, caídas del proxy) porque TODOS los usuarios comparten ese mismo
// punto de falla. Un servidor llamando a otro servidor no tiene restricción
// CORS: esta función hace el fetch directo, sin proxy de por medio.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const FEED_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, error: 'No autenticado.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await callerClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ ok: false, error: 'No autenticado.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const feedResponse = await fetch(FEED_URL);
    if (!feedResponse.ok) {
      throw new Error(`El feed de ForexFactory respondió ${feedResponse.status}.`);
    }
    const events = await feedResponse.json();

    return new Response(JSON.stringify(events), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo cargar el calendario económico.';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
