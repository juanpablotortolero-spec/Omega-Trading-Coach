import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useRefresh } from './RefreshContext';
import { supabase } from '../lib/supabaseClient';

/** Corte de la zona "Miedo/Indisciplina" — mismo umbral que AtaraxiaBar.pillarName(). */
const FEAR_ZONE_MAX_SCORE = 35;

export type AtaraxiaIntervention = {
  score: number;
  verdict: string;
  sessionDate: string;
};

type AtaraxiaRealtimeContextValue = {
  /** No-null mientras el bloqueo de "ejecución operativa" debe estar activo. */
  intervention: AtaraxiaIntervention | null;
  acknowledgeIntervention: () => void;
};

const AtaraxiaRealtimeContext = createContext<AtaraxiaRealtimeContextValue | undefined>(undefined);

/**
 * Suscripción a Supabase Realtime sobre `ai_session_verdicts` — la tabla real
 * donde el tool `evaluate_session` de omega-coach persiste cada evaluación
 * (ver supabase/functions/omega-coach/index.ts, runTool). Montada una sola
 * vez en MainLayout: cuando Omega guarda una evaluación nueva de ESTE
 * usuario, dispara bump() para que el medidor de Ataraxia (alimentado por
 * computeDisciplineTimeline en Dashboard/Estadisticas/JournalEntry) se
 * refresque en cualquier pantalla donde esté montado — y si el puntaje cae
 * en la zona Miedo/Indisciplina (0-35%), activa la intervención global.
 *
 * Requiere que `ai_session_verdicts` esté agregada a la publicación
 * `supabase_realtime` del lado de Supabase — si no lo está, esta suscripción
 * simplemente nunca recibe eventos (sin error visible).
 */
export function AtaraxiaRealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { bump } = useRefresh();
  const [intervention, setIntervention] = useState<AtaraxiaIntervention | null>(null);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`ataraxia-verdicts-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ai_session_verdicts', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as {
            ataraxia_score: number | null;
            verdict: string;
            session_date: string;
          };

          // Refresca el medidor de Ataraxia dondequiera que esté montado —
          // mismo mecanismo que ya usan buzón/medallas/briefing.
          bump();

          if (row.ataraxia_score !== null && row.ataraxia_score <= FEAR_ZONE_MAX_SCORE) {
            setIntervention({ score: row.ataraxia_score, verdict: row.verdict, sessionDate: row.session_date });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, bump]);

  const acknowledgeIntervention = () => setIntervention(null);

  return (
    <AtaraxiaRealtimeContext.Provider value={{ intervention, acknowledgeIntervention }}>
      {children}
    </AtaraxiaRealtimeContext.Provider>
  );
}

export function useAtaraxiaIntervention(): AtaraxiaRealtimeContextValue {
  const context = useContext(AtaraxiaRealtimeContext);
  if (!context) throw new Error('useAtaraxiaIntervention debe usarse dentro de <AtaraxiaRealtimeProvider>.');
  return context;
}
