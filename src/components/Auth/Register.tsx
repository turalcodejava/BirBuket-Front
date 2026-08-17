import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, ArrowRight, Flower2, User, Eye, EyeOff } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../../services/api';
import BrandLoading from '../BrandLoading';
import { useLanguage } from '../../context/LanguageContext';

export default function Register() {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    surname: '',
    email: '',
    username: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    gender: 'MALE',
    birthDate: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError('Şifrə və təsdiq şifrəsi eyni olmalıdır');
      setLoading(false);
      return;
    }

    const formattedBirthDate = formData.birthDate
      ? formData.birthDate.split('-').reverse().join('-')
      : '';

    const normalizePhoneNumber = (value: string) => {
      const digitsOnly = value.replace(/\D/g, '');
      let localPart = digitsOnly;
      if (localPart.startsWith('994')) localPart = localPart.slice(3);
      else if (localPart.startsWith('0')) localPart = localPart.slice(1);
      localPart = localPart.slice(0, 9);
      return `+994${localPart}`;
    };

    const payload = {
      ...formData,
      phoneNumber: normalizePhoneNumber(formData.phoneNumber),
      birthDate: formattedBirthDate
    };

    try {
      const response = await authService.register(payload);
      console.log('Registration response:', response);
      
      if (response.success) {
        navigate('/login', {
          state: {
            message:
              'Qeydiyyat uğurla tamamlandı. Xoş gəldiniz emaili göndərildi — zəhmət olmasa inbox və spam bölməsini yoxlayın.',
          },
        });
      } else {
        setError(response.message || 'Qeydiyyat uğursuz oldu');
      }
    } catch (err: any) {
      console.error('Registration Error details:', err);
      if (!err.response) {
        setError('Serverlə bağlantı kəsildi. Zəhmət olmasa backendin (8081) işlədiyindən və CORS icazələrinin olduğundan əmin olun.');
      } else {
        setError(err.response.data?.message || `Xəta baş verdi: ${err.response.status}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.name === 'phoneNumber') {
      const digitsOnly = e.target.value.replace(/\D/g, '');
      const localPart = (digitsOnly.startsWith('994') ? digitsOnly.slice(3) : digitsOnly).slice(0, 9);
      setFormData({ ...formData, phoneNumber: localPart });
      return;
    }
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-screen bg-[#f8fdf9] dark:bg-background-dark flex items-center justify-center p-6 py-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white dark:bg-white/5 backdrop-blur-xl p-10 rounded-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-white dark:border-white/10"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center mb-6">
            <Flower2 className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-black text-[#0d1c12] dark:text-floral-deep-dark mb-2">{t('register_heading')}</h1>
          <p className="text-floral-muted text-center italic">{t('register_sub')}</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-2xl border border-red-100 dark:border-red-900/30">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-[#0d1c12] dark:text-floral-muted-dark ml-1">{t('name_label')}</label>
              <input 
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                placeholder={t('name_placeholder')}
                className="w-full px-4 py-4 bg-gray-50 dark:bg-slate-900 rounded-2xl border-none focus:ring-2 focus:ring-primary/20 dark:text-white transition-all outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-[#0d1c12] dark:text-floral-muted-dark ml-1">{t('surname_label')}</label>
              <input 
                name="surname"
                required
                value={formData.surname}
                onChange={handleChange}
                placeholder={t('surname_placeholder')}
                className="w-full px-4 py-4 bg-gray-50 dark:bg-slate-900 rounded-2xl border-none focus:ring-2 focus:ring-primary/20 dark:text-white transition-all outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-[#0d1c12] dark:text-floral-muted-dark ml-1">{t('gender_label')}</label>
              <select 
                name="gender"
                value={formData.gender}
                onChange={(e: any) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full px-4 py-4 bg-gray-50 dark:bg-slate-900 rounded-2xl border-none focus:ring-2 focus:ring-primary/20 dark:text-white transition-all outline-none appearance-none"
              >
                <option value="MALE">{t('gender_male')}</option>
                <option value="FEMALE">{t('gender_female')}</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-[#0d1c12] dark:text-floral-muted-dark ml-1">{t('birth_date_label')}</label>
              <input 
                name="birthDate"
                type="date"
                required
                value={formData.birthDate}
                onChange={handleChange}
                className="w-full px-4 py-4 bg-gray-50 dark:bg-slate-900 rounded-2xl border-none focus:ring-2 focus:ring-primary/20 dark:text-white transition-all outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-[#0d1c12] dark:text-floral-muted-dark ml-1">{t('username_label')}</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                name="username"
                required
                value={formData.username}
                onChange={handleChange}
                placeholder="user123"
                className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-slate-900 rounded-2xl border-none focus:ring-2 focus:ring-primary/20 dark:text-white transition-all outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-[#0d1c12] dark:text-floral-muted-dark ml-1">{t('phone_label')}</label>
            <div className="flex items-center bg-gray-50 dark:bg-slate-900 rounded-2xl focus-within:ring-2 focus-within:ring-primary/20">
              <span className="pl-4 pr-2 text-sm font-semibold text-gray-500">+994</span>
              <input
                name="phoneNumber"
                required
                value={formData.phoneNumber}
                onChange={handleChange}
                placeholder="50 123 45 67"
                className="w-full bg-transparent py-4 pr-4 outline-none dark:text-white"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-[#0d1c12] dark:text-floral-muted-dark ml-1">{t('email_label')}</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="nümunə@mail.com"
                className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-slate-900 rounded-2xl border-none focus:ring-2 focus:ring-primary/20 dark:text-white transition-all outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-[#0d1c12] dark:text-floral-muted-dark ml-1">{t('password_label')}</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={formData.password}
                onChange={handleChange}
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
            <label className="text-sm font-bold text-[#0d1c12] dark:text-floral-muted-dark ml-1">{t('password_confirm_label')}</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={formData.confirmPassword}
                onChange={handleChange}
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
            className="w-full bg-primary text-floral-deep py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-primary/20 disabled:opacity-70 mt-4"
          >
            {loading ? <BrandLoading compact /> : <>{t('register_btn')} <ArrowRight className="w-5 h-5" /></>}
          </motion.button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-floral-muted text-sm capitalize">
            {t('already_have_account')}{' '}
            <Link to="/login" className="text-primary font-bold hover:underline">{t('login_link')}</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
