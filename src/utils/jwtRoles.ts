/**
 * Client-side JWT payload helpers (no signature verification).
 * Supports Keycloak (realm_access, resource_access), Spring (authorities), simple role claims.
 */

export function decodeJwtPayload(rawToken: string): Record<string, unknown> | null {
  try {
    const token = rawToken.replace(/^Bearer\s+/i, '').trim();
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return null;
    const normalizedBase64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(normalizedBase64);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function collectRoleStringsFromDecoded(decoded: Record<string, unknown> | null | undefined): string[] {
  if (!decoded || typeof decoded !== 'object') return [];
  const out: string[] = [];
  const push = (v: unknown) => {
    if (v == null || v === '') return;
    out.push(String(v).trim().toUpperCase());
  };

  const realm = (decoded as { realm_access?: { roles?: unknown[] } }).realm_access;
  if (realm && Array.isArray(realm.roles)) {
    realm.roles.forEach(push);
  }

  const resourceAccess = (decoded as { resource_access?: Record<string, { roles?: unknown[] }> }).resource_access;
  if (resourceAccess && typeof resourceAccess === 'object') {
    for (const client of Object.values(resourceAccess)) {
      if (client && Array.isArray(client.roles)) {
        client.roles.forEach(push);
      }
    }
  }

  const topRoles = (decoded as { roles?: unknown[] }).roles;
  if (Array.isArray(topRoles)) {
    topRoles.forEach(push);
  }

  const roleStr = (decoded as { role?: unknown }).role;
  if (typeof roleStr === 'string') {
    roleStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach(push);
  }

  const authorities = (decoded as { authorities?: unknown }).authorities;
  if (Array.isArray(authorities)) {
    for (const a of authorities) {
      if (typeof a === 'string') {
        push(a);
        push(a.replace(/^ROLE_/i, ''));
      } else if (a && typeof a === 'object' && 'authority' in a) {
        const auth = String((a as { authority?: string }).authority || '');
        push(auth);
        push(auth.replace(/^ROLE_/i, ''));
      }
    }
  }

  return out;
}

export function rolesFromJwtToken(rawToken: string): string[] {
  return collectRoleStringsFromDecoded(decodeJwtPayload(rawToken));
}

/** e.g. needle "ADMIN" matches ROLE_ADMIN, REALM_ADMIN, ADMIN */
export function tokenImpliesRole(rawToken: string, needle: string): boolean {
  const u = needle.toUpperCase();
  return rolesFromJwtToken(rawToken).some((r) => r.includes(u));
}
