// Valida credenciales de Tradovate y las guarda server-side. El navegador
// nunca vuelve a ver la contraseña ni el secret una vez enviados aquí — esta
// función corre en el servidor de Supabase, no en el bundle de la app.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { getTradovateAccessToken, type TradovateEnv } from '../_shared/tradovate.ts';

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
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Cliente "como el usuario" solo para identificarlo a partir de su JWT.
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

    const body = await req.json();
    const name = String(body.name ?? '');
    const password = String(body.password ?? '');
    const cid = String(body.cid ?? '');
    const sec = String(body.sec ?? '');
    const env: TradovateEnv = body.env === 'live' ? 'live' : 'demo';

    if (!name || !password || !cid || !sec) {
      return new Response(JSON.stringify({ ok: false, error: 'Faltan campos (usuario, contraseña, CID o Secret).' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Valida las credenciales pidiendo un token real antes de guardarlas.
    await getTradovateAccessToken({ name, password, cid, sec, env });

    // Cliente con Service Role — la única forma de escribir en
    // broker_connections, que no tiene ninguna policy RLS para 'authenticated'.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { error: upsertError } = await adminClient.from('broker_connections').upsert(
      {
        user_id: user.id,
        broker: 'tradovate',
        credentials: { name, password, cid, sec, env },
        connected_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,broker' },
    );

    if (upsertError) throw upsertError;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo conectar con Tradovate.';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
