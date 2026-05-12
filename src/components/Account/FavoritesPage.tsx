import { motion } from 'motion/react';
import { ChevronRight, Bookmark, ShoppingBag } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authService, favoriteService, productService } from '../../services/api';

type UiFavorite = {
  productId: number;
  title: string;
  price: string;
  img: string;
  slug: string;
};

const pickFirstNonEmpty = (...vals: unknown[]): string => {
  for (const v of vals) {
    const s = String(v ?? '').trim();
    if (s) return s;
  }
  return '';
};

const parsePriceString = (...vals: unknown[]): string => {
  for (const v of vals) {
    if (typeof v === 'number' && Number.isFinite(v)) return v.toFixed(2);
    const s = String(v ?? '').trim();
    if (!s) continue;
    const n = Number(s.replace(/[^\d.,-]/g, '').replace(',', '.'));
    if (Number.isFinite(n)) return n.toFixed(2);
  }
  return '0.00';
};

export default function FavoritesPage() {
  const { userId, token, setAuthUser } = useAuth();
  const [favorites, setFavorites] = useState<UiFavorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const resolveEffectiveUserId = async (): Promise<number | null> => {
    if (userId && userId > 0) return userId;
    if (!token) return null;
    try {
      const meRes = await authService.getMe();
      if (meRes?.success && meRes?.data) {
        setAuthUser(meRes.data);
        const idCandidates = [
          (meRes.data as any)?.id,
          (meRes.data as any)?.userId,
          (meRes.data as any)?.user_id,
          (meRes.data as any)?.uid,
          (meRes.data as any)?.sub,
        ];
        for (const rawId of idCandidates) {
          if (typeof rawId === 'number' && Number.isFinite(rawId) && rawId > 0) return rawId;
          if (typeof rawId === 'string' && /^\d+$/.test(rawId.trim())) return Number(rawId.trim());
        }
      }
    } catch {
      return null;
    }
    return null;
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const effectiveUserId = await resolveEffectiveUserId();
      if (!effectiveUserId) {
        setFavorites([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const rows = await favoriteService.getFavorites(effectiveUserId);
        const out: UiFavorite[] = [];
        for (const row of rows) {
          const p = row.product;
          if (p) {
            const firstImage = Array.isArray((p as any).images) && (p as any).images[0] ? (p as any).images[0] : null;
            const firstVariant =
              Array.isArray((p as any).productVariants) && (p as any).productVariants[0]
                ? (p as any).productVariants[0]
                : null;
            const img = pickFirstNonEmpty(
              firstImage?.imageUrl,
              firstImage?.url,
              (p as any).imageUrl,
              (p as any).img,
              (p as any).image
            );
            const title = pickFirstNonEmpty(
              (p as any).productName,
              (p as any).name,
              (p as any).title
            );
            const price = parsePriceString(
              firstVariant?.price,
              (p as any).price,
              (p as any).unitPrice,
              (p as any).minPrice
            );
            const slug = pickFirstNonEmpty((p as any).slug);

            // If embedded product is incomplete, fallback to direct product detail.
            if (!title || price === '0.00' || !img) {
              try {
                const detail = await productService.getById(row.productId);
                const detailFirstImage =
                  Array.isArray(detail?.images) && detail.images[0] ? detail.images[0] : null;
                const detailFirstVariant =
                  Array.isArray(detail?.productVariants) && detail.productVariants[0]
                    ? detail.productVariants[0]
                    : null;
                out.push({
                  productId: row.productId,
                  title: pickFirstNonEmpty(detail?.productName, detail?.title, title, `Məhsul #${row.productId}`),
                  price: parsePriceString(detailFirstVariant?.price, detail?.price, price),
                  img: pickFirstNonEmpty(detailFirstImage?.imageUrl, detail?.img, img),
                  slug: pickFirstNonEmpty(detail?.slug, slug),
                });
                continue;
              } catch {
                // use embedded values below
              }
            }

            out.push({
              productId: row.productId,
              title: title || `Məhsul #${row.productId}`,
              price,
              img,
              slug,
            });
            continue;
          }
          try {
            const detail = await productService.getById(row.productId);
            const firstImage = Array.isArray(detail?.images) && detail.images[0] ? detail.images[0] : null;
            const img = String(firstImage?.imageUrl || detail?.img || '');
            const firstVariant = Array.isArray(detail?.productVariants) && detail.productVariants[0] ? detail.productVariants[0] : null;
            const price = Number(firstVariant?.price ?? detail?.price ?? 0);
            out.push({
              productId: row.productId,
              title: String(detail?.productName || detail?.title || `Məhsul #${row.productId}`),
              price: Number.isFinite(price) ? price.toFixed(2) : '0.00',
              img,
              slug: String(detail?.slug || ''),
            });
          } catch {
            out.push({
              productId: row.productId,
              title: `Məhsul #${row.productId}`,
              price: '0.00',
              img: '',
              slug: '',
            });
          }
        }
        if (!cancelled) setFavorites(out);
      } catch (e: any) {
        if (!cancelled) {
          setFavorites([]);
          setError(String(e?.message || 'Sevimlilər yüklənmədi.'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [userId, token]);

  const hasFavorites = useMemo(() => favorites.length > 0, [favorites.length]);

  const handleRemoveFavorite = async (productId: number) => {
    const effectiveUserId = await resolveEffectiveUserId();
    if (!effectiveUserId) return;
    const prev = favorites;
    setFavorites((curr) => curr.filter((x) => x.productId !== productId));
    try {
      await favoriteService.removeFavorite(productId, effectiveUserId);
    } catch {
      setFavorites(prev);
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-black text-floral-deep dark:text-floral-deep-dark">Sevimlilərim</h2>
        <Link to="/collections" className="text-xs font-black uppercase tracking-widest text-primary hover:text-primary/70 flex items-center gap-2 group">
          Hamısına bax
          <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

      {loading ? (
        <p className="rounded-2xl border border-floral-muted/15 bg-white p-4 text-sm text-floral-muted dark:bg-white/5">
          Sevimlilər yüklənir...
        </p>
      ) : error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
          {error}
        </p>
      ) : !hasFavorites ? (
        <p className="rounded-2xl border border-floral-muted/15 bg-white p-4 text-sm text-floral-muted dark:bg-white/5">
          Sevimli məhsul yoxdur.
        </p>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {favorites.map((fav, i) => (
          <motion.div
            key={fav.productId}
            whileHover={{ y: -10 }}
            className="group bg-white dark:bg-white/5 rounded-[32px] overflow-hidden border border-floral-muted/5 shadow-sm relative"
          >
            <div className="aspect-[4/5] w-full relative overflow-hidden">
              {fav.img ? (
                <img src={fav.img} alt={fav.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" referrerPolicy="no-referrer" />
              ) : (
                <div className="h-full w-full bg-primary/10" />
              )}
              <button
                type="button"
                onClick={() => void handleRemoveFavorite(fav.productId)}
                className="absolute top-4 right-4 h-10 w-10 flex items-center justify-center rounded-full bg-white/90 dark:bg-background-dark/90 text-amber-500 backdrop-blur-sm shadow-sm transition-transform hover:scale-110"
              >
                <Bookmark className="w-5 h-5 fill-current" />
              </button>
            </div>
            <div className="p-6">
              <h4 className="text-lg font-bold text-floral-deep dark:text-white mb-2">{fav.title}</h4>
              <div className="flex items-center justify-between pt-2">
                <p className="text-primary font-black text-lg">{fav.price} ₼</p>
                <Link
                  to={fav.slug ? `/product/${fav.slug}` : '/collections'}
                  className="h-10 w-10 flex items-center justify-center rounded-full bg-primary text-floral-deep hover:bg-white hover:shadow-lg transition-all"
                >
                  <ShoppingBag className="w-5 h-5" />
                </Link>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      )}
    </section>
  );
}
