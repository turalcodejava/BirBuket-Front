import { Instagram, Send, Twitter } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { categoryService } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

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
  const { t } = useLanguage();
  const location = useLocation();
  const isBirBagban = location.pathname.startsWith('/bir-bagban');
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
    <footer className={`px-6 lg:px-20 py-16 border-t transition-all duration-300 ${
      isBirBagban
        ? "bg-[#040f09]/85 backdrop-blur-md border-[#143c24]"
        : "bg-white dark:bg-background-dark border-black/5 dark:border-white/5"
    }`}>
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
              <h3 className={`text-xl font-extrabold ${isBirBagban ? 'text-white' : 'text-floral-deep dark:text-white'}`}>BirBuket</h3>
            </div>
            <p className={`text-sm max-w-xs leading-relaxed ${isBirBagban ? 'text-[#acd5bc]/80' : 'text-[#4c9a66] dark:text-floral-muted-dark/80'}`}>
              {t('footer_desc')}
            </p>
            <div className="flex gap-4">
              <a
                href="https://www.instagram.com/birbuket.az?igsh=MWJyMmg2NnY5bndxMA%3D%3D&utm_source=qr"
                target="_blank"
                rel="noreferrer"
                aria-label="BirBuket Instagram"
                className={`w-10 h-10 rounded-full flex items-center justify-center hover:bg-primary hover:text-floral-deep transition-all group border ${
                  isBirBagban
                    ? 'bg-[#06190f]/60 border-[#143c24]'
                    : 'bg-[#f8f9f8] dark:bg-white/5 border-transparent dark:border-white/5'
                }`}
              >
                <Instagram className={`w-5 h-5 group-hover:scale-110 transition-transform ${isBirBagban ? 'text-[#acd5bc]' : 'dark:text-floral-deep-dark'}`} />
              </a>
              <a 
                href="#" 
                className={`w-10 h-10 rounded-full flex items-center justify-center hover:bg-primary hover:text-floral-deep transition-all group border ${
                  isBirBagban
                    ? 'bg-[#06190f]/60 border-[#143c24]'
                    : 'bg-[#f8f9f8] dark:bg-white/5 border-transparent dark:border-white/5'
                }`}
              >
                <Twitter className={`w-5 h-5 group-hover:scale-110 transition-transform ${isBirBagban ? 'text-[#acd5bc]' : 'dark:text-floral-deep-dark'}`} />
              </a>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <h4 className={`font-bold text-xs uppercase tracking-widest ${isBirBagban ? 'text-white' : 'text-[#1a1a1a] dark:text-floral-deep-dark'}`}>{t('catalog')}</h4>
            <div className="flex flex-col gap-3">
              {catalogCategories.length > 0 ? (
                catalogCategories.map((cat) => (
                  <Link
                    key={cat.id}
                    to={`/collections?category=${cat.id}`}
                    className={`hover:text-primary transition-colors text-sm ${isBirBagban ? 'text-[#acd5bc]' : 'text-[#4c9a66] dark:text-floral-muted-dark/70'}`}
                  >
                    {cat.title}
                  </Link>
                ))
              ) : (
                <Link
                  to="/collections"
                  className={`hover:text-primary transition-colors text-sm ${isBirBagban ? 'text-[#acd5bc]' : 'text-[#4c9a66] dark:text-floral-muted-dark/70'}`}
                >
                  {t('all_products')}
                </Link>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <h4 className={`font-bold text-xs uppercase tracking-widest ${isBirBagban ? 'text-white' : 'text-[#1a1a1a] dark:text-floral-deep-dark'}`}>{t('services')}</h4>
            <div className="flex flex-col gap-3">
              <Link
                to={toyDecorCollectionHref}
                className={`hover:text-primary transition-colors text-sm ${isBirBagban ? 'text-[#acd5bc]' : 'text-[#4c9a66] dark:text-floral-muted-dark/70'}`}
              >
                {t('toy_decor')}
              </Link>
              <Link
                className={`hover:text-primary transition-colors text-sm ${isBirBagban ? 'text-[#acd5bc]' : 'text-[#4c9a66] dark:text-floral-muted-dark/70'}`}
                to="/birbuketclub"
              >
                BirBuketClub
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <h4 className={`font-bold text-xs uppercase tracking-widest ${isBirBagban ? 'text-white' : 'text-[#1a1a1a] dark:text-floral-deep-dark'}`}>{t('support')}</h4>
            <div className="flex flex-col gap-3">
              <Link className={`hover:text-primary transition-colors text-sm ${isBirBagban ? 'text-[#acd5bc]' : 'text-[#4c9a66] dark:text-floral-muted-dark/70'}`} to="/support#suallar">{t('faq')}</Link>
              <Link className={`hover:text-primary transition-colors text-sm ${isBirBagban ? 'text-[#acd5bc]' : 'text-[#4c9a66] dark:text-floral-muted-dark/70'}`} to="/support#catdirilma">{t('delivery_rules')}</Link>
              <Link className={`hover:text-primary transition-colors text-sm ${isBirBagban ? 'text-[#acd5bc]' : 'text-[#4c9a66] dark:text-floral-muted-dark/70'}`} to="/support#qaytarilma">{t('returns')}</Link>
              <Link className={`hover:text-primary transition-colors text-sm ${isBirBagban ? 'text-[#acd5bc]' : 'text-[#4c9a66] dark:text-floral-muted-dark/70'}`} to="/support#elaqe">{t('contact')}</Link>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <h4 className="font-bold text-xs uppercase tracking-widest text-primary">{t('write_to_us')}</h4>
            <p className={`text-xs ${isBirBagban ? 'text-[#acd5bc]/70' : 'text-[#4c9a66] dark:text-floral-muted-dark/60'}`}>{t('newsletter_desc')}</p>
            <div className={`flex rounded-lg overflow-hidden border p-1 transition-colors ${
              isBirBagban
                ? 'border-[#143c24] bg-[#06190f]/60'
                : 'border-black/5 dark:border-white/10 bg-[#f8f9f8] dark:bg-white/5'
            }`}>
              <input 
                className={`bg-transparent px-3 py-2 text-xs border-none focus:ring-0 w-full focus:outline-none ${
                  isBirBagban
                    ? 'placeholder:text-[#a4ccb2]/40 text-white'
                    : 'placeholder:text-floral-muted/50 dark:placeholder:text-white/20 dark:text-white'
                }`}
                placeholder="Email" 
                type="email"
              />
              <button className="bg-primary text-floral-deep px-3 py-2 rounded-md shadow-sm">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className={`pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-4 ${isBirBagban ? 'border-[#143c24]' : 'border-black/5 dark:border-white/5'}`}>
          <p className={`opacity-60 text-xs ${isBirBagban ? 'text-[#acd5bc]/60' : 'text-[#4c9a66]'}`}>{t('rights_reserved')}</p>
          <div className={`flex gap-8 text-xs font-medium ${isBirBagban ? 'text-[#acd5bc]' : 'text-[#4c9a66]'}`}>
            <Link className="hover:text-primary transition-colors" to="/privacy">{t('privacy_policy')}</Link>
            <Link className="hover:text-primary transition-colors" to="/terms">{t('terms_of_use')}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
