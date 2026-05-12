import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Flower2, Lock } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../../services/api';
import BrandLoading from '../BrandLoading';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const token = params.get('token') || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDone(false);

    if (!token.trim()) {
      setError('Bərpa token-i tapılmadı. Zəhmət olmasa emaildəki linki yenidən açın.');
      return;
    }

    if (password.length < 6) {
      setError('Şifrə minimum 6 simvol olmalıdır.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Şifrələr eyni deyil.');
      return;
    }

    setLoading(true);
    try {
      const response = await authService.resetPassword({
        token,
        password,
        confirmPassword,
      });

      if (response?.success) {
        setDone(true);
        setTimeout(() => navigate('/login'), 1500);
      } else {
        setError(response?.message || 'Şifrə yenilənə bilmədi. Linkin müddəti bitmiş ola bilər.');
      }
    } catch (err: any) {
      const backendMessage = err?.response?.data?.message;
      if (backendMessage) {
        setError(backendMessage);
      } else if (err?.response?.status) {
        setError(`Server xətası: ${err.response.status}`);
      } else {
        setError('Serverlə bağlantı kəsildi');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fdf9] dark:bg-background-dark flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white dark:bg-white/5 backdrop-blur-xl p-10 rounded-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-white dark:border-white/10"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center mb-6">
            <Flower2 className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0d1c12] dark:text-floral-deep-dark mb-2 text-center">
            Yeni şifrə təyin et
          </h1>
          <p className="text-floral-muted text-center text-sm">
            Emaildəki linkdən gələn token ilə şifrənizi yeniləyin.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-2xl border border-red-100 dark:border-red-900/30">
            {error}
          </div>
        )}

        {done && !error && (
          <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200 text-sm rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
            Şifrə uğurla yeniləndi. Giriş səhifəsinə yönləndirilirsiniz...
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-bold text-[#0d1c12] dark:text-floral-muted-dark ml-1">Yeni şifrə</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-12 pr-12 py-4 bg-gray-50 dark:bg-slate-900 rounded-2xl border-none focus:ring-2 focus:ring-primary/20 dark:text-white transition-all outline-none"
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

          <div className="space-y-2">
            <label className="text-sm font-bold text-[#0d1c12] dark:text-floral-muted-dark ml-1">Şifrə təkrarı</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-12 pr-12 py-4 bg-gray-50 dark:bg-slate-900 rounded-2xl border-none focus:ring-2 focus:ring-primary/20 dark:text-white transition-all outline-none"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-500 hover:text-primary transition-colors"
                aria-label={showConfirmPassword ? 'Şifrəni gizlət' : 'Şifrəni göstər'}
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            disabled={loading}
            className="w-full bg-primary text-floral-deep py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-primary/20 disabled:opacity-70"
          >
            {loading ? <BrandLoading compact /> : <>Şifrəni yenilə <ArrowRight className="w-5 h-5" /></>}
          </motion.button>
        </form>

        <div className="mt-8">
          <Link to="/login" className="text-primary font-bold flex items-center gap-2 hover:underline text-sm">
            <ArrowLeft className="w-4 h-4" />
            Girişə qayıt
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
