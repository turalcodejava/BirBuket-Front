/** Frontend-only token; `.env`-də `VITE_COURIER_TRACKING_SECRET` ilə production-da möhkəmləndirin */
const trackingSecret =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_COURIER_TRACKING_SECRET
    ? String(import.meta.env.VITE_COURIER_TRACKING_SECRET)
    : 'birbuket-courier-tracking';

export const normalizePhoneDigits = (raw?: string) =>
  String(raw || '')
    .replace(/\D/g, '')
    .replace(/^00/, '');

export async function buildCourierTrackingAccessToken(
  orderId: number | string,
  phoneDigits: string
): Promise<string> {
  const normalized = normalizePhoneDigits(phoneDigits);
  const enc = new TextEncoder();
  const payload = `${String(orderId)}|${normalized}|${trackingSecret}`;
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(payload));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** WhatsApp linki üçün: linki olan şəxs kod/nömrə daxil etmədən aça bilər. Sirr çox güclü olmalıdır (`.env`). */
export async function buildCourierInviteLinkToken(orderId: number | string): Promise<string> {
  const enc = new TextEncoder();
  const payload = `${String(orderId)}|courier-invite-link|${trackingSecret}`;
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(payload));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyCourierInviteLinkToken(orderId: string, accessToken: string): Promise<boolean> {
  if (!accessToken || !orderId) return false;
  const expected = await buildCourierInviteLinkToken(orderId);
  return expected === accessToken;
}

export async function verifyCourierTrackingAccess(
  orderId: string,
  accessToken: string,
  enteredPhone: string
): Promise<boolean> {
  if (!accessToken || !orderId) return false;
  const candidate = await buildCourierTrackingAccessToken(orderId, enteredPhone);
  return candidate === accessToken;
}
