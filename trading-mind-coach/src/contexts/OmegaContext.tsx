import { createContext, useContext, type ReactNode } from 'react';
import { useOmegaAgent } from '../hooks/useOmegaAgent';

type OmegaContextValue = ReturnType<typeof useOmegaAgent>;

const OmegaContext = createContext<OmegaContextValue | null>(null);

/**
 * Una sola instancia de useOmegaAgent compartida por toda la app autenticada
 * — así el chat, el Oráculo Matutino, el Centro de Misiones y la auditoría al
 * sellar el journal hablan con el MISMO hilo de conversación, y una alerta
 * crítica disparada desde cualquiera de ellos es visible desde cualquier
 * pantalla (montada una sola vez en MainLayout, junto al modal de alerta).
 */
export function OmegaProvider({ children }: { children: ReactNode }) {
  const omega = useOmegaAgent();
  return <OmegaContext.Provider value={omega}>{children}</OmegaContext.Provider>;
}

export function useOmega(): OmegaContextValue {
  const context = useContext(OmegaContext);
  if (!context) throw new Error('useOmega debe usarse dentro de <OmegaProvider>.');
  return context;
}
