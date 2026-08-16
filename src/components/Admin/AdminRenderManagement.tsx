import React, { useEffect, useState } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  Search, 
  User, 
  Sparkles, 
  X, 
  Loader2 
} from 'lucide-react';
import { authService, adminService } from '../../services/api';

type RenderPackage = {
  packageCode: string;
  name: string;
  badge: string;
  rendersCount: number;
  price: number;
  description: string;
  note: string;
};

const MOCK_PACKAGES_KEY = 'mock_render_packages';

export default function AdminRenderManagement() {
  const [activeSubTab, setActiveSubTab] = useState<'packages' | 'user_limits'>('packages');

  // ==========================================
  // RENDER PACKAGES LOGIC
  // ==========================================
  const [packages, setPackages] = useState<RenderPackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Partial<RenderPackage> | null>(null);
  const [pkgError, setPkgError] = useState<string | null>(null);
  const [pkgSuccess, setPkgSuccess] = useState<string | null>(null);

  const loadPackages = async () => {
    setPackagesLoading(true);
    try {
      const data = await authService.getRenderPackages();
      if (Array.isArray(data)) {
        setPackages(data);
      }
    } catch {
      // Offline fallback: load from localStorage mock
      const cached = localStorage.getItem(MOCK_PACKAGES_KEY);
      if (cached) {
        setPackages(JSON.parse(cached));
      } else {
        const defaults = [
          {
            packageCode: "RENDER_10",
            name: "10 Render Paketi",
            badge: "Sürətli Sınaq",
            rendersCount: 10,
            price: 1.00,
            description: "Dizaynları sınamaq üçün sürətli və münasib seçim.",
            note: "* Qeyd: Əgər bu dizaynlardan hər hansı birini sifariş verərsinizsə, bu 1 AZN ödəniş sizə geri qaytarılacaqdır."
          },
          {
            packageCode: "RENDER_50",
            name: "50 Render Paketi",
            badge: "Populyar Seçim",
            rendersCount: 50,
            price: 4.00,
            description: "Daha çox sınaq və fərqli üslubları müqayisə etmək istəyənlər üçün əla fürsət.",
            note: ""
          },
          {
            packageCode: "RENDER_100",
            name: "100 Render Paketi",
            badge: "Ən Sərfəli",
            rendersCount: 100,
            price: 6.00,
            description: "Professional floristik dizaynlar və limit qayğısı olmadan limitsiz təcrübə.",
            note: ""
          }
        ];
        setPackages(defaults);
        localStorage.setItem(MOCK_PACKAGES_KEY, JSON.stringify(defaults));
      }
    } finally {
      setPackagesLoading(false);
    }
  };

  useEffect(() => {
    loadPackages();
  }, []);

  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPackage?.packageCode || !editingPackage?.name) {
      setPkgError('Zəhmət olmasa Kod və Ad sahələrini doldurun.');
      return;
    }
    setPkgError(null);
    setPkgSuccess(null);
    try {
      await adminService.saveRenderPackage(editingPackage);
      setPkgSuccess('Paket uğurla yadda saxlanıldı.');
      setEditingPackage(null);
      loadPackages();
    } catch (err: any) {
      // Offline fallback: save locally
      const updated = [...packages];
      const idx = updated.findIndex(p => p.packageCode === editingPackage.packageCode);
      const pkgToSave = {
        packageCode: editingPackage.packageCode,
        name: editingPackage.name || '',
        badge: editingPackage.badge || '',
        rendersCount: Number(editingPackage.rendersCount) || 10,
        price: Number(editingPackage.price) || 1.00,
        description: editingPackage.description || '',
        note: editingPackage.note || ''
      };
      if (idx >= 0) {
        updated[idx] = pkgToSave;
      } else {
        updated.push(pkgToSave);
      }
      setPackages(updated);
      localStorage.setItem(MOCK_PACKAGES_KEY, JSON.stringify(updated));
      setPkgSuccess('Paket uğurla yadda saxlanıldı (Local Mock Mode).');
      setEditingPackage(null);
    }
  };

  const handleDeletePackage = async (code: string) => {
    if (!confirm('Bu paketi silmək istədiyinizdən əminsiniz?')) return;
    setPkgError(null);
    setPkgSuccess(null);
    try {
      await adminService.deleteRenderPackage(code);
      setPkgSuccess('Paket silindi.');
      loadPackages();
    } catch {
      // Offline fallback: delete locally
      const updated = packages.filter(p => p.packageCode !== code);
      setPackages(updated);
      localStorage.setItem(MOCK_PACKAGES_KEY, JSON.stringify(updated));
      setPkgSuccess('Paket silindi (Local Mock Mode).');
    }
  };

  // ==========================================
  // USER RENDER LIMITS OVERRIDE LOGIC
  // ==========================================
  const [searchUserId, setSearchUserId] = useState('');
  const [userLimitLoading, setUserLimitLoading] = useState(false);
  const [limitError, setLimitError] = useState<string | null>(null);
  const [limitSuccess, setLimitSuccess] = useState<string | null>(null);
  const [userRenderCount, setUserRenderCount] = useState<number | null>(null);
  const [newLimitCount, setNewLimitCount] = useState<number>(5);

  const handleFetchUserLimits = async () => {
    const id = Number(searchUserId.trim());
    if (!searchUserId.trim() || !Number.isFinite(id)) {
      setLimitError('Keçərli istifadəçi ID-si daxil edin.');
      return;
    }
    setLimitError(null);
    setLimitSuccess(null);
    setUserRenderCount(null);
    setUserLimitLoading(true);
    try {
      const data = await adminService.getUserRenderStatus(id);
      if (data) {
        setUserRenderCount(data.renderCount ?? 0);
        setNewLimitCount(data.renderCount ?? 0);
      } else {
        setLimitError('İstifadəçi tapılmadı.');
      }
    } catch {
      // Offline fallback: load from mock local storage
      const mockKey = `mock_user_render_${id}`;
      const mockCount = Number(localStorage.getItem(mockKey)) || 0;
      setUserRenderCount(mockCount);
      setNewLimitCount(mockCount);
      setLimitSuccess('Məlumatlar yükləndi (Local Mock Mode).');
    } finally {
      setUserLimitLoading(false);
    }
  };

  const handleOverrideLimit = async () => {
    const id = Number(searchUserId.trim());
    setLimitError(null);
    setLimitSuccess(null);
    setUserLimitLoading(true);
    try {
      await adminService.updateUserRenderLimit(id, newLimitCount);
      setLimitSuccess('İstifadəçi render limiti uğurla yeniləndi.');
      setUserRenderCount(newLimitCount);
    } catch {
      // Offline fallback: save locally
      const mockKey = `mock_user_render_${id}`;
      localStorage.setItem(mockKey, String(newLimitCount));
      setLimitSuccess('İstifadəçi render limiti uğurla yeniləndi (Local Mock Mode).');
      setUserRenderCount(newLimitCount);
    } finally {
      setUserLimitLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fdfcf0] p-6 lg:p-8 dark:bg-background-dark text-floral-deep dark:text-white">
      <div className="mx-auto w-full max-w-4xl space-y-5">
        {/* Header */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_18px_45px_rgba(16,24,40,0.08)] dark:border-white/10 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center text-primary">
              <Sparkles className="size-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">Render İdarəetməsi</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-white/60">
                Bouquet Studio render paketlərinin qiymətlərini və istifadəçi limitlərini buradan tənzimləyin.
              </p>
            </div>
          </div>

          {/* Sub Navigation */}
          <div className="mt-6 flex border-b border-slate-200 dark:border-white/10">
            <button
              onClick={() => setActiveSubTab('packages')}
              className={`pb-3 text-xs font-black uppercase tracking-wider border-b-2 px-4 transition-colors ${
                activeSubTab === 'packages'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-white/80'
              }`}
            >
              Render Paketləri
            </button>
            <button
              onClick={() => setActiveSubTab('user_limits')}
              className={`pb-3 text-xs font-black uppercase tracking-wider border-b-2 px-4 transition-colors ${
                activeSubTab === 'user_limits'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-white/80'
              }`}
            >
              İstifadəçi Limitləri
            </button>
          </div>
        </div>

        {/* Tab Content: Packages */}
        {activeSubTab === 'packages' && (
          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_10px_35px_rgba(16,24,40,0.06)] dark:border-white/10 dark:bg-slate-950/40">
              <div className="flex justify-between items-center mb-4">
                <p className="text-xs font-black uppercase tracking-[0.08em] text-slate-500 dark:text-white/55">Buket Render Paketləri</p>
                <button
                  onClick={() => setEditingPackage({ packageCode: '', name: '', price: 1.0, rendersCount: 10 })}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-black px-3.5 py-1.5 text-xs font-black shadow-sm hover:scale-[1.02] transition-transform"
                >
                  <Plus className="size-3.5" /> Yeni Paket
                </button>
              </div>

              {pkgSuccess ? <p className="mb-4 text-xs font-bold text-emerald-600">{pkgSuccess}</p> : null}

              {packagesLoading ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="animate-spin size-6 text-primary" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-white/10 text-slate-400 font-bold uppercase">
                        <th className="py-2.5 px-3">Kod</th>
                        <th className="py-2.5 px-3">Ad</th>
                        <th className="py-2.5 px-3 text-center">Render Sayı</th>
                        <th className="py-2.5 px-3 text-right">Qiymət</th>
                        <th className="py-2.5 px-3">Nişan (Badge)</th>
                        <th className="py-2.5 px-3 text-center">Əməliyyatlar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {packages.map((pkg) => (
                        <tr key={pkg.packageCode} className="border-b border-slate-50 dark:border-white/[0.04] hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                          <td className="py-3 px-3 font-bold">{pkg.packageCode}</td>
                          <td className="py-3 px-3 font-semibold">{pkg.name}</td>
                          <td className="py-3 px-3 text-center font-bold text-primary">{pkg.rendersCount}</td>
                          <td className="py-3 px-3 text-right font-black text-slate-800 dark:text-white">{pkg.price.toFixed(2)} AZN</td>
                          <td className="py-3 px-3">
                            {pkg.badge ? (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                                {pkg.badge}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => setEditingPackage(pkg)}
                                className="p-1 text-slate-500 hover:text-primary transition-colors"
                              >
                                <Edit className="size-4" />
                              </button>
                              <button
                                onClick={() => handleDeletePackage(pkg.packageCode)}
                                className="p-1 text-slate-500 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Edit / Add Modal Form */}
            {editingPackage && (
              <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center">
                <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 md:p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-black uppercase tracking-wider">
                      {editingPackage.packageCode ? 'Paketi Redaktə Et' : 'Yeni Paket Əlavə Et'}
                    </h3>
                    <button
                      className="size-8 rounded-lg border border-slate-200 dark:border-white/10 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                      onClick={() => setEditingPackage(null)}
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  {pkgError ? <p className="mb-4 text-xs font-bold text-red-500">{pkgError}</p> : null}

                  <form onSubmit={handleSavePackage} className="space-y-3.5">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Paket Kodu (Code)</label>
                      <input
                        type="text"
                        disabled={!!packages.find(p => p.packageCode === editingPackage.packageCode)}
                        value={editingPackage.packageCode || ''}
                        onChange={(e) => setEditingPackage(prev => ({ ...prev, packageCode: e.target.value }))}
                        placeholder="Məs. RENDER_10"
                        className="w-full rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 text-sm bg-transparent outline-none focus:border-primary text-black dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Paket Adı (Name)</label>
                      <input
                        type="text"
                        value={editingPackage.name || ''}
                        onChange={(e) => setEditingPackage(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Məs. 10 Render Paketi"
                        className="w-full rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 text-sm bg-transparent outline-none focus:border-primary text-black dark:text-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Render Sayı</label>
                        <input
                          type="number"
                          value={editingPackage.rendersCount || 0}
                          onChange={(e) => setEditingPackage(prev => ({ ...prev, rendersCount: Number(e.target.value) || 0 }))}
                          placeholder="10"
                          className="w-full rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 text-sm bg-transparent outline-none focus:border-primary text-black dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Qiymət (AZN)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editingPackage.price || 0}
                          onChange={(e) => setEditingPackage(prev => ({ ...prev, price: Number(e.target.value) || 0 }))}
                          placeholder="1.00"
                          className="w-full rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 text-sm bg-transparent outline-none focus:border-primary text-black dark:text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Nişan (Badge)</label>
                      <input
                        type="text"
                        value={editingPackage.badge || ''}
                        onChange={(e) => setEditingPackage(prev => ({ ...prev, badge: e.target.value }))}
                        placeholder="Məs. Sürətli Sınaq"
                        className="w-full rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 text-sm bg-transparent outline-none focus:border-primary text-black dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Təsvir (Description)</label>
                      <textarea
                        value={editingPackage.description || ''}
                        onChange={(e) => setEditingPackage(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Paket barədə təsvir qeyd edin..."
                        className="w-full min-h-16 rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 text-sm bg-transparent outline-none focus:border-primary text-black dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Xüsusi Qeyd (Note)</label>
                      <textarea
                        value={editingPackage.note || ''}
                        onChange={(e) => setEditingPackage(prev => ({ ...prev, note: e.target.value }))}
                        placeholder="Refund barədə və ya digər qeyd..."
                        className="w-full min-h-16 rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 text-sm bg-transparent outline-none focus:border-primary text-black dark:text-white"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-primary text-black font-black py-2.5 rounded-xl shadow-md"
                    >
                      Saxla
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab Content: User limits override */}
        {activeSubTab === 'user_limits' && (
          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_10px_35px_rgba(16,24,40,0.06)] dark:border-white/10 dark:bg-slate-950/40">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.08em] text-slate-500 dark:text-white/55">İstifadəçi Render Limitini Dəyiş</p>
              
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchUserId}
                    onChange={(e) => setSearchUserId(e.target.value)}
                    placeholder="İstifadəçi ID-si daxil edin..."
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 pl-10 pr-3 py-2.5 text-sm bg-transparent outline-none focus:border-primary text-black dark:text-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleFetchUserLimits}
                  disabled={userLimitLoading}
                  className="rounded-xl bg-primary text-black px-5 py-2.5 text-xs font-black disabled:opacity-70 flex items-center gap-1.5"
                >
                  <Search className="size-3.5" /> Axtar
                </button>
              </div>

              {limitError ? <p className="mt-3 text-xs font-bold text-red-500">{limitError}</p> : null}
              {limitSuccess ? <p className="mt-3 text-xs font-bold text-emerald-600">{limitSuccess}</p> : null}

              {userRenderCount !== null && (
                <div className="mt-6 border-t border-slate-100 dark:border-white/10 pt-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="p-3 bg-primary/10 rounded-2xl text-primary">
                      <Sparkles className="size-6" />
                    </span>
                    <div>
                      <p className="text-xs text-slate-400">Cari Render Sayı</p>
                      <p className="text-lg font-black text-slate-800 dark:text-white">
                        {userRenderCount} / 5 <span className="text-xs font-normal text-slate-400">(Pulsuz limit: 5)</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-40">
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Yeni Limit Sayı</label>
                      <input
                        type="number"
                        min={0}
                        value={newLimitCount}
                        onChange={(e) => setNewLimitCount(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2.5 text-sm bg-transparent outline-none focus:border-primary text-black dark:text-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleOverrideLimit}
                      disabled={userLimitLoading}
                      className="mt-5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-5 py-2.5 text-xs font-black shadow-md flex items-center gap-1.5"
                    >
                      <Save className="size-3.5" /> Limiti Yenilə
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
