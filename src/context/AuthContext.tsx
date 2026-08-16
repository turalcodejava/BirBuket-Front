import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { collectRoleStringsFromDecoded, decodeJwtPayload } from '../utils/jwtRoles';
import { authService } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  userId: number | null;
  loading: boolean;
  login: (token: string) => void;
  logout: () => void;
  setAuthUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_USER_STORAGE_KEY = 'auth_user';
const AUTH_USER_ID_STORAGE_KEY = 'auth_user_id';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('accessToken') ||
    localStorage.getItem('access_token') ||
    localStorage.getItem('token')
  );
  const [loading, setLoading] = useState(true);

  const sanitizeToken = (rawToken: string) => rawToken.replace(/^Bearer\s+/i, '').trim();

  const normalizeUser = (rawUser: any): User | null => {
    if (!rawUser || typeof rawUser !== 'object') return null;

    const rawId = rawUser.id ?? rawUser.userId ?? rawUser.user_id ?? rawUser.uid ?? rawUser.sub;
    const parsedId =
      typeof rawId === 'number'
        ? rawId
        : typeof rawId === 'string' && /^\d+$/.test(rawId.trim())
          ? Number(rawId.trim())
          : 0;

    const rolesFromDto = Array.isArray(rawUser.roles)
      ? rawUser.roles.map((r: unknown) => String(r).trim()).filter(Boolean)
      : [];
    const roleFromDto =
      typeof rawUser.role === 'string' && rawUser.role.trim()
        ? rawUser.role.trim()
        : rolesFromDto.length
          ? rolesFromDto.join(',')
          : undefined;

    return {
      id: parsedId,
      username: rawUser.username || rawUser.userName || rawUser.preferred_username || '',
      email: rawUser.email || '',
      name: rawUser.name || rawUser.given_name || '',
      surname: rawUser.surname || rawUser.family_name || '',
      phoneNumber: rawUser.phoneNumber || rawUser.phone_number || '',
      role: roleFromDto
    };
  };

  const parseNumericUserId = (decoded: any): number => {
    const candidates = [
      decoded?.userId,
      decoded?.user_id,
      decoded?.id,
      decoded?.uid,
      decoded?.sub
    ];

    for (const rawValue of candidates) {
      if (typeof rawValue === 'number' && Number.isFinite(rawValue) && rawValue > 0) {
        return rawValue;
      }

      if (typeof rawValue === 'string') {
        const trimmed = rawValue.trim();
        // Only accept fully numeric values to avoid extracting random digits from UUID-like subjects.
        if (/^\d+$/.test(trimmed)) {
          return Number(trimmed);
        }
      }
    }

    return 0;
  };

  const parseUserFromToken = (jwtToken: string): User | null => {
    try {
      const decoded = decodeJwtPayload(jwtToken);
      if (!decoded) return null;
      const jwtRoles = collectRoleStringsFromDecoded(decoded);
      return {
        id: parseNumericUserId(decoded),
        username:
          String((decoded as { preferred_username?: string }).preferred_username || '') ||
          String((decoded as { username?: string }).username || ''),
        email: String((decoded as { email?: string }).email || ''),
        name: String((decoded as { given_name?: string; name?: string }).given_name ||
          (decoded as { name?: string }).name ||
          ''),
        surname: String((decoded as { family_name?: string }).family_name || ''),
        role: jwtRoles.length ? jwtRoles.join(',') : undefined
      };
    } catch {
      return null;
    }
  };

  const resolveUserId = (nextUser: User | null, rawToken: string | null): number | null => {
    if (nextUser?.id && nextUser.id > 0) return nextUser.id;

    // Prefer current token identity over persisted id to avoid stale account mismatch.
    if (rawToken) {
      const parsed = parseUserFromToken(sanitizeToken(rawToken));
      if (parsed?.id && parsed.id > 0) return parsed.id;
    }

    return null;
  };

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        const storedUserRaw = localStorage.getItem(AUTH_USER_STORAGE_KEY);
        if (storedUserRaw) {
          try {
            const storedUser = normalizeUser(JSON.parse(storedUserRaw));
            if (storedUser) {
              setUser(storedUser);
              setLoading(false);
              return;
            }
          } catch {
            localStorage.removeItem(AUTH_USER_STORAGE_KEY);
          }
        }

        // Fallback to JWT payload when explicit user object is unavailable.
        const fallbackUser = parseUserFromToken(sanitizeToken(token));
        if (fallbackUser) {
          setUser(fallbackUser);
          localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(fallbackUser));
          if (fallbackUser.id > 0) {
            localStorage.setItem(AUTH_USER_ID_STORAGE_KEY, String(fallbackUser.id));
          }
        }
      }
      setLoading(false);
    };

    initAuth();
  }, [token]);

  const login = (newToken: string) => {
    const cleanToken = sanitizeToken(newToken);
    localStorage.setItem('token', cleanToken);
    localStorage.setItem('accessToken', cleanToken);
    localStorage.setItem('access_token', cleanToken);
    setToken(cleanToken);
  };

  const logout = () => {
    void authService.logout();
    localStorage.removeItem('token');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('access_token');
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    localStorage.removeItem(AUTH_USER_ID_STORAGE_KEY);
    setToken(null);
    setUser(null);
  };

  const setAuthUser = (nextUser: User | null) => {
    const normalizedUser = normalizeUser(nextUser);
    if (normalizedUser) {
      setUser(normalizedUser);
      localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(normalizedUser));
      if (normalizedUser.id > 0) {
        localStorage.setItem(AUTH_USER_ID_STORAGE_KEY, String(normalizedUser.id));
      }
      return;
    }

    setUser(null);
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
  };

  const userId = resolveUserId(user, token);

  return (
    <AuthContext.Provider value={{ user, token, userId, loading, login, logout, setAuthUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
