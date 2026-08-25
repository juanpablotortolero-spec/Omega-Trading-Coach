export const ONLINE_THRESHOLD_MS = 3 * 60 * 1000;

export function isOnline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_THRESHOLD_MS;
}

export function lastSeenLabel(lastSeenAt: string | null): string {
  if (!lastSeenAt) return 'Sin actividad reciente';
  if (isOnline(lastSeenAt)) return 'En línea';

  const diffMs = Date.now() - new Date(lastSeenAt).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `Activo hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Activo hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Activo hace ${days} d`;
}
