// Arma las operaciones cerradas de hoy desde la API de Tradovate y las
// devuelve YA estandarizadas al navegador (mismo shape que usa el CSV). No
// escribe en Supabase — eso lo hace el navegador reutilizando
// ensureJournalEntryForDate/insertSyncedOperations de src/lib/api.ts, para no
// duplicar la lógica de deduplicación en Deno.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import {
  getContractName,
  getFillPairs,
  getFills,
  getTradovateAccessToken,
  guessPointValue,
  type TradovateEnv,
} from '../_shared/tradovate.ts';

type OutTrade = {
  ticker: string;
  direction: 'long' | 'short' | null;
  lotSize: number | null;
  entryTime: string | null;
  exitTime: string | null;
  netPnl: number | null;
};

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

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: connection, error: connError } = await adminClient
      .from('broker_connections')
      .select('credentials')
      .eq('user_id', user.id)
      .eq('broker', 'tradovate')
      .maybeSingle();

    if (connError) throw connError;
    if (!connection) {
      return new Response(
        JSON.stringify({ ok: false, error: 'No has conectado tu cuenta de Tradovate todavía.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const creds = connection.credentials as {
      name: string;
      password: string;
      cid: string;
      sec: string;
      env: TradovateEnv;
    };

    const accessToken = await getTradovateAccessToken(creds);
    const [fills, fillPairs] = await Promise.all([
      getFills(creds.env, accessToken),
      getFillPairs(creds.env, accessToken),
    ]);

    const fillById = new Map(fills.map((fill) => [fill.id, fill]));
    const todayKey = new Date().toISOString().slice(0, 10);

    const contractNameCache = new Map<number, string>();
    const resolveContractName = async (contractId: number): Promise<string> => {
      const cached = contractNameCache.get(contractId);
      if (cached) return cached;
      const contract = await getContractName(creds.env, accessToken, contractId);
      contractNameCache.set(contractId, contract.name);
      return contract.name;
    };

    const trades: OutTrade[] = [];

    for (const pair of fillPairs) {
      const buyFill = fillById.get(pair.buyFillId);
      const sellFill = fillById.get(pair.sellFillId);
      if (!buyFill || !sellFill) continue;

      const entryFill = new Date(buyFill.timestamp) <= new Date(sellFill.timestamp) ? buyFill : sellFill;
      const exitFill = entryFill === buyFill ? sellFill : buyFill;
      const direction: 'long' | 'short' = entryFill === buyFill ? 'long' : 'short';

      // Solo las operaciones cerradas hoy — igual que el flujo de CSV, que
      // agrupa por la fecha de la hora de entrada.
      if (entryFill.timestamp.slice(0, 10) !== todayKey) continue;

      const contractName = await resolveContractName(buyFill.contractId);
      const pointValue = guessPointValue(contractName);
      const netPnl = Math.round((pair.sellPrice - pair.buyPrice) * pair.qty * pointValue * 100) / 100;

      trades.push({
        ticker: contractName,
        direction,
        lotSize: pair.qty,
        entryTime: new Date(entryFill.timestamp).toISOString(),
        exitTime: new Date(exitFill.timestamp).toISOString(),
        netPnl,
      });
    }

    return new Response(JSON.stringify({ ok: true, trades }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo sincronizar con Tradovate.';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
