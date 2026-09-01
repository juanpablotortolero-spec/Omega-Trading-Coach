import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getFundingAccountsWithTrend,
  getRecentEntrySealStatus,
  getRecentSharesForMe,
  getTodayBriefingAckStatus,
  getTodayOmegaAuditAckStatus,
} from '../lib/api';
import { localIsoDate } from '../lib/calendar';
import { sendDesktopNotification } from '../lib/desktopNotifications';
import { RISK_LOCK_DANGER_PCT } from '../lib/risk';

const NOTIFICATION_POLL_MS = 90 * 1000;

type NotifiedState = {
  unsealed: boolean;
  briefing: boolean;
  audit: boolean;
  lastShareId: string | null;
  riskAccountIds: Set<string>;
};

/**
 * Notificaciones de escritorio con la pestaña/navegador abierto (aunque esté
 * en segundo plano) — sin Service Worker ni push real, que hoy no existen en
 * este repo. Relee, cada NOTIFICATION_POLL_MS, los mismos datos que ya
 * calcula MainLayout (más el riesgo de cuentas y el análisis post-sesión) y
 * dispara `sendDesktopNotification` SOLO en la transición "antes no / ahora
 * sí" — nunca en cada poll mientras la condición se sostiene.
 */
export function useDesktopNotifications() {
  const { user } = useAuth();
  const notifiedRef = useRef<NotifiedState>({
    unsealed: false,
    briefing: false,
    audit: false,
    lastShareId: null,
    riskAccountIds: new Set(),
  });
  const firstTickRef = useRef(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const check = async () => {
      const today = localIsoDate(new Date());
      const isFirstTick = firstTickRef.current;
      const state = notifiedRef.current;

      try {
        const sealStatus = await getRecentEntrySealStatus(user.id, today);
        const unsealed = Boolean(sealStatus && !sealStatus.sealed);
        if (unsealed && !state.unsealed && !isFirstTick) {
          sendDesktopNotification('Journal sin sellar', 'Tenés un journal pendiente de sellar.', 'unsealed-journal');
        }
        state.unsealed = unsealed;
      } catch {
        // Un fallo puntual de red no debe romper el resto de los chequeos.
      }
      if (cancelled) return;

      try {
        const briefingStatus = await getTodayBriefingAckStatus(user.id, today);
        const briefingUnread = briefingStatus.exists && !briefingStatus.acknowledged;
        if (briefingUnread && !state.briefing && !isFirstTick) {
          sendDesktopNotification('Tu briefing de hoy está listo', 'Omega ya preparó tu briefing pre-sesión.', 'briefing-ready');
        }
        state.briefing = briefingUnread;
      } catch {
        // idem
      }
      if (cancelled) return;

      try {
        const auditStatus = await getTodayOmegaAuditAckStatus(user.id, today);
        const auditUnread = auditStatus.exists && !auditStatus.acknowledged;
        if (auditUnread && !state.audit && !isFirstTick) {
          sendDesktopNotification('Tu análisis post-sesión está listo', 'Omega ya auditó tu sesión de hoy.', 'audit-ready');
        }
        state.audit = auditUnread;
      } catch {
        // idem
      }
      if (cancelled) return;

      try {
        const shares = await getRecentSharesForMe(user.id, 1);
        const latest = shares[0] ?? null;
        if (latest && latest.id !== state.lastShareId) {
          if (!isFirstTick && state.lastShareId !== null) {
            sendDesktopNotification(
              'Journal compartido',
              `${latest.fromLabel} te compartió su journal.`,
              `share-${latest.id}`,
            );
          }
          state.lastShareId = latest.id;
        } else if (latest && state.lastShareId === null && isFirstTick) {
          state.lastShareId = latest.id;
        }
      } catch {
        // idem
      }
      if (cancelled) return;

      try {
        const accounts = await getFundingAccountsWithTrend(user.id);
        const nowAtRisk = new Set(
          accounts.filter((account) => account.dangerPct >= RISK_LOCK_DANGER_PCT).map((account) => account.id),
        );
        if (!isFirstTick) {
          for (const account of accounts) {
            if (nowAtRisk.has(account.id) && !state.riskAccountIds.has(account.id)) {
              sendDesktopNotification(
                'Cuenta en riesgo',
                `Tu cuenta ${account.accountName} está en riesgo — reduce tu exposición.`,
                `risk-${account.id}`,
              );
            }
          }
        }
        state.riskAccountIds = nowAtRisk;
      } catch {
        // idem
      }

      firstTickRef.current = false;
    };

    check();
    const interval = setInterval(check, NOTIFICATION_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user]);
}
