import {
  ArrowLeft,
  CalendarDays,
  ClipboardCheck,
  FileText,
  Info,
  Leaf,
  MapPin,
  ReceiptText,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { plantDoctorService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { todayLocalDateInput } from '../utils/dateInput';

const plantCountOptions = [
  { key: '1-3', label: '1-3', fee: 15 },
  { key: '4-7', label: '4-7', fee: 30 },
  { key: '8+', label: '8+', fee: 50 },
] as const;

const timeSlots = ['09:00 - 12:00', '12:00 - 15:00', '15:00 - 18:00', '18:00 - 21:00'] as const;

const toText = (...values: any[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const normalizeAzPhone = (raw: string) => {
  const onlyDigits = raw.replace(/\D/g, '');
  let localPart = onlyDigits;
  if (localPart.startsWith('994')) localPart = localPart.slice(3);
  else if (localPart.startsWith('0')) localPart = localPart.slice(1);
  localPart = localPart.slice(0, 9);
  return `+994${localPart}`;
};

const formatAzPhone = (raw: string) => {
  const normalized = normalizeAzPhone(raw);
  const local = normalized.replace(/\D/g, '').replace(/^994/, '').slice(0, 9);
  const p1 = local.slice(0, 2);
  const p2 = local.slice(2, 5);
  const p3 = local.slice(5, 7);
  const p4 = local.slice(7, 9);
  const chunks = [p1, p2, p3, p4].filter(Boolean);
  return chunks.length ? `+994 ${chunks.join(' ')}` : '+994';
};

const isValidAzPhone = (raw: string) => {
  const digits = raw.replace(/\D/g, '');
  return digits.startsWith('994') && digits.length === 12;
};

const FALLBACK_STORE_CENTER: [number, number] = [40.4093, 49.8671];
const BAKU_BOUNDS = {
  minLat: 40.10,
  maxLat: 40.65,
  minLng: 49.60,
  maxLng: 50.40,
};
const TRANSPORT_RATE_PER_KM = 0.8;
const FREE_DISTANCE_KM = 4;

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
  return <CircleMarker center={[lat, lng]} radius={8} pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.6 }} />;
}

function FlyToLocation({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (lat == null || lng == null) return;
    map.flyTo([lat, lng], 15, { duration: 0.6 });
  }, [lat, lng, map]);
  return null;
}

export default function PlantDoctorReservation() {
  const navigate = useNavigate();
  const { token, userId } = useAuth();
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [plantCount, setPlantCount] = useState<(typeof plantCountOptions)[number]['key']>('1-3');
  const [visitDate, setVisitDate] = useState('');
  const [slot, setSlot] = useState<(typeof timeSlots)[number]>('12:00 - 15:00');
  const [notes, setNotes] = useState('');
  const [serviceType, setServiceType] = useState('Budama və ümumi baxım');
  const [savedAddresses, setSavedAddresses] = useState<
    Array<{ id: number; fullAddressLine: string; phoneNumber: string; latitude: number | null; longitude: number | null }>
  >([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [saveAddress] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressNotice, setAddressNotice] = useState<string | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [mapSearch, setMapSearch] = useState('');
  const [mapSearching, setMapSearching] = useState(false);
  const [mapStyle, setMapStyle] = useState<'street' | 'satellite'>('satellite');
  const [submitting, setSubmitting] = useState(false);
  const [serverPricing, setServerPricing] = useState<{
    baseVisitFee?: number;
    plantCountFee?: number;
    transportFee?: number;
    totalFee?: number;
  } | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [storeLocation, setStoreLocation] = useState<{
    latitude: number;
    longitude: number;
    name: string;
    addressLine: string;
  }>({
    latitude: FALLBACK_STORE_CENTER[0],
    longitude: FALLBACK_STORE_CENTER[1],
    name: 'Mağaza',
    addressLine: '',
  });
  const mapTileUrl =
    mapStyle === 'satellite'
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const mapAttribution =
    mapStyle === 'satellite'
      ? 'Tiles &copy; Esri'
      : '&copy; OpenStreetMap contributors';
  const selectedPlantCountFee = plantCountOptions.find((option) => option.key === plantCount)?.fee ?? 0;
  const previewTransportFee =
    typeof distanceKm === 'number'
      ? Number((Math.max(0, distanceKm - FREE_DISTANCE_KM) * TRANSPORT_RATE_PER_KM).toFixed(2))
      : null;
  const previewBaseFee = 20;
  const previewTotalFee = Number((previewBaseFee + selectedPlantCountFee + (previewTransportFee ?? 0)).toFixed(2));

  const fillAddressFromCoordinates = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=az&lat=${lat}&lon=${lng}`
      );
      if (!res.ok) return;
      const data = await res.json();
      const addr = data?.address || {};
      const road = toText(addr?.road, addr?.pedestrian, addr?.residential, addr?.path, addr?.footway);
      const houseNumber = toText(addr?.house_number, addr?.house, addr?.building);
      const suburb = toText(addr?.suburb, addr?.neighbourhood, addr?.quarter);
      const parsedStreetLine = [road, houseNumber, suburb].filter(Boolean).join(', ');
      const fallbackLine = toText(data?.display_name);
      const resolvedLine = toText(parsedStreetLine, fallbackLine);
      if (resolvedLine) setAddress(resolvedLine);

    } catch {
      // Silently ignore reverse geocoding failures; coordinates remain selected.
    }
  };


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
          name: toText(payload?.name, payload?.storeName) || 'Mağaza',
          addressLine: toText(payload?.addressLine, payload?.address, payload?.fullAddressLine),
        });
      } catch {
        // fallback center is used when store-location endpoint is unavailable
      }
    };
    loadStoreLocation();
  }, []);

  useEffect(() => {
    const loadAddresses = async () => {
      if (!token || !userId) return;
      setAddressLoading(true);
      try {
        const res = await plantDoctorService.getAddresses(userId);
        const rowsRaw =
          (Array.isArray(res) && res) ||
          (Array.isArray(res?.data) && res.data) ||
          (Array.isArray(res?.addresses) && res.addresses) ||
          (Array.isArray(res?.data?.data) && res.data.data) ||
          (Array.isArray(res?.data?.addresses) && res.data.addresses) ||
          [];

        const normalized = rowsRaw
          .map((x: any) => ({
            id: Number(x?.id ?? x?.addressId ?? x?.address_id ?? 0),
            fullAddressLine: toText(x?.fullAddressLine, x?.addressLine, x?.address, x?.fullAddress),
            phoneNumber: formatAzPhone(toText(x?.phoneNumber, x?.phone, x?.contactNumber, x?.mobileNumber, x?.contactPhone)),
            latitude: typeof x?.latitude === 'number' ? x.latitude : typeof x?.lat === 'number' ? x.lat : null,
            longitude: typeof x?.longitude === 'number' ? x.longitude : typeof x?.lng === 'number' ? x.lng : null,
          }))
          .filter((x: any) => Number.isFinite(x.id) && x.id > 0);

        setSavedAddresses(normalized);
        if (!selectedAddressId && !phone.trim() && normalized.length > 0) {
          const firstPhone = toText(normalized[0]?.phoneNumber);
          const firstAddress = toText(normalized[0]?.fullAddressLine);
          if (firstPhone) setPhone(firstPhone);
          if (firstAddress) setAddress(firstAddress);
          if (typeof normalized[0]?.latitude === 'number') setLatitude(normalized[0].latitude);
          if (typeof normalized[0]?.longitude === 'number') setLongitude(normalized[0].longitude);
        }
      } catch {
        setSavedAddresses([]);
      } finally {
        setAddressLoading(false);
      }
    };
    loadAddresses();
  }, [token, userId]);

  useEffect(() => {
    if (!selectedAddressId) return;
    const selected = savedAddresses.find((x) => x.id === selectedAddressId);
    if (!selected) return;
    if (selected.phoneNumber) {
      setPhone(selected.phoneNumber);
    }
    setAddress(selected.fullAddressLine || '');
    if (typeof selected.latitude === 'number') setLatitude(selected.latitude);
    if (typeof selected.longitude === 'number') setLongitude(selected.longitude);
  }, [selectedAddressId, savedAddresses]);

  useEffect(() => {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      setDistanceKm(null);
      return;
    }
    const km = calculateDistanceKm(storeLocation.latitude, storeLocation.longitude, latitude, longitude);
    setDistanceKm(Number(km.toFixed(2)));
  }, [latitude, longitude, storeLocation.latitude, storeLocation.longitude]);

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
      if (!selectedAddressId) {
        await fillAddressFromCoordinates(lat, lng);
      }
      setAddressNotice('Ünvan xəritədə tapıldı.');
    } catch {
      setAddressNotice('Axtarış zamanı xəta baş verdi.');
    } finally {
      setMapSearching(false);
    }
  };

  const onAddressChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const raw = e.target.value;
    if (!raw) {
      setSelectedAddressId(null);
      return;
    }

    const id = Number(raw);
    setSelectedAddressId(id);
    const selected = savedAddresses.find((x) => Number(x.id) === id);
    if (!selected) return;

    setPhone(toText(selected.phoneNumber));
    setAddress(toText(selected.fullAddressLine));
    if (typeof selected.latitude === 'number') setLatitude(selected.latitude);
    if (typeof selected.longitude === 'number') setLongitude(selected.longitude);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitMessage(null);
    setSubmitError(null);

    if (!token || !userId) {
      navigate('/login', { state: { message: 'Rezervasiya üçün əvvəlcə daxil olun.' } });
      return;
    }
    if (!visitDate) {
      setSubmitError('Zəhmət olmasa ziyarət tarixini seçin.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(visitDate)) {
      setSubmitError('Tarix formatı yyyy-MM-dd olmalıdır.');
      return;
    }
    if (visitDate < todayLocalDateInput()) {
      setSubmitError('Keçmiş tarix üçün ziyarət sifarişi verilə bilməz.');
      return;
    }

    setSubmitting(true);
    try {
      const slotMap: Record<(typeof timeSlots)[number], 'SLOT_09_12' | 'SLOT_12_15' | 'SLOT_15_18' | 'SLOT_18_21'> = {
        '09:00 - 12:00': 'SLOT_09_12',
        '12:00 - 15:00': 'SLOT_12_15',
        '15:00 - 18:00': 'SLOT_15_18',
        '18:00 - 21:00': 'SLOT_18_21',
      };
      const rangeMap: Record<(typeof plantCountOptions)[number]['key'], 'RANGE_1_3' | 'RANGE_4_7' | 'RANGE_8_PLUS'> = {
        '1-3': 'RANGE_1_3',
        '4-7': 'RANGE_4_7',
        '8+': 'RANGE_8_PLUS',
      };

      const selectedAddress = savedAddresses.find((x) => x.id === selectedAddressId) || null;
      let effectiveAddressId: number | undefined = selectedAddress?.id;
      const manualFullAddress = address.trim();
      const manualPhone = formatAzPhone(phone.trim());
      const effectiveLatitude = selectedAddress?.latitude ?? latitude;
      const effectiveLongitude = selectedAddress?.longitude ?? longitude;

      if (!selectedAddress) {
        if (!address.trim() || !manualPhone) {
          setSubmitError('Zəhmət olmasa ünvan və əlaqə nömrəsini doldurun.');
          setSubmitting(false);
          return;
        }
        if (!isValidAzPhone(manualPhone)) {
          setSubmitError('Əlaqə nömrəsini düzgün formatda daxil edin.');
          setSubmitting(false);
          return;
        }

        if (saveAddress) {
          const addressRes = await plantDoctorService.createAddress({
            userId,
            phoneNumber: manualPhone,
            fullAddressLine: manualFullAddress,
            latitude: effectiveLatitude ?? undefined,
            longitude: effectiveLongitude ?? undefined,
          });
          const createdAddressId = Number(addressRes?.data?.id ?? 0);
          if (Number.isFinite(createdAddressId) && createdAddressId > 0) {
            effectiveAddressId = createdAddressId;
          }
        }
      }

      const res = await plantDoctorService.createHomeVisitReservation({
        userId,
        plantType: serviceType,
        symptoms: notes.trim() || 'Eve bağban çağırışı üçün ümumi baxım sorğusu',
        addressId: effectiveAddressId,
        phoneNumber: effectiveAddressId ? undefined : manualPhone,
        fullAddressLine: effectiveAddressId ? undefined : manualFullAddress,
        latitude: effectiveLatitude ?? undefined,
        longitude: effectiveLongitude ?? undefined,
        distanceKm: typeof distanceKm === 'number' ? distanceKm : undefined,
        plantCountRange: rangeMap[plantCount],
        // "Ziyarət vaxtı" bloku ayrıca endpoint istifadə etmir;
        // create diagnosis request-ində visitDate + visitTimeSlot sahələri ilə göndərilir.
        visitDate,
        visitTimeSlot: slotMap[slot],
        specialNote: `[Xidmət: ${serviceType}] ${notes.trim()}`,
        saveAddress: saveAddress && !selectedAddress && !effectiveAddressId,
      });
      setServerPricing({
        baseVisitFee: Number(res?.data?.baseVisitFee ?? 0),
        plantCountFee: Number(res?.data?.plantCountFee ?? 0),
        transportFee: Number(res?.data?.transportFee ?? 0),
        totalFee: Number(res?.data?.totalFee ?? 0),
      });
      const confirmationPhone = selectedAddress?.phoneNumber || manualPhone;
      navigate('/bir-bagban/reservation/success', {
        state: { phoneNumber: confirmationPhone },
      });
    } catch (err: any) {
      setSubmitError(err?.response?.data?.message || 'Rezervasiya yaradılmadı. Yenidən cəhd edin.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen">
      <main className="mx-auto max-w-[1200px] px-6 lg:px-10 py-10">
        <div className="mb-10">
          <Link to="/bir-bagban" className="flex items-center gap-2 text-primary text-sm font-medium mb-4 hover:underline">
            <ArrowLeft className="w-4 h-4" />
            Geri qayıt
          </Link>
          <h1 className="text-3xl font-black">Eve Bağban Çağırışı</h1>
          <p className="text-slate-500 mt-2">Məlumatları doldurun və peşəkar bağbanımız bitkilərinizə yerində qulluq etsin.</p>
        </div>

        <form className="grid grid-cols-1 lg:grid-cols-12 gap-12" onSubmit={handleSubmit}>
          <div className="lg:col-span-8 space-y-8">
            <section className="bg-white dark:bg-slate-900/50 p-8 rounded-2xl border border-primary/10 shadow-sm">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-10 h-10 bg-primary/20 text-primary rounded-full flex items-center justify-center font-bold">1</div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  Ünvan məlumatları
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {savedAddresses.length > 0 && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1.5">Yaddaşdakı ünvandan seç</label>
                    <select
                      value={selectedAddressId ?? ''}
                      onChange={onAddressChange}
                      className="w-full rounded-lg border-primary/20 bg-background-light dark:bg-background-dark focus:ring-primary focus:border-primary px-4 py-3"
                    >
                      <option value="">Yeni ünvan daxil et</option>
                      {savedAddresses.map((addr) => (
                        <option key={addr.id} value={addr.id}>
                          {addr.fullAddressLine}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {addressLoading && (
                  <p className="md:col-span-2 text-xs font-semibold text-floral-muted">Yaddaşdakı ünvanlar yüklənir...</p>
                )}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1.5">Küçə, Bina, Mənzil</label>
                  <input
                    value={selectedAddressId ? savedAddresses.find((x) => x.id === selectedAddressId)?.fullAddressLine || '' : address}
                    onChange={(e) => setAddress(e.target.value)}
                    disabled={Boolean(selectedAddressId)}
                    className="w-full rounded-lg border-primary/20 bg-background-light dark:bg-background-dark focus:ring-primary focus:border-primary px-4 py-3 disabled:opacity-60"
                    placeholder="Məs: Nizami küç. 45, m. 12"
                    type="text"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Əlaqə nömrəsi</label>
                  <input
                    value={selectedAddressId ? savedAddresses.find((x) => x.id === selectedAddressId)?.phoneNumber || phone : phone}
                    onChange={(e) => setPhone(formatAzPhone(e.target.value))}
                    onFocus={() => {
                      if (!phone.trim()) setPhone('+994');
                    }}
                    disabled={Boolean(selectedAddressId)}
                    className="w-full rounded-lg border-primary/20 bg-background-light dark:bg-background-dark focus:ring-primary focus:border-primary px-4 py-3 disabled:opacity-60"
                    placeholder="+994 50 000 00 00"
                    type="tel"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">Xəritədən ünvan seçin</label>
                  <div className="mb-3 flex gap-2">
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
                      placeholder="Ünvan yazın (məs: Nizami küçəsi 90, Bakı)"
                      className="flex-1 rounded-lg border-primary/20 bg-background-light dark:bg-background-dark focus:ring-primary focus:border-primary px-4 py-3"
                    />
                    <button
                      type="button"
                      onClick={handleMapSearch}
                      disabled={mapSearching}
                      className="px-4 py-3 rounded-lg bg-primary text-background-dark text-xs font-black uppercase tracking-wider disabled:opacity-70"
                    >
                      {mapSearching ? 'Axtarılır...' : 'Axtar'}
                    </button>
                  </div>
                  <div className="mb-3 flex items-center justify-between rounded-xl border border-primary/20 bg-white/70 dark:bg-white/5 p-1">
                    <span className="px-2 text-[11px] font-bold text-floral-muted">Xəritə görünüşü</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setMapStyle('street')}
                        className={`rounded-lg px-3 py-1.5 text-[11px] font-black transition ${
                          mapStyle === 'street'
                            ? 'bg-primary text-background-dark shadow'
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
                            ? 'bg-primary text-background-dark shadow'
                            : 'bg-transparent text-floral-muted hover:bg-black/5 dark:hover:bg-white/10'
                        }`}
                      >
                        Peyk
                      </button>
                    </div>
                  </div>
                  <div className="h-64 rounded-xl overflow-hidden border border-primary/20">
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
                          if (!selectedAddressId) {
                            fillAddressFromCoordinates(nextLat, nextLng);
                          }
                        }}
                      />
                      <FlyToLocation lat={latitude} lng={longitude} />
                    </MapContainer>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs font-semibold text-floral-muted">
                    <span>Lat: {typeof latitude === 'number' ? latitude.toFixed(6) : '—'}</span>
                    <span>Lng: {typeof longitude === 'number' ? longitude.toFixed(6) : '—'}</span>
                    <span>
                      Mağaza: {storeLocation.name} ({storeLocation.latitude.toFixed(6)}, {storeLocation.longitude.toFixed(6)})
                    </span>
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
                            if (!selectedAddressId) {
                              fillAddressFromCoordinates(nextLat, nextLng);
                            }
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
                  {addressNotice && <p className="text-xs font-semibold text-floral-muted mt-2">{addressNotice}</p>}
                </div>
              </div>
            </section>

            <section className="bg-white dark:bg-slate-900/50 p-8 rounded-2xl border border-primary/10 shadow-sm">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-10 h-10 bg-primary/20 text-primary rounded-full flex items-center justify-center font-bold">2</div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Leaf className="w-5 h-5 text-primary" />
                  Bitkilərin sayı və növü
                </h2>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-3">Qulluq olunacaq bitki sayı</label>
                  <div className="flex gap-4">
                    {plantCountOptions.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setPlantCount(option.key)}
                        className={`px-6 py-2 border rounded-lg transition-colors ${
                          plantCount === option.key
                            ? 'border-primary bg-primary/10 text-primary font-bold'
                            : 'border-primary/20 hover:border-primary'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-white dark:bg-slate-900/50 p-8 rounded-2xl border border-primary/10 shadow-sm">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-10 h-10 bg-primary/20 text-primary rounded-full flex items-center justify-center font-bold">3</div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-primary" />
                  Ziyarət vaxtı
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Gün seçin</label>
                  <input
                    value={visitDate}
                    min={todayLocalDateInput()}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v && v < todayLocalDateInput()) return;
                      setVisitDate(v);
                    }}
                    className="w-full rounded-lg border-primary/20 bg-background-light dark:bg-background-dark focus:ring-primary focus:border-primary px-4 py-3"
                    type="date"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Saat aralığı</label>
                  <div className="grid grid-cols-2 gap-2">
                    {timeSlots.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSlot(s)}
                        className={`py-2 border rounded-lg text-sm transition-colors ${
                          slot === s ? 'border-primary bg-primary/10 text-primary font-bold' : 'border-primary/20 hover:border-primary'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-white dark:bg-slate-900/50 p-8 rounded-2xl border border-primary/10 shadow-sm">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-10 h-10 bg-primary/20 text-primary rounded-full flex items-center justify-center font-bold">4</div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Xidmət seçimi və xüsusi qeydlər
                </h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Tələb olunan xidmət növü</label>
                  <select
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value)}
                    className="w-full rounded-lg border-primary/20 bg-background-light dark:bg-background-dark focus:ring-primary focus:border-primary px-4 py-3"
                  >
                    <option value="Budama və ümumi baxım">Budama və ümumi baxım</option>
                    <option value="Torpaq dəyişdirilməsi və gübrələmə">Torpaq dəyişdirilməsi və gübrələmə</option>
                    <option value="Dizayn və Landşaft">Dizayn və Landşaft</option>
                    <option value="Zərərvericilərlə mübarizə">Zərərvericilərlə mübarizə</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Bağban üçün əlavə qeydlər</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-lg border-primary/20 bg-background-light dark:bg-background-dark focus:ring-primary focus:border-primary px-4 py-3" placeholder="Bitkilərin vəziyyəti və ya xüsusi istəkləriniz haqqında qeyd edin..." rows={4} />
                </div>
              </div>
            </section>

            <div className="pt-4">
              <button disabled={submitting} type="submit" className="w-full md:w-auto bg-primary text-background-dark font-black px-12 py-4 rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform flex items-center justify-center gap-3 disabled:opacity-70">
                <ClipboardCheck className="w-5 h-5" />
                {submitting ? 'Rezervasiya göndərilir...' : 'Rezervasiyanı təsdiqlə'}
              </button>
              {submitError && <p className="mt-3 text-sm font-semibold text-red-500">{submitError}</p>}
              {submitMessage && <p className="mt-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400">{submitMessage}</p>}
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-xl border border-primary/10 sticky top-24">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <ReceiptText className="w-5 h-5 text-primary" />
                Xidmət Xülasəsi
              </h3>
              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Baza ziyarət haqqı</span>
                  <span className="font-bold">
                    {typeof serverPricing?.baseVisitFee === 'number' ? `${serverPricing.baseVisitFee.toFixed(2)} ₼` : '20.00 ₼'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Bitki sayına görə ({plantCount} ədəd)</span>
                  <span className="font-bold">
                    {typeof serverPricing?.plantCountFee === 'number'
                      ? `+ ${serverPricing.plantCountFee.toFixed(2)} ₼`
                      : `+ ${selectedPlantCountFee.toFixed(2)} ₼`}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Məsafə (xəritədən seçdikdən sonra göstəriləcək)</span>
                  <span className="font-bold whitespace-nowrap">{typeof distanceKm === 'number' ? `${distanceKm.toFixed(2)} km` : '—'}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Nəqliyyat (ilk 4 km pulsuz, sonra 0.80 ₼/km)</span>
                  <span className="font-bold">
                    <span className="whitespace-nowrap">
                      {typeof previewTransportFee === 'number' ? `${previewTransportFee.toFixed(2)} ₼` : '—'}
                    </span>
                  </span>
                </div>
                <div className="border-t border-primary/10 pt-4 flex justify-between items-center">
                  <span className="text-lg font-bold">Ümumi məbləğ</span>
                  <span className="text-2xl font-black text-primary whitespace-nowrap">
                    {typeof serverPricing?.totalFee === 'number' ? `${serverPricing.totalFee.toFixed(2)} ₼` : `${previewTotalFee.toFixed(2)} ₼`}
                  </span>
                </div>
              </div>
              {serverPricing ? (
                <div className="space-y-4 mb-8">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Backend nəqliyyat haqqı</span>
                    <span className="font-bold">
                      {typeof serverPricing.transportFee === 'number' ? `${serverPricing.transportFee.toFixed(2)} ₼` : '—'}
                    </span>
                  </div>
                </div>
              ) : null}
              <div className="mb-8 rounded-xl border border-amber-400/30 bg-amber-100/20 dark:bg-amber-900/15 p-4">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 leading-relaxed">
                  Qeyd: Ünvanda istifadə olunan dərmanlara uyğun olaraq əlavə ödəniş ola bilər. Nəzərə almağınızı xahiş edirik.
                </p>
              </div>
              <div className="bg-primary/5 rounded-xl p-4 mb-8">
                <div className="flex gap-3">
                  <Info className="w-4 h-4 text-primary mt-0.5" />
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Ödəniş xidmət başa çatdıqdan sonra nağd və ya kart vasitəsilə qəbul edilir. Ziyarət 24 saat əvvəldən ləğv edilə bilər.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 border border-primary/10 rounded-xl bg-background-light dark:bg-background-dark">
                <div className="size-12 rounded-full overflow-hidden shrink-0 border-2 border-primary">
                  <img
                    alt="Leyla xanım"
                    className="w-full h-full object-cover"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuCm18a949uPB48Gn-ucR5xAoBcl2LrchCQ3j5M0Cp-3i7H5xMQSv8pZEi1NGUoSYJ7C-IhCdXiThQ_KUfs15wWwS5aokbhml0I7qBG96Vz85upR6US3_oh8lT-mj2VtwayC6oCAV4b15r1qeN4T15dMPMglkYp4w5uui_pFAcqB_QolUS3VZSSAaJzNwJs6fE0t9f4RzYQUKkySXoyT4PCM9IG3ZfN4BBSFsx9ZEuhS_JhsYDiwBU7ZKExk93z55p1TE9uBS-gpUp_R"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div>
                  <p className="text-sm font-bold leading-none">Leyla xanım</p>
                  <p className="text-[10px] text-primary mt-1 uppercase tracking-wider font-bold">Sizin Bağbanınız</p>
                </div>
              </div>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}

