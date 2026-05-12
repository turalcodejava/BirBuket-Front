import { CheckCircle2, Loader2, Package, Phone, RefreshCw, Truck } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { courierService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import UserCourierChatModal from './UserCourierChatModal';

type CourierOrder = {
  id: number;
  orderNumber?: string;
  status: string;
  customerUserId?: number;
  courierUserId?: number;
  courierPhone?: string;
  courierWhatsappPhone?: string;
  courierCarPlate?: string;
  courierCarModel?: string;
  courierPanelLink?: string;
  handoverAt?: string;
  customerPhone?: string;
  createdAt?: string;
  totalPrice?: number;
  addressLine?: string;
  city?: string;
  items?: Array<{
    productName?: string;
    quantity?: number;
  }>;
};

const readCourierHandoverLocal = (orderId: number) => {
  const key = 'birbuket_courier_handover_v1';
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, any>;
    return parsed[String(orderId)] || {};
  } catch {
    return {};
  }
};

const extractOrderRows = (payload: any): any[] => {
  if (!payload) return [];
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.data?.content)) return payload.data.content;
  if (Array.isArray(payload?.data?.data?.content)) return payload.data.data.content;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.orders)) return payload.orders;
  if (Array.isArray(payload?.data?.orders)) return payload.data.orders;
  if (Array.isArray(payload?.data?.data?.orders)) return payload.data.data.orders;
  if (Array.isArray(payload)) return payload;
  return [];
};

const normalizeKey = (s?: string) =>
  String(s || '')
    .toUpperCase()
    .replace(/[\s-]+/g, '_');

const coalesceText = (...vals: unknown[]) => {
  for (const v of vals) {
    const t = String(v ?? '').trim();
    if (t) return t;
  }
  return '';
};

const toNum = (v: unknown): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return Number(v.trim());
  return 0;
};

const parseOrder = (row: any): CourierOrder => {
  const root =
    row?.data && typeof row.data === 'object'
      ? row.data
      : row;
  const source =
    row?.order && typeof row.order === 'object'
      ? row.order
      : row?.data && typeof row.data === 'object'
        ? row.data
        : row;
  const combined = { ...(root || {}), ...(source || {}) } as Record<string, unknown>;
  const deliveryObj =
    combined?.delivery && typeof combined.delivery === 'object'
      ? (combined.delivery as Record<string, unknown>)
      : null;
  const itemRows = Array.isArray(source?.items)
    ? source.items
    : Array.isArray(source?.orderItems)
      ? source.orderItems
      : [];
  return {
    id: Number(combined?.orderId ?? combined?.order_id ?? combined?.id ?? combined?.orderID ?? 0),
    orderNumber: coalesceText(combined?.orderNumber, combined?.number),
    status: normalizeKey(coalesceText(combined?.status, combined?.orderStatus, 'PENDING')),
    customerUserId:
      toNum(combined?.customerUserId ?? combined?.customer_user_id ?? combined?.userId ?? combined?.buyerUserId) ||
      undefined,
    courierUserId:
      toNum(combined?.courierUserId ?? combined?.courier_user_id ?? combined?.assignedCourierUserId) ||
      undefined,
    courierPhone: coalesceText(combined?.courierPhone, combined?.courierMobile, combined?.courier_phone),
    courierWhatsappPhone: coalesceText(
      combined?.courierWhatsappPhone,
      combined?.courierWhatsapp,
      combined?.courier_whatsapp_phone
    ),
    courierCarPlate: coalesceText(combined?.courierCarPlate, combined?.carPlate, combined?.courier_car_plate),
    courierCarModel: coalesceText(combined?.courierCarModel, combined?.carModel, combined?.courier_car_model),
    courierPanelLink: coalesceText(
      combined?.courierPanelLink,
      combined?.trackingUrl,
      combined?.trackingLink,
      combined?.publicTrackingUrl,
      combined?.courier_panel_link
    ),
    handoverAt: String(
      coalesceText(combined?.handoverAt, combined?.courierHandoverAt, combined?.handover_at)
    ),
    customerPhone: coalesceText(
      combined?.customerPhoneDigits,
      combined?.customer_phone_digits,
      combined?.customerPhone,
      combined?.recipientPhone,
      combined?.receiverPhone,
      combined?.buyerPhone,
      combined?.phone,
      combined?.contactPhone,
      combined?.customer_phone,
      deliveryObj?.phone
    ),
    createdAt: coalesceText(combined?.createdAt, combined?.createdDate, combined?.date),
    totalPrice: Number(combined?.totalPrice ?? combined?.amount ?? 0),
    addressLine: coalesceText(
      combined?.addressLine,
      combined?.deliveryAddress,
      combined?.fullAddress,
      deliveryObj?.addressLine,
      deliveryObj?.line1
    ),
    city: coalesceText(combined?.city, deliveryObj?.city),
    items: itemRows.map((it: any) => ({
      productName: String(it?.productName || it?.title || it?.name || 'Məhsul'),
      quantity: Number(it?.quantity || 0),
    })),
  };
};

const toLocaleDate = (value?: string) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('az-AZ');
};

const isDelivered = (status?: string) => {
  const s = normalizeKey(status);
  return ['DELIVERED', 'COMPLETED', 'DONE', 'CATDIRILDI'].includes(s) || s.includes('DELIVERED');
};

const isCancelledOrder = (status?: string) => {
  const s = normalizeKey(status);
  return s.includes('CANCEL') || s.includes('REFUND') || s.includes('REJECT');
};

const digitsOnly = (raw: string) => raw.replace(/\D/g, '').replace(/^00/, '');
const coord5 = (n: number) => Number(n.toFixed(5));

const dedupeOrders = (list: CourierOrder[]): CourierOrder[] => {
  const map = new Map<number, CourierOrder>();
  for (const o of list) {
    if (!o.id) continue;
    if (!map.has(o.id)) map.set(o.id, o);
  }
  return Array.from(map.values());
};

export default function CourierPanel() {
  const { logout, user, userId } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [orders, setOrders] = useState<CourierOrder[]>([]);
  const [tab, setTab] = useState<'ACTIVE' | 'DONE'>('ACTIVE');
  const [chatOrderId, setChatOrderId] = useState<number | null>(null);
  const [chatOrderNo, setChatOrderNo] = useState<string>('');
  const latestCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const [gpsState, setGpsState] = useState<'idle' | 'watching' | 'denied' | 'error'>('idle');
  const [lastPushInfo, setLastPushInfo] = useState<string>('');

  const refreshOrders = async (opts?: { cacheBust?: boolean }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await courierService.getCourierOrders({ cacheBust: opts?.cacheBust === true });
      const rows = extractOrderRows(res?.raw ?? res?.data ?? res);
      const parsed = dedupeOrders(rows.map(parseOrder).filter((x) => x.id > 0));
      setOrders(parsed);
    } catch (err: any) {
      setError(
        typeof err?.message === 'string' && err.message
          ? err.message
          : err?.response?.data?.message || 'Sifarişlər yüklənmədi.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshOrders().catch(console.error);
  }, []);

  /** Backend status adları müxtəlif ola bilər — kuryer endpoint-indən gələnləri “aktiv” say */
  const activeOrders = useMemo(
    () =>
      orders
        .filter((o) => !isDelivered(o.status) && !isCancelledOrder(o.status))
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()),
    [orders]
  );

  const deliveredOrders = useMemo(
    () =>
      orders
        .filter((o) => isDelivered(o.status))
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()),
    [orders]
  );

  const visibleList = tab === 'ACTIVE' ? activeOrders : deliveredOrders;
  const activeOrderIds = useMemo(
    () => activeOrders.map((o) => o.id).filter((id) => Number.isFinite(id) && id > 0),
    [activeOrders]
  );

  useEffect(() => {
    if (activeOrderIds.length === 0) {
      setGpsState('idle');
      setLastPushInfo('');
      return;
    }
    if (!('geolocation' in navigator)) {
      setGpsState('error');
      setError('Bu cihazda geolocation dəstəklənmir.');
      return;
    }

    let stopped = false;
    let watchId: number | null = null;

    const pushLocation = async () => {
      if (stopped) return;
      const current = latestCoordsRef.current;
      if (!current) return;
      const payload = {
        courierLatitude: coord5(current.lat),
        courierLongitude: coord5(current.lng),
      };
      const jobs = activeOrderIds.map((orderId) => courierService.updateLocation(orderId, payload));
      const results = await Promise.allSettled(jobs);
      if (stopped) return;
      const okCount = results.filter((r) => r.status === 'fulfilled').length;
      const fail = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
      if (okCount > 0) {
        setLastPushInfo(`${okCount} sifariş üçün konum göndərildi (${new Date().toLocaleTimeString('az-AZ')}).`);
        if (error?.includes('Konum göndərilməsi alınmadı')) setError(null);
      } else if (fail) {
        const msg =
          (fail.reason as any)?.response?.data?.message ||
          (fail.reason as any)?.message ||
          'Konum push alınmadı.';
        setError(`Konum göndərilməsi alınmadı: ${msg}`);
      }
    };

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        latestCoordsRef.current = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setGpsState('watching');
        pushLocation().catch(() => {
          //
        });
      },
      (geoErr) => {
        if (stopped) return;
        if (geoErr.code === geoErr.PERMISSION_DENIED) {
          setGpsState('denied');
          setError('GPS icazəsi verilməyib. Kuryer konumu üçün location icazəsini açın.');
        } else {
          setGpsState('error');
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 8000,
        timeout: 12000,
      }
    );

    const intervalId = window.setInterval(() => {
      pushLocation().catch(() => {
        //
      });
    }, 12000);

    return () => {
      stopped = true;
      window.clearInterval(intervalId);
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
    };
  }, [activeOrderIds]);

  const handleDelivered = async (orderId: number) => {
    setSavingId(orderId);
    setError(null);
    setSuccess(null);
    try {
      await courierService.markDelivered(orderId);
      setSuccess(`Sifariş #${orderId} çatdırıldı kimi paneldə təsdiqləndi və serverdə yeniləndi.`);
      await refreshOrders({ cacheBust: true });
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Çatdırıldı əməliyyatı uğursuz oldu.');
    } finally {
      setSavingId(null);
    }
  };

  const courierLabel = user?.username || user?.email || user?.phoneNumber || 'Kuryer';

  const renderCustomerActions = (order: CourierOrder) => {
    const phone = order.customerPhone?.trim();
    if (!phone) return <p className="text-[11px] text-floral-muted">Müştəri telefonu siyahıda yoxdur.</p>;
    const d = digitsOnly(phone);
    const tel = phone.startsWith('tel:') ? phone : `tel:${phone}`;
    const wa = d.length >= 9 ? `https://wa.me/${d}` : '';
    return (
      <div className="flex flex-wrap gap-2">
        <a
          href={tel}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
        >
          <Phone className="h-3.5 w-3.5" />
          Alıcıya zəng
        </a>
        {wa ? (
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 text-[11px] font-bold text-primary"
          >
            WhatsApp (alıcı)
          </a>
        ) : null}
      </div>
    );
  };

  const renderOrderCard = (order: CourierOrder, delivered: boolean) => {
    const local = readCourierHandoverLocal(order.id) as Record<string, string>;
    const courierPhone = order.courierPhone || local.courierPhone || '';
    const courierWhatsapp = order.courierWhatsappPhone || local.courierWhatsappPhone || '';
    const courierPlate = order.courierCarPlate || local.courierCarPlate || '';
    const courierModel = order.courierCarModel || local.courierCarModel || '';
    const trackingLink = order.courierPanelLink || local.courierPanelLink || '';
    const fullAddress = `${order.city || ''} ${order.addressLine || ''}`.trim() || '-';

    return (
      <article
        key={`${delivered ? 'd' : 'a'}-${order.id}`}
        className={`flex flex-col rounded-2xl border p-5 shadow-sm ${
          delivered
            ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/15'
            : 'border-floral-muted/20 bg-white dark:border-white/10 dark:bg-white/5'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-floral-muted/15 pb-3 dark:border-white/10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-lg bg-primary/15 px-2 py-1 text-xs font-black text-primary">
              <Package className="h-3.5 w-3.5" />
              #{order.id}
            </span>
            {order.orderNumber ? (
              <span className="text-xs font-semibold text-floral-muted dark:text-floral-muted-dark">{order.orderNumber}</span>
            ) : null}
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {order.status}
            </span>
          </div>
          <span className="text-[11px] font-medium text-floral-muted dark:text-floral-muted-dark">{toLocaleDate(order.createdAt)}</span>
        </div>

        {!delivered ? (
          <div className="mt-3 rounded-xl border border-indigo-200/80 bg-indigo-50/50 p-3 text-[11px] dark:border-indigo-900/50 dark:bg-indigo-950/20">
            <p className="font-black uppercase tracking-wide text-indigo-800 dark:text-indigo-200">Bu sifarişə təyin (florist qeydi)</p>
            <div className="mt-2 grid gap-1 sm:grid-cols-2">
              <p>Mobil: {courierPhone || '—'}</p>
              <p>WhatsApp: {courierWhatsapp || '—'}</p>
              <p>Avtomobil: {courierPlate || '—'}</p>
              <p>Marka: {courierModel || '—'}</p>
            </div>
            {order.handoverAt ? (
              <p className="mt-2 text-[10px] text-indigo-700/90 dark:text-indigo-300">Təhvil vaxtı: {toLocaleDate(order.handoverAt)}</p>
            ) : null}
            {trackingLink ? (
              <a href={trackingLink} target="_blank" rel="noreferrer" className="mt-2 inline-block font-bold text-primary underline">
                İzləmə linki
              </a>
            ) : (
              <p className="mt-2 text-[10px] text-slate-500">İzləmə linki WhatsApp mesajından götürülə bilər.</p>
            )}
          </div>
        ) : null}

        <div className="mt-3">
          <p className="text-xs font-bold text-floral-muted dark:text-floral-muted-dark">Çatdırılma ünvanı</p>
          <p className="mt-1 text-sm font-semibold leading-snug">{fullAddress}</p>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div>
            <p className="text-xs font-bold text-floral-muted">Məbləğ</p>
            <p className="text-sm font-black text-primary">
              {Number.isFinite(order.totalPrice || NaN) ? `${(order.totalPrice || 0).toFixed(2)} AZN` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold text-floral-muted">Alıcı</p>
            {renderCustomerActions(order)}
          </div>
        </div>

        {order.items && order.items.length > 0 ? (
          <div className="mt-3 rounded-lg border border-floral-muted/15 bg-[#fcfaf6] p-3 text-xs dark:bg-slate-900/40">
            <p className="mb-2 font-black text-[#0d1c12] dark:text-white">Məhsullar</p>
            <ul className="space-y-1 text-floral-muted dark:text-floral-muted-dark">
              {order.items.map((item, idx) => (
                <li key={idx}>
                  {item.productName} × {item.quantity || 0}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!delivered ? (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => {
                setChatOrderId(order.id);
                setChatOrderNo(order.orderNumber || String(order.id));
              }}
              className="inline-flex w-full min-h-[46px] items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-black text-primary sm:w-auto sm:justify-start"
            >
              <Phone className="h-4 w-4 shrink-0" />
              User ilə chat
            </button>
            <button
              type="button"
              disabled={savingId === order.id}
              onClick={() => void handleDelivered(order.id)}
              className="inline-flex w-full min-h-[46px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white shadow-sm disabled:opacity-60 sm:w-auto sm:justify-start"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Çatdırıldı
            </button>
          </div>
        ) : (
          <p className="mt-3 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">Bu sifariş tamamlanıb.</p>
        )}
      </article>
    );
  };

  return (
    <div className="min-h-screen bg-[#f6f2ea] dark:bg-background-dark">
      <div className="mx-auto max-w-[1200px] space-y-6 px-4 py-8 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black text-[#0d1c12] dark:text-white">Kuryer paneli</h1>
            <p className="mt-1 max-w-2xl text-sm text-floral-muted dark:text-floral-muted-dark">
              Eyni anda bir neçə sifariş ola bilər — hər biri ayrı kartda görünür. Backend <code className="text-xs font-mono">courier-view</code> /
              <code className="text-xs font-mono">courier/my</code> ilə yalnız sizə təyin olunanları qaytarmalıdır.
            </p>
            <p className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
              <Truck className="mr-1 inline h-3.5 w-3.5" />
              {courierLabel}
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-400">
              GPS status:{' '}
              {gpsState === 'watching'
                ? 'Aktiv (canlı göndərilir)'
                : gpsState === 'denied'
                  ? 'İcazə verilməyib'
                  : gpsState === 'error'
                    ? 'Xəta'
                    : 'Gözləmə'}
            </p>
            {lastPushInfo ? <p className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-300">{lastPushInfo}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refreshOrders({ cacheBust: true })}
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

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 dark:bg-red-950/30">{error}</p>
        ) : null}
        {success ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:bg-emerald-950/40">
            {success}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab('ACTIVE')}
            className={`rounded-xl px-4 py-2 text-sm font-black transition-colors ${
              tab === 'ACTIVE'
                ? 'bg-amber-500 text-white'
                : 'border border-floral-muted/25 bg-white text-floral-muted dark:bg-white/5 dark:text-floral-muted-dark'
            }`}
          >
            Aktiv çatdırılma
            {activeOrders.length > 0 ? (
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs tabular-nums ${tab === 'ACTIVE' ? 'bg-white/25' : 'bg-amber-100 dark:bg-amber-900/40'}`}>
                {activeOrders.length}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setTab('DONE')}
            className={`rounded-xl px-4 py-2 text-sm font-black transition-colors ${
              tab === 'DONE'
                ? 'bg-emerald-600 text-white'
                : 'border border-floral-muted/25 bg-white text-floral-muted dark:bg-white/5 dark:text-floral-muted-dark'
            }`}
          >
            Çatdırılmış
            {deliveredOrders.length > 0 ? (
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs tabular-nums ${tab === 'DONE' ? 'bg-white/25' : 'bg-emerald-100 dark:bg-emerald-900/40'}`}>
                {deliveredOrders.length}
              </span>
            ) : null}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center rounded-2xl bg-white/80 p-12 dark:bg-white/5">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : visibleList.length === 0 ? (
          <div className="rounded-2xl border border-floral-muted/20 bg-white p-10 text-center text-sm text-floral-muted dark:bg-white/5 dark:text-floral-muted-dark">
            {tab === 'ACTIVE'
              ? 'Aktiv çatdırılacaq sifariş yoxdur. Florist tərəfdən “Kuryerə təhvil ver” olunandan sonra burada görünəcək.'
              : 'Hələ çatdırılmış sifariş qeydə alınmayıb.'}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {visibleList.map((order) => renderOrderCard(order, tab === 'DONE'))}
          </div>
        )}
      </div>
      {chatOrderId ? (
        <UserCourierChatModal
          open={chatOrderId > 0}
          orderId={chatOrderId}
          selfRole="courier"
          selfUserId={userId}
          customerUserId={orders.find((o) => o.id === chatOrderId)?.customerUserId || null}
          courierUserId={userId}
          title={`Sifariş #${chatOrderNo} — User chat`}
          onClose={() => {
            setChatOrderId(null);
            setChatOrderNo('');
          }}
        />
      ) : null}

    </div>
  );
}
