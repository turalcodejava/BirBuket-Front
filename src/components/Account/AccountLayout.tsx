import { motion } from 'motion/react';
import { Heart, LogOut, MapPin, Package, Sprout, User as UserIcon } from 'lucide-react';
import React from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const menuItems = [
  { icon: UserIcon, labelKey: 'profile_info', to: '/account', end: true },
  { icon: Package, labelKey: 'order_history', to: '/account/orders' },
  { icon: Heart, labelKey: 'favorites', to: '/account/favorites' },
  { icon: Sprout, labelKey: 'gardener_requests', to: '/account/bagban-muracietleri' },
];

export default function AccountLayout() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="bg-[#fdfcf0] dark:bg-background-dark min-h-screen pb-20">
      <nav className="max-w-7xl mx-auto px-6 lg:px-20 py-6 text-[10px] uppercase tracking-[0.2em] font-bold text-floral-muted/60">
        <Link to="/" className="hover:text-primary transition-colors">Ana səhifə</Link>
        <span className="mx-3 text-floral-muted/30">/</span>
        <span className="text-primary">Hesabım</span>
      </nav>

      <section className="max-w-7xl mx-auto px-6 lg:px-20 mb-12 border-l-4 border-primary pl-6">
        <motion.h1
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-4xl md:text-5xl font-black text-floral-deep dark:text-floral-deep-dark"
        >
          Xoş gəlmisiniz, <span className="italic font-serif font-light">{user?.name || user?.username || 'Hörmətli müştəri'}</span>
        </motion.h1>
        <p className="mt-3 text-floral-muted dark:text-floral-muted-dark font-medium tracking-wide">
          Şəxsi kabinetinizdə sifarişlərinizi izləyə və profilinizi idarə edə bilərsiniz.
        </p>
      </section>

      <div className="max-w-7xl mx-auto px-6 lg:px-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <aside className="lg:col-span-3">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-white/5 rounded-3xl overflow-hidden border border-floral-muted/5 shadow-[0_10px_30px_rgba(0,0,0,0.02)]"
            >
              <div className="p-8 border-b border-floral-muted/5 bg-primary/5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Hesab Məlumatları</p>
                <p className="text-sm text-floral-deep dark:text-white font-bold truncate">{user?.email || '-'}</p>
              </div>

              <nav className="p-4 space-y-1">
                {menuItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex items-center gap-4 w-full px-5 py-4 text-xs font-bold uppercase tracking-widest rounded-2xl transition-all ${
                        isActive
                          ? 'bg-primary text-floral-deep shadow-md shadow-primary/20'
                          : 'text-floral-muted dark:text-white/60 hover:bg-primary/5 hover:text-primary'
                      }`
                    }
                  >
                    <item.icon className="w-5 h-5" />
                    {t(item.labelKey as any)}
                  </NavLink>
                ))}

                <div className="pt-4 mt-4 border-t border-floral-muted/5">
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full gap-4 px-5 py-4 text-xs font-bold uppercase tracking-widest rounded-2xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all"
                  >
                    <LogOut className="w-5 h-5" />
                    {t('logout')}
                  </button>
                </div>
              </nav>
            </motion.div>
          </aside>

          <div className="lg:col-span-9">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              <Outlet />
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
