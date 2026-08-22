import React, { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Save, X, Loader2, Image, FileText } from 'lucide-react';
import { categoryService, normalizeImageUrl } from '../../services/api';

type Category = {
  id?: number;
  title: string;
  subtitle?: string;
  imageUrl?: string;
};

const MOCK_CATEGORIES_KEY = 'mock_categories';

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
  const [categoryImage, setCategoryImage] = useState<File | null>(null);
  const [categoryImagePreview, setCategoryImagePreview] = useState<string>('');
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await categoryService.getAll();
      const list = res?.data || (Array.isArray(res) ? res : []);
      setCategories(list);
      localStorage.setItem(MOCK_CATEGORIES_KEY, JSON.stringify(list));
    } catch {
      // Offline fallback: load from local storage
      const cached = localStorage.getItem(MOCK_CATEGORIES_KEY);
      if (cached) {
        setCategories(JSON.parse(cached));
      } else {
        const defaults = [
          { id: 2, title: 'Təbii güllər', subtitle: 'Sevdikləriniz üçün təzə və ətirli seçimlər', imageUrl: 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=300&q=80' },
          { id: 3, title: 'Dibçək gülləri', subtitle: 'Uzunömürlü və baxımı asan yaşıl bitkilər', imageUrl: 'https://images.unsplash.com/photo-1587334206502-747aba2e8c25?auto=format&fit=crop&w=300&q=80' },
          { id: 4, title: 'Bitki Sağlamlığı', subtitle: 'Bitkilərinizin bağbanı və professional qulluq', imageUrl: 'https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=300&q=80' }
        ];
        setCategories(defaults);
        localStorage.setItem(MOCK_CATEGORIES_KEY, JSON.stringify(defaults));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory?.title) {
      setError('Zəhmət olmasa Kateqoriya Adını daxil edin.');
      return;
    }
    setError(null);
    setSuccess(null);

    const payload = {
      id: editingCategory.id,
      title: editingCategory.title,
      subtitle: editingCategory.subtitle || '',
      imageUrl: editingCategory.imageUrl || ''
    };

    // Update locally first for instant feedback
    const updated = [...categories];
    if (editingCategory.id) {
      const idx = updated.findIndex(c => c.id === editingCategory.id);
      if (idx >= 0) updated[idx] = payload;
    } else {
      payload.id = Math.max(...categories.map(c => c.id || 0), 0) + 1;
      updated.push(payload);
    }
    setCategories(updated);
    localStorage.setItem(MOCK_CATEGORIES_KEY, JSON.stringify(updated));

    try {
      await categoryService.saveCategory(editingCategory, categoryImage || undefined);
      setSuccess('Kateqoriya uğurla yadda saxlanıldı.');
      setEditingCategory(null);
      setCategoryImage(null);
      setCategoryImagePreview('');
      loadCategories();
    } catch {
      setSuccess('Kateqoriya uğurla yadda saxlanıldı (Local Mock Mode).');
      setEditingCategory(null);
      setCategoryImage(null);
      setCategoryImagePreview('');
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!confirm('Bu kateqoriyanı silmək istədiyinizdən əminsiniz?')) return;
    setError(null);
    setSuccess(null);

    const updated = categories.filter(c => c.id !== id);
    setCategories(updated);
    localStorage.setItem(MOCK_CATEGORIES_KEY, JSON.stringify(updated));

    try {
      await categoryService.deleteCategory(id);
      setSuccess('Kateqoriya silindi.');
      loadCategories();
    } catch {
      setSuccess('Kateqoriya silindi (Local Mock Mode).');
    }
  };

  return (
    <div className="min-h-screen bg-[#fdfcf0] p-6 lg:p-8 dark:bg-background-dark text-floral-deep dark:text-white">
      <div className="mx-auto w-full max-w-4xl space-y-5">
        
        {/* Header */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_18px_45px_rgba(16,24,40,0.08)] dark:border-white/10 dark:bg-slate-950/40">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">Kateqoriya İdarəetməsi</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-white/60">
                Ana səhifədəki "Xidmətlərimiz" və məhsul kataloqu kateqoriyalarını tənzimləyin.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingCategory({ title: '', subtitle: '', imageUrl: '' });
                setCategoryImage(null);
                setCategoryImagePreview('');
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-black px-4 py-2 text-xs font-black shadow-sm hover:opacity-90"
            >
              <Plus className="size-4" /> Yeni Kateqoriya
            </button>
          </div>
        </div>

        {/* Message Feedbacks */}
        {success && (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
            {success}
          </div>
        )}
        {error && (
          <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/20 text-red-500 dark:text-red-400 text-xs font-bold">
            {error}
          </div>
        )}

        {/* Categories Grid/List */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_10px_35px_rgba(16,24,40,0.06)] dark:border-white/10 dark:bg-slate-955/40">
          {loading && categories.length === 0 ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="animate-spin size-8 text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categories.map((cat) => (
                <div 
                  key={cat.id} 
                  className="flex gap-4 p-4 rounded-2xl border border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.01] hover:border-primary/20 transition-all"
                >
                  {cat.imageUrl ? (
                    <img 
                      src={normalizeImageUrl(cat.imageUrl)} 
                      alt={cat.title} 
                      className="w-24 h-24 rounded-2xl object-cover border border-white/10 shrink-0" 
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-2xl bg-slate-200/80 dark:bg-white/5 flex items-center justify-center text-slate-400 shrink-0">
                      <Image className="size-6" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-[10px] font-black tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-md shrink-0">
                          ID: {cat.id}
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setEditingCategory(cat);
                              setCategoryImage(null);
                              setCategoryImagePreview('');
                            }}
                            className="p-1 text-slate-400 hover:text-primary transition-colors"
                          >
                            <Edit className="size-4" />
                          </button>
                          <button
                            onClick={() => cat.id && handleDeleteCategory(cat.id)}
                            className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-1.5 truncate">{cat.title}</h4>
                      <p className="text-xs text-slate-500 dark:text-white/60 mt-1 line-clamp-2 leading-relaxed">
                        {cat.subtitle || 'Açıqlama yoxdur.'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create / Edit Category Modal */}
        {editingCategory && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center">
            <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 md:p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-black uppercase tracking-wider">
                  {editingCategory.id ? 'Kateqoriyanı Redaktə Et' : 'Yeni Kateqoriya Yarat'}
                </h3>
                <button
                  className="size-8 rounded-lg border border-slate-200 dark:border-white/10 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                  onClick={() => setEditingCategory(null)}
                >
                  <X className="size-4" />
                </button>
              </div>

              <form onSubmit={handleSaveCategory} className="space-y-4">
                {editingCategory.id && (
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Kateqoriya ID-si</label>
                    <input
                      type="text"
                      disabled
                      value={editingCategory.id}
                      className="w-full rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 text-sm bg-slate-100 dark:bg-white/5 text-slate-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Kateqoriya Adı (Title)</label>
                  <input
                    type="text"
                    value={editingCategory.title || ''}
                    onChange={(e) => setEditingCategory(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Məs. Təbii güllər"
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 text-sm bg-transparent outline-none focus:border-primary text-black dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Açıqlama / Təsvir (Subtitle)</label>
                  <textarea
                    value={editingCategory.subtitle || ''}
                    onChange={(e) => setEditingCategory(prev => ({ ...prev, subtitle: e.target.value }))}
                    placeholder="Kateqoriya haqqında qısa məlumat..."
                    className="w-full min-h-16 rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 text-sm bg-transparent outline-none focus:border-primary text-black dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Kateqoriya Şəkli</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setCategoryImage(file);
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setCategoryImagePreview(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      } else {
                        setCategoryImagePreview('');
                      }
                    }}
                    className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-black hover:file:opacity-90"
                  />
                  {(categoryImagePreview || editingCategory.imageUrl) && (
                    <div className="mt-2 h-20 w-20 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 shrink-0">
                      <img 
                        src={categoryImagePreview || normalizeImageUrl(editingCategory.imageUrl)} 
                        alt="Preview" 
                        className="h-full w-full object-cover" 
                      />
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full bg-primary text-black font-black py-2.5 rounded-xl shadow-md flex items-center justify-center gap-2"
                >
                  <Save className="size-4" /> Kateqoriyanı Saxla
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
