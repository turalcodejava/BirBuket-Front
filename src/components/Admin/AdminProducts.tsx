import React, { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ImageIcon,
  Loader2,
  PencilLine,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import {
  productService,
  variantDataUrlToImageFile,
  variantService,
  categoryService,
  type ProductVariantAdmin,
} from '../../services/api';

const API_BASE = String(process.env.NEXT_PUBLIC_API_BASE_URL || '').trim();
const API_ORIGIN = (() => {
  if (!API_BASE) return '';
  try {
    return new URL(API_BASE, window.location.origin).origin;
  } catch {
    return '';
  }
})();

function normalizeImageUrl(value?: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const fixed = raw.replace(/\\/g, '/');
  if (/^data:image\//i.test(fixed)) return fixed;
  if (/^https?:\/\//i.test(fixed)) return fixed;
  if (/^\/\//.test(fixed)) return `${window.location.protocol}${fixed}`;
  const path = fixed.startsWith('/') ? fixed : `/${fixed}`;
  if (API_ORIGIN) {
    try {
      return new URL(path, API_ORIGIN).toString();
    } catch {
      //
    }
  }
  if (API_BASE) {
    try {
      return new URL(path, API_BASE).toString();
    } catch {
      //
    }
  }
  return path;
}

/** Backend `productType` enum — admin üçün seçim siyahısı. */
const ADMIN_PRODUCT_TYPE_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'FLOWER', label: 'FLOWER — güllər (adi məhsul)' },
  { value: 'BOX', label: 'BOX — gül qutuları' },
  { value: 'MATERIAL', label: 'MATERIAL — buket materialları' },
  { value: 'RIBBON', label: 'RIBBON — lentlər' },
  { value: 'OBVIOUSLY', label: 'OBVIOUSLY — studiya / konstruktor' },
];

function normalizedProductTypeCode(raw: string): string {
  return String(raw || '').trim().toUpperCase();
}

function formatProductTypeForTable(code: string): string {
  const u = normalizedProductTypeCode(code);
  if (!u) return '—';
  const opt = ADMIN_PRODUCT_TYPE_OPTIONS.find((o) => o.value === u);
  return opt ? opt.value : u;
}

type VariantRow = {
  id: number;
  variantName: string;
  size: string;
  color: string;
  price: number;
  imageUrl: string;
  discountPercentage?: number;
};

type ProductAdminRow = {
  id: number;
  productName: string;
  productType: string;
  isSingle: boolean;
  discountPercentage: number | null;
  mainImageUrl: string;
  variants: VariantRow[];
};

function readDiscount(p: Record<string, unknown>): number | null {
  if (
    !Object.prototype.hasOwnProperty.call(p, 'discountPercentage') &&
    !Object.prototype.hasOwnProperty.call(p, 'discount_percentage')
  ) {
    return null;
  }
  const d = Number((p as any).discountPercentage ?? (p as any).discount_percentage);
  if (!Number.isFinite(d)) return null;
  return Math.min(100, Math.max(0, d));
}

function normalizeBooleanProduct(p: Record<string, unknown>): boolean {
  const v = (p as any).isSingle ?? (p as any).is_single ?? (p as any).single ?? (p as any).singleProduct;
  if (typeof v === 'boolean') return v;
  if (v === 1 || v === '1') return true;
  const s = String(v ?? '').toLowerCase();
  if (['true', 'yes', 'y', 'single'].includes(s)) return true;
  return false;
}

function parseVariantsRaw(p: Record<string, unknown>): VariantRow[] {
  const raw = Array.isArray((p as any).productVariants)
    ? ((p as any).productVariants as unknown[])
    : Array.isArray((p as any).variants)
      ? ((p as any).variants as unknown[])
      : [];
  return raw.map((item, idx) => {
    const v = item as Record<string, unknown>;
    const id = Number(v.id ?? idx);
    return {
      id: Number.isFinite(id) ? id : idx,
      variantName: String(v.variant_name ?? v.variantName ?? v.title ?? v.name ?? '').trim(),
      size: String(v.size ?? '').trim(),
      color: String(v.color ?? '').trim(),
      price: Number(v.price ?? v.unitPrice ?? 0),
      imageUrl: normalizeImageUrl(String(v.imageUrl ?? v.image_url ?? v.image ?? '')),
      ...readVariantDiscountRecord(v),
    };
  });
}

function readVariantDiscountRecord(v: Record<string, unknown>): { discountPercentage?: number } {
  if (
    !Object.prototype.hasOwnProperty.call(v, 'discountPercentage') &&
    !Object.prototype.hasOwnProperty.call(v, 'discount_percentage')
  ) {
    return {};
  }
  const d = Number((v as any).discountPercentage ?? (v as any).discount_percentage);
  if (!Number.isFinite(d)) return {};
  return { discountPercentage: Math.min(100, Math.max(0, d)) };
}

function firstMainImage(p: Record<string, unknown>, variants: VariantRow[]): string {
  const imgs = Array.isArray((p as any).images) ? ((p as any).images as { imageUrl?: string }[]) : [];
  for (const im of imgs) {
    const u = normalizeImageUrl(String(im?.imageUrl ?? ''));
    if (u) return u;
  }
  return variants.find((x) => x.imageUrl)?.imageUrl ?? '';
}

function normalizeProductRow(raw: unknown): ProductAdminRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const id = Number((p as any).id ?? (p as any).productId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const variants = parseVariantsRaw(p);
  const productName =
    String((p as any).productName ?? (p as any).title ?? (p as any).name ?? `Məhsul #${id}`).trim() ||
    `Məhsul #${id}`;
  return {
    id,
    productName,
    productType: normalizedProductTypeCode(String((p as any).productType ?? (p as any).type ?? '')),
    isSingle: normalizeBooleanProduct(p),
    discountPercentage: readDiscount(p),
    mainImageUrl: firstMainImage(p, variants),
    variants,
  };
}

/** UI draft — string sahələr forma üçün */
type ProductFormDraft = {
  productName: string;
  productType: string;
  isSingle: boolean;
  discountInput: string;
  mainImageFile?: File;
  mainImagePreview?: string;
};

type VariantFormDraft = {
  price: string;
  variantName: string;
  size: string;
  color: string;
  imageUrl: string;
  discountInput: string;
};

function emptyVariantFormDraft(): VariantFormDraft {
  return {
    price: '',
    variantName: '',
    size: '',
    color: '',
    imageUrl: '',
    discountInput: '',
  };
}

function seedVariantDraftFromRow(v: VariantRow): VariantFormDraft {
  return {
    price: String(v.price ?? ''),
    variantName: v.variantName ?? '',
    size: v.size ?? '',
    color: v.color ?? '',
    imageUrl: v.imageUrl ?? '',
    discountInput:
      v.discountPercentage != null && Number.isFinite(v.discountPercentage) ? String(v.discountPercentage) : '',
  };
}

/**
 * Variant DELETE yoxdursa: PATCH /api/product/{id} ilə qalan variantlar (cari forma + mövcud sətir).
 * `data:` şəkil URL PATCH-də göndərilmir — serverdəki şəkil saxlanılır.
 */
function buildProductVariantsAfterRemoval(
  row: ProductAdminRow,
  excludeVariantId: number,
  drafts: Record<number, VariantFormDraft>
): Array<Record<string, unknown>> {
  const result: Array<Record<string, unknown>> = [];
  for (const x of row.variants) {
    if (x.id === excludeVariantId) continue;
    const d = drafts[x.id] ?? seedVariantDraftFromRow(x);
    let price = Number(String(d.price).replace(',', '.'));
    if (!Number.isFinite(price) || price <= 0) price = Number(x.price);
    if (!Number.isFinite(price) || price <= 0) continue;
    const o: Record<string, unknown> = { price };
    const vn = d.variantName.trim();
    if (vn) o.variantName = vn;
    const sz = d.size.trim().toUpperCase();
    if (sz) o.size = sz;
    const cl = d.color.trim().toUpperCase();
    if (cl) o.color = cl;
    let img = d.imageUrl.trim();
    if (/^data:image\//i.test(img)) img = String(x.imageUrl || '').trim();
    if (img && !/^data:image\//i.test(img)) o.imageUrl = img;
    const dr = d.discountInput.trim();
    if (dr !== '') {
      const dn = Number(dr);
      if (Number.isFinite(dn) && dn >= 0 && dn <= 100) o.discountPercentage = dn;
    } else if (x.discountPercentage != null && Number.isFinite(x.discountPercentage)) {
      o.discountPercentage = x.discountPercentage;
    }
    result.push(o);
  }
  return result;
}

function Thumb({ src, alt, className = 'h-12 w-12' }: { src: string; alt: string; className?: string }) {
  const box = `shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-white/10 ${className}`;
  if (!src) {
    return (
      <div className={`flex items-center justify-center text-slate-400 ${box}`}>
        <ImageIcon className="h-5 w-5" />
      </div>
    );
  }
  return (
    <div className={box}>
      <img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" />
    </div>
  );
}

export default function AdminProducts() {
  const [rows, setRows] = useState<ProductAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [variantsLoading, setVariantsLoading] = useState<number | null>(null);
  const [productDraft, setProductDraft] = useState<Record<number, ProductFormDraft>>({});
  const [variantDraft, setVariantDraft] = useState<Record<number, VariantFormDraft>>({});
  const [savingProductId, setSavingProductId] = useState<number | null>(null);
  const [savingVariantId, setSavingVariantId] = useState<number | null>(null);
  const [creatingVariantForProductId, setCreatingVariantForProductId] = useState<number | null>(null);
  const [newVariantDraftByProductId, setNewVariantDraftByProductId] = useState<Record<number, VariantFormDraft>>({});
  const [notice, setNotice] = useState('');
  const [deletingVariantId, setDeletingVariantId] = useState<number | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<number | null>(null);

  // New product modal states
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [newProduct, setNewProduct] = useState({
    productName: '',
    description: '',
    productType: 'FLOWER',
    isSingle: false,
    discountPercentage: 0,
    categoryId: 1,
  });
  const [newProductImage, setNewProductImage] = useState<File | null>(null);
  const [newProductImagePreview, setNewProductImagePreview] = useState<string>('');

  // Load categories
  useEffect(() => {
    categoryService.getAll()
      .then((res) => {
        if (res?.success && Array.isArray(res.data)) {
          setCategories(res.data);
          if (res.data.length > 0) {
            setNewProduct((prev) => ({ ...prev, categoryId: res.data[0].id }));
          }
        }
      })
      .catch((err) => console.error("Error loading categories:", err));
  }, []);

  const loadPage = useCallback(async (nextPage: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await productService.listForAdmin({ page: nextPage, size: 20 });
      const content = Array.isArray(res?.data) ? res.data : [];
      const parsed = content.map(normalizeProductRow).filter((x): x is ProductAdminRow => x != null);
      setRows(parsed);
      setPage(Number(res.page ?? nextPage));
      setTotalPages(Math.max(1, Number(res.totalPages ?? 1)));
      setProductDraft((prev) => {
        const next = { ...prev };
        for (const r of parsed) {
          if (!next[r.id]) {
            next[r.id] = {
              productName: r.productName,
              productType: r.productType,
              isSingle: r.isSingle,
              discountInput: r.discountPercentage != null ? String(r.discountPercentage) : '',
            };
          }
        }
        return next;
      });
    } catch (e: unknown) {
      setRows([]);
      const msg =
        typeof e === 'object' &&
        e &&
        'response' in e &&
        (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(String(msg ?? (e as Error)?.message ?? 'Məhsullar yüklənmədi.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPage(0);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(''), 2500);
    return () => window.clearTimeout(t);
  }, [notice]);

  const refreshCurrent = () => void loadPage(page);

  /** Genişəlləndəndə ən son variantları götür */
  const hydrateExpanded = async (productId: number, baseVariants: VariantRow[]) => {
    setVariantsLoading(productId);
    try {
      let list = await variantService.listByProduct(productId);
      if (!list.length && baseVariants.length) {
        list = baseVariants.map((v) => ({
          id: v.id,
          price: v.price,
          size: v.size,
          color: v.color,
          variantName: v.variantName,
          imageUrl: v.imageUrl,
          ...(v.discountPercentage != null ? { discountPercentage: v.discountPercentage } : {}),
        }));
      }
      setVariantDraft((prev) => {
        const next = { ...prev };
        for (const v of list) {
          next[v.id] = {
            price: String(v.price ?? ''),
            variantName: v.variantName || '',
            size: v.size || '',
            color: v.color || '',
            imageUrl: v.imageUrl || '',
            discountInput:
              v.discountPercentage != null && Number.isFinite(v.discountPercentage)
                ? String(v.discountPercentage)
                : '',
          };
        }
        return next;
      });
      setRows((prev) =>
        prev.map((row) =>
          row.id === productId
            ? {
                ...row,
                variants: list.map((v): VariantRow => ({
                  id: v.id,
                  variantName: v.variantName ?? '',
                  size: v.size ?? '',
                  color: v.color ?? '',
                  price: Number(v.price ?? 0),
                  imageUrl: normalizeImageUrl(v.imageUrl),
                  ...(v.discountPercentage != null ? { discountPercentage: v.discountPercentage } : {}),
                })),
              }
            : row
        )
      );
    } catch {
      /** API yoxdursa siyahı məhsuldakı kimi qalır */
      setVariantDraft((prev) => {
        const next = { ...prev };
        for (const v of baseVariants) {
          if (!next[v.id])
            next[v.id] = {
              price: String(v.price ?? ''),
              variantName: v.variantName,
              size: v.size,
              color: v.color,
              imageUrl: v.imageUrl,
              discountInput:
                v.discountPercentage != null ? String(v.discountPercentage) : '',
            };
        }
        return next;
      });
    } finally {
      setVariantsLoading(null);
    }
  };

  const toggleExpand = async (row: ProductAdminRow) => {
    if (expandedId === row.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(row.id);
    setProductDraft((prev) => ({
      ...prev,
      [row.id]: {
        productName: row.productName,
        productType: row.productType,
        isSingle: row.isSingle,
        discountInput: row.discountPercentage != null ? String(row.discountPercentage) : '',
        mainImagePreview: row.mainImageUrl || '',
      },
    }));
    setVariantDraft((prev) => {
      const next = { ...prev };
      for (const v of row.variants) {
        next[v.id] = {
          price: String(v.price ?? ''),
          variantName: v.variantName,
          size: v.size,
          color: v.color,
          imageUrl: v.imageUrl,
          discountInput: v.discountPercentage != null ? String(v.discountPercentage) : '',
        };
      }
      return next;
    });
    await hydrateExpanded(row.id, row.variants);
    setNewVariantDraftByProductId((prev) => ({
      ...prev,
      [row.id]: prev[row.id] ?? emptyVariantFormDraft(),
    }));
  };

  const createVariant = async (row: ProductAdminRow) => {
    const d = newVariantDraftByProductId[row.id] ?? emptyVariantFormDraft();
    const price = Number(String(d.price).replace(',', '.'));
    if (!Number.isFinite(price) || price <= 0) {
      setError('Yeni variant üçün keçərli qiymət yazın (> 0).');
      return;
    }
    let discountPct: number | undefined;
    const dr = d.discountInput.trim();
    if (dr !== '') {
      const dn = Number(dr);
      if (!Number.isFinite(dn) || dn < 0 || dn > 100) {
        setError('Variant endirimi 0–100 arası olmalıdır.');
        return;
      }
      discountPct = dn;
    }
    const payload = {
      price,
      ...(d.variantName.trim() ? { variantName: d.variantName.trim() } : {}),
      ...(d.size.trim() ? { size: d.size.trim().toUpperCase() } : {}),
      ...(d.color.trim() ? { color: d.color.trim().toUpperCase() } : {}),
      ...(d.imageUrl.trim() ? { imageUrl: d.imageUrl.trim() } : {}),
      ...(discountPct !== undefined ? { discountPercentage: discountPct } : {}),
    };
    setCreatingVariantForProductId(row.id);
    setError('');
    try {
      await variantService.createForProduct(row.id, payload);
      setNotice('Yeni variant əlavə olundu.');
      setNewVariantDraftByProductId((prev) => ({ ...prev, [row.id]: emptyVariantFormDraft() }));
      await hydrateExpanded(row.id, []);
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' &&
        e &&
        'response' in e &&
        (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(String(msg ?? (e as Error)?.message ?? 'Variant yaradıla bilmədi.'));
    } finally {
      setCreatingVariantForProductId(null);
    }
  };

  const saveProduct = async (row: ProductAdminRow) => {
    const d = productDraft[row.id];
    if (!d) return;
    const discountRaw = d.discountInput.trim();
    let discountNum: number | undefined;
    if (discountRaw === '') discountNum = 0;
    else {
      const n = Number(discountRaw);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        setError('Endirim 0–100 arası olmalıdır.');
        return;
      }
      discountNum = n;
    }
    setSavingProductId(row.id);
    setError('');
    try {
      const ptUpper = normalizedProductTypeCode(d.productType);
      const patchBody: Record<string, unknown> = {
        productName: d.productName.trim(),
        isSingle: d.isSingle,
        discountPercentage: discountNum,
      };
      if (ptUpper) patchBody.productType = ptUpper;
      let updatedProduct;
      if (d.mainImageFile) {
        updatedProduct = await productService.update(row.id, patchBody, [d.mainImageFile]);
      } else {
        updatedProduct = await productService.patchFields(row.id, patchBody);
      }

      const returned = updatedProduct?.data ?? updatedProduct;
      const returnedImgUrl = returned?.mainImageUrl ?? returned?.imageUrl ?? returned?.main_image_url;

      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? {
                ...r,
                productName: d.productName.trim(),
                productType: ptUpper,
                isSingle: d.isSingle,
                discountPercentage: discountNum ?? null,
                mainImageUrl: returnedImgUrl ? normalizeImageUrl(returnedImgUrl) : r.mainImageUrl,
              }
            : r
        )
      );
      setNotice('Məhsul yeniləndi.');
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' &&
        e &&
        'response' in e &&
        (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(String(msg ?? (e as Error)?.message ?? 'Məhsul saxlanmadı.'));
    } finally {
      setSavingProductId(null);
    }
  };

  const deleteProduct = async (row: ProductAdminRow) => {
    const ok = window.confirm(
      `«${row.productName}» (#${row.id}) silinsin? Bütün variantlar da silinəcək. Bu əməliyyat geri alınmaz.\n\n` +
        'DELETE /api/product/{id}'
    );
    if (!ok) return;
    setDeletingProductId(row.id);
    setError('');
    try {
      await productService.remove(row.id);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      if (expandedId === row.id) setExpandedId(null);
      setVariantDraft((prev) => {
        const next = { ...prev };
        for (const v of row.variants) delete next[v.id];
        return next;
      });
      setNewVariantDraftByProductId((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      setNotice('Məhsul silindi.');
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' &&
        e &&
        'response' in e &&
        (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(String(msg ?? (e as Error)?.message ?? 'Məhsul silinmədi.'));
    } finally {
      setDeletingProductId(null);
    }
  };

  const deleteVariant = async (row: ProductAdminRow, variant: VariantRow) => {
    const ok = window.confirm(
      `Variant #${variant.id} məhsul «${row.productName}» üzrə silinsin?\n\n` +
        'Əvvəl DELETE /api/variant/{id} yoxlanılır; yoxdursa məhsul PATCH ilə qalan variantlar göndərilir.'
    );
    if (!ok) return;
    setDeletingVariantId(variant.id);
    setError('');
    try {
      let usedDelete = false;
      try {
        await variantService.remove(variant.id);
        usedDelete = true;
      } catch (e: unknown) {
        const st =
          typeof e === 'object' && e && 'response' in e
            ? Number((e as { response?: { status?: number } }).response?.status)
            : 0;
        if (st !== 404 && st !== 405) throw e;
      }
      if (!usedDelete) {
        const nextVariants = buildProductVariantsAfterRemoval(row, variant.id, variantDraft);
        await productService.patchFields(row.id, { productVariants: nextVariants });
      }
      setVariantDraft((prev) => {
        const next = { ...prev };
        delete next[variant.id];
        return next;
      });
      await hydrateExpanded(row.id, []);
      setNotice('Variant silindi.');
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' &&
        e &&
        'response' in e &&
        (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(String(msg ?? (e as Error)?.message ?? 'Variant silinmədi.'));
    } finally {
      setDeletingVariantId(null);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.productName.trim()) {
      setError('Məhsul adı daxil edilməlidir.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload = {
        product: {
          productName: newProduct.productName.trim(),
          description: newProduct.description.trim(),
          productType: newProduct.productType,
          productCategoryId: newProduct.categoryId,
          isSingle: newProduct.isSingle,
          discountPercentage: newProduct.discountPercentage,
        },
        images: newProductImage ? [newProductImage] : undefined,
      };
      await productService.create(payload);
      setNotice('Məhsul uğurla yaradıldı.');
      setShowAddProductModal(false);
      // Reset form
      setNewProduct({
        productName: '',
        description: '',
        productType: 'FLOWER',
        isSingle: false,
        discountPercentage: 0,
        categoryId: categories[0]?.id || 1,
      });
      setNewProductImage(null);
      setNewProductImagePreview('');
      void loadPage(0);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Məhsul yaradıla bilmədi.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const saveVariant = async (productId: number, v: VariantRow) => {
    const d = variantDraft[v.id] ?? seedVariantDraftFromRow(v);
    const price = Number(String(d.price).replace(',', '.'));
    if (!Number.isFinite(price) || price <= 0) {
      setError('Variant qiyməti düzgün ədəd olmalıdır.');
      return;
    }
    let discountPayload: number | undefined;
    const dr = d.discountInput.trim();
    if (dr !== '') {
      const dn = Number(dr);
      if (!Number.isFinite(dn) || dn < 0 || dn > 100) {
        setError('Variant endirimi 0–100 arası olmalıdır.');
        return;
      }
      discountPayload = dn;
    }
    const imageFile = variantDataUrlToImageFile(d.imageUrl.trim());
    const variantJson: Record<string, unknown> = { price };
    if (d.variantName.trim()) variantJson.variantName = d.variantName.trim();
    if (d.size.trim()) variantJson.size = d.size.trim().toUpperCase();
    if (d.color.trim()) variantJson.color = d.color.trim().toUpperCase();
    if (discountPayload !== undefined) variantJson.discountPercentage = discountPayload;

    const payload: Partial<ProductVariantAdmin> & { price: number } = {
      price,
      variantName: d.variantName.trim() || undefined,
      size: d.size.trim().toUpperCase() || undefined,
      color: d.color.trim().toUpperCase() || undefined,
      imageUrl: d.imageUrl.trim() || undefined,
    };
    if (discountPayload !== undefined) payload.discountPercentage = discountPayload;

    setSavingVariantId(v.id);
    setError('');
    try {
      if (imageFile) {
        await variantService.updateMultipart(v.id, variantJson, imageFile);
      } else {
        await variantService.update(v.id, payload);
      }
      await hydrateExpanded(productId, []);
      setNotice('Variant yeniləndi.');
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' &&
        e &&
        'response' in e &&
        (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(String(msg ?? (e as Error)?.message ?? 'Variant saxlanmadı.'));
    } finally {
      setSavingVariantId(null);
    }
  };

  const totalLabel = useMemo(() => rows.length, [rows]);

  return (
    <div className="min-h-screen bg-[#fdfcf0] p-6 lg:p-8 dark:bg-background-dark">
      <div className="rounded-2xl border border-floral-muted/10 bg-white p-5 dark:border-white/10 dark:bg-white/5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-2xl font-black">Məhsullar</h2>
              <p className="text-xs text-floral-muted dark:text-white/50">
                Hər məhsulu açıb mövcud variantı <strong className="text-floral-deep dark:text-primary">Variant saxla</strong> ilə
                yeniləyə və ya aşağıdakı formdan{' '}
                <strong className="text-floral-deep dark:text-primary">Variant yarat</strong> ilə yenisini əlavə edə bilərsiniz.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {notice ? (
              <span className="rounded-lg bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/35 dark:text-emerald-300">
                {notice}
              </span>
            ) : null}
            <span className="rounded-lg bg-primary/15 px-3 py-1 text-xs font-black text-primary">
              Cədvəldə: {totalLabel}
            </span>
            <button
              type="button"
              onClick={refreshCurrent}
              disabled={loading}
              className="rounded-lg border border-floral-muted/20 px-3 py-1.5 text-xs font-bold hover:bg-primary/10 disabled:opacity-50 dark:border-white/15"
            >
              Yenilə
            </button>
            <button
              type="button"
              onClick={() => setShowAddProductModal(true)}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-black text-black hover:opacity-90 transition-opacity"
            >
              <Plus className="h-3.5 w-3.5" />
              Yeni Məhsul
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-floral-muted dark:text-white/60">
            <Loader2 className="h-4 w-4 animate-spin" /> Yüklənir...
          </div>
        ) : error && !rows.length ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-sm text-floral-muted">Məhsul yoxdur.</p>
        ) : (
          <>
            {error ? (
              <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
                {error}
              </div>
            ) : null}
            <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-white/10">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-black uppercase tracking-wide text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-white/55">
                  <tr>
                    <th className="px-3 py-3 pl-4">Şəkil</th>
                    <th className="px-3 py-3">ID</th>
                    <th className="min-w-[140px] px-3 py-3">Ad</th>
                    <th className="px-3 py-3">Növ (type)</th>
                    <th className="px-3 py-3">Single</th>
                    <th className="min-w-[200px] px-3 py-3">Variantlar</th>
                    <th className="px-3 py-3">Endirim %</th>
                    <th className="px-3 py-3 pr-4 text-right">Əsas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                  {rows.map((row) => (
                    <Fragment key={row.id}>
                      <tr className="align-top bg-white dark:bg-transparent">
                        <td className="px-3 py-3 pl-4">
                          <Thumb src={row.mainImageUrl} alt={row.productName} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 font-mono font-bold">#{row.id}</td>
                        <td className="px-3 py-3 font-semibold">{row.productName}</td>
                        <td
                          className="px-3 py-3 text-xs font-mono uppercase"
                          title={ADMIN_PRODUCT_TYPE_OPTIONS.find((o) => o.value === normalizedProductTypeCode(row.productType))?.label}
                        >
                          {formatProductTypeForTable(row.productType)}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                              row.isSingle
                                ? 'bg-primary/15 text-primary'
                                : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-white/70'
                            }`}
                          >
                            {row.isSingle ? 'Tək (single)' : 'Çox variant'}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {row.variants.length === 0 ? (
                            <span className="text-xs text-slate-500">—</span>
                          ) : (
                            <ul className="max-h-28 space-y-1 overflow-y-auto text-[11px]">
                              {row.variants.slice(0, 4).map((v) => (
                                <li key={v.id} className="flex items-center gap-2">
                                  <Thumb src={v.imageUrl} alt="" className="h-8 w-8 rounded" />
                                  <span className="min-w-0 truncate">
                                    {[v.variantName, v.size, v.color].filter(Boolean).join(' · ') || `#${v.id}`}{' '}
                                    · <strong>{Number.isFinite(v.price) ? `${v.price} ₼` : '—'}</strong>
                                  </span>
                                </li>
                              ))}
                              {row.variants.length > 4 ? (
                                <li className="text-slate-500">+{row.variants.length - 4} variant</li>
                              ) : null}
                            </ul>
                          )}
                        </td>
                        <td className="px-3 py-3">{row.discountPercentage != null ? `${row.discountPercentage}%` : '—'}</td>
                        <td className="px-3 py-3 pr-4 text-right">
                          <div className="inline-flex flex-wrap items-center justify-end gap-1">
                            <button
                              type="button"
                              title="Redaktə et"
                              onClick={() => void toggleExpand(row)}
                              className="inline-flex items-center gap-1 rounded-xl border border-floral-muted/25 px-3 py-1.5 text-xs font-black hover:bg-primary/10 dark:border-white/15"
                            >
                              <PencilLine className="h-3.5 w-3.5" />
                              {expandedId === row.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                            <button
                              type="button"
                              title="Məhsulu sil (DELETE /api/product/{id})"
                              disabled={loading || deletingProductId === row.id}
                              onClick={() => void deleteProduct(row)}
                              className="inline-flex items-center justify-center rounded-xl border border-red-200/90 p-2 text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40"
                            >
                              {deletingProductId === row.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === row.id ? (
                        <tr className="bg-slate-50/95 dark:bg-white/[0.03]">
                          <td className="px-4 pb-6 pt-0" colSpan={8}>
                            <div className="mt-4 space-y-5 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/40">
                              <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-white/45">
                                Məhsul parametrləri
                              </p>
                              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                <label className="block text-[11px] font-bold">
                                  Ad
                                  <input
                                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/15 dark:bg-background-dark"
                                    value={productDraft[row.id]?.productName ?? ''}
                                    onChange={(e) =>
                                      setProductDraft((prev) => ({
                                        ...prev,
                                        [row.id]: { ...(prev[row.id] as ProductFormDraft), productName: e.target.value },
                                      }))
                                    }
                                  />
                                </label>
                                <label className="block text-[11px] font-bold">
                                  Növ (productType)
                                  {(() => {
                                    const sel = normalizedProductTypeCode(productDraft[row.id]?.productType ?? '');
                                    const knownValues = new Set(ADMIN_PRODUCT_TYPE_OPTIONS.map((o) => o.value));
                                    const hasUnknownFromBackend = Boolean(sel && !knownValues.has(sel));
                                    return (
                                      <select
                                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold uppercase dark:border-white/15 dark:bg-background-dark dark:text-white"
                                        value={sel}
                                        onChange={(e) =>
                                          setProductDraft((prev) => ({
                                            ...prev,
                                            [row.id]: {
                                              ...(prev[row.id] as ProductFormDraft),
                                              productType: normalizedProductTypeCode(e.target.value),
                                            },
                                          }))
                                        }
                                      >
                                        <option value="">— Növ seçin —</option>
                                        {ADMIN_PRODUCT_TYPE_OPTIONS.map((opt) => (
                                          <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                          </option>
                                        ))}
                                        {hasUnknownFromBackend ? (
                                          <option value={sel}>
                                            {sel} — cari/backend dəyəri
                                          </option>
                                        ) : null}
                                      </select>
                                    );
                                  })()}
                                </label>
                                <label className="flex cursor-pointer items-center gap-3 pt-6 text-[11px] font-bold">
                                  <input
                                    type="checkbox"
                                    checked={productDraft[row.id]?.isSingle ?? false}
                                    onChange={(e) =>
                                      setProductDraft((prev) => ({
                                        ...prev,
                                        [row.id]: { ...(prev[row.id] as ProductFormDraft), isSingle: e.target.checked },
                                      }))
                                    }
                                    className="h-4 w-4 rounded border-slate-300"
                                  />
                                  Tək məhsul (single)
                                </label>
                                <label className="block text-[11px] font-bold">
                                  Endirim % (ümumi)
                                  <input
                                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/15 dark:bg-background-dark"
                                    value={productDraft[row.id]?.discountInput ?? ''}
                                    onChange={(e) =>
                                      setProductDraft((prev) => ({
                                        ...prev,
                                        [row.id]: {
                                          ...(prev[row.id] as ProductFormDraft),
                                          discountInput: e.target.value.replace(/[^\d.]/g, ''),
                                        },
                                      }))
                                    }
                                    placeholder="0"
                                  />
                                </label>
                                <div className="block text-[11px] font-bold">
                                  Əsas Şəkil
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="mt-1 block w-full text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-primary file:px-2 file:py-1 file:text-black file:font-semibold"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      const reader = new FileReader();
                                      reader.onloadend = () => {
                                        setProductDraft((prev) => ({
                                          ...prev,
                                          [row.id]: {
                                            ...(prev[row.id] as ProductFormDraft),
                                            mainImageFile: file,
                                            mainImagePreview: reader.result as string,
                                          },
                                        }));
                                      };
                                      reader.readAsDataURL(file);
                                    }}
                                  />
                                  {(productDraft[row.id]?.mainImagePreview || row.mainImageUrl) && (
                                    <div className="mt-2 h-16 w-16 rounded-lg overflow-hidden border border-slate-200">
                                      <img 
                                        src={productDraft[row.id]?.mainImagePreview || row.mainImageUrl} 
                                        alt="Preview" 
                                        className="h-full w-full object-cover" 
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={savingProductId === row.id}
                                onClick={() => void saveProduct(row)}
                                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-black text-black hover:opacity-90 disabled:opacity-50"
                              >
                                {savingProductId === row.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Save className="h-4 w-4" />
                                )}
                                Məhsulu saxla
                              </button>

                              <hr className="border-slate-200 dark:border-white/10" />
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-white/45">
                                    Variantlar — yenilə və ya əlavə et
                                  </p>
                                  {variantsLoading === row.id ? (
                                    <span className="flex items-center gap-1 text-xs text-slate-500">
                                      <Loader2 className="h-4 w-4 animate-spin" /> Yüklənir...
                                    </span>
                                  ) : null}
                                </div>
                                <p className="text-[11px] leading-relaxed text-slate-600 dark:text-white/50">
                                  <strong className="text-floral-deep dark:text-white">Update:</strong> aşağıdakı mövcud kartlarda sahələri dəyişin
                                  və həmin sətirin <span className="font-bold">«Variant saxla»</span> düyməsinə basın (
                                  <span className="font-mono text-[10px]">PATCH /api/variant/id</span>
                                  və ya yüklənmiş şəkil üçün <span className="font-mono text-[10px]">…/multipart</span>).
                                  <span className="mx-1">·</span>
                                  <strong className="text-floral-deep dark:text-white">Əlavə:</strong> siyahının altındakı xəttli blokda formu doldurub{' '}
                                  <span className="font-bold">«Variant yarat»</span>.
                                </p>
                              </div>
                              {row.variants.length === 0 ? (
                                <p className="mt-4 text-sm text-slate-500">
                                  Bu məhsulda variant yoxdur. Aşağıdan yenisini yaradın.
                                </p>
                              ) : (
                                <div className="space-y-4">
                                  {row.variants.map((v) => {
                                    const vd = variantDraft[v.id] ?? seedVariantDraftFromRow(v);
                                    const seed = () => seedVariantDraftFromRow(v);
                                    return (
                                      <div
                                        key={`${row.id}-var-${v.id}`}
                                        className="rounded-2xl border border-slate-200/90 p-3 dark:border-white/10"
                                      >
                                        <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2 text-[11px] dark:border-white/10">
                                          <span className="rounded-md bg-primary/15 px-2 py-0.5 font-black text-primary">
                                            Variant #{v.id}
                                          </span>
                                          <span className="text-slate-600 dark:text-white/55">
                                            Sahələri yeniləyin və <strong className="text-floral-deep dark:text-white">Variant saxla</strong>
                                          </span>
                                          <button
                                            type="button"
                                            title="Variantı sil (DELETE və ya PATCH productVariants)"
                                            disabled={
                                              deletingVariantId === v.id ||
                                              savingVariantId === v.id ||
                                              variantsLoading === row.id ||
                                              creatingVariantForProductId === row.id
                                            }
                                            onClick={() => void deleteVariant(row, v)}
                                            className="ml-auto inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40"
                                          >
                                            {deletingVariantId === v.id ? (
                                              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                                            ) : (
                                              <Trash2 className="h-3.5 w-3.5 shrink-0" />
                                            )}
                                            Sil
                                          </button>
                                        </div>
                                        <div className="flex flex-wrap items-start gap-3">
                                          <Thumb
                                            src={normalizeImageUrl(String(vd?.imageUrl || v.imageUrl || '').trim())}
                                            alt=""
                                            className="h-16 w-16"
                                          />
                                          <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
                                            <label className="block text-[10px] font-bold">
                                              Qiymət (₼)
                                              <input
                                                className="mt-1 w-full rounded-xl border px-2 py-1.5 text-sm dark:border-white/15 dark:bg-background-dark"
                                                value={vd?.price ?? ''}
                                                onChange={(e) =>
                                                  setVariantDraft((prev) => ({
                                                    ...prev,
                                                    [v.id]: { ...(prev[v.id] ?? seed()), price: e.target.value },
                                                  }))
                                                }
                                              />
                                            </label>
                                            <label className="block text-[10px] font-bold">
                                              Variant adı
                                              <input
                                                className="mt-1 w-full rounded-xl border px-2 py-1.5 dark:border-white/15 dark:bg-background-dark"
                                                value={vd?.variantName ?? ''}
                                                onChange={(e) =>
                                                  setVariantDraft((prev) => ({
                                                    ...prev,
                                                    [v.id]: { ...(prev[v.id] ?? seed()), variantName: e.target.value },
                                                  }))
                                                }
                                              />
                                            </label>
                                            <label className="block text-[10px] font-bold">
                                              Ölçü
                                              <input
                                                className="mt-1 w-full rounded-xl border px-2 py-1.5 dark:border-white/15 dark:bg-background-dark"
                                                value={vd?.size ?? ''}
                                                onChange={(e) =>
                                                  setVariantDraft((prev) => ({
                                                    ...prev,
                                                    [v.id]: { ...(prev[v.id] ?? seed()), size: e.target.value },
                                                  }))
                                                }
                                              />
                                            </label>
                                            <label className="block text-[10px] font-bold">
                                              Rəng
                                              <input
                                                className="mt-1 w-full rounded-xl border px-2 py-1.5 dark:border-white/15 dark:bg-background-dark"
                                                value={vd?.color ?? ''}
                                                onChange={(e) =>
                                                  setVariantDraft((prev) => ({
                                                    ...prev,
                                                    [v.id]: { ...(prev[v.id] ?? seed()), color: e.target.value },
                                                  }))
                                                }
                                              />
                                            </label>
                                            <label className="block text-[10px] font-bold">
                                              Şəkil URL
                                              <input
                                                className="mt-1 w-full rounded-xl border px-2 py-1.5 text-xs dark:border-white/15 dark:bg-background-dark"
                                                value={vd?.imageUrl ?? ''}
                                                onChange={(e) =>
                                                  setVariantDraft((prev) => ({
                                                    ...prev,
                                                    [v.id]: { ...(prev[v.id] ?? seed()), imageUrl: e.target.value },
                                                  }))
                                                }
                                                placeholder="https://..."
                                              />
                                            </label>
                                            <label className="block text-[10px] font-bold sm:col-span-2 lg:col-span-1">
                                              Endirim % (variant)
                                              <input
                                                className="mt-1 w-full rounded-xl border px-2 py-1.5 dark:border-white/15 dark:bg-background-dark"
                                                value={vd?.discountInput ?? ''}
                                                onChange={(e) =>
                                                  setVariantDraft((prev) => ({
                                                    ...prev,
                                                    [v.id]: {
                                                      ...(prev[v.id] ?? seed()),
                                                      discountInput: e.target.value.replace(/[^\d.]/g, ''),
                                                    },
                                                  }))
                                                }
                                                placeholder="Boş — ümumi"
                                              />
                                            </label>
                                            <div className="flex flex-col text-[10px] font-bold sm:col-span-2 lg:col-span-1">
                                              Şəkil faylı (update)
                                              <input
                                                type="file"
                                                accept="image/*"
                                                className="mt-1 block w-full text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-primary file:px-2 file:py-1 file:text-black"
                                                onChange={(e) => {
                                                  const file = e.target.files?.[0];
                                                  if (!file) return;
                                                  const reader = new FileReader();
                                                  reader.onloadend = () => {
                                                    const dataUrl = typeof reader.result === 'string' ? reader.result : '';
                                                    setVariantDraft((prev) => ({
                                                      ...prev,
                                                      [v.id]: { ...(prev[v.id] ?? seed()), imageUrl: dataUrl },
                                                    }));
                                                  };
                                                  reader.readAsDataURL(file);
                                                }}
                                              />
                                            </div>
                                          </div>
                                          <button
                                            type="button"
                                            disabled={savingVariantId === v.id}
                                            onClick={() => void saveVariant(row.id, v)}
                                            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50 dark:bg-primary dark:text-black"
                                          >
                                            {savingVariantId === v.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Variant saxla'}
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              <div className="mt-6 rounded-2xl border-2 border-dashed border-primary/35 bg-primary/5 p-4 dark:border-primary/45 dark:bg-primary/10">
                                <div className="mb-3 flex flex-wrap items-center gap-2">
                                  <Plus className="h-5 w-5 shrink-0 text-primary" />
                                  <p className="text-sm font-black text-floral-deep dark:text-white">
                                    Yeni variant əlavə et
                                  </p>
                                  <span className="text-[11px] text-slate-600 dark:text-white/55">
                                    Qiymət mütləqdir; şəkil üçün URL və ya fayl.
                                  </span>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                                  <label className="block text-[10px] font-bold lg:col-span-1">
                                    Qiymət (₼) *
                                    <input
                                      className="mt-1 w-full rounded-xl border px-2 py-1.5 text-sm dark:border-white/15 dark:bg-background-dark"
                                      value={newVariantDraftByProductId[row.id]?.price ?? ''}
                                      onChange={(e) =>
                                        setNewVariantDraftByProductId((prev) => ({
                                          ...prev,
                                          [row.id]: {
                                            ...(prev[row.id] ?? emptyVariantFormDraft()),
                                            price: e.target.value,
                                          },
                                        }))
                                      }
                                      placeholder="0.00"
                                    />
                                  </label>
                                  <label className="block text-[10px] font-bold">
                                    Variant adı
                                    <input
                                      className="mt-1 w-full rounded-xl border px-2 py-1.5 dark:border-white/15 dark:bg-background-dark"
                                      value={newVariantDraftByProductId[row.id]?.variantName ?? ''}
                                      onChange={(e) =>
                                        setNewVariantDraftByProductId((prev) => ({
                                          ...prev,
                                          [row.id]: {
                                            ...(prev[row.id] ?? emptyVariantFormDraft()),
                                            variantName: e.target.value,
                                          },
                                        }))
                                      }
                                    />
                                  </label>
                                  <label className="block text-[10px] font-bold">
                                    Ölçü
                                    <input
                                      className="mt-1 w-full rounded-xl border px-2 py-1.5 dark:border-white/15 dark:bg-background-dark"
                                      value={newVariantDraftByProductId[row.id]?.size ?? ''}
                                      onChange={(e) =>
                                        setNewVariantDraftByProductId((prev) => ({
                                          ...prev,
                                          [row.id]: {
                                            ...(prev[row.id] ?? emptyVariantFormDraft()),
                                            size: e.target.value,
                                          },
                                        }))
                                      }
                                    />
                                  </label>
                                  <label className="block text-[10px] font-bold">
                                    Rəng
                                    <input
                                      className="mt-1 w-full rounded-xl border px-2 py-1.5 dark:border-white/15 dark:bg-background-dark"
                                      value={newVariantDraftByProductId[row.id]?.color ?? ''}
                                      onChange={(e) =>
                                        setNewVariantDraftByProductId((prev) => ({
                                          ...prev,
                                          [row.id]: {
                                            ...(prev[row.id] ?? emptyVariantFormDraft()),
                                            color: e.target.value,
                                          },
                                        }))
                                      }
                                    />
                                  </label>
                                  <label className="block text-[10px] font-bold lg:col-span-2">
                                    Şəkil URL
                                    <input
                                      className="mt-1 w-full rounded-xl border px-2 py-1.5 text-xs dark:border-white/15 dark:bg-background-dark"
                                      value={newVariantDraftByProductId[row.id]?.imageUrl ?? ''}
                                      onChange={(e) =>
                                        setNewVariantDraftByProductId((prev) => ({
                                          ...prev,
                                          [row.id]: {
                                            ...(prev[row.id] ?? emptyVariantFormDraft()),
                                            imageUrl: e.target.value,
                                          },
                                        }))
                                      }
                                      placeholder="https://..."
                                    />
                                  </label>
                                  <label className="block text-[10px] font-bold">
                                    Endirim %
                                    <input
                                      className="mt-1 w-full rounded-xl border px-2 py-1.5 dark:border-white/15 dark:bg-background-dark"
                                      value={newVariantDraftByProductId[row.id]?.discountInput ?? ''}
                                      onChange={(e) =>
                                        setNewVariantDraftByProductId((prev) => ({
                                          ...prev,
                                          [row.id]: {
                                            ...(prev[row.id] ?? emptyVariantFormDraft()),
                                            discountInput: e.target.value.replace(/[^\d.]/g, ''),
                                          },
                                        }))
                                      }
                                      placeholder="Opsional"
                                    />
                                  </label>
                                  <div className="flex flex-col text-[10px] font-bold sm:col-span-2 lg:col-span-1">
                                    Şəkil faylı
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="mt-1 block w-full text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-primary file:px-2 file:py-1 file:text-black"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        const reader = new FileReader();
                                        reader.onloadend = () => {
                                          const dataUrl = typeof reader.result === 'string' ? reader.result : '';
                                          setNewVariantDraftByProductId((prev) => ({
                                            ...prev,
                                            [row.id]: {
                                              ...(prev[row.id] ?? emptyVariantFormDraft()),
                                              imageUrl: dataUrl,
                                            },
                                          }));
                                        };
                                        reader.readAsDataURL(file);
                                      }}
                                    />
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  disabled={creatingVariantForProductId === row.id || variantsLoading === row.id}
                                  onClick={() => void createVariant(row)}
                                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-black hover:opacity-90 disabled:opacity-50"
                                >
                                  {creatingVariantForProductId === row.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Plus className="h-4 w-4" />
                                  )}
                                  Variant yarat
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-floral-muted dark:text-white/50">
                Səhifə {page + 1} / {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={loading || page <= 0}
                  onClick={() => {
                    const n = page - 1;
                    setPage(n);
                    void loadPage(n);
                  }}
                  className="inline-flex items-center gap-1 rounded-xl border border-floral-muted/20 px-3 py-2 text-xs font-bold disabled:opacity-40 dark:border-white/15"
                >
                  <ChevronLeft className="h-4 w-4" /> Əvvəlki
                </button>
                <button
                  type="button"
                  disabled={loading || page >= totalPages - 1}
                  onClick={() => {
                    const n = page + 1;
                    setPage(n);
                    void loadPage(n);
                  }}
                  className="inline-flex items-center gap-1 rounded-xl border border-floral-muted/20 px-3 py-2 text-xs font-bold disabled:opacity-40 dark:border-white/15"
                >
                  Növbəti <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
        {/* Yeni məhsul yaratmaq üçün Modal */}
        {showAddProductModal && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center">
            <div className="w-full max-w-lg rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 md:p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-black uppercase tracking-wider text-black dark:text-white">
                  Yeni Məhsul Yarat
                </h3>
                <button
                  className="size-8 rounded-lg border border-slate-200 dark:border-white/10 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-black dark:text-white"
                  onClick={() => setShowAddProductModal(false)}
                >
                  <X className="size-4" />
                </button>
              </div>

              <form onSubmit={handleCreateProduct} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Məhsulun Adı</label>
                  <input
                    type="text"
                    required
                    value={newProduct.productName}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, productName: e.target.value }))}
                    placeholder="Məs. Qırmızı qızılgüllər"
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 text-sm bg-transparent outline-none focus:border-primary text-black dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Təsvir / Açıqlama</label>
                  <textarea
                    value={newProduct.description}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Məhsul haqqında qısa məlumat..."
                    className="w-full min-h-16 rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 text-sm bg-transparent outline-none focus:border-primary text-black dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Məhsul Növü</label>
                    <select
                      value={newProduct.productType}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, productType: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-white dark:border-white/10 px-3 py-2 text-sm bg-transparent outline-none focus:border-primary text-black dark:text-white dark:bg-slate-900"
                    >
                      {ADMIN_PRODUCT_TYPE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Kateqoriya</label>
                    <select
                      value={newProduct.categoryId}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, categoryId: Number(e.target.value) }))}
                      className="w-full rounded-xl border border-slate-200 bg-white dark:border-white/10 px-3 py-2 text-sm bg-transparent outline-none focus:border-primary text-black dark:text-white dark:bg-slate-900"
                    >
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.title}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Endirim %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={newProduct.discountPercentage}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, discountPercentage: Number(e.target.value) }))}
                      className="w-full rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 text-sm bg-transparent outline-none focus:border-primary text-black dark:text-white"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-5">
                    <input
                      type="checkbox"
                      id="isSingleNew"
                      checked={newProduct.isSingle}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, isSingle: e.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <label htmlFor="isSingleNew" className="text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                      Tək məhsul (single)
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Əsas Şəkil</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setNewProductImage(file);
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setNewProductImagePreview(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      } else {
                        setNewProductImagePreview('');
                      }
                    }}
                    className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-black hover:file:opacity-90"
                  />
                  {newProductImagePreview && (
                    <div className="mt-2 h-24 w-24 rounded-lg overflow-hidden border border-slate-200">
                      <img src={newProductImagePreview} alt="Preview" className="h-full w-full object-cover" />
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAddProductModal(false)}
                    className="px-4 py-2 text-xs font-black rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 text-black dark:text-white"
                  >
                    Ləğv Et
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 text-xs font-black rounded-xl bg-primary text-black hover:opacity-90 disabled:opacity-50"
                  >
                    Məhsul Yarat
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
