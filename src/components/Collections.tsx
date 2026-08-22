import { motion } from 'motion/react';
import { Search, Bookmark, ShoppingBasket, Star, ChevronDown, MoveVertical, Send, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { productService, categoryService, cartService, authService, favoriteService } from '../services/api';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Product, ProductVariant, APIProduct, Category } from '../types';
import BrandLoading from './BrandLoading';
import { useAuth } from '../context/AuthContext';

const prices = ["Hamısı", "0 - 50 AZN", "50 - 150 AZN", "150+ AZN"];
const colors = [
  { name: 'Red', class: 'bg-red-500' },
  { name: 'Pink', class: 'bg-pink-400' },
  { name: 'White', class: 'bg-white border-black/10' },
  { name: 'Yellow', class: 'bg-yellow-400' }
];
const CART_META_KEY = 'birbuket_cart_item_meta_v1';

export default function Collections() {
  const navigate = useNavigate();
  const { userId, token, setAuthUser } = useAuth();
  const [searchParams] = useSearchParams();
  const queryCategoryId = searchParams.get('category');
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(queryCategoryId ? Number(queryCategoryId) : 0);
  const [selectedPrice, setSelectedPrice] = useState("Hamısı");
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [categoryInfo, setCategoryInfo] = useState<{title: string, subtitle: string} | null>(null);
  const [apiCategories, setApiCategories] = useState<{id: number, name: string}[]>([{ id: 0, name: "Bütün Məhsullar" }]);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [addingProductId, setAddingProductId] = useState<number | null>(null);
  const [favoriteByProductId, setFavoriteByProductId] = useState<Record<number, boolean>>({});
  const [favoritingProductId, setFavoritingProductId] = useState<number | null>(null);
  const pageSize = 12;

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

  // Fetch Categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await categoryService.getAll();
        if (res.success && Array.isArray(res.data)) {
          const formatted = res.data.map((cat: any) => ({
            id: cat.id,
            name: cat.title // Using title from the API response example
          }));
          setApiCategories([{ id: 0, name: "Bütün Məhsullar" }, ...formatted]);
        }
      } catch (err) {
        console.error("Failed to fetch categories:", err);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    if (queryCategoryId) {
      setSelectedCategoryId(Number(queryCategoryId));
      setCurrentPage(0); // Reset page on category change
    }
  }, [queryCategoryId]);

  useEffect(() => {
    const fetchCategoryInfo = async () => {
      if (selectedCategoryId <= 0) {
        setCategoryInfo(null);
        return;
      }

      try {
        const catRes = await categoryService.getById(selectedCategoryId);
        if (catRes.success) {
          setCategoryInfo({
            title: catRes.data.title,
            subtitle: catRes.data.subtitle || ''
          });
        }
      } catch (e) {
        console.warn("Category info fetch failed", e);
      }
    };

    fetchCategoryInfo();
  }, [selectedCategoryId]);

  const fetchData = async (page: number) => {
    try {
      setLoading(true);
      setError(null);
      
      const filterParams: any = {};
      if (selectedCategoryId > 0) filterParams.categoryId = selectedCategoryId;
      
      // Price range logic
      if (selectedPrice !== "Hamısı") {
        if (selectedPrice === "0 - 50 AZN") {
          filterParams.minPrice = 0;
          filterParams.maxPrice = 50;
        } else if (selectedPrice === "50 - 150 AZN") {
          filterParams.minPrice = 50;
          filterParams.maxPrice = 150;
        } else if (selectedPrice === "150+ AZN") {
          filterParams.minPrice = 150;
        }
      }
      
      if (selectedColor) filterParams.color = selectedColor.toUpperCase();

      // Use /api/product/filter only for advanced filters.
      // For category-only fetches, use /api/product/category/{id}/product.
      const hasAdvancedFilters = selectedPrice !== "Hamısı" || !!selectedColor;

      let productRes;
      if (hasAdvancedFilters) {
        // Advanced filtering behavior
        const res = await productService.filter({
          ...filterParams,
          active: true,
        });
        if (res.success) {
          setProducts(res.data);
          setTotalPages(1); // Filter API as per example returns a flat array
          setTotalElements(res.data.length);
        } else {
          throw new Error('Filtrləmə zamanı xəta baş verdi');
        }
      } else if (selectedCategoryId > 0) {
        // Category-only listing with backend pagination
        productRes = await productService.getByCategory(selectedCategoryId, page, pageSize);
        if (productRes.success && productRes.data) {
          const all = productRes.data.content ?? [];
          const filtered = all.filter((p: any) => p.active !== false);
          setProducts(filtered);
          setTotalPages(productRes.data.totalPages);
          setTotalElements(productRes.data.totalElements);
        } else {
          throw new Error(productRes.message || 'Məlumat yüklənə bilmədi');
        }
      } else {
        // Standard full list with pagination
        setCategoryInfo(null);
        productRes = await productService.getAll(page, pageSize, { active: true });
        if (productRes.success && productRes.data) {
          setProducts(productRes.data.content);
          setTotalPages(productRes.data.totalPages);
          setTotalElements(productRes.data.totalElements);
        } else {
          throw new Error(productRes.message || 'Məlumat yüklənə bilmədi');
        }
      }
    } catch (err) {
      console.error('API Error:', err);
      setError('Məhsulları yükləmək mümkün olmadı. Zəhmət olmasa API-nin işlədiyindən əmin olun.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(currentPage);
  }, [selectedCategoryId, selectedPrice, selectedColor, currentPage]);

  useEffect(() => {
    let cancelled = false;
    const loadFavorites = async () => {
      const effectiveUserId = await resolveEffectiveUserId();
      if (!effectiveUserId) {
        if (!cancelled) setFavoriteByProductId({});
        return;
      }
      try {
        const rows = await favoriteService.getFavorites(effectiveUserId);
        if (cancelled) return;
        const map: Record<number, boolean> = {};
        for (const row of rows) map[row.productId] = true;
        setFavoriteByProductId(map);
      } catch {
        if (!cancelled) setFavoriteByProductId({});
      }
    };
    void loadFavorites();
    return () => {
      cancelled = true;
    };
  }, [userId, token]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 0 && newPage < totalPages) {
      setCurrentPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleCategoryChange = (catId: number) => {
    setSelectedCategoryId(catId);
    setCurrentPage(0); // Reset to first page
    navigate(`/collections?category=${catId}`);
  };

  const handleAddToCart = async (productId: number) => {
    if (!token) {
      navigate('/login');
      return;
    }

    setAddingProductId(productId);
    try {
      let effectiveUserId = userId;
      if (!effectiveUserId) {
        try {
          const meRes = await authService.getMe();
          if (meRes?.success && meRes?.data) {
            setAuthUser(meRes.data);
            const fetchedId = Number((meRes.data as any)?.id);
            if (Number.isFinite(fetchedId) && fetchedId > 0) {
              effectiveUserId = fetchedId;
            }
          }
        } catch {
          // Ignore profile fetch error and fallback to login redirect below.
        }
      }
      if (!effectiveUserId) {
        alert('Hesab ID-si tapılmadı. Zəhmət olmasa yenidən daxil olun.');
        return;
      }
      const selectedProduct = products.find((product) => product.id === productId);
      const unitPrice = Number((selectedProduct?.price || '').replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
      const productName = selectedProduct?.title || 'Məhsul';
      const imageUrl = selectedProduct?.img || undefined;
      try {
        const raw = localStorage.getItem(CART_META_KEY);
        const current = raw ? JSON.parse(raw) : {};
        const next = {
          ...(current && typeof current === 'object' ? current : {}),
          [String(productId)]: {
            imageUrl,
          },
        };
        localStorage.setItem(CART_META_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors silently.
      }

      try {
        await cartService.addItem(effectiveUserId, { productId, productName, unitPrice, quantity: 1, imageUrl });
      } catch (err: any) {
        const status = err?.response?.status;
        if ([404, 409].includes(status)) {
          await cartService.createCart({ userId: effectiveUserId });
          await cartService.addItem(effectiveUserId, { productId, productName, unitPrice, quantity: 1, imageUrl });
        } else {
          throw err;
        }
      }
    } catch (err: any) {
      const backendMessage = err?.response?.data?.message;
      alert(backendMessage || 'Səbətə əlavə etmə zamanı xəta baş verdi.');
    } finally {
      setAddingProductId(null);
    }
  };

  const handleToggleFavorite = async (productId: number) => {
    if (!token) {
      navigate('/login');
      return;
    }
    const effectiveUserId = await resolveEffectiveUserId();
    if (!effectiveUserId) {
      alert('Hesab ID-si tapılmadı. Zəhmət olmasa yenidən daxil olun.');
      return;
    }
    const wasFavorite = Boolean(favoriteByProductId[productId]);
    setFavoritingProductId(productId);
    setFavoriteByProductId((prev) => ({ ...prev, [productId]: !wasFavorite }));
    try {
      if (wasFavorite) {
        await favoriteService.removeFavorite(productId, effectiveUserId);
      } else {
        await favoriteService.addFavorite(productId, effectiveUserId);
      }
    } catch {
      setFavoriteByProductId((prev) => ({ ...prev, [productId]: wasFavorite }));
    } finally {
      setFavoritingProductId(null);
    }
  };

  return (
    <div className="bg-[#fdfcf0] dark:bg-background-dark min-h-screen">
      {/* Title Section */}
      <section className="px-6 lg:px-20 pt-12 pb-8">
        <div className="max-w-[1440px] mx-auto">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl lg:text-5xl font-black mb-4 dark:text-floral-deep-dark"
          >
            {categoryInfo?.title || "BirBuket Kolleksiyaları"}
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-floral-muted dark:text-floral-muted-dark max-w-2xl text-lg"
          >
            {categoryInfo?.subtitle || "Hər zövqə və məkana uyğun ən təzə, xüsusi dizayn edilmiş çiçək kompozisiyalarımızla tanış olun."}
          </motion.p>
        </div>
      </section>

      {/* Filter Bar */}
      <section className="px-6 lg:px-20 py-6 sticky top-[73px] z-40 bg-[#fdfcf0]/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-floral-muted/10">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center gap-6">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-floral-muted/70 dark:text-white/40 px-1">Kateqoriya</label>
            <div className="relative">
              <select 
                value={selectedCategoryId}
                onChange={(e) => handleCategoryChange(Number(e.target.value))}
                className="appearance-none bg-white dark:bg-white/5 border border-floral-muted/20 dark:border-white/10 rounded-full px-4 py-2 text-sm font-medium focus:ring-primary focus:border-primary min-w-[180px] dark:text-white outline-none pr-10 cursor-pointer"
              >
                {apiCategories.map(c => <option key={c.id} value={c.id} className="bg-white dark:bg-slate-900">{c.name}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-floral-muted" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-floral-muted/70 dark:text-white/40 px-1">Qiymət</label>
            <div className="relative">
              <select 
                value={selectedPrice}
                onChange={(e) => setSelectedPrice(e.target.value)}
                className="appearance-none bg-white dark:bg-white/5 border border-floral-muted/20 dark:border-white/10 rounded-full px-4 py-2 text-sm font-medium focus:ring-primary focus:border-primary min-w-[140px] dark:text-white outline-none pr-10 cursor-pointer"
              >
                {prices.map(p => <option key={p} value={p} className="bg-white dark:bg-slate-900">{p}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-floral-muted" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-floral-muted/70 dark:text-white/40 px-1">Rəng</label>
            <div className="flex items-center gap-2 bg-white dark:bg-white/5 border border-floral-muted/20 dark:border-white/10 rounded-full px-3 py-2 cursor-pointer group">
              {colors.map((color, i) => (
                <button 
                  key={i} 
                  onClick={() => setSelectedColor(selectedColor === color.name ? null : color.name)}
                  className={`w-5 h-5 rounded-full ${color.class} border-white dark:border-transparent transition-transform hover:scale-125 ${selectedColor === color.name ? 'ring-2 ring-primary ring-offset-2 scale-125' : ''}`} 
                  title={color.name}
                />
              ))}
              {selectedColor && (
                <button 
                  onClick={() => setSelectedColor(null)}
                  className="text-[10px] font-bold text-red-500 ml-1 hover:underline"
                >
                  X
                </button>
              )}
            </div>
          </div>

          <div className="flex-1"></div>

          <div className="flex items-center gap-2 self-end pb-1">
            <span className="text-xs font-semibold text-floral-muted dark:text-white/40">Sırala:</span>
            <button className="flex items-center gap-1 text-sm font-bold hover:text-primary transition-colors dark:text-white">
              Məşhurluq <MoveVertical className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Product Grid */}
      <section className="px-6 lg:px-20 py-12">
        <div className="max-w-[1440px] mx-auto min-h-[400px]">
          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center py-12">
              <BrandLoading />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 max-w-md mx-auto text-center">
              <AlertCircle className="w-12 h-12 text-red-500" />
              <p className="text-floral-deep dark:text-white font-bold text-lg leading-snug">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="mt-2 text-primary font-bold hover:underline"
              >
                Yenidən yoxla
              </button>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-floral-muted text-lg">Heç bir məhsul tapılmadı.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {products.map((p, i) => (
                <motion.div 
                  key={p.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="product-card group bg-white dark:bg-white/5 rounded-2xl overflow-hidden border border-floral-muted/5 dark:border-white/5 shadow-sm hover:shadow-xl transition-all duration-500 relative cursor-pointer"
                >
                  {/* The actual Link that handles navigation - z-10 covers everything underneath */}
                  <Link 
                    to={`/product/${p.slug || p.id}`} 
                    className="absolute inset-0 z-10"
                    onClick={() => {}}
                  />

                  {/* Visual Layout - z-0 */}
                  <div className="relative z-0">
                    <div className="aspect-[4/5] overflow-hidden relative">
                      <img 
                        alt={p.title} 
                        className={`w-full h-full object-cover transition-all duration-700 ${p.hoverImg ? 'group-hover:opacity-0 group-hover:scale-110' : 'group-hover:scale-110'}`} 
                        src={p.img || undefined} 
                        referrerPolicy="no-referrer"
                      />
                      {p.hoverImg && (
                        <img 
                          alt={`${p.title} - 2`} 
                          className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700" 
                          src={p.hoverImg || undefined} 
                          referrerPolicy="no-referrer"
                        />
                      )}
                      
                      {p.badge && (
                        <div className="absolute top-4 left-4 bg-primary text-floral-deep text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg">
                          {p.badge}
                        </div>
                      )}
                    </div>

                    <div className="p-6">
                      <div className="flex justify-between items-start mb-2 gap-4">
                        <h3 className="font-bold text-lg group-hover:text-primary transition-colors leading-tight dark:text-floral-deep-dark">{p.title}</h3>
                        <span className="font-black text-primary text-lg whitespace-nowrap">{p.price}</span>
                      </div>
                      <p className="text-floral-muted dark:text-floral-muted-dark text-xs mb-4 line-clamp-2">{p.desc}</p>
                      <div className="flex items-center gap-1 text-yellow-500">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} className={`w-3 h-3 ${s <= p.rating ? 'fill-current' : ''}`} />
                        ))}
                        <span className="text-[10px] font-bold text-floral-muted ml-1">({p.rating > 0 ? p.rating : 'Yeni'})</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons - z-20 to be clickable above the Link */}
                  <div className="absolute top-4 right-4 z-20">
                    <button 
                      className="w-10 h-10 rounded-full bg-white/80 dark:bg-background-dark/80 backdrop-blur-sm flex items-center justify-center text-floral-deep dark:text-floral-deep-dark hover:text-amber-500 dark:hover:text-amber-400 transition-colors shadow-sm cursor-pointer" 
                      onClick={(e) => { 
                        e.preventDefault(); 
                        e.stopPropagation(); 
                        void handleToggleFavorite(p.id);
                      }}
                      disabled={favoritingProductId === p.id}
                    >
                      <Bookmark className={`w-5 h-5 ${favoriteByProductId[p.id] ? 'fill-current text-amber-500' : ''}`} />
                    </button>
                  </div>

                  <div className="absolute inset-x-4 bottom-[108px] translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 z-20 pointer-events-none group-hover:pointer-events-auto">
                    <button 
                      className="w-full bg-[#0d1b12] dark:bg-primary text-white dark:text-[#0d1b12] py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary hover:text-floral-deep dark:hover:bg-white transition-colors shadow-lg cursor-pointer" 
                      onClick={(e) => { 
                        e.preventDefault();
                        e.stopPropagation();
                        handleAddToCart(p.id);
                      }}
                    >
                      <ShoppingBasket className="w-4 h-4" />
                      {addingProductId === p.id ? 'Əlavə edilir...' : 'Səbətə at'}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {!loading && !error && totalPages > 1 && (
          <div className="flex flex-col items-center gap-8 mt-20">
            {/* Pagination Info */}
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm font-bold text-floral-muted/60 dark:text-white/40 uppercase tracking-widest">
                Səhifə <span className="text-primary">{currentPage + 1}</span> / {totalPages}
              </p>
              <div className="w-48 bg-floral-muted/10 h-1 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${((currentPage + 1) / totalPages) * 100}%` }}
                  className="bg-primary h-full"
                />
              </div>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-2">
              <button 
                disabled={currentPage === 0}
                onClick={() => handlePageChange(currentPage - 1)}
                className="w-12 h-12 rounded-2xl bg-white dark:bg-white/5 border border-floral-muted/10 dark:border-white/10 flex items-center justify-center hover:bg-primary hover:text-floral-deep disabled:opacity-30 disabled:hover:bg-white dark:disabled:hover:bg-white/5 transition-all text-floral-deep dark:text-white"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2">
                {Array.from({ length: totalPages }).map((_, idx) => {
                  // Logic to show limited page numbers if totalPages is large
                  if (
                    idx === 0 || 
                    idx === totalPages - 1 || 
                    (idx >= currentPage - 1 && idx <= currentPage + 1)
                  ) {
                    return (
                      <button
                        key={idx}
                        onClick={() => handlePageChange(idx)}
                        className={`w-12 h-12 rounded-2xl font-black text-sm transition-all shadow-sm ${
                          currentPage === idx 
                          ? 'bg-primary text-floral-deep scale-110 shadow-primary/20' 
                          : 'bg-white dark:bg-white/5 border border-floral-muted/10 dark:border-white/10 text-floral-muted dark:text-white hover:border-primary'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    );
                  } else if (
                    (idx === currentPage - 2 && idx > 0) || 
                    (idx === currentPage + 2 && idx < totalPages - 1)
                  ) {
                    return <span key={idx} className="text-floral-muted">...</span>;
                  }
                  return null;
                })}
              </div>

              <button 
                disabled={currentPage === totalPages - 1}
                onClick={() => handlePageChange(currentPage + 1)}
                className="w-12 h-12 rounded-2xl bg-white dark:bg-white/5 border border-floral-muted/10 dark:border-white/10 flex items-center justify-center hover:bg-primary hover:text-floral-deep disabled:opacity-30 disabled:hover:bg-white dark:disabled:hover:bg-white/5 transition-all text-floral-deep dark:text-white"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs font-bold text-floral-muted dark:text-white/20 uppercase tracking-[0.2em]">
              Ümumi məhsul: <span className="text-primary">{totalElements}</span>
            </p>
          </div>
        )}
      </section>

      {/* Newsletter Section */}
      <section id="abunelik" className="px-6 lg:px-20 py-20 scroll-mt-28">
        <div className="max-w-[1440px] mx-auto bg-[#0d1b12] rounded-[48px] overflow-hidden relative">
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary rounded-full blur-[120px] -mr-40 -mt-40"></div>
          </div>
          <div className="relative z-10 p-12 lg:p-24 flex flex-col lg:flex-row items-center justify-between gap-12">
            <div className="flex flex-col gap-6 text-center lg:text-left max-w-xl">
              <h2 className="text-3xl lg:text-5xl font-black text-white leading-[1.1] tracking-tight">
                Eksklüziv endirimlərdən<br />ilk siz xəbərdar olun
              </h2>
              <p className="text-white/40 text-lg">
                Hər həftə yeni kolleksiyalar və xüsusi təkliflər e-poçtunuza gəlsin.
              </p>
            </div>
            
            <div className="w-full max-w-md bg-white/5 p-2 rounded-3xl border border-white/10 flex backdrop-blur-sm">
              <input 
                className="bg-transparent border-none focus:ring-0 text-white placeholder:text-white/20 flex-1 px-5 py-4" 
                placeholder="Email ünvanınız" 
                type="email"
              />
              <button className="bg-primary text-floral-deep font-bold px-8 py-4 rounded-2xl hover:scale-105 transition-transform shadow-lg shadow-primary/20">
                Abunə ol
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
