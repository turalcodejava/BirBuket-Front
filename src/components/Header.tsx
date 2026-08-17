import { Search, Sparkles, Moon, Sun, User, ShoppingBasket } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Header() {
  const [isDark, setIsDark] = useState(false);
  const { user } = useAuth();
  const roleText = String(user?.role || '').toUpperCase();
  const hasAgronomistRole = roleText.includes('AGRONOMIST');
  const hasFloristRole = roleText.includes('FLORIST');

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
    { name: 'Ana Səhifə', path: '/' },
    { name: 'Kolleksiyalar', path: '/collections' },
    { name: 'BirBuketClub', path: '/birbuketclub' },
    { name: 'BirBuket Yarat', path: '/studio' },
    { name: 'BirBağban', path: '/bir-bagban' },
    { name: 'Haqqımızda', path: '/about' },
    ...(hasAgronomistRole ? [{ name: 'Bağban Paneli', path: '/agronomist' }] : []),
    ...(hasFloristRole ? [{ name: 'Florist Panel', path: '/florist' }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-white/95 dark:bg-background-dark/90 backdrop-blur-md border-b border-floral-muted/5 dark:border-white/5 flex items-center justify-between px-4 md:px-6 lg:px-14 xl:px-20 py-3.5 transition-all duration-300">
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
              <h1 className="text-xl font-extrabold tracking-tight text-floral-deep dark:text-floral-deep-dark">
                BirBuket
              </h1>
            </motion.div>
          </Link>
          
          <nav className="hidden md:flex items-center gap-1.5 rounded-full border border-floral-muted/10 dark:border-white/10 bg-[#f8f9f8] dark:bg-white/5 p-1">
            {navItems.map((item) => {
              const isClubSoon = item.path === '/birbuketclub';
              return (
              <NavLink 
                key={item.name}
                to={item.path} 
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-full px-3 py-1.5 text-xs lg:text-sm font-semibold transition-all ${
                    isActive && isClubSoon
                      ? 'bg-red-500/15 text-red-600 ring-1 ring-red-500/25 dark:bg-red-500/20 dark:text-red-400 dark:ring-red-400/25'
                      : isActive
                        ? 'bg-primary/15 text-primary'
                        : isClubSoon
                          ? 'text-floral-deep/80 dark:text-floral-deep-dark/80 hover:text-red-600 dark:hover:text-red-400'
                          : 'text-floral-deep/80 dark:text-floral-deep-dark/80 hover:text-primary dark:hover:text-primary'
                  }`
                }
              >
                {item.name}
              </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2.5 lg:gap-3">
          <div className="hidden lg:flex items-center bg-[#f8f9f8] dark:bg-white/5 rounded-full px-5 py-2.5 border border-black/5 dark:border-white/10 transition-colors">
            <Search className="text-floral-muted/40 dark:text-white/20 w-4 h-4" />
            <input 
              className="bg-transparent border-none focus:ring-0 text-sm w-32 md:w-48 placeholder:text-floral-muted/40 dark:placeholder:text-white/20 ml-2 dark:text-white" 
              placeholder="Axtar..." 
              type="text"
            />
          </div>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleTheme}
            className="p-2.5 rounded-full bg-[#f8f9f8] dark:bg-slate-800 border border-black/5 dark:border-white/5 text-floral-deep dark:text-white transition-colors"
            title={isDark ? "Açıq rejima keç" : "Tünd rejima keç"}
          >
            {isDark ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5" />}
          </motion.button>
          
          {user ? (
            <div className="flex items-center gap-3">
              <Link to="/cart" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <div className="p-2.5 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center">
                  <ShoppingBasket className="w-5 h-5" />
                </div>
              </Link>
              <Link to="/account" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <div className="p-2.5 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center">
                  <User className="w-5 h-5" />
                </div>
              </Link>
            </div>
          ) : (
            <Link to="/login">
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2.5 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center"
                title="Daxil ol"
              >
                <User className="w-5 h-5" />
              </motion.button>
            </Link>
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
        </div>
      </div>
    </header>
  );
}
