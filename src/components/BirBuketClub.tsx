import {
  CheckCircle2,
  Clock3,
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
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

const FLOWER_BG =
  'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=1920&q=80';

type SubscriptionPlan = {
  code: string;
  name?: string;
  discountPercent?: number;
  periodMonths?: number;
  price?: number;
};

export default function BirBuketClub() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [mySubscription, setMySubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoadingCode, setCheckoutLoadingCode] = useState<string | null>(null);
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
  const [firstDeliveryDate, setFirstDeliveryDate] = useState<string>('');
  const [activeStep, setActiveStep] = useState<number>(1);

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
            styles: Array.isArray(settingsRes.styles) ? settingsRes.styles : clubSettings.styles,
            frequencies: Array.isArray(settingsRes.frequencies) ? settingsRes.frequencies : clubSettings.frequencies
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

      if (token) {
        try {
          const meRes = await authService.getMySubscription();
          if (!cancelled) setMySubscription(meRes);
        } catch {
          // Check local storage mock if API fails
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

  const getDeliveriesPerMonth = (freq: string) => {
    if (freq === 'Hər Həftə') return 4;
    if (freq === '2 Həftədən Bir') return 2;
    return 1; // Ayda Bir
  };

  const calculatePlanPrice = (periodMonths: number, discountPercent: number, freq: string) => {
    const deliveriesPerMonth = getDeliveriesPerMonth(freq);
    const totalDeliveries = periodMonths * deliveriesPerMonth;
    const pricePerDelivery = clubSettings.pricePerDelivery; // dynamic price per delivery
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
  }, [plans, selectedFrequency]);

  const prettyPlanName = (code: string) => {
    const key = String(code || '').toUpperCase();
    if (key === 'MONTHLY') return 'Aylıq';
    if (key === 'QUARTERLY') return 'Rüblük';
    if (key === 'SEMI_ANNUAL') return 'Yarımillik';
    if (key === 'ANNUAL') return 'İllik';
    return key || 'Plan';
  };

  const selectedPlanDetails = useMemo(() => {
    return normalizedPlans.find((p) => p.code === selectedPlanCode) || normalizedPlans[0] || { price: 49, code: 'MONTHLY', periodMonths: 1 };
  }, [normalizedPlans, selectedPlanCode]);

  const handleCheckout = async (planCode: string) => {
    if (!token) {
      navigate('/login');
      return;
    }
    if (!recipientName || !recipientPhone || !deliveryAddress || !firstDeliveryDate) {
      setError('Zəhmət olmasa bütün çatdırılma məlumatlarını (ad, telefon, ünvan və tarix) doldurun.');
      document.getElementById('setup-wizard')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    setCheckoutLoadingCode(planCode);
    setError(null);
    setSuccess(null);
    try {
      const response = await authService.checkoutSubscription({
        planCode,
        style: selectedStyle,
        frequency: selectedFrequency,
        recipientName,
        recipientPhone,
        deliveryAddress,
        firstDeliveryDate,
      });
      const newSub = response?.subscription || response;
      setMySubscription(newSub);
      setSuccess('BirBuketClub abunəliyiniz uğurla aktiv edildi.');
    } catch (err: any) {
      console.error('API Error details:', err);
      // Simulate successful subscription locally for development if API server is offline or fails
      const isNetworkError = !err.response || err.code === 'ERR_NETWORK' || err.message?.includes('Network Error') || err.message?.includes('timeout');
      if (isNetworkError || err.response?.status === 404 || err.response?.status === 500) {
        console.warn('Backend server offline or endpoint not found, using frontend mockup mode.');
        const mockSub = {
          planCode,
          startDate: new Date().toISOString(),
          status: 'ACTIVE',
          style: selectedStyle,
          frequency: selectedFrequency,
          recipientName,
          recipientPhone,
          deliveryAddress,
          firstDeliveryDate,
        };
        // Save to localStorage so it persists on reload!
        localStorage.setItem(`mock_sub_${token}`, JSON.stringify(mockSub));
        setMySubscription(mockSub);
        setSuccess('BirBuketClub abunəliyiniz uğurla aktiv edildi (Local Mock Mode).');
      } else {
        const msg = err?.response?.data?.message || 'Abunə aktiv edilə bilmədi.';
        setError(msg);
      }
    } finally {
      setCheckoutLoadingCode(null);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Arxa plan — gül görünsün */}
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-95"
        style={{ backgroundImage: `url('${FLOWER_BG}')` }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-white/20 backdrop-blur-sm dark:bg-black/25 dark:backdrop-blur-sm"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-primary/15"
        aria-hidden
      />

      {/* Səhifə məzmunu */}
      <div className="relative z-10 min-h-screen">
        <section className="px-6 lg:px-20 py-10">
          <div className="max-w-[1200px] mx-auto rounded-3xl border border-white/40 bg-white/55 dark:bg-slate-900/40 backdrop-blur-lg px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 text-primary cursor-pointer" onClick={() => navigate('/')}>
                  <Sparkles className="w-6 h-6" />
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">{t('club_title')}</h2>
                </div>
                <div className="hidden md:flex items-center gap-5 text-sm">
                  <span className="font-semibold text-primary">{t('club_subscriptions')}</span>
                  <span className="text-slate-600 dark:text-slate-300 cursor-pointer hover:text-primary transition-colors" onClick={() => navigate('/collections')}>{t('club_flowers')}</span>
                  <span className="text-slate-600 dark:text-slate-300 cursor-pointer hover:text-primary transition-colors" onClick={() => navigate('/studio')}>{t('club_studio')}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate(token ? '/account' : '/login')}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/95 transition-all"
                >
                  {token ? t('profile') : t('login')}
                </button>
              </div>
            </div>
          </div>
        </section>

        <main className="mx-auto w-full max-w-[1200px] px-6 pb-16">
          <section className="mb-16 grid gap-10 lg:grid-cols-2 lg:items-center">
            <div className="flex flex-col gap-6 rounded-[2rem] border border-white/30 bg-white/40 p-8 backdrop-blur-md dark:bg-slate-900/35 dark:border-white/10">
              <div className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/15 px-4 py-1 text-primary backdrop-blur-sm">
                <Sparkles className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">{t('premium_service')}</span>
              </div>
              <h1 className="text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight text-slate-900 dark:text-white drop-shadow-sm">
                Evinizə Həmişə <span className="text-primary">Təravət</span> Gəlsin
              </h1>
              <p className="text-lg leading-relaxed text-slate-700 dark:text-slate-300">
                {t('club_sub_desc')}
              </p>
              <div className="flex flex-wrap gap-4">
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById('club-plans')?.scrollIntoView({ behavior: 'smooth' })
                  }
                  className="rounded-xl bg-primary px-8 py-4 text-base font-bold text-white shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  {t('club_btn_start')}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById('setup-wizard')?.scrollIntoView({ behavior: 'smooth' })
                  }
                  className="rounded-xl border-2 border-primary/30 bg-white/50 px-8 py-4 text-base font-bold text-primary backdrop-blur-sm hover:bg-white/70 dark:bg-white/10 dark:hover:bg-white/15"
                >
                  {t('club_btn_setup')}
                </button>
              </div>
              {mySubscription && (
                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 mt-2">
                  <p className="text-sm font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    {t('club_active_plan')} {prettyPlanName(String(mySubscription?.planCode || mySubscription?.code || ''))}
                  </p>
                  {mySubscription.style && (
                    <p className="text-xs mt-1 text-slate-600 dark:text-slate-300">
                      {t('club_summary_style')} {mySubscription.style} | {t('club_summary_freq')} {mySubscription.frequency}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="relative aspect-square overflow-hidden rounded-[2.5rem] border border-white/35 bg-white/25 shadow-2xl backdrop-blur-md dark:bg-slate-900/30">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url('${FLOWER_BG}')` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 rounded-2xl border border-white/30 bg-white/75 p-4 backdrop-blur-md dark:bg-slate-900/80 dark:border-white/10">
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
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{t('club_subscribers')}</p>
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

          <section id="club-plans" className="mb-20 scroll-mt-24">
            <div className="mb-10 text-center">
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white drop-shadow-sm">
                {t('club_plans_title')}
              </h2>
              <p className="mt-2 text-slate-700 dark:text-slate-300 mb-6">{t('club_plans_sub')}</p>

              {/* Çatdırılma tezliyinə görə qiyməti tənzimləmək üçün düymələr */}
              <div className="inline-flex rounded-xl bg-white/50 dark:bg-slate-900/40 p-1 border border-white/30 backdrop-blur-sm">
                {['Hər Həftə', '2 Həftədən Bir', 'Ayda Bir'].map((freq) => {
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
                normalizedPlans.map((plan, idx) => {
                  const isSelected = selectedPlanCode === plan.code;
                  const isPopular = String(plan.code).toUpperCase() === 'QUARTERLY';
                  return (
                    <div
                      key={plan.code}
                      className={`relative flex flex-col rounded-3xl border p-7 shadow-md backdrop-blur-md transition-all duration-300 ${
                        isSelected
                          ? 'border-2 border-primary bg-white/90 dark:bg-slate-900/90 shadow-xl scale-[1.02] ring-4 ring-primary/10'
                          : isPopular
                          ? 'border-primary/45 bg-white/80 dark:bg-slate-900/75 shadow-md'
                          : 'border-white/40 bg-white/70 hover:border-primary/40 dark:border-white/10 dark:bg-slate-900/65'
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
                          Prioritet çatdırılma
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

          <section id="setup-wizard" className="rounded-[2.2rem] border border-white/35 bg-white/55 p-8 lg:p-10 shadow-lg backdrop-blur-lg dark:bg-slate-900/50 dark:border-white/10 scroll-mt-24">
            <div className="mb-10 text-center">
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{t('club_setup_title')}</h2>
              <p className="mt-2 text-slate-600 dark:text-slate-400">{t('club_setup_sub')}</p>
            </div>

            <div className="mx-auto mb-12 max-w-4xl">
              <div className="flex justify-between items-center relative">
                {[t('club_step_1'), t('club_step_2'), t('club_step_3')].map((step, idx) => {
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
                      <span className={`text-xs font-bold transition-colors ${isActive ? 'text-primary' : 'text-slate-500'}`}>
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
              <div className="flex flex-col gap-7 rounded-2xl border border-white/30 bg-white/40 p-6 backdrop-blur-md dark:bg-slate-900/40 dark:border-white/10">
                {activeStep === 1 && (
                  <div className="flex flex-col gap-6">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">{t('club_step_style_title')}</h3>
                      <div className="grid grid-cols-2 gap-4">
                        {clubSettings.styles.map((styleObj) => {
                          const isSelectedStyle = selectedStyle === styleObj.name;
                          return (
                            <button
                              key={styleObj.name}
                              type="button"
                              onClick={() => setSelectedStyle(styleObj.name)}
                              className={`relative flex cursor-pointer text-left flex-col gap-2 rounded-2xl border-2 p-3 transition-all ${
                                isSelectedStyle
                                  ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                                  : 'border-white/50 bg-white/30 hover:border-primary/30 dark:border-white/10 dark:bg-white/5'
                              }`}
                            >
                              <div className="w-full h-24 rounded-lg overflow-hidden border border-white/10 mb-2">
                                <img
                                  src={styleObj.img}
                                  alt={styleObj.name}
                                  className="w-full h-full object-cover hover:scale-110 transition-all duration-300"
                                />
                              </div>
                              <div className="flex justify-between items-center w-full">
                                <span className="font-bold text-slate-900 dark:text-white text-xs">{styleObj.name}</span>
                                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${isSelectedStyle ? 'border-primary bg-primary' : 'border-slate-350 dark:border-slate-600'}`}>
                                  {isSelectedStyle && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                </div>
                              </div>
                              <span className="text-[10px] text-slate-600 dark:text-slate-400 leading-tight">
                                {styleObj.desc}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">{t('club_step_freq_title')}</h3>
                      <div className="flex gap-4">
                        {clubSettings.frequencies.map((freq) => {
                          const isSelectedFreq = selectedFrequency === freq;
                          return (
                            <button
                              key={freq}
                              type="button"
                              onClick={() => setSelectedFrequency(freq)}
                              className={`flex-1 rounded-xl py-3 text-sm font-bold transition-all ${
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
                      {t('club_btn_next')}
                    </button>
                  </div>
                )}

                {activeStep === 2 && (
                  <div className="flex flex-col gap-6">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('club_delivery_info')}</h3>
                    <div className="flex flex-col gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                          {t('club_recipient_name')}
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
                          {t('club_phone')}
                        </label>
                        <input
                          type="text"
                          value={recipientPhone}
                          onChange={(e) => setRecipientPhone(e.target.value)}
                          placeholder={t('club_phone_placeholder')}
                          className="w-full h-11 px-4 rounded-xl border border-slate-300 dark:border-white/10 bg-white/70 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                          {t('club_address')}
                        </label>
                        <textarea
                          rows={3}
                          value={deliveryAddress}
                          onChange={(e) => setDeliveryAddress(e.target.value)}
                          placeholder={t('club_address_placeholder')}
                          className="w-full p-4 rounded-xl border border-slate-300 dark:border-white/10 bg-white/70 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-white resize-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                          {t('club_date')}
                        </label>
                        <input
                          type="date"
                          value={firstDeliveryDate}
                          onChange={(e) => setFirstDeliveryDate(e.target.value)}
                          className="w-full h-11 px-4 rounded-xl border border-slate-300 dark:border-white/10 bg-white/70 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-white"
                        />
                      </div>
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
                        {t('club_btn_next_summary')}
                      </button>
                    </div>
                  </div>
                )}

                {activeStep === 3 && (
                  <div className="flex flex-col gap-6">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('club_step_confirm_title')}</h3>
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
                        onClick={() => void handleCheckout(selectedPlanCode)}
                        disabled={Boolean(checkoutLoadingCode)}
                        className="flex-1 rounded-xl bg-primary py-4 font-bold text-white hover:bg-primary/90 disabled:opacity-60 shadow-lg shadow-primary/20 transition-all text-center"
                      >
                        {checkoutLoadingCode === selectedPlanCode ? t('club_btn_activating') : t('club_btn_activate')}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Sağ tərəf: Sifariş Xülasəsi */}
              <div className="flex flex-col gap-7">
                <div className="rounded-3xl border border-white/35 bg-white/45 p-7 backdrop-blur-md dark:bg-slate-900/45 dark:border-white/10">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-5">{t('club_summary_title')}</h3>
                  <div className="flex flex-col gap-3 border-b border-primary/15 pb-5 text-sm">
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
                      <span className="font-bold text-slate-900 dark:text-white">{selectedFrequency}</span>
                    </div>
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
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">{t('club_summary_delivery')}</span>
                      <span className="font-bold text-green-600 uppercase text-xs">{t('club_summary_free')}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-5">
                    <span className="text-lg font-bold text-slate-900 dark:text-white">{t('club_summary_total')}</span>
                    <span className="text-3xl font-black text-primary">
                      {selectedPlanDetails.price} AZN
                    </span>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/35 bg-white/40 p-4 flex items-start gap-3 backdrop-blur-md dark:bg-slate-900/40">
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
