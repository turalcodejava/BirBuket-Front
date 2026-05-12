import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, ArrowRight, Flower2, Eye, EyeOff, Check } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import BrandLoading from '../BrandLoading';
import { rolesFromJwtToken } from '../../utils/jwtRoles';

function normalizeInternalRedirect(raw: string | null): string | null {
  if (!raw || raw.length > 240) return null;
  const t = raw.trim();
  if (!t.startsWith('/') || t.startsWith('//')) return null;
  if (t.includes('..')) return null;
  return t;
}

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, setAuthUser } = useAuth();

  const extractUserIdFromResponse = (response: any): number | null => {
    const candidates = [
      response?.user?.id,
      response?.userId,
      response?.data?.user?.id,
      response?.data?.userId,
      response?.data?.id,
      response?.id,
    ];

    for (const rawValue of candidates) {
      if (typeof rawValue === 'number' && Number.isFinite(rawValue) && rawValue > 0) {
        return rawValue;
      }
      if (typeof rawValue === 'string' && /^\d+$/.test(rawValue.trim())) {
        return Number(rawValue.trim());
      }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await authService.login({ username, email: username, password });
      const rawToken =
        (response as any).accessToken ||
        (response as any).access_token ||
        (response as any).token ||
        (response as any).jwt ||
        (response as any).data?.accessToken ||
        (response as any).data?.access_token ||
        (response as any).data?.token ||
        (response as any).data?.jwt;

      const token = typeof rawToken === 'string' ? rawToken.trim() : '';
      if (token) {
        login(token);
        const responseUser = (response as any)?.user || (response as any)?.data?.user;
        const hasUserIdentity =
          responseUser &&
          typeof responseUser === 'object' &&
          ['id', 'userId', 'user_id', 'uid', 'sub'].some((key) => key in responseUser);

        if (hasUserIdentity) {
          setAuthUser(responseUser);
        } else {
          const resolvedUserId = extractUserIdFromResponse(response);
          if (resolvedUserId) {
            localStorage.setItem('auth_user_id', String(resolvedUserId));
            setAuthUser({
              id: resolvedUserId,
              username: username,
              email: '',
            } as any);
          }
        }

        let isAdmin = false;
        let isAgronomist = false;
        let isFlorist = false;
        let isCourier = false;
        try {
          const meRes = await authService.getMe();
          if (meRes?.success && meRes?.data) {
            setAuthUser(meRes.data);
            const mePayload = meRes.data as unknown as Record<string, unknown>;
            const roleParts = [
              ...(typeof mePayload.role === 'string' ? [mePayload.role] : []),
              ...(Array.isArray(mePayload.roles) ? (mePayload.roles as unknown[]).map((r) => String(r)) : []),
            ]
              .map((s) => s.trim())
              .filter(Boolean);
            const meRoleText = roleParts.join(',').toUpperCase();
            isAdmin = meRoleText.includes('ADMIN');
            isAgronomist = meRoleText.includes('AGRONOMIST');
            isFlorist = meRoleText.includes('FLORIST');
            isCourier = meRoleText.includes('COURIER');
          }
        } catch {
          // Fallback to role hints from login response/token if /me is unavailable.
        }

        // Yalnız hələ müəyyən olunmayan rolları token/cavabla tamamla (/me admin veribsə aqronom olmama səbəbilə sıfırlanmasın).
        const responseRolesArr = Array.isArray((responseUser as any)?.roles)
          ? ((responseUser as any).roles as unknown[]).map((r) => String(r).toUpperCase())
          : [];
        const responseRoleText = `${String((responseUser as any)?.role || '')},${responseRolesArr.join(',')}`.toUpperCase();
        const tokenRoles = rolesFromJwtToken(token);
        if (!isAdmin) {
          isAdmin =
            responseRoleText.includes('ADMIN') || tokenRoles.some((role) => role.includes('ADMIN'));
        }
        if (!isAgronomist) {
          isAgronomist =
            responseRoleText.includes('AGRONOMIST') ||
            tokenRoles.some((role) => role.includes('AGRONOMIST'));
        }
        if (!isFlorist) {
          isFlorist =
            responseRoleText.includes('FLORIST') ||
            tokenRoles.some((role) => role.includes('FLORIST'));
        }
        if (!isCourier) {
          isCourier =
            responseRoleText.includes('COURIER') ||
            tokenRoles.some((role) => role.includes('COURIER'));
        }

        const afterLogin = normalizeInternalRedirect(searchParams.get('redirect'));

        // Kuryer WhatsApp dəvəti: girişdən sonra dəqiq `/courier` (və mövcuddursa alt-path)
        if (afterLogin && isCourier && afterLogin.startsWith('/courier')) {
          navigate(afterLogin);
          return;
        }

        navigate(isAdmin ? '/admin' : isAgronomist ? '/agronomist' : isFlorist ? '/florist' : isCourier ? '/courier' : '/account');
      } else {
        setError((response as any)?.message || 'İstifadəçi adı və ya şifrə yanlışdır.');
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const backendMessage = err?.response?.data?.message;
      if (backendMessage) {
        setError(backendMessage);
      } else if (status === 401) {
        setError('İstifadəçi adı və ya şifrə yanlışdır.');
      } else if (status) {
        setError(`Server xətası: ${status}`);
      } else {
        setError('Serverlə bağlantı kəsildi');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f2ea] dark:bg-background-dark">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        <section className="relative hidden lg:flex items-center justify-center border-r border-[#e9dfd2] dark:border-white/10 px-16">
          <div className="max-w-xl">
            <div className="mb-10 inline-flex items-center gap-4">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
                <Flower2 className="w-7 h-7 text-primary" />
              </div>
              <div>
                <p className="text-3xl font-black text-[#0d1c12] dark:text-floral-deep-dark leading-none">BirBuket</p>
                <p className="text-xs uppercase tracking-[0.2em] text-floral-muted mt-1">Floral Workspace</p>
              </div>
            </div>

            <h1 className="text-4xl font-black text-[#0d1c12] dark:text-floral-deep-dark leading-tight mb-4">
              Sevdikləriniz üçün gülü seçin, sifarişi rahat izləyin
            </h1>
            <p className="text-floral-muted dark:text-floral-muted-dark text-lg leading-relaxed mb-8">
              BirBuket hesabınızla buket seçin, ünvanı qeyd edin və çatdırılma statusunu addım-addım izləyin.
            </p>

            <ul className="space-y-4">
              {[
                'Fərdi hesabda sifariş tarixçənizi toplayın',
                'Ünvan, alıcı və çatdırılma qeydlərini rahat idarə edin',
                'Sifariş hazırlanır, yoldadır, çatdırıldı statuslarını izləyin',
                'Onlayn ödəniş və sifariş detallarına bir toxunuşla baxın'
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-[#3d5145] dark:text-white/70">
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-10 sm:px-10 lg:px-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md bg-white dark:bg-white/5 backdrop-blur-xl p-8 sm:p-10 rounded-[30px] shadow-[0_22px_45px_rgba(0,0,0,0.08)] border border-[#e7ded2] dark:border-white/10"
          >
            <h2 className="text-3xl font-black text-[#0d1c12] dark:text-floral-deep-dark mb-2">Hesabınıza daxil olun</h2>
            <p className="text-sm text-floral-muted dark:text-floral-muted-dark mb-6">
              Davam etmək üçün e-poçt və şifrənizi daxil edin
            </p>

            {error && (
              <div className="mb-5 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-2xl border border-red-100 dark:border-red-900/30">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-[#2f4337] dark:text-floral-muted-dark ml-1">
                  E-poçt və ya istifadəçi adı
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Email və ya username"
                    className="w-full pl-12 pr-4 py-3.5 bg-[#fcfaf6] dark:bg-slate-900 rounded-xl border border-[#efe4d5] dark:border-white/10 focus:ring-2 focus:ring-primary/20 dark:text-white transition-all outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-xs font-black uppercase tracking-wider text-[#2f4337] dark:text-floral-muted-dark">
                    Şifrə
                  </label>
                  <Link to="/forgot-password" className="text-xs text-primary font-bold hover:underline">
                    Şifrəni unutmusunuz?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-12 pr-12 py-3.5 bg-[#fcfaf6] dark:bg-slate-900 rounded-xl border border-[#efe4d5] dark:border-white/10 focus:ring-2 focus:ring-primary/20 dark:text-white transition-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-500 hover:text-primary transition-colors"
                    aria-label={showPassword ? 'Şifrəni gizlət' : 'Şifrəni göstər'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setRememberMe((prev) => !prev)}
                className="inline-flex items-center gap-2 text-xs font-semibold text-[#4b5f54] dark:text-white/70"
              >
                <span className={`w-4 h-4 rounded border flex items-center justify-center ${rememberMe ? 'bg-primary border-primary text-[#0d1b12]' : 'border-[#cbb9a4] dark:border-white/30'}`}>
                  {rememberMe ? <Check className="w-3 h-3" /> : null}
                </span>
                Məni xatırla
              </button>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                disabled={loading}
                className="w-full bg-primary text-floral-deep py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-70"
              >
                {loading ? <BrandLoading compact /> : <>Daxil ol <ArrowRight className="w-4 h-4" /></>}
              </motion.button>
            </form>

            <div className="mt-7 text-center">
              <p className="text-floral-muted text-sm">
                Hesabınız yoxdur?{' '}
                <Link to="/register" className="text-primary font-bold hover:underline">Qeydiyyatdan keçin</Link>
              </p>
            </div>
          </motion.div>
        </section>
      </div>
    </div>
  );
}
