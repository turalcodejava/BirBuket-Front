import { Instagram, Send, Twitter } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { categoryService } from '../services/api';

function normalizeAz(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}+/gu, '');
}

/** “Dekorların hazırlanması” kateqoriyası üçün ID (titula görə tapılır). */
function findDecorPreparationCategoryId(categories: Array<{ id: number; title: string }>): number | null {
  for (const c of categories) {
    const t = normalizeAz(c.title);
    if (t.includes('dekorlarin') && t.includes('hazirlanma')) return c.id;
  }
  for (const c of categories) {
    const t = normalizeAz(c.title);
    if (t.includes('dekor') && t.includes('hazirlanma')) return c.id;
  }
  return null;
}

export default function Footer() {
  const [catalogCategories, setCatalogCategories] = useState<Array<{ id: number; title: string }>>([]);
  const [categoryRows, setCategoryRows] = useState<Array<{ id: number; title: string }>>([]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await categoryService.getAll();
        const rows = Array.isArray(res?.data) ? res.data : [];
        const mapped = rows
          .map((c: any) => ({ id: Number(c?.id || 0), title: String(c?.title || c?.name || '').trim() }))
          .filter((c: { id: number; title: string }) => c.id > 0 && Boolean(c.title));
        setCatalogCategories(mapped.slice(0, 4));
        setCategoryRows(mapped);
      } catch {
        setCatalogCategories([]);
        setCategoryRows([]);
      }
    };
    void loadCategories();
  }, []);

  const toyDecorCollectionHref = useMemo(() => {
    const id = findDecorPreparationCategoryId(categoryRows);
    return id != null ? `/collections?category=${id}` : '/collections';
  }, [categoryRows]);

  return (
    <footer className="px-6 lg:px-20 py-16 bg-white dark:bg-background-dark border-t border-black/5 dark:border-white/5">
      <div className="max-w-[1440px] mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-12 mb-16">
          <div className="col-span-2 flex flex-col gap-6">
            <div className="flex items-center gap-2">
              <div className="h-11 w-11 rounded-2xl bg-white p-1.5 shadow-sm border border-floral-muted/20 dark:bg-white/90">
                <img
                  src="/birbuket-logo.svg"
                  alt="BirBuket"
                  className="h-full w-full object-contain"
                />
              </div>
              <h3 className="text-xl font-extrabold text-floral-deep dark:text-white">BirBuket</h3>
            </div>
            <p className="text-[#4c9a66] dark:text-floral-muted-dark/80 text-sm max-w-xs leading-relaxed">
              Bakıda ən təzə və keyfiyyətli güllərin tək ünvanı. Sevdiklərinizi sevindirmək üçün biz buradayıq.
            </p>
            <div className="flex gap-4">
              <a
                href="https://www.instagram.com/birbuket.az?igsh=MWJyMmg2NnY5bndxMA%3D%3D&utm_source=qr"
                target="_blank"
                rel="noreferrer"
                aria-label="BirBuket Instagram"
                className="w-10 h-10 rounded-full bg-[#f8f9f8] dark:bg-white/5 flex items-center justify-center hover:bg-primary hover:text-floral-deep transition-all group border border-transparent dark:border-white/5"
              >
                <Instagram className="w-5 h-5 group-hover:scale-110 transition-transform dark:text-floral-deep-dark" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-[#f8f9f8] dark:bg-white/5 flex items-center justify-center hover:bg-primary hover:text-floral-deep transition-all group border border-transparent dark:border-white/5">
                <Twitter className="w-5 h-5 group-hover:scale-110 transition-transform dark:text-floral-deep-dark" />
              </a>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <h4 className="font-bold text-xs uppercase tracking-widest text-[#1a1a1a] dark:text-floral-deep-dark">Kataloq</h4>
            <div className="flex flex-col gap-3">
              {catalogCategories.length > 0 ? (
                catalogCategories.map((cat) => (
                  <Link
                    key={cat.id}
                    to={`/collections?category=${cat.id}`}
                    className="text-[#4c9a66] dark:text-floral-muted-dark/70 hover:text-primary dark:hover:text-primary transition-colors text-sm"
                  >
                    {cat.title}
                  </Link>
                ))
              ) : (
                <Link
                  to="/collections"
                  className="text-[#4c9a66] dark:text-floral-muted-dark/70 hover:text-primary dark:hover:text-primary transition-colors text-sm"
                >
                  Bütün Məhsullar
                </Link>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <h4 className="font-bold text-xs uppercase tracking-widest text-[#1a1a1a] dark:text-floral-deep-dark">Xidmətlər</h4>
            <div className="flex flex-col gap-3">
              <Link
                to={toyDecorCollectionHref}
                className="text-[#4c9a66] dark:text-floral-muted-dark/70 hover:text-primary dark:hover:text-primary transition-colors text-sm"
              >
                Toy dekorasiyası
              </Link>
              <Link
                className="text-[#4c9a66] dark:text-floral-muted-dark/70 hover:text-primary dark:hover:text-primary transition-colors text-sm"
                to="/birbuketclub"
              >
                BirBuketClub
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <h4 className="font-bold text-xs uppercase tracking-widest text-[#1a1a1a] dark:text-floral-deep-dark">Dəstək</h4>
            <div className="flex flex-col gap-3">
              <Link className="text-[#4c9a66] dark:text-floral-muted-dark/70 hover:text-primary dark:hover:text-primary transition-colors text-sm" to="/support#suallar">Suallar</Link>
              <Link className="text-[#4c9a66] dark:text-floral-muted-dark/70 hover:text-primary dark:hover:text-primary transition-colors text-sm" to="/support#catdirilma">Çatdırılma qaydaları</Link>
              <Link className="text-[#4c9a66] dark:text-floral-muted-dark/70 hover:text-primary dark:hover:text-primary transition-colors text-sm" to="/support#qaytarilma">Geri qaytarılma</Link>
              <Link className="text-[#4c9a66] dark:text-floral-muted-dark/70 hover:text-primary dark:hover:text-primary transition-colors text-sm" to="/support#elaqe">Əlaqə</Link>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <h4 className="font-bold text-xs uppercase tracking-widest text-primary">Bizə yazın</h4>
            <p className="text-[#4c9a66] dark:text-floral-muted-dark/60 text-xs">Yeniliklərdən və kampaniyalardan xəbərdar olun.</p>
            <div className="flex rounded-lg overflow-hidden border border-black/5 dark:border-white/10 bg-[#f8f9f8] dark:bg-white/5 p-1 transition-colors">
              <input 
                className="bg-transparent px-3 py-2 text-xs border-none focus:ring-0 w-full placeholder:text-floral-muted/50 dark:placeholder:text-white/20 dark:text-white" 
                placeholder="Email" 
                type="email"
              />
              <button className="bg-primary text-floral-deep px-3 py-2 rounded-md shadow-sm">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-black/5 dark:border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[#4c9a66] opacity-60 text-xs">© 2024 BirBuket. Bütün hüquqlar qorunur.</p>
          <div className="flex gap-8 text-xs text-[#4c9a66] font-medium">
            <Link className="hover:text-primary transition-colors" to="/privacy">Məxfilik siyasəti</Link>
            <Link className="hover:text-primary transition-colors" to="/terms">İstifadə şərtləri</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
