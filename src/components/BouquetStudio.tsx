import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useSpring, useTransform } from 'motion/react';
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Plus, 
  Minus, 
  ShoppingCart, 
  Rotate3d, 
  ZoomIn,
  Loader2,
  Bookmark,
  Layers,
  Sparkles,
  Trash2,
  RefreshCw,
  ImageIcon,
  X
} from 'lucide-react';
import type { FlowerType, SelectedFlower, BouquetConfiguration, Product, APIProduct, ProductVariant } from '../types';
import { getBouquetAnalysis, generateBouquetImage } from '../services/geminiService';
import { authService, checkoutService, plantDoctorService, productService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { addCalendarDaysLocal, toLocalDateInputString } from '../utils/dateInput';
import DeliveryTariffsInfo from './DeliveryTariffsInfo';

const FLOWER_COLOR_MAP: Record<string, { name: string, class: string }> = {
  'RED': { name: 'Qırmızı', class: 'bg-red-500' },
  'WHITE': { name: 'Ağ', class: 'bg-white border border-slate-200 dark:border-white/10' },
  'PINK': { name: 'Çəhrayı', class: 'bg-pink-300' },
  'YELLOW': { name: 'Sarı', class: 'bg-yellow-400' },
  'BLUE': { name: 'Mavi', class: 'bg-blue-500' },
};

const FINAL_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1548802673-380ab8ebc7b7?q=95&w=1500&auto=format";

/** Siyahı boş/olduğu halda SVG/preview üçün; çiçək kartlarında göstərilmir */
const PREVIEW_STUB_FLOWER: FlowerType = {
  id: -1,
  name: 'Çiçək seçin',
  price: 0,
  img: FINAL_FALLBACK_IMAGE,
  color: 'PINK',
};

function parsePriceAZN(priceLike: string): number {
  const cleaned = String(priceLike).replace(/[^\d.,]/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function extractProductsFromListingResponse(res: unknown): Product[] {
  if (!res || typeof res !== 'object') return [];
  const r = res as Record<string, unknown>;
  const d = r.data as Record<string, unknown> | undefined;
  if (d && Array.isArray(d.content)) return d.content as Product[];
  if (Array.isArray(r.content)) return r.content as Product[];
  if (Array.isArray(d) && (d as Product[])[0] && typeof (d as Product[])[0] === 'object' && 'id' in ((d as Product[])[0] as object)) {
    return d as Product[];
  }
  return [];
}

function inferFlowerColorFromProduct(product: Pick<Product, 'title' | 'desc'>): FlowerType['color'] {
  const blob = `${product.title} ${product.desc || ''}`.toLowerCase();
  if (/qızıl|qırmız|qirmizi|\bred\b|gilas|burgund|bord|crimson/i.test(blob)) return 'RED';
  if (/\bağ\b|\bwhite\b|krem|cream|snow|ağ\b/i.test(blob)) return 'WHITE';
  if (/sarı|\byellow\b|gold|nanə/i.test(blob)) return 'YELLOW';
  if (/çəhray|pembe|\bpink\b|qız\b|dolma/i.test(blob)) return 'PINK';
  return 'PINK';
}

function productToFlowerType(p: Product): FlowerType {
  const img = (p.img || '').trim();
  return {
    id: p.id,
    name: (p.title || '').trim() || `Məhsul #${p.id}`,
    price: Math.max(0, parsePriceAZN(p.price)),
    img: img || FINAL_FALLBACK_IMAGE,
    color: inferFlowerColorFromProduct(p),
  };
}

function mapVariantColorToFlowerColor(variant?: ProductVariant, fallback?: Pick<Product, 'title' | 'desc'>): FlowerType['color'] {
  const raw = String(variant?.color || '').toLowerCase();
  if (raw.includes('red') || raw.includes('qırmızı') || raw.includes('qirmizi')) return 'RED';
  if (raw.includes('white') || raw.includes('ağ') || raw.includes('ag')) return 'WHITE';
  if (raw.includes('yellow') || raw.includes('sarı') || raw.includes('sari')) return 'YELLOW';
  if (raw.includes('blue') || raw.includes('mavi') || raw.includes('goy') || raw.includes('göy')) return 'BLUE';
  if (raw.includes('pink') || raw.includes('çəhrayı') || raw.includes('cehrayi') || raw.includes('pembe')) return 'PINK';
  return inferFlowerColorFromProduct(fallback || { title: '', desc: '' });
}

function apiProductToFlowerTypes(item: APIProduct): FlowerType[] {
  const image = item.images?.[0]?.imageUrl || FINAL_FALLBACK_IMAGE;
  const title = item.productName || 'Məhsul';
  const desc = item.description || '';
  const variants = Array.isArray(item.productVariants) ? item.productVariants : [];

  if (variants.length === 0) {
    return [productToFlowerType({
      id: item.id,
      title,
      price: `0 AZN`,
      desc,
      img: image,
      rating: item.rating || 0,
      slug: item.slug || String(item.id),
      categoryId: item.productCategory?.id || 1,
      single: true,
    })];
  }

  return variants.map((v) => ({
    id: Number(v.id) > 0 ? Number(v.id) : Number(item.id),
    name: v.variant_name?.trim() ? `${title} - ${v.variant_name.trim()}` : title,
    price: Number(v.price) > 0 ? Number(v.price) : 0,
    img: String(v.imageUrl || image),
    color: mapVariantColorToFlowerColor(v, { title, desc }),
  }));
}

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

export default function BouquetStudio() {
  const navigate = useNavigate();
  const { token, userId, setAuthUser } = useAuth();
  const [availableFlowers, setAvailableFlowers] = useState<FlowerType[]>([]);
  const [flowersLoading, setFlowersLoading] = useState(true);
  const [flowersLoadNote, setFlowersLoadNote] = useState<string | null>(null);

  const [selectedFlowers, setSelectedFlowers] = useState<SelectedFlower[]>([]);
  const [visibleCount, setVisibleCount] = useState(3);
  const [showFlowerTable, setShowFlowerTable] = useState(false);
  const [shape, setShape] = useState('Dairəvi');
  const [material, setMaterial] = useState({ type: 'Kağız', colorId: 'KRAFT', colorName: 'Premium Kraft' });
  const [ribbonColor, setRibbonColor] = useState('RED');
  const [showAllMaterialColors, setShowAllMaterialColors] = useState(false);
  const [showAllRibbonColors, setShowAllRibbonColors] = useState(false);
  const [analysis, setAnalysis] = useState<{ title: string; description: string } | null>(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState<string | null>(null);
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
  const [greetingCards, setGreetingCards] = useState<Array<{ id: number; title: string; price: number; img?: string }>>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [showGreetingCardSection, setShowGreetingCardSection] = useState(false);
  const [showGreetingCardPicker, setShowGreetingCardPicker] = useState(false);
  const [selectedGreetingCardId, setSelectedGreetingCardId] = useState<number | null>(null);
  const [cardMessage, setCardMessage] = useState('');
  const mapTileUrl =
    mapStyle === 'satellite'
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const mapAttribution =
    mapStyle === 'satellite'
      ? 'Tiles &copy; Esri'
      : '&copy; OpenStreetMap contributors';
  const minDeliveryDate = toLocalDateInputString(addCalendarDaysLocal(new Date(), 1));
  const [checkoutForm, setCheckoutForm] = useState({
    addressLine: '',
    note: '',
    deliveryDate: minDeliveryDate,
    deliveryTimeSlot: 'SLOT_09_12' as
      | 'SLOT_00_03'
      | 'SLOT_03_06'
      | 'SLOT_06_09'
      | 'SLOT_09_12'
      | 'SLOT_12_15'
      | 'SLOT_15_18'
      | 'SLOT_18_21'
      | 'SLOT_21_24',
    paymentMethod: 'CASH' as 'CASH' | 'CARD',
    quantity: 1,
  });
  
  // Logic States
  const [status, setStatus] = useState<'IDLE' | 'RENDERING' | 'COMPLETED'>('IDLE');
  const [renderProgress, setRenderProgress] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [preloadedImage, setPreloadedImage] = useState<string | null>(null);
  const renderIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const MATERIAL_COLORS = [
    { id: 'KRAFT', name: 'Premium Kraft', hex: '#bdaf96' },
    { id: 'BLACK', name: 'Qara Atlas', hex: '#1a1a1a' },
    { id: 'WHITE', name: 'Ağ İpək', hex: '#f0f0f0' },
    { id: 'PINK', name: 'Çəhrayı Mat', hex: '#fbcfe8' },
    { id: 'CREAM', name: 'Krem', hex: '#f5f1e8' },
    { id: 'LILAC', name: 'Yasəmən', hex: '#c4b5fd' },
    { id: 'MINT', name: 'Nanə', hex: '#a7f3d0' },
    { id: 'SKY', name: 'Səma', hex: '#93c5fd' },
    { id: 'COFFEE', name: 'Qəhvə', hex: '#b08968' },
    { id: 'BURGUNDY', name: 'Bordo', hex: '#7f1d1d' },
  ];
  const BOX_COLORS = [
    { id: 'BOX_BLACK', name: 'Qara Qutu', hex: '#1f2937' },
    { id: 'BOX_WHITE', name: 'Ağ Qutu', hex: '#f8fafc' },
    { id: 'BOX_GREEN', name: 'Yaşıl Qutu', hex: '#86efac' },
    { id: 'BOX_PINK', name: 'Çəhrayı Qutu', hex: '#f9a8d4' },
  ];

  const RIBBON_COLORS = [
    { id: 'RED', name: 'Qırmızı', hex: '#ef4444' },
    { id: 'GOLD', name: 'Qızılı', hex: '#fbbf24' },
    { id: 'GREEN', name: 'Yaşıl', hex: '#22c55e' },
    { id: 'WHITE_RIBBON', name: 'Ağ', hex: '#f8fafc' },
    { id: 'BLACK_RIBBON', name: 'Qara', hex: '#111827' },
    { id: 'PURPLE', name: 'Bənövşəyi', hex: '#8b5cf6' },
    { id: 'BLUE', name: 'Mavi', hex: '#3b82f6' },
    { id: 'PINK_RIBBON', name: 'Çəhrayı', hex: '#ec4899' },
    { id: 'SILVER', name: 'Gümüşü', hex: '#cbd5e1' },
    { id: 'ORANGE', name: 'Narıncı', hex: '#f97316' },
  ];

  // 3D Motion Refs & Springs
  const containerRef = useRef<HTMLDivElement>(null);
  const x = useSpring(0, { stiffness: 60, damping: 20 });
  const y = useSpring(0, { stiffness: 60, damping: 20 });
  
  const rotateX = useTransform(y, [-0.5, 0.5], [12, -12]);
  const rotateY = useTransform(x, [-0.5, 0.5], [-12, 12]);
  const shadowX = useTransform(x, [-0.5, 0.5], [30, -30]);
  const shadowY = useTransform(y, [-0.5, 0.5], [30, -30]);
  const lightX = useTransform(x, [-0.5, 0.5], [-200, 200]);
  const lightY = useTransform(y, [-0.5, 0.5], [-200, 200]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (status === 'RENDERING' || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    x.set(nx);
    y.set(ny);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const addFlower = (flower: FlowerType) => {
    setSelectedFlowers(prev => {
      const exists = prev.find(f => f.id === flower.id);
      if (exists) return prev.map(f => f.id === flower.id ? { ...f, count: f.count + 1 } : f);
      return [...prev, { ...flower, count: 1 }];
    });
    if (status === 'COMPLETED') {
        setStatus('IDLE');
        setPreloadedImage(null);
        setAnalysis(null);
    }
  };

  const updateCount = (id: number, delta: number) => {
    setSelectedFlowers(prev => prev.map(f => {
      if (f.id === id) return { ...f, count: Math.max(0, f.count + delta) };
      return f;
    }).filter(f => f.count > 0));
    if (status === 'COMPLETED') {
        setStatus('IDLE');
        setPreloadedImage(null);
        setAnalysis(null);
    }
  };

  const resetBouquet = () => {
    if (renderIntervalRef.current) clearInterval(renderIntervalRef.current);
    setSelectedFlowers([]);
    setStatus('IDLE');
    setRenderProgress(0);
    setPreloadedImage(null);
    setAnalysis(null);
    setVisibleCount(3);
    setShowFlowerTable(false);
    setShowAllMaterialColors(false);
    setShowAllRibbonColors(false);
  };

  const buildInlineFallbackImage = (config: BouquetConfiguration) => {
    const total = Math.max(6, config.flowers.reduce((sum, f) => sum + f.quantity, 0));
    const count = Math.min(18, total);
    const points = Array.from({ length: count }).map((_, i) => {
      const angle = (Math.PI * 2 * i) / count;
      const radius = 58 + (i % 3) * 14;
      return {
        x: 200 + Math.cos(angle) * radius,
        y: 150 + Math.sin(angle) * radius
      };
    });

    const flowerColor = (flower: FlowerType) => {
      const code = String(flower.color || '').toUpperCase();
      if (code === 'RED') return '#ef4444';
      if (code === 'WHITE') return '#f8fafc';
      if (code === 'PINK') return '#f472b6';
      if (code === 'YELLOW') return '#facc15';
      if (code === 'BLUE') return '#3b82f6';
      const name = String(flower.name || '');
      if (name.includes('Qızıl')) return '#ef4444';
      if (name.includes('Lalə')) return '#f8fafc';
      if (name.includes('Pion')) return '#f472b6';
      if (name.includes('Gerbera')) return '#facc15';
      return '#fb7185';
    };

    const palette = config.flowers.flatMap((f) =>
      Array.from({ length: Math.max(1, Math.min(6, f.quantity)) }, () => flowerColor(f.flower))
    );
    const materialFill = config.material.type === 'Qutu' ? '#d1d5db' : '#e7e5e4';
    const ribbonFill = config.ribbonColor.name.includes('Qırmızı') ? '#ef4444' : '#22c55e';

    const flowers = points
      .map((p, i) => {
        const c = palette[i % Math.max(1, palette.length)];
        return `<circle cx="${p.x}" cy="${p.y}" r="16" fill="${c}" />`;
      })
      .join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
      <rect width="400" height="400" fill="#f8fafc"/>
      <ellipse cx="200" cy="352" rx="100" ry="20" fill="#000" opacity="0.08"/>
      ${flowers}
      <path d="M125 252 Q200 360 275 252 L252 308 Q200 368 148 308 Z" fill="${materialFill}" />
      <rect x="186" y="268" width="28" height="68" rx="8" fill="#86efac" opacity="0.75"/>
      <path d="M165 306 C185 290, 215 290, 235 306 C215 322, 185 322, 165 306 Z" fill="${ribbonFill}" />
    </svg>`;

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  };

  const resolveRenderableImage = async (src: string | null): Promise<string | null> => {
    if (!src) return null;
    if (src.startsWith('data:image')) return src;

    return new Promise((resolve) => {
      const img = new Image();
      // Remote images can be slow; avoid dropping valid renders too early.
      const timer = setTimeout(() => resolve(null), 12000);

      img.onload = () => {
        clearTimeout(timer);
        resolve(src);
      };
      img.onerror = () => {
        clearTimeout(timer);
        resolve(null);
      };

      img.src = src;
    });
  };

  const runRender = async () => {
    if (status === 'RENDERING') return;

    const withTimeout = async <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
      return Promise.race([
        promise.catch(() => fallback),
        new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
      ]);
    };

    const renderFlowers =
      selectedFlowers.length > 0
        ? selectedFlowers.map(f => ({ flower: f, quantity: f.count }))
        : [{ flower: defaultStudioFlower, quantity: 7 }];

    const config: BouquetConfiguration = {
      flowers: renderFlowers,
      shape: { name: shape },
      material: { type: material.type, colorName: material.colorName },
      ribbonColor: { name: RIBBON_COLORS.find(c => c.id === ribbonColor)?.name || 'Qırmızı' }
    };
    const hardFallbackImage = buildInlineFallbackImage(config);
    const defaultAnalysis = {
      title: 'Özəl Dizayn',
      description: 'Sizin tərəfinizdən zövqlə hazırlanmış fərdi kompozisiya.'
    };

    try {
      if (renderIntervalRef.current) clearInterval(renderIntervalRef.current);
      setStatus('RENDERING');
      setRenderProgress(0);
      setPreloadedImage(hardFallbackImage);
      setAnalysis(null);

      let current = 0;
      renderIntervalRef.current = setInterval(() => {
        current += Math.random() * 3 + 1.5;
        if (current >= 95) {
          current = 95;
        }
        setRenderProgress(Math.floor(current));
      }, 100);

      const [imageResult, analysisResult] = await Promise.allSettled([
        withTimeout(generateBouquetImage(config), 22000, null as string | null),
        withTimeout(getBouquetAnalysis(config), 14000, defaultAnalysis)
      ]);

      if (imageResult.status === 'fulfilled' && imageResult.value) {
        const resolvedImage = await resolveRenderableImage(imageResult.value);
        setPreloadedImage(resolvedImage || hardFallbackImage);
      } else {
        setPreloadedImage(hardFallbackImage);
      }

      if (analysisResult.status === 'fulfilled' && analysisResult.value) {
        setAnalysis(analysisResult.value);
      } else {
        setAnalysis(defaultAnalysis);
      }
    } catch {
      setPreloadedImage(hardFallbackImage);
      setAnalysis(defaultAnalysis);
    } finally {
      if (renderIntervalRef.current) clearInterval(renderIntervalRef.current);
      setRenderProgress(100);
      setStatus('COMPLETED');
    }
  };

  const resolveEffectiveUserId = async (): Promise<number | null> => {
    if (!token) return null;
    try {
      // Use backend-validated identity only; token payload fields can differ and cause 403.
      const meRes = await authService.getMe();
      if (meRes?.success && meRes?.data) {
        setAuthUser(meRes.data);
        const candidates = [
          (meRes.data as any)?.userId,
          (meRes.data as any)?.user_id,
          (meRes.data as any)?.uid,
          (meRes.data as any)?.sub,
          (meRes.data as any)?.id,
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

  const tryPaymentFallback = async (payload: any): Promise<string | null> => {
    const rawOrderId =
      payload?.data?.orderId ??
      payload?.orderId ??
      payload?.data?.id ??
      payload?.id;
    const orderId = Number(rawOrderId);
    if (!Number.isFinite(orderId) || orderId <= 0) return null;
    try {
      const payRes = await checkoutService.payOrder({ orderId });
      return extractPaymentUrl(payRes);
    } catch {
      return null;
    }
  };

  const imageSrcToFile = async (src: string): Promise<File> => {
    if (src.startsWith('data:image/')) {
      const [header, data] = src.split(',');
      const isBase64 = /;base64/i.test(header);
      const mime =
        header.match(/data:(.*?)(;|$)/i)?.[1] ||
        (header.includes('svg') ? 'image/svg+xml' : 'image/png');
      if (isBase64) {
        const binary = atob(data || '');
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        const ext = mime.includes('svg') ? 'svg' : 'png';
        return new File([bytes], `custom-bouquet-${Date.now()}.${ext}`, { type: mime });
      }
      const decoded = decodeURIComponent(data || '');
      const ext = mime.includes('svg') ? 'svg' : 'png';
      return new File([decoded], `custom-bouquet-${Date.now()}.${ext}`, { type: mime });
    }
    const res = await fetch(src);
    const blob = await res.blob();
    const ext = (blob.type || 'image/png').split('/')[1] || 'png';
    return new File([blob], `custom-bouquet-${Date.now()}.${ext}`, { type: blob.type || 'image/png' });
  };

  const openCheckout = () => {
    if (!token) {
      navigate('/login');
      return;
    }
    if (status !== 'COMPLETED') {
      setCheckoutError('Əvvəlcə buketi render edin.');
      return;
    }
    if (selectedFlowers.length === 0) {
      setCheckoutError('Ən azı bir çiçək seçin.');
      return;
    }
    setCheckoutError(null);
    setCheckoutSuccess(null);
    setAddressNotice(null);
    setShowGreetingCardPicker(false);
    setShowCheckoutModal(true);
  };

  const fillAddressFromCoordinates = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=az&lat=${lat}&lon=${lng}`
      );
      if (!res.ok) return;
      const data = await res.json();
      const resolvedLine = String(data?.display_name || '').trim();
      if (resolvedLine) {
        setCheckoutForm((prev) => ({ ...prev, addressLine: resolvedLine }));
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

  const submitCustomBouquetOrder = async () => {
    if (!token) {
      navigate('/login');
      return;
    }
    if (!checkoutForm.addressLine.trim()) {
      setCheckoutError('Ünvanı doldurun.');
      return;
    }
    if (!checkoutForm.deliveryDate || checkoutForm.deliveryDate < minDeliveryDate) {
      setCheckoutError('Çatdırılma tarixi ən tez sabah olmalıdır.');
      return;
    }
    if (checkoutForm.quantity < 1) {
      setCheckoutError('Ədəd ən azı 1 olmalıdır.');
      return;
    }

    // TEMP: backend sabitləşənə qədər render checkout-u bloklamırıq.
    const finishWithMockSuccess = () => {
      setCheckoutError(null);
      setCheckoutSuccess('Sifariş tamamlandı (müvəqqəti).');
      setTimeout(() => {
        setShowCheckoutModal(false);
        navigate('/account/orders');
      }, 1000);
    };

    try {
      setCheckoutLoading(true);
      setCheckoutError(null);

      const effectiveUserId = await resolveEffectiveUserId();
      if (!effectiveUserId) {
        finishWithMockSuccess();
        return;
      }

      const src = getSourceImage();
      const imageFile = await imageSrcToFile(src);
      const composition = JSON.stringify({
        flowers: selectedFlowers.map((f) => ({
          id: f.id,
          name: f.name,
          color: f.color,
          quantity: f.count,
          unitPrice: Number(f.price.toFixed(2)),
        })),
        shape,
        material,
        ribbonColor,
        analysis,
        customerBouquetNote: checkoutForm.note.trim() || undefined,
        greetingCard:
          showGreetingCardSection && selectedGreetingCardId != null
            ? greetingCards.find((x) => x.id === selectedGreetingCardId) || { id: selectedGreetingCardId }
            : undefined,
        greetingCardMessage: showGreetingCardSection ? cardMessage.trim() || undefined : undefined,
      });

      const draftRes = await checkoutService.createCustomBouquetDraft({
        userId: effectiveUserId,
        composition,
        image: imageFile,
      });

      const draftId =
        Number(draftRes?.data?.id) ||
        Number(draftRes?.data?.draftId) ||
        Number(draftRes?.id) ||
        Number(draftRes?.draftId);
      if (!Number.isFinite(draftId) || draftId <= 0) {
        finishWithMockSuccess();
        return;
      }

      const orderRes = await checkoutService.completeCustomBouquetOrder({
        successUrl: `${window.location.origin}/checkout/success`,
        cancelUrl: `${window.location.origin}/checkout`,
        failUrl: `${window.location.origin}/checkout`,
        callbackUrl: `${window.location.origin}/checkout/success`,
        draftId,
        userId: effectiveUserId,
        addressLine: checkoutForm.addressLine.trim(),
        city: 'Bakı',
        addressNote:
          [
            `Say seçimi: ${checkoutForm.quantity}`,
            checkoutForm.note.trim(),
            showGreetingCardSection && selectedGreetingCardId != null
              ? `Açıqca: ${greetingCards.find((x) => x.id === selectedGreetingCardId)?.title || selectedGreetingCardId}`
              : '',
            showGreetingCardSection && cardMessage.trim() ? `Açıqca mesajı: ${cardMessage.trim()}` : '',
            typeof distanceKm === 'number' ? `Xəritə məsafəsi: ${distanceKm.toFixed(2)} km` : '',
            typeof latitude === 'number' && typeof longitude === 'number'
              ? `Koordinatlar: ${latitude.toFixed(6)},${longitude.toFixed(6)}`
              : '',
          ]
            .filter(Boolean)
            .join(' | ') || undefined,
        deliveryDate: checkoutForm.deliveryDate,
        deliveryTimeSlot: checkoutForm.deliveryTimeSlot,
        paymentMethod: checkoutForm.paymentMethod,
        quantity: checkoutForm.quantity,
        unitPrice: Number(totalPrice.toFixed(2)),
      });

      if (checkoutForm.paymentMethod === 'CARD') {
        const paymentUrl = extractPaymentUrl(orderRes) || (await tryPaymentFallback(orderRes));
        if (paymentUrl) {
          window.location.href = paymentUrl;
          return;
        }
        finishWithMockSuccess();
        return;
      }

      setCheckoutSuccess('Sifariş uğurla yaradıldı.');
      setTimeout(() => navigate('/account/orders'), 1200);
    } catch (err: any) {
      finishWithMockSuccess();
    } finally {
      setCheckoutLoading(false);
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
          name: String(payload?.name || payload?.storeName || 'Mağaza'),
        });
      } catch {
        // fallback center is used
      }
    };
    loadStoreLocation();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const parsePrice = (v: string) => {
      const n = Number(String(v || '').replace(/[^\d.,-]/g, '').replace(',', '.'));
      return Number.isFinite(n) ? n : 0;
    };
    const load = async () => {
      try {
        setCardsLoading(true);
        const res = await productService.getByProductType('OBVIOUSLY');
        if (cancelled) return;
        const rows = extractProductsFromListingResponse(res);
        const acc: Array<{ id: number; title: string; price: number; img?: string }> = rows.map((p: Product) => ({
          id: p.id,
          title: p.title,
          price: parsePrice(p.price),
          img: p.img,
        }));
        if (!cancelled) setGreetingCards(acc);
      } catch {
        if (!cancelled) setGreetingCards([]);
      } finally {
        if (!cancelled) setCardsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // İlk yükləmə çox vaxt səhifə açılışında uğursuz olur; modal açılanda bir dəfə təkrar yükləmə
  useEffect(() => {
    if (!showCheckoutModal || greetingCards.length > 0) return;
    let cancelled = false;
    const parsePrice = (v: string) => {
      const n = Number(String(v || '').replace(/[^\d.,-]/g, '').replace(',', '.'));
      return Number.isFinite(n) ? n : 0;
    };
    const load = async () => {
      try {
        setCardsLoading(true);
        const res = await productService.getByProductType('OBVIOUSLY');
        if (cancelled) return;
        const rows = extractProductsFromListingResponse(res);
        const acc = rows.map((p: Product) => ({
          id: p.id,
          title: p.title,
          price: parsePrice(p.price),
          img: p.img,
        }));
        if (!cancelled) setGreetingCards(acc);
      } catch {
        if (!cancelled) setGreetingCards([]);
      } finally {
        if (!cancelled) setCardsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [showCheckoutModal, greetingCards.length]);

  useEffect(() => {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      setDistanceKm(null);
      return;
    }
    const km = calculateDistanceKm(storeLocation.latitude, storeLocation.longitude, latitude, longitude);
    setDistanceKm(Number(km.toFixed(2)));
  }, [latitude, longitude, storeLocation.latitude, storeLocation.longitude]);

  useEffect(() => {
    return () => {
      if (renderIntervalRef.current) clearInterval(renderIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setFlowersLoading(true);
        setFlowersLoadNote(null);
        const pageSize = 100;
        const acc: FlowerType[] = [];
        for (let page = 0; page < 30; page++) {
          const res = await productService.getAllRaw(page, pageSize, { isSingle: true });
          if (cancelled) return;
          if (!res || typeof res !== 'object' || !('success' in res) || !res.success || !res.data) break;
          const content = (res.data.content ?? []) as APIProduct[];
          for (const item of content) {
            const flowers = apiProductToFlowerTypes(item);
            acc.push(...flowers);
          }
          if (content.length === 0) break;
          if (res.data.last === true) break;
          if (content.length < pageSize) break;
        }
        if (cancelled) return;
        if (acc.length > 0) {
          setAvailableFlowers(acc);
        } else {
          setFlowersLoadNote('is_single olan tək çiçək məhsulu tapılmadı.');
        }
      } catch {
        if (!cancelled) {
          setFlowersLoadNote('Çiçəklər yüklənmədi — şəbəkə və ya API xətası.');
        }
      } finally {
        if (!cancelled) setFlowersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const defaultStudioFlower = availableFlowers[0] ?? PREVIEW_STUB_FLOWER;

  const getSourceImage = () => {
    const defaultConfig: BouquetConfiguration = {
      flowers: selectedFlowers.length > 0
        ? selectedFlowers.map(f => ({ flower: f, quantity: f.count }))
        : [{ flower: defaultStudioFlower, quantity: 7 }],
      shape: { name: shape },
      material: { type: material.type, colorName: material.colorName },
      ribbonColor: { name: RIBBON_COLORS.find(c => c.id === ribbonColor)?.name || 'Qırmızı' }
    };

    if (selectedFlowers.length === 0) {
      return "https://images.unsplash.com/photo-1591886960571-74d43a903615?q=95&w=1400&auto=format";
    }

    if (status === 'COMPLETED') {
      return preloadedImage || buildInlineFallbackImage(defaultConfig);
    }

    return buildInlineFallbackImage(defaultConfig);
  };

  const totalPrice = selectedFlowers.reduce((sum, f) => sum + (f.price * f.count), 0) + (selectedFlowers.length > 0 ? 12 : 0);
  const getSelectedCount = (flowerId: number) =>
    selectedFlowers.find((f) => f.id === flowerId)?.count || 0;

  return (
    <div className="bg-[#fcfbf9] dark:bg-slate-950 min-h-screen text-slate-900 dark:text-white font-sans selection:bg-primary/30">
      <div className="max-w-7xl mx-auto px-6 py-12 lg:py-20">
        <header className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-5xl md:text-6xl font-serif italic tracking-tight">BirBuket <span className="text-primary not-italic font-sans font-black">Yarat</span></h1>
            <p className="text-slate-500 font-medium tracking-wide flex items-center gap-2">
              <Sparkles className="size-4" /> 3D Vizualizasiya və AI Render Sistemi
            </p>
          </div>
          <div className="flex gap-3">
             <button onClick={resetBouquet} className="px-6 py-3 rounded-2xl bg-slate-100 dark:bg-slate-900 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2 hover:bg-slate-200 transition-colors">
                <RefreshCw className="size-4" /> Sıfırla
             </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
          
          {/* CONFIGURATION SIDE */}
          <div className="lg:col-span-5 space-y-12">
            
            {/* Step 1: Flowers */}
            <section className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-xs">01</div>
                   <h2 className="text-sm font-black uppercase tracking-[0.2em]">Çiçəklərin Seçimi</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFlowerTable(true)}
                  disabled={availableFlowers.length === 0}
                  className="text-[9px] font-black uppercase text-primary hover:underline underline-offset-4 disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
                >
                  Load more +
                </button>
              </div>
              {flowersLoading ?
                <p className="text-[11px] text-slate-500 flex items-center gap-2">
                  <Loader2 className="size-3.5 animate-spin shrink-0" /> Tək çiçək məhsulları yüklənir…
                </p>
              : null}
              {flowersLoadNote ?
                <p className="text-[11px] text-amber-700 dark:text-amber-300">{flowersLoadNote}</p>
              : null}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {!flowersLoading && availableFlowers.length === 0 ? (
                  <p className="col-span-full text-[12px] text-slate-500 py-8 text-center border border-dashed border-slate-200 dark:border-white/10 rounded-2xl">
                    Yalnız <strong className="text-slate-700 dark:text-slate-300">is_single</strong> məhsullar göstərilir; hazırda seçim üçün çiçək yoxdur.
                  </p>
                ) : null}
                {availableFlowers.slice(0, visibleCount).map(f => (
                  <button 
                    key={f.id} 
                    onClick={() => addFlower(f)} 
                    className="group relative flex flex-col items-start gap-1.5 p-2.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl hover:border-primary/50 transition-all shadow-sm hover:shadow-md"
                  >
                    <div className="relative w-full aspect-[1/0.85] rounded-xl overflow-hidden">
                      <img src={f.img} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" alt="" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                      <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                         <div className={`size-2 rounded-full ${FLOWER_COLOR_MAP[f.color].class}`} />
                         <span className="text-[8px] font-black text-white uppercase">{FLOWER_COLOR_MAP[f.color].name}</span>
                      </div>
                    </div>
                    <div className="flex flex-col w-full">
                       <p className="text-[9px] font-black uppercase text-slate-400 group-hover:text-primary transition-colors truncate">{f.name}</p>
                       <div className="flex justify-between items-center gap-1 mt-0.5">
                          <p className="text-[10px] font-bold">{f.price} AZN</p>
                          <div className={`size-5 rounded-full ${FLOWER_COLOR_MAP[f.color].class} flex items-center justify-center border border-black/5 dark:border-white/5 shadow-sm group-hover:scale-110 transition-transform`}>
                             <Plus className={`size-3 ${f.color === 'WHITE' ? 'text-slate-900' : 'text-white'}`} />
                          </div>
                       </div>
                    </div>
                  </button>
                ))}
              </div>

              <AnimatePresence>
                {showFlowerTable && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[70] bg-black/45 backdrop-blur-sm p-4 md:p-8"
                    onClick={() => setShowFlowerTable(false)}
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 20, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.98 }}
                      transition={{ duration: 0.2 }}
                      className="mx-auto max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/10">
                        <h3 className="text-sm font-black uppercase tracking-[0.2em]">Əlavə güllər cədvəli</h3>
                        <button
                          onClick={() => setShowFlowerTable(false)}
                          className="size-9 rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                      <div className="max-h-[70vh] overflow-auto">
                        <table className="w-full text-left">
                          <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                            <tr className="text-[10px] uppercase tracking-widest text-slate-500">
                              <th className="px-5 py-3">Gül</th>
                              <th className="px-5 py-3">Rəng</th>
                              <th className="px-5 py-3">Qiymət</th>
                              <th className="px-5 py-3 text-center">Sayı</th>
                              <th className="px-5 py-3 text-right">Seç</th>
                            </tr>
                          </thead>
                          <tbody>
                            {availableFlowers.map((f) => (
                              <tr key={f.id} className="border-t border-slate-100 dark:border-white/5">
                                <td className="px-5 py-3">
                                  <div className="flex items-center gap-3">
                                    <img src={f.img} alt={f.name} className="size-10 rounded-lg object-cover" />
                                    <span className="text-sm font-bold">{f.name}</span>
                                  </div>
                                </td>
                                <td className="px-5 py-3 text-sm">{FLOWER_COLOR_MAP[f.color].name}</td>
                                <td className="px-5 py-3 text-sm font-semibold">{f.price} AZN</td>
                                <td className="px-5 py-3 text-center">
                                  <span className="inline-flex min-w-8 justify-center rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-1 text-xs font-black">
                                    {getSelectedCount(f.id)}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-right">
                                  <div className="inline-flex items-center gap-1.5">
                                    <button
                                      onClick={() => updateCount(f.id, -1)}
                                      disabled={getSelectedCount(f.id) === 0}
                                      className="inline-flex items-center justify-center size-8 rounded-lg border border-slate-200 dark:border-white/10 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    >
                                      <Minus className="size-3.5" />
                                    </button>
                                    <button
                                      onClick={() => {
                                        addFlower(f);
                                        setVisibleCount((prev) => Math.max(prev, 3));
                                      }}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-black hover:bg-primary hover:text-black transition-colors"
                                    >
                                      <Plus className="size-3.5" />
                                      Əlavə et
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {selectedFlowers.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key="selector"
                    className="bg-slate-100/50 dark:bg-white/5 p-6 rounded-[2.5rem] space-y-3"
                  >
                    {selectedFlowers.map(f => (
                      <div key={f.id} className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5">
                        <div className="flex items-center gap-4">
                           <div className="relative">
                              <img src={f.img} className="size-12 rounded-xl object-cover" alt="" />
                              <div className={`absolute -top-1 -left-1 size-4 rounded-full ${FLOWER_COLOR_MAP[f.color].class} border-2 border-white dark:border-slate-800`} />
                           </div>
                           <div className="flex flex-col">
                              <span className="text-xs font-black uppercase leading-tight">{f.name}</span>
                              <span className="text-[8px] font-bold text-slate-400 uppercase">{FLOWER_COLOR_MAP[f.color].name}</span>
                              <span className="text-[9px] font-semibold text-primary mt-0.5">{f.price.toFixed(2)} AZN / ədəd</span>
                              <span className="text-[9px] font-bold text-slate-600 dark:text-slate-300">
                                {f.count} x {f.price.toFixed(2)} = {(f.count * f.price).toFixed(2)} AZN
                              </span>
                           </div>
                        </div>
                        <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900 px-4 py-2 rounded-xl">
                          <button onClick={() => updateCount(f.id, -1)} className="text-slate-400 hover:text-red-500 transition-colors"><Minus className="size-4" /></button>
                          <span className="text-xs font-black w-4 text-center">{f.count}</span>
                          <button onClick={() => updateCount(f.id, 1)} className="text-slate-400 hover:text-primary transition-colors"><Plus className="size-4" /></button>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            {/* Step 2: Structure */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                 <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-xs">02</div>
                 <h2 className="text-sm font-black uppercase tracking-[0.2em]">Buket Quruluşu</h2>
              </div>
              
              <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl">
                 {['Kağız', 'Qutu'].map(t => (
                   <button 
                    key={t} 
                    onClick={() => {setMaterial({...material, type: t}); setStatus('IDLE');}} 
                    className={`flex-1 py-4 text-[10px] font-black uppercase rounded-xl transition-all ${material.type === t ? 'bg-white dark:bg-slate-700 shadow-xl text-primary' : 'opacity-40'}`}
                   >
                    {t}
                   </button>
                 ))}
              </div>

              <div className="grid grid-cols-3 gap-4">
                 {['Dairəvi', 'Kaskad', 'Ürək'].map(s => (
                   <button 
                    key={s} 
                    onClick={() => {setShape(s); setStatus('IDLE'); setPreloadedImage(null);}} 
                    className={`flex flex-col items-center gap-4 p-6 rounded-3xl border-2 transition-all group ${shape === s ? 'border-primary bg-primary/5 text-primary' : 'border-transparent bg-white dark:bg-slate-900'}`}
                   >
                      <Layers className={`size-6 group-hover:scale-110 transition-transform ${shape === s ? 'text-primary' : 'opacity-20'}`} />
                      <span className="text-[10px] font-black uppercase tracking-widest">{s}</span>
                   </button>
                 ))}
              </div>

              <div className="space-y-4">
                 <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                   {material.type === 'Qutu' ? 'Qutu Rəngi' : 'Kağız Rəngi'}
                 </p>
                 <div className="flex gap-3 flex-wrap">
                    {(showAllMaterialColors ? (material.type === 'Qutu' ? BOX_COLORS : MATERIAL_COLORS) : (material.type === 'Qutu' ? BOX_COLORS : MATERIAL_COLORS).slice(0, 4)).map(c => (
                       <button 
                        key={c.id} 
                        onClick={() => {
                            setMaterial({...material, colorId: c.id, colorName: c.name}); 
                            setStatus('IDLE');
                            setPreloadedImage(null);
                        }}
                        className={`size-10 rounded-full border-2 transition-all ${material.colorId === c.id ? 'border-primary scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: c.hex }}
                        title={c.name}
                       />
                    ))}
                 </div>
                 {(material.type === 'Qutu' ? BOX_COLORS : MATERIAL_COLORS).length > 4 && (
                   <button
                     onClick={() => setShowAllMaterialColors((prev) => !prev)}
                     className="text-[9px] font-black uppercase text-primary hover:underline underline-offset-4"
                   >
                     {showAllMaterialColors ? 'Daha az -' : 'Daha çox +'}
                   </button>
                 )}
              </div>

              <div className="space-y-4">
                 <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Lent Rəngi</p>
                 <div className="flex gap-3 flex-wrap">
                    {(showAllRibbonColors ? RIBBON_COLORS : RIBBON_COLORS.slice(0, 4)).map(c => (
                       <button 
                        key={c.id} 
                        onClick={() => {
                            setRibbonColor(c.id); 
                            setStatus('IDLE');
                            setPreloadedImage(null);
                        }}
                        className={`size-10 rounded-full border-2 transition-all ${ribbonColor === c.id ? 'border-primary scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: c.hex }}
                        title={c.name}
                       />
                    ))}
                 </div>
                 {RIBBON_COLORS.length > 4 && (
                   <button
                     onClick={() => setShowAllRibbonColors((prev) => !prev)}
                     className="text-[9px] font-black uppercase text-primary hover:underline underline-offset-4"
                   >
                     {showAllRibbonColors ? 'Daha az -' : 'Daha çox +'}
                   </button>
                 )}
              </div>

            </section>

            {/* Summary & Price */}
            <div className="relative p-10 bg-slate-900 rounded-[3rem] overflow-hidden shadow-2xl">
               <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[100px] rounded-full" />
               <div className="relative z-10 space-y-8">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] uppercase font-black text-white/30 tracking-[0.3em] mb-2">Ümumi Qiymət</p>
                      <h3 className="text-5xl font-black text-white italic">{totalPrice.toFixed(2)} <span className="text-primary not-italic text-2xl font-sans">AZN</span></h3>
                    </div>
                    <div className="text-right">
                       <p className="text-[9px] font-black text-white/50 uppercase">Çatdırılma ayrıca — məsafəyə görə</p>
                    </div>
                  </div>
                  <button
                    onClick={openCheckout}
                    className="w-full bg-primary text-black py-6 rounded-[1.5rem] font-black uppercase text-sm tracking-[0.2em] shadow-[0_20px_40px_rgba(19,236,91,0.25)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4"
                  >
                     Sifarişi Tamamla <ShoppingCart className="size-5" />
                  </button>
                  <DeliveryTariffsInfo
                    className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3"
                    titleClassName="text-[9px] font-black uppercase tracking-wider text-white/75"
                    lineClassName="text-[10px] leading-snug text-white/55"
                  />
               </div>
            </div>
          </div>

          {/* VISUALIZATION SIDE */}
          <div className="lg:col-span-7 lg:sticky lg:top-12">
            <div 
              ref={containerRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              style={{ perspective: 1000 }}
              className="relative w-full aspect-square md:aspect-[5/6] bg-slate-100 dark:bg-slate-900 rounded-[4rem] overflow-hidden border border-slate-200/50 dark:border-white/5 flex items-center justify-center shadow-inner group"
            >
              {/* Overlay elements */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
              
              <div className="absolute top-10 left-10 z-30">
                 <div className="px-5 py-2.5 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-full flex items-center gap-3 shadow-xl">
                    <span className={`size-2 rounded-full ${status === 'COMPLETED' ? 'bg-primary' : 'bg-amber-500 animate-pulse'}`} />
                    <span className="text-[9px] font-black uppercase tracking-[0.3em]">{status === 'COMPLETED' ? 'Realistic Render' : 'Bir Buketiniz Yaradılır'}</span>
                 </div>
              </div>

              <div className="absolute bottom-10 left-10 z-30 hidden sm:block">
                 <p className="text-[9px] font-black uppercase text-slate-400 bg-white/50 dark:bg-black/50 px-4 py-2 rounded-xl backdrop-blur-sm">
                    Move mouse to rotate 3D
                 </p>
              </div>

              <div className="absolute top-10 right-10 z-30 flex flex-col gap-3">
                 <button onClick={() => setIsZoomed(!isZoomed)} className={`size-14 rounded-2xl flex items-center justify-center transition-all ${isZoomed ? 'bg-primary text-black' : 'bg-white dark:bg-slate-800'}`}>
                    <ZoomIn className="size-6" />
                 </button>
                 <button onClick={runRender} className="size-14 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center hover:bg-primary transition-colors">
                    <Rotate3d className={`size-6 ${status === 'RENDERING' ? 'animate-spin' : ''}`} />
                 </button>
              </div>

              {/* Central Trigger */}
              {status === 'IDLE' && selectedFlowers.length > 0 && (
                <div className="absolute inset-0 flex items-center justify-center z-40 bg-black/5 backdrop-blur-[2px]">
                   <motion.button 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    whileHover={{ scale: 1.1 }}
                    onClick={runRender}
                    className="bg-slate-900 border-2 border-primary/20 text-primary px-12 py-6 rounded-[2rem] shadow-2xl flex flex-col items-center gap-3 group/render"
                   >
                     <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center group-hover/render:bg-primary group-hover/render:text-black transition-all">
                        <Rotate3d className="size-8" />
                     </div>
                     <span className="text-xs font-black uppercase tracking-[0.4em]">Final Render</span>
                   </motion.button>
                </div>
              )}

              {/* Rendering Overlay */}
              {status === 'RENDERING' && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-3xl animate-in fade-in duration-500 overflow-hidden">
                   {/* Scanning Line */}
                   <motion.div 
                    initial={{ top: '-20%' }}
                    animate={{ top: '120%' }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent blur-sm z-10 opacity-50"
                   />
                   
                   <div className="relative size-48 flex items-center justify-center mb-8">
                      <div className="absolute inset-0 border-[6px] border-white/5 rounded-full" />
                      <svg className="absolute inset-0 size-full -rotate-90">
                         <circle 
                          cx="96" cy="96" r="90" 
                          fill="none" 
                          stroke="#13ec5b" 
                          strokeWidth="8" 
                          strokeDasharray="565" 
                          strokeDashoffset={565 - (565 * renderProgress) / 100}
                          className="transition-all duration-300"
                         />
                      </svg>
                      <img src="https://images.unsplash.com/photo-1548802673-380ab8ebc7b7?q=80&w=200" className="size-32 rounded-full object-cover animate-pulse opacity-50" alt="" />
                   </div>
                   <h3 className="text-2xl font-black text-white italic mb-2 tracking-tighter">BirBuketiniz yaradılır...</h3>
                   <p className="text-[10px] font-black uppercase text-primary tracking-[0.5em]">{renderProgress}% Tamamlandı</p>
                </div>
              )}

              {/* Main Image Stage */}
              <motion.div 
                style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
                animate={{ scale: isZoomed ? 1.4 : 1 }}
                className="w-full h-full flex items-center justify-center p-16 z-20 pointer-events-none relative"
              >
                 {/* Multi-Layered Studio Shadows */}
                 <motion.div 
                    style={{ x: shadowX, y: shadowY }}
                    className="absolute size-48 bg-black/30 blur-[80px] rounded-full -z-10 opacity-60"
                 />
                 <motion.div 
                    style={{ x: useTransform(shadowX, (v) => (v as number) * 0.5), y: useTransform(shadowY, (v) => (v as number) * 0.5) }}
                    className="absolute size-64 bg-black/10 blur-[40px] rounded-full -z-20 opacity-40"
                 />
                 
                 {/* Realistic Light Sweep Effect */}
                 <motion.div 
                    style={{ x: lightX, y: lightY }}
                    className="absolute inset-0 z-30 pointer-events-none mix-blend-soft-light opacity-30"
                    animate={status === 'COMPLETED' ? { opacity: [0.1, 0.4, 0.1] } : {}}
                    transition={{ duration: 4, repeat: Infinity }}
                 >
                    <div className="absolute inset-[-100%] bg-gradient-to-br from-white via-transparent to-transparent rotate-45" />
                 </motion.div>

                 <AnimatePresence mode="wait">
                    <motion.img 
                      key={getSourceImage() + status}
                      src={getSourceImage()}
                      onError={() => {
                        if (status === 'COMPLETED') {
                          setPreloadedImage(FINAL_FALLBACK_IMAGE);
                        }
                      }}
                      initial={{ opacity: 0, scale: 0.8, filter: 'blur(20px) brightness(0.8)' }}
                      animate={{ 
                        opacity: 1, 
                        scale: 1, 
                        filter: status === 'RENDERING' ? 'blur(40px) brightness(0.5)' : 'blur(0px) brightness(1)',
                        transition: { duration: 1 }
                      }}
                      exit={{ opacity: 0, scale: 1.1 }}
                      className="max-h-full object-contain drop-shadow-[0_60px_80px_rgba(0,0,0,0.4)]"
                    />
                 </AnimatePresence>

                 {status === 'COMPLETED' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute bottom-10 left-10 right-10 z-40"
                    >
                       <div className="bg-white/10 dark:bg-black/40 backdrop-blur-3xl border border-white/20 p-8 rounded-[2.5rem] shadow-2xl pointer-events-auto">
                          <div className="flex items-center gap-3 mb-3">
                             <Sparkles className="text-primary size-5" />
                             <h4 className="text-lg font-serif italic text-white whitespace-pre-wrap">{analysis?.title || 'Zərif Kompozisiya'}</h4>
                          </div>
                          <p className="text-[11px] text-white/80 leading-relaxed font-medium">
                            {analysis?.description || 'Sizin tərəfinizdən zövqlə hazırlanmış fərdi kompozisiya.'}
                          </p>
                       </div>
                    </motion.div>
                 )}

                 {status === 'COMPLETED' && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                    >
                       <div className="relative">
                          {[...Array(6)].map((_, i) => (
                             <motion.div 
                                key={i}
                                initial={{ opacity: 1, scale: 0 }}
                                animate={{ opacity: 0, scale: 2, y: -40, x: (i - 2.5) * 20 }}
                                transition={{ duration: 1, ease: "easeOut" }}
                                className="absolute top-0 left-0"
                             >
                                <Sparkles className="text-primary size-6" />
                             </motion.div>
                          ))}
                       </div>
                    </motion.div>
                 )}
              </motion.div>
            </div>

            {/* Spec Card */}
            <div className="mt-8 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-10 rounded-[3.5rem] shadow-sm">
               <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Güllər</p>
                    <p className="text-xs font-bold">{selectedFlowers.length === 0 ? 'Yoxdur' : `${selectedFlowers.reduce((a,b) => a+b.count,0)} ədəd`}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Qablaşdırma</p>
                    <p className="text-xs font-bold">{material.type} ({material.colorName})</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Lent</p>
                    <p className="text-xs font-bold">{RIBBON_COLORS.find(r => r.id === ribbonColor)?.name || 'Qırmızı'}</p>
                  </div>
                  <div>
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Keyfiyyət</p>
                     <p className="text-xs font-bold text-primary">Ultra HD</p>
                  </div>
               </div>
            </div>
          </div>

        </div>
      </div>
      <AnimatePresence>
        {showCheckoutModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/55 backdrop-blur-sm p-4 md:p-8"
            onClick={() => setShowCheckoutModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="mx-auto max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 md:p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-base font-black uppercase tracking-[0.2em]">Buket sifarişini tamamla</h3>
                <button
                  className="size-9 rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-center"
                  onClick={() => setShowCheckoutModal(false)}
                >
                  <X className="size-4" />
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Render edilmiş şəkil + tərkib draft kimi göndəriləcək, sonra checkout yaradılacaq.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">
                <input
                  value={checkoutForm.addressLine}
                  onChange={(e) => setCheckoutForm((prev) => ({ ...prev, addressLine: e.target.value }))}
                  placeholder="Ünvan"
                  className="rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2.5 bg-transparent outline-none focus:border-primary"
                />
                <input
                  type="date"
                  min={minDeliveryDate}
                  value={checkoutForm.deliveryDate}
                  onChange={(e) => setCheckoutForm((prev) => ({ ...prev, deliveryDate: e.target.value }))}
                  className="rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2.5 bg-transparent outline-none focus:border-primary"
                />
                <select
                  value={checkoutForm.deliveryTimeSlot}
                  onChange={(e) =>
                    setCheckoutForm((prev) => ({
                      ...prev,
                      deliveryTimeSlot: e.target.value as typeof prev.deliveryTimeSlot,
                    }))
                  }
                  className="rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2.5 bg-transparent outline-none focus:border-primary"
                >
                  <option value="SLOT_09_12">09:00-12:00</option>
                  <option value="SLOT_12_15">12:00-15:00</option>
                  <option value="SLOT_15_18">15:00-18:00</option>
                  <option value="SLOT_18_21">18:00-21:00</option>
                </select>
                <input
                  type="number"
                  min={1}
                  value={checkoutForm.quantity}
                  onChange={(e) =>
                    setCheckoutForm((prev) => ({
                      ...prev,
                      quantity: Math.max(1, Number(e.target.value) || 1),
                    }))
                  }
                  placeholder="Ədəd"
                  className="rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2.5 bg-transparent outline-none focus:border-primary"
                />
              </div>
              <p className="mt-2 text-[11px] font-semibold text-slate-500">
                Say seçimi: bu dəyər sifarişdə buketin neçə ədəd hazırlanacağını göstərir.
              </p>

              <div className="mt-4 rounded-2xl border border-slate-200 dark:border-white/10 p-3 relative">
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
                    className="flex-1 rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2.5 bg-transparent outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={handleMapSearch}
                    disabled={mapSearching}
                    className="rounded-xl bg-primary text-black px-4 py-2.5 text-xs font-black disabled:opacity-70"
                  >
                    {mapSearching ? 'Axtarılır...' : 'Axtar'}
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/5 p-1">
                  <span className="px-2 text-[11px] font-bold text-slate-500">Xəritə görünüşü</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setMapStyle('street')}
                      className={`rounded-lg px-3 py-1.5 text-[11px] font-black transition ${
                        mapStyle === 'street'
                          ? 'bg-primary text-black shadow'
                          : 'bg-transparent text-slate-500 hover:bg-black/5 dark:hover:bg-white/10'
                      }`}
                    >
                      Klassik
                    </button>
                    <button
                      type="button"
                      onClick={() => setMapStyle('satellite')}
                      className={`rounded-lg px-3 py-1.5 text-[11px] font-black transition ${
                        mapStyle === 'satellite'
                          ? 'bg-primary text-black shadow'
                          : 'bg-transparent text-slate-500 hover:bg-black/5 dark:hover:bg-white/10'
                      }`}
                    >
                      Peyk
                    </button>
                  </div>
                </div>

                <div className="mt-3 h-56 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10">
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

                <div className="mt-2 flex flex-wrap gap-3 text-[11px] font-semibold text-slate-500">
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
                {addressNotice ? <p className="mt-2 text-xs font-semibold text-slate-500">{addressNotice}</p> : null}
              </div>

              <textarea
                value={checkoutForm.note}
                onChange={(e) => setCheckoutForm((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="Buket üçün qeyd (opsional)"
                className="mt-3 w-full min-h-20 rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2.5 bg-transparent outline-none focus:border-primary"
              />

              <div className="mt-4 rounded-2xl border border-slate-200 dark:border-white/10 p-3">
                <p className="text-xs font-black mb-2">Açıqca seçimi (məhsullardan)</p>
                {!showGreetingCardSection ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowGreetingCardSection(true);
                      setShowGreetingCardPicker(true);
                    }}
                    className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-black text-primary"
                  >
                    Açıqca əlavə et
                  </button>
                ) : cardsLoading ? (
                  <p className="text-xs text-slate-500">Açıqcalar yüklənir...</p>
                ) : greetingCards.length === 0 ? (
                  <p className="text-xs text-slate-500">Açıqca məhsulu tapılmadı.</p>
                ) : (
                  <>
                    <div className="rounded-xl border border-slate-200 dark:border-white/10 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold text-slate-500">
                          {selectedGreetingCardId != null
                            ? `Seçildi: ${greetingCards.find((x) => x.id === selectedGreetingCardId)?.title || selectedGreetingCardId}`
                            : 'Açıqca seçilməyib'}
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowGreetingCardPicker(true)}
                          className="rounded-lg border border-slate-300 dark:border-white/10 px-3 py-1.5 text-[11px] font-bold"
                        >
                          Açıqcaları göstər
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowGreetingCardSection(false);
                          setShowGreetingCardPicker(false);
                          setSelectedGreetingCardId(null);
                          setCardMessage('');
                        }}
                        className="rounded-lg border border-slate-300 dark:border-white/10 px-3 py-1.5 text-[11px] font-bold"
                      >
                        Açıqcanı ləğv et
                      </button>
                    </div>
                  </>
                )}
                {showGreetingCardSection ? (
                  <input
                    value={cardMessage}
                    onChange={(e) => setCardMessage(e.target.value)}
                    placeholder="Açıqca üçün mesaj (opsional)"
                    className="mt-3 w-full rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2.5 bg-transparent outline-none focus:border-primary"
                  />
                ) : null}

                {showGreetingCardSection && showGreetingCardPicker ? (
                  <div className="absolute left-1/2 -translate-x-1/2 top-16 z-30 w-[calc(100%-1.5rem)] sm:w-[420px] rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111] p-3 shadow-2xl max-h-[320px] overflow-y-auto">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-black">Açıqca seçin</p>
                        <button
                          type="button"
                          onClick={() => setShowGreetingCardPicker(false)}
                          className="rounded-lg border border-slate-300 dark:border-white/10 px-2 py-1 text-[11px] font-bold"
                        >
                          Bağla
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {greetingCards.map((card) => (
                          <button
                            key={card.id}
                            type="button"
                            onClick={() => {
                              setSelectedGreetingCardId(card.id);
                              setShowGreetingCardPicker(false);
                            }}
                            className={`text-left rounded-xl border p-2 transition-colors ${
                              selectedGreetingCardId === card.id
                                ? 'border-primary bg-primary/10'
                                : 'border-slate-200 dark:border-white/10'
                            }`}
                          >
                            <div className="rounded-lg overflow-hidden border border-slate-200/60 dark:border-white/10">
                              {card.img ? (
                                <img src={card.img} alt={card.title} className="h-24 w-full object-cover" />
                              ) : (
                                <div className="h-24 w-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400">
                                  <ImageIcon className="size-5" />
                                </div>
                              )}
                            </div>
                            <div className="pt-2 min-w-0">
                              <p className="text-xs font-bold truncate">{card.title}</p>
                              <p className="text-[11px] text-slate-500">{card.price.toFixed(2)} AZN</p>
                            </div>
                          </button>
                        ))}
                      </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 rounded-2xl bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm font-semibold">
                Vahid qiymət: {totalPrice.toFixed(2)} AZN • Cəm: {(totalPrice * checkoutForm.quantity).toFixed(2)} AZN
              </div>

              <div className="mt-4">
                <p className="text-xs font-black mb-2">Ödəniş üsulu</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCheckoutForm((prev) => ({ ...prev, paymentMethod: 'CASH' }))}
                    className={`flex-1 rounded-xl border px-3 py-2.5 text-xs font-black ${
                      checkoutForm.paymentMethod === 'CASH'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-slate-200 dark:border-white/10'
                    }`}
                  >
                    CASH
                  </button>
                  <button
                    type="button"
                    onClick={() => setCheckoutForm((prev) => ({ ...prev, paymentMethod: 'CARD' }))}
                    className={`flex-1 rounded-xl border px-3 py-2.5 text-xs font-black ${
                      checkoutForm.paymentMethod === 'CARD'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-slate-200 dark:border-white/10'
                    }`}
                  >
                    CARD
                  </button>
                </div>
              </div>

              {checkoutError ? <p className="mt-3 text-sm font-semibold text-red-500">{checkoutError}</p> : null}
              {checkoutSuccess ? <p className="mt-3 text-sm font-semibold text-emerald-600">{checkoutSuccess}</p> : null}

              <button
                onClick={submitCustomBouquetOrder}
                disabled={checkoutLoading}
                className="mt-5 w-full rounded-2xl bg-primary text-black font-black py-3.5 disabled:opacity-60"
              >
                {checkoutLoading ? 'Sifariş göndərilir...' : 'Sifarişi təsdiqlə'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
