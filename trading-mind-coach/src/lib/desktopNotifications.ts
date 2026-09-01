/**
 * Notificaciones de escritorio (Web Notification API) — solo funcionan con la
 * pestaña/navegador abierto (aunque esté en segundo plano). No hay Service
 * Worker ni Push API en este repo, así que no hay forma de notificar con el
 * navegador cerrado; esa es una inversión de infraestructura distinta y no
 * se intenta acá.
 */

export type NotificationPermissionState = 'unsupported' | NotificationPermission;

export function getNotificationPermission(): NotificationPermissionState {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!('Notification' in window)) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function sendDesktopNotification(title: string, body: string, tag: string): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, tag, icon: '/assets/omega-logo.png' });
  } catch {
    // Algunos navegadores lanzan si se llama desde un contexto no permitido
    // (ej. Safari sin gesto de usuario reciente en ciertas versiones) — no
    // es crítico, el resto de la app sigue funcionando igual.
  }
}
