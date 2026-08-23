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
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle
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
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Styles edit dialog state
  const [editingStyle, setEditingStyle] = useState<Partial<ClubStyle> | null>(null);
  const [editingStyleIdx, setEditingStyleIdx] = useState<number | null>(null);
  const [styleError, setStyleError] = useState<string | null>(null);

  // Frequencies edit state
  const [newFreqInput, setNewFreqInput] = useState('');
  const [editingFreqIdx, setEditingFreqIdx] = useState<number | null>(null);
  const [editingFreqValue, setEditingFreqValue] = useState<string>('');

  const loadClubSettings = async () => {
    setSettingsLoading(true);
    try {
      const data = await authService.getClubSettings();
      if (data) {
        const loadedSettings: ClubSettings = {
          pricePerDelivery: Number(data.pricePerDelivery) || 25,
          styles: Array.isArray(data.styles) && data.styles.length > 0 ? data.styles : [
            { name: 'Modern & Minimal', img: 'https://images.unsplash.com/photo-1561181286-d3fee7d55364?auto=format&fit=crop&w=300&q=80', desc: 'Zərif xətlər, tək tonlu dizayn.' },
            { name: 'Klassik Romantik', img: 'https://images.unsplash.com/photo-1596436889106-be35e843f974?auto=format&fit=crop&w=300&q=80', desc: 'Qızılgüllər və klassik toxunuşlar.' },
            { name: 'Vəhşi Təbiət', img: 'https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=300&q=80', desc: 'Çöl çiçəkləri və bohem harmoniyası.' },
            { name: 'Mövsüm Sürprizi', img: 'https://images.unsplash.com/photo-1587334206502-747aba2e8c25?auto=format&fit=crop&w=300&q=80', desc: 'Fəslin ən təravətli sürpriz çiçəkləri.' }
          ],
          frequencies: Array.isArray(data.frequencies) && data.frequencies.length > 0 ? data.frequencies : ['Hər Həftə', '2 Həftədən Bir', 'Ayda Bir']
        };
        setSettings(loadedSettings);
        localStorage.setItem(MOCK_SETTINGS_KEY, JSON.stringify(loadedSettings));
      }
    } catch {
      // Offline fallback: load from localStorage mock
      const cached = localStorage.getItem(MOCK_SETTINGS_KEY);
      if (cached) {
        setSettings(JSON.parse(cached));
      } else {
        const defaults: ClubSettings = {
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

  const persistSettings = async (newSettings: ClubSettings, successMsg: string = 'Klub tənzimləmələri uğurla yadda saxlanıldı.') => {
    setSettings(newSettings);
    localStorage.setItem(MOCK_SETTINGS_KEY, JSON.stringify(newSettings));
    setSettingsLoading(true);
    setSettingsError(null);
    setSettingsSuccess(null);
    try {
      await authService.saveClubSettings(newSettings);
      setSettingsSuccess(successMsg);
    } catch {
      setSettingsSuccess(`${successMsg} (Lokal rejimdə saxlanıldı)`);
    } finally {
      setSettingsLoading(false);
      setTimeout(() => {
        setSettingsSuccess(null);
      }, 3500);
    }
  };

  const handleImageUpload = (file: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setStyleError('Şəkil ölçüsü 10MB-dan çox ola bilməz.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setEditingStyle(prev => ({ ...prev, img: result }));
      setStyleError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveStyle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStyle?.name?.trim() || !editingStyle?.img?.trim()) {
      setStyleError('Zəhmət olmasa Ad və Şəkil (Fayl və ya URL) daxil edin.');
      return;
    }
    setStyleError(null);
    const updatedStyles = [...settings.styles];
    const styleObj: ClubStyle = {
      name: editingStyle.name.trim(),
      img: editingStyle.img.trim(),
      desc: editingStyle.desc?.trim() || ''
    };

    if (editingStyleIdx !== null) {
      updatedStyles[editingStyleIdx] = styleObj;
    } else {
      updatedStyles.push(styleObj);
    }

    const nextSettings = { ...settings, styles: updatedStyles };
    setEditingStyle(null);
    setEditingStyleIdx(null);
    await persistSettings(nextSettings, 'Buket üslubu uğurla saxlanıldı.');
  };

  const handleDeleteStyle = async (idx: number) => {
    if (!confirm('Bu üslubu siyahıdan silmək istədiyinizdən əminsiniz?')) return;
    const updatedStyles = settings.styles.filter((_, i) => i !== idx);
    const nextSettings = { ...settings, styles: updatedStyles };
    await persistSettings(nextSettings, 'Buket üslubu silindi.');
  };

  const handleAddFrequency = async () => {
    const val = newFreqInput.trim();
    if (!val) return;
    if (settings.frequencies.includes(val)) {
      alert('Bu tezlik artıq mövcuddur.');
      return;
    }
    const nextSettings = {
      ...settings,
      frequencies: [...settings.frequencies, val]
    };
    setNewFreqInput('');
    await persistSettings(nextSettings, `"${val}" tezliyi əlavə edildi.`);
  };

  const handleStartEditFreq = (idx: number, freq: string) => {
    setEditingFreqIdx(idx);
    setEditingFreqValue(freq);
  };

  const handleSaveEditFreq = async () => {
    if (editingFreqIdx === null) return;
    const val = editingFreqValue.trim();
    if (!val) return;
    const updated = [...settings.frequencies];
    updated[editingFreqIdx] = val;
    const nextSettings = { ...settings, frequencies: updated };
    setEditingFreqIdx(null);
    setEditingFreqValue('');
    await persistSettings(nextSettings, `Tezlik "${val}" olaraq yeniləndi.`);
  };

  const handleDeleteFrequency = async (freq: string) => {
    if (!confirm(`"${freq}" tezliyini silmək istədiyinizdən əminsiniz?`)) return;
    const updated = settings.frequencies.filter(f => f !== freq);
    const nextSettings = { ...settings, frequencies: updated };
    await persistSettings(nextSettings, `"${freq}" tezliyi silindi.`);
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
      if (Array.isArray(data) && data.length > 0) {
        setPlans(data);
      } else {
        throw new Error('No plans');
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
    <div className="space-y-6">
      {/* Top Header info */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_10px_35px_rgba(16,24,40,0.06)] dark:border-white/10 dark:bg-slate-950/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="size-5" />
              </span>
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">BirBuket Club İdarəetməsi</h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-white/60">
              Çatdırılma tezlikləri, buket üslubları (şəkil yükləmə ilə) və abunəlik planlarının tam idarəsi (Create, Update, Delete).
            </p>
          </div>

          {/* Sub tabs */}
          <div className="flex gap-2 bg-slate-100 dark:bg-white/5 p-1 rounded-2xl self-start md:self-auto border border-slate-200/60 dark:border-white/10">
            <button
              onClick={() => setActiveSubTab('settings')}
              className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${
                activeSubTab === 'settings'
                  ? 'bg-white text-slate-900 dark:bg-slate-800 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-white/60 dark:hover:text-white'
              }`}
            >
              Üslublar & Tezliklər
            </button>
            <button
              onClick={() => setActiveSubTab('plans')}
              className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${
                activeSubTab === 'plans'
                  ? 'bg-white text-slate-900 dark:bg-slate-800 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-white/60 dark:hover:text-white'
              }`}
            >
              Abunəlik Planları
            </button>
          </div>
        </div>
      </div>

      {/* Global Status messages */}
      {settingsSuccess && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-4 shrink-0" />
          {settingsSuccess}
        </div>
      )}
      {settingsError && (
        <div className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-600 dark:text-red-400">
          <AlertCircle className="size-4 shrink-0" />
          {settingsError}
        </div>
      )}

      {/* Content based on Active Tab */}
      {settingsLoading && settings.styles.length === 0 ? (
        <div className="flex items-center justify-center p-12 text-slate-400">
          <Loader2 className="size-6 animate-spin mr-2" /> Məlumatlar yüklənir...
        </div>
      ) : (
        <>
          {/* Tab 1: Settings (Styles & Frequencies) */}
          {activeSubTab === 'settings' && (
            <div className="space-y-6">
              
              {/* Delivery price setting */}
              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_10px_35px_rgba(16,24,40,0.06)] dark:border-white/10 dark:bg-slate-950/40">
                <h3 className="text-xs font-black uppercase tracking-[0.08em] text-slate-500 dark:text-white/55 mb-4">
                  Baza Buket Qiymətləndirilməsi
                </h3>
                
                <div className="flex items-center gap-3 w-72">
                  <div className="relative flex-1">
                    <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    <input
                      type="number"
                      min={1}
                      value={settings.pricePerDelivery}
                      onChange={(e) => {
                        const val = Math.max(1, Number(e.target.value) || 25);
                        setSettings(prev => ({ ...prev, pricePerDelivery: val }));
                      }}
                      onBlur={() => {
                        persistSettings(settings, 'Buket baza qiyməti yeniləndi.');
                      }}
                      className="w-full rounded-xl border border-slate-200 dark:border-white/10 pl-10 pr-3 py-2.5 text-sm bg-transparent outline-none focus:border-primary text-black dark:text-white"
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-500">AZN / Buket</span>
                </div>
              </div>

              {/* Frequencies management (CREATE, UPDATE, DELETE) */}
              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_10px_35px_rgba(16,24,40,0.06)] dark:border-white/10 dark:bg-slate-950/40">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-[0.08em] text-slate-500 dark:text-white/55">
                      Mövsümi Çatdırılma Tezlikləri
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Tezlikləri daxil edin, redaktə edin və ya silin.</p>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2.5 mb-5">
                  {settings.frequencies.map((freq, idx) => (
                    <span 
                      key={idx} 
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-2 text-xs font-semibold group shadow-sm"
                    >
                      <span className="font-bold text-slate-800 dark:text-slate-200">{freq}</span>
                      <button 
                        type="button"
                        onClick={() => handleStartEditFreq(idx, freq)}
                        className="text-slate-400 hover:text-primary transition-colors p-1"
                        title="Redaktə et"
                      >
                        <Edit className="size-3.5" />
                      </button>
                      <button 
                        type="button"
                        onClick={() => handleDeleteFrequency(freq)}
                        className="text-slate-400 hover:text-red-500 transition-colors p-1 font-bold"
                        title="Sil"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex gap-2 max-w-md">
                  <input
                    type="text"
                    value={newFreqInput}
                    onChange={(e) => setNewFreqInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddFrequency();
                      }
                    }}
                    placeholder="Yeni tezlik adı (Məs. Hər Həftə, 3 Həftədən Bir)..."
                    className="flex-1 rounded-xl border border-slate-200 dark:border-white/10 px-3.5 py-2.5 text-xs bg-transparent outline-none focus:border-primary text-black dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddFrequency}
                    disabled={!newFreqInput.trim()}
                    className="rounded-xl bg-primary text-black px-4 py-2.5 text-xs font-black hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    + Əlavə Et
                  </button>
                </div>

                {/* Edit Frequency Modal */}
                {editingFreqIdx !== null && (
                  <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center">
                    <div className="w-full max-w-sm rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 shadow-2xl">
                      <h3 className="text-sm font-black uppercase mb-3 text-slate-900 dark:text-white">Tezliyi Redaktə Et</h3>
                      <input
                        type="text"
                        value={editingFreqValue}
                        onChange={(e) => setEditingFreqValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveEditFreq();
                          }
                        }}
                        className="w-full rounded-xl border border-slate-200 dark:border-white/10 px-3.5 py-2.5 text-xs bg-transparent mb-4 focus:border-primary text-black dark:text-white outline-none"
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => { setEditingFreqIdx(null); setEditingFreqValue(''); }}
                          className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-white"
                        >
                          Ləğv et
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveEditFreq}
                          className="px-4 py-2 rounded-xl bg-primary text-black text-xs font-black"
                        >
                          Yadda saxla
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Styles management (CREATE, UPDATE, DELETE with File Upload) */}
              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_10px_35px_rgba(16,24,40,0.06)] dark:border-white/10 dark:bg-slate-955/40">
                <div className="flex justify-between items-center mb-5">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-[0.08em] text-slate-500 dark:text-white/55">Klub Buket Üslubları</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Şəkil faylı yükləyərək və ya link daxil edərək stillər yaradın.</p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingStyle({ name: '', img: '', desc: '' });
                      setEditingStyleIdx(null);
                      setStyleError(null);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-black px-4 py-2 text-xs font-black shadow-sm hover:opacity-90 transition-opacity"
                  >
                    <Plus className="size-3.5" /> Yeni Üslub Əlavə Et
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {settings.styles.map((styleObj, idx) => (
                    <div key={idx} className="flex gap-4 p-3.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] hover:border-primary/40 transition-colors">
                      <img 
                        src={styleObj.img} 
                        alt={styleObj.name} 
                        className="w-24 h-24 rounded-xl object-cover border border-white/10 shrink-0 bg-slate-100" 
                      />
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start">
                            <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">{styleObj.name}</h4>
                            <div className="flex gap-1">
                              <button
                                onClick={() => {
                                  setEditingStyle(styleObj);
                                  setEditingStyleIdx(idx);
                                  setStyleError(null);
                                }}
                                className="p-1.5 text-slate-400 hover:text-primary transition-colors"
                                title="Redaktə et"
                              >
                                <Edit className="size-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteStyle(idx)}
                                className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                                title="Sil"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">{styleObj.desc}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => persistSettings(settings, 'Bütün klub tənzimləmələri tam yadda saxlanıldı.')}
                  disabled={settingsLoading}
                  className="mt-6 w-full rounded-2xl bg-primary text-black font-black py-3.5 hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2 shadow-md transition-opacity"
                >
                  <Save className="size-4" /> Bütün Tənzimləmələri Yadda Saxla
                </button>
              </div>

              {/* Edit / Create Style Dialog Modal with File Upload */}
              {editingStyle && (
                <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center">
                  <div className="w-full max-w-lg rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 md:p-8 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-black uppercase tracking-wider text-slate-900 dark:text-white">
                        {editingStyleIdx !== null ? 'Üslubu Redaktə Et' : 'Yeni Buket Üslubu Əlavə Et'}
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
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                          Üslub Adı (Name) *
                        </label>
                        <input
                          type="text"
                          value={editingStyle.name || ''}
                          onChange={(e) => setEditingStyle(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Məs. Modern & Minimal"
                          className="w-full rounded-xl border border-slate-200 dark:border-white/10 px-3.5 py-2.5 text-sm bg-transparent outline-none focus:border-primary text-black dark:text-white"
                        />
                      </div>

                      {/* Image Upload Area */}
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                          Üslub Şəkli (Fayl Yüklə və ya URL Daxil Et) *
                        </label>
                        
                        <div className="space-y-3">
                          <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-white/20 hover:border-primary rounded-2xl p-4 cursor-pointer bg-slate-50/50 dark:bg-white/[0.02] transition-colors">
                            <Upload className="size-6 text-slate-400 mb-2" />
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                              Şəkil faylını seçin və ya bura atın
                            </span>
                            <span className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, WebP (Maks 10MB)</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleImageUpload(file);
                              }}
                            />
                          </label>

                          <div className="relative">
                            <input
                              type="text"
                              value={editingStyle.img || ''}
                              onChange={(e) => setEditingStyle(prev => ({ ...prev, img: e.target.value }))}
                              placeholder="və ya şəkil URL linki (https://...)"
                              className="w-full rounded-xl border border-slate-200 dark:border-white/10 px-3.5 py-2.5 text-xs bg-transparent outline-none focus:border-primary text-black dark:text-white"
                            />
                          </div>

                          {editingStyle.img && (
                            <div className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5">
                              <img
                                src={editingStyle.img}
                                alt="Önbaxış"
                                className="w-16 h-16 rounded-lg object-cover border border-white/10"
                              />
                              <div className="text-xs">
                                <p className="font-bold text-emerald-600">Şəkil seçildi</p>
                                <p className="text-[10px] text-slate-400">Düzgün görünürsə saxlayın</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                          Qısa Təsvir (Description)
                        </label>
                        <textarea
                          value={editingStyle.desc || ''}
                          onChange={(e) => setEditingStyle(prev => ({ ...prev, desc: e.target.value }))}
                          placeholder="Qısa dizayn təsviri..."
                          rows={3}
                          className="w-full rounded-xl border border-slate-200 dark:border-white/10 px-3.5 py-2.5 text-sm bg-transparent outline-none focus:border-primary text-black dark:text-white resize-none"
                        />
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingStyle(null);
                            setEditingStyleIdx(null);
                          }}
                          className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-white"
                        >
                          Ləğv et
                        </button>
                        <button
                          type="submit"
                          className="flex-1 bg-primary text-black font-black py-3 rounded-xl shadow-md hover:opacity-90"
                        >
                          Üslubu Saxla
                        </button>
                      </div>
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
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.08em] text-slate-500 dark:text-white/55">Klub Abunəlik Planları</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Aylıq, Rüblük, Yarımillik və İllik abunəlik endirimləri.</p>
                  </div>
                  <button
                    onClick={() => setEditingPlan({ code: '', discountPercent: 0, periodMonths: 1 })}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-black px-4 py-2 text-xs font-black shadow-sm"
                  >
                    <Plus className="size-3.5" /> Yeni Plan Əlavə Et
                  </button>
                </div>

                {planSuccess && <p className="mb-4 text-xs font-bold text-emerald-600">{planSuccess}</p>}
                {planError && <p className="mb-4 text-xs font-bold text-red-500">{planError}</p>}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {plans.map((p) => (
                    <div key={p.code} className="p-4 rounded-2xl border border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-primary">{p.code}</span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setEditingPlan(p)}
                              className="p-1 text-slate-400 hover:text-primary transition-colors"
                            >
                              <Edit className="size-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePlan(p.code)}
                              className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>
                        <h4 className="font-bold text-sm">{p.name || p.code}</h4>
                        <div className="mt-3 space-y-1 text-xs text-slate-500">
                          <p>Müddət: <span className="font-bold text-slate-900 dark:text-white">{p.periodMonths} ay</span></p>
                          <p>Endirim: <span className="font-bold text-emerald-600">{p.discountPercent}%</span></p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Edit Plan Dialog Modal */}
              {editingPlan && (
                <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center">
                  <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 md:p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-black uppercase tracking-wider text-slate-900 dark:text-white">
                        {editingPlan.code ? 'Planı Redaktə Et' : 'Yeni Plan Yarat'}
                      </h3>
                      <button
                        className="size-8 rounded-lg border border-slate-200 dark:border-white/10 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                        onClick={() => setEditingPlan(null)}
                      >
                        <X className="size-4" />
                      </button>
                    </div>

                    <form onSubmit={handleSavePlan} className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Plan Kodu (ENUM) *</label>
                        <select
                          value={editingPlan.code || 'MONTHLY'}
                          onChange={(e) => setEditingPlan(prev => ({ ...prev, code: e.target.value }))}
                          className="w-full rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 text-sm bg-transparent outline-none focus:border-primary text-black dark:text-white"
                        >
                          <option value="MONTHLY" className="dark:bg-slate-900">MONTHLY</option>
                          <option value="QUARTERLY" className="dark:bg-slate-900">QUARTERLY</option>
                          <option value="SEMI_ANNUAL" className="dark:bg-slate-900">SEMI_ANNUAL</option>
                          <option value="ANNUAL" className="dark:bg-slate-900">ANNUAL</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Görünən Ad (Name)</label>
                        <input
                          type="text"
                          value={editingPlan.name || ''}
                          onChange={(e) => setEditingPlan(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Məs. Aylıq Plan"
                          className="w-full rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 text-sm bg-transparent outline-none focus:border-primary text-black dark:text-white"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Müddət (Ay) *</label>
                          <input
                            type="number"
                            min={1}
                            value={editingPlan.periodMonths || 1}
                            onChange={(e) => setEditingPlan(prev => ({ ...prev, periodMonths: Number(e.target.value) }))}
                            className="w-full rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 text-sm bg-transparent outline-none focus:border-primary text-black dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Endirim (%) *</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={editingPlan.discountPercent ?? 0}
                            onChange={(e) => setEditingPlan(prev => ({ ...prev, discountPercent: Number(e.target.value) }))}
                            className="w-full rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 text-sm bg-transparent outline-none focus:border-primary text-black dark:text-white"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setEditingPlan(null)}
                          className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold"
                        >
                          Ləğv et
                        </button>
                        <button
                          type="submit"
                          className="flex-1 bg-primary text-black font-black py-2.5 rounded-xl shadow-md"
                        >
                          Planı Saxla
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
