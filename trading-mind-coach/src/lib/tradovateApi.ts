import { supabase } from './supabaseClient';
import { readFunctionErrorMessage } from './functionsError';
import type { SyncedTradeInput } from './api';

/**
 * Capa delgada del navegador — solo invoca los Edge Functions de Tradovate.
 * Ninguna credencial ni lógica de negocio vive aquí; eso corre server-side en
 * supabase/functions/tradovate-connect y tradovate-sync.
 */

export type TradovateConnectInput = {
  name: string;
  password: string;
  cid: string;
  sec: string;
  env: 'demo' | 'live';
};

export async function connectTradovateAccount(
  input: TradovateConnectInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase.functions.invoke('tradovate-connect', { body: input });
  if (error) return { ok: false, error: await readFunctionErrorMessage(error, 'No se pudo conectar con Tradovate.') };
  return data as { ok: true } | { ok: false; error: string };
}

export async function syncTradovateTrades(): Promise<
  { ok: true; trades: SyncedTradeInput[] } | { ok: false; error: string }
> {
  const { data, error } = await supabase.functions.invoke('tradovate-sync');
  if (error) return { ok: false, error: await readFunctionErrorMessage(error, 'No se pudo sincronizar con Tradovate.') };
  return data as { ok: true; trades: SyncedTradeInput[] } | { ok: false; error: string };
}

/**
 * Llama a una función SECURITY DEFINER que solo devuelve si existe una
 * conexión guardada — nunca las credenciales. broker_connections no tiene
 * ninguna policy RLS para 'authenticated', así que esta es la única forma en
 * que el navegador puede saber "¿ya conecté Tradovate?" sin poder leer la fila.
 */
export async function hasTradovateConnection(): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_broker_connection', { broker_name: 'tradovate' });
  if (error) throw error;
  return Boolean(data);
}
