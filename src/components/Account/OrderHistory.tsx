import { motion } from 'motion/react';
import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, MapPin, Phone, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { checkoutService } from '../../services/api';
import { buildCourierInviteLinkToken } from '../../utils/courierTrackingToken';

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
  if (API_BASE) {
    try {
      return new URL(fixed, API_BASE).toString();
    } catch {
      //
    }
  }
  if (API_ORIGIN) {
    try {
      return new URL(fixed, API_ORIGIN).toString();
    } catch {
      //
    }
  }
  return fixed;
};

type UiOrderItem = {
  id: string;
  productVariantId: number;
  productName: string;
  color?: string;
  size?: string;
  variantName?: string;
  quantity: number;
  price: number;
  image?: string;
  slug?: string;
};

type OrderCourierMeta = {
  courierPhone: string;
  courierWhatsappPhone: string;
  courierCarPlate: string;
  courierCarModel: string;
  deliveryAddress: string;
  courierPickupLine: string;
  customerPhone: string;
  orderNumber: string;
};

type UiOrder = {
  orderId: number;
  status: string;
  statusLabel: string;
  statusTone: 'success' | 'warning' | 'danger' | 'neutral';
  createdAt: string;
  totalPrice: number;
  items: UiOrderItem[];
  courierMeta: OrderCourierMeta;
  /** Florist backend-də saxlanılan və ya mövcud token ilə qurulan izləmə keçidi */
  trackingHref: string;
};

const normalizeOrderStatus = (rawStatus: unknown): { code: string; label: string; tone: UiOrder['statusTone'] } => {
  const code = String(rawStatus || 'PENDING').trim().toUpperCase();
  const compact = code.replace(/[\s-]+/g, '_');

  if (['DELIVERED', 'COMPLETED', 'READY'].includes(code)) {
    return { code, label: code === 'DELIVERED' ? 'Çatdırılıb' : code === 'READY' ? 'Hazırdır' : 'Tamamlanıb', tone: 'success' };
  }
  if (['CANCELLED', 'CANCELED', 'REJECTED', 'FAILED'].includes(code)) {
    return { code, label: 'Ləğv olunub', tone: 'danger' };
  }
  if (['PENDING', 'WAITING_PAYMENT', 'NEW'].includes(code)) {
    return { code, label: 'Gözləmədə', tone: 'warning' };
  }
  if (['CONFIRMED', 'PAID', 'PREPARING', 'IN_PREPARATION', 'SHIPPED', 'ON_THE_WAY'].includes(code)) {
    return {
      code,
      label:
        code === 'CONFIRMED'
          ? 'Təsdiqlənib'
          : code === 'PAID'
            ? 'Ödənilib'
            : code === 'PREPARING' || code === 'IN_PREPARATION'
              ? 'Hazırlanır'
              : 'Yoldadır',
      tone: 'neutral',
    };
  }

  if (
    compact.includes('WITH_COURIER') ||
    compact.includes('WITH_KURYER') ||
    compact.includes('KURYER') ||
    compact.includes('IN_DELIVERY') ||
    compact.includes('OUT_FOR_DELIVERY')
  ) {
    return { code, label: 'Kuryer çatdırır', tone: 'neutral' };
  }
  if (compact.includes('FLORIST_CONFIRMED') || compact.includes('FLORIST_ACCEPTED')) {
    return { code, label: 'Florist təsdiqləyib', tone: 'neutral' };
  }

  return { code, label: code || 'Gözləmədə', tone: 'neutral' };
};

const extractCourierSnapshot = (order: any): OrderCourierMeta => {
  const src = order?.order && typeof order.order === 'object' ? order.order : order;
  const del = src?.delivery && typeof src.delivery === 'object' ? src.delivery : null;
  const city = String(src?.city ?? del?.city ?? '');
  const line = String(
    src?.addressLine ?? src?.deliveryAddress ?? src?.fullAddressLine ?? del?.addressLine ?? del?.line1 ?? ''
  );
  const deliveryAddress =
    `${city} ${line}`.trim() ||
    String(order?.deliveryAddress ?? del?.fullAddress ?? '');
  const pickupCity = String(src?.pickupCity ?? src?.pickupTown ?? src?.floristCity ?? '');
  const pickupBits = String(
    src?.pickupAddress ?? src?.pickupLine ?? src?.pickupStreet ?? src?.pickup ?? ''
  ).trim();
  const courierPickupLine =
    `${pickupCity} ${pickupBits}`.trim() ||
    String(src?.floristAddress ?? src?.shopAddress ?? src?.storeAddress ?? '');
  return {
    courierPhone: String(src?.courierPhone ?? src?.courierMobile ?? ''),
    courierWhatsappPhone: String(src?.courierWhatsappPhone ?? src?.courierWhatsapp ?? ''),
    courierCarPlate: String(src?.courierCarPlate ?? src?.carPlate ?? ''),
    courierCarModel: String(src?.courierCarModel ?? src?.carModel ?? ''),
    deliveryAddress,
    courierPickupLine,
    customerPhone: String(
      src?.customerPhone ??
        src?.recipientPhone ??
        src?.receiverPhone ??
        src?.phone ??
        src?.buyerPhone ??
        src?.contactPhone ??
        del?.phone ??
        del?.recipientPhone ??
        del?.receiverPhone ??
        del?.contactPhone ??
        ''
    ),
    orderNumber: String(src?.orderNumber ?? src?.number ?? ''),
  };
};

/** Kuryerə keçid və ya təhvil sonrası — READY mərhələsində link qurulmur */
const statusSupportsCustomerTracking = (code: string) => {
  const k = code.replace(/[\s-]+/g, '_').toUpperCase();
  if (k.includes('CANCELLED') || k.includes('REJECTED') || k.includes('FAILED')) return false;
  if (k.includes('DELIVER') || k.includes('COMPLETED') || k.includes('DONE')) return true;
  if (
    k.includes('WITH_COURIER') ||
    k.includes('WITH_KURYER') ||
    (k.includes('KURYER') && !k.includes('WITHOUT')) ||
    k.includes('IN_DELIVERY') ||
    k.includes('OUT_FOR_DELIVERY') ||
    k.includes('ON_THE_WAY') ||
    k.includes('SHIPPED')
  )
    return true;
  return false;
};

async function buildFallbackTrackingUrl(
  orderId: number,
  meta: OrderCourierMeta,
  rawStatus: string
): Promise<string> {
  const access = await buildCourierInviteLinkToken(orderId);
  // Floristin göndərdiyi linklə eyni format: əvvəl /courier/invite, sonra tracking-ə redirect.
  const url = new URL(`${window.location.origin}/courier/invite`);
  url.searchParams.set('orderId', String(orderId));
  url.searchParams.set('access', access);
  if (meta.orderNumber) url.searchParams.set('orderNumber', meta.orderNumber);
  url.searchParams.set('status', rawStatus || 'WITH_COURIER');
  if (meta.deliveryAddress) url.searchParams.set('address', meta.deliveryAddress);
  if (meta.customerPhone) url.searchParams.set('customerPhone', meta.customerPhone);
  if (meta.courierCarPlate) url.searchParams.set('courierCarPlate', meta.courierCarPlate);
  if (meta.courierCarModel) url.searchParams.set('courierCarModel', meta.courierCarModel);
  if (meta.courierPhone) url.searchParams.set('courierPhone', meta.courierPhone);
  if (meta.courierWhatsappPhone) url.searchParams.set('courierWhatsapp', meta.courierWhatsappPhone);
  const envPickup = String(import.meta.env.VITE_TRACKING_DEFAULT_PICKUP_ADDRESS || '').trim();
  const pickup = meta.courierPickupLine.trim() || envPickup;
  if (pickup) url.searchParams.set('courierPickup', pickup);
  return url.toString();
}

async function enrichTrackingUrl(
  rawHref: string,
  orderId: number,
  meta: OrderCourierMeta,
  rawStatus: string
): Promise<string> {
  const href = String(rawHref || '').trim();
  if (!href) return '';
  try {
    const u = new URL(href, window.location.origin);
    const p = u.searchParams;

    const isCourierTrackingUrl =
      u.pathname.startsWith('/courier/invite') || u.pathname.startsWith('/courier/tracking');
    if (!isCourierTrackingUrl) return u.toString();

    if (!p.get('orderId')) p.set('orderId', String(orderId));
    if (!p.get('orderNumber') && meta.orderNumber) p.set('orderNumber', meta.orderNumber);
    if (!p.get('status')) p.set('status', rawStatus || 'WITH_COURIER');
    if (!p.get('address') && meta.deliveryAddress) p.set('address', meta.deliveryAddress);
    if (!p.get('customerPhone') && meta.customerPhone) p.set('customerPhone', meta.customerPhone);
    if (!p.get('courierCarPlate') && meta.courierCarPlate) p.set('courierCarPlate', meta.courierCarPlate);
    if (!p.get('courierCarModel') && meta.courierCarModel) p.set('courierCarModel', meta.courierCarModel);
    if (!p.get('courierPhone') && meta.courierPhone) p.set('courierPhone', meta.courierPhone);
    if (!p.get('courierWhatsapp') && meta.courierWhatsappPhone) p.set('courierWhatsapp', meta.courierWhatsappPhone);
    const envPickup = String(import.meta.env.VITE_TRACKING_DEFAULT_PICKUP_ADDRESS || '').trim();
    const pickup = meta.courierPickupLine.trim() || envPickup;
    if (!p.get('courierPickup') && pickup) p.set('courierPickup', pickup);

    // Linkdə access yoxdursa fallback token əlavə et ki eyni panel tam açılsın.
    if (!p.get('access') && orderId > 0) {
      const access = await buildCourierInviteLinkToken(orderId);
      if (access) p.set('access', access);
    }
    return u.toString();
  } catch {
    return href;
  }
}

const isCourierTrackingLink = (href: string): boolean => {
  const v = String(href || '').trim();
  if (!v) return false;
  try {
    const u = new URL(v, window.location.origin);
    return u.pathname.startsWith('/courier/invite') || u.pathname.startsWith('/courier/tracking');
  } catch {
    return false;
  }
};

const hasAccessToken = (href: string): boolean => {
  const v = String(href || '').trim();
  if (!v) return false;
  try {
    const u = new URL(v, window.location.origin);
    return Boolean(u.searchParams.get('access'));
  } catch {
    return false;
  }
};

const digitsOnly = (raw: string) => raw.replace(/\D/g, '').replace(/^00/, '');

const hasCourierDetails = (m: OrderCourierMeta) =>
  Boolean(m.courierPhone || m.courierWhatsappPhone || m.courierCarPlate || m.courierCarModel);

const readCourierHandoverLocal = (orderId: number): Record<string, string> => {
  const key = 'birbuket_courier_handover_v1';
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, any>;
    return (parsed[String(orderId)] || {}) as Record<string, string>;
  } catch {
    return {};
  }
};

export default function OrderHistory() {
  const { userId } = useAuth();
  const [orders, setOrders] = useState<UiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadOrders = async () => {
      if (!userId) {
        setOrders([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const [ordersRes, profileItems] = await Promise.all([
          checkoutService.getOrders(userId),
          checkoutService.getProfileOrderItems(userId),
        ]);
        const rawOrders = Array.isArray(ordersRes)
          ? ordersRes
          : Array.isArray(ordersRes?.data)
            ? ordersRes.data
            : [];
        const imageByOrderVariant = new Map<
          string,
          { image?: string; slug?: string; color?: string; size?: string; variantName?: string }
        >();
        for (const item of profileItems || []) {
          const orderId = Number(item?.orderId || 0);
          const variantId = Number(item?.variantId || 0);
          if (orderId > 0 && variantId > 0) {
            imageByOrderVariant.set(`${orderId}-${variantId}`, {
              image: item?.image,
              slug: item?.slug,
              color: item?.color,
              size: item?.size,
              variantName: item?.variantName,
            });
          }
        }

        const mapped: UiOrder[] = await Promise.all(
          rawOrders.map(async (order: any) => {
            const orderId = Number(order?.orderId ?? order?.id ?? 0);
            const rawStatus = String(order?.status || 'PENDING').trim().toUpperCase();
            const normalizedStatus = normalizeOrderStatus(rawStatus);
            const courierMeta = extractCourierSnapshot(order);
            const localHandoverMeta = readCourierHandoverLocal(orderId);
            const backendLink = String(
              localHandoverMeta?.courierPanelLink ||
                localHandoverMeta?.trackingHref ||
                order?.courierPanelLink ||
                order?.trackingUrl ||
                order?.courierInviteLink ||
                order?.order?.courierPanelLink ||
                order?.order?.trackingUrl ||
                order?.order?.courierInviteLink ||
                ''
            ).trim();

            let trackingHref = backendLink || String(order?.trackingLink || order?.order?.trackingLink || '').trim();
            if (trackingHref) {
              trackingHref = await enrichTrackingUrl(trackingHref, orderId, courierMeta, rawStatus);
            }

            const canTryFallback = statusSupportsCustomerTracking(rawStatus) && orderId > 0;
            if (
              canTryFallback &&
              (!trackingHref || !isCourierTrackingLink(trackingHref) || !hasAccessToken(trackingHref))
            ) {
              trackingHref = await buildFallbackTrackingUrl(orderId, courierMeta, rawStatus);
            }

            const items: UiOrderItem[] = (Array.isArray(order?.items) ? order.items : []).map((item: any, index: number) => {
              const variantId = Number(item?.productVariantId ?? item?.variantId ?? 0);
              const linked = imageByOrderVariant.get(`${orderId}-${variantId}`) || {};
              const directImage = String(
                item?.image ??
                  item?.imageUrl ??
                  item?.productImageUrl ??
                  item?.product?.image ??
                  item?.product?.imageUrl ??
                  item?.product?.productImageUrl ??
                  ''
              ).trim();
              const productName = String(
                item?.productName ??
                  item?.name ??
                  item?.product?.productName ??
                  item?.product?.name ??
                  `Məhsul #${item?.productId ?? index + 1}`
              ).trim();
              const color = String(item?.color ?? item?.variantColor ?? item?.product?.color ?? '').trim();
              const size = String(item?.size ?? item?.variantSize ?? item?.product?.size ?? '').trim();
              const variantName = String(item?.variantName ?? item?.variant_name ?? '').trim();
              return {
                id: String(item?.id ?? index + 1),
                productVariantId: variantId,
                productName,
                color: color || linked.color || undefined,
                size: size || linked.size || undefined,
                variantName: variantName || linked.variantName || undefined,
                quantity: Number(item?.quantity ?? 0),
                price: Number(item?.price ?? 0),
                image: normalizeImageUrl(linked.image || directImage),
                slug: linked.slug,
              };
            });
            return {
              orderId,
              status: rawStatus,
              statusLabel: normalizedStatus.label,
              statusTone: normalizedStatus.tone,
              createdAt: String(order?.createdAt || order?.createdDate || ''),
              totalPrice: Number(order?.totalPrice ?? order?.amount ?? 0),
              items,
              courierMeta,
              trackingHref,
            };
          })
        );

        setOrders(mapped.filter((o) => o.orderId > 0));
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Sifariş tarixçəsi yüklənmədi.');
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, [userId]);

  const hasOrders = useMemo(() => orders.length > 0, [orders]);

  return (
    <section>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-black text-floral-deep dark:text-floral-deep-dark">Sifariş tarixçəm</h2>
      </div>

      {loading && (
        <div className="rounded-3xl border border-floral-muted/10 bg-white dark:bg-white/5 p-8 text-sm font-bold text-floral-muted">
          Sifarişlər yüklənir...
        </div>
      )}

      {!loading && error && (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && !hasOrders && (
        <div className="rounded-3xl border border-floral-muted/10 bg-white dark:bg-white/5 p-8">
          <p className="text-lg font-bold text-floral-deep dark:text-white">Hələ sifariş tarixçəniz boşdur.</p>
          <p className="mt-2 text-sm text-floral-muted dark:text-white/70">
            İlk sifarişinizi vermək üçün aşağıdakı keçidlərdən istifadə edin.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/"
              className="px-5 py-3 rounded-xl bg-primary text-floral-deep text-xs font-black uppercase tracking-widest"
            >
              Ana səhifə
            </Link>
            <Link
              to="/studio"
              className="px-5 py-3 rounded-xl border-2 border-primary text-primary text-xs font-black uppercase tracking-widest"
            >
              BirBuket yarat
            </Link>
          </div>
        </div>
      )}

      {!loading && !error && hasOrders && (
        <div className="space-y-6">
          {orders.map((order, i) => (
          <motion.div
            key={order.orderId}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white dark:bg-white/5 rounded-3xl overflow-hidden border border-floral-muted/5 shadow-sm hover:shadow-xl transition-all duration-500 group"
          >
            <div className="p-6 sm:p-8 flex flex-col sm:row sm:items-center justify-between gap-6 md:flex-row">
              <div className="flex items-center gap-6">
                <div>
                  <h3 className="text-xl font-bold text-floral-deep dark:text-white mb-1">Sifariş</h3>
                  <p className="text-[11px] font-black uppercase tracking-tighter text-floral-muted/50">Sifariş № #{order.orderId}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <span
                      className={`flex h-2 w-2 rounded-full ${
                        order.statusTone === 'success'
                          ? 'bg-primary'
                          : order.statusTone === 'warning'
                            ? 'bg-amber-500'
                            : order.statusTone === 'danger'
                              ? 'bg-red-500'
                              : 'bg-floral-muted/40'
                      }`}
                    />
                    <span
                      className={`text-[10px] font-bold uppercase tracking-widest ${
                        order.statusTone === 'success'
                          ? 'text-primary'
                          : order.statusTone === 'warning'
                            ? 'text-amber-600'
                            : order.statusTone === 'danger'
                              ? 'text-red-600'
                              : 'text-floral-muted/60'
                      }`}
                    >
                      {order.statusLabel}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-4">
                <div className="text-right">
                  <p className="text-2xl font-black text-floral-deep dark:text-primary">{order.totalPrice.toFixed(2)} ₼</p>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-floral-muted/60 mt-1">
                    {order.createdAt ? new Date(order.createdAt).toLocaleDateString('az-AZ') : '-'}
                  </p>
                </div>
              </div>
            </div>

            {(order.trackingHref || hasCourierDetails(order.courierMeta)) && (
              <div className="border-t border-emerald-200/60 bg-emerald-50/50 px-6 py-5 dark:border-emerald-900/30 dark:bg-emerald-950/25">
                <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-emerald-900 dark:text-emerald-200">
                  <Truck className="h-4 w-4 shrink-0" />
                  Çatdırılma və kuryer
                </p>
                <div className="mt-3 grid gap-2 text-sm text-[#1a3d2e] dark:text-emerald-50/90">
                  {order.courierMeta.deliveryAddress ? (
                    <p className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
                      <span>{order.courierMeta.deliveryAddress}</span>
                    </p>
                  ) : null}
                  {order.courierMeta.customerPhone ? (
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4 shrink-0 opacity-70" />
                      <a
                        href={`tel:${order.courierMeta.customerPhone.replace(/\s/g, '')}`}
                        className="font-semibold underline underline-offset-2"
                      >
                        Alıcı: {order.courierMeta.customerPhone}
                      </a>
                    </p>
                  ) : null}
                  {order.courierMeta.courierPhone ? (
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4 shrink-0 opacity-70" />
                      <a href={`tel:${order.courierMeta.courierPhone.replace(/\s/g, '')}`} className="font-semibold underline underline-offset-2">
                        Kuryer: {order.courierMeta.courierPhone}
                      </a>
                    </p>
                  ) : null}
                  {order.courierMeta.courierWhatsappPhone ? (
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-emerald-800/80 dark:text-emerald-300/90">WhatsApp (kuryer):</span>
                      {digitsOnly(order.courierMeta.courierWhatsappPhone).length >= 9 ? (
                        <a
                          href={`https://wa.me/${digitsOnly(order.courierMeta.courierWhatsappPhone)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-primary underline underline-offset-2"
                        >
                          {order.courierMeta.courierWhatsappPhone}
                        </a>
                      ) : (
                        <span className="font-semibold">{order.courierMeta.courierWhatsappPhone}</span>
                      )}
                    </p>
                  ) : null}
                  {order.courierMeta.courierCarPlate || order.courierMeta.courierCarModel ? (
                    <p className="text-xs font-medium text-emerald-900/85 dark:text-emerald-200/80">
                      Avtomobil: {order.courierMeta.courierCarPlate || '—'}
                      {order.courierMeta.courierCarModel ? ` • ${order.courierMeta.courierCarModel}` : ''}
                    </p>
                  ) : null}
                </div>
                {order.trackingHref ? (
                  <a
                    href={order.trackingHref}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-black uppercase tracking-wide text-[#0d1c12]"
                  >
                    Çatdırılmanı canlı izlə
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <p className="mt-3 text-[11px] text-emerald-800/75 dark:text-emerald-300/80">
                    Çatdırılma xətti bu sifariş üçün hələ aktiv deyil və ya məlumat yenilənir.
                  </p>
                )}
              </div>
            )}

            {order.courierMeta.customerPhone ? (
              <div className="border-t border-floral-muted/10 px-6 py-3 text-xs text-floral-muted dark:text-floral-muted-dark">
                <span className="font-bold text-floral-deep dark:text-white">Alıcı telefonu:</span>{' '}
                <a
                  href={`tel:${order.courierMeta.customerPhone.replace(/\s/g, '')}`}
                  className="font-semibold underline underline-offset-2"
                >
                  {order.courierMeta.customerPhone}
                </a>
              </div>
            ) : null}

            {order.items.length > 0 ? (
              <div className="border-t border-floral-muted/10 px-6 sm:px-8 py-4 space-y-3">
                {order.items.map((orderItem) => (
                  <div key={`${order.orderId}-${orderItem.id}`} className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex items-center gap-3">
                      {orderItem.image ? (
                        <img
                          src={orderItem.image}
                          alt={orderItem.slug || `variant-${orderItem.productVariantId}`}
                          className="h-12 w-12 rounded-xl object-cover flex-shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-xl bg-primary/10 flex-shrink-0" />
                      )}
                      <div>
                      <p className="text-sm font-semibold text-floral-deep dark:text-white truncate">
                        {orderItem.productName}
                      </p>
                      {(orderItem.color || orderItem.size || orderItem.variantName) && (
                        <p className="text-xs text-floral-muted">
                          {[orderItem.variantName, orderItem.size, orderItem.color].filter(Boolean).join(' / ')}
                        </p>
                      )}
                      <p className="text-xs text-floral-muted">Say: {orderItem.quantity || 0}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-floral-deep dark:text-primary">{orderItem.price.toFixed(2)} ₼</p>
                      <p className="text-xs text-floral-muted">
                        Cəm: {(orderItem.price * (orderItem.quantity || 0)).toFixed(2)} ₼
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border-t border-floral-muted/10 px-6 sm:px-8 py-4">
                <p className="text-xs text-floral-muted">Bu sifarişdə məhsul yoxdur.</p>
              </div>
            )}
          </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}
