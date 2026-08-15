import { CheckCircle2, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { floristService } from '../../services/api';
import { buildCourierInviteLinkToken, normalizePhoneDigits } from '../../utils/courierTrackingToken';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

type FloristOrder = {
  id: number;
  orderNumber?: string;
  status: string;
  floristReadyImageUrl?: string;
  courierPhone?: string;
  courierWhatsappPhone?: string;
  courierCarPlate?: string;
  courierCarModel?: string;
  courierPanelLink?: string;
  createdAt?: string;
  totalPrice?: number;
  addressLine?: string;
  city?: string;
  /** Götürmə / mağaza ünvanı — izləmə keçidində kuryer nöqtəsi üçün */
  pickupCity?: string;
  pickupAddress?: string;
  pickupStreet?: string;
  floristAddress?: string;
  shopAddress?: string;
  customerPhone?: string;
  items?: Array<{
    productName?: string;
    quantity?: number;
    image?: string;
    variantId?: number;
    productId?: number;
    unitPrice?: number;
    lineTotal?: number;
    customBouquetImageUrl?: string;
    customBouquetComposition?: string;
  }>;
};

type CourierHandoverForm = {
  courierPhone: string;
  courierWhatsappPhone: string;
  courierCarPlate: string;
  courierCarModel: string;
};

const API_BASE = String(process.env.NEXT_PUBLIC_API_BASE_URL || '').trim();
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

  // backend bəzən slash-ları windows formatında qaytarır
  const fixed = raw.replace(/\\/g, '/');
  if (/^data:image\//i.test(fixed)) return fixed;
  if (/^https?:\/\//i.test(fixed)) return fixed;
  if (/^\/\//.test(fixed)) return `${window.location.protocol}${fixed}`;
  if (API_BASE) {
    try {
      return new URL(fixed, API_BASE).toString();
    } catch {
      // ignore and continue fallback below
    }
  }
  if (API_ORIGIN) {
    try {
      return new URL(fixed, API_ORIGIN).toString();
    } catch {
      // ignore and continue fallback below
    }
  }
  return fixed;
};

const readAuthToken = (): string => {
  const raw =
    localStorage.getItem('accessToken') ||
    localStorage.getItem('access_token') ||
    localStorage.getItem('token') ||
    sessionStorage.getItem('accessToken') ||
    sessionStorage.getItem('access_token') ||
    sessionStorage.getItem('token') ||
    '';
  return String(raw).replace(/^"(.*)"$/, '$1').replace(/^Bearer\s+/i, '').trim();
};

const parseOrder = (row: any): FloristOrder => {
  const root = row?.data && typeof row.data === 'object' ? row.data : row;
  const source =
    row?.order && typeof row.order === 'object'
      ? row.order
      : row?.data && typeof row.data === 'object'
        ? row.data
        : row;
  const combined = { ...(root || {}), ...(source || {}) } as Record<string, unknown>;
  const id = Number(combined?.orderId ?? combined?.order_id ?? combined?.id ?? combined?.orderID ?? 0);
  const itemRows = Array.isArray(source?.items)
    ? source.items
    : Array.isArray(source?.orderItems)
      ? source.orderItems
      : [];
  return {
    id,
    orderNumber: String(combined?.orderNumber || combined?.number || ''),
    status: String(combined?.status || combined?.orderStatus || 'PENDING').toUpperCase(),
    floristReadyImageUrl: normalizeImageUrl(
      String(
        combined?.floristReadyImageUrl ||
          combined?.preparedImageUrl ||
          combined?.readyImageUrl ||
          combined?.completionImageUrl ||
          ''
      )
    ),
    courierPhone: String(combined?.courierPhone || combined?.courierMobile || ''),
    courierWhatsappPhone: String(combined?.courierWhatsappPhone || combined?.courierWhatsapp || ''),
    courierCarPlate: String(combined?.courierCarPlate || combined?.carPlate || ''),
    courierCarModel: String(combined?.courierCarModel || combined?.carModel || ''),
    courierPanelLink: String(combined?.courierPanelLink || ''),
    createdAt: String(combined?.createdAt || combined?.createdDate || combined?.date || ''),
    totalPrice: Number(combined?.totalPrice ?? combined?.amount ?? 0),
    addressLine: String(combined?.addressLine || combined?.deliveryAddress || ''),
    city: String(combined?.city || ''),
    pickupCity: String(combined?.pickupCity || combined?.pickupTown || combined?.floristCity || ''),
    pickupAddress: String(combined?.pickupAddress || combined?.pickupLine || ''),
    pickupStreet: String(combined?.pickupStreet || ''),
    floristAddress: String(combined?.floristAddress || combined?.floristFullAddress || ''),
    shopAddress: String(combined?.shopAddress || combined?.storeAddress || ''),
    customerPhone: String(
      combined?.customerPhone ||
        combined?.recipientPhone ||
        combined?.phone ||
        combined?.buyerPhone ||
        combined?.contactPhone ||
        ''
    ),
    items: itemRows.map((it: any) => ({
      productName: String(it?.productName || it?.title || it?.name || 'Məhsul'),
      quantity: Number(it?.quantity || 0),
      variantId: Number(it?.productVariantId ?? it?.variantId ?? 0) || undefined,
      productId: Number(it?.productId ?? it?.id ?? 0) || undefined,
      unitPrice: Number(it?.unitPrice ?? it?.price ?? 0) || undefined,
      lineTotal: Number(it?.lineTotal ?? 0) || undefined,
      customBouquetImageUrl: String(it?.customBouquetImageUrl || ''),
      customBouquetComposition: String(it?.customBouquetComposition || ''),
      image: normalizeImageUrl(
        it?.customBouquetImageUrl ||
          it?.productImageUrl ||
          it?.product?.productImageUrl ||
          it?.product?.customBouquetImageUrl ||
          it?.image ||
          it?.imageUrl ||
          it?.img ||
          it?.photoUrl ||
          it?.productImage ||
          it?.product?.image ||
          it?.product?.imageUrl ||
          ''
      ),
    })),
  };
};

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('file read failed'));
    reader.readAsDataURL(file);
  });

const makeCourierLink = async (params: {
  orderId: number;
  orderNumber?: string;
  status?: string;
  address?: string;
  customerPhone?: string;
  courierPickup?: string;
  courierPhone?: string;
  courierWhatsappPhone?: string;
  courierCarPlate?: string;
  courierCarModel?: string;
}) => {
  const access = await buildCourierInviteLinkToken(params.orderId);
  const url = new URL(`${window.location.origin}/courier/invite`);
  url.searchParams.set('orderId', String(params.orderId));
  url.searchParams.set('access', access);
  if (params.orderNumber) url.searchParams.set('orderNumber', params.orderNumber);
  if (params.status) url.searchParams.set('status', params.status);
  if (params.address) url.searchParams.set('address', params.address);
  if (params.customerPhone) url.searchParams.set('customerPhone', params.customerPhone);
  if (params.courierPickup) url.searchParams.set('courierPickup', params.courierPickup);
  if (params.courierPhone) url.searchParams.set('courierPhone', params.courierPhone);
  if (params.courierWhatsappPhone) url.searchParams.set('courierWhatsapp', params.courierWhatsappPhone);
  if (params.courierCarPlate) url.searchParams.set('courierCarPlate', params.courierCarPlate);
  if (params.courierCarModel) url.searchParams.set('courierCarModel', params.courierCarModel);
  return url.toString();
};

const saveCourierHandoverLocal = (orderId: number, data: Record<string, string>) => {
  const key = 'birbuket_courier_handover_v1';
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as Record<string, any>) : {};
    parsed[String(orderId)] = {
      ...parsed[String(orderId)],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(key, JSON.stringify(parsed));
  } catch {
    // ignore storage errors
  }
};

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

const extractOrderRows = (payload: any): any[] => {
  if (!payload) return [];
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.data?.content)) return payload.data.content;
  if (Array.isArray(payload?.data?.rows)) return payload.data.rows;
  if (Array.isArray(payload?.data?.result)) return payload.data.result;
  if (Array.isArray(payload?.data?.data?.content)) return payload.data.data.content;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.result?.content)) return payload.result.content;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.orders)) return payload.orders;
  if (Array.isArray(payload?.data?.orders)) return payload.data.orders;
  if (Array.isArray(payload?.data?.data?.orders)) return payload.data.data.orders;
  if (Array.isArray(payload)) return payload;

  // Deep fallback: bəzi backend response-lar listi qeyri-standart nested obyektlərdə saxlayır.
  const queue: unknown[] = [payload];
  const seen = new Set<unknown>();
  while (queue.length > 0) {
    const cur = queue.shift();
    if (!cur || typeof cur !== 'object' || seen.has(cur)) continue;
    seen.add(cur);
    if (Array.isArray(cur)) {
      const first = cur[0] as any;
      if (
        cur.length > 0 &&
        first &&
        typeof first === 'object' &&
        ('orderId' in first || 'id' in first || 'status' in first || 'orderStatus' in first)
      ) {
        return cur as any[];
      }
      for (const item of cur) queue.push(item);
      continue;
    }
    for (const v of Object.values(cur as Record<string, unknown>)) {
      queue.push(v);
    }
  }
  return [];
};

const toLocaleDate = (value?: string) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('az-AZ');
};

const getStatusKey = (status?: string) =>
  String(status || 'PENDING')
    .toUpperCase()
    .replace(/[\s-]+/g, '_');

const isPreparing = (status?: string) =>
  ['FLORIST_CONFIRMED', 'CONFIRMED', 'PREPARING', 'IN_PREPARATION'].includes(getStatusKey(status));

const isReady = (status?: string) =>
  ['READY', 'PREPARED', 'COMPLETED', 'DELIVERED'].includes(getStatusKey(status));

const isWithCourier = (status?: string) => {
  const s = getStatusKey(status);
  return (
    ['WITH_COURIER', 'WITH_KURYER', 'ON_THE_WAY', 'IN_DELIVERY', 'KURYERDE', 'KURYERDƏ'].includes(s) ||
    s.includes('COURIER') ||
    s.includes('KURYER')
  );
};

export default function FloristPanel() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [orders, setOrders] = useState<FloristOrder[]>([]);
  const [activeSection, setActiveSection] = useState<'PENDING' | 'PREPARING' | 'READY'>('PENDING');
  const [imageOpeningUrl, setImageOpeningUrl] = useState<string | null>(null);
  const [viewerImageUrl, setViewerImageUrl] = useState<string | null>(null);
  const [thumbImageMap, setThumbImageMap] = useState<Record<string, string>>({});
  const [readyProofByOrderId, setReadyProofByOrderId] = useState<Record<number, File | null>>({});
  const [readyProofPreviewByOrderId, setReadyProofPreviewByOrderId] = useState<Record<number, string>>({});
  const [courierFormByOrderId, setCourierFormByOrderId] = useState<Record<number, CourierHandoverForm>>({});

  const openImage = async (imageUrl?: string) => {
    const normalized = normalizeImageUrl(imageUrl);
    if (!normalized) return;

    setImageOpeningUrl(normalized);
    try {
      const token = readAuthToken();
      const res = await fetch(normalized, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      setViewerImageUrl(objectUrl);
    } catch {
      // Fallback for public images.
      setViewerImageUrl(normalized);
    } finally {
      setImageOpeningUrl(null);
    }
  };

  const refreshOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await floristService.getAllOrders();
      const rows = extractOrderRows(res?.raw ?? res?.data ?? res);
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[florist panel] fetched orders rows:', rows.length, res);
      }
      const parsed = rows.map(parseOrder).filter((x) => x.id > 0);
      setOrders(parsed);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Sifarişlər yüklənmədi.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshOrders().catch(console.error);
  }, []);

  useEffect(() => {
    const urls: string[] = Array.from(
      new Set<string>(
        orders
          .flatMap((o) => (Array.isArray(o.items) ? o.items : []))
          .map((it) => normalizeImageUrl(it.image ?? ''))
          .filter((s): s is string => s.length > 0)
      )
    );
    if (urls.length === 0) {
      setThumbImageMap({});
      return;
    }

    let cancelled = false;
    const createdObjectUrls: string[] = [];
    const token = readAuthToken();

    const loadThumbs = async () => {
      const nextMap: Record<string, string> = {};
      await Promise.all(
        urls.map(async (url) => {
          try {
            const res = await fetch(url, {
              headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            });
            if (!res.ok) return;
            const blob = await res.blob();
            const objectUrl = URL.createObjectURL(blob);
            createdObjectUrls.push(objectUrl);
            nextMap[url] = objectUrl;
          } catch {
            // keep original url fallback
          }
        })
      );
      if (!cancelled) setThumbImageMap(nextMap);
    };

    loadThumbs().catch(() => undefined);
    return () => {
      cancelled = true;
      createdObjectUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [orders]);

  const ordered = useMemo(() => {
    return [...orders].sort((a, b) => {
      const at = new Date(a.createdAt || 0).getTime();
      const bt = new Date(b.createdAt || 0).getTime();
      return bt - at;
    });
  }, [orders]);

  const pendingOrders = useMemo(
    () => ordered.filter((o) => !isPreparing(o.status) && !isReady(o.status) && !isWithCourier(o.status)),
    [ordered]
  );
  const preparingOrders = useMemo(
    () => ordered.filter((o) => isPreparing(o.status)),
    [ordered]
  );
  const readyOrders = useMemo(
    () =>
      ordered
        .filter((o) => isReady(o.status) || isWithCourier(o.status))
        .sort((a, b) => {
          const aWithCourier = isWithCourier(a.status);
          const bWithCourier = isWithCourier(b.status);
          // Kuryerə təhvil verilməyənlər əvvəl görünsün.
          if (aWithCourier !== bWithCourier) return aWithCourier ? 1 : -1;
          const at = new Date(a.createdAt || 0).getTime();
          const bt = new Date(b.createdAt || 0).getTime();
          return bt - at;
        }),
    [ordered]
  );

  const visibleOrders = useMemo(() => {
    if (activeSection === 'PREPARING') return preparingOrders;
    if (activeSection === 'READY') return readyOrders;
    return pendingOrders;
  }, [activeSection, pendingOrders, preparingOrders, readyOrders]);

  const renderedOrders = useMemo(() => {
    if (visibleOrders.length > 0) return visibleOrders;
    // Filtr backend status fərqlərinə görə boş düşərsə, data gəlibsə hamısını göstər.
    return ordered;
  }, [visibleOrders, ordered]);

  useEffect(() => {
    if (orders.length === 0) return;
    if (activeSection === 'PENDING' && pendingOrders.length === 0) {
      if (preparingOrders.length > 0) setActiveSection('PREPARING');
      else if (readyOrders.length > 0) setActiveSection('READY');
    }
  }, [orders.length, activeSection, pendingOrders.length, preparingOrders.length, readyOrders.length]);

  const handleConfirm = async (orderId: number, canPrepare: boolean) => {
    setSavingId(orderId);
    setError(null);
    setSuccess(null);
    try {
      await floristService.confirmPreparation(orderId, canPrepare);
      if (canPrepare) {
        // UI dərhal PREPARING bölməsinə keçsin (backend cavabı gecikə bilər).
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: 'PREPARING' } : o))
        );
        setActiveSection('PREPARING');
      }
      setSuccess(
        canPrepare
          ? `#${orderId} üçün status PREPARING olaraq yeniləndi.`
          : `#${orderId} üçün hazırlana bilməz olaraq qeyd edildi.`
      );
      await refreshOrders();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Təsdiq əməliyyatı uğursuz oldu.');
    } finally {
      setSavingId(null);
    }
  };

  const handlePrepared = async (orderId: number) => {
    const proof = readyProofByOrderId[orderId] || null;
    if (!proof) {
      setError('Tamamlandı üçün əvvəl şəkil yükləyin.');
      return;
    }
    setSavingId(orderId);
    setError(null);
    setSuccess(null);
    try {
      await floristService.markPreparedWithImage(orderId, proof);
      setReadyProofByOrderId((prev) => ({ ...prev, [orderId]: null }));
      // Şəkil backenddə dərhal görünməsə belə READY/COMPLETED mərhələsində UI-da baxılsın.
      if (readyProofPreviewByOrderId[orderId]) {
        setReadyProofPreviewByOrderId((prev) => ({ ...prev, [orderId]: prev[orderId] }));
      }
      setSuccess(`#${orderId} sifarişi READY olaraq yeniləndi.`);
      await refreshOrders();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Hazırlandı əməliyyatı uğursuz oldu.');
    } finally {
      setSavingId(null);
    }
  };

  const handleHandoverToCourier = async (orderId: number) => {
    const form = courierFormByOrderId[orderId] || {
      courierPhone: '',
      courierWhatsappPhone: '',
      courierCarPlate: '',
      courierCarModel: '',
    };
    const courierPhone = form.courierPhone.trim();
    const courierWhatsappPhone = form.courierWhatsappPhone.trim() || courierPhone;
    const courierCarPlate = form.courierCarPlate.trim();
    const courierCarModel = form.courierCarModel.trim();
    if (!courierPhone || !courierCarPlate || !courierCarModel) {
      setError('Kuryer telefonu, avtomobil nömrəsi və markası məcburidir.');
      return;
    }

    const order = orders.find((o) => o.id === orderId);
    const courierPickupLine =
      `${order?.pickupCity || ''} ${order?.pickupAddress || order?.pickupStreet || ''}`.trim() ||
      order?.floristAddress ||
      order?.shopAddress ||
      '';
    const envPickup = String(process.env.NEXT_PUBLIC_TRACKING_DEFAULT_PICKUP_ADDRESS || '').trim();
    const courierPanelLink = await makeCourierLink({
      orderId,
      orderNumber: order?.orderNumber,
      status: 'WITH_COURIER',
      address: `${order?.city || ''} ${order?.addressLine || ''}`.trim(),
      customerPhone: order?.customerPhone,
      courierPickup: courierPickupLine || envPickup || undefined,
      courierPhone,
      courierWhatsappPhone,
      courierCarPlate,
      courierCarModel,
    });
    const waDigits = normalizePhoneDigits(courierWhatsappPhone);
    const waText = encodeURIComponent(
      `Salam. BirBuket sifarişi #${orderId} sizə təhvil verildi.\nÇatdırılma məlumatı (kod lazım deyil): ${courierPanelLink}`
    );
    const waLink = waDigits ? `https://wa.me/${waDigits}?text=${waText}` : '';

    setSavingId(orderId);
    setError(null);
    setSuccess(null);
    try {
      await floristService.handoverToCourier(orderId, {
        courierPhone,
        courierWhatsappPhone,
        courierCarPlate,
        courierCarModel,
        courierPanelLink,
      });
      saveCourierHandoverLocal(orderId, {
        courierPhone,
        courierWhatsappPhone,
        courierCarPlate,
        courierCarModel,
        courierPanelLink,
      });
      if (waLink) window.open(waLink, '_blank', 'noopener,noreferrer');
      setSuccess(`#${orderId} sifarişi kuryerə təhvil verildi. WhatsApp link hazırlandı.`);
      await refreshOrders();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Kuryerə təhvil əməliyyatı uğursuz oldu.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f2ea] dark:bg-background-dark">
      <div className="mx-auto max-w-[1200px] space-y-6 px-4 py-8 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black text-[#0d1c12] dark:text-white">Florist paneli</h1>
            <p className="mt-1 text-sm text-floral-muted dark:text-floral-muted-dark">
              Bütün sifarişlər: əvvəl hazırlana bilmə təsdiqi, sonra hazırlandı ilə yekun.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refreshOrders()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-bold text-primary disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Yenilə
            </button>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-600"
            >
              Çıxış
            </button>
          </div>
        </div>

        {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</p> : null}
        {success ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{success}</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveSection('PENDING')}
            className={`rounded-xl px-4 py-2 text-sm font-black transition-colors ${
              activeSection === 'PENDING'
                ? 'bg-primary text-floral-deep'
                : 'border border-floral-muted/25 bg-white text-floral-muted dark:bg-white/5 dark:text-floral-muted-dark'
            }`}
          >
            Gözləyən
            {pendingOrders.length > 0 ? <span className="ml-2 rounded-full bg-white/25 px-2 py-0.5 text-xs tabular-nums">{pendingOrders.length}</span> : null}
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('PREPARING')}
            className={`rounded-xl px-4 py-2 text-sm font-black transition-colors ${
              activeSection === 'PREPARING'
                ? 'bg-amber-500 text-white'
                : 'border border-floral-muted/25 bg-white text-floral-muted dark:bg-white/5 dark:text-floral-muted-dark'
            }`}
          >
            Preparing
            {preparingOrders.length > 0 ? (
              <span className="ml-2 rounded-full bg-white/25 px-2 py-0.5 text-xs tabular-nums">{preparingOrders.length}</span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('READY')}
            className={`rounded-xl px-4 py-2 text-sm font-black transition-colors ${
              activeSection === 'READY'
                ? 'bg-emerald-600 text-white'
                : 'border border-floral-muted/25 bg-white text-floral-muted dark:bg-white/5 dark:text-floral-muted-dark'
            }`}
          >
            Ready / Təhvil verildi
            {readyOrders.length > 0 ? <span className="ml-2 rounded-full bg-white/25 px-2 py-0.5 text-xs tabular-nums">{readyOrders.length}</span> : null}
          </button>
        </div>

        {!loading ? (
          <p className="text-xs font-semibold text-floral-muted/80 dark:text-floral-muted-dark/80">
            Ümumi: {orders.length} • Gözləyən: {pendingOrders.length} • Preparing: {preparingOrders.length} • Ready: {readyOrders.length}
          </p>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center rounded-2xl bg-white/80 p-10 dark:bg-white/5">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : renderedOrders.length === 0 ? (
          <div className="rounded-2xl border border-floral-muted/20 bg-white p-8 text-sm text-floral-muted dark:bg-white/5 dark:text-floral-muted-dark">
            Bu bölmədə sifariş tapılmadı.
          </div>
        ) : (
          <div className="space-y-4">
            {renderedOrders.map((order) => (
              <article key={order.id} className="rounded-2xl border border-floral-muted/20 bg-white p-5 shadow-sm dark:bg-white/5">
                {(() => {
                  const localMeta = readCourierHandoverLocal(order.id);
                  const liveTrackingLink = String(order.courierPanelLink || localMeta.courierPanelLink || '').trim();
                  return liveTrackingLink ? (
                    <a
                      href={liveTrackingLink}
                      target="_blank"
                      rel="noreferrer"
                      className="mb-3 inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-[11px] font-black uppercase tracking-wide text-floral-deep"
                    >
                      Çatdırılmanı canlı izlə
                    </a>
                  ) : null;
                })()}
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-bold text-floral-muted dark:text-floral-muted-dark">
                  <span>#{order.id}</span>
                  {order.orderNumber ? <span>• {order.orderNumber}</span> : null}
                  <span>• {order.status}</span>
                  <span>• {toLocaleDate(order.createdAt)}</span>
                </div>
                <p className="text-sm font-semibold">
                  Ünvan: {order.city || '-'} {order.addressLine ? `• ${order.addressLine}` : ''}
                </p>
                <p className="mt-1 text-sm font-bold text-primary">
                  Məbləğ: {Number.isFinite(order.totalPrice || NaN) ? `${(order.totalPrice || 0).toFixed(2)} AZN` : '-'}
                </p>
                {Array.isArray(order.items) && order.items.length > 0 ? (
                  <ul className="mt-2 space-y-2 text-xs text-floral-muted dark:text-floral-muted-dark">
                    {order.items.map((item, idx) => (
                      <li key={`${order.id}-${idx}`} className="flex items-center gap-2">
                        {(() => {
                          const normalizedImage = normalizeImageUrl(item.image);
                          const thumbSrc = thumbImageMap[normalizedImage] || normalizedImage;
                          return item.image ? (
                            <button
                              type="button"
                              onClick={() => openImage(item.image)}
                              title="Şəkli böyüt"
                              className="shrink-0"
                            >
                              <img
                                src={thumbSrc}
                                alt={item.productName || 'Məhsul'}
                                className="h-9 w-9 rounded-lg object-cover border border-floral-muted/20 hover:opacity-80 transition"
                                referrerPolicy="no-referrer"
                              />
                            </button>
                          ) : (
                            <div className="h-9 w-9 rounded-lg border border-floral-muted/20 bg-floral-muted/10" />
                          );
                        })()}
                        <span className="flex-1">
                          {item.productName || 'Məhsul'} x {Number(item.quantity || 0)}
                          {typeof item.unitPrice === 'number' && Number.isFinite(item.unitPrice) ? (
                            <span className="ml-2 text-[10px] text-floral-muted/70">({item.unitPrice.toFixed(2)} AZN)</span>
                          ) : null}
                          {typeof item.lineTotal === 'number' && Number.isFinite(item.lineTotal) ? (
                            <span className="ml-2 text-[10px] font-semibold text-primary">Cəm: {item.lineTotal.toFixed(2)} AZN</span>
                          ) : null}
                        </span>
                        {item.image ? (
                          <button
                            type="button"
                            onClick={() => openImage(item.image)}
                            disabled={imageOpeningUrl === normalizeImageUrl(item.image)}
                            className="text-[10px] font-bold text-primary underline underline-offset-2"
                          >
                            {imageOpeningUrl === normalizeImageUrl(item.image) ? 'Açılır...' : 'Şəkilə bax'}
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {(() => {
                  const completionImage = normalizeImageUrl(
                    order.floristReadyImageUrl || readyProofPreviewByOrderId[order.id] || ''
                  );
                  if (!completionImage || (!isPreparing(order.status) && !isReady(order.status) && !isWithCourier(order.status))) return null;
                  return (
                    <div className="mt-3 rounded-xl border border-emerald-200/70 bg-emerald-50/40 p-3">
                      <p className="text-[11px] font-black uppercase tracking-wide text-emerald-800">
                        Hazırlanma şəkli
                      </p>
                      <button
                        type="button"
                        onClick={() => openImage(completionImage)}
                        className="mt-2 inline-flex items-center gap-2 text-xs font-bold text-primary underline underline-offset-2"
                      >
                        Şəkilə bax
                      </button>
                    </div>
                  );
                })()}

                <div className="mt-4 flex flex-wrap gap-2">
                  {!isPreparing(order.status) && !isReady(order.status) && !isWithCourier(order.status) ? (
                    <>
                      <button
                        type="button"
                        disabled={savingId === order.id}
                        onClick={() => handleConfirm(order.id, true)}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"
                      >
                        {savingId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Hazırlana bilər
                      </button>
                      <button
                        type="button"
                        disabled={savingId === order.id}
                        onClick={() => handleConfirm(order.id, false)}
                        className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"
                      >
                        {savingId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                        Hazırlana bilməz
                      </button>
                    </>
                  ) : isPreparing(order.status) ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-floral-muted/25 bg-white px-3 py-2 text-xs font-bold text-floral-muted dark:bg-white/5 dark:text-floral-muted-dark">
                        <input
                          type="file"
                          accept="image/*"
                          className="max-w-[180px] text-xs"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            setReadyProofByOrderId((prev) => ({ ...prev, [order.id]: file }));
                            if (!file) {
                              setReadyProofPreviewByOrderId((prev) => ({ ...prev, [order.id]: '' }));
                              return;
                            }
                            void fileToDataUrl(file)
                              .then((dataUrl) => {
                                setReadyProofPreviewByOrderId((prev) => ({ ...prev, [order.id]: dataUrl }));
                              })
                              .catch(() => {
                                setReadyProofPreviewByOrderId((prev) => ({ ...prev, [order.id]: '' }));
                              });
                          }}
                        />
                      </label>
                      {readyProofByOrderId[order.id] ? (
                        <span className="text-[11px] font-semibold text-floral-muted dark:text-floral-muted-dark">
                          {readyProofByOrderId[order.id]?.name}
                        </span>
                      ) : (
                        <span className="text-[11px] text-amber-700 dark:text-amber-300">Şəkil seçilməyib</span>
                      )}
                      <button
                        type="button"
                        disabled={savingId === order.id || !readyProofByOrderId[order.id]}
                        onClick={() => handlePrepared(order.id)}
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-black text-floral-deep disabled:opacity-60"
                      >
                        {savingId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Tamamlandı (READY et)
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-black text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" />
                        {isWithCourier(order.status) ? 'Kuryerə təhvil verildi' : 'Ready'}
                      </span>
                      {!isWithCourier(order.status) ? (
                        <div className="w-full rounded-xl border border-indigo-200 bg-indigo-50/40 p-3">
                          <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-indigo-800">
                            Kuryer məlumatları
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <input
                              type="text"
                              placeholder="Kuryerin mobil nömrəsi"
                              value={courierFormByOrderId[order.id]?.courierPhone || ''}
                              onChange={(e) =>
                                setCourierFormByOrderId((prev) => ({
                                  ...prev,
                                  [order.id]: {
                                    courierPhone: e.target.value,
                                    courierWhatsappPhone: prev[order.id]?.courierWhatsappPhone || '',
                                    courierCarPlate: prev[order.id]?.courierCarPlate || '',
                                    courierCarModel: prev[order.id]?.courierCarModel || '',
                                  },
                                }))
                              }
                              className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs outline-none"
                            />
                            <input
                              type="text"
                              placeholder="WhatsApp nömrəsi"
                              value={courierFormByOrderId[order.id]?.courierWhatsappPhone || ''}
                              onChange={(e) =>
                                setCourierFormByOrderId((prev) => ({
                                  ...prev,
                                  [order.id]: {
                                    courierPhone: prev[order.id]?.courierPhone || '',
                                    courierWhatsappPhone: e.target.value,
                                    courierCarPlate: prev[order.id]?.courierCarPlate || '',
                                    courierCarModel: prev[order.id]?.courierCarModel || '',
                                  },
                                }))
                              }
                              className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs outline-none"
                            />
                            <input
                              type="text"
                              placeholder="Avtomobil nömrəsi"
                              value={courierFormByOrderId[order.id]?.courierCarPlate || ''}
                              onChange={(e) =>
                                setCourierFormByOrderId((prev) => ({
                                  ...prev,
                                  [order.id]: {
                                    courierPhone: prev[order.id]?.courierPhone || '',
                                    courierWhatsappPhone: prev[order.id]?.courierWhatsappPhone || '',
                                    courierCarPlate: e.target.value.toUpperCase(),
                                    courierCarModel: prev[order.id]?.courierCarModel || '',
                                  },
                                }))
                              }
                              className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs outline-none"
                            />
                            <input
                              type="text"
                              placeholder="Avtomobil markası"
                              value={courierFormByOrderId[order.id]?.courierCarModel || ''}
                              onChange={(e) =>
                                setCourierFormByOrderId((prev) => ({
                                  ...prev,
                                  [order.id]: {
                                    courierPhone: prev[order.id]?.courierPhone || '',
                                    courierWhatsappPhone: prev[order.id]?.courierWhatsappPhone || '',
                                    courierCarPlate: prev[order.id]?.courierCarPlate || '',
                                    courierCarModel: e.target.value,
                                  },
                                }))
                              }
                              className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs outline-none"
                            />
                          </div>
                          <button
                            type="button"
                            disabled={savingId === order.id}
                            onClick={() => handleHandoverToCourier(order.id)}
                            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"
                          >
                            {savingId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            Kuryerə təhvil ver
                          </button>
                        </div>
                      ) : (
                        <span className="inline-flex items-center rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700">
                          Qalan hissə kuryer panelindən idarə olunur
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        {viewerImageUrl ? (
          <div
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4"
            onClick={() => {
              if (viewerImageUrl.startsWith('blob:')) URL.revokeObjectURL(viewerImageUrl);
              setViewerImageUrl(null);
            }}
          >
            <div
              className="relative max-h-[90vh] w-full max-w-5xl rounded-xl bg-white p-2 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  if (viewerImageUrl.startsWith('blob:')) URL.revokeObjectURL(viewerImageUrl);
                  setViewerImageUrl(null);
                }}
                className="absolute right-2 top-2 rounded-lg bg-black/70 px-3 py-1 text-xs font-black text-white"
              >
                Bağla
              </button>
              <img src={viewerImageUrl} alt="Məhsul şəkli" className="max-h-[86vh] w-full rounded-lg object-contain" />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
