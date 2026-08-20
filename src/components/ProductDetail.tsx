import { motion } from 'motion/react';
import { 
  Bookmark, 
  ShoppingBasket, 
  Star, 
  ChevronRight, 
  Info, 
  Ruler, 
  Truck, 
  CalendarCheck, 
  Minus, 
  Plus, 
  MessageSquarePlus, 
  BadgeCheck, 
  ChevronLeft, 
  ShoppingCart, 
  AlertCircle,
  Timer
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { authService, cartService, favoriteService, productService } from '../services/api';
import { APIProduct, ProductVariant } from '../types';
import BrandLoading from './BrandLoading';
import DeliveryTariffsInfo from './DeliveryTariffsInfo';
import { useAuth } from '../context/AuthContext';

const CART_META_KEY = 'birbuket_cart_item_meta_v1';

// Using a slightly more detailed local type or the one from shared types
export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<APIProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [timeLeft, setTimeLeft] = useState('02:45:00');
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartSuccess, setCartSuccess] = useState<string | null>(null);
  const [hasShownCartSuccess, setHasShownCartSuccess] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const { userId, token, setAuthUser } = useAuth();

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
    const fetchProduct = async () => {
      if (!slug) return;
      try {
        setLoading(true);
        const res = await productService.getBySlug(slug);
        if (res.success) {
          const prod = res.data;
          setProduct(prod);
          setSelectedVariant({
            id: prod.id,
            price: prod.price || 0,
            size: prod.size || '',
            color: prod.color || '',
          });
        } else {
          setError('Məhsul tapılmadı');
        }
      } catch (err) {
        console.error('API Error:', err);
        setError('Məhsul məlumatlarını yükləmək mümkün olmadı.');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    const loadFavoriteState = async () => {
      if (!product?.id) return;
      const effectiveUserId = await resolveEffectiveUserId();
      if (!effectiveUserId) {
        if (!cancelled) setIsFavorite(false);
        return;
      }
      try {
        const v = await favoriteService.isFavorite(product.id, effectiveUserId);
        if (!cancelled) setIsFavorite(v);
      } catch {
        if (!cancelled) setIsFavorite(false);
      }
    };
    void loadFavoriteState();
    return () => {
      cancelled = true;
    };
  }, [product?.id, userId, token]);

  // Mock timer logic
  useEffect(() => {
    const timer = setInterval(() => {
      // In a real app, this would be based on a target time
      // For demo, we just cycle or hardcode starting from a point
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <BrandLoading />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-6">
        <AlertCircle className="w-16 h-16 text-red-500" />
        <h2 className="text-2xl font-bold dark:text-white">{error || 'Məhsul tapılmadı'}</h2>
        <Link to="/collections" className="text-primary font-bold hover:underline mt-4">
          Kolleksiyalara qayıt
        </Link>
      </div>
    );
  }

  const currentPrice = selectedVariant?.price || 0;
  const originalPrice = product.discountPercentage 
    ? (currentPrice / (1 - product.discountPercentage / 100)).toFixed(2)
    : null;
  const productImages = Array.isArray(product.images) ? product.images : [];
  const productVariants = Array.isArray(product.productVariants) ? product.productVariants : [];
  const mainImageSrc =
    productImages[activeImage]?.imageUrl ||
    selectedVariant?.imageUrl ||
    productImages[0]?.imageUrl ||
    undefined;
  const handleVariantSelect = (variant: ProductVariant) => {
    setSelectedVariant(variant);
    const matchingImageIndex = productImages.findIndex(
      (img) => img.imageUrl && variant.imageUrl && img.imageUrl === variant.imageUrl
    );
    if (matchingImageIndex >= 0) {
      setActiveImage(matchingImageIndex);
    } else {
      setActiveImage(-1);
    }
  };

  const handleAddToCart = async () => {
    if (!token) {
      navigate('/login');
      return;
    }

    setAddingToCart(true);
    setError(null);
    if (!hasShownCartSuccess) {
      setCartSuccess(null);
    }
    try {
      let effectiveUserId = userId;
      if (!effectiveUserId) {
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
              if (typeof rawId === 'number' && Number.isFinite(rawId) && rawId > 0) {
                effectiveUserId = rawId;
                break;
              }
              if (typeof rawId === 'string' && /^\d+$/.test(rawId.trim())) {
                effectiveUserId = Number(rawId.trim());
                break;
              }
            }
          }
        } catch {
          // Ignore and fallback to the error below.
        }
      }
      if (!effectiveUserId) {
        setError('Hesab ID-si tapılmadı. Zəhmət olmasa yenidən daxil olun.');
        return;
      }
      try {
        const raw = localStorage.getItem(CART_META_KEY);
        const current = raw ? JSON.parse(raw) : {};
        const next = {
          ...(current && typeof current === 'object' ? current : {}),
          [String(product.id)]: {
            imageUrl: selectedVariant?.imageUrl || mainImageSrc,
            color: selectedVariant?.color || undefined,
            size: selectedVariant?.size || undefined,
            variantName:
              selectedVariant?.variant_name ||
              [selectedVariant?.size, selectedVariant?.color].filter(Boolean).join(' - '),
            variantId: selectedVariant?.id || undefined,
          },
        };
        localStorage.setItem(CART_META_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors silently.
      }

      try {
        await cartService.addItem(effectiveUserId, {
          productId: product.id,
          productName: product.productName,
          unitPrice: currentPrice,
          quantity,
          imageUrl: selectedVariant?.imageUrl || mainImageSrc,
          productImageUrl: selectedVariant?.imageUrl || mainImageSrc,
          productVariantId: selectedVariant?.id,
          variantId: selectedVariant?.id,
          size: selectedVariant?.size,
          color: selectedVariant?.color,
          variantName:
            selectedVariant?.variant_name ||
            [selectedVariant?.size, selectedVariant?.color].filter(Boolean).join(' - '),
        });
      } catch (err: any) {
        // If cart is not initialized for this user, create it and retry once.
        const status = err?.response?.status;
        if ([404, 409].includes(status)) {
          await cartService.createCart({ userId: effectiveUserId });
          await cartService.addItem(effectiveUserId, {
            productId: product.id,
            productName: product.productName,
            unitPrice: currentPrice,
            quantity,
            imageUrl: selectedVariant?.imageUrl || mainImageSrc,
            productImageUrl: selectedVariant?.imageUrl || mainImageSrc,
            productVariantId: selectedVariant?.id,
            variantId: selectedVariant?.id,
            size: selectedVariant?.size,
            color: selectedVariant?.color,
            variantName:
              selectedVariant?.variant_name ||
              [selectedVariant?.size, selectedVariant?.color].filter(Boolean).join(' - '),
          });
        } else {
          throw err;
        }
      }
      if (!hasShownCartSuccess) {
        setCartSuccess('Məhsul səbətə əlavə olundu.');
        setHasShownCartSuccess(true);
      }
    } catch (err: any) {
      const backendMessage = err?.response?.data?.message;
      setError(backendMessage || 'Səbətə əlavə etmə zamanı xəta baş verdi.');
    } finally {
      setAddingToCart(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!product?.id) return;
    if (!token) {
      navigate('/login');
      return;
    }
    const effectiveUserId = await resolveEffectiveUserId();
    if (!effectiveUserId) {
      setError('Hesab ID-si tapılmadı. Zəhmət olmasa yenidən daxil olun.');
      return;
    }
    const prev = isFavorite;
    setFavoriteLoading(true);
    setIsFavorite(!prev);
    try {
      if (prev) await favoriteService.removeFavorite(product.id, effectiveUserId);
      else await favoriteService.addFavorite(product.id, effectiveUserId);
    } catch {
      setIsFavorite(prev);
    } finally {
      setFavoriteLoading(false);
    }
  };

  return (
    <div className="bg-[#fdfcf0] dark:bg-background-dark min-h-screen">
      <main className="max-w-[1440px] mx-auto w-full px-6 lg:px-20 py-8">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-sm text-floral-muted mb-8 overflow-x-auto whitespace-nowrap">
          <Link className="hover:text-primary transition-colors shrink-0" to="/">Ana səhifə</Link>
          <ChevronRight className="w-4 h-4 shrink-0" />
          <Link className="hover:text-primary transition-colors shrink-0" to="/collections">Kolleksiyalar</Link>
          <ChevronRight className="w-4 h-4 shrink-0" />
          <span className="text-floral-deep dark:text-white font-medium truncate">{product.productName}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 mb-20">
          {/* Image Gallery */}
          <div className="flex flex-col gap-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="aspect-[4/5] w-full overflow-hidden rounded-[32px] bg-primary/5 shadow-2xl relative"
            >
              <img 
                alt={product.productName} 
                className="h-full w-full object-cover" 
                src={mainImageSrc} 
              />
              {product.discountPercentage && (
                <div className="absolute top-6 left-6 bg-red-500 text-white text-sm font-bold px-4 py-1.5 rounded-full shadow-lg">
                  -{product.discountPercentage}% ENDİRİM
                </div>
              )}
            </motion.div>
            
            {productVariants.length > 1 && (
              <div className="flex flex-wrap gap-3">
                {productVariants.map((v) => (
                  <button
                    key={`variant-thumb-${v.id}`}
                    type="button"
                    onClick={() => handleVariantSelect(v)}
                    className={`h-16 w-16 overflow-hidden rounded-2xl border-2 transition-all ${
                      selectedVariant?.id === v.id
                        ? 'border-primary shadow-md scale-105'
                        : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                    title={`${v.size || ''} ${v.color || ''}`.trim()}
                  >
                    <img
                      alt={`${v.size || ''} ${v.color || ''}`.trim() || product.productName}
                      className="h-full w-full object-cover"
                      src={v.imageUrl || productImages[0]?.imageUrl || undefined}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Details info */}
          <div className="flex flex-col">
            <div className="border-b border-floral-muted/10 pb-8 mb-8">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-primary/10 text-primary px-3 py-1 rounded-full">
                  Məhdud Sayda
                </span>
                <div className="flex items-center text-yellow-500">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star 
                      key={s} 
                      className={`w-4 h-4 ${s <= (product.rating || 0) ? 'fill-current' : 'opacity-30'}`} 
                    />
                  ))}
                  <span className="ml-2 text-xs font-bold text-floral-muted">
                    ({product.reviewCount || 0} rəy)
                  </span>
                </div>
              </div>
              
              <h1 className="text-4xl lg:text-5xl font-black text-floral-deep dark:text-floral-deep-dark mb-6 leading-tight">
                {product.productName}
              </h1>

              <div className="flex items-baseline gap-4">
                <p className="text-4xl font-black text-primary">{currentPrice} AZN</p>
                {originalPrice && (
                  <p className="text-xl text-floral-muted line-through opacity-50">{originalPrice} AZN</p>
                )}
              </div>
            </div>

            <div className="mb-8">
              <p className="font-display text-xl italic text-floral-muted leading-relaxed mb-8 dark:text-floral-muted-dark">
                "{product.description}"
              </p>
              
              <div className="space-y-6">
                {product.composition && (
                  <div className="flex items-start gap-4">
                    <div className="bg-primary/10 p-2 rounded-xl text-primary">
                      <Info className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-black text-sm uppercase tracking-wider dark:text-white mb-1">Tərkib:</h4>
                      <p className="text-sm text-floral-muted dark:text-floral-muted-dark leading-relaxed">
                        {product.composition}
                      </p>
                    </div>
                  </div>
                )}
                
                {selectedVariant && (
                  <div className="flex items-start gap-4">
                    <div className="bg-primary/10 p-2 rounded-xl text-primary">
                      <Ruler className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-black text-sm uppercase tracking-wider dark:text-white mb-1">Ölçü:</h4>
                      <p className="text-sm text-floral-muted dark:text-floral-muted-dark">
                        {selectedVariant.size} ({selectedVariant.color})
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Delivery Timer Card */}
            <div className="mb-10 p-6 bg-[#0d1b12] dark:bg-white/5 rounded-3xl border border-white/5 shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
                <Timer className="w-24 h-24 text-primary" />
              </div>
              
              <div className="relative z-10 flex items-start gap-4">
                <div className="bg-primary/20 p-3 rounded-2xl">
                  <Truck className="w-8 h-8 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                    <h4 className="font-bold text-white/90">Təxmini çatdırılma vaxtı</h4>
                    <div className="flex items-center gap-1.5 bg-primary/20 px-3 py-1 rounded-full">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                      </span>
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest">Canlı</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-white/60 text-sm">
                      Sifarişi tamamlamaq üçün son <span className="font-black text-primary text-lg tabular-nums">{timeLeft}</span>
                    </p>
                    <div className="flex items-center gap-2 text-xs text-white/40 font-bold uppercase tracking-widest">
                      <CalendarCheck className="w-4 h-4" />
                      Bugün çatdırılma: <span className="text-white/70">18:00-a qədər</span>
                    </div>
                    <DeliveryTariffsInfo
                      className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3"
                      titleClassName="text-[10px] font-black uppercase tracking-wider text-white/80"
                      lineClassName="text-[11px] leading-snug text-white/55"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Add to Cart Controls */}
            <div className="flex flex-col gap-6">
              {cartSuccess && (
                <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-300">
                  {cartSuccess}
                </div>
              )}

              {/* Variant Selector */}
              {productVariants.length > 1 && (
                <div className="flex flex-col gap-2">
                  <h4 className="text-xs font-black uppercase tracking-[0.2em] text-floral-muted px-1">Seçim edin</h4>
                  <div className="flex flex-wrap gap-2">
                    {productVariants.map((v) => (
                      <button 
                        key={v.id}
                        onClick={() => handleVariantSelect(v)}
                        className={`px-6 py-3 rounded-2xl font-bold text-sm transition-all ${
                          selectedVariant?.id === v.id 
                          ? 'bg-primary text-floral-deep shadow-lg scale-105' 
                          : 'bg-white dark:bg-white/5 border border-floral-muted/10 text-floral-muted dark:text-floral-muted-dark hover:border-primary'
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <span className="h-9 w-9 overflow-hidden rounded-xl border border-floral-muted/20 bg-primary/5 shrink-0">
                            <img
                              alt={`${v.size} ${v.color}`}
                              className="h-full w-full object-cover"
                              src={v.imageUrl || productImages[0]?.imageUrl || undefined}
                            />
                          </span>
                          <span>{v.size} - {v.color}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4">
                <div className="flex items-center bg-white dark:bg-white/5 border border-floral-muted/10 rounded-2xl h-14 p-1 shadow-sm">
                  <button 
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-12 h-full flex items-center justify-center hover:bg-primary/10 rounded-xl transition-colors text-floral-deep dark:text-white"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <input 
                    readOnly
                    className="w-14 border-none bg-transparent text-center font-black text-lg focus:ring-0 dark:text-white outline-none" 
                    type="text" 
                    value={quantity}
                  />
                  <button 
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-12 h-full flex items-center justify-center hover:bg-primary/10 rounded-xl transition-colors text-floral-deep dark:text-white"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 flex gap-4">
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleAddToCart}
                    disabled={addingToCart}
                    className="flex-1 bg-primary text-floral-deep font-black py-4 rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-primary/20 hover:shadow-2xl transition-all"
                  >
                    <ShoppingBasket className="w-6 h-6" />
                    {addingToCart ? 'Əlavə edilir...' : 'Səbətə əlavə et'}
                  </motion.button>
                  <button
                    type="button"
                    onClick={() => void handleToggleFavorite()}
                    disabled={favoriteLoading}
                    className="w-14 h-14 border-2 border-primary/20 rounded-2xl flex items-center justify-center hover:bg-primary/5 transition-all text-primary disabled:opacity-60"
                  >
                    <Bookmark className={`w-6 h-6 ${isFavorite ? 'fill-current text-amber-500' : ''}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <section className="border-t border-floral-muted/10 pt-20 mb-20">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-16">
            <div>
              <h3 className="text-4xl font-black text-floral-deep dark:text-floral-deep-dark mb-2 tracking-tight">Müştəri Rəyləri</h3>
              <p className="text-floral-muted dark:text-floral-muted-dark text-lg">Hər rəy bizim üçün dəyərlidir</p>
            </div>
            <button className="bg-[#0d1b12] dark:bg-primary text-white dark:text-[#0d1b12] px-10 py-4 rounded-2xl font-black transition-all flex items-center gap-3 shadow-xl hover:scale-105">
              <MessageSquarePlus className="w-5 h-5" />
              Rəy bildir
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
            <div className="lg:col-span-4 bg-white dark:bg-white/5 p-10 rounded-[40px] border border-floral-muted/10 h-fit shadow-lg shadow-floral-muted/5">
              <div className="flex items-center gap-6 mb-10">
                <div className="text-6xl font-black text-floral-deep dark:text-primary leading-none">4.8</div>
                <div className="flex flex-col">
                  <div className="flex text-yellow-500 mb-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className="w-5 h-5 fill-current" />
                    ))}
                  </div>
                  <span className="text-sm text-floral-muted font-bold tracking-wider uppercase opacity-60">48 ümumi rəy</span>
                </div>
              </div>

              <div className="space-y-5">
                {[
                  { star: 5, pct: 85 },
                  { star: 4, pct: 10 },
                  { star: 3, pct: 3 },
                  { star: 2, pct: 1 },
                  { star: 1, pct: 1 }
                ].map((row) => (
                  <div key={row.star} className="flex items-center gap-4 text-sm font-bold">
                    <span className="w-16 text-floral-muted dark:text-white/40">{row.star} ulduz</span>
                    <div className="flex-1 h-2.5 bg-floral-muted/10 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        whileInView={{ width: `${row.pct}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="bg-primary h-full rounded-full"
                      />
                    </div>
                    <span className="w-10 text-floral-deep dark:text-white text-right">{row.pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-8 space-y-12">
              {[
                { name: 'Leyla Əliyeva', initial: 'L.Ə', date: '2 gün əvvəl', text: 'Həqiqətən möhtəşəmdir! Güllər çox təzə idi və çatdırılma söz verilən vaxtda reallaşdı. Qablaşdırma isə xüsusi zövqlə hazırlanmışdı. Təşəkkürlər!' },
                { name: 'Rauf Məmmədov', initial: 'R.M', date: '1 həftə əvvəl', text: 'Buket çox zərifdir, tam şəkildəki kimi gəldi. Yalnız bir balaca daha böyük olacağını düşünürdüm, amma ümumilikdə çox razı qaldım.' }
              ].map((rev, idx) => (
                <div key={idx} className="border-b border-floral-muted/10 pb-12 group last:border-0 last:pb-0">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-primary text-floral-deep flex items-center justify-center font-black text-xl shadow-lg shadow-primary/10">
                        {rev.initial}
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h4 className="font-black text-floral-deep dark:text-floral-deep-dark text-lg leading-none">{rev.name}</h4>
                          <span className="flex items-center gap-1.5 text-[9px] bg-primary/20 text-primary px-3 py-1 rounded-full font-black uppercase tracking-wider">
                            <BadgeCheck className="w-3 h-3" />
                            Təsdiqlənmiş
                          </span>
                        </div>
                        <div className="flex text-yellow-500 text-xs mt-2">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star key={s} className="w-3.5 h-3.5 fill-current" />
                          ))}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-floral-muted uppercase tracking-widest opacity-60">{rev.date}</span>
                  </div>
                  <p className="text-floral-muted dark:text-floral-muted-dark leading-relaxed text-lg italic">
                    "{rev.text}"
                  </p>
                </div>
              ))}

              <button className="w-full py-6 border-2 border-floral-muted/10 rounded-[32px] text-floral-muted dark:text-floral-muted-dark font-black hover:bg-primary/5 hover:border-primary transition-all uppercase tracking-widest text-sm">
                Bütün rəyləri oxu
              </button>
            </div>
          </div>
        </section>

        {/* Recommendations Section */}
        <section className="border-t border-floral-muted/10 pt-20 pb-20">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h3 className="text-3xl font-black text-floral-deep dark:text-floral-deep-dark mb-2">Sizin üçün önərilənlər</h3>
              <p className="text-floral-muted dark:text-floral-muted-dark">Bu məhsulları da bəyənə bilərsiniz</p>
            </div>
            <div className="flex gap-4">
              <button className="w-12 h-12 border-2 border-floral-muted/10 rounded-2xl flex items-center justify-center hover:bg-primary/5 transition-all">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button className="w-12 h-12 border-2 border-primary rounded-2xl flex items-center justify-center bg-primary/5 text-primary">
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {[1, 2, 3, 4].map((i) => (
              <motion.div 
                key={i} 
                whileHover={{ y: -8 }}
                className="group cursor-pointer"
              >
                <div className="aspect-square rounded-[32px] overflow-hidden bg-primary/5 mb-6 relative shadow-lg">
                  <img 
                    alt="Recommendation" 
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" 
                    src={undefined} 
                  />
                  <button className="absolute bottom-4 right-4 p-3 bg-white dark:bg-primary rounded-2xl shadow-xl text-primary dark:text-[#0d1b12] opacity-0 group-hover:opacity-100 transition-all translate-y-3 group-hover:translate-y-0">
                    <ShoppingCart className="w-6 h-6" />
                  </button>
                </div>
                <h4 className="font-black text-floral-deep dark:text-floral-deep-dark mb-1 h-6 overflow-hidden">Məhsul adı #{i}</h4>
                <p className="text-primary font-black text-lg">25.00 AZN</p>
              </motion.div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
