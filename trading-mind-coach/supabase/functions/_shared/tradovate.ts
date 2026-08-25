// Cliente mínimo para la API REST de Tradovate — usado por tradovate-connect y
// tradovate-sync. Vive en el servidor (Edge Function): las credenciales que
// maneja nunca llegan al navegador.
//
// Referencia (verificada contra la documentación pública antes de escribir
// esto, no es una suposición): https://partner.tradovate.com/api
//   - Auth:  POST /auth/accesstokenrequest  { name, password, appId, appVersion, cid, sec }
//   - Fills: GET  /fill/list                -> { id, orderId, contractId, timestamp, action, qty, price }
//   - Pares: GET  /fillPair/list            -> { id, buyFillId, sellFillId, qty, buyPrice, sellPrice }
//   - Contrato: GET /contract/item?id=      -> { id, name }

export type TradovateEnv = 'demo' | 'live';

export function tradovateBaseUrl(env: TradovateEnv): string {
  return env === 'live' ? 'https://live.tradovateapi.com/v1' : 'https://demo.tradovateapi.com/v1';
}

export type TradovateCredentials = {
  name: string;
  password: string;
  cid: string;
  sec: string;
  env: TradovateEnv;
};

export async function getTradovateAccessToken(creds: TradovateCredentials): Promise<string> {
  const res = await fetch(`${tradovateBaseUrl(creds.env)}/auth/accesstokenrequest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: creds.name,
      password: creds.password,
      appId: 'Personal Assistant Trader',
      appVersion: '1.0',
      cid: creds.cid,
      sec: creds.sec,
      deviceId: 'personal-assistant-trader-web',
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.accessToken) {
    throw new Error(data.errorText || 'Tradovate rechazó las credenciales.');
  }
  return data.accessToken as string;
}

export type TradovateFill = {
  id: number;
  orderId: number;
  contractId: number;
  timestamp: string;
  action: 'Buy' | 'Sell';
  qty: number;
  price: number;
};

export type TradovateFillPair = {
  id: number;
  buyFillId: number;
  sellFillId: number;
  qty: number;
  buyPrice: number;
  sellPrice: number;
};

async function tradovateGet<T>(env: TradovateEnv, accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${tradovateBaseUrl(env)}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Tradovate ${path} respondió ${res.status}`);
  }
  return (await res.json()) as T;
}

export function getFills(env: TradovateEnv, accessToken: string) {
  return tradovateGet<TradovateFill[]>(env, accessToken, '/fill/list');
}

export function getFillPairs(env: TradovateEnv, accessToken: string) {
  return tradovateGet<TradovateFillPair[]>(env, accessToken, '/fillPair/list');
}

export function getContractName(env: TradovateEnv, accessToken: string, contractId: number) {
  return tradovateGet<{ id: number; name: string }>(env, accessToken, `/contract/item?id=${contractId}`);
}

/**
 * Valor por punto de respaldo para los contratos de futuros más comunes —
 * usado SOLO si no se puede resolver el valor real desde Tradovate. Tradovate
 * no documenta con certeza un endpoint único para esto en su API pública;
 * hay que calibrar esta tabla con una cuenta real antes de confiar el P&L en
 * dinero para contratos fuera de esta lista.
 */
export const FALLBACK_POINT_VALUE: Record<string, number> = {
  NQ: 20,
  MNQ: 2,
  ES: 50,
  MES: 5,
  YM: 5,
  MYM: 0.5,
  RTY: 50,
  M2K: 5,
  CL: 1000,
  MCL: 100,
  GC: 100,
  MGC: 10,
};

export function guessPointValue(contractName: string): number {
  const root = contractName.trim().toUpperCase().split(/\s+/)[0].replace(/[0-9]+$/, '');
  for (const [symbol, value] of Object.entries(FALLBACK_POINT_VALUE)) {
    if (root.startsWith(symbol)) return value;
  }
  return 1;
}
