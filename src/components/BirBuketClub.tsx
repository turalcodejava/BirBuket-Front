import {
  CheckCircle2,
  Clock3,
  CreditCard,
  Gift,
  Leaf,
  Loader2,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
  User2,
  Wallet,
  Info,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService, checkoutService, plantDoctorService } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { addCalendarDaysLocal, toLocalDateInputString } from '../utils/dateInput';

const FLOWER_BG =
  'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=1920&q=80';

type SubscriptionPlan = {
  code: string;
  name?: string;
  discountPercent?: number;
  periodMonths?: number;
  price?: number;
};

type PaymentMethod = 'CARD' | 'CASH';
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

const getSingleDeliveryFee = (distanceKm: number | null): number => {
  if (distanceKm == null || distanceKm <= 4) return 5;
  if (distanceKm <= 8) return 10;
  if (distanceKm <= 15) return 15;
  return 20;
};

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
  return <CircleMarker center={[lat, lng]} radius={8} pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.8 }} />;
}

function FlyToLocation({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (lat == null || lng == null) return;
    map.flyTo([lat, lng], 15, { duration: 0.6 });
  }, [lat, lng, map]);
  return null;
}

const extractPaymentUrl = (payload: any): string | null => {
  const directCandidates = [
    payload?.paymentUrl,
    payload?.payment_url,
    payload?.redirectUrl,
    payload?.redirect_url,
    payload?.url,
    payload?.data?.paymentUrl,
    payload?.data?.payment_url,
    payload?.data?.redirectUrl,
    payload?.data?.redirect_url,
    payload?.data?.url,
    payload?.result?.paymentUrl,
    payload?.result?.payment_url,
    payload?.result?.redirectUrl,
    payload?.result?.redirect_url,
    payload?.result?.url,
  ];
  for (const candidate of directCandidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return null;
};

export default function BirBuketClub() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [mySubscription, setMySubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [clubSettings, setClubSettings] = useState<{
    pricePerDelivery: number;
    styles: Array<{ name: string; img: string; desc: string }>;
    frequencies: string[];
  }>({
    pricePerDelivery: 25,
    styles: [
      { name: 'Modern & Minimal', img: 'https://images.unsplash.com/photo-1561181286-d3fee7d55364?auto=format&fit=crop&w=300&q=80', desc: 'Zərif xətlər, tək tonlu dizayn.' },
      { name: 'Klassik Romantik', img: 'https://images.unsplash.com/photo-1596436889106-be35e843f974?auto=format&fit=crop&w=300&q=80', desc: 'Qızılgüllər və klassik toxunuşlar.' },
      { name: 'Vəhşi Təbiət', img: 'https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=300&q=80', desc: 'Çöl çiçəkləri və bohem harmoniyası.' },
      { name: 'Mövsüm Sürprizi', img: 'https://images.unsplash.com/photo-1587334206502-747aba2e8c25?auto=format&fit=crop&w=300&q=80', desc: 'Fəslin ən təravətli sürpriz çiçəkləri.' }
    ],
    frequencies: ['Hər Həftə', '2 Həftədən Bir', 'Ayda Bir']
  });

  // Wizard state variables
  const [selectedPlanCode, setSelectedPlanCode] = useState<string>('QUARTERLY');
  const [selectedStyle, setSelectedStyle] = useState<string>('Modern & Minimal');
  const [selectedFrequency, setSelectedFrequency] = useState<string>('2 Həftədən Bir');
  const [recipientName, setRecipientName] = useState<string>('');
  const [recipientPhone, setRecipientPhone] = useState<string>('');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [addressNote, setAddressNote] = useState<string>('');
  const [firstDeliveryDate, setFirstDeliveryDate] = useState<string>('');
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState<DeliveryTimeSlot>('SLOT_09_12');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CARD');
  const [activeStep, setActiveStep] = useState<number>(1);

  // Map state
  const [storeCenter, setStoreCenter] = useState<[number, number]>(FALLBACK_STORE_CENTER);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [mapSearchLoading, setMapSearchLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const minDateString = useMemo(() => {
    return toLocalDateInputString(addCalendarDaysLocal(new Date(), 1));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const plansRes = await authService.getSubscriptionPlans();
        if (!cancelled) setPlans(Array.isArray(plansRes) ? plansRes : []);
      } catch {
        if (!cancelled) setPlans([]);
      }

      try {
        const settingsRes = await authService.getClubSettings();
        if (settingsRes && !cancelled) {
          setClubSettings({
            pricePerDelivery: Number(settingsRes.pricePerDelivery) || 25,
            styles: Array.isArray(settingsRes.styles) && settingsRes.styles.length > 0 ? settingsRes.styles : clubSettings.styles,
            frequencies: Array.isArray(settingsRes.frequencies) && settingsRes.frequencies.length > 0 ? settingsRes.frequencies : clubSettings.frequencies
          });
        }
      } catch {
        const cached = localStorage.getItem('mock_club_settings');
        if (cached && !cancelled) {
          try {
            setClubSettings(JSON.parse(cached));
          } catch {
            //
          }
        }
      }

      try {
        const store = await plantDoctorService.getStoreLocation();
        if (store?.latitude && store?.longitude && !cancelled) {
          setStoreCenter([store.latitude, store.longitude]);
        }
      } catch {
        // use fallback
      }

      if (token) {
        try {
          const meRes = await authService.getMySubscription();
          if (!cancelled) setMySubscription(meRes);
        } catch {
          const localMock = localStorage.getItem(`mock_sub_${token}`);
          if (localMock && !cancelled) {
            try {
              setMySubscription(JSON.parse(localMock));
            } catch {
              setMySubscription(null);
            }
          } else if (!cancelled) {
            setMySubscription(null);
          }
        }
      } else if (!cancelled) {
        setMySubscription(null);
      }

      if (!cancelled) setLoading(false);
    };
    void loadData();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Autofill user profile details if logged in
  useEffect(() => {
    if (user) {
      if (!recipientName && (user.fullName || user.username)) {
        setRecipientName(user.fullName || user.username);
      }
      if (!recipientPhone && user.phoneNumber) {
        setRecipientPhone(user.phoneNumber);
      }
    }
  }, [user]);

  // Set default initial date to tomorrow
  useEffect(() => {
    if (!firstDeliveryDate) {
      setFirstDeliveryDate(minDateString);
    }
  }, [firstDeliveryDate, minDateString]);

  const getDeliveriesPerMonth = (freq: string) => {
    if (freq === 'Hər Həftə') return 4;
    if (freq === '2 Həftədən Bir') return 2;
    return 1; // Ayda Bir
  };

  const calculatePlanPrice = (periodMonths: number, discountPercent: number, freq: string) => {
    const deliveriesPerMonth = getDeliveriesPerMonth(freq);
    const totalDeliveries = periodMonths * deliveriesPerMonth;
    const pricePerDelivery = clubSettings.pricePerDelivery;
    const basePrice = totalDeliveries * pricePerDelivery;
    const discountMultiplier = 1 - (discountPercent / 100);
    return Math.round(basePrice * discountMultiplier);
  };

  const normalizedPlans = useMemo(() => {
    const defaultPlans = [
      { code: 'MONTHLY', discountPercent: 0, periodMonths: 1 },
      { code: 'QUARTERLY', discountPercent: 10, periodMonths: 3 },
      { code: 'SEMI_ANNUAL', discountPercent: 15, periodMonths: 6 },
      { code: 'ANNUAL', discountPercent: 20, periodMonths: 12 },
    ];
    const sourcePlans = plans.length > 0 ? plans : defaultPlans;
    return sourcePlans.map(p => {
      const period = p.periodMonths ?? (
        p.code === 'MONTHLY' ? 1 :
        p.code === 'QUARTERLY' ? 3 :
        p.code === 'SEMI_ANNUAL' ? 6 : 12
      );
      const discount = p.discountPercent ?? (
        p.code === 'MONTHLY' ? 0 :
        p.code === 'QUARTERLY' ? 10 :
        p.code === 'SEMI_ANNUAL' ? 15 : 20
      );
      return {
        ...p,
        periodMonths: period,
        discountPercent: discount,
        price: calculatePlanPrice(period, discount, selectedFrequency)
      };
    });
  }, [plans, selectedFrequency, clubSettings.pricePerDelivery]);

  const prettyPlanName = (code: string) => {
    const key = String(code || '').toUpperCase();
    if (key === 'MONTHLY') return 'Aylıq';
    if (key === 'QUARTERLY') return 'Rüblük';
    if (key === 'SEMI_ANNUAL') return 'Yarımillik';
    if (key === 'ANNUAL') return 'İllik';
    return key || 'Plan';
  };

  const selectedPlanDetails = useMemo(() => {
    return normalizedPlans.find((p) => p.code === selectedPlanCode) || normalizedPlans[0] || { price: 49, code: 'MONTHLY', periodMonths: 1, discountPercent: 0 };
  }, [normalizedPlans, selectedPlanCode]);

  // Subscription delivery calculations based on frequency, duration and discount
  const deliveriesPerMonth = useMemo(() => {
    return getDeliveriesPerMonth(selectedFrequency);
  }, [selectedFrequency]);

  const totalDeliveriesCount = useMemo(() => {
    const months = selectedPlanDetails.periodMonths || 1;
    return months * deliveriesPerMonth;
  }, [selectedPlanDetails.periodMonths, deliveriesPerMonth]);

  const singleDeliveryFee = useMemo(() => {
    return getSingleDeliveryFee(distanceKm);
  }, [distanceKm]);

  const baseTotalDeliveryFee = useMemo(() => {
    return singleDeliveryFee * totalDeliveriesCount;
  }, [singleDeliveryFee, totalDeliveriesCount]);

  const discountedDeliveryFee = useMemo(() => {
    const discount = Number(selectedPlanDetails.discountPercent || 0);
    const multiplier = 1 - (discount / 100);
    return Math.round(baseTotalDeliveryFee * multiplier);
  }, [baseTotalDeliveryFee, selectedPlanDetails.discountPercent]);

  const grandTotal = useMemo(() => {
    return (selectedPlanDetails.price || 0) + discountedDeliveryFee;
  }, [selectedPlanDetails, discountedDeliveryFee]);

  const handlePickMapLocation = (lat: number, lng: number) => {
    if (!isWithinBaku(lat, lng)) {
      setMapError('Çatdırılma yalnız Bakı şəhəri daxilində mümkündür. Zəhmət olmasa Bakı ərazisindən nöqtə seçin.');
      return;
    }
    setMapError(null);
    setSelectedLocation({ lat, lng });
    const computedDistance = calculateDistanceKm(storeCenter[0], storeCenter[1], lat, lng);
    setDistanceKm(Number(computedDistance.toFixed(2)));

    // Reverse geocode
    void fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.display_name && !deliveryAddress) {
          setDeliveryAddress(data.display_name);
        }
      })
      .catch(() => {});
  };

  const handleSearchLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapSearchQuery.trim()) return;
    setMapSearchLoading(true);
    setMapError(null);
    try {
      const q = encodeURIComponent(`${mapSearchQuery.trim()}, Baku, Azerbaijan`);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        if (!isWithinBaku(lat, lng)) {
          setMapError('Axtarılan ünvan Bakı daxilində tapılmadı.');
        } else {
          handlePickMapLocation(lat, lng);
          setDeliveryAddress(data[0].display_name || mapSearchQuery.trim());
        }
      } else {
        setMapError('Ünvan tapılmadı. Xəritədən birbaşa toxunaraq seçə bilərsiniz.');
      }
    } catch {
      setMapError('Axtarış zamanı xəta baş verdi.');
    } finally {
      setMapSearchLoading(false);
    }
  };

  const handleFinalCheckout = async () => {
    if (!token) {
      navigate('/login');
      return;
    }
    if (!recipientName || !recipientPhone || !deliveryAddress || !firstDeliveryDate) {
      setError('Zəhmət olmasa bütün çatdırılma məlumatlarını (ad, telefon, ünvan və tarix) doldurun.');
      setActiveStep(2);
      return;
    }
    setCheckoutLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const userId = user?.id ? Number(user.id) : 1;
      
      const payload = {
        userId,
        planCode: selectedPlanCode,
        planName: selectedPlanDetails.name || prettyPlanName(selectedPlanCode),
        style: selectedStyle,
        frequency: selectedFrequency,
        periodMonths: selectedPlanDetails.periodMonths || 1,
        addressLine: deliveryAddress,
        city: 'Bakı',
        addressNote: `${addressNote ? addressNote + ' | ' : ''}Qəbul edən: ${recipientName}, Tel: ${recipientPhone}`,
        recipientName,
        recipientPhone,
        distanceKm: distanceKm ?? 4,
        latitude: selectedLocation?.lat,
        longitude: selectedLocation?.lng,
        deliveryDate: firstDeliveryDate,
        deliveryTimeSlot,
        paymentMethod,
        amount: selectedPlanDetails.price || 49,
      };

      const response = await checkoutService.checkoutClubSubscription(payload);
      
      // Also notify auth-service subscription checkout
      try {
        await authService.checkoutSubscription({
          planCode: selectedPlanCode,
          style: selectedStyle,
          frequency: selectedFrequency,
          recipientName,
          recipientPhone,
          deliveryAddress,
          firstDeliveryDate,
        });
      } catch (authErr) {
        console.warn('Subscription record sync to auth-service:', authErr);
      }

      if (paymentMethod === 'CARD') {
        const paymentUrl = extractPaymentUrl(response);
        if (paymentUrl) {
          window.location.href = paymentUrl;
          return;
        }
      }

      setSuccess('BirBuketClub abunəliyiniz və sifarişiniz uğurla qeydə alındı!');
      setTimeout(() => {
        navigate('/account/orders');
      }, 1500);

    } catch (err: any) {
      console.error('Checkout error:', err);
      // Fallback in case of mock mode or offline server
      const isNetworkError = !err.response || err.code === 'ERR_NETWORK' || err.message?.includes('Network Error');
      if (isNetworkError || err.response?.status === 404 || err.response?.status === 500) {
        const mockSub = {
          planCode: selectedPlanCode,
          startDate: new Date().toISOString(),
          status: 'ACTIVE',
          style: selectedStyle,
          frequency: selectedFrequency,
          recipientName,
          recipientPhone,
          deliveryAddress,
          firstDeliveryDate,
          paidAmount: grandTotal,
        };
        localStorage.setItem(`mock_sub_${token}`, JSON.stringify(mockSub));
        setMySubscription(mockSub);
        setSuccess('BirBuketClub abunəliyiniz uğurla aktiv edildi (Local Mock Mode).');
      } else {
        const msg = err?.response?.data?.message || 'Sifariş tamamlanarkən xəta baş verdi.';
        setError(msg);
      }
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background with flower cover */}
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-95"
        style={{ backgroundImage: `url('${FLOWER_BG}')` }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-white/30 backdrop-blur-sm dark:bg-black/40 dark:backdrop-blur-sm"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-primary/15"
        aria-hidden
      />

      {/* Main content */}
      <div className="relative z-10 min-h-screen">
        <main className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 pb-16 pt-8">
          
          {/* Hero Section */}
          <section className="mb-16 grid gap-10 lg:grid-cols-2 lg:items-center">
            <div className="flex flex-col gap-6 rounded-[2rem] border border-white/30 bg-white/50 p-6 sm:p-8 backdrop-blur-md dark:bg-slate-900/35 dark:border-white/10 shadow-sm">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/15 px-4 py-1.5 text-xs font-bold text-slate-900 dark:text-white backdrop-blur-md">
                <Sparkles className="w-3.5 h-3.5 text-primary fill-primary" />
                Premium Çiçək Abunəliyi
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.15] drop-shadow-sm">
                Hər Fəsil <span className="text-primary italic">Təravət</span> Evinizdə Olsun.
              </h1>
              <p className="text-sm sm:text-base text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                Evinizi və ya ofisinizi hər zaman təravətli çiçəklərlə bəzəyin. İstədiyiniz tezlikdə və üslubda çiçəklər qapınıza qədər çatdırılsın.
              </p>
              <div className="flex flex-wrap gap-4 pt-2">
                <a
                  href="#setup-wizard"
                  className="rounded-2xl bg-primary px-8 py-4 text-sm font-black text-white shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all text-center"
                >
                  İndi Abunə Ol
                </a>
                <a
                  href="#club-plans"
                  className="rounded-2xl border border-white/60 bg-white/70 px-8 py-4 text-sm font-black text-slate-800 shadow-md backdrop-blur-md hover:bg-white dark:border-white/20 dark:bg-slate-900/60 dark:text-white dark:hover:bg-slate-900/80 transition-all text-center"
                >
                  Planlara Bax
                </a>
              </div>
            </div>

            <div className="relative aspect-square max-w-md mx-auto w-full rounded-3xl overflow-hidden shadow-2xl border border-white/40 group">
              <img
                src="https://images.unsplash.com/photo-1561181286-d3fee7d55364?auto=format&fit=crop&w=1000&q=80"
                alt="BirBuket Club Subscription"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 rounded-2xl border border-white/30 bg-white/80 p-4 backdrop-blur-md dark:bg-slate-900/80 dark:border-white/10">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-9 w-9 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center"
                      >
                        <User2 className="w-4 h-4 text-slate-500" />
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">1200+ Aktiv Abunəçi</p>
                    <div className="flex text-yellow-400">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-current" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Subscription Plans */}
          <section id="club-plans" className="mb-20 scroll-mt-24">
            <div className="mb-10 text-center">
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white drop-shadow-sm">
                {t('club_plans_title')}
              </h2>
              <p className="mt-2 text-slate-700 dark:text-slate-300 mb-6">{t('club_plans_sub')}</p>

              {/* Frequencies quick select */}
              <div className="inline-flex rounded-xl bg-white/50 dark:bg-slate-900/40 p-1 border border-white/30 backdrop-blur-sm">
                {clubSettings.frequencies.map((freq) => {
                  const isSelected = selectedFrequency === freq;
                  return (
                    <button
                      key={freq}
                      type="button"
                      onClick={() => setSelectedFrequency(freq)}
                      className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-primary text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-white/30 dark:hover:bg-white/5'
                      }`}
                    >
                      {freq}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <div className="mb-6 rounded-xl border border-red-200/80 bg-red-50/90 px-4 py-3 text-sm font-semibold text-red-700 backdrop-blur-sm dark:border-red-900/40 dark:bg-red-900/30 dark:text-red-300">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-6 rounded-xl border border-green-200/80 bg-green-50/90 px-4 py-3 text-sm font-semibold text-green-700 backdrop-blur-sm dark:border-green-900/40 dark:bg-green-900/30 dark:text-green-300">
                {success}
              </div>
            )}

            <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
              {loading ? (
                <div className="col-span-full flex items-center justify-center gap-2 py-8 text-sm text-slate-600 dark:text-white/70">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('loading_api')}
                </div>
              ) : (
                normalizedPlans.map((plan) => {
                  const isSelected = selectedPlanCode === plan.code;
                  const isPopular = String(plan.code).toUpperCase() === 'QUARTERLY';
                  return (
                    <div
                      key={plan.code}
                      className={`relative flex flex-col rounded-3xl border p-7 shadow-md backdrop-blur-md transition-all duration-300 ${
                        isSelected
                          ? 'border-2 border-primary bg-white/95 dark:bg-slate-900/95 shadow-xl scale-[1.02] ring-4 ring-primary/10'
                          : isPopular
                          ? 'border-primary/45 bg-white/85 dark:bg-slate-900/80 shadow-md'
                          : 'border-white/40 bg-white/75 hover:border-primary/40 dark:border-white/10 dark:bg-slate-900/70'
                      }`}
                    >
                      {isPopular && (
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-bold text-white uppercase tracking-widest">
                          {t('club_popular')}
                        </div>
                      )}
                      <div className="mb-5">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                          {plan.name || prettyPlanName(plan.code)}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">BirBuketClub</p>
                      </div>
                      <div className="mb-7 flex items-baseline gap-1">
                        <span className="text-4xl font-black text-slate-900 dark:text-white">
                          {typeof plan.price === 'number' ? `${plan.price} AZN` : '—'}
                        </span>
                        <span className="text-slate-500">/{plan.periodMonths || '-'} ay</span>
                      </div>
                      <ul className="mb-7 flex flex-col gap-3 text-sm">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                          Endirim: {Number(plan.discountPercent || 0)}%
                        </li>
                        <li className="flex items-center gap-2">
                          <Leaf className="w-4 h-4 text-primary shrink-0" />
                          Mövsümi premium seçimlər
                        </li>
                        <li className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-primary shrink-0" />
                          Çatdırılmaya da {Number(plan.discountPercent || 0)}% endirim
                        </li>
                      </ul>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPlanCode(plan.code);
                          document.getElementById('setup-wizard')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className={`mt-auto w-full rounded-xl py-3 font-bold transition-all ${
                          isSelected
                            ? 'bg-primary text-white hover:bg-primary/90'
                            : 'bg-primary/15 text-primary hover:bg-primary hover:text-white'
                        }`}
                      >
                        {isSelected ? t('club_selected') : t('club_select')}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Setup Wizard Section */}
          <section id="setup-wizard" className="rounded-[2.2rem] border border-white/35 bg-white/65 p-6 sm:p-8 lg:p-10 shadow-lg backdrop-blur-lg dark:bg-slate-900/60 dark:border-white/10 scroll-mt-24">
            <div className="mb-10 text-center">
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{t('club_setup_title')}</h2>
              <p className="mt-2 text-slate-600 dark:text-slate-400">{t('club_setup_sub')}</p>
            </div>

            {/* Stepper Tabs */}
            <div className="mx-auto mb-12 max-w-4xl">
              <div className="flex justify-between items-center relative">
                {['1. Üslub & Tezlik', '2. Çatdırılma & Xəritə', '3. Təsdiq & Ödəniş'].map((step, idx) => {
                  const stepNum = idx + 1;
                  const isActive = activeStep === stepNum;
                  const isCompleted = activeStep > stepNum;
                  return (
                    <button
                      key={step}
                      type="button"
                      onClick={() => {
                        if (stepNum === 1 || (stepNum === 2 && selectedStyle && selectedFrequency) || (stepNum === 3 && recipientName && deliveryAddress)) {
                          setActiveStep(stepNum);
                        }
                      }}
                      className="flex flex-col items-center gap-2 z-10 focus:outline-none"
                    >
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-full font-bold transition-all ${
                          isActive
                            ? 'bg-primary text-white ring-8 ring-primary/20 shadow-md scale-110'
                            : isCompleted
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-primary/15 text-primary hover:bg-primary/25'
                        }`}
                      >
                        {isCompleted ? '✓' : stepNum}
                      </div>
                      <span className={`text-xs font-bold transition-colors ${isActive ? 'text-primary' : 'text-slate-600 dark:text-slate-400'}`}>
                        {step}
                      </span>
                    </button>
                  );
                })}
                <div className="absolute top-5 left-0 h-0.5 w-full bg-white/60 dark:bg-slate-700 -z-0" />
                <div
                  className="absolute top-5 left-0 h-0.5 bg-primary transition-all duration-300 -z-0"
                  style={{ width: activeStep === 1 ? '0%' : activeStep === 2 ? '50%' : '100%' }}
                />
              </div>
            </div>

            <div className="grid gap-10 lg:grid-cols-2">
              {/* Left column: Step Content */}
              <div className="flex flex-col gap-7 rounded-2xl border border-white/30 bg-white/50 p-6 backdrop-blur-md dark:bg-slate-900/50 dark:border-white/10">
                
                {/* STEP 1: Style & Frequency */}
                {activeStep === 1 && (
                  <div className="flex flex-col gap-6">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">{t('club_step_style_title')}</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {clubSettings.styles.map((styleObj) => {
                          const isSelectedStyle = selectedStyle === styleObj.name;
                          return (
                            <button
                              key={styleObj.name}
                              type="button"
                              onClick={() => setSelectedStyle(styleObj.name)}
                              className={`relative flex cursor-pointer text-left flex-col gap-2 rounded-2xl border-2 p-3.5 transition-all ${
                                isSelectedStyle
                                  ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                                  : 'border-white/50 bg-white/40 hover:border-primary/30 dark:border-white/10 dark:bg-white/5'
                              }`}
                            >
                              <div className="w-full h-28 rounded-lg overflow-hidden border border-white/10 mb-2">
                                <img
                                  src={styleObj.img}
                                  alt={styleObj.name}
                                  className="w-full h-full object-cover hover:scale-110 transition-all duration-300"
                                />
                              </div>
                              <div className="flex justify-between items-center w-full">
                                <span className="font-bold text-slate-900 dark:text-white text-xs">{styleObj.name}</span>
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${isSelectedStyle ? 'border-primary bg-primary' : 'border-slate-350 dark:border-slate-600'}`}>
                                  {isSelectedStyle && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                </div>
                              </div>
                              <span className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                                {styleObj.desc}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">{t('club_step_freq_title')}</h3>
                      <div className="grid grid-cols-3 gap-3">
                        {clubSettings.frequencies.map((freq) => {
                          const isSelectedFreq = selectedFrequency === freq;
                          return (
                            <button
                              key={freq}
                              type="button"
                              onClick={() => setSelectedFrequency(freq)}
                              className={`rounded-xl py-3.5 text-xs font-bold transition-all text-center ${
                                isSelectedFreq
                                  ? 'bg-primary text-white shadow-md'
                                  : 'bg-white/60 hover:bg-white/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 backdrop-blur-sm'
                              }`}
                            >
                              {freq}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveStep(2)}
                      className="mt-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-primary dark:text-[#0d1b12] py-4 font-bold text-white shadow-md transition-all text-center w-full"
                    >
                      Məlumatları Daxil Et →
                    </button>
                  </div>
                )}

                {/* STEP 2: Delivery Details & Interactive Baku Map */}
                {activeStep === 2 && (
                  <div className="flex flex-col gap-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">Çatdırılma Məlumatları</h3>
                      <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">Bakı Daxili</span>
                    </div>

                    {/* Delivery Tariff Info Box inside Step 2 */}
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs space-y-2 text-slate-800 dark:text-slate-200">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400">
                        <Info className="w-4 h-4 shrink-0" />
                        <span>Bakı daxili çatdırılma tarifləri:</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                        <div>• 4 km-ə qədər: <strong>5 AZN</strong></div>
                        <div>• 4–8 km: <strong>10 AZN</strong></div>
                        <div>• 8–15 km: <strong>15 AZN</strong></div>
                        <div>• 15 km-dən çox: <strong>20 AZN</strong></div>
                      </div>
                      <div className="pt-1.5 border-t border-emerald-500/15 text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold">
                        💡 Seçilmiş planın <strong>{selectedPlanDetails.discountPercent}% endirimi</strong> ümumi çatdırılma haqqına da tətbiq olunur!
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                          {t('club_recipient_name')} *
                        </label>
                        <input
                          type="text"
                          value={recipientName}
                          onChange={(e) => setRecipientName(e.target.value)}
                          placeholder={t('club_recipient_name_placeholder')}
                          className="w-full h-11 px-4 rounded-xl border border-slate-300 dark:border-white/10 bg-white/70 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                          {t('club_phone')} *
                        </label>
                        <input
                          type="text"
                          value={recipientPhone}
                          onChange={(e) => setRecipientPhone(e.target.value)}
                          placeholder="+994 50 123 45 67"
                          className="w-full h-11 px-4 rounded-xl border border-slate-300 dark:border-white/10 bg-white/70 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                          İlk Çatdırılma Tarixi *
                        </label>
                        <input
                          type="date"
                          min={minDateString}
                          value={firstDeliveryDate}
                          onChange={(e) => setFirstDeliveryDate(e.target.value)}
                          className="w-full h-11 px-4 rounded-xl border border-slate-300 dark:border-white/10 bg-white/70 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                          Çatdırılma Saatı Slotu *
                        </label>
                        <select
                          value={deliveryTimeSlot}
                          onChange={(e) => setDeliveryTimeSlot(e.target.value as DeliveryTimeSlot)}
                          className="w-full h-11 px-4 rounded-xl border border-slate-300 dark:border-white/10 bg-white/70 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-white"
                        >
                          {DELIVERY_SLOTS.map((s) => (
                            <option key={s.value} value={s.value} className="dark:bg-slate-900">
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Interactive Leaflet Map for Baku */}
                    <div className="space-y-3">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                        Xəritədən Çatdırılma Ünvanını Seçin *
                      </label>
                      <form onSubmit={handleSearchLocation} className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={mapSearchQuery}
                            onChange={(e) => setMapSearchQuery(e.target.value)}
                            placeholder="Bakı daxili küçə, bina və ya ərazi axtarın..."
                            className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-300 dark:border-white/10 bg-white/70 dark:bg-white/5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-white"
                          />
                          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        </div>
                        <button
                          type="submit"
                          disabled={mapSearchLoading}
                          className="px-4 h-10 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 disabled:opacity-60"
                        >
                          {mapSearchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Axtar'}
                        </button>
                      </form>

                      {mapError && (
                        <p className="text-xs font-semibold text-red-600 dark:text-red-400">{mapError}</p>
                      )}

                      <div className="h-60 w-full rounded-2xl overflow-hidden border border-slate-300 dark:border-white/10 relative z-0">
                        <MapContainer
                          center={selectedLocation ? [selectedLocation.lat, selectedLocation.lng] : storeCenter}
                          zoom={12}
                          scrollWheelZoom={false}
                          className="h-full w-full"
                        >
                          <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          />
                          <MapClickSelector
                            lat={selectedLocation?.lat ?? null}
                            lng={selectedLocation?.lng ?? null}
                            onPick={handlePickMapLocation}
                          />
                          <FlyToLocation
                            lat={selectedLocation?.lat ?? null}
                            lng={selectedLocation?.lng ?? null}
                          />
                        </MapContainer>
                      </div>

                      {distanceKm !== null && (
                        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1">
                          <div className="flex items-center justify-between font-semibold text-emerald-800 dark:text-emerald-300">
                            <span className="flex items-center gap-1.5">
                              <MapPin className="w-4 h-4 text-emerald-600" />
                              Məsafə: <strong>{distanceKm} km</strong> (1 çatdırılma: {singleDeliveryFee} AZN)
                            </span>
                            <span>{totalDeliveriesCount} dəfə çatdırılma</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300 pt-1 border-t border-emerald-500/15">
                            <span>Çatdırılma cəmi ({totalDeliveriesCount} × {singleDeliveryFee} AZN): {baseTotalDeliveryFee} AZN</span>
                            <span className="font-bold text-emerald-700 dark:text-emerald-400">
                              Endirimlə ({selectedPlanDetails.discountPercent}%): {discountedDeliveryFee} AZN
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                        Dəqiq Ünvan (Küçə, Bina, Mənzil) *
                      </label>
                      <textarea
                        rows={2}
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        placeholder="Məsələn: Nizami küçəsi 45, bina 2, mənzil 18"
                        className="w-full p-3.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white/70 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-white resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                        Kuryer / Sifariş Qeydi (İstəyə görə)
                      </label>
                      <input
                        type="text"
                        value={addressNote}
                        onChange={(e) => setAddressNote(e.target.value)}
                        placeholder="Məsələn: Blokun kodu 1234, qapını döyməyin"
                        className="w-full h-11 px-4 rounded-xl border border-slate-300 dark:border-white/10 bg-white/70 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-white"
                      />
                    </div>

                    <div className="flex gap-4 mt-2">
                      <button
                        type="button"
                        onClick={() => setActiveStep(1)}
                        className="flex-1 rounded-xl border border-slate-300 dark:border-white/10 py-4 font-bold text-slate-700 dark:text-slate-300 bg-white/50 dark:bg-white/5 hover:bg-white/70 dark:hover:bg-white/10 transition-all text-center"
                      >
                        {t('club_btn_prev')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!recipientName || !recipientPhone || !deliveryAddress) {
                            setError('Zəhmət olmasa bütün məlumatları doldurun.');
                            return;
                          }
                          setError(null);
                          setActiveStep(3);
                        }}
                        className="flex-1 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-primary dark:text-[#0d1b12] py-4 font-bold text-white shadow-md transition-all text-center"
                      >
                        Sifariş Xülasəsinə Bax →
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3: Summary, Payment Method & Confirm */}
                {activeStep === 3 && (
                  <div className="flex flex-col gap-6">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('club_step_confirm_title')}</h3>
                    
                    {/* Payment Method Selection */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-2.5">
                        Ödəniş Üsulu
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('CARD')}
                          className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                            paymentMethod === 'CARD'
                              ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                              : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <CreditCard className="w-5 h-5 shrink-0" />
                          <div className="text-left">
                            <p className="text-xs font-bold">Kartla Onlayn</p>
                            <p className="text-[10px] opacity-75">Təhlükəsiz ödəniş</p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPaymentMethod('CASH')}
                          className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                            paymentMethod === 'CASH'
                              ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                              : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <Wallet className="w-5 h-5 shrink-0" />
                          <div className="text-left">
                            <p className="text-xs font-bold">Qapıda Nağd</p>
                            <p className="text-[10px] opacity-75">Kuryerə ödəniş</p>
                          </div>
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-5 text-sm">
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mb-2">{t('club_confirm_sub')}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
                        {t('club_confirm_desc')}
                      </p>
                      <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>{t('club_confirm_tip')}</span>
                      </div>
                    </div>

                    <div className="flex gap-4 mt-2">
                      <button
                        type="button"
                        onClick={() => setActiveStep(2)}
                        className="flex-1 rounded-xl border border-slate-300 dark:border-white/10 py-4 font-bold text-slate-700 dark:text-slate-300 bg-white/50 dark:bg-white/5 hover:bg-white/70 dark:hover:bg-white/10 transition-all text-center"
                      >
                        {t('club_btn_prev')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleFinalCheckout()}
                        disabled={checkoutLoading}
                        className="flex-1 rounded-xl bg-primary py-4 font-bold text-white hover:bg-primary/90 disabled:opacity-60 shadow-lg shadow-primary/20 transition-all text-center flex items-center justify-center gap-2"
                      >
                        {checkoutLoading ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            {paymentMethod === 'CARD' ? 'Ödənişə yönləndirilir...' : 'Sifariş tamamlanır...'}
                          </>
                        ) : (
                          'Ödəniş et'
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Right column: Order Summary */}
              <div className="flex flex-col gap-6">
                <div className="rounded-3xl border border-white/35 bg-white/60 p-6 sm:p-7 backdrop-blur-md dark:bg-slate-900/60 dark:border-white/10 shadow-sm">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-5">{t('club_summary_title')}</h3>
                  <div className="flex flex-col gap-3.5 border-b border-primary/15 pb-5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">{t('club_summary_plan')}</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {prettyPlanName(selectedPlanDetails.code)} ({selectedPlanDetails.periodMonths} aylıq)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">{t('club_summary_style')}</span>
                      <span className="font-bold text-slate-900 dark:text-white">{selectedStyle}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">{t('club_summary_freq')}</span>
                      <span className="font-bold text-slate-900 dark:text-white">{selectedFrequency} ({totalDeliveriesCount} dəfə çatdırılma)</span>
                    </div>
                    {firstDeliveryDate && (
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">İlk Tarix / Saat:</span>
                        <span className="font-bold text-slate-900 dark:text-white truncate max-w-[190px]">
                          {firstDeliveryDate} ({DELIVERY_SLOTS.find(s => s.value === deliveryTimeSlot)?.label})
                        </span>
                      </div>
                    )}
                    {recipientName && (
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">{t('club_summary_recipient')}</span>
                        <span className="font-bold text-slate-900 dark:text-white truncate max-w-[180px]">{recipientName}</span>
                      </div>
                    )}
                    {deliveryAddress && (
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">{t('club_summary_address')}</span>
                        <span className="font-bold text-slate-900 dark:text-white truncate max-w-[180px]">{deliveryAddress}</span>
                      </div>
                    )}
                    
                    <div className="pt-2 border-t border-slate-200/50 dark:border-white/5 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">Buket Paketi ({totalDeliveriesCount} buket, {selectedPlanDetails.discountPercent}% endirimlə):</span>
                        <span className="font-semibold text-slate-900 dark:text-white">{selectedPlanDetails.price} AZN</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600 dark:text-slate-400">
                          Çatdırılma Haqqı ({totalDeliveriesCount} dəfə, {selectedPlanDetails.discountPercent}% endirimlə):
                        </span>
                        <span className="font-bold text-emerald-600">
                          {discountedDeliveryFee} AZN
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-5">
                    <span className="text-lg font-bold text-slate-900 dark:text-white">{t('club_summary_total')}</span>
                    <span className="text-3xl font-black text-primary">
                      {grandTotal} AZN
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/35 bg-white/50 p-4 flex items-start gap-3 backdrop-blur-md dark:bg-slate-900/50 shadow-sm">
                  <ShieldCheck className="w-5 h-5 mt-0.5 text-primary shrink-0" />
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {t('club_security_tip')}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
