import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useRefresh } from './RefreshContext';
import { checkForNewMedalUnlocks, type NewMedalUnlock } from '../lib/api';

type MedalContextValue = {
  /** La medalla nueva a mostrar ahora mismo, o null si no hay ninguna pendiente. */
  activeUnlock: NewMedalUnlock | null;
  /** Cierra la actual y pasa a la siguiente de la cola, si hay más de una. */
  dismissActiveUnlock: () => void;
};

const MedalContext = createContext<MedalContextValue | undefined>(undefined);

/**
 * En cada bump() global, revisa TODAS las medallas del Museo (misiones
 * diarias, semanales, de setup y psicológicas) contra los conteos reales —
 * checkForNewMedalUnlocks es idempotente (unique constraint +
 * ignoreDuplicates en el server), así que re-chequear medallas ya otorgadas
 * no las vuelve a disparar. Las que SÍ son nuevas se encolan para mostrarse
 * una por una, sin importar desde qué pantalla se disparó el desbloqueo.
 */
export function MedalProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { version } = useRefresh();
  const [queue, setQueue] = useState<NewMedalUnlock[]>([]);

  useEffect(() => {
    if (!user) return;

    // A propósito SIN guarda de `cancelled`: el otorgamiento ya es
    // idempotente del lado del server (unique constraint + ignoreDuplicates
    // en checkForNewMedalUnlocks), así que una vez que una medalla vuelve
    // como recién otorgada, esa fila YA existe en la base para siempre — si
    // descartáramos el resultado acá (ej. por el doble-efecto de
    // StrictMode en desarrollo), la notificación se perdería sin posibilidad
    // de volver a dispararse, aunque el trader sí ganó la medalla y el XP.
    checkForNewMedalUnlocks(user.id)
      .then((newUnlocks) => {
        if (newUnlocks.length === 0) return;
        setQueue((current) => [...current, ...newUnlocks]);
      })
      .catch(() => {
        // Cosmético — si falla, simplemente no se notifica esta vez, nunca rompe el resto de la app.
      });
  }, [user, version]);

  const dismissActiveUnlock = () => setQueue((current) => current.slice(1));

  return (
    <MedalContext.Provider value={{ activeUnlock: queue[0] ?? null, dismissActiveUnlock }}>
      {children}
    </MedalContext.Provider>
  );
}

export function useMedals() {
  const context = useContext(MedalContext);
  if (!context) {
    throw new Error('useMedals must be used within a MedalProvider');
  }
  return context;
}
