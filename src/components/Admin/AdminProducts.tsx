import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Boxes, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  ImageIcon, Loader2, PencilLine, Plus, Save, Trash2, X,
} from "lucide-react";
import { productService, categoryService } from "../../services/api";

const API_BASE = String(
  (import.meta as any).env?.VITE_API_BASE_URL || ""
).trim();
const API_ORIGIN = (() => {
  if (!API_BASE) return "";
  try { return new URL(API_BASE, window.location.origin).origin; } catch { return ""; }
})();

function normalizeImageUrl(value?: string): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const fixed = raw.replace(/\\/g, "/");
  if (/^data:image\//i.test(fixed)) return fixed;
  if (/^https?:\/\//i.test(fixed)) return fixed;
  if (/^\/\//.test(fixed)) return `${window.location.protocol}${fixed}`;
  const path = fixed.startsWith("/") ? fixed : `/${fixed}`;
  if (API_ORIGIN) { try { return new URL(path, API_ORIGIN).toString(); } catch {/* */} }
  if (API_BASE) { try { return new URL(path, API_BASE).toString(); } catch {/* */} }
  return path;
}

const PRODUCT_TYPE_OPTIONS = [
  { value: "FLOWER", label: "FLOWER" },
  { value: "BOX", label: "BOX" },
  { value: "MATERIAL", label: "MATERIAL" },
  { value: "RIBBON", label: "RIBBON" },
  { value: "OBVIOUSLY", label: "OBVIOUSLY" },
] as const;

const COLOR_OPTIONS = ["RED","BLUE","GREEN","YELLOW","BLACK","WHITE","PINK","ORANGE","PURPLE","BROWN","CYAN","SILVER","GRAY","GOLD"];

type ProductRow = {
  id: number; productName: string; description: string; productType: string;
  active: boolean; featured: boolean; renderActive: boolean;
  birToyActive: boolean; aciqcaActive: boolean; isSingle: boolean;
  discountPercentage: number | null; price: number; color: string; mainImageUrl: string;
};

type ProductDraft = {
  productName: string; description: string; productType: string;
  priceInput: string; colorInput: string; discountInput: string;
  active: boolean; featured: boolean; renderActive: boolean;
  birToyActive: boolean; aciqcaActive: boolean;
  mainImageFile?: File; mainImagePreview?: string;
};

function readBool(p: Record<string, unknown>, ...keys: string[]): boolean {
  for (const k of keys) {
    const v = (p as any)[k];
    if (typeof v === "boolean") return v;
    if (v === 1 || v === "1" || String(v).toLowerCase() === "true") return true;
    if (v === 0 || v === "0" || String(v).toLowerCase() === "false") return false;
  }
  return false;
}

function normalizeRow(raw: unknown): ProductRow | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const id = Number((p as any).id ?? (p as any).productId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const productName = String((p as any).productName ?? (p as any).title ?? "").trim() || `Mehsul #${id}`;
  const imgs: { imageUrl?: string }[] = Array.isArray((p as any).images) ? ((p as any).images as any[]) : [];
  const mainImageUrl = normalizeImageUrl(imgs.find(i => i.imageUrl)?.imageUrl ?? String((p as any).mainImageUrl ?? ""));
  const disc = Number((p as any).discountPercentage ?? (p as any).discount_percentage);
  return {
    id, productName,
    description: String((p as any).description ?? ""),
    productType: String((p as any).productType ?? "").toUpperCase(),
    active: readBool(p, "active"),
    featured: readBool(p, "featured"),
    renderActive: "renderActive" in p ? readBool(p, "renderActive") : true,
    birToyActive: readBool(p, "birToyActive", "bir_toy_active"),
    aciqcaActive: readBool(p, "aciqcaActive", "aciqca_active"),
    isSingle: readBool(p, "isSingle", "is_single", "single"),
    discountPercentage: Number.isFinite(disc) ? Math.min(100, Math.max(0, disc)) : null,
    price: Number((p as any).price ?? 0),
    color: String((p as any).color ?? "").toUpperCase(),
    mainImageUrl,
  };
}

function seedDraft(row: ProductRow): ProductDraft {
  return {
    productName: row.productName, description: row.description,
    productType: row.productType, priceInput: String(row.price ?? ""),
    colorInput: row.color,
    discountInput: row.discountPercentage != null ? String(row.discountPercentage) : "",
    active: row.active, featured: row.featured, renderActive: row.renderActive,
    birToyActive: row.birToyActive, aciqcaActive: row.aciqcaActive,
    mainImagePreview: row.mainImageUrl || "",
  };
}

function Thumb({ src, alt, className = "h-12 w-12" }: { src: string; alt: string; className?: string }) {
  const box = `shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-white/10 ${className}`;
  if (!src) return <div className={`flex items-center justify-center text-slate-400 ${box}`}><ImageIcon className="h-5 w-5" /></div>;
  return <div className={box}><img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" /></div>;
}

function Toggle({ checked, onChange, disabled, label, color = "primary" }: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string;
  color?: "primary" | "blue" | "purple" | "orange";
}) {
  const bg = { primary: "bg-primary", blue: "bg-blue-500", purple: "bg-purple-500", orange: "bg-orange-500" }[color];
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${checked ? bg : "bg-slate-200 dark:bg-white/15"}`}>
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

const TOGGLE_FIELDS: Array<{
  field: "active"|"featured"|"renderActive"|"birToyActive"|"aciqcaActive";
  label: string; color: "primary"|"blue"|"purple"|"orange";
}> = [
  { field: "active", label: "Umumi Aktiv", color: "primary" },
  { field: "renderActive", label: "Render Aktiv", color: "blue" },
  { field: "birToyActive", label: "Bir-Toy Aktiv", color: "purple" },
  { field: "aciqcaActive", label: "Aciqca Aktiv", color: "orange" },
  { field: "featured", label: "One Cixan", color: "primary" },
];

export default function AdminProducts() {
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, ProductDraft>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [newProduct, setNewProduct] = useState({
    productName: "", description: "", productType: "FLOWER",
    isSingle: false, active: true, featured: false, renderActive: true,
    birToyActive: false, aciqcaActive: false, discountPercentage: 0,
    price: 0, color: "RED", categoryId: 1,
  });
  const [newImage, setNewImage] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState("");
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(""), 2500);
    return () => window.clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    categoryService.getAll().then(res => {
      if (res?.success && Array.isArray(res.data)) {
        setCategories(res.data);
        if (res.data.length > 0) setNewProduct(prev => ({ ...prev, categoryId: res.data[0].id }));
      }
    }).catch(() => {});
  }, []);

  const loadPage = useCallback(async (nextPage: number) => {
    setLoading(true); setError("");
    try {
      const res = await productService.listForAdmin({ page: nextPage, size: 20 });
      const content = Array.isArray(res?.data) ? res.data : [];
      const parsed = content.map(normalizeRow).filter((x): x is ProductRow => x != null);
      setRows(parsed);
      setPage(Number(res.page ?? nextPage));
      setTotalPages(Math.max(1, Number(res.totalPages ?? 1)));
      setDrafts(prev => {
        const next = { ...prev };
        for (const r of parsed) { if (!next[r.id]) next[r.id] = seedDraft(r); }
        return next;
      });
    } catch (e: unknown) {
      setRows([]);
      setError(String((e as any)?.response?.data?.message ?? (e as Error)?.message ?? "Mehsullar yuklenhmedi."));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadPage(0); }, []);

  const toggleField = async (
    row: ProductRow,
    field: "active" | "featured" | "renderActive" | "birToyActive" | "aciqcaActive"
  ) => {
    const newVal = !row[field];
    setTogglingId(row.id);
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, [field]: newVal } : r));
    setDrafts(prev => ({ ...prev, [row.id]: { ...(prev[row.id] ?? seedDraft(row)), [field]: newVal } }));
    try {
      await productService.patchFields(row.id, { [field]: newVal });
      setNotice("Yenilendi.");
    } catch (e: unknown) {
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, [field]: !newVal } : r));
      setError(String((e as any)?.response?.data?.message ?? (e as Error)?.message ?? "Xeta."));
    } finally { setTogglingId(null); }
  };

  const toggleExpand = (row: ProductRow) => {
    if (expandedId === row.id) { setExpandedId(null); }
    else {
      setExpandedId(row.id);
      setDrafts(prev => ({ ...prev, [row.id]: prev[row.id] ?? seedDraft(row) }));
    }
  };

  const saveProduct = async (row: ProductRow) => {
    const d = drafts[row.id]; if (!d) return;
    const price = Number(String(d.priceInput).replace(",", "."));
    if (!Number.isFinite(price) || price < 0) { setError("Qiymet duzgun deyil."); return; }
    const discRaw = d.discountInput.trim();
    let discount = 0;
    if (discRaw !== "") {
      const dn = Number(discRaw);
      if (!Number.isFinite(dn) || dn < 0 || dn > 100) { setError("Endirim 0-100 arasi olmalidir."); return; }
      discount = dn;
    }
    setSavingId(row.id); setError("");
    try {
      const patchBody: Record<string, unknown> = {
        productName: d.productName.trim(), description: d.description.trim(),
        price, color: d.colorInput.trim().toUpperCase(), discountPercentage: discount,
        active: d.active, featured: d.featured, renderActive: d.renderActive,
        birToyActive: d.birToyActive, aciqcaActive: d.aciqcaActive,
      };
      if (d.productType) patchBody.productType = d.productType;
      let updatedProduct: any;
      if (d.mainImageFile) {
        updatedProduct = await productService.update(row.id, patchBody, [d.mainImageFile]);
      } else {
        updatedProduct = await productService.patchFields(row.id, patchBody);
      }
      const returned = updatedProduct?.data ?? updatedProduct;
      const returnedImg = returned?.mainImageUrl ?? returned?.imageUrl;
      setRows(prev => prev.map(r => r.id === row.id ? {
        ...r, productName: d.productName.trim(), description: d.description.trim(),
        price, color: d.colorInput.trim().toUpperCase(), discountPercentage: discount,
        active: d.active, featured: d.featured, renderActive: d.renderActive,
        birToyActive: d.birToyActive, aciqcaActive: d.aciqcaActive,
        mainImageUrl: returnedImg ? normalizeImageUrl(returnedImg) : r.mainImageUrl,
      } : r));
      setNotice("Mehsul yenilendi.");
    } catch (e: unknown) {
      setError(String((e as any)?.response?.data?.message ?? (e as Error)?.message ?? "Mehsul saxlanmadi."));
    } finally { setSavingId(null); }
  };

  const deleteProduct = async (row: ProductRow) => {
    if (!window.confirm(`${row.productName} (#${row.id}) silinsin?`)) return;
    setDeletingId(row.id); setError("");
    try {
      await productService.remove(row.id);
      setRows(prev => prev.filter(r => r.id !== row.id));
      if (expandedId === row.id) setExpandedId(null);
      setNotice("Mehsul silindi.");
    } catch (e: unknown) {
      setError(String((e as any)?.response?.data?.message ?? (e as Error)?.message ?? "Mehsul silinmedi."));
    } finally { setDeletingId(null); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.productName.trim()) { setError("Mehsul adi daxil edilmelidir."); return; }
    setModalLoading(true); setError("");
    try {
      await productService.create({
        product: {
          productName: newProduct.productName.trim(), description: newProduct.description.trim(),
          productType: newProduct.productType, productCategoryId: newProduct.categoryId,
          isSingle: newProduct.isSingle, active: newProduct.active, featured: newProduct.featured,
          renderActive: newProduct.renderActive, birToyActive: newProduct.birToyActive,
          aciqcaActive: newProduct.aciqcaActive, discountPercentage: newProduct.discountPercentage,
          price: newProduct.price, color: newProduct.color || undefined,
        },
        images: newImage ? [newImage] : undefined,
      });
      setNotice("Mehsul ugurla yaradildi.");
      setShowModal(false);
      setNewProduct({ productName: "", description: "", productType: "FLOWER", isSingle: false,
        active: true, featured: false, renderActive: true, birToyActive: false, aciqcaActive: false,
        discountPercentage: 0, price: 0, color: "RED", categoryId: categories[0]?.id || 1 });
      setNewImage(null); setNewImagePreview("");
      void loadPage(0);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Mehsul yaradila bilmedi.");
    } finally { setModalLoading(false); }
  };

  const totalLabel = useMemo(() => rows.length, [rows]);

  return (
    <div className="min-h-screen bg-[#fdfcf0] p-4 lg:p-8 dark:bg-background-dark">
      <div className="rounded-2xl border border-floral-muted/10 bg-white p-5 dark:border-white/10 dark:bg-white/5">

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-2xl font-black">Mehsullar</h2>
              <p className="text-xs text-floral-muted dark:text-white/50">
                Setirdeki toggle-larla dehal deyisdirin &middot; Redakte ucun <strong>qelem</strong> duymeye basin
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {notice && <span className="rounded-lg bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/35 dark:text-emerald-300">{notice}</span>}
            <span className="rounded-lg bg-primary/15 px-3 py-1 text-xs font-black text-primary">Cedvelde: {totalLabel}</span>
            <button type="button" onClick={() => void loadPage(page)} disabled={loading}
              className="rounded-lg border border-floral-muted/20 px-3 py-1.5 text-xs font-bold hover:bg-primary/10 disabled:opacity-50 dark:border-white/15">
              Yenile
            </button>
            <button type="button" onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-black text-black hover:opacity-90 transition-opacity">
              <Plus className="h-3.5 w-3.5" /> Yeni Mehsul
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">{error}</div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-floral-muted dark:text-white/60">
            <Loader2 className="h-4 w-4 animate-spin" /> Yuklenir...
          </div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-sm text-floral-muted">Mehsul yoxdur.</p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-500 dark:text-white/40">
              <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-5 rounded-full bg-primary" /> Aktiv</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-5 rounded-full bg-blue-500" /> Render</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-5 rounded-full bg-purple-500" /> Bir-Toy</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-5 rounded-full bg-orange-500" /> Aciqca</span>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-white/10">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-black uppercase tracking-wide text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-white/55">
                  <tr>
                    <th className="px-3 py-3 pl-4">Sekil</th>
                    <th className="px-3 py-3">ID</th>
                    <th className="min-w-[150px] px-3 py-3">Ad</th>
                    <th className="px-3 py-3">Qiymet</th>
                    <th className="px-3 py-3">Endirim</th>
                    <th className="px-3 py-3 text-center">Aktiv</th>
                    <th className="px-3 py-3 text-center">Render</th>
                    <th className="px-3 py-3 text-center">Bir-Toy</th>
                    <th className="px-3 py-3 text-center">Aciqca</th>
                    <th className="px-3 py-3 pr-4 text-right">Emeliyyat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                  {rows.map(row => (
                    <React.Fragment key={row.id}>
                      <tr className={`align-middle bg-white dark:bg-transparent ${!row.active ? "opacity-60" : ""}`}>
                        <td className="px-3 py-2.5 pl-4"><Thumb src={row.mainImageUrl} alt={row.productName} /></td>
                        <td className="whitespace-nowrap px-3 py-2.5 font-mono font-bold text-xs text-slate-500">#{row.id}</td>
                        <td className="px-3 py-2.5">
                          <p className="font-semibold leading-snug">{row.productName}</p>
                          <p className="text-[11px] text-slate-400 dark:text-white/35">{row.productType || "\u2014"}</p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 font-semibold">{row.price > 0 ? `${row.price} \u20BC` : "\u2014"}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                          {row.discountPercentage != null
                            ? <span className="rounded-full bg-rose-50 px-2 py-0.5 font-bold text-rose-600 dark:bg-rose-900/30 dark:text-rose-300">-{row.discountPercentage}%</span>
                            : "\u2014"}
                        </td>
                        <td className="px-3 py-2.5 text-center"><div className="flex justify-center"><Toggle checked={row.active} onChange={() => void toggleField(row, "active")} disabled={togglingId === row.id} color="primary" /></div></td>
                        <td className="px-3 py-2.5 text-center"><div className="flex justify-center"><Toggle checked={row.renderActive} onChange={() => void toggleField(row, "renderActive")} disabled={togglingId === row.id} color="blue" /></div></td>
                        <td className="px-3 py-2.5 text-center"><div className="flex justify-center"><Toggle checked={row.birToyActive} onChange={() => void toggleField(row, "birToyActive")} disabled={togglingId === row.id} color="purple" /></div></td>
                        <td className="px-3 py-2.5 text-center"><div className="flex justify-center"><Toggle checked={row.aciqcaActive} onChange={() => void toggleField(row, "aciqcaActive")} disabled={togglingId === row.id} color="orange" /></div></td>
                        <td className="px-3 py-2.5 pr-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button type="button" onClick={() => toggleExpand(row)}
                              className="inline-flex items-center gap-1 rounded-xl border border-floral-muted/25 px-3 py-1.5 text-xs font-black hover:bg-primary/10 dark:border-white/15">
                              <PencilLine className="h-3.5 w-3.5" />
                              {expandedId === row.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </button>
                            <button type="button" disabled={deletingId === row.id} onClick={() => void deleteProduct(row)}
                              className="inline-flex items-center justify-center rounded-xl border border-red-200/90 p-2 text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-900/50 dark:text-red-400">
                              {deletingId === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === row.id && (
                        <tr className="bg-slate-50/95 dark:bg-white/[0.03]">
                          <td className="px-4 pb-6 pt-0" colSpan={10}>
                            <div className="mt-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-950/40">
                              <p className="mb-4 text-xs font-black uppercase tracking-wide text-slate-500 dark:text-white/45">Mehsulu redakte et</p>
                              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                <label className="block text-[11px] font-bold">
                                  Mehsulun adi
                                  <input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/15 dark:bg-background-dark"
                                    value={drafts[row.id]?.productName ?? ""}
                                    onChange={e => setDrafts(prev => ({ ...prev, [row.id]: { ...(prev[row.id] ?? seedDraft(row)), productName: e.target.value } }))} />
                                </label>
                                <label className="block text-[11px] font-bold">
                                  Qiymet
                                  <input type="number" min="0" step="0.01" placeholder="0.00"
                                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/15 dark:bg-background-dark"
                                    value={drafts[row.id]?.priceInput ?? ""}
                                    onChange={e => setDrafts(prev => ({ ...prev, [row.id]: { ...(prev[row.id] ?? seedDraft(row)), priceInput: e.target.value } }))} />
                                </label>
                                <label className="block text-[11px] font-bold">
                                  Endirim % (0-100)
                                  <input type="number" min="0" max="100" placeholder="0"
                                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/15 dark:bg-background-dark"
                                    value={drafts[row.id]?.discountInput ?? ""}
                                    onChange={e => setDrafts(prev => ({ ...prev, [row.id]: { ...(prev[row.id] ?? seedDraft(row)), discountInput: e.target.value.replace(/[^\d.]/g, "") } }))} />
                                </label>
                                <label className="block text-[11px] font-bold">
                                  Reng
                                  <select className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-background-dark dark:text-white"
                                    value={drafts[row.id]?.colorInput ?? ""}
                                    onChange={e => setDrafts(prev => ({ ...prev, [row.id]: { ...(prev[row.id] ?? seedDraft(row)), colorInput: e.target.value } }))}>
                                    <option value="">Secin</option>
                                    {COLOR_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                                  </select>
                                </label>
                                <label className="block text-[11px] font-bold">
                                  Nov
                                  <select className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-background-dark dark:text-white"
                                    value={drafts[row.id]?.productType ?? ""}
                                    onChange={e => setDrafts(prev => ({ ...prev, [row.id]: { ...(prev[row.id] ?? seedDraft(row)), productType: e.target.value } }))}>
                                    <option value="">Secin</option>
                                    {PRODUCT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                  </select>
                                </label>
                                <div className="block text-[11px] font-bold">
                                  Esas Sekil
                                  <input type="file" accept="image/*"
                                    className="mt-1 block w-full text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-primary file:px-2 file:py-1 file:text-black file:font-semibold"
                                    onChange={e => {
                                      const file = e.target.files?.[0]; if (!file) return;
                                      const reader = new FileReader();
                                      reader.onloadend = () => setDrafts(prev => ({ ...prev, [row.id]: { ...(prev[row.id] ?? seedDraft(row)), mainImageFile: file, mainImagePreview: reader.result as string } }));
                                      reader.readAsDataURL(file);
                                    }} />
                                  {(drafts[row.id]?.mainImagePreview || row.mainImageUrl) && (
                                    <div className="mt-2 h-16 w-16 overflow-hidden rounded-lg border border-slate-200">
                                      <img src={drafts[row.id]?.mainImagePreview || row.mainImageUrl} alt="Preview" className="h-full w-full object-cover" />
                                    </div>
                                  )}
                                </div>
                                <label className="block text-[11px] font-bold sm:col-span-2 lg:col-span-3">
                                  Tesvir / Acıqlama
                                  <textarea rows={3} placeholder="Mehsul haqqinda qisa melumat..."
                                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/15 dark:bg-background-dark"
                                    value={drafts[row.id]?.description ?? ""}
                                    onChange={e => setDrafts(prev => ({ ...prev, [row.id]: { ...(prev[row.id] ?? seedDraft(row)), description: e.target.value } }))} />
                                </label>
                              </div>
                              <div className="mt-4 flex flex-wrap gap-5">
                                {TOGGLE_FIELDS.map(({ field, label, color }) => (
                                  <label key={field} className="flex cursor-pointer items-center gap-2 select-none">
                                    <Toggle checked={Boolean(drafts[row.id]?.[field])}
                                      onChange={v => setDrafts(prev => ({ ...prev, [row.id]: { ...(prev[row.id] ?? seedDraft(row)), [field]: v } }))}
                                      color={color} label={label} />
                                    <span className="text-[11px] font-bold">{label}</span>
                                  </label>
                                ))}
                              </div>
                              <div className="mt-5 flex items-center gap-3">
                                <button type="button" disabled={savingId === row.id} onClick={() => void saveProduct(row)}
                                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-black text-black hover:opacity-90 disabled:opacity-50">
                                  {savingId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                  Mehsulu Saxla
                                </button>
                                <button type="button" onClick={() => setExpandedId(null)}
                                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold hover:bg-slate-50 dark:border-white/15 dark:hover:bg-white/5">
                                  Baglа
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-floral-muted dark:text-white/50">Sehife {page + 1} / {totalPages}</p>
              <div className="flex gap-2">
                <button type="button" disabled={loading || page <= 0}
                  onClick={() => { const n = page - 1; setPage(n); void loadPage(n); }}
                  className="inline-flex items-center gap-1 rounded-xl border border-floral-muted/20 px-3 py-2 text-xs font-bold disabled:opacity-40 dark:border-white/15">
                  <ChevronLeft className="h-4 w-4" /> Evvelki
                </button>
                <button type="button" disabled={loading || page >= totalPages - 1}
                  onClick={() => { const n = page + 1; setPage(n); void loadPage(n); }}
                  className="inline-flex items-center gap-1 rounded-xl border border-floral-muted/20 px-3 py-2 text-xs font-bold disabled:opacity-40 dark:border-white/15">
                  Novbeti <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}

        {showModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900 md:p-8" onClick={e => e.stopPropagation()}>
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-base font-black uppercase tracking-wider text-black dark:text-white">Yeni Mehsul Yarat</h3>
                <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-black transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-white dark:hover:bg-white/5" onClick={() => setShowModal(false)}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              <form onSubmit={handleCreate} className="max-h-[72vh] space-y-4 overflow-y-auto pr-1">
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Mehsulun Adi *</label>
                  <input required value={newProduct.productName} onChange={e => setNewProduct(prev => ({ ...prev, productName: e.target.value }))}
                    placeholder="Mes. Qirmizi qizilguller"
                    className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm text-black outline-none focus:border-primary dark:border-white/10 dark:text-white" />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Tesvir</label>
                  <textarea value={newProduct.description} onChange={e => setNewProduct(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Mehsul haqqinda qisa melumat..."
                    className="w-full min-h-16 rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm text-black outline-none focus:border-primary dark:border-white/10 dark:text-white" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Nov</label>
                    <select value={newProduct.productType} onChange={e => setNewProduct(prev => ({ ...prev, productType: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-black outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white">
                      {PRODUCT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Kateqoriya</label>
                    <select value={newProduct.categoryId} onChange={e => setNewProduct(prev => ({ ...prev, categoryId: Number(e.target.value) }))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-black outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white">
                      {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.title}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Qiymet</label>
                    <input type="number" min="0" step="0.01" value={newProduct.price}
                      onChange={e => setNewProduct(prev => ({ ...prev, price: Number(e.target.value) }))}
                      className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm text-black outline-none dark:border-white/10 dark:text-white" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Endirim %</label>
                    <input type="number" min="0" max="100" value={newProduct.discountPercentage}
                      onChange={e => setNewProduct(prev => ({ ...prev, discountPercentage: Number(e.target.value) }))}
                      className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm text-black outline-none dark:border-white/10 dark:text-white" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Reng</label>
                  <select value={newProduct.color} onChange={e => setNewProduct(prev => ({ ...prev, color: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-black outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white">
                    {COLOR_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Esas Sekil</label>
                  <input type="file" accept="image/*"
                    onChange={e => {
                      const file = e.target.files?.[0] || null; setNewImage(file);
                      if (file) { const reader = new FileReader(); reader.onloadend = () => setNewImagePreview(reader.result as string); reader.readAsDataURL(file); }
                      else setNewImagePreview("");
                    }}
                    className="w-full text-xs text-slate-500 file:mr-4 file:rounded-xl file:border-0 file:bg-primary file:px-4 file:py-2 file:text-xs file:font-semibold file:text-black hover:file:opacity-90" />
                  {newImagePreview && <div className="mt-2 h-20 w-20 overflow-hidden rounded-lg border border-slate-200"><img src={newImagePreview} alt="Preview" className="h-full w-full object-cover" /></div>}
                </div>
                <div className="rounded-xl border border-slate-100 p-4 dark:border-white/10">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-wider text-slate-400">Gorunurluk</p>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { field: "active" as const, label: "Umumi Aktiv", color: "primary" as const },
                      { field: "renderActive" as const, label: "Render Aktiv", color: "blue" as const },
                      { field: "birToyActive" as const, label: "Bir-Toy Aktiv", color: "purple" as const },
                      { field: "aciqcaActive" as const, label: "Aciqca Aktiv", color: "orange" as const },
                      { field: "featured" as const, label: "One Cixan", color: "primary" as const },
                      { field: "isSingle" as const, label: "Tek Mehsul", color: "primary" as const },
                    ]).map(({ field, label, color }) => (
                      <label key={field} className="flex cursor-pointer items-center gap-2 select-none">
                        <Toggle checked={Boolean(newProduct[field])} onChange={v => setNewProduct(prev => ({ ...prev, [field]: v }))} color={color} label={label} />
                        <span className="text-xs font-semibold">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-1">
                  <button type="button" onClick={() => setShowModal(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black text-black hover:bg-slate-50 dark:border-white/10 dark:text-white dark:hover:bg-white/5">
                    Legv Et
                  </button>
                  <button type="submit" disabled={modalLoading}
                    className="rounded-xl bg-primary px-5 py-2 text-xs font-black text-black hover:opacity-90 disabled:opacity-50">
                    {modalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mehsul Yarat"}
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
