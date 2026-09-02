import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useRefresh } from './RefreshContext';
import {
  getPendingAgoraRequestsCount,
  getPendingFriendRequestsCount,
  getRecentEntrySealStatus,
  getRecentSharesForMe,
} from '../lib/api';
import { localIsoDate } from '../lib/calendar';

type MailboxContextValue = {
  pendingRequests: number;
  mailboxCount: number;
};

const MailboxContext = createContext<MailboxContextValue | undefined>(undefined);

/**
 * MainLayout y Dashboard pedían estas mismas 4 queries por separado (hasta
 * 3 veces el conteo de solicitudes de amistad en cada bump()) — acá se
 * calculan una sola vez y se comparten vía contexto.
 */
export function MailboxProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { version } = useRefresh();
  const [pendingRequests, setPendingRequests] = useState(0);
  const [mailboxCount, setMailboxCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    Promise.all([
      getPendingFriendRequestsCount(user.id),
      getPendingAgoraRequestsCount(user.id),
      getRecentSharesForMe(user.id),
      getRecentEntrySealStatus(user.id, localIsoDate(new Date())),
    ]).then(([pending, pendingAgora, shares, sealStatus]) => {
      if (cancelled) return;
      const unsealedReminder = sealStatus && !sealStatus.sealed ? 1 : 0;
      setPendingRequests(pending);
      setMailboxCount(pending + pendingAgora + shares.length + unsealedReminder);
    });

    return () => {
      cancelled = true;
    };
  }, [user, version]);

  return <MailboxContext.Provider value={{ pendingRequests, mailboxCount }}>{children}</MailboxContext.Provider>;
}

export function useMailbox() {
  const context = useContext(MailboxContext);
  if (!context) {
    throw new Error('useMailbox must be used within a MailboxProvider');
  }
  return context;
}
