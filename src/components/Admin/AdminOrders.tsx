import React, { useEffect, useMemo, useState } from 'react';
import { Eye, Loader2, Package, X } from 'lucide-react';
import { adminService } from '../../services/api';

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
      // continue
    }
  }
  if (API_BASE) {
    try {
      return new URL(absolutePath, API_BASE).toString();
    } catch {
      // continue
    }
  }
  return absolutePath;
};

type AdminOrder = {
  id: number;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  address: string;
  total: number;
  status: string;
  createdAt: string;
  items: Array<{
    productName: string;
    productImageUrl: string;
    color?: string;
    size?: string;
    variantName?: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
};

const normalizeStatus = (raw: unknown): string => {
  const s = String(raw || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (!s) return 'UNKNOWN';
  return s;
};

const statusLabel = (status: string): string => {
  const s = normalizeStatus(status);
  if (s.includes('DELIVERED') || s.includes('COMPLETED')) return 'Çatdırılıb';
  if (
    s.includes('WITH_COURIER') ||
    s.includes('COURIER') ||
    s.includes('ON_THE_WAY') ||
    s.includes('IN_DELIVERY') ||
    s.includes('OUT_FOR_DELIVERY')
  )
    return 'Kuryerdə';
  if (s.includes('READY') || s.includes('PREPARED')) return 'Hazır';
  if (s.includes('PREPARING') || s.includes('PREPEAR')) return 'Hazırlanır';
  if (s.includes('PENDING') || s.includes('NEW') || s.includes('AWAIT')) return 'Gözləmədə';
  if (s.includes('CANCEL') || s.includes('REJECT')) return 'Ləğv edilib';
  return s;
};

const statusBadgeClass = (status: string): string => {
  const s = normalizeStatus(status);
  const isPreparingOnly = (s.includes('PREPARING') || s.includes('PREPEAR')) && !s.includes('PREPARED');

  if (s.includes('DELIVERED') || s.includes('COMPLETED')) {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300';
  }
  if (s.includes('CANCEL') || s.includes('REJECT')) {
    return 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300';
  }
  if (
    s.includes('WITH_COURIER') ||
    (s.includes('COURIER') && !isPreparingOnly && !s.includes('PENDING')) ||
    s.includes('ON_THE_WAY') ||
    s.includes('IN_DELIVERY') ||
    s.includes('OUT_FOR_DELIVERY')
  ) {
    return 'bg-sky-100 text-sky-800 ring-1 ring-sky-200 dark:bg-sky-500/20 dark:text-sky-200 dark:ring-sky-500/30';
  }
  if (isPreparingOnly || (s.includes('PREPARATION') && !s.includes('PREPARED'))) {
    return 'bg-orange-100 text-orange-800 ring-1 ring-orange-200 dark:bg-orange-500/25 dark:text-orange-200 dark:ring-orange-500/35';
  }
  if (s.includes('READY') || s.includes('PREPARED')) {
    return 'bg-amber-100 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/20 dark:text-amber-200 dark:ring-amber-500/30';
  }
  if (s.includes('PENDING') || s.includes('NEW') || s.includes('AWAIT')) {
    return 'bg-violet-100 text-violet-800 ring-1 ring-violet-200 dark:bg-violet-500/20 dark:text-violet-200 dark:ring-violet-500/30';
  }
  return 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white/80';
};

const parseOrder = (raw: any): AdminOrder => {
  const src = raw?.order && typeof raw.order === 'object' ? { ...raw, ...raw.order } : raw || {};
  const customerObj =
    src?.customer && typeof src.customer === 'object'
      ? src.customer
      : src?.user && typeof src.user === 'object'
        ? src.user
        : {};
  const profileObj =
    src?.profile && typeof src.profile === 'object'
      ? src.profile
      : src?.customerProfile && typeof src.customerProfile === 'object'
        ? src.customerProfile
        : {};
  const delivery = src?.delivery && typeof src.delivery === 'object' ? src.delivery : {};
  const shipping =
    src?.shipping && typeof src.shipping === 'object'
      ? src.shipping
      : src?.shippingAddress && typeof src.shippingAddress === 'object'
        ? src.shippingAddress
        : {};
  const city = String(src?.city ?? delivery?.city ?? '').trim();
  const line = String(
    src?.addressLine ?? src?.deliveryAddress ?? src?.fullAddressLine ?? delivery?.addressLine ?? delivery?.line1 ?? ''
  ).trim();
  const sourceItems = Array.isArray(src?.items)
    ? src.items
    : Array.isArray(src?.orderItems)
      ? src.orderItems
      : Array.isArray(raw?.items)
        ? raw.items
        : [];
  const items = sourceItems.map((item: any) => ({
    productName: String(item?.productName ?? item?.name ?? item?.title ?? 'Məhsul'),
    productImageUrl: normalizeImageUrl(
      (Array.isArray(item?.product?.images) ? item.product.images[0]?.imageUrl : '') ||
        (Array.isArray(item?.images) ? item.images[0]?.imageUrl : '') ||
        item?.variant?.imageUrl ||
        item?.variant?.image ||
        item?.productVariant?.imageUrl ||
        item?.productVariant?.image ||
        item?.productImageUrl ||
        item?.imageUrl ||
        item?.image ||
        item?.product?.productImageUrl ||
        item?.product?.imageUrl ||
        item?.product?.image ||
        item?.customBouquetImageUrl ||
        item?.product?.customBouquetImageUrl ||
        src?.customBouquetImageUrl ||
        ''
    ),
    color: String(
      item?.color ??
        item?.variantColor ??
        item?.variant?.color ??
        item?.productVariant?.color ??
        ''
    ).trim() || undefined,
    size: String(
      item?.size ??
        item?.variantSize ??
        item?.variant?.size ??
        item?.productVariant?.size ??
        ''
    ).trim() || undefined,
    variantName: String(
      item?.variantName ??
        item?.variant_name ??
        item?.variant?.variantName ??
        item?.variant?.variant_name ??
        item?.productVariant?.variantName ??
        item?.productVariant?.variant_name ??
        ''
    ).trim() || undefined,
    quantity: Number(item?.quantity ?? 0),
    unitPrice: Number(item?.unitPrice ?? item?.price ?? 0),
    lineTotal: Number(item?.lineTotal ?? (Number(item?.quantity ?? 0) * Number(item?.unitPrice ?? item?.price ?? 0))),
  }));
  return {
    id: Number(src?.orderId ?? src?.id ?? 0),
    orderNumber: String(src?.orderNumber ?? src?.number ?? ''),
    customerName: String(
      src?.customerUsername ??
        src?.username ??
        customerObj?.username ??
        src?.userName ??
        src?.customerName ??
        src?.buyerName ??
        src?.recipientName ??
        src?.fullName ??
        ''
    ),
    customerPhone: String(
      src?.customerPhone ??
        src?.customerPhoneDigits ??
        src?.phoneNumber ??
        src?.customer_phone ??
        src?.customer_phone_number ??
        src?.contactPhone ??
        src?.contact_phone ??
        customerObj?.phone ??
        customerObj?.phoneNumber ??
        customerObj?.phoneDigits ??
        customerObj?.mobile ??
        profileObj?.phone ??
        profileObj?.phoneNumber ??
        profileObj?.mobile ??
        src?.customer_phone_digits ??
        src?.recipientPhone ??
        src?.recipient_phone ??
        src?.receiverPhone ??
        src?.receiver_phone ??
        src?.phone ??
        delivery?.phone ??
        delivery?.phoneNumber ??
        delivery?.recipientPhone ??
        delivery?.receiverPhone ??
        shipping?.phone ??
        shipping?.phoneNumber ??
        shipping?.recipientPhone ??
        shipping?.receiverPhone ??
        ''
    ),
    address: `${city} ${line}`.trim(),
    total: Number(src?.totalPrice ?? src?.amount ?? src?.total ?? 0),
    status: normalizeStatus(src?.status ?? src?.orderStatus),
    createdAt: String(src?.createdAt ?? src?.createdDate ?? ''),
    items,
  };
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await adminService.getAllOrders();
        const list = Array.isArray(res?.data) ? res.data : [];
        const parsed = list.map(parseOrder).filter((x) => x.id > 0);
        if (!cancelled) setOrders(parsed);
      } catch (e: any) {
        if (!cancelled) {
          setOrders([]);
          setError(String(e?.message || 'Sifarişlər yüklənmədi.'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalCount = useMemo(() => orders.length, [orders]);

  return (
    <div className="min-h-screen bg-[#fdfcf0] p-6 lg:p-8 dark:bg-background-dark">
      <div className="rounded-2xl border border-floral-muted/10 bg-white p-5 dark:border-white/10 dark:bg-white/5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-black">Sifarişlər</h2>
          <span className="rounded-lg bg-primary/15 px-3 py-1 text-xs font-black text-primary">
            Cəmi: {totalCount}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-floral-muted dark:text-white/60">
            <Loader2 className="h-4 w-4 animate-spin" />
            Sifarişlər yüklənir...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex items-center gap-2 py-8 text-sm text-floral-muted dark:text-white/60">
            <Package className="h-4 w-4" />
            Sifariş tapılmadı.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_30px_rgba(16,24,40,0.06)] dark:border-white/10 dark:bg-slate-950/40">
            <table className="w-full min-w-[900px] border-separate [border-spacing:0_10px] px-2">
              <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur border-b border-slate-200 text-left text-[11px] uppercase tracking-[0.08em] text-slate-600 dark:bg-slate-900/95 dark:border-white/10 dark:text-white/60">
                <tr>
                  <th className="px-3 py-3">Sifariş nömrəsi</th>
                  <th className="px-3 py-3">Müştəri</th>
                  <th className="px-3 py-3">Telefon</th>
                  <th className="px-3 py-3">Ünvan</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Məbləğ</th>
                  <th className="px-3 py-3">Tarix</th>
                  <th className="px-3 py-3 text-center">Bax</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order, idx) => (
                  <tr key={order.id} className={`text-sm transition-shadow hover:shadow-sm ${idx % 2 === 0 ? '' : ''}`}>
                    <td className="rounded-l-2xl border-y border-l border-slate-200/80 bg-white px-3 py-3 font-semibold dark:border-white/10 dark:bg-white/[0.02]">#{order.orderNumber || order.id}</td>
                    <td className="border-y border-slate-200/80 bg-white px-3 py-3 dark:border-white/10 dark:bg-white/[0.02]">{order.customerName || '-'}</td>
                    <td className="border-y border-slate-200/80 bg-white px-3 py-3 dark:border-white/10 dark:bg-white/[0.02]">{order.customerPhone || '-'}</td>
                    <td className="border-y border-slate-200/80 bg-white px-3 py-3 dark:border-white/10 dark:bg-white/[0.02]">{order.address || '-'}</td>
                    <td className="border-y border-slate-200/80 bg-white px-3 py-3 dark:border-white/10 dark:bg-white/[0.02]">
                      <div className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${statusBadgeClass(order.status)}`}>
                        {statusLabel(order.status)}
                      </div>
                    </td>
                    <td className="border-y border-slate-200/80 bg-white px-3 py-3 text-right font-semibold dark:border-white/10 dark:bg-white/[0.02]">{Number(order.total || 0).toFixed(2)} ₼</td>
                    <td className="border-y border-slate-200/80 bg-white px-3 py-3 dark:border-white/10 dark:bg-white/[0.02]">
                      {order.createdAt ? new Date(order.createdAt).toLocaleString('az-AZ') : '-'}
                    </td>
                    <td className="rounded-r-2xl border-y border-r border-slate-200/80 bg-white px-3 py-3 text-center dark:border-white/10 dark:bg-white/[0.02]">
                      <button
                        type="button"
                        onClick={() => setSelectedOrder(order)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-floral-muted/20 bg-white text-floral-deep hover:border-primary hover:text-primary dark:bg-white/5 dark:text-white/80"
                        title="Sifarişə bax"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedOrder ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-floral-muted/20 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black text-floral-deep dark:text-white">
                Sifariş #{selectedOrder.orderNumber || selectedOrder.id}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-floral-muted/20 text-floral-muted hover:text-floral-deep dark:border-white/15 dark:text-white/70"
                title="Bağla"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <p><span className="font-bold">Müştəri:</span> {selectedOrder.customerName || '-'}</p>
              <p><span className="font-bold">Telefon:</span> {selectedOrder.customerPhone || '-'}</p>
              <p className="sm:col-span-2"><span className="font-bold">Ünvan:</span> {selectedOrder.address || '-'}</p>
              <p><span className="font-bold">Status:</span> {statusLabel(selectedOrder.status)}</p>
              <p><span className="font-bold">Məbləğ:</span> {Number(selectedOrder.total || 0).toFixed(2)} ₼</p>
              <p className="sm:col-span-2">
                <span className="font-bold">Tarix:</span>{' '}
                {selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleString('az-AZ') : '-'}
              </p>
            </div>

            <div className="mt-5 border-t border-floral-muted/15 pt-4 dark:border-white/10">
              <p className="mb-3 text-sm font-black text-floral-deep dark:text-white">Məhsullar</p>
              {selectedOrder.items.length === 0 ? (
                <p className="text-sm text-floral-muted dark:text-white/70">Bu sifarişdə məhsul siyahısı yoxdur.</p>
              ) : (
                <div className="space-y-3">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={`${item.productName}-${idx}`} className="flex items-center gap-3 rounded-xl border border-floral-muted/15 bg-[#faf9f4] p-3 dark:border-white/10 dark:bg-white/5">
                      {item.productImageUrl ? (
                        <img
                          src={item.productImageUrl}
                          alt={item.productName}
                          className="h-14 w-14 rounded-lg object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-lg bg-primary/10" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-floral-deep dark:text-white">{item.productName}</p>
                        {(item.variantName || item.size || item.color) && (
                          <p className="truncate text-xs text-floral-muted dark:text-white/65">
                            {[item.variantName, item.size, item.color].filter(Boolean).join(' / ')}
                          </p>
                        )}
                        <p className="text-xs text-floral-muted dark:text-white/65">
                          Say: {item.quantity || 0} • Vahid: {Number(item.unitPrice || 0).toFixed(2)} ₼
                        </p>
                      </div>
                      <p className="text-sm font-black text-primary">{Number(item.lineTotal || 0).toFixed(2)} ₼</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
