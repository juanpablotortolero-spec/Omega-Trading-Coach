import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useRefresh } from './RefreshContext';
import { FEAR_ZONE_INTERVENTION_MESSAGE } from '../lib/omegaCoachTemplates';
import { supabase } from '../lib/supabaseClient';

/** Corte de la zona "Miedo/Indisciplina" — mismo umbral que AtaraxiaBar.pillarName(). */
const FEAR_ZONE_MAX_SCORE = 35;

export type AtaraxiaIntervention = {
  score: number;
  message: string;
  sessionDate: string;
};

type AtaraxiaRealtimeContextValue = {
  /** No-null mientras el bloqueo de "ejecución operativa" debe estar activo. */
  intervention: AtaraxiaIntervention | null;
  acknowledgeIntervention: () => void;
};

const AtaraxiaRealtimeContext = createContext<AtaraxiaRealtimeContextValue | undefined>(undefined);

/**
 * Suscripción a Supabase Realtime sobre `post_session_responses` — se
 * escribe siempre y de forma confiable al sellar el journal
 * (savePostSessionResponse en api.ts), a diferencia de la vieja tabla
 * ai_session_verdicts (escrita por la Edge Function omega-coach, ya
 * eliminada, que podía fallar en silencio). Montada una sola vez en
 * MainLayout: cuando el trader sella una sesión, dispara bump() para que el
 * medidor de Ataraxia se refresque donde esté montado — y si el puntaje cae
 * en la zona Miedo/Indisciplina (0-35%), activa la intervención global.
 *
 * Requiere que `post_session_responses` esté agregada a la publicación
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
      .channel(`ataraxia-post-session-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'post_session_responses', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as {
            ataraxia_score: number | null;
            created_at: string;
          };

          // Refresca el medidor de Ataraxia dondequiera que esté montado —
          // mismo mecanismo que ya usan buzón/medallas/briefing.
          bump();

          if (row.ataraxia_score !== null && row.ataraxia_score <= FEAR_ZONE_MAX_SCORE) {
            setIntervention({
              score: row.ataraxia_score,
              message: FEAR_ZONE_INTERVENTION_MESSAGE,
              sessionDate: row.created_at.slice(0, 10),
            });
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
