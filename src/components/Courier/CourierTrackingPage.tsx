import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { orderPublicTrackingService } from '../../services/api';
import { geocodeAddressNominatim } from '../../utils/geocodeNominatim';
import {
  normalizePhoneDigits,
  verifyCourierInviteLinkToken,
  verifyCourierTrackingAccess,
} from '../../utils/courierTrackingToken';
import CourierTrackingMap from './CourierTrackingMap';
import UserCourierChatModal from './UserCourierChatModal';
import { useAuth } from '../../context/AuthContext';

const normCoord = (v?: string) => String(v ?? '').trim().replace(',', '.');

const pairFromStrings = (latStr?: string, lngStr?: string): [number, number] | null => {
  const la = normCoord(latStr);
  const lo = normCoord(lngStr);
  if (!la || !lo) return null;
  const a = Number(la);
  const b = Number(lo);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (Math.abs(a) <= 90 && Math.abs(b) <= 180) return [a, b];
  if (Math.abs(b) <= 90 && Math.abs(a) <= 180) return [b, a];
  return null;
};

const coalesce = (...vals: Array<string | undefined | null>) => {
  for (const v of vals) {
    const t = String(v ?? '').trim();
    if (t) return t;
  }
  return '';
};

const TRACK_PRIMARY = '#d41152';

const trackingBrandName = () =>
  (typeof import.meta !== 'undefined' && String(import.meta.env.VITE_TRACKING_BRAND_NAME || '').trim()) ||
  'BirBuket';

const initialsFromName = (name: string) => {
  const p = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const a = (p[0]?.[0] || 'K').toUpperCase();
  const b = p[1]?.[0]?.toUpperCase();
  return (a + (b || '')).slice(0, 2);
};

type ApiTrackingSnap = {
  status?: string;
  orderNumber?: string;
  city?: string;
  addressLine?: string;
  deliveryAddress?: string;
  customerPhone?: string;
  customerPhoneDigits?: string;
  recipientPhone?: string;
  customerLatitude?: string;
  customerLongitude?: string;
  courierPhone?: string;
  courierWhatsappPhone?: string;
  courierLatitude?: string;
  courierLongitude?: string;
  courierPickupAddress?: string;
  courierCarPlate?: string;
  courierCarModel?: string;
  courierName?: string;
  customerUserId?: string;
  courierUserId?: string;
};

const mergeApiSnapPreserve = (prev: ApiTrackingSnap | null, next: ApiTrackingSnap): ApiTrackingSnap => {
  const out: ApiTrackingSnap = { ...(prev || {}) };
  (Object.keys(next) as (keyof ApiTrackingSnap)[]).forEach((key) => {
    const v = next[key];
    if (v !== undefined && String(v).trim() !== '') {
      (out as Record<string, string | undefined>)[key] = v;
    }
  });
  return out;
};

const strField = (x: unknown) => (x === undefined || x === null ? '' : String(x).trim());

const pickLatLngStrings = (o: Record<string, unknown>): { lat: string; lng: string } => {
  const pairs: Array<[unknown, unknown]> = [
    [o.courierLatitude, o.courierLongitude],
    [o.courierLat, o.courierLng],
    [o.latitude, o.longitude],
    [o.lat, o.lng],
    [o.driverLatitude, o.driverLongitude],
  ];
  for (const nestKey of ['courier', 'driver', 'tracking', 'liveTracking', 'courierLocation']) {
    const n = o[nestKey];
    if (!n || typeof n !== 'object') continue;
    const z = n as Record<string, unknown>;
    pairs.push([z.latitude, z.longitude], [z.lat, z.lng]);
  }
  const loc = o.courierLocation;
  if (loc && typeof loc === 'object') {
    const L = loc as Record<string, unknown>;
    if (String(L.type) === 'Point' && Array.isArray(L.coordinates) && L.coordinates.length >= 2) {
      const lng = normCoord(String(L.coordinates[0]));
      const lat = normCoord(String(L.coordinates[1]));
      if (lat && lng) return { lat, lng };
    }
  }
  for (const [a, b] of pairs) {
    const la = normCoord(String(a ?? ''));
    const lo = normCoord(String(b ?? ''));
    if (la && lo && Number.isFinite(Number(la)) && Number.isFinite(Number(lo))) {
      const lat = Number(la);
      const lng = Number(lo);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat: la, lng: lo };
    }
  }
  return { lat: '', lng: '' };
};

const normalizePublicTracking = (raw: unknown): ApiTrackingSnap | null => {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const root =
    'data' in p && typeof p.data === 'object' && p.data ? (p.data as Record<string, unknown>) : p;
  const orderSlice =
    root.order && typeof root.order === 'object' ? (root.order as Record<string, unknown>) : null;
  const merged: Record<string, unknown> =
    orderSlice !== null ? { ...root, ...orderSlice } : { ...root };
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = strField(merged[k]);
      if (v) return v;
      if (orderSlice) {
        const v2 = strField(orderSlice[k]);
        if (v2) return v2;
      }
      const v3 = strField(root[k]);
      if (v3) return v3;
    }
    return '';
  };
  const { lat: cLat, lng: cLng } = pickLatLngStrings(merged);
  const courierPickupAddress = pick(
    'courierPickupAddress',
    'pickupAddress',
    'pickup_address',
    'floristAddress',
    'shopAddress'
  );
  return {
    status: pick('status', 'orderStatus'),
    orderNumber: pick('orderNumber', 'number'),
    city: pick('city'),
    addressLine: pick('addressLine', 'fullAddress'),
    deliveryAddress: pick('deliveryAddress', 'address'),
    customerPhoneDigits: pick('customerPhoneDigits', 'customer_phone_digits'),
    customerPhone: pick(
      'customerPhone',
      'recipientPhone',
      'receiverPhone',
      'buyerPhone',
      'customer_phone'
    ),
    recipientPhone: pick('recipientPhone'),
    customerLatitude: pick('customerLatitude', 'deliveryLatitude'),
    customerLongitude: pick('customerLongitude', 'deliveryLongitude'),
    courierPhone: pick('courierPhone', 'courierMobile'),
    courierWhatsappPhone: pick('courierWhatsappPhone', 'courierWhatsapp'),
    courierLatitude: cLat || undefined,
    courierLongitude: cLng || undefined,
    courierPickupAddress: courierPickupAddress || undefined,
    courierCarPlate: pick('courierCarPlate', 'carPlate'),
    courierCarModel: pick('courierCarModel', 'carModel'),
    courierName: pick('courierName'),
    customerUserId: pick('customerUserId', 'customer_user_id', 'userId'),
    courierUserId: pick('courierUserId', 'courier_user_id', 'assignedCourierUserId'),
  };
};

const readSearch = (search: string) => {
  const p = new URLSearchParams(search);
  return {
    orderId: p.get('orderId') || '',
    access: p.get('access') || '',
    orderNumber: p.get('orderNumber') || '',
    customerAddress: p.get('address') || '',
    customerPhone: p.get('customerPhone') || '',
    customerPhoneDigits: p.get('customerPhoneDigits') || p.get('customer_phone_digits') || '',
    customerLat: p.get('customerLat') || p.get('deliveryLat') || '',
    customerLng: p.get('customerLng') || p.get('deliveryLng') || '',
    courierLat: p.get('courierLat') || p.get('courierLatitude') || p.get('driverLat') || '',
    courierLng: p.get('courierLng') || p.get('courierLongitude') || p.get('driverLng') || '',
    customerUserId: p.get('customerUserId') || p.get('customer_user_id') || '',
    courierUserId: p.get('courierUserId') || p.get('courier_user_id') || '',
    courierPickupAddress: p.get('courierPickup') || p.get('pickupAddress') || '',
    courierName: p.get('courierName') || 'Kuryer',
    courierPhoneLegacy: p.get('courierPhone') || '',
    courierWhatsappLegacy: p.get('courierWhatsapp') || '',
    courierCarPlate: p.get('courierCarPlate') || '',
    courierCarModel: p.get('courierCarModel') || '',
    status: p.get('status') || 'WITH_COURIER',
  };
};

const normalizeStatus = (raw?: string) =>
  String(raw || '')
    .toUpperCase()
    .trim();

const statusTitle = (status?: string) => {
  const s = normalizeStatus(status);
  if (s.includes('DELIVERED') || s.includes('COMPLETED')) return 'Çatdırıldı';
  if (s.includes('WITH_COURIER') || s.includes('ON_THE_WAY') || s.includes('IN_DELIVERY')) return 'Kuryer yoldadır';
  if (s.includes('READY') || s.includes('PREPARED')) return 'Buket hazırlandı';
  return 'Aktiv';
};

const sessionKeyFor = (orderId: string, access: string) =>
  `birbuket_tracking_ok_${orderId}_${access.slice(0, 16)}`;

export default function CourierTrackingPage() {
  const { search } = useLocation();
  const { userId } = useAuth();
  const data = useMemo(() => readSearch(search), [search]);

  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [inviteLinkUnlocked, setInviteLinkUnlocked] = useState(false);
  const [inviteCheckDone, setInviteCheckDone] = useState(false);
  const [apiSnap, setApiSnap] = useState<ApiTrackingSnap | null>(null);
  const [apiSnapTried, setApiSnapTried] = useState(false);
  const [deliveryCoords, setDeliveryCoords] = useState<[number, number] | null>(null);
  const [deliveryGeocoding, setDeliveryGeocoding] = useState(false);
  const [courierGeoCoords, setCourierGeoCoords] = useState<[number, number] | null>(null);
  const [courierGeocoding, setCourierGeocoding] = useState(false);

  const requiresUnlock = Boolean(data.access || data.courierPhoneLegacy || data.courierWhatsappLegacy);
  const isUnlocked = verifiedPhone.length > 0 || inviteLinkUnlocked;

  const tryRestoreSession = useCallback(() => {
    if (!data.orderId || !data.access) return false;
    try {
      const raw = sessionStorage.getItem(sessionKeyFor(data.orderId, data.access));
      if (raw) {
        setVerifiedPhone(raw);
        return true;
      }
    } catch {
      //
    }
    return false;
  }, [data.orderId, data.access]);

  useEffect(() => {
    if (data.access && data.orderId) tryRestoreSession();
  }, [data.access, data.orderId, tryRestoreSession]);

  useEffect(() => {
    if (!data.orderId || !data.access) {
      setInviteCheckDone(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const ok = await verifyCourierInviteLinkToken(data.orderId, data.access);
      if (!cancelled) {
        if (ok) setInviteLinkUnlocked(true);
        setInviteCheckDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data.orderId, data.access]);

  useEffect(() => {
    setApiSnap(null);
    setApiSnapTried(false);
    setDeliveryCoords(null);
    setDeliveryGeocoding(false);
    setCourierGeoCoords(null);
    setCourierGeocoding(false);
  }, [data.orderId, data.access]);

  useEffect(() => {
    if (!isUnlocked || !data.orderId) return;
    if (!data.access) {
      setApiSnapTried(true);
      return;
    }
    let cancelled = false;
    setApiSnapTried(false);
    orderPublicTrackingService
      .getSnapshot(Number(data.orderId), data.access)
      .then((raw) => {
        if (cancelled) return;
        const n = normalizePublicTracking(raw);
        if (n) setApiSnap(n);
      })
      .catch(() => {
        //
      })
      .finally(() => {
        if (!cancelled) setApiSnapTried(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isUnlocked, data.orderId, data.access]);

  useEffect(() => {
    if (!isUnlocked || !data.orderId || !data.access) return;
    const id = window.setInterval(() => {
      orderPublicTrackingService.getSnapshot(Number(data.orderId), data.access).then((raw) => {
        const n = normalizePublicTracking(raw);
        if (!n) return;
        setApiSnap((prev) => mergeApiSnapPreserve(prev, n));
      });
    }, 14000);
    return () => window.clearInterval(id);
  }, [isUnlocked, data.orderId, data.access]);

  const handleUnlock = async (e: FormEvent) => {
    e.preventDefault();
    setUnlockError(null);
    const digits = normalizePhoneDigits(phoneInput);
    if (digits.length < 9) {
      setUnlockError('Düzgün mobil nömrə daxil edin (məs. 501234567).');
      return;
    }
    setUnlocking(true);
    try {
      if (data.access && data.orderId) {
        const ok = await verifyCourierTrackingAccess(data.orderId, data.access, phoneInput);
        if (!ok) {
          setUnlockError('Nömrə bu sifariş linki ilə uyğun gəlmir.');
          return;
        }
        const normalized = phoneInput.trim().startsWith('+') ? phoneInput.trim() : `+${digits}`;
        setVerifiedPhone(normalized);
        try {
          sessionStorage.setItem(sessionKeyFor(data.orderId, data.access), normalized);
        } catch {
          //
        }
        return;
      }
      const legacyTarget = normalizePhoneDigits(
        data.courierWhatsappLegacy || data.courierPhoneLegacy || ''
      );
      if (legacyTarget && digits === legacyTarget) {
        setVerifiedPhone(phoneInput.trim());
        return;
      }
      setUnlockError('Link köhnə formatdadır və ya nömrə yanlışdır.');
    } finally {
      setUnlocking(false);
    }
  };

  const displayPhone = coalesce(
    verifiedPhone,
    inviteLinkUnlocked ? data.courierWhatsappLegacy || data.courierPhoneLegacy : '',
    apiSnap?.courierWhatsappPhone || apiSnap?.courierPhone
  );
  const telHref = displayPhone ? `tel:${displayPhone.replace(/\s/g, '')}` : '';

  const merged = useMemo(() => {
    const addrFromSnap = coalesce(
      `${apiSnap?.city || ''} ${apiSnap?.addressLine || ''}`.trim(),
      apiSnap?.deliveryAddress
    );
    return {
      orderNumber: coalesce(apiSnap?.orderNumber, data.orderNumber),
      status: coalesce(apiSnap?.status, data.status),
      customerAddress: coalesce(addrFromSnap, data.customerAddress),
      customerPhone: coalesce(
        apiSnap?.customerPhoneDigits,
        data.customerPhoneDigits,
        apiSnap?.customerPhone,
        apiSnap?.recipientPhone,
        data.customerPhone
      ),
      courierCarPlate: coalesce(apiSnap?.courierCarPlate, data.courierCarPlate),
      courierCarModel: coalesce(apiSnap?.courierCarModel, data.courierCarModel),
      courierName: coalesce(apiSnap?.courierName, data.courierName),
    };
  }, [data, apiSnap]);

  const courierGpsCoords = useMemo(
    () =>
      pairFromStrings(apiSnap?.courierLatitude, apiSnap?.courierLongitude) ||
      pairFromStrings(data.courierLat, data.courierLng),
    [data.courierLat, data.courierLng, apiSnap?.courierLatitude, apiSnap?.courierLongitude]
  );

  const courierPickupForGeocode = useMemo(
    () => coalesce(apiSnap?.courierPickupAddress, data.courierPickupAddress),
    [apiSnap?.courierPickupAddress, data.courierPickupAddress]
  );

  useEffect(() => {
    let cancelled = false;
    if (courierGpsCoords) {
      setCourierGeoCoords(null);
      setCourierGeocoding(false);
      return () => {
        cancelled = true;
      };
    }
    const addr = courierPickupForGeocode.trim();
    if (!addr) {
      setCourierGeoCoords(null);
      setCourierGeocoding(false);
      return () => {
        cancelled = true;
      };
    }
    setCourierGeocoding(true);
    geocodeAddressNominatim(addr).then((pos) => {
      if (cancelled) return;
      setCourierGeoCoords(pos);
      setCourierGeocoding(false);
    });
    return () => {
      cancelled = true;
    };
  }, [courierGpsCoords, courierPickupForGeocode]);

  const courierCoords = useMemo(() => courierGpsCoords || courierGeoCoords, [courierGpsCoords, courierGeoCoords]);
  const courierIsApproxGeocode = Boolean(!courierGpsCoords && courierGeoCoords);

  useEffect(() => {
    let cancelled = false;
    const preset =
      pairFromStrings(apiSnap?.customerLatitude, apiSnap?.customerLongitude) ||
      pairFromStrings(data.customerLat, data.customerLng);
    if (preset) {
      setDeliveryCoords(preset);
      setDeliveryGeocoding(false);
      return () => {
        cancelled = true;
      };
    }
    const addr = merged.customerAddress.trim();
    if (!addr) {
      setDeliveryCoords(null);
      setDeliveryGeocoding(false);
      return () => {
        cancelled = true;
      };
    }
    setDeliveryGeocoding(true);
    geocodeAddressNominatim(addr).then((pos) => {
      if (cancelled) return;
      setDeliveryCoords(pos);
      setDeliveryGeocoding(false);
    });
    return () => {
      cancelled = true;
    };
  }, [
    merged.customerAddress,
    data.customerLat,
    data.customerLng,
    apiSnap?.customerLatitude,
    apiSnap?.customerLongitude,
  ]);

  const mapDeliveryLine = useMemo(() => {
    const t = merged.customerAddress.trim();
    if (!t) return '';
    return t.length > 160 ? `${t.slice(0, 157)}…` : t;
  }, [merged.customerAddress]);

  const deliveryWazeHref = useMemo(() => {
    if (deliveryCoords) {
      const [lat, lng] = deliveryCoords;
      return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
    }
    const q = merged.customerAddress.trim();
    if (q) return `https://waze.com/ul?q=${encodeURIComponent(q)}&navigate=yes`;
    return '';
  }, [deliveryCoords, merged.customerAddress]);

  const mapCourierLine = useMemo(() => {
    const name = merged.courierName.trim() || 'Kuryer';
    if (!courierCoords) return name;
    const [lat, lng] = courierCoords;
    const coord = `${name} · ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    if (courierIsApproxGeocode && courierPickupForGeocode.trim()) {
      const short =
        courierPickupForGeocode.length > 90
          ? `${courierPickupForGeocode.slice(0, 87)}…`
          : courierPickupForGeocode;
      return `${coord} (${short})`;
    }
    return coord;
  }, [courierCoords, courierIsApproxGeocode, courierPickupForGeocode, merged.courierName]);

  const customerTelRaw = merged.customerPhone.trim();
  const customerTelHref = customerTelRaw ? `tel:${customerTelRaw.replace(/\s/g, '')}` : '';

  const hasAnyDeliveryInfo = Boolean(
    merged.customerAddress || merged.customerPhone || merged.courierCarPlate || merged.courierCarModel || displayPhone
  );

  const verticalTimeline = useMemo(() => {
    const s = normalizeStatus(merged.status);
    const delivered = s.includes('DELIVERED') || s.includes('COMPLETED');
    const withCourier =
      s.includes('WITH_COURIER') ||
      s.includes('ON_THE_WAY') ||
      s.includes('IN_DELIVERY') ||
      s.includes('SHIPPED');
    return [
      { id: 't1', title: 'Buket hazırlandı', sub: '', kind: 'done' as const },
      {
        id: 't2',
        title: 'Kuryer yola çıxdı',
        sub: '',
        kind: withCourier || delivered ? ('done' as const) : ('wait' as const),
      },
      {
        id: 't3',
        title: 'Kuryer yoldadır',
        sub: withCourier && !delivered ? 'Yoldadır…' : delivered ? '' : '',
        kind:
          delivered ? ('done' as const) : withCourier ? ('active' as const) : ('wait' as const),
      },
      {
        id: 't4',
        title: 'Çatdırıldı',
        sub: delivered ? '' : 'Gözlənilir',
        kind: delivered ? ('done' as const) : ('future' as const),
      },
    ];
  }, [merged.status]);

  const [orderDetailsOpen, setOrderDetailsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const chatCustomerUserId = Number(coalesce(apiSnap?.customerUserId, data.customerUserId));
  const chatCourierUserId = Number(coalesce(apiSnap?.courierUserId, data.courierUserId));

  const showGate = requiresUnlock && !isUnlocked && inviteCheckDone;

  if (!inviteCheckDone && data.orderId && data.access) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background-light p-6 dark:bg-background-dark">
        <p className="text-sm text-slate-600 dark:text-slate-300">Link yoxlanılır…</p>
      </div>
    );
  }

  if (!data.orderId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-light p-6 dark:bg-background-dark">
        <p className="text-sm text-slate-600 dark:text-slate-300">Sifariş tapılmadı — linkdə orderId çatışmır.</p>
      </div>
    );
  }

  if (!requiresUnlock) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-light p-6 dark:bg-background-dark">
        <p className="max-w-md text-center text-sm text-slate-600 dark:text-slate-300">
          Bu link köhnəlibdir və ya yanlışdır. Florist tərəfindən yenidən göndərilmiş WhatsApp linkindən istifadə edin (
          <span className="font-mono">access</span> parametri olmalıdır).
        </p>
      </div>
    );
  }

  if (showGate) {
    return (
      <div className="min-h-screen bg-[#f8f6f6] px-4 py-10 font-[family-name:'Manrope',system-ui,sans-serif] text-slate-900 dark:bg-[#221016] dark:text-slate-100">
        <div className="mx-auto flex max-w-md flex-col gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: `${TRACK_PRIMARY}cc` }}>
              Təhlükəsiz giriş
            </p>
            <h1 className="mt-1 text-xl font-black">Çatdırılma məlumatı</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Bu linkdə yalnız sifariş{' '}
              <span className="font-bold" style={{ color: TRACK_PRIMARY }}>
                #{data.orderNumber || data.orderId}
              </span>{' '}
              üçün məlumat var.
            </p>
          </div>
          <form
            onSubmit={handleUnlock}
            className="flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm dark:bg-white/5"
            style={{ borderColor: `${TRACK_PRIMARY}26` }}
          >
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
              Mobil / WhatsApp nömrəsi
              <input
                type="tel"
                value={phoneInput}
                onChange={(ev) => setPhoneInput(ev.target.value)}
                placeholder="+994501234567"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#d4115244] dark:border-slate-600 dark:bg-slate-900"
                autoComplete="tel"
              />
            </label>
            {unlockError ? <p className="text-sm font-semibold text-red-600">{unlockError}</p> : null}
            <button
              type="submit"
              disabled={unlocking}
              className="rounded-lg py-2.5 text-sm font-black text-white disabled:opacity-60"
              style={{ backgroundColor: TRACK_PRIMARY }}
            >
              {unlocking ? 'Yoxlanır...' : 'Davam et'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const courierDisplayName = coalesce(merged.courierName, 'Kuryer');
  const vehicleSummary =
    merged.courierCarModel && merged.courierCarPlate
      ? `${merged.courierCarModel} • ${merged.courierCarPlate}`
      : coalesce(merged.courierCarModel, merged.courierCarPlate);

  const statusLive =
    normalizedStatusIndicatesActive(merged.status) && Boolean(courierGpsCoords) && !courierIsApproxGeocode;

  return (
    <div
      className="min-h-screen overflow-x-hidden bg-[#f8f6f6] font-[family-name:'Manrope',system-ui,sans-serif] text-slate-900 antialiased dark:bg-[#221016] dark:text-slate-100"
      data-tracking-shell
    >
      <div className="flex min-h-screen w-full flex-col">
        <header
          className="sticky top-0 z-50 flex items-center justify-between border-b px-6 py-4 md:px-14"
          style={{ borderColor: `${TRACK_PRIMARY}33`, backgroundColor: 'inherit' }}
        >
          <Link to="/" className="flex items-center gap-4 transition-opacity hover:opacity-90">
            <div style={{ color: TRACK_PRIMARY }}>
              <span className="material-symbols-outlined text-4xl leading-none">local_florist</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight">{trackingBrandName()}</h2>
          </Link>
        </header>

        <main className="flex min-h-0 flex-1 flex-col lg:flex-row lg:overflow-hidden">
          <aside
            className="flex max-h-none w-full flex-col gap-6 overflow-y-auto border-r p-6 shadow-xl lg:max-h-[calc(100vh-73px)] lg:w-[400px]"
            style={{ borderColor: `${TRACK_PRIMARY}1a` }}
          >
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight">Sifarişin izlənilməsi</h1>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="rounded px-2 py-0.5 text-xs font-bold uppercase"
                  style={{ backgroundColor: `${TRACK_PRIMARY}33`, color: TRACK_PRIMARY }}
                >
                  {statusTitle(merged.status)}
                </span>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  #{merged.orderNumber || data.orderId || '-'}
                </p>
              </div>
              {inviteLinkUnlocked && !verifiedPhone ? (
                <p className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ backgroundColor: `${TRACK_PRIMARY}14`, color: TRACK_PRIMARY }}>
                  Link ilə açılıb — əlavə kod tələb olunmur.
                </p>
              ) : null}
            </div>

            <div
              className="flex flex-col gap-4 rounded-xl border p-4"
              style={{ backgroundColor: `${TRACK_PRIMARY}0d`, borderColor: `${TRACK_PRIMARY}1a` }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-12 items-center justify-center rounded-full text-sm font-black ring-2" style={{ color: TRACK_PRIMARY, backgroundColor: `${TRACK_PRIMARY}33` }}>
                    {initialsFromName(courierDisplayName)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-bold">{courierDisplayName}</h3>
                    <p className="text-xs text-slate-500">{vehicleSummary || 'Kuryer'}</p>
                  </div>
                </div>
                {telHref ? (
                  <a
                    href={telHref}
                    className="flex size-10 shrink-0 items-center justify-center rounded-full text-white shadow-lg"
                    style={{ backgroundColor: TRACK_PRIMARY }}
                    aria-label="Kuryerə zəng"
                  >
                    <span className="material-symbols-outlined text-lg">call</span>
                  </a>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-2 border-t pt-3" style={{ borderColor: `${TRACK_PRIMARY}1a` }}>
                {customerTelHref ? (
                  <a
                    href={customerTelHref}
                    className="flex flex-col items-center rounded-xl border bg-white py-3 text-[11px] font-bold dark:bg-white/5"
                    style={{ borderColor: `${TRACK_PRIMARY}33`, color: TRACK_PRIMARY }}
                  >
                    Alıcıya zəng
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => setChatOpen(true)}
                  className="flex flex-col items-center rounded-xl border bg-white py-3 text-[11px] font-bold dark:bg-white/5"
                  style={{ borderColor: `${TRACK_PRIMARY}33`, color: TRACK_PRIMARY }}
                >
                  Mesaj
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Çatdırılma statusu</h4>
              <div className="relative flex flex-col gap-4 pl-6">
                <div className="absolute bottom-2 left-[7px] top-2 w-0.5 bg-slate-200 dark:bg-slate-700" />
                {verticalTimeline.map((row) => renderTimeline(row, TRACK_PRIMARY))}
              </div>
            </div>

            <div className="border-t pt-4" style={{ borderColor: `${TRACK_PRIMARY}1a` }}>
              <p className="text-xs font-bold uppercase text-slate-500">Çatdırılma ünvanı</p>
              <p className="mt-1 text-sm">{merged.customerAddress || '—'}</p>
              <button
                type="button"
                onClick={() => setOrderDetailsOpen((o) => !o)}
                className="mt-3 w-full rounded-lg bg-slate-200 py-2 text-sm font-bold dark:bg-[#221016]"
              >
                Sifariş detalları
              </button>
              {orderDetailsOpen ? (
                <div className="mt-2 space-y-1 rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-600">
                  <p>
                    <span className="font-bold text-slate-500">Təcil:</span> {displayPhone || '—'}
                  </p>
                  <p>
                    <span className="font-bold text-slate-500">Maşın:</span> {merged.courierCarPlate || '—'} {merged.courierCarModel}
                  </p>
                </div>
              ) : null}
            </div>

            {apiSnapTried && !hasAnyDeliveryInfo ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950">
                Əlavə məlumat API-dən gəlmədi və ya parametrlərdə yoxdur.
              </div>
            ) : null}
          </aside>

          <section className="relative flex min-h-[min(55vh,480px)] flex-1 flex-col overflow-hidden bg-slate-200 dark:bg-slate-800 lg:min-h-0">
            <CourierTrackingMap
              deliveryPosition={deliveryCoords}
              courierPosition={courierCoords}
              geocodingDelivery={deliveryGeocoding}
              onDeliveryNavigate={
                deliveryWazeHref ? () => window.open(deliveryWazeHref, '_blank', 'noopener,noreferrer') : undefined
              }
              geocodingCourier={courierGeocoding}
              courierApproximateGeocode={courierIsApproxGeocode}
              deliveryAddressLine={mapDeliveryLine}
              courierDetailLine={courierCoords ? mapCourierLine : ''}
              interactiveLiveTracking
              courierTrail={[]} // tarixçə gələndə sonra doldurula bilər
              courierLiveRouteAnimation={statusLive}
              viewportSessionKey={String(data.orderId || '')}
              className="relative z-0 flex min-h-[min(55vh,480px)] flex-1 flex-col lg:h-full lg:min-h-full"
            />
          </section>
        </main>

        <UserCourierChatModal
          open={chatOpen}
          orderId={Number(data.orderId) || 0}
          selfRole="user"
          selfUserId={userId ?? null}
          customerUserId={chatCustomerUserId || null}
          courierUserId={chatCourierUserId || null}
          title={`Sifariş #${merged.orderNumber || data.orderId}`}
          onClose={() => setChatOpen(false)}
        />
      </div>
    </div>
  );
}

function normalizedStatusIndicatesActive(raw?: string) {
  const s = normalizeStatus(raw || '');
  return (
    s.includes('WITH_COURIER') ||
    s.includes('ON_THE_WAY') ||
    s.includes('IN_DELIVERY') ||
    s.includes('SHIPPED')
  );
}

function renderTimeline(
  row: { id: string; title: string; sub: string; kind: string },
  brand: string
) {
  if (row.kind === 'active') {
    return (
      <div key={row.id} className="relative">
        <div
          className="absolute -left-[27px] -top-1 flex size-6 items-center justify-center rounded-full text-white shadow-lg"
          style={{ backgroundColor: brand }}
        >
          <span className="material-symbols-outlined text-xs">local_shipping</span>
        </div>
        <p className="font-bold" style={{ color: brand }}>
          {row.title}
        </p>
        {row.sub ? <span className="text-xs text-slate-500">{row.sub}</span> : null}
      </div>
    );
  }
  if (row.kind === 'done') {
    return (
      <div key={row.id} className="relative">
        <div className="absolute -left-[23px] top-1 size-4 rounded-full bg-green-500" />
        <p className="font-semibold text-slate-500 line-through">{row.title}</p>
      </div>
    );
  }
  if (row.kind === 'future') {
    return (
      <div key={row.id} className="relative opacity-50">
        <div className="absolute -left-[23px] top-1 size-4 rounded-full bg-slate-300 dark:bg-slate-600" />
        <p className="font-semibold">{row.title}</p>
        {row.sub ? <span className="text-xs text-slate-400">{row.sub}</span> : null}
      </div>
    );
  }
  return (
    <div key={row.id} className="relative">
      <div className="absolute -left-[23px] top-1 size-4 rounded-full bg-slate-300 dark:bg-slate-600" />
      <p className="font-semibold text-slate-600">{row.title}</p>
    </div>
  );
}
