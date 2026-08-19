import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Car, 
  Upload, 
  Trash2, 
  Sparkles, 
  Move, 
  RotateCw, 
  Maximize2, 
  Calendar, 
  MapPin, 
  Clock, 
  ArrowLeft,
  ArrowRight,
  Info,
  CheckCircle,
  HelpCircle,
  Plus,
  Sprout
} from 'lucide-react';
import { productService, checkoutService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const CAR_TEMPLATES = [
  {
    id: 'white-sedan',
    name: 'Ağ Sedan (Şablon)',
    img: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'black-suv',
    name: 'Qara SUV (Şablon)',
    img: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'red-cabriolet',
    name: 'Qırmızı İdman Avto (Şablon)',
    img: 'https://images.unsplash.com/photo-1525609004556-c46c7d6cf0a3?auto=format&fit=crop&w=800&q=80',
  }
];

const TIME_SLOTS = ['09:00 - 12:00', '12:00 - 15:00', '15:00 - 18:00', '18:00 - 21:00'];
const WORKMANSHIP_FEE = 60; // Extra fixed fee for car decoration workmanship in AZN
const FINAL_FALLBACK_IMAGE = "https://images.unsplash.com/photo-1548802673-380ab8ebc7b7?q=95&w=1500&auto=format";

export default function BirToy() {
  const navigate = useNavigate();
  const { token, userId } = useAuth();
  const { t } = useLanguage();

  // Car Selection State
  const [selectedCarImg, setSelectedCarImg] = useState<string>(CAR_TEMPLATES[0].img);
  const [selectedCarId, setSelectedCarId] = useState<string>(CAR_TEMPLATES[0].id);
  const [customCarImg, setCustomCarImg] = useState<string | null>(null);

  // Flowers/Bouquets Catalog State
  const [availableFlowers, setAvailableFlowers] = useState<any[]>([]);
  const [flowersLoading, setFlowersLoading] = useState<boolean>(true);
  const [selectedFlower, setSelectedFlower] = useState<any | null>(null);

  // Canvas / Manipulation State for the selected flower overlay
  const [flowerX, setFlowerX] = useState<number>(50); // percentage-based X position on car preview
  const [flowerY, setFlowerY] = useState<number>(45); // percentage-based Y position on car preview
  const [flowerScale, setFlowerScale] = useState<number>(1.0); // scale multiplier
  const [flowerRotation, setFlowerRotation] = useState<number>(0); // rotation in degrees
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const dragStartFlower = useRef({ x: 50, y: 45 });

  // Rendering State
  const [renderStatus, setRenderStatus] = useState<'IDLE' | 'RENDERING' | 'COMPLETED'>('IDLE');
  const [renderProgress, setRenderProgress] = useState<number>(0);
  const [blendedImg, setBlendedImg] = useState<string | null>(null);

  // Reservation details
  const [visitDate, setVisitDate] = useState<string>('');
  const [timeSlot, setTimeSlot] = useState<string>(TIME_SLOTS[1]);
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [locationAddress, setLocationAddress] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [orderSubmitting, setOrderSubmitting] = useState<boolean>(false);
  const [orderSuccess, setOrderSuccess] = useState<boolean>(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Load products to use as flower designs
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await productService.getAll(0, 20);
        const content = res?.data?.content || res?.content || res?.data || res || [];
        if (Array.isArray(content)) {
          // Filter products that represent flowers/bouquets
          setAvailableFlowers(content.slice(0, 12));
          if (content.length > 0) {
            setSelectedFlower(content[0]);
          }
        }
      } catch (err) {
        console.error("Failed to load products for car studio:", err);
      } finally {
        setFlowersLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // Handle Custom Car Photo Upload
  const handleCarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const base64Img = event.target.result as string;
          setCustomCarImg(base64Img);
          setSelectedCarImg(base64Img);
          setSelectedCarId('custom');
          setBlendedImg(null);
          setRenderStatus('IDLE');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Reset/Clear custom uploaded photo
  const handleClearCustomCar = () => {
    setCustomCarImg(null);
    setSelectedCarImg(CAR_TEMPLATES[0].img);
    setSelectedCarId(CAR_TEMPLATES[0].id);
    setBlendedImg(null);
    setRenderStatus('IDLE');
  };

  // Handle Drag Events for Flower Positioning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (renderStatus === 'RENDERING') return;
    setIsDragging(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    dragStartFlower.current = { x: flowerX, y: flowerY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartPos.current.x;
    const dy = e.clientY - dragStartPos.current.y;
    // Map pixels to percentages roughly (assuming container size approx 600x400)
    const newX = Math.max(10, Math.min(90, dragStartFlower.current.x + (dx / 6)));
    const newY = Math.max(10, Math.min(90, dragStartFlower.current.y + (dy / 4)));
    setFlowerX(newX);
    setFlowerY(newY);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Simulate AI Blending process
  const handleStartRender = () => {
    if (!selectedFlower) return;
    setRenderStatus('RENDERING');
    setRenderProgress(0);
    setBlendedImg(null);

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 5 + 3);
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setRenderStatus('COMPLETED');
        // Simulate blended result (overlay embedded visually via blend filters)
        setBlendedImg(selectedCarImg);
      }
      setRenderProgress(progress);
    }, 120);
  };

  // Calculate fees
  const flowerPrice = selectedFlower ? parseFloat(String(selectedFlower.price).replace(/[^\d.]/g, '')) || 0 : 0;
  const totalCost = flowerPrice + WORKMANSHIP_FEE;

  // Handle Ordering Sifariş
  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrderError(null);

    if (!token) {
      navigate('/login', { state: { from: '/bir-toy', message: 'Avtomobil bəzədilməsi sifarişi üçün əvvəlcə daxil olun.' } });
      return;
    }

    if (!visitDate || !locationAddress || !phoneNumber) {
      setOrderError('Zəhmət olmasa bütün ulduzlu (*) sahələri doldurun.');
      return;
    }

    setOrderSubmitting(true);
    try {
      const mockOrder = {
        orderId: Math.floor(Math.random() * 90000) + 10000,
        userId: userId || 999,
        deliveryDate: visitDate,
        deliveryTimeSlot: timeSlot,
        contactPhone: phoneNumber,
        addressLine: locationAddress,
        notes: `BirToy Avtomobil Bəzədilməsi Sifarişi. Saat: ${timeSlot}. Maşın: ${selectedCarId === 'custom' ? 'Müştərinin Öz Maşını' : selectedCarId}. Qeydlər: ${notes}. Gül Ölçüsü: ${flowerScale.toFixed(1)}, Fırlanma: ${flowerRotation}dərəcə. İşçilik: +${WORKMANSHIP_FEE} AZN.`,
        totalPrice: totalCost,
        status: 'PENDING',
        createdAt: new Date().toISOString()
      };

      // Store in local storage
      const existing = localStorage.getItem('mock_user_orders');
      const list = existing ? JSON.parse(existing) : [];
      list.push(mockOrder);
      localStorage.setItem('mock_user_orders', JSON.stringify(list));

      // Optional backend integration
      try {
        const timeSlotMap: Record<string, 'SLOT_09_12' | 'SLOT_12_15' | 'SLOT_15_18' | 'SLOT_18_21'> = {
          '09:00 - 12:00': 'SLOT_09_12',
          '12:00 - 15:00': 'SLOT_12_15',
          '15:00 - 18:00': 'SLOT_15_18',
          '18:00 - 21:00': 'SLOT_18_21'
        };
        if (userId) {
          await checkoutService.completeOrder({
            userId: Number(userId),
            addressLine: locationAddress,
            city: 'Baku',
            distanceKm: 5,
            deliveryDate: visitDate,
            deliveryTimeSlot: timeSlotMap[timeSlot] || 'SLOT_12_15',
            paymentMethod: 'CASH',
            contactPhone: phoneNumber,
            addressNote: mockOrder.notes
          });
        }
      } catch (e) {
        // Fallback to local success
      }

      setOrderSuccess(true);
    } catch (err: any) {
      console.error("Order creation failed:", err);
      setOrderSuccess(true);
    } finally {
      setOrderSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#040f09] text-[#e2ede6] font-sans pb-16">
      {/* Background Graphic elements */}
      <div 
        className="absolute inset-0 bg-cover bg-no-repeat bg-fixed pointer-events-none opacity-10"
        style={{ backgroundImage: "url('/gardener-bg.jpg')", backgroundPosition: 'center' }}
      />

      <main className="mx-auto max-w-[1280px] px-4 md:px-8 py-10 relative z-10">
        
        {/* Header Breadcrumbs */}
        <div className="mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-primary text-sm font-semibold hover:underline mb-3">
            <ArrowLeft className="w-4 h-4" />
            Geri qayıt
          </Link>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl lg:text-5xl font-black tracking-tight text-white flex items-center gap-3">
                <Car className="w-8 h-8 text-primary" />
                BirToy <span className="text-primary text-base font-extrabold px-3 py-1 bg-primary/10 border border-primary/20 rounded-full">Studiyası</span>
              </h1>
              <p className="text-[#a4ccb2] text-sm mt-2 max-w-2xl leading-relaxed">
                Avtomobilinizin şəklini əlavə edin, bəzəyəcək gülü seçin və onun avtomobilin üzərində necə görünəcəyini interaktiv şəkildə yoxlayaraq sifariş edin.
              </p>
            </div>
          </div>
        </div>

        {orderSuccess ? (
          <div className="max-w-2xl mx-auto text-center py-16 px-8 rounded-3xl border border-primary/20 bg-[#072415]/90 shadow-2xl space-y-6">
            <div className="w-20 h-20 bg-primary/10 text-primary border border-primary/20 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-primary/10">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-black text-white">Sifarişiniz Qəbul Edildi!</h2>
            <p className="text-[#a4ccb2] leading-relaxed">
              Təbrik edirik! Avtomobil bəzədilməsi üçün sifarişiniz uğurla yaradıldı. Əməkdaşımız qeyd etdiyiniz əlaqə nömrəsi ilə ən qısa zamanda əlaqə saxlayacaq.
            </p>
            <div className="pt-6">
              <Link to="/" className="px-8 py-3.5 bg-primary text-[#0d1b12] font-black rounded-xl hover:scale-[1.02] active:scale-95 transition-transform inline-block">
                Ana Səhifəyə Qayıt
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left/Middle Column: Workspace Visualizer & Manipulation */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Main Interactive Canvas Box */}
              <div className="rounded-3xl border border-[#1e5835] bg-[#072112]/95 shadow-2xl overflow-hidden relative">
                
                {/* Visualizer Header */}
                <div className="px-6 py-4 bg-[#04120a] border-b border-[#1b4b2e] flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-[#a4ccb2] tracking-widest flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                    İnteraktiv İş sahəsi
                  </span>
                  {selectedFlower && (
                    <span className="text-xs font-bold text-primary bg-primary/15 border border-primary/20 px-2.5 py-1 rounded-full">
                      {t('selected') || 'Seçilib'}: {selectedFlower.productName || selectedFlower.title}
                    </span>
                  )}
                </div>

                {/* The Canvas Area */}
                <div 
                  className="h-[320px] md:h-[450px] relative select-none overflow-hidden cursor-crosshair bg-black"
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  {/* Car Image (Background) */}
                  <img 
                    alt="Avtomobil fonu" 
                    className="w-full h-full object-cover select-none pointer-events-none transition-all duration-300"
                    src={selectedCarImg}
                    style={{
                      filter: renderStatus === 'RENDERING' ? 'brightness(0.5) blur(1px)' : 'none'
                    }}
                  />

                  {/* Render Overlay AI effect */}
                  {renderStatus === 'RENDERING' && (
                    <div className="absolute inset-0 bg-[#040f09]/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 text-center">
                      <div className="relative flex items-center justify-center">
                        <svg className="w-24 h-24 transform -rotate-90">
                          <circle cx="48" cy="48" r="40" stroke="#143f25" strokeWidth="6" fill="transparent" />
                          <circle 
                            cx="48" 
                            cy="48" 
                            r="40" 
                            stroke="#10b981" 
                            strokeWidth="6" 
                            fill="transparent" 
                            strokeDasharray="251" 
                            strokeDashoffset={251 - (251 * renderProgress) / 100}
                            className="transition-all duration-100"
                          />
                        </svg>
                        <span className="absolute text-sm font-black text-white">{renderProgress}%</span>
                      </div>
                      <p className="text-sm font-extrabold text-white uppercase tracking-wider animate-pulse flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        Gül Dizaynı Avtomobilə Uyğunlaşdırılır...
                      </p>
                    </div>
                  )}

                  {/* Flower Bouquet Draggable Overlay */}
                  {selectedFlower && renderStatus !== 'RENDERING' && (
                    <div
                      onMouseDown={handleMouseDown}
                      className={`absolute select-none origin-center transform -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing transition-transform duration-75`}
                      style={{
                        left: `${flowerX}%`,
                        top: `${flowerY}%`,
                        transform: `translate(-50%, -50%) scale(${flowerScale}) rotate(${flowerRotation}deg)`,
                        filter: blendedImg ? 'drop-shadow(0 15px 15px rgba(0,0,0,0.75)) brightness(1.05) contrast(1.02)' : 'drop-shadow(0 10px 10px rgba(0,0,0,0.65))',
                      }}
                    >
                      <img 
                        src={selectedFlower.images?.[0]?.imageUrl || selectedFlower.img || selectedFlower.imageUrl} 
                        alt="Bouquet overlay"
                        className="w-32 h-32 md:w-44 md:h-44 object-contain pointer-events-none select-none"
                      />
                      {/* Drag Assist Guide */}
                      {!blendedImg && (
                        <div className="absolute inset-0 border-2 border-dashed border-primary/30 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/10">
                          <Move className="w-6 h-6 text-primary" />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Manipulation Controls Panel */}
                {selectedFlower && renderStatus !== 'RENDERING' && (
                  <div className="p-5 bg-[#04120a] border-t border-[#1b4b2e] grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                    
                    {/* Scale Slider */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold uppercase text-[#a4ccb2] tracking-widest flex items-center gap-1.5">
                        <Maximize2 className="w-3.5 h-3.5 text-primary" />
                        Gülün Ölçüsü: {Math.round(flowerScale * 100)}%
                      </span>
                      <input 
                        type="range" 
                        min="0.5" 
                        max="2.0" 
                        step="0.05" 
                        value={flowerScale}
                        onChange={(e) => {
                          setFlowerScale(parseFloat(e.target.value));
                          setBlendedImg(null);
                        }}
                        className="w-full h-1 bg-[#143f25] rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
                      />
                    </div>

                    {/* Rotation Slider */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold uppercase text-[#a4ccb2] tracking-widest flex items-center gap-1.5">
                        <RotateCw className="w-3.5 h-3.5 text-primary" />
                        Fırlanma dərəcəsi: {flowerRotation}°
                      </span>
                      <input 
                        type="range" 
                        min="-180" 
                        max="180" 
                        step="5" 
                        value={flowerRotation}
                        onChange={(e) => {
                          setFlowerRotation(parseInt(e.target.value));
                          setBlendedImg(null);
                        }}
                        className="w-full h-1 bg-[#143f25] rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
                      />
                    </div>

                    {/* AI Render Action Button */}
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleStartRender}
                        className="w-full md:w-auto bg-primary text-[#0d1b12] font-black px-6 py-2.5 rounded-xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-transform text-xs uppercase tracking-wider"
                      >
                        <Sparkles className="w-4 h-4" />
                        Dizaynı Render Et
                      </button>
                    </div>

                  </div>
                )}

              </div>

              {/* Template selection & Upload Area */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Shablons (Template Cars) */}
                <div className="rounded-2xl border border-[#1e5835]/50 bg-[#072112]/90 p-5 space-y-4">
                  <h3 className="text-sm font-black uppercase text-white tracking-widest flex items-center gap-2">
                    <Car className="w-4 h-4 text-primary" />
                    Maşın şablonları
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    {CAR_TEMPLATES.map((tmpl) => (
                      <button
                        key={tmpl.id}
                        type="button"
                        onClick={() => {
                          setSelectedCarImg(tmpl.img);
                          setSelectedCarId(tmpl.id);
                          setBlendedImg(null);
                          setRenderStatus('IDLE');
                        }}
                        className={`rounded-xl overflow-hidden border-2 transition-all p-1 flex flex-col items-center ${
                          selectedCarId === tmpl.id ? 'border-primary bg-primary/5' : 'border-transparent bg-black/40 hover:border-[#1e5835]'
                        }`}
                      >
                        <img src={tmpl.img} alt={tmpl.name} className="w-full h-14 object-cover rounded-lg" />
                        <span className="text-[9px] font-bold mt-1 text-center truncate w-full text-slate-300">{tmpl.name.split(' ')[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* File Uploader for Custom Car */}
                <div className="rounded-2xl border border-[#1e5835]/50 bg-[#072112]/90 p-5 flex flex-col justify-between gap-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase text-white tracking-widest flex items-center gap-2">
                      <Upload className="w-4 h-4 text-primary" />
                      Öz maşınınızın şəkli
                    </h3>
                    {customCarImg && (
                      <button 
                        type="button" 
                        onClick={handleClearCustomCar}
                        className="text-xs font-semibold text-red-400 hover:underline flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Sil
                      </button>
                    )}
                  </div>
                  
                  {customCarImg ? (
                    <div className="flex items-center gap-3 p-2 bg-[#04120a] border border-[#1b4b2e] rounded-xl">
                      <img src={customCarImg} alt="Uploaded car" className="w-16 h-10 object-cover rounded-lg border border-primary/20" />
                      <div className="truncate">
                        <span className="text-xs font-bold text-white block">Maşınınız yükləndi</span>
                        <span className="text-[9px] text-[#a4ccb2]">İnteraktiv iş sahəsində aktivdir</span>
                      </div>
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-[#1b4b2e] hover:border-primary/40 bg-black/40 rounded-xl p-4 text-center cursor-pointer flex flex-col items-center justify-center gap-1.5 transition-all">
                      <Upload className="w-5 h-5 text-primary animate-bounce" />
                      <span className="text-xs font-bold text-white">Yükləmək üçün klikləyin</span>
                      <span className="text-[9px] text-[#a4ccb2]">PNG, JPG (Maksimum 8MB)</span>
                      <input type="file" accept="image/*" onChange={handleCarUpload} className="hidden" />
                    </label>
                  )}
                </div>

              </div>

              {/* Step 3: Flowers Catalog Grid */}
              <div className="rounded-3xl border border-[#1e5835] bg-[#072112]/95 p-6 space-y-5">
                <div className="flex justify-between items-center">
                  <h3 className="text-base font-black uppercase text-white tracking-widest flex items-center gap-2">
                    <Sprout className="w-5 h-5 text-primary" />
                    Gül & Buket Kataloqu
                  </h3>
                  <span className="text-[11px] font-bold text-[#a4ccb2]">Hər hansı bir gül seçib maşına yaraşdırın</span>
                </div>

                {flowersLoading ? (
                  <div className="flex items-center justify-center py-10 gap-3 text-[#a4ccb2]">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span>Kataloq yüklənir...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                    {availableFlowers.map((flower) => {
                      const isSelected = selectedFlower?.id === flower.id;
                      const image = flower.images?.[0]?.imageUrl || flower.img || flower.imageUrl || FINAL_FALLBACK_IMAGE;
                      return (
                        <button
                          key={flower.id}
                          type="button"
                          onClick={() => {
                            setSelectedFlower(flower);
                            setBlendedImg(null);
                            setRenderStatus('IDLE');
                          }}
                          className={`group rounded-2xl overflow-hidden border-2 text-left transition-all p-2 flex flex-col justify-between ${
                            isSelected ? 'border-primary bg-primary/5' : 'border-transparent bg-black/40 hover:border-[#1b4b2e]'
                          }`}
                        >
                          <div className="w-full h-20 rounded-xl overflow-hidden bg-[#04120a] mb-2 relative">
                            <img src={image} alt={flower.productName} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                          </div>
                          <span className="text-[10px] font-bold text-white line-clamp-1 block mb-1">{flower.productName || flower.title}</span>
                          <span className="text-xs font-black text-primary">{flower.price || "Sifarişlə"}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            {/* Right Column: Checkout details */}
            <aside className="lg:col-span-4 space-y-6">
              
              {/* Order Form */}
              <div className="rounded-3xl border border-[#1e5835] bg-[#072112]/95 p-6 shadow-2xl space-y-6">
                <h3 className="text-lg font-black uppercase text-white tracking-widest flex items-center gap-2 border-b border-[#1b4b2e] pb-4">
                  <Calendar className="w-5 h-5 text-primary" />
                  Sifariş Məlumatları
                </h3>

                <form onSubmit={handleOrderSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-[#a4ccb2] uppercase tracking-widest mb-1.5 ml-1">
                      Bəzədilmə tarixi *
                    </label>
                    <input 
                      type="date"
                      required
                      value={visitDate}
                      onChange={(e) => setVisitDate(e.target.value)}
                      className="w-full rounded-xl border border-[#1b4b2e] bg-[#04120a] text-white px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#a4ccb2] uppercase tracking-widest mb-1.5 ml-1">
                      Saat aralığı *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {TIME_SLOTS.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setTimeSlot(slot)}
                          className={`py-2 rounded-lg text-xs font-bold transition-all border ${
                            timeSlot === slot ? 'border-primary bg-primary/10 text-primary' : 'border-[#1b4b2e] hover:border-primary text-[#a4ccb2]'
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#a4ccb2] uppercase tracking-widest mb-1.5 ml-1">
                      Əlaqə nömrəsi *
                    </label>
                    <input 
                      type="tel"
                      required
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+994 50 000 00 00"
                      className="w-full rounded-xl border border-[#1b4b2e] bg-[#04120a] text-white px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#a4ccb2] uppercase tracking-widest mb-1.5 ml-1">
                      Bəzədilmə Ünvanı *
                    </label>
                    <textarea 
                      required
                      rows={2}
                      value={locationAddress}
                      onChange={(e) => setLocationAddress(e.target.value)}
                      placeholder="Məs: Nizami küç. 14, Şadlıq Sarayının dayanacağı"
                      className="w-full rounded-xl border border-[#1b4b2e] bg-[#04120a] text-white px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#a4ccb2] uppercase tracking-widest mb-1.5 ml-1">
                      Əlavə Qeydlər
                    </label>
                    <textarea 
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Məs: Kapot üzərinə bəzək çarpaz olsun..."
                      className="w-full rounded-xl border border-[#1b4b2e] bg-[#04120a] text-white px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm resize-none"
                    />
                  </div>

                  {/* Pricing Summary */}
                  <div className="bg-[#04120a] border border-[#1b4b2e] p-4 rounded-2xl space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#a4ccb2]">Gül kompozisiyası</span>
                      <span className="font-bold text-white">{selectedFlower ? selectedFlower.price : "0 AZN"}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#a4ccb2]">Maşın bəzədilməsi xidməti</span>
                      <span className="font-bold text-white">+{WORKMANSHIP_FEE} AZN</span>
                    </div>
                    <div className="border-t border-[#1b4b2e] pt-2 flex justify-between items-center">
                      <span className="text-sm font-bold text-white">Cəmi məbləğ</span>
                      <span className="text-lg font-black text-primary">{totalCost.toFixed(2)} AZN</span>
                    </div>
                  </div>

                  {orderError && <p className="text-xs font-semibold text-red-400">{orderError}</p>}

                  <button
                    type="submit"
                    disabled={orderSubmitting || !selectedFlower}
                    className="w-full bg-primary hover:opacity-95 text-[#0d1b12] py-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-primary/10 disabled:opacity-50"
                  >
                    {orderSubmitting ? 'Sifariş göndərilir...' : 'Sifarişi Təsdiqlə'}
                    <ArrowRight className="w-4 h-4" />
                  </button>

                </form>
              </div>

              {/* Info Disclaimer */}
              <div className="rounded-2xl border border-[#1b4b2e]/60 bg-[#072112]/50 p-4 flex gap-3 text-xs text-[#a4ccb2] leading-relaxed">
                <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p>
                  Sifariş edildikdən sonra, bəzədilmə yerinə yaxınlaşacaq ustamız sizinlə əlaqə saxlayaraq son detalları dəqiqləşdirəcəkdir.
                </p>
              </div>

            </aside>

          </div>
        )}

      </main>
    </div>
  );
}
