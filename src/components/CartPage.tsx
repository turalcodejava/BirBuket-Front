import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, Trash2, ShoppingBasket, ArrowRight, ShieldCheck } from 'lucide-react';
import { authService, cartService, productService } from '../services/api';
import { Cart } from '../types';
import { useAuth } from '../context/AuthContext';
import BrandLoading from './BrandLoading';
import DeliveryTariffsInfo from './DeliveryTariffsInfo';

const API_BASE = String(import.meta.env.VITE_API_BASE_URL || '').trim();
const API_ORIGIN = (() => {
  if (!API_BASE) return '';
  try {
    return new URL(API_BASE, window.location.origin).origin;
  } catch {
    return '';
  }
})();

const normalizeImageUrl = (value?: string): string => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const fixed = raw.replace(/\\/g, '/');
  if (/^data:image\//i.test(fixed)) return fixed;
  if (/^https?:\/\//i.test(fixed)) return fixed;
  if (/^\/\//.test(fixed)) return `${window.location.protocol}${fixed}`;
  const absolutePath = fixed.startsWith('/') ? fixed : `/${fixed}`;
  if (API_ORIGIN) {
    try {
      return new URL(absolutePath, API_ORIGIN).toString();
    } catch {
      //
    }
  }
  if (API_BASE) {
    try {
      return new URL(absolutePath, API_BASE).toString();
    } catch {
      //
    }
  }
  return absolutePath;
};

const CART_META_KEY = 'birbuket_cart_item_meta_v1';

type CartItemLocalMeta = {
  imageUrl?: string;
  color?: string;
  size?: string;
  variantName?: string;
  variantId?: number;
};

const readCartItemMeta = (): Record<string, CartItemLocalMeta> => {
  try {
    const raw = localStorage.getItem(CART_META_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, CartItemLocalMeta>;
  } catch {
    return {};
  }
};

const extractColorFromVariantName = (variantName?: string): string | undefined => {
  const raw = String(variantName || '').trim();
  if (!raw) return undefined;
  const pieces = raw
    .split(/[-/|]/g)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!pieces.length) return undefined;
  return pieces[pieces.length - 1] || undefined;
};

export default function CartPage() {
  const navigate = useNavigate();
  const { userId, token, setAuthUser } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      // Ignore and return null below.
    }

    return null;
  };

  const enrichCart = async (rawCart: Cart): Promise<Cart> => {
    const localMeta = readCartItemMeta();
    const ids = Array.from(
      new Set(
        (rawCart.items || [])
          .map((item) => Number(item.productId))
          .filter((id) => Number.isFinite(id) && id > 0)
      )
    );

    const productById = new Map<number, any>();
    await Promise.all(
      ids.map(async (id) => {
        try {
          const product = await productService.getById(id);
          if (product) productById.set(id, product);
        } catch {
          // Keep existing cart item data when product enrichment fails.
        }
      })
    );

    const items = (rawCart.items || []).map((item) => {
      const product = productById.get(Number(item.productId));
      const productImages = Array.isArray(product?.images) ? product.images : [];
      const variants = Array.isArray(product?.productVariants) ? product.productVariants : [];
      const resolvedVariantId = Number(item.productVariantId ?? item.variantId);
      const matchedVariant =
        Number.isFinite(resolvedVariantId) && resolvedVariantId > 0
          ? variants.find((v: any) => Number(v?.id) === resolvedVariantId)
          : null;
      const fallbackMeta = localMeta[String(item.productId)] || {};

      return {
        ...item,
        productName: item.productName || product?.productName || 'Məhsul',
        imageUrl:
          item.image ||
          item.imageUrl ||
          fallbackMeta.imageUrl ||
          item.productImageUrl ||
          item.product?.image ||
          item.product?.imageUrl ||
          item.product?.productImageUrl ||
          matchedVariant?.imageUrl ||
          productImages[0]?.imageUrl ||
          undefined,
        productImageUrl:
          item.productImageUrl ||
          item.image ||
          item.imageUrl ||
          fallbackMeta.imageUrl ||
          item.product?.image ||
          item.product?.productImageUrl ||
          item.product?.imageUrl ||
          matchedVariant?.imageUrl ||
          productImages[0]?.imageUrl ||
          undefined,
        size: item.size || fallbackMeta.size || matchedVariant?.size || undefined,
        color:
          item.color ||
          fallbackMeta.color ||
          matchedVariant?.color ||
          extractColorFromVariantName(item.variantName) ||
          extractColorFromVariantName(fallbackMeta.variantName) ||
          undefined,
        variantName:
          item.variantName ||
          fallbackMeta.variantName ||
          matchedVariant?.variantName ||
          matchedVariant?.variant_name ||
          undefined,
        variantId: item.variantId || fallbackMeta.variantId || undefined,
      };
    });

    return { ...rawCart, items };
  };

  const loadCart = async (showLoading = true) => {
    if (!token) {
      if (showLoading) setLoading(false);
      setError('İstifadəçi məlumatı tapılmadı. Zəhmət olmasa yenidən daxil olun.');
      return;
    }

    try {
      if (showLoading) setLoading(true);
      setError(null);
      const effectiveUserId = await resolveEffectiveUserId();
      if (!effectiveUserId) {
        setError('Hesab ID-si tapılmadı. Zəhmət olmasa yenidən daxil olun.');
        return;
      }

      const data = await cartService.getCart(effectiveUserId);
      const enriched = await enrichCart(data);
      setCart(enriched);
    } catch (err: any) {
      const backendMessage = err?.response?.data?.message;
      setError(backendMessage || 'Səbəti yükləmək mümkün olmadı.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadCart();
  }, [userId, token]);

  const updateQty = async (productId: number, quantity: number) => {
    if (!token || quantity < 1) return;
    if (!cart) return;

    const previousCart = cart;
    const optimisticItems = cart.items.map((item) =>
      item.productId === productId
        ? { ...item, quantity, lineTotal: Number((item.unitPrice * quantity).toFixed(2)) }
        : item
    );
    const optimisticTotalAmount = Number(
      optimisticItems.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2)
    );

    setCart({
      ...cart,
      items: optimisticItems,
      totalAmount: optimisticTotalAmount,
    });

    try {
      const effectiveUserId = await resolveEffectiveUserId();
      if (!effectiveUserId) {
        setCart(previousCart);
        alert('Hesab ID-si tapılmadı. Zəhmət olmasa yenidən daxil olun.');
        return;
      }
      const updatedCart = await cartService.updateItem(effectiveUserId, productId, { quantity });
      if (updatedCart?.items) {
        const enriched = await enrichCart(updatedCart);
        setCart(enriched);
      }
    } catch (err: any) {
      setCart(previousCart);
      alert(err?.response?.data?.message || 'Məhsul sayı yenilənmədi.');
    }
  };

  const removeItem = async (productId: number) => {
    if (!token) return;
    if (!cart) return;

    const previousCart = cart;
    const optimisticItems = cart.items.filter((item) => item.productId !== productId);
    const optimisticTotalAmount = Number(
      optimisticItems.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2)
    );
    setCart({
      ...cart,
      items: optimisticItems,
      totalAmount: optimisticTotalAmount,
    });

    try {
      const effectiveUserId = await resolveEffectiveUserId();
      if (!effectiveUserId) {
        setCart(previousCart);
        alert('Hesab ID-si tapılmadı. Zəhmət olmasa yenidən daxil olun.');
        return;
      }
      const updatedCart = await cartService.deleteItem(effectiveUserId, productId);
      if (updatedCart?.items) {
        const enriched = await enrichCart(updatedCart);
        setCart(enriched);
      }
    } catch (err: any) {
      setCart(previousCart);
      alert(err?.response?.data?.message || 'Məhsul silinmədi.');
    }
  };

  const clearCart = async () => {
    if (!token) return;
    if (!cart) return;

    const previousCart = cart;
    setCart({
      ...cart,
      items: [],
      totalAmount: 0,
    });

    try {
      const effectiveUserId = await resolveEffectiveUserId();
      if (!effectiveUserId) {
        setCart(previousCart);
        alert('Hesab ID-si tapılmadı. Zəhmət olmasa yenidən daxil olun.');
        return;
      }
      const updatedCart = await cartService.clearCart(effectiveUserId);
      if (updatedCart?.items) {
        const enriched = await enrichCart(updatedCart);
        setCart(enriched);
      }
    } catch (err: any) {
      setCart(previousCart);
      alert(err?.response?.data?.message || 'Səbət təmizlənmədi.');
    }
  };

  const getCartItemImage = (item: Cart['items'][number]) =>
    normalizeImageUrl(
      item.image ||
        item.imageUrl ||
        item.productImageUrl ||
        item.product?.image ||
        item.product?.imageUrl ||
        item.product?.productImageUrl ||
        ''
    ) || undefined;

  const getCartItemVariant = (item: Cart['items'][number]) => {
    const parts = [item.variantName, item.size, item.color]
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .filter(Boolean);
    return parts.length ? parts.join(' / ') : null;
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <BrandLoading />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-6 lg:px-20 py-14">
        <p className="text-red-500 font-semibold">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-[#fdfcf0] dark:bg-background-dark min-h-screen">
      <main className="max-w-[1240px] mx-auto w-full px-6 lg:px-20 py-10 lg:py-14">
        <div className="mb-10 rounded-[32px] border border-floral-muted/10 bg-white dark:bg-white/5 p-6 md:p-8 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-floral-muted/70 dark:text-white/40 font-bold mb-3">
            Alış-veriş
          </p>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-black dark:text-white">Səbətim</h1>
              <p className="text-sm text-floral-muted dark:text-floral-muted-dark mt-2">
                Seçilən məhsulları idarə edin və sifarişi tamamlayın.
              </p>
            </div>
            <Link
              to="/collections"
              className="inline-flex items-center gap-2 w-fit rounded-2xl bg-primary px-5 py-3 text-sm font-black text-floral-deep hover:opacity-90 transition-opacity"
            >
              Alış-verişə davam et
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {!cart?.items?.length ? (
          <div className="bg-white dark:bg-white/5 rounded-[32px] border border-floral-muted/10 p-12 text-center shadow-sm">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <ShoppingBasket className="w-8 h-8" />
            </div>
            <p className="text-2xl font-black dark:text-white mb-2">Səbətinizdə məhsul yoxdur</p>
            <p className="text-floral-muted dark:text-floral-muted-dark mb-7 max-w-[520px] mx-auto">
              Alış-verişə başlayın, bəyəndiyiniz məhsulları seçin və səbətə əlavə edin.
            </p>
            <Link
              to="/collections"
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3.5 font-black text-floral-deep hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
            >
              Alış-verişə başla
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
            <div className="xl:col-span-8 space-y-4">
              {cart.items.map((item) => (
                <div
                  key={item.productId}
                  className="bg-white dark:bg-white/5 rounded-[28px] border border-floral-muted/10 p-4 sm:p-6 shadow-sm"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-20 h-20 shrink-0 overflow-hidden rounded-2xl border border-floral-muted/15 bg-primary/5">
                        {getCartItemImage(item) ? (
                          <img
                            src={getCartItemImage(item)}
                            alt={item.productName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-primary/70">
                            <ShoppingBasket className="w-7 h-7" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-lg dark:text-white truncate">{item.productName}</p>
                        {getCartItemVariant(item) && (
                          <p className="text-xs font-semibold text-floral-muted dark:text-floral-muted-dark mt-1">
                            Variant: {getCartItemVariant(item)}
                          </p>
                        )}
                        {item.color && (
                          <p className="text-xs font-semibold text-floral-muted dark:text-floral-muted-dark mt-1">
                            Rəng: {item.color}
                          </p>
                        )}
                        <p className="text-sm text-floral-muted dark:text-floral-muted-dark mt-1">
                        Vahid qiymət: {item.unitPrice} AZN
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      <div className="flex items-center gap-2 rounded-2xl border border-floral-muted/20 bg-[#fdfcf5] dark:bg-white/5 p-1">
                        <button
                          onClick={() => updateQty(item.productId, item.quantity - 1)}
                          className="w-9 h-9 rounded-xl border border-floral-muted/20 bg-white dark:bg-white/10 flex items-center justify-center disabled:opacity-40"
                          disabled={item.quantity <= 1}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="font-black w-10 text-center dark:text-white">{item.quantity}</span>
                        <button
                          onClick={() => updateQty(item.productId, item.quantity + 1)}
                          className="w-9 h-9 rounded-xl border border-floral-muted/20 bg-white dark:bg-white/10 flex items-center justify-center"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      <p className="font-black text-primary min-w-[110px] text-right text-lg">
                        {item.lineTotal} AZN
                      </p>

                      <button
                        onClick={() => removeItem(item.productId)}
                        className="w-10 h-10 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center justify-center"
                        title="Məhsulu sil"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <aside className="xl:col-span-4">
              <div className="sticky top-28 rounded-[28px] bg-[#0d1b12] text-white p-6 sm:p-7 shadow-2xl shadow-black/10">
                <p className="text-xs uppercase tracking-[0.2em] text-white/50 font-bold">Sifariş xülasəsi</p>
                <h2 className="text-2xl font-black mt-2 mb-6">Yekun məbləğ</h2>

                <div className="space-y-4 border-y border-white/10 py-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/60">Məhsul sayı</span>
                    <span className="font-bold">{cart.items.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/60">Ara cəm</span>
                    <span className="font-bold">{cart.totalAmount} AZN</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Ümumi</span>
                    <span className="font-black text-2xl text-primary">{cart.totalAmount} AZN</span>
                  </div>
                </div>

                <button
                  onClick={() => navigate('/checkout')}
                  className="w-full mt-6 rounded-2xl bg-primary text-[#0d1b12] font-black py-3.5 hover:opacity-90 transition-opacity"
                >
                  Sifarişi tamamla
                </button>
                <button
                  onClick={clearCart}
                  className="w-full mt-3 rounded-2xl border border-white/20 py-3 font-bold text-white/80 hover:bg-white/5 transition-colors"
                >
                  Səbəti təmizlə
                </button>

                <DeliveryTariffsInfo
                  className="mt-6 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3"
                  titleClassName="text-[10px] font-black uppercase tracking-wider text-white/85"
                  lineClassName="text-[11px] text-white/65 leading-snug"
                />
                <div className="mt-4 flex items-start gap-2 text-xs text-white/60">
                  <ShieldCheck className="w-4 h-4 mt-0.5 text-primary" />
                  <p>Ödəniş zamanı məlumatlarınız təhlükəsiz şəkildə qorunur.</p>
                </div>
                <p className="mt-3 text-[11px] text-white/55 leading-snug">
                  Çatdırılma haqqı ünvanınızın bizdən olan məsafəsinə uyğun yuxarıdakı tariflər üzrə tətbiq olunur (checkout-da təsdiqlənir).
                </p>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
