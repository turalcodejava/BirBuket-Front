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
  const navigate = useNavigate();
  const { token } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [mySubscription, setMySubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoadingCode, setCheckoutLoadingCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

      if (token) {
        try {
          const meRes = await authService.getMySubscription();
          if (!cancelled) setMySubscription(meRes);
        } catch {
          if (!cancelled) setMySubscription(null);
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

  const normalizedPlans = useMemo(() => {
    if (plans.length > 0) return plans;
    return [
      { code: 'MONTHLY', discountPercent: 0, periodMonths: 1 },
      { code: 'QUARTERLY', discountPercent: 10, periodMonths: 3 },
      { code: 'SEMI_ANNUAL', discountPercent: 15, periodMonths: 6 },
      { code: 'ANNUAL', discountPercent: 20, periodMonths: 12 },
    ];
  }, [plans]);

  const prettyPlanName = (code: string) => {
    const key = String(code || '').toUpperCase();
    if (key === 'MONTHLY') return 'Aylıq';
    if (key === 'QUARTERLY') return 'Rüblük';
    if (key === 'SEMI_ANNUAL') return 'Yarımillik';
    if (key === 'ANNUAL') return 'İllik';
    return key || 'Plan';
  };

  const handleCheckout = async (planCode: string) => {
    if (!token) {
      navigate('/login');
      return;
    }
    setCheckoutLoadingCode(planCode);
    setError(null);
    setSuccess(null);
    try {
      await authService.checkoutSubscription({ planCode });
      const meRes = await authService.getMySubscription();
      setMySubscription(meRes);
      setSuccess('BirBuketClub abunəliyiniz uğurla aktiv edildi.');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Abunə aktiv edilə bilmədi.';
      setError(msg);
    } finally {
      setCheckoutLoadingCode(null);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Arxa plan — bəyaq düzəltdiyimiz səhifə; gül görünsün */}
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

      {/* Arxa tərəfdə tam səhifə — bulanıq; ön tərəfdə "tezliklə" kartı */}
      <div className="relative z-10 min-h-screen">
        <div
          className="pointer-events-none select-none scale-[1.02] [&_*]:pointer-events-none [filter:blur(6px)] sm:[filter:blur(7px)]"
          aria-hidden
        >
        <section className="px-6 lg:px-20 py-10">
          <div className="max-w-[1200px] mx-auto rounded-3xl border border-white/40 bg-white/55 dark:bg-slate-900/40 backdrop-blur-lg px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 text-primary">
                  <Sparkles className="w-6 h-6" />
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">BirBuketClub</h2>
                </div>
                <div className="hidden md:flex items-center gap-5 text-sm">
                  <span className="font-semibold text-primary">Abunəliklər</span>
                  <span className="text-slate-600 dark:text-slate-300">Güllər</span>
                  <span className="text-slate-600 dark:text-slate-300">Hədiyyələr</span>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-primary/70 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Axtar..."
                    className="h-9 w-44 rounded-lg border-none bg-white/50 dark:bg-white/10 pl-9 pr-3 text-sm focus:ring-2 focus:ring-primary/20 dark:text-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white"
                >
                  Giriş
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
                <span className="text-xs font-bold uppercase tracking-wider">Premium Xidmət</span>
              </div>
              <h1 className="text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight text-slate-900 dark:text-white drop-shadow-sm">
                Evinizə Həmişə <span className="text-primary">Təravət</span> Gəlsin
              </h1>
              <p className="text-lg leading-relaxed text-slate-700 dark:text-slate-300">
                Gül abunəliyi ilə hər həftə və ya hər ay qapınıza gələn təzə çiçəklərin sevincini yaşayın.
              </p>
              <div className="flex flex-wrap gap-4">
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById('club-plans')?.scrollIntoView({ behavior: 'smooth' })
                  }
                  className="rounded-xl bg-primary px-8 py-4 text-base font-bold text-white shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  İndi Başla
                </button>
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById('club-plans')?.scrollIntoView({ behavior: 'smooth' })
                  }
                  className="rounded-xl border-2 border-primary/30 bg-white/50 px-8 py-4 text-base font-bold text-primary backdrop-blur-sm hover:bg-white/70 dark:bg-white/10 dark:hover:bg-white/15"
                >
                  Planları Gör
                </button>
              </div>
              {mySubscription && (
                <p className="text-sm font-bold text-green-700 dark:text-green-400">
                  Aktiv plan: {prettyPlanName(String(mySubscription?.planCode || mySubscription?.code || ''))}
                </p>
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
                    <p className="text-xs font-bold text-slate-900 dark:text-white">1200+ Abunəçi</p>
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
                Abunəlik Planları
              </h2>
              <p className="mt-2 text-slate-700 dark:text-slate-300">Ehtiyacınıza uyğun olanı seçin</p>
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
                  Planlar yüklənir...
                </div>
              ) : (
                normalizedPlans.map((plan, idx) => {
                  const isPopular = String(plan.code).toUpperCase() === 'QUARTERLY';
                  return (
                    <div
                      key={plan.code}
                      className={`relative flex flex-col rounded-3xl border p-7 shadow-md backdrop-blur-md transition-all ${
                        isPopular
                          ? 'border-2 border-primary bg-white/85 dark:bg-slate-900/80 shadow-xl'
                          : 'border-white/40 bg-white/70 hover:border-primary/40 dark:border-white/10 dark:bg-slate-900/65'
                      } ${idx === 1 ? 'xl:scale-105 xl:z-10' : ''}`}
                    >
                      {isPopular && (
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-bold text-white uppercase tracking-widest">
                          Populyar
                        </div>
                      )}
                      <div className="mb-5">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                          {plan.name || prettyPlanName(plan.code)}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">BirBuketClub üzvlük planı</p>
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
                        onClick={() => void handleCheckout(plan.code)}
                        disabled={Boolean(checkoutLoadingCode)}
                        className={`mt-auto w-full rounded-xl py-3 font-bold transition-all ${
                          isPopular
                            ? 'bg-primary text-white hover:bg-primary/90'
                            : 'bg-primary/15 text-primary hover:bg-primary hover:text-white'
                        } disabled:opacity-60`}
                      >
                        {checkoutLoadingCode === plan.code ? 'Aktiv edilir...' : 'Seç'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className="rounded-[2.2rem] border border-white/35 bg-white/55 p-8 lg:p-10 shadow-lg backdrop-blur-lg dark:bg-slate-900/50 dark:border-white/10">
            <div className="mb-10 text-center">
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Abunəliyinizi Qurun</h2>
              <p className="mt-2 text-slate-600 dark:text-slate-400">Cəmi 4 asan addımla</p>
            </div>

            <div className="mx-auto mb-12 max-w-4xl">
              <div className="flex justify-between items-center relative">
                {['Üslub', 'Tezlik', 'Məlumat', 'Tarixlər'].map((step, idx) => (
                  <div key={step} className="flex flex-col items-center gap-2 z-10">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-full font-bold ${
                        idx === 0 ? 'bg-primary text-white ring-8 ring-primary/20' : 'bg-primary/15 text-primary'
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <span className={`text-xs font-bold ${idx === 0 ? 'text-primary' : 'text-slate-400'}`}>
                      {step}
                    </span>
                  </div>
                ))}
                <div className="absolute top-5 left-0 h-0.5 w-full bg-white/60 dark:bg-slate-700 -z-0" />
                <div className="absolute top-5 left-0 h-0.5 w-1/3 bg-primary -z-0" />
              </div>
            </div>

            <div className="grid gap-10 lg:grid-cols-2">
              <div className="flex flex-col gap-7 rounded-2xl border border-white/30 bg-white/40 p-6 backdrop-blur-md dark:bg-slate-900/40 dark:border-white/10">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">1. Buket Üslubunu Seçin</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {['Modern & Minimal', 'Klassik Romantik', 'Vəhşi Təbiət', 'Mövsüm Sürprizi'].map((t, i) => (
                      <label
                        key={t}
                        className={`relative flex cursor-pointer flex-col gap-2 rounded-2xl border-2 p-4 ${
                          i === 0 ? 'border-primary bg-primary/10' : 'border-white/50 bg-white/30 hover:border-primary/30 dark:border-white/10 dark:bg-white/5'
                        }`}
                      >
                        <input
                          type="radio"
                          name="style"
                          className="absolute top-3 right-3 text-primary focus:ring-primary"
                          defaultChecked={i === 0}
                        />
                        <Gift className="w-8 h-8 text-primary" />
                        <span className="font-bold text-slate-900 dark:text-white text-sm">{t}</span>
                        <span className="text-xs text-slate-600 dark:text-slate-400 leading-tight">
                          Florist komandamız tərəfindən hazırlanır.
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">2. Çatdırılma Tezliyi</h3>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      className="flex-1 rounded-xl bg-white/60 dark:bg-slate-800 py-3 text-sm font-bold text-slate-600 dark:text-slate-400 backdrop-blur-sm"
                    >
                      Hər Həftə
                    </button>
                    <button type="button" className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-white">
                      2 Həftədən Bir
                    </button>
                    <button
                      type="button"
                      className="flex-1 rounded-xl bg-white/60 dark:bg-slate-800 py-3 text-sm font-bold text-slate-600 dark:text-slate-400 backdrop-blur-sm"
                    >
                      Ayda Bir
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-7">
                <div className="rounded-3xl border border-white/35 bg-white/45 p-7 backdrop-blur-md dark:bg-slate-900/45 dark:border-white/10">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-5">Sifariş Xülasəsi</h3>
                  <div className="flex flex-col gap-3 border-b border-primary/15 pb-5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Plan:</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {mySubscription
                          ? prettyPlanName(String(mySubscription?.planCode || mySubscription?.code || ''))
                          : 'Mövsümi (Rüblük)'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Üslub:</span>
                      <span className="font-bold text-slate-900 dark:text-white">Modern & Minimal</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Tezlik:</span>
                      <span className="font-bold text-slate-900 dark:text-white">2 Həftədən Bir</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Çatdırılma:</span>
                      <span className="font-bold text-green-600 uppercase text-xs">Pulsuz</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-5">
                    <span className="text-lg font-bold text-slate-900 dark:text-white">Toplam:</span>
                    <span className="text-3xl font-black text-primary">
                      {typeof normalizedPlans[0]?.price === 'number' ? `${normalizedPlans[0].price} AZN` : '—'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="mt-7 w-full rounded-2xl bg-slate-900 py-4 font-bold text-white shadow-xl hover:bg-slate-800 transition-all dark:bg-primary dark:text-[#0d1b12]"
                  >
                    Növbəti Addım
                  </button>
                </div>
                <div className="rounded-2xl border border-white/35 bg-white/40 p-4 flex items-start gap-3 backdrop-blur-md dark:bg-slate-900/40">
                  <ShieldCheck className="w-5 h-5 mt-0.5 text-primary shrink-0" />
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Ödənişləriniz təhlükəsizdir. İstənilən vaxt planı dəyişə və ya dayandıra bilərsiniz.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/35 bg-white/35 p-4 grid grid-cols-2 gap-3 text-xs text-slate-600 dark:text-slate-300 backdrop-blur-md dark:bg-slate-900/35">
                  <div className="flex items-center gap-2">
                    <Clock3 className="w-4 h-4 text-primary" /> Çatdırılma vaxtı seçimi
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" /> Ünvana fərdi marşrut
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
        </div>

        <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center p-5 sm:p-8">
          <div
            role="dialog"
            aria-labelledby="club-soon-title"
            aria-describedby="club-soon-desc"
            className="pointer-events-auto relative w-full max-w-md overflow-hidden rounded-3xl border border-white/70 bg-white/92 p-8 shadow-[0_25px_80px_-20px_rgba(0,0,0,0.35)] backdrop-blur-xl dark:border-white/20 dark:bg-slate-950/88 sm:p-10"
          >
            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/15 blur-3xl" aria-hidden />
            <div className="relative">
              <div className="mb-6 flex justify-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-gradient-to-r from-primary/10 to-emerald-500/10 px-4 py-1.5 shadow-sm">
                  <Sparkles className="h-4 w-4 text-primary" aria-hidden />
                  <span className="bg-gradient-to-r from-primary to-emerald-600 bg-clip-text text-[11px] font-black uppercase tracking-[0.2em] text-transparent">
                    BirBuketClub
                  </span>
                </div>
              </div>
              <h2
                id="club-soon-title"
                className="text-center text-[clamp(2rem,8vw,2.75rem)] font-black uppercase leading-none tracking-[0.12em] text-slate-900 dark:text-white"
              >
                <span className="block bg-gradient-to-br from-primary via-emerald-600 to-teal-600 bg-clip-text text-transparent drop-shadow-sm">
                  Coming
                </span>
                <span className="mt-1 block bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 bg-clip-text text-transparent dark:from-white dark:via-slate-100 dark:to-slate-300">
                  soon
                </span>
              </h2>
              <p className="mt-5 text-center font-medium italic text-primary/90 dark:text-primary/80">Yaxın müddətdə aktiv olacaq ✨</p>
              <p
                id="club-soon-desc"
                className="mx-auto mt-3 max-w-sm text-center text-sm leading-relaxed text-slate-600 dark:text-slate-400"
              >
                Abunəlik və klub təcrübəsi üzərində işləyirik. İndi isə bütün çiçəkləriniz üçün mağaza tam işləkdir — gözləməyə dəyməz.
              </p>
            <div className="mt-7 rounded-2xl border border-slate-200/80 bg-white/60 p-5 dark:border-white/10 dark:bg-white/5">
              <p className="text-center text-xs font-bold uppercase tracking-widest text-primary">Arxa planda hazırlanır</p>
              <ul className="mt-4 space-y-3 text-sm text-slate-700 dark:text-slate-200">
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span>Abunəlik planları və ödəniş axını</span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span>Şəxsi çatdırılma təqvimi</span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span>Üzv üstünlükləri və endirimlər</span>
                </li>
              </ul>
            </div>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => navigate('/collections')}
                className="w-full rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-md transition hover:bg-primary/90 sm:w-auto sm:min-w-[160px]"
              >
                Kolleksiyaya bax
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="w-full rounded-xl border-2 border-slate-300/90 bg-white/80 px-5 py-3 text-sm font-bold text-slate-800 backdrop-blur-sm transition hover:bg-white dark:border-white/25 dark:bg-slate-900/70 dark:text-white sm:w-auto sm:min-w-[160px]"
              >
                Ana səhifə
              </button>
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
