import { motion } from 'motion/react';
import React, { useEffect, useState } from 'react';
import { 
  User as UserIcon, 
  Package, 
  Heart, 
  MapPin, 
  LogOut, 
  ChevronRight, 
  ShoppingBag,
  Star,
  Save
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../../services/api';

export default function Profile() {
  const { user, logout, setAuthUser } = useAuth();
  const navigate = useNavigate();
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileForm, setProfileForm] = useState({
    name: '',
    surname: '',
    username: '',
    email: '',
    phoneNumber: '',
    gender: 'MALE',
    birthDate: ''
  });
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const toAzLocalPhone = (value: string) => {
    const digitsOnly = value.replace(/\D/g, '');
    if (digitsOnly.startsWith('994')) return digitsOnly.slice(3, 12);
    if (digitsOnly.startsWith('0')) return digitsOnly.slice(1, 10);
    return digitsOnly.slice(0, 9);
  };

  const applyUserToForm = (nextUser: any) => {
    setProfileForm({
      name: nextUser?.name || '',
      surname: nextUser?.surname || '',
      username: nextUser?.username || '',
      email: nextUser?.email || '',
      phoneNumber: toAzLocalPhone(nextUser?.phoneNumber || ''),
      gender: nextUser?.gender || 'MALE',
      birthDate: nextUser?.birthDate || ''
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => {
    const loadProfileFromApi = async () => {
      setProfileLoading(true);
      try {
        const res = await authService.getMe(); // /auth/me (with fallback)
        if (res?.success && res?.data) {
          setAuthUser(res.data);
          applyUserToForm(res.data);
        } else if (user) {
          applyUserToForm(user);
        }
      } catch (err: any) {
        setSaveMessage(null);
        if (user) applyUserToForm(user);
      } finally {
        setProfileLoading(false);
      }
    };

    loadProfileFromApi();
  }, []);

  useEffect(() => {
    if (!user) return;
    applyUserToForm(user);
  }, [user]);

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.target.name === 'phoneNumber') {
      setProfileForm((prev) => ({ ...prev, phoneNumber: toAzLocalPhone(e.target.value) }));
      return;
    }
    setProfileForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMessage(null);
    try {
      const response = await authService.updateMe({
        ...profileForm,
        phoneNumber: `+994${toAzLocalPhone(profileForm.phoneNumber)}`,
      });
      if (response?.success && response?.data) {
        setAuthUser(response.data);
        setSaveMessage('Profil məlumatları yeniləndi.');
      } else {
        setAuthUser({ ...(user as any), ...profileForm });
        setSaveMessage('Məlumatlar lokal olaraq yeniləndi.');
      }
    } catch (error: any) {
      setAuthUser({ ...(user as any), ...profileForm });
      setSaveMessage(error?.response?.data?.message || 'Server update endpointini qəbul etmədi. Lokal profil yeniləndi.');
    } finally {
      setSaving(false);
    }
  };

  // Mock data for orders based on the user's design
  const orders = [
    {
      id: "FL-82910",
      title: '"Zəriflik" Buketi',
      price: "85.00",
      date: "12 May, 2024",
      status: "Çatdırıldı",
      img: "https://picsum.photos/seed/flower1/200/200"
    },
    {
      id: "FL-77123",
      title: "Ağ Zambaq Kompozisiyası",
      price: "120.00",
      date: "04 Aprel, 2024",
      status: "Tamamlanıb",
      img: "https://picsum.photos/seed/flower2/200/200"
    }
  ];

  // Mock favorites
  const favorites = [
    {
      id: 1,
      title: '"Bahar Nəfəsi"',
      price: "55.00",
      img: "https://picsum.photos/seed/fav1/400/500"
    },
    {
      id: 2,
      title: "Qırmızı Qızılgül Qutusu",
      price: "145.00",
      img: "https://picsum.photos/seed/fav2/400/500"
    }
  ];

  return (
    <div className="bg-[#fdfcf0] dark:bg-background-dark min-h-screen pb-20">
      {/* Breadcrumb */}
      <nav className="max-w-7xl mx-auto px-6 lg:px-20 py-6 text-[10px] uppercase tracking-[0.2em] font-bold text-floral-muted/60">
        <Link to="/" className="hover:text-primary transition-colors">Ana səhifə</Link>
        <span className="mx-3 text-floral-muted/30">/</span>
        <span className="text-primary">Hesabım</span>
      </nav>

      {/* Welcome Section */}
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
        {profileLoading && (
          <p className="mt-2 text-xs font-black uppercase tracking-wider text-primary">Profil məlumatları yenilənir...</p>
        )}
      </section>

      <div className="max-w-7xl mx-auto px-6 lg:px-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Sidebar */}
          <aside className="lg:col-span-3">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-white/5 rounded-3xl overflow-hidden border border-floral-muted/5 shadow-[0_10px_30px_rgba(0,0,0,0.02)]"
            >
              <div className="p-8 border-b border-floral-muted/5 bg-primary/5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Hesab Məlumatları</p>
                <p className="text-sm text-floral-deep dark:text-white font-bold truncate">{user?.email}</p>
              </div>
              <nav className="p-4 space-y-1">
                {[
                  { icon: UserIcon, label: 'Profil məlumatları', active: true },
                  { icon: Package, label: 'Sifariş tarixim', active: false },
                  { icon: Heart, label: 'Sevimlilər', active: false },
                  { icon: MapPin, label: 'Ünvanlarım', active: false },
                ].map((item, i) => (
                  <button 
                    key={i}
                    className={`flex items-center gap-4 w-full px-5 py-4 text-xs font-bold uppercase tracking-widest rounded-2xl transition-all ${
                      item.active 
                      ? 'bg-primary text-floral-deep shadow-md shadow-primary/20' 
                      : 'text-floral-muted dark:text-white/60 hover:bg-primary/5 hover:text-primary'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </button>
                ))}
                <div className="pt-4 mt-4 border-t border-floral-muted/5">
                  <button 
                    onClick={handleLogout}
                    className="flex items-center w-full gap-4 px-5 py-4 text-xs font-bold uppercase tracking-widest rounded-2xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all font-black"
                  >
                    <LogOut className="w-5 h-5" />
                    Çıxış
                  </button>
                </div>
              </nav>
            </motion.div>
          </aside>

          {/* Main Content */}
          <div className="lg:col-span-9 space-y-12">
            <section>
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black text-floral-deep dark:text-floral-deep-dark">Profil məlumatları</h2>
              </div>
              <motion.form
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={handleProfileSave}
                className="bg-white dark:bg-white/5 rounded-3xl border border-floral-muted/5 p-6 md:p-8 shadow-sm"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input name="name" value={profileForm.name} onChange={handleProfileChange} placeholder="Ad" className="px-4 py-3 rounded-2xl bg-gray-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-primary/20" />
                  <input name="surname" value={profileForm.surname} onChange={handleProfileChange} placeholder="Soyad" className="px-4 py-3 rounded-2xl bg-gray-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-primary/20" />
                  <input name="username" value={profileForm.username} onChange={handleProfileChange} placeholder="İstifadəçi adı" className="px-4 py-3 rounded-2xl bg-gray-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-primary/20" />
                  <input name="email" type="email" value={profileForm.email} onChange={handleProfileChange} placeholder="E-poçt" className="px-4 py-3 rounded-2xl bg-gray-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-primary/20" />
                  <div className="flex items-center rounded-2xl bg-gray-50 dark:bg-slate-900 px-4 py-3 focus-within:ring-2 focus-within:ring-primary/20">
                    <span className="text-sm font-semibold text-gray-500">+994</span>
                    <input
                      name="phoneNumber"
                      value={profileForm.phoneNumber}
                      onChange={handleProfileChange}
                      placeholder="50 123 45 67"
                      className="ml-2 w-full bg-transparent outline-none"
                    />
                  </div>
                  <input name="birthDate" value={profileForm.birthDate} onChange={handleProfileChange} placeholder="Doğum tarixi" className="px-4 py-3 rounded-2xl bg-gray-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-primary/20" />
                  <select name="gender" value={profileForm.gender} onChange={handleProfileChange} className="px-4 py-3 rounded-2xl bg-gray-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-primary/20">
                    <option value="MALE">Kişi</option>
                    <option value="FEMALE">Qadın</option>
                  </select>
                </div>
                <div className="mt-6 flex items-center justify-between gap-4">
                  <p className="text-xs font-bold text-floral-muted">{saveMessage || 'Register zamanı yazılan məlumatlar burada görünür.'}</p>
                  <button type="submit" disabled={saving} className="px-6 py-3 rounded-2xl bg-primary text-floral-deep font-black text-xs uppercase tracking-widest flex items-center gap-2 disabled:opacity-60">
                    <Save className="w-4 h-4" />
                    {saving ? 'Yadda saxlanır...' : 'Yadda saxla'}
                  </button>
                </div>
              </motion.form>
            </section>
            
            {/* Recent Orders */}
            <section>
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black text-floral-deep dark:text-floral-deep-dark">Son Sifarişlər</h2>
              </div>
              <div className="space-y-6">
                {orders.map((order, i) => (
                  <motion.div 
                    key={order.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-white dark:bg-white/5 rounded-3xl overflow-hidden border border-floral-muted/5 shadow-sm hover:shadow-xl transition-all duration-500 group"
                  >
                    <div className="p-6 sm:p-8 flex flex-col sm:row sm:items-center justify-between gap-6 md:flex-row">
                      <div className="flex items-center gap-6">
                        <div className="h-24 w-24 rounded-2xl bg-primary/5 overflow-hidden flex-shrink-0 shadow-inner">
                          <img src={order.img} alt={order.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" referrerPolicy="no-referrer" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-floral-deep dark:text-white mb-1">{order.title}</h3>
                          <p className="text-[11px] font-black uppercase tracking-tighter text-floral-muted/50">Sifariş № #{order.id}</p>
                          <div className="mt-3 flex items-center gap-2">
                            <span className={`flex h-2 w-2 rounded-full ${order.status === 'Çatdırıldı' ? 'bg-primary' : 'bg-floral-muted/30'}`}></span>
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${order.status === 'Çatdırıldı' ? 'text-primary' : 'text-floral-muted/50'}`}>{order.status}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-4">
                        <div className="text-right">
                          <p className="text-2xl font-black text-floral-deep dark:text-primary">{order.price} ₼</p>
                          <p className="text-[10px] uppercase font-bold tracking-widest text-floral-muted/60 mt-1">{order.date}</p>
                        </div>
                        <button className="px-6 py-3 border-2 border-primary text-primary hover:bg-primary hover:text-floral-deep rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                          Yenidən sifariş et
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>

            {/* Favorites Section */}
            <section className="pt-12 border-t border-floral-muted/10">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black text-floral-deep dark:text-floral-deep-dark">Sevimlilər</h2>
                <Link to="/collections" className="text-xs font-black uppercase tracking-widest text-primary hover:text-primary/70 flex items-center gap-2 group">
                  Hamısına bax 
                  <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {favorites.map((fav, i) => (
                  <motion.div 
                    key={i}
                    whileHover={{ y: -10 }}
                    className="group bg-white dark:bg-white/5 rounded-[32px] overflow-hidden border border-floral-muted/5 shadow-sm relative"
                  >
                    <div className="aspect-[4/5] w-full relative overflow-hidden">
                      <img src={fav.img} alt={fav.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" referrerPolicy="no-referrer" />
                      <button className="absolute top-4 right-4 h-10 w-10 flex items-center justify-center rounded-full bg-white/90 dark:bg-background-dark/90 text-red-500 backdrop-blur-sm shadow-sm transition-transform hover:scale-110">
                        <Heart className="w-5 h-5 fill-current" />
                      </button>
                    </div>
                    <div className="p-6">
                      <h4 className="text-lg font-bold text-floral-deep dark:text-white mb-2">{fav.title}</h4>
                      <div className="flex items-center justify-between pt-2">
                        <p className="text-primary font-black text-lg">{fav.price} ₼</p>
                        <button className="h-10 w-10 flex items-center justify-center rounded-full bg-primary text-floral-deep hover:bg-white hover:shadow-lg transition-all">
                          <ShoppingBag className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
