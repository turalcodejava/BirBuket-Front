import { ArrowLeft, CreditCard, MapPin, Wallet } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { authService, cartService, checkoutService, plantDoctorService, productService } from '../services/api';
import { Cart } from '../types';
import { useAuth } from '../context/AuthContext';
import BrandLoading from './BrandLoading';
import DeliveryTariffsInfo from './DeliveryTariffsInfo';
import { addCalendarDaysLocal, toLocalDateInputString } from '../utils/dateInput';

type PaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER';
type DeliveryTimeSlot =
  | 'SLOT_00_03'
  | 'SLOT_03_06'
  | 'SLOT_06_09'
  | 'SLOT_09_12'
  | 'SLOT_12_15'
  | 'SLOT_15_18'
  | 'SLOT_18_21'
  | 'SLOT_21_24';

const DELIVERY_SLOTS: Array<{ value: DeliveryTimeSlot; label: string }> = [
  { value: 'SLOT_00_03', label: '00:00-03:00' },
  { value: 'SLOT_03_06', label: '03:00-06:00' },
  { value: 'SLOT_06_09', label: '06:00-09:00' },
  { value: 'SLOT_09_12', label: '09:00-12:00' },
  { value: 'SLOT_12_15', label: '12:00-15:00' },
  { value: 'SLOT_15_18', label: '15:00-18:00' },
  { value: 'SLOT_18_21', label: '18:00-21:00' },
  { value: 'SLOT_21_24', label: '21:00-00:00' },
];

const FALLBACK_STORE_CENTER: [number, number] = [40.4093, 49.8671];
// Approximate Baku bounds (city area) for checkout selection guard.
const BAKU_BOUNDS = {
  minLat: 40.10,
  maxLat: 40.65,
  minLng: 49.60,
  maxLng: 50.40,
};
const toRadians = (value: number) => (value * Math.PI) / 180;
const calculateDistanceKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const isWithinBaku = (lat: number, lng: number) =>
  lat >= BAKU_BOUNDS.minLat &&
  lat <= BAKU_BOUNDS.maxLat &&
  lng >= BAKU_BOUNDS.minLng &&
  lng <= BAKU_BOUNDS.maxLng;

function MapClickSelector({
  lat,
  lng,
  onPick,
}: {
  lat: number | null;
  lng: number | null;
  onPick: (nextLat: number, nextLng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });

  if (lat == null || lng == null) return null;
  return <CircleMarker center={[lat, lng]} radius={7} pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.6 }} />;
}

function FlyToLocation({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (lat == null || lng == null) return;
    map.flyTo([lat, lng], 15, { duration: 0.6 });
  }, [lat, lng, map]);
  return null;
}

const isGreetingCardType = (productName: string) => {
  const normalized = productName.toLowerCase();
  return (
    normalized.includes('açıqca') ||
    normalized.includes('aciqca') ||
    normalized.includes('kart') ||
    normalized.includes('obviously')
  );
};

const extractPaymentUrl = (payload: any): string | null => {
  const directCandidates = [
    payload?.data?.paymentUrl,
    payload?.paymentUrl,
    payload?.data?.paymentLink,
    payload?.paymentLink,
    payload?.data?.payment_url,
    payload?.payment_url,
    payload?.data?.redirectUrl,
    payload?.redirectUrl,
    payload?.data?.checkoutUrl,
    payload?.checkoutUrl,
    payload?.data?.redirect_url,
    payload?.redirect_url,
    payload?.data?.url,
    payload?.url,
    payload?.data?.redirect?.url,
    payload?.redirect?.url,
    payload?.data?.data?.url,
    payload?.data?.data?.paymentUrl,
  ];

  for (const candidate of directCandidates) {
    if (typeof candidate !== 'string') continue;
    const value = candidate.trim();
    if (!value) continue;
    if (/^https?:\/\//i.test(value)) return value;
    // Some gateways return relative checkout route (e.g. /payment/redirect?...).
    if (value.startsWith('/')) return `${window.location.origin}${value}`;
    if (value.startsWith('//')) return `${window.location.protocol}${value}`;
    if (/^[a-z0-9._-]+\//i.test(value)) return `${window.location.origin}/${value.replace(/^\/+/, '')}`;
  }

  const nested = payload?.data?.links ?? payload?.links;
  if (nested && typeof nested === 'object') {
    const nestedCandidates = [
      (nested as any).payment,
      (nested as any).checkout,
      (nested as any).redirect,
      (nested as any).url,
    ];
    for (const candidate of nestedCandidates) {
      if (typeof candidate === 'string' && /^https?:\/\//i.test(candidate.trim())) {
        return candidate.trim();
      }
    }
  }

  const urlRegex = /(https?:\/\/[^\s"']+)/i;
  const messageCandidates = [
    payload?.message,
    payload?.data?.message,
    payload?.error,
    payload?.data?.error,
  ];
  for (const message of messageCandidates) {
    if (typeof message !== 'string') continue;
    const match = message.match(urlRegex);
    if (match?.[1]) return match[1];
  }

  return null;
};

const extractOrderId = (payload: any): number => {
  const rawOrderId =
    payload?.data?.orderId ??
    payload?.orderId ??
    payload?.data?.id ??
    payload?.id;
  const orderId = Number(rawOrderId);
  return Number.isFinite(orderId) && orderId > 0 ? orderId : 0;
};

const tryPaymentFallback = async (payload: any): Promise<string | null> => {
  const orderId = extractOrderId(payload);
  if (!orderId) return null;
  try {
    const payRes = await checkoutService.payOrder({ orderId });
    return extractPaymentUrl(payRes);
  } catch {
    return null;
  }
};

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { userId, token, setAuthUser } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [bankTransferNoticeVisible, setBankTransferNoticeVisible] = useState(false);
  const [storeLocation, setStoreLocation] = useState({
    latitude: FALLBACK_STORE_CENTER[0],
    longitude: FALLBACK_STORE_CENTER[1],
    name: 'Mağaza',
  });
  const [mapSearch, setMapSearch] = useState('');
  const [mapSearching, setMapSearching] = useState(false);
  const [mapStyle, setMapStyle] = useState<'street' | 'satellite'>('satellite');
  const [addressNotice, setAddressNotice] = useState<string | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [form, setForm] = useState({
    recipientName: '',
    phone: '',
    addressLine: '',
    note: '',
    paymentMethod: 'CASH' as PaymentMethod,
    deliveryDate: '',
    deliveryTimeSlot: 'SLOT_09_12' as DeliveryTimeSlot,
  });
  const [productNotes, setProductNotes] = useState<Record<number, string>>({});
  const [showGreetingCardSection, setShowGreetingCardSection] = useState(false);
  const [showGreetingCardPicker, setShowGreetingCardPicker] = useState(false);
  const [selectedGreetingCardId, setSelectedGreetingCardId] = useState<number | null>(null);
  const [cardMessage, setCardMessage] = useState('');
  const [cardsLoading, setCardsLoading] = useState(false);
  const [greetingCards, setGreetingCards] = useState<Array<{ id: number; title: string; price: number; img?: string }>>([]);
  const mapTileUrl =
    mapStyle === 'satellite'
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const mapAttribution =
    mapStyle === 'satellite'
      ? 'Tiles &copy; Esri'
      : '&copy; OpenStreetMap contributors';

  const toAzLocalPhone = (value: string) => {
    const digitsOnly = value.replace(/\D/g, '');
    if (digitsOnly.startsWith('994')) return digitsOnly.slice(3, 12);
    if (digitsOnly.startsWith('0')) return digitsOnly.slice(1, 10);
    return digitsOnly.slice(0, 9);
  };

  const minCheckoutDeliveryStr = useMemo(
    () => toLocalDateInputString(addCalendarDaysLocal(new Date(), 1)),
    []
  );

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      deliveryDate: prev.deliveryDate || minCheckoutDeliveryStr,
    }));
  }, [minCheckoutDeliveryStr]);

  const fillAddressFromCoordinates = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=az&lat=${lat}&lon=${lng}`
      );
      if (!res.ok) return;
      const data = await res.json();
      const resolvedLine = String(data?.display_name || '').trim();
      if (resolvedLine) {
        setForm((prev) => ({ ...prev, addressLine: resolvedLine }));
      }
    } catch {
      // ignore reverse-geocoding failures
    }
  };

  const handleMapSearch = async () => {
    const query = mapSearch.trim();
    if (!query) {
      setAddressNotice('Axtarış üçün ünvan daxil edin.');
      return;
    }
    setMapSearching(true);
    setAddressNotice(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=az&q=${encodeURIComponent(query)}`
      );
      if (!res.ok) {
        setAddressNotice('Axtarış servisi hazırda cavab vermir.');
        return;
      }
      const rows = await res.json();
      const first = Array.isArray(rows) ? rows[0] : null;
      if (!first) {
        setAddressNotice('Bu ünvana uyğun nəticə tapılmadı.');
        return;
      }
      const lat = Number(first?.lat);
      const lng = Number(first?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        setAddressNotice('Koordinatları oxumaq mümkün olmadı.');
        return;
      }
      if (!isWithinBaku(lat, lng)) {
        setAddressNotice('Yalnız Bakı ərazisi daxilində ünvan seçmək mümkündür.');
        return;
      }
      setLatitude(lat);
      setLongitude(lng);
      await fillAddressFromCoordinates(lat, lng);
      setAddressNotice('Ünvan xəritədə tapıldı.');
    } catch {
      setAddressNotice('Axtarış zamanı xəta baş verdi.');
    } finally {
      setMapSearching(false);
    }
  };

  const resolveEffectiveUserId = async (): Promise<number | null> => {
    if (userId && userId > 0) return userId;
    if (!token) return null;
    try {
      const meRes = await authService.getMe();
      if (meRes?.success && meRes?.data) {
        setAuthUser(meRes.data);
        const candidates = [
          (meRes.data as any)?.id,
          (meRes.data as any)?.userId,
          (meRes.data as any)?.user_id,
          (meRes.data as any)?.uid,
          (meRes.data as any)?.sub,
        ];
        for (const rawId of candidates) {
          if (typeof rawId === 'number' && rawId > 0) return rawId;
          if (typeof rawId === 'string' && /^\d+$/.test(rawId.trim())) return Number(rawId.trim());
        }
      }
    } catch {
      return null;
    }
    return null;
  };

  useEffect(() => {
    const loadCheckout = async () => {
      if (!token) {
        setError('Zəhmət olmasa əvvəlcə daxil olun.');
        setLoading(false);
        return;
      }
      const effectiveUserId = await resolveEffectiveUserId();
      if (!effectiveUserId) {
        setError('Hesab ID-si tapılmadı.');
        setLoading(false);
        return;
      }
      try {
        const data = await cartService.getCart(effectiveUserId);
        if (!data?.items?.length) {
          setError('Səbət boşdur. Əvvəlcə məhsul əlavə edin.');
        } else {
          setCart(data);
          const initialNotes: Record<number, string> = {};
          data.items.forEach((item) => {
            if (isGreetingCardType(item.productName)) {
              initialNotes[item.productId] = '';
            }
          });
          setProductNotes(initialNotes);
        }
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Checkout məlumatları yüklənmədi.');
      } finally {
        setLoading(false);
      }
    };
    loadCheckout();
  }, [token, userId]);

  useEffect(() => {
    if (!showGreetingCardSection || greetingCards.length > 0) return;
    let cancelled = false;
    const parsePrice = (v: string) => {
      const n = Number(String(v || '').replace(/[^\d.,-]/g, '').replace(',', '.'));
      return Number.isFinite(n) ? n : 0;
    };
    const loadCards = async () => {
      try {
        setCardsLoading(true);
        const res = await productService.getByProductType('OBVIOUSLY');
        if (cancelled) return;
        const payload = (res as any)?.data ?? res ?? {};
        const rows = Array.isArray(payload?.content)
          ? payload.content
          : Array.isArray(payload)
            ? payload
            : Array.isArray((payload as any)?.data?.content)
              ? (payload as any).data.content
              : [];
        const normalized = rows.map((p: any) => ({
          id: Number(p?.id),
          title: String(p?.title || p?.productName || `Açıqca #${p?.id || ''}`),
          price: parsePrice(String(p?.price || '0')),
          img: String(p?.img || p?.imageUrl || ''),
        })).filter((x: any) => Number.isFinite(x.id) && x.id > 0);
        if (!cancelled) setGreetingCards(normalized);
      } catch {
        if (!cancelled) setGreetingCards([]);
      } finally {
        if (!cancelled) setCardsLoading(false);
      }
    };
    loadCards();
    return () => {
      cancelled = true;
    };
  }, [showGreetingCardSection, greetingCards.length]);

  useEffect(() => {
    const loadStoreLocation = async () => {
      try {
        const res = await plantDoctorService.getStoreLocation();
        const payload = res?.data ?? res ?? {};
        const rawLat = Number(payload?.latitude ?? payload?.lat);
        const rawLng = Number(payload?.longitude ?? payload?.lng);
        if (!Number.isFinite(rawLat) || !Number.isFinite(rawLng)) return;
        setStoreLocation({
          latitude: rawLat,
          longitude: rawLng,
          name: String(payload?.name || payload?.storeName || 'Mağaza'),
        });
      } catch {
        // fallback center is used
      }
    };
    loadStoreLocation();
  }, []);

  useEffect(() => {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      setDistanceKm(null);
      return;
    }
    const km = calculateDistanceKm(storeLocation.latitude, storeLocation.longitude, latitude, longitude);
    setDistanceKm(Number(km.toFixed(2)));
  }, [latitude, longitude, storeLocation.latitude, storeLocation.longitude]);

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleProductNoteChange = (productId: number, value: string) => {
    setProductNotes((prev) => ({ ...prev, [productId]: value }));
  };

  const estimatedDeliveryFee = useMemo(() => {
    if (typeof distanceKm !== 'number' || !Number.isFinite(distanceKm)) return 5.00;
    if (distanceKm <= 4) return 5.00;
    if (distanceKm <= 8) return 10.00;
    if (distanceKm <= 15) return 15.00;
    return 20.00;
  }, [distanceKm]);

  const finalCheckoutTotal = useMemo(() => {
    if (!cart) return 0;
    const base = Number(cart.totalAmount || 0);
    return Number((base + estimatedDeliveryFee).toFixed(2));
  }, [cart, estimatedDeliveryFee]);

  const handleSubmitOrder = async () => {
    if (!cart || !cart.items.length || !token) return;
    if (!form.recipientName.trim() || !form.phone.trim() || !form.addressLine.trim()) {
      setError('Ünvan məlumatlarını tam doldurun.');
      return;
    }
    if (form.phone.replace(/\D/g, '').length !== 9) {
      setError('Telefon nömrəsini +994-dən sonra 9 rəqəm olaraq daxil edin.');
      return;
    }
    if (!form.deliveryDate || !form.deliveryTimeSlot) {
      setError('Çatdırılma tarixi və saat aralığını seçin.');
      return;
    }
    if (form.deliveryDate < minCheckoutDeliveryStr) {
      setError('Çatdırılma tarixi keçmiş və ya bugün seçilə bilməz (ən erkən sabah).');
      return;
    }
    if (typeof distanceKm !== 'number') {
      setError('Zəhmət olmasa ünvani xəritədən seçin ki məsafə hesablansın.');
      return;
    }

    setPlacingOrder(true);
    setError(null);
    try {
      const effectiveUserId = await resolveEffectiveUserId();
      if (!effectiveUserId) {
        setError('Hesab ID-si tapılmadı.');
        return;
      }

      const successUrl = `${window.location.origin}/checkout/success`;
      const cancelUrl = `${window.location.origin}/checkout`;
      const callbackUrl = `${window.location.origin}/checkout/success`;

      const orderRes = await checkoutService.completeOrder({
        userId: effectiveUserId,
        city: 'Bakı',
        distanceKm: Number(distanceKm.toFixed(2)),
        addressLine: form.addressLine.trim(),
        deliveryDate: form.deliveryDate,
        deliveryTimeSlot: form.deliveryTimeSlot,
        addressNote:
          [
            form.note.trim(),
            `Əlaqə nömrəsi: +994${form.phone}`,
            showGreetingCardSection && selectedGreetingCardId != null
              ? `Açıqca: ${greetingCards.find((x) => x.id === selectedGreetingCardId)?.title || selectedGreetingCardId}`
              : '',
            showGreetingCardSection && cardMessage.trim() ? `Açıqca mesajı: ${cardMessage.trim()}` : '',
            typeof distanceKm === 'number' ? `Xəritə məsafəsi: ${distanceKm.toFixed(2)} km` : '',
            typeof latitude === 'number' && typeof longitude === 'number'
              ? `Koordinatlar: ${latitude.toFixed(6)},${longitude.toFixed(6)}`
              : '',
            ...cart.items
              .map((item) => {
                if (!isGreetingCardType(item.productName)) return '';
                const itemNote = (productNotes[item.productId] || '').trim();
                return itemNote ? `Açıqca (${item.productName}): ${itemNote}` : '';
              })
              .filter(Boolean),
          ]
            .filter(Boolean)
            .join(' | ') || undefined,
        paymentMethod: form.paymentMethod,
        contactPhone: `+994${form.phone}`,
        successUrl,
        cancelUrl,
        failUrl: cancelUrl,
        callbackUrl,
      });

      const paymentUrl = extractPaymentUrl(orderRes);

      if (form.paymentMethod === 'CARD') {
        const fallbackPaymentUrl = paymentUrl || (await tryPaymentFallback(orderRes));
        if (fallbackPaymentUrl) {
          window.location.href = fallbackPaymentUrl;
          return;
        }
        setError('Kart ödənişi linki alınmadı. Zəhmət olmasa yenidən cəhd edin.');
        return;
      }

      const orderNumber = (orderRes as any)?.data?.orderNumber;
      const orderId =
        (orderRes as any)?.data?.orderId ??
        (orderRes as any)?.data?.id ??
        (orderRes as any)?.orderId ??
        (orderRes as any)?.id;
      navigate('/checkout/success', {
        state: {
          orderNumber: orderNumber ? String(orderNumber) : undefined,
          orderId: orderId != null ? String(orderId) : undefined,
        },
      });
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Sifariş tamamlanmadı.');
    } finally {
      setPlacingOrder(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <BrandLoading />
      </div>
    );
  }

  return (
    <div className="bg-[#fdfcf0] dark:bg-background-dark min-h-screen">
      <main className="max-w-4xl mx-auto px-6 lg:px-12 py-10 space-y-6">
        <Link to="/cart" className="inline-flex items-center gap-2 text-sm font-bold text-floral-muted hover:text-primary">
          <ArrowLeft className="w-4 h-4" />
          Səbətə qayıt
        </Link>

        <div className="rounded-[28px] border border-floral-muted/10 bg-white dark:bg-white/5 p-6 md:p-8 shadow-sm">
          <h1 className="text-3xl font-black dark:text-white">Sifarişi tamamla</h1>
          <p className="text-sm text-floral-muted mt-2">Ünvan və ödəniş məlumatlarını daxil edin.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <input value={form.recipientName} onChange={(e) => handleChange('recipientName', e.target.value)} placeholder="Alan şəxsin adı" className="rounded-2xl border border-floral-muted/20 bg-[#fdfcf5] dark:bg-white/5 px-4 py-3 outline-none focus:border-primary" />
            <div className="flex items-center rounded-2xl border border-floral-muted/20 bg-[#fdfcf5] dark:bg-white/5 px-4 py-3">
              <span className="text-sm font-semibold text-floral-muted">+994</span>
              <input
                value={form.phone}
                onChange={(e) => handleChange('phone', toAzLocalPhone(e.target.value))}
                placeholder="50 123 45 67"
                className="ml-2 w-full bg-transparent outline-none"
              />
            </div>
            <input value={form.addressLine} onChange={(e) => handleChange('addressLine', e.target.value)} placeholder="Ünvan (küçə, bina, mənzil)" className="rounded-2xl border border-floral-muted/20 bg-[#fdfcf5] dark:bg-white/5 px-4 py-3 outline-none focus:border-primary" />
          </div>

          <div className="mt-4 rounded-2xl border border-floral-muted/15 bg-[#fdfcf5] dark:bg-white/5 p-4 relative">
            <label className="block text-xs font-bold mb-2">Xəritədə ünvan seçimi</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={mapSearch}
                onChange={(e) => setMapSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleMapSearch();
                  }
                }}
                placeholder="Ünvan yazın (məs: Bakı, Nizami 90)"
                className="flex-1 rounded-xl border border-floral-muted/20 px-3 py-2.5 bg-white dark:bg-white/10 outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={handleMapSearch}
                disabled={mapSearching}
                className="rounded-xl bg-primary text-floral-deep px-4 py-2.5 text-xs font-black disabled:opacity-70"
              >
                {mapSearching ? 'Axtarılır...' : 'Axtar'}
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between rounded-xl border border-floral-muted/20 bg-white/70 dark:bg-white/5 p-1">
              <span className="px-2 text-[11px] font-bold text-floral-muted">Xəritə görünüşü</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setMapStyle('street')}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-black transition ${
                    mapStyle === 'street'
                      ? 'bg-primary text-floral-deep shadow'
                      : 'bg-transparent text-floral-muted hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                >
                  Klassik
                </button>
                <button
                  type="button"
                  onClick={() => setMapStyle('satellite')}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-black transition ${
                    mapStyle === 'satellite'
                      ? 'bg-primary text-floral-deep shadow'
                      : 'bg-transparent text-floral-muted hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                >
                  Peyk
                </button>
              </div>
            </div>

            <div className="mt-3 h-56 rounded-xl overflow-hidden border border-floral-muted/20">
              <MapContainer center={[storeLocation.latitude, storeLocation.longitude]} zoom={12} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  attribution={mapAttribution}
                  url={mapTileUrl}
                />
                <MapClickSelector
                  lat={latitude}
                  lng={longitude}
                  onPick={(nextLat, nextLng) => {
                    if (!isWithinBaku(nextLat, nextLng)) {
                      setAddressNotice('Yalnız Bakı ərazisi daxilində nöqtə seçə bilərsiniz.');
                      return;
                    }
                    setLatitude(nextLat);
                    setLongitude(nextLng);
                    fillAddressFromCoordinates(nextLat, nextLng);
                  }}
                />
                <FlyToLocation lat={latitude} lng={longitude} />
              </MapContainer>
            </div>

            <div className="mt-2 flex flex-wrap gap-3 text-[11px] font-semibold text-floral-muted">
              <span>Lat: {typeof latitude === 'number' ? latitude.toFixed(6) : '—'}</span>
              <span>Lng: {typeof longitude === 'number' ? longitude.toFixed(6) : '—'}</span>
              <span>Məsafə: {typeof distanceKm === 'number' ? `${distanceKm.toFixed(2)} km` : '—'}</span>
              <button
                type="button"
                onClick={() => {
                  if (!navigator.geolocation) {
                    setAddressNotice('Brauzer geolocation dəstəkləmir.');
                    return;
                  }
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      const nextLat = pos.coords.latitude;
                      const nextLng = pos.coords.longitude;
                      if (!isWithinBaku(nextLat, nextLng)) {
                        setAddressNotice('Cari mövqeniz Bakı xaricindədir. Yalnız Bakı daxilində seçim mümkündür.');
                        return;
                      }
                      setLatitude(nextLat);
                      setLongitude(nextLng);
                      fillAddressFromCoordinates(nextLat, nextLng);
                      setAddressNotice('Cari mövqeyiniz xəritəyə əlavə edildi.');
                    },
                    () => setAddressNotice('Cari mövqeni götürmək mümkün olmadı.')
                  );
                }}
                className="text-primary underline underline-offset-2"
              >
                Cari mövqeyimi istifadə et
              </button>
            </div>
            <DeliveryTariffsInfo
              className="mt-3 rounded-xl border border-floral-muted/15 bg-white/70 px-3 py-2 dark:bg-white/5"
              titleClassName="text-[11px] font-bold text-floral-deep dark:text-white"
              lineClassName="text-[11px] text-floral-muted dark:text-floral-muted-dark"
            />
            {addressNotice ? <p className="mt-2 text-xs font-semibold text-floral-muted">{addressNotice}</p> : null}
          </div>

          <div className="mt-5 rounded-2xl border border-floral-muted/15 bg-[#fdfcf5] dark:bg-white/5 p-4">
            <p className="text-sm font-black text-floral-deep dark:text-white mb-3">Çatdırılma vaxtı</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-floral-muted">Tarix</label>
                <input
                  type="date"
                  min={minCheckoutDeliveryStr}
                  value={form.deliveryDate}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v && v < minCheckoutDeliveryStr) return;
                    handleChange('deliveryDate', v);
                  }}
                  className="w-full rounded-xl border border-floral-muted/20 bg-white dark:bg-white/10 px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-floral-muted">Saat aralığı</label>
                <select
                  value={form.deliveryTimeSlot}
                  onChange={(e) => handleChange('deliveryTimeSlot', e.target.value)}
                  className="w-full rounded-xl border border-floral-muted/20 bg-white dark:bg-white/10 px-3 py-2.5 text-sm outline-none focus:border-primary"
                >
                  {DELIVERY_SLOTS.map((slot) => (
                    <option key={slot.value} value={slot.value}>
                      {slot.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <textarea value={form.note} onChange={(e) => handleChange('note', e.target.value)} placeholder="Ümumi qeyd (opsional)" className="w-full mt-4 rounded-2xl border border-floral-muted/20 bg-[#fdfcf5] dark:bg-white/5 px-4 py-3 outline-none focus:border-primary min-h-24" />

          <div className="mt-4 rounded-2xl border border-floral-muted/15 bg-[#fdfcf5] dark:bg-white/5 p-4">
            <label className="flex items-center gap-2 text-sm font-black">
              <input
                type="checkbox"
                checked={showGreetingCardSection}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setShowGreetingCardSection(checked);
                  if (!checked) {
                    setShowGreetingCardPicker(false);
                    setSelectedGreetingCardId(null);
                    setCardMessage('');
                  }
                }}
              />
              Açıqca əlavə et
            </label>

            {showGreetingCardSection ? (
              <div className="mt-3 space-y-3">
                <button
                  type="button"
                  onClick={() => setShowGreetingCardPicker((v) => !v)}
                  className="rounded-xl border border-floral-muted/20 px-3 py-2 text-xs font-bold"
                >
                  {showGreetingCardPicker ? 'Açıqca siyahısını gizlət' : 'Açıqca seç'}
                </button>

                {cardsLoading ? (
                  <p className="text-xs font-semibold text-floral-muted">Açıqcalar yüklənir...</p>
                ) : null}

                {showGreetingCardPicker && greetingCards.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {greetingCards.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => setSelectedGreetingCardId(card.id)}
                        className={`rounded-xl border px-3 py-2 text-left ${
                          selectedGreetingCardId === card.id ? 'border-primary bg-primary/10' : 'border-floral-muted/20'
                        }`}
                      >
                        <p className="text-xs font-black">{card.title}</p>
                        <p className="text-[11px] text-floral-muted">{card.price.toFixed(2)} AZN</p>
                      </button>
                    ))}
                  </div>
                ) : null}

                <textarea
                  value={cardMessage}
                  onChange={(e) => setCardMessage(e.target.value)}
                  placeholder="Açıqca üzərində yazılacaq mesaj (opsional)"
                  className="w-full rounded-xl border border-floral-muted/20 bg-white dark:bg-white/10 px-3 py-2.5 text-sm outline-none focus:border-primary min-h-20"
                />
              </div>
            ) : null}
          </div>

          {cart && cart.items.some((item) => isGreetingCardType(item.productName)) && (
            <div className="mt-5 rounded-2xl border border-amber-300/50 bg-amber-50 p-4">
              <p className="text-sm font-black text-amber-700">
                Açıqca üçün not yazmaq istəyirsinizsə, aşağıda qeyd edin
              </p>
              <p className="text-xs text-amber-700/80 mt-1">
                Bu mesaj sifarişlə birlikdə göndəriləcək və açıqca üzərinə qeyd ediləcək.
              </p>
              <div className="mt-3 space-y-3">
                {cart.items
                  .filter((item) => isGreetingCardType(item.productName))
                  .map((item) => (
                    <div key={item.productId}>
                      <label className="block text-xs font-bold text-amber-800 mb-1">
                        {item.productName}
                      </label>
                      <input
                        value={productNotes[item.productId] || ''}
                        onChange={(e) => handleProductNoteChange(item.productId, e.target.value)}
                        placeholder="Açıqca üzərinə yazılacaq not"
                        className="w-full rounded-xl border border-amber-300/60 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="mt-6">
            <p className="text-sm font-black mb-3">Ödəniş növü</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button onClick={() => handleChange('paymentMethod', 'CASH')} className={`rounded-2xl border px-4 py-3 text-sm font-bold flex items-center justify-center gap-2 ${form.paymentMethod === 'CASH' ? 'border-primary bg-primary/10 text-primary' : 'border-floral-muted/20'}`}>
                <Wallet className="w-4 h-4" />
                Qapıda ödəniş
              </button>
              <button onClick={() => handleChange('paymentMethod', 'CARD')} className={`rounded-2xl border px-4 py-3 text-sm font-bold flex items-center justify-center gap-2 ${form.paymentMethod === 'CARD' ? 'border-primary bg-primary/10 text-primary' : 'border-floral-muted/20'}`}>
                <CreditCard className="w-4 h-4" />
                Kartla ödəniş
              </button>
              <button
                type="button"
                onClick={() => setBankTransferNoticeVisible(true)}
                className="rounded-2xl border px-4 py-3 text-sm font-bold flex items-center justify-center gap-2 border-floral-muted/20 opacity-50 cursor-not-allowed"
              >
                <MapPin className="w-4 h-4" />
                Bank köçürməsi
              </button>
            </div>
            {bankTransferNoticeVisible && (
              <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
                <p className="text-xs font-semibold text-floral-deep">
                  Bank köçürməsi ödənişi yaxın zamanda aktiv olacaq.
                </p>
                <p className="mt-1 text-[11px] text-floral-muted">
                  Hazırda sifarişi kartla və ya qapıda ödəniş ilə tamamlaya bilərsiniz.
                </p>
              </div>
            )}
          </div>

          {cart && (
            <div className="mt-6 rounded-2xl border border-floral-muted/10 bg-[#fdfcf5] dark:bg-white/5 p-4 space-y-2.5">
              <div className="flex justify-between items-center text-sm">
                <span className="text-floral-muted">Məhsul məbləği:</span>
                <span className="font-bold text-floral-deep dark:text-white">{Number(cart.totalAmount || 0).toFixed(2)} AZN</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-floral-muted">
                  Çatdırılma haqqı {typeof distanceKm === 'number' ? `(${distanceKm.toFixed(2)} km)` : ''}:
                </span>
                <span className="font-bold text-floral-deep dark:text-white">{estimatedDeliveryFee.toFixed(2)} AZN</span>
              </div>
              <div className="border-t border-floral-muted/20 pt-2.5 flex justify-between items-center">
                <span className="text-base font-black text-floral-deep dark:text-white">Cəmi ödəniş:</span>
                <span className="text-2xl font-black text-primary">{finalCheckoutTotal.toFixed(2)} AZN</span>
              </div>
              <p className="text-[11px] text-floral-muted">
                Çatdırılma haqqı Bakı daxilində məsafəyə görə avtomatik hesablanır (4 km: 5 AZN, 4-8 km: 10 AZN, 8-15 km: 15 AZN, 15+ km: 20 AZN).
              </p>
            </div>
          )}

          {error && <p className="mt-4 text-sm font-semibold text-red-500">{error}</p>}
          {successMessage && <p className="mt-4 text-sm font-semibold text-emerald-600">{successMessage}</p>}

          <button
            onClick={handleSubmitOrder}
            disabled={placingOrder || !cart?.items?.length}
            className="w-full mt-6 rounded-2xl bg-primary text-floral-deep font-black py-3.5 hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            {placingOrder ? 'Sifariş tamamlanır...' : 'Sifarişi təsdiqlə'}
          </button>
        </div>
      </main>
    </div>
  );
}

