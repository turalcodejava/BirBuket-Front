import { Search, Sparkles, Moon, Sun, User, ShoppingBasket, Globe, Menu, X, LogOut, Package } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function Header() {
  const location = useLocation();
  const isBirBagban = location.pathname.startsWith('/bir-bagban');
  const [isDark, setIsDark] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { language, changeLanguage, t } = useLanguage();
  const { user } = useAuth();
  const roleText = String(user?.role || '').toUpperCase();
  const hasAgronomistRole = roleText.includes('AGRONOMIST');
  const hasFloristRole = roleText.includes('FLORIST');

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setIsDark(true);
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    const body = document.body;
    if (isDark) {
      root.classList.remove('dark');
      body.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      root.classList.add('dark');
      body.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
    }
  };

  const navItems = [
    { name: t('home'), path: '/' },
    { name: t('collections'), path: '/collections' },
    { name: t('club'), path: '/birbuketclub' },
    { name: t('create_bouquet'), path: '/studio' },
    { name: t('gardener'), path: '/bir-bagban' },
    { name: t('bir_toy'), path: '/bir-toy' },
    { name: t('about'), path: '/about' },
    ...(hasAgronomistRole ? [{ name: t('bagban_panel'), path: '/agronomist' }] : []),
    ...(hasFloristRole ? [{ name: t('florist_panel'), path: '/florist' }] : []),
  ];

  return (
    <header className={`sticky top-0 z-[9999] w-full transition-all duration-300 flex items-center justify-between px-4 md:px-6 lg:px-14 xl:px-20 py-3.5 ${
      isBirBagban
        ? "bg-[#040f09]/95 backdrop-blur-md border-b border-[#143c24]"
        : "bg-white/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-floral-muted/5 dark:border-white/5"
    }`}>
      <div className="max-w-[1440px] w-full mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-5 lg:gap-8">
          <Link to="/">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3"
            >
              <div className="h-12 w-12 rounded-2xl bg-white p-1.5 shadow-sm border border-floral-muted/20 dark:bg-white/90">
                <img
                  src="/birbuket-logo.svg"
                  alt="BirBuket"
                  className="h-full w-full object-contain"
                />
              </div>
              <h1 className={`text-xl font-extrabold tracking-tight ${
                isBirBagban ? "text-white" : "text-floral-deep dark:text-floral-deep-dark"
              }`}>
                BirBuket
              </h1>
            </motion.div>
          </Link>
          
          <nav className={`hidden md:flex items-center gap-1.5 rounded-full border p-1 ${
            isBirBagban
              ? "border-[#143c24] bg-[#06190f]/60"
              : "border-floral-muted/10 dark:border-white/10 bg-[#f8f9f8] dark:bg-white/5"
          }`}>
            {navItems.map((item) => {
              const isClubSoon = item.path === '/birbuketclub';
              return (
              <NavLink 
                key={item.name}
                to={item.path} 
                className={({ isActive }) => {
                  const base = "whitespace-nowrap rounded-full px-3 py-1.5 text-xs lg:text-sm font-semibold transition-all ";
                  if (isBirBagban) {
                    return base + (isActive
                      ? 'bg-primary/20 text-primary'
                      : 'text-[#acd5bc] hover:text-primary');
                  }
                  return base + (isActive && isClubSoon
                    ? 'bg-red-500/15 text-red-600 ring-1 ring-red-500/25 dark:bg-red-500/20 dark:text-red-400 dark:ring-red-400/25'
                    : isActive
                      ? 'bg-primary/15 text-primary'
                      : isClubSoon
                        ? 'text-floral-deep/80 dark:text-floral-deep-dark/80 hover:text-red-600 dark:hover:text-red-400'
                        : 'text-floral-deep/80 dark:text-floral-deep-dark/80 hover:text-primary dark:hover:text-primary');
                }}
              >
                {item.name}
              </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2.5 lg:gap-3">
          <div className={`hidden lg:flex items-center rounded-full px-5 py-2.5 border transition-colors ${
            isBirBagban
              ? "bg-[#06190f]/60 border-[#143c24]"
              : "bg-[#f8f9f8] dark:bg-white/5 border-black/5 dark:border-white/10"
          }`}>
            <Search className={isBirBagban ? "text-[#a4ccb2]/45 w-4 h-4" : "text-floral-muted/40 dark:text-white/20 w-4 h-4"} />
            <input 
              className={`bg-transparent border-none focus:ring-0 text-sm w-32 md:w-48 ml-2 focus:outline-none ${
                isBirBagban
                  ? "placeholder:text-[#a4ccb2]/40 text-white"
                  : "placeholder:text-floral-muted/40 dark:placeholder:text-white/20 dark:text-white"
              }`} 
              placeholder={t('about') === 'Haqqımızda' ? 'Axtar...' : 'Search...'} 
              type="text"
            />
          </div>

          {/* Language Selector Dropdown */}
          <div className="relative hidden md:block">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowLangMenu(!showLangMenu)}
              className={`p-2.5 rounded-full border transition-colors flex items-center justify-center gap-1.5 ${
                isBirBagban
                  ? 'bg-[#06190f]/60 border-[#143c24] text-[#a4ccb2] hover:bg-[#143c23] hover:text-white'
                  : 'bg-[#f8f9f8] dark:bg-slate-800 border border-black/5 dark:border-white/5 text-floral-deep dark:text-white'
              }`}
              title="Dil Seçimi"
            >
              <Globe className="w-5 h-5" />
              <span className="text-[10px] font-black uppercase tracking-wider">{language}</span>
            </motion.button>

            {showLangMenu && (
              <div className="absolute right-0 mt-2 w-32 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-xl overflow-hidden z-50">
                <button
                  type="button"
                  onClick={() => { changeLanguage('az'); setShowLangMenu(false); }}
                  className={`w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${language === 'az' ? 'text-primary' : 'text-slate-700 dark:text-slate-300'}`}
                >
                  Azerbaycan
                </button>
                <button
                  type="button"
                  onClick={() => { changeLanguage('ru'); setShowLangMenu(false); }}
                  className={`w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${language === 'ru' ? 'text-primary' : 'text-slate-700 dark:text-slate-300'}`}
                >
                  Русский
                </button>
                <button
                  type="button"
                  onClick={() => { changeLanguage('en'); setShowLangMenu(false); }}
                  className={`w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${language === 'en' ? 'text-primary' : 'text-slate-700 dark:text-slate-300'}`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => { changeLanguage('uz'); setShowLangMenu(false); }}
                  className={`w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${language === 'uz' ? 'text-primary' : 'text-slate-700 dark:text-slate-300'}`}
                >
                  O'zbekcha
                </button>
              </div>
            )}
          </div>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleTheme}
            className={`p-2.5 rounded-full border transition-colors hidden md:flex ${
              isBirBagban
                ? 'bg-[#06190f]/60 border-[#143c24] text-[#a4ccb2] hover:bg-[#143c23] hover:text-white'
                : 'bg-[#f8f9f8] dark:bg-slate-800 border border-black/5 dark:border-white/5 text-floral-deep dark:text-white'
            }`}
            title={isDark ? "Açıq rejima keç" : "Tünd rejima keç"}
          >
            {isDark ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5" />}
          </motion.button>
          
          {user ? (
            <div className="flex items-center gap-2 lg:gap-3">
              <Link to="/cart" className="flex items-center hover:opacity-80 transition-opacity">
                <div className={`p-2.5 rounded-full border flex items-center justify-center ${
                  isBirBagban
                    ? 'bg-[#06190f]/60 border-[#143c24] text-primary hover:bg-[#143c23]'
                    : 'bg-primary/10 text-primary border border-primary/20'
                }`}>
                  <ShoppingBasket className="w-5 h-5" />
                </div>
              </Link>
              <Link to="/account" className="flex items-center hover:opacity-80 transition-opacity">
                <div className={`p-2.5 rounded-full border flex items-center justify-center ${
                  isBirBagban
                    ? 'bg-[#06190f]/60 border-[#143c24] text-primary hover:bg-[#143c23]'
                    : 'bg-primary/20 text-primary border border-primary/30'
                }`}>
                  <User className="w-5 h-5" />
                </div>
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/cart" className="flex items-center hover:opacity-80 transition-opacity">
                <div className={`p-2.5 rounded-full border flex items-center justify-center ${
                  isBirBagban
                    ? 'bg-[#06190f]/60 border-[#143c24] text-primary hover:bg-[#143c23]'
                    : 'bg-primary/10 text-primary border border-primary/20'
                }`}>
                  <ShoppingBasket className="w-5 h-5" />
                </div>
              </Link>
              <Link to="/login">
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`p-2.5 rounded-full border flex items-center justify-center ${
                    isBirBagban
                      ? 'bg-[#06190f]/60 border-[#143c24] text-primary hover:bg-[#143c23]'
                      : 'bg-primary/10 text-primary border border-primary/20'
                  }`}
                  title="Daxil ol"
                >
                  <User className="w-5 h-5" />
                </motion.button>
              </Link>
            </div>
          )}

          <Link to="/studio" className="hidden xl:flex">
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="bg-primary text-floral-deep px-5 py-2.5 rounded-full font-bold text-sm flex items-center gap-2 shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              <span>BirBuket Yarat</span>
            </motion.button>
          </Link>

          {/* Hamburger Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`p-2.5 rounded-full border md:hidden flex items-center justify-center transition-colors ${
              isBirBagban
                ? 'bg-[#06190f]/60 border-[#143c24] text-[#a4ccb2] hover:bg-[#143c23] hover:text-white'
                : 'bg-[#f8f9f8] dark:bg-slate-800 border border-black/5 dark:border-white/5 text-floral-deep dark:text-white'
            }`}
            title="Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Full-Screen Portal-Based Mobile Drawer Navigation Menu */}
      {typeof document !== 'undefined' && mobileMenuOpen && createPortal(
        <div className="fixed inset-0 z-[999999] w-screen h-[100dvh] bg-white dark:bg-[#08100b] flex flex-col text-slate-900 dark:text-white animate-in fade-in duration-200">
          {/* Top Bar inside Drawer */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 dark:border-white/10 shrink-0 bg-white dark:bg-[#08100b]">
            <Link to="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-white p-1 shadow-sm border border-floral-muted/20 dark:bg-white/90">
                <img
                  src="/birbuket-logo.svg"
                  alt="BirBuket"
                  className="h-full w-full object-contain"
                />
              </div>
              <span className="text-xl font-extrabold tracking-tight text-floral-deep dark:text-floral-deep-dark">
                BirBuket
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="p-2.5 rounded-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-white hover:bg-slate-200 transition-colors"
              title="Bağla"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Scrollable Drawer Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            {/* Quick Action: BirBuket Yarat */}
            <Link to="/studio" onClick={() => setMobileMenuOpen(false)}>
              <div className="w-full bg-gradient-to-r from-primary via-emerald-400 to-primary text-black font-black p-4 rounded-2xl flex items-center justify-between shadow-lg shadow-primary/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-black/10 rounded-xl">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase tracking-wider leading-none">BirBuket Yarat</h3>
                    <p className="text-xs font-semibold opacity-80 mt-0.5">3D Dizayn və AI Render</p>
                  </div>
                </div>
                <span className="text-xs uppercase bg-black text-white px-3 py-1.5 rounded-xl font-bold">Aç</span>
              </div>
            </Link>

            {/* Navigation Links */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1 px-1">Menyu</p>
              {navItems.map((item) => {
                const isClubSoon = item.path === '/birbuketclub';
                return (
                  <NavLink
                    key={item.name}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) => {
                      const base = "flex items-center justify-between py-3.5 px-5 rounded-2xl text-sm font-black transition-all border ";
                      return base + (isActive
                        ? 'bg-primary/15 border-primary/30 text-primary'
                        : isClubSoon
                          ? 'bg-slate-50 dark:bg-white/5 border-transparent text-slate-700 dark:text-slate-200 hover:text-red-500'
                          : 'bg-slate-50 dark:bg-white/5 border-transparent text-slate-700 dark:text-slate-200 hover:text-primary');
                    }}
                  >
                    <span>{item.name}</span>
                    {item.path === '/studio' ? (
                      <Sparkles className="w-4 h-4 text-primary" />
                    ) : null}
                  </NavLink>
                );
              })}
            </div>

            {/* User Account Section */}
            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1 px-1">Hesabım</p>
              {user ? (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="size-11 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black text-lg shrink-0">
                      {String(user.name || user.username || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-bold leading-tight truncate">
                        {user.name ? `${user.name} ${user.surname || ''}` : user.username}
                      </h4>
                      <p className="text-xs text-slate-400 truncate">{user.email || user.phone || ''}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 dark:border-white/10">
                    <Link to="/account" onClick={() => setMobileMenuOpen(false)} className="w-full">
                      <button className="w-full py-2.5 rounded-xl text-xs font-black bg-primary text-black flex items-center justify-center gap-1.5">
                        <User className="w-4 h-4" />
                        Şəxsi Kabinet
                      </button>
                    </Link>
                    <Link to="/account/orders" onClick={() => setMobileMenuOpen(false)} className="w-full">
                      <button className="w-full py-2.5 rounded-xl text-xs font-black bg-slate-200 dark:bg-white/10 text-slate-800 dark:text-white flex items-center justify-center gap-1.5">
                        <Package className="w-4 h-4" />
                        Sifarişlərim
                      </button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Link to="/login" className="w-full" onClick={() => setMobileMenuOpen(false)}>
                    <button className="w-full py-3.5 rounded-2xl text-xs font-black border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white bg-slate-100/70 dark:bg-white/5 flex items-center justify-center gap-2">
                      <User className="w-4 h-4" />
                      Daxil ol
                    </button>
                  </Link>
                  <Link to="/register" className="w-full" onClick={() => setMobileMenuOpen(false)}>
                    <button className="w-full py-3.5 rounded-2xl text-xs font-black bg-primary text-black shadow-md shadow-primary/20">
                      Qeydiyyat
                    </button>
                  </Link>
                </div>
              )}
            </div>

            {/* Language & Theme Controls */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-4">
              {/* Language Selector */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="w-4 h-4 text-primary" />
                  <span className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Dil seçimi</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { code: 'az', label: 'AZ' },
                    { code: 'ru', label: 'RU' },
                    { code: 'en', label: 'EN' },
                    { code: 'uz', label: 'UZ' },
                  ].map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => changeLanguage(lang.code as any)}
                      className={`py-2 rounded-xl text-xs font-black uppercase transition-all ${
                        language === lang.code
                          ? 'bg-primary text-black shadow-sm'
                          : 'bg-white dark:bg-white/10 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/5'
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Theme Selector */}
              <div>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/10 flex items-center justify-between text-xs font-bold"
                >
                  <span className="text-slate-600 dark:text-slate-300">Görünüş rejimi</span>
                  <div className="flex items-center gap-2 font-black">
                    {isDark ? (
                      <>
                        <Moon className="w-4 h-4 text-primary" />
                        <span>Tünd Rejim</span>
                      </>
                    ) : (
                      <>
                        <Sun className="w-4 h-4 text-amber-500" />
                        <span>Açıq Rejim</span>
                      </>
                    )}
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
}
