import { BarChart3, Boxes, ClipboardList, Home, LogOut, MessageCircle, Settings, Users, Sparkles, Gift } from 'lucide-react';
import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const adminMenu = [
  { to: '/admin', label: 'Dashboard', icon: Home, end: true },
  { to: '/admin/orders', label: 'Sifarişlər', icon: ClipboardList },
  { to: '/admin/products', label: 'Məhsullar', icon: Boxes },
  { to: '/admin/customers', label: 'Müştərilər', icon: Users },
  { to: '/admin/live-chat', label: 'Canlı söhbət', icon: MessageCircle },
  { to: '/admin/render-management', label: 'Render Ayarları', icon: Sparkles },
  { to: '/admin/club-management', label: 'Club İdarəetməsi', icon: Gift },
  { to: '/admin/settings', label: 'Tənzimləmələr', icon: Settings },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#fdfcf0] text-floral-deep dark:text-white">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[260px_1fr]">
        <aside className="border-r border-floral-muted/10 bg-white dark:bg-background-dark p-5 lg:p-6 flex flex-col">
          <div className="mb-8">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center text-primary">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <p className="font-black text-xl leading-none">Gül Dükanı</p>
                <p className="text-[11px] mt-1 text-floral-muted">Admin Console</p>
              </div>
            </div>
          </div>

          <nav className="space-y-1.5 flex-1">
            {adminMenu.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
                    isActive
                      ? 'bg-primary/20 text-primary'
                      : 'text-floral-muted hover:text-floral-deep hover:bg-primary/10 dark:text-white/65 dark:hover:text-white'
                  }`
                }
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="pt-5 mt-5 border-t border-floral-muted/10 dark:border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-black">
                {(user?.name || user?.username || 'A').slice(0, 1).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-bold leading-none">{user?.name || user?.username || 'Admin'}</p>
                <p className="text-xs text-floral-muted mt-1 dark:text-white/45">Baş Admin</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full rounded-xl border border-floral-muted/20 px-4 py-2.5 text-sm font-bold text-floral-deep hover:bg-primary/10 dark:border-white/15 dark:text-white/80 dark:hover:bg-white/10 flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Çıxış et
            </button>
          </div>
        </aside>

        <main className="bg-[#fdfcf0] dark:bg-background-dark text-floral-deep dark:text-white">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

