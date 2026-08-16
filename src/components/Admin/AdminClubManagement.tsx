import React, { useEffect, useState } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  Sparkles, 
  X, 
  Loader2, 
  DollarSign, 
  Image, 
  FileText 
} from 'lucide-react';
import { authService } from '../../services/api';

type SubscriptionPlan = {
  code: string;
  name?: string;
  discountPercent: number;
  periodMonths: number;
};

type ClubStyle = {
  name: string;
  img: string;
  desc: string;
};

type ClubSettings = {
  pricePerDelivery: number;
  styles: ClubStyle[];
  frequencies: string[];
};

const MOCK_PLANS_KEY = 'mock_subscription_plans';
const MOCK_SETTINGS_KEY = 'mock_club_settings';

export default function AdminClubManagement() {
  const [activeSubTab, setActiveSubTab] = useState<'settings' | 'plans'>('settings');

  // ==========================================
  // CLUB SETTINGS MANAGEMENT LOGIC
  // ==========================================
  const [settings, setSettings] = useState<ClubSettings>({
    pricePerDelivery: 25,
    styles: [],
    frequencies: []
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);

  // Styles edit dialog state
  const [editingStyle, setEditingStyle] = useState<Partial<ClubStyle> | null>(null);
  const [editingStyleIdx, setEditingStyleIdx] = useState<number | null>(null);
  const [styleError, setStyleError] = useState<string | null>(null);

  // Frequencies edit state
  const [newFreqInput, setNewFreqInput] = useState('');

  const loadClubSettings = async () => {
    setSettingsLoading(true);
    try {
      const data = await authService.getClubSettings();
      if (data) {
        setSettings({
          pricePerDelivery: Number(data.pricePerDelivery) || 25,
          styles: Array.isArray(data.styles) ? data.styles : [],
          frequencies: Array.isArray(data.frequencies) ? data.frequencies : []
        });
      }
    } catch {
      // Offline fallback: load from localStorage mock
      const cached = localStorage.getItem(MOCK_SETTINGS_KEY);
      if (cached) {
        setSettings(JSON.parse(cached));
      } else {
        const defaults = {
          pricePerDelivery: 25,
          styles: [
            { name: 'Modern & Minimal', img: 'https://images.unsplash.com/photo-1561181286-d3fee7d55364?auto=format&fit=crop&w=300&q=80', desc: 'Zərif xətlər, tək tonlu dizayn.' },
            { name: 'Klassik Romantik', img: 'https://images.unsplash.com/photo-1596436889106-be35e843f974?auto=format&fit=crop&w=300&q=80', desc: 'Qızılgüllər və klassik toxunuşlar.' },
            { name: 'Vəhşi Təbiət', img: 'https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=300&q=80', desc: 'Çöl çiçəkləri və bohem harmoniyası.' },
            { name: 'Mövsüm Sürprizi', img: 'https://images.unsplash.com/photo-1587334206502-747aba2e8c25?auto=format&fit=crop&w=300&q=80', desc: 'Fəslin ən təravətli sürpriz çiçəkləri.' }
          ],
          frequencies: ['Hər Həftə', '2 Həftədən Bir', 'Ayda Bir']
        };
        setSettings(defaults);
        localStorage.setItem(MOCK_SETTINGS_KEY, JSON.stringify(defaults));
      }
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSettingsLoading(true);
    setSettingsSuccess(null);
    try {
      await authService.saveClubSettings(settings);
      setSettingsSuccess('Klub tənzimləmələri uğurla yadda saxlanıldı.');
      loadClubSettings();
    } catch {
      // Offline fallback: save locally
      localStorage.setItem(MOCK_SETTINGS_KEY, JSON.stringify(settings));
      setSettingsSuccess('Klub tənzimləmələri uğurla yadda saxlanıldı (Local Mock Mode).');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleSaveStyle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStyle?.name || !editingStyle?.img) {
      setStyleError('Zəhmət olmasa Ad və Şəkil URL-i daxil edin.');
      return;
    }
    setStyleError(null);
    const updatedStyles = [...settings.styles];
    const styleObj = {
      name: editingStyle.name,
      img: editingStyle.img,
      desc: editingStyle.desc || ''
    };

    if (editingStyleIdx !== null) {
      updatedStyles[editingStyleIdx] = styleObj;
    } else {
      updatedStyles.push(styleObj);
    }

    setSettings(prev => ({ ...prev, styles: updatedStyles }));
    setEditingStyle(null);
    setEditingStyleIdx(null);
  };

  const handleDeleteStyle = (idx: number) => {
    if (!confirm('Bu üslubu siyahıdan silmək istədiyinizdən əminsiniz?')) return;
    const updatedStyles = settings.styles.filter((_, i) => i !== idx);
    setSettings(prev => ({ ...prev, styles: updatedStyles }));
  };

  const handleAddFrequency = () => {
    const val = newFreqInput.trim();
    if (!val) return;
    if (settings.frequencies.includes(val)) {
      alert('Bu tezlik artıq mövcuddur.');
      return;
    }
    setSettings(prev => ({
      ...prev,
      frequencies: [...prev.frequencies, val]
    }));
    setNewFreqInput('');
  };

  const handleDeleteFrequency = (freq: string) => {
    const updated = settings.frequencies.filter(f => f !== freq);
    setSettings(prev => ({ ...prev, frequencies: updated }));
  };

  // ==========================================
  // SUBSCRIPTION PLANS MANAGEMENT LOGIC
  // ==========================================
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Partial<SubscriptionPlan> | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planSuccess, setPlanSuccess] = useState<string | null>(null);

  const loadPlans = async () => {
    setPlansLoading(true);
    try {
      const data = await authService.getSubscriptionPlans();
      if (Array.isArray(data)) {
        setPlans(data);
      }
    } catch {
      // Offline fallback: load from localStorage mock
      const cached = localStorage.getItem(MOCK_PLANS_KEY);
      if (cached) {
        setPlans(JSON.parse(cached));
      } else {
        const defaults = [
          { code: 'MONTHLY', discountPercent: 0, periodMonths: 1 },
          { code: 'QUARTERLY', discountPercent: 10, periodMonths: 3 },
          { code: 'SEMI_ANNUAL', discountPercent: 15, periodMonths: 6 },
          { code: 'ANNUAL', discountPercent: 20, periodMonths: 12 },
        ];
        setPlans(defaults);
        localStorage.setItem(MOCK_PLANS_KEY, JSON.stringify(defaults));
      }
    } finally {
      setPlansLoading(false);
    }
  };

  useEffect(() => {
    loadClubSettings();
    loadPlans();
  }, []);

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan?.code || editingPlan.discountPercent === undefined || !editingPlan.periodMonths) {
      setPlanError('Zəhmət olmasa Kod, Müddət və Endirim sahələrini doldurun.');
      return;
    }
    setPlanError(null);
    setPlanSuccess(null);
    try {
      await authService.saveSubscriptionPlan(editingPlan);
      setPlanSuccess('Plan uğurla saxlanıldı.');
      setEditingPlan(null);
      loadPlans();
    } catch {
      // Offline fallback: save locally
      const updated = [...plans];
      const idx = updated.findIndex(p => p.code === editingPlan.code);
      const planToSave = {
        code: editingPlan.code,
        name: editingPlan.name || editingPlan.code,
        discountPercent: Number(editingPlan.discountPercent) || 0,
        periodMonths: Number(editingPlan.periodMonths) || 1
      };
      if (idx >= 0) {
        updated[idx] = planToSave;
      } else {
        updated.push(planToSave);
      }
      setPlans(updated);
      localStorage.setItem(MOCK_PLANS_KEY, JSON.stringify(updated));
      setPlanSuccess('Plan uğurla saxlanıldı (Local Mock Mode).');
      setEditingPlan(null);
    }
  };

  const handleDeletePlan = async (code: string) => {
    if (!confirm('Bu abunəlik planını silmək istədiyinizdən əminsiniz?')) return;
    setPlanError(null);
    setPlanSuccess(null);
    try {
      await authService.deleteSubscriptionPlan(code);
      setPlanSuccess('Plan silindi.');
      loadPlans();
    } catch {
      // Offline fallback: delete locally
      const updated = plans.filter(p => p.code !== code);
      setPlans(updated);
      localStorage.setItem(MOCK_PLANS_KEY, JSON.stringify(updated));
      setPlanSuccess('Plan silindi (Local Mock Mode).');
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
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">Club İdarəetməsi</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-white/60">
                BirBuketClub abunəlik planlarını, buket qiymətlərini və dizayn üslublarını tənzimləyin.
              </p>
            </div>
          </div>

          {/* Sub Navigation */}
          <div className="mt-6 flex border-b border-slate-200 dark:border-white/10">
            <button
              onClick={() => setActiveSubTab('settings')}
              className={`pb-3 text-xs font-black uppercase tracking-wider border-b-2 px-4 transition-colors ${
                activeSubTab === 'settings'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-white/80'
              }`}
            >
              Klub Parametrləri
            </button>
            <button
              onClick={() => setActiveSubTab('plans')}
              className={`pb-3 text-xs font-black uppercase tracking-wider border-b-2 px-4 transition-colors ${
                activeSubTab === 'plans'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-white/80'
              }`}
            >
              Abunəlik Planları
            </button>
          </div>
        </div>

        {/* Tab 1: Club Settings (Price, Styles, Frequencies) */}
        {activeSubTab === 'settings' && (
          <div className="space-y-4">
            {/* Price per Delivery */}
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_10px_35px_rgba(16,24,40,0.06)] dark:border-white/10 dark:bg-slate-950/40">
              <h3 className="text-xs font-black uppercase tracking-[0.08em] text-slate-500 dark:text-white/55 mb-4">Gül Buketi Qiymətləndirilməsi</h3>
              
              {settingsSuccess ? <p className="mb-4 text-xs font-bold text-emerald-600">{settingsSuccess}</p> : null}

              <div className="flex items-center gap-3 w-72">
                <div className="relative flex-1">
                  <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <input
                    type="number"
                    min={1}
                    value={settings.pricePerDelivery}
                    onChange={(e) => setSettings(prev => ({ ...prev, pricePerDelivery: Math.max(1, Number(e.target.value) || 25) }))}
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 pl-10 pr-3 py-2.5 text-sm bg-transparent outline-none focus:border-primary text-black dark:text-white"
                  />
                </div>
                <span className="text-xs font-bold text-slate-500">AZN / Buket</span>
              </div>
            </div>

            {/* Frequencies management */}
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_10px_35px_rgba(16,24,40,0.06)] dark:border-white/10 dark:bg-slate-950/40">
              <h3 className="text-xs font-black uppercase tracking-[0.08em] text-slate-500 dark:text-white/55 mb-4">Mövsümi Çatdırılma Tezlikləri</h3>
              
              <div className="flex flex-wrap gap-2.5 mb-4">
                {settings.frequencies.map((freq) => (
                  <span 
                    key={freq} 
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-1.5 text-xs font-semibold"
                  >
                    {freq}
                    <button 
                      onClick={() => handleDeleteFrequency(freq)}
                      className="text-red-500 hover:text-red-700 transition-colors font-bold"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2 w-80">
                <input
                  type="text"
                  value={newFreqInput}
                  onChange={(e) => setNewFreqInput(e.target.value)}
                  placeholder="Yeni tezlik (Məs. Hər Həftə)..."
                  className="flex-1 rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 text-xs bg-transparent outline-none focus:border-primary text-black dark:text-white"
                />
                <button
                  onClick={handleAddFrequency}
                  className="rounded-xl bg-primary text-black px-4 py-2 text-xs font-black"
                >
                  Əlavə Et
                </button>
              </div>
            </div>

            {/* Styles management */}
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_10px_35px_rgba(16,24,40,0.06)] dark:border-white/10 dark:bg-slate-955/40">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-black uppercase tracking-[0.08em] text-slate-500 dark:text-white/55">Klub Buket Üslubları</h3>
                <button
                  onClick={() => setEditingStyle({ name: '', img: '', desc: '' })}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-black px-3.5 py-1.5 text-xs font-black shadow-sm"
                >
                  <Plus className="size-3.5" /> Yeni Üslub
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {settings.styles.map((styleObj, idx) => (
                  <div key={idx} className="flex gap-3 p-3 rounded-2xl border border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.01]">
                    <img 
                      src={styleObj.img} 
                      alt={styleObj.name} 
                      className="w-20 h-20 rounded-xl object-cover border border-white/10" 
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-xs truncate">{styleObj.name}</h4>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setEditingStyle(styleObj);
                              setEditingStyleIdx(idx);
                            }}
                            className="p-1 text-slate-400 hover:text-primary transition-colors"
                          >
                            <Edit className="size-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteStyle(idx)}
                            className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">{styleObj.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleSaveSettings}
                disabled={settingsLoading}
                className="mt-6 w-full rounded-2xl bg-primary text-black font-black py-3 hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <Save className="size-4" /> Klub Tənzimləmələrini Yadda Saxla
              </button>
            </div>

            {/* Edit Style Dialog Modal */}
            {editingStyle && (
              <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center">
                <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 md:p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-black uppercase tracking-wider">
                      {editingStyleIdx !== null ? 'Üslubu Redaktə Et' : 'Yeni Üslub Əlavə Et'}
                    </h3>
                    <button
                      className="size-8 rounded-lg border border-slate-200 dark:border-white/10 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                      onClick={() => {
                        setEditingStyle(null);
                        setEditingStyleIdx(null);
                      }}
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  {styleError ? <p className="mb-4 text-xs font-bold text-red-500">{styleError}</p> : null}

                  <form onSubmit={handleSaveStyle} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Üslub Adı (Name)</label>
                      <input
                        type="text"
                        value={editingStyle.name || ''}
                        onChange={(e) => setEditingStyle(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Məs. Modern & Minimal"
                        className="w-full rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 text-sm bg-transparent outline-none focus:border-primary text-black dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Şəkil Linki (Image URL)</label>
                      <input
                        type="text"
                        value={editingStyle.img || ''}
                        onChange={(e) => setEditingStyle(prev => ({ ...prev, img: e.target.value }))}
                        placeholder="https://..."
                        className="w-full rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 text-sm bg-transparent outline-none focus:border-primary text-black dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Qısa Təsvir (Description)</label>
                      <textarea
                        value={editingStyle.desc || ''}
                        onChange={(e) => setEditingStyle(prev => ({ ...prev, desc: e.target.value }))}
                        placeholder="Qısa dizayn təsviri..."
                        className="w-full min-h-16 rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 text-sm bg-transparent outline-none focus:border-primary text-black dark:text-white"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-primary text-black font-black py-2.5 rounded-xl shadow-md"
                    >
                      Üslubu Saxla
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Subscription Plans Management */}
        {activeSubTab === 'plans' && (
          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_10px_35px_rgba(16,24,40,0.06)] dark:border-white/10 dark:bg-slate-950/40">
              <div className="flex justify-between items-center mb-4">
                <p className="text-xs font-black uppercase tracking-[0.08em] text-slate-500 dark:text-white/55">Klub Abunəlik Planları</p>
                <button
                  onClick={() => setEditingPlan({ code: '', discountPercent: 0, periodMonths: 1 })}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-black px-3.5 py-1.5 text-xs font-black shadow-sm"
                >
                  <Plus className="size-3.5" /> Yeni Plan
                </button>
              </div>

              {planSuccess ? <p className="mb-4 text-xs font-bold text-emerald-600">{planSuccess}</p> : null}

              {plansLoading ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="animate-spin size-6 text-primary" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-white/10 text-slate-400 font-bold uppercase">
                        <th className="py-2.5 px-3">Plan Kodu</th>
                        <th className="py-2.5 px-3">Müddət (Ay)</th>
                        <th className="py-2.5 px-3 text-center">Endirim (%)</th>
                        <th className="py-2.5 px-3 text-center">Əməliyyatlar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plans.map((p) => (
                        <tr key={p.code} className="border-b border-slate-50 dark:border-white/[0.04] hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                          <td className="py-3 px-3 font-bold">{p.code}</td>
                          <td className="py-3 px-3 font-semibold">{p.periodMonths} ay</td>
                          <td className="py-3 px-3 text-center font-bold text-primary">{p.discountPercent}%</td>
                          <td className="py-3 px-3">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => setEditingPlan(p)}
                                className="p-1 text-slate-500 hover:text-primary transition-colors"
                              >
                                <Edit className="size-4" />
                              </button>
                              <button
                                onClick={() => handleDeletePlan(p.code)}
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

            {/* Edit / Add Subscription Plan Modal Form */}
            {editingPlan && (
              <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center">
                <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 md:p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-black uppercase tracking-wider">
                      {editingPlan.code ? 'Planı Redaktə Et' : 'Yeni Plan Əlavə Et'}
                    </h3>
                    <button
                      className="size-8 rounded-lg border border-slate-200 dark:border-white/10 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                      onClick={() => setEditingPlan(null)}
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  {planError ? <p className="mb-4 text-xs font-bold text-red-500">{planError}</p> : null}

                  <form onSubmit={handleSavePlan} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Plan Kodu (Məs. MONTHLY / QUARTERLY)</label>
                      <input
                        type="text"
                        disabled={!!plans.find(p => p.code === editingPlan.code)}
                        value={editingPlan.code || ''}
                        onChange={(e) => setEditingPlan(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                        placeholder="Məs. QUARTERLY"
                        className="w-full rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 text-sm bg-transparent outline-none focus:border-primary text-black dark:text-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Müddət (Ay ilə)</label>
                        <input
                          type="number"
                          min={1}
                          value={editingPlan.periodMonths || 1}
                          onChange={(e) => setEditingPlan(prev => ({ ...prev, periodMonths: Number(e.target.value) || 1 }))}
                          placeholder="3"
                          className="w-full rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 text-sm bg-transparent outline-none focus:border-primary text-black dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Endirim (%)</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={editingPlan.discountPercent || 0}
                          onChange={(e) => setEditingPlan(prev => ({ ...prev, discountPercent: Number(e.target.value) || 0 }))}
                          placeholder="10"
                          className="w-full rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 text-sm bg-transparent outline-none focus:border-primary text-black dark:text-white"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-primary text-black font-black py-2.5 rounded-xl shadow-md"
                    >
                      Planı Saxla
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
