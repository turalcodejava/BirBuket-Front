import { Bell, Download, DollarSign, Package, Search, Sparkles, TrendingDown, TrendingUp, WandSparkles } from 'lucide-react';
import React from 'react';

const stats = [
  { title: 'Ümumi gəlir', value: '12,450 AZN', icon: DollarSign, delta: '+12.5%', positive: true },
  { title: 'Orta sifariş məbləği', value: '45.00 AZN', icon: Package, delta: '-2.1%', positive: false },
  { title: 'Konstruktor istifadəsi', value: '842 sifariş', icon: WandSparkles, delta: '+22.4%', positive: true },
  { title: 'Dönüşüm nisbəti', value: '3.2%', icon: Sparkles, delta: '+4.2%', positive: true },
];

const topMaterials = [
  { name: 'Kraft Kağız (Təbii)', count: 428, pct: 85, color: 'bg-[#f5e6d3]' },
  { name: 'Mat Qara Premium', count: 312, pct: 62, color: 'bg-[#1a1a1a]' },
  { name: 'Zərif Çəhrayı Tül', count: 285, pct: 56, color: 'bg-[#e8ccd7]' },
  { name: 'Bordo Saten Lent', count: 240, pct: 48, color: 'bg-[#800020]' },
  { name: 'Ağ Mirvari Kağız', count: 195, pct: 39, color: 'bg-[#ffffff]' },
];

const topProducts = [
  { name: 'Qırmızı Qızılgül Buketi (Premium)', category: 'Təbii Güllər', qty: 432, revenue: '2,160 AZN', trend: 'up' },
  { name: 'Ağ Orkide (İkili Gövdə)', category: 'Dibçək Gülləri', qty: 215, revenue: '1,720 AZN', trend: 'up' },
  { name: 'Bahar Qarışığı Aranjiman', category: 'Təbii Güllər', qty: 189, revenue: '1,323 AZN', trend: 'down' },
  { name: 'Hollandiya Lalələri (25 ədəd)', category: 'Təbii Güllər', qty: 154, revenue: '924 AZN', trend: 'up' },
];

export default function AdminDashboard() {
  return (
    <div className="relative isolate min-h-full min-h-[80vh] overflow-x-hidden bg-[#fdfcf0] dark:bg-background-dark p-6 lg:p-8">
      <div className="pointer-events-none select-none space-y-6 opacity-[0.94] blur-md sm:blur-lg">
        <header className="rounded-2xl border border-floral-muted/10 bg-white dark:bg-white/5 px-5 py-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-black">Analitika və Hesabatlar</h2>
            <p className="text-sm text-floral-muted dark:text-white/45 mt-1">Buket konstruktoru və satış analitikası</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-floral-muted/70 dark:text-white/35" />
              <input
                placeholder="Hesabatlarda axtar..."
                className="w-64 max-w-full rounded-xl border border-floral-muted/20 bg-[#f8f7ed] dark:border-white/15 dark:bg-background-dark py-2 pl-9 pr-3 text-sm placeholder:text-floral-muted/60 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <button
              type="button"
              className="w-10 h-10 rounded-xl border border-floral-muted/20 bg-[#f8f7ed] dark:border-white/15 dark:bg-background-dark flex items-center justify-center text-floral-muted hover:text-floral-deep dark:text-white/70 dark:hover:text-white"
            >
              <Bell className="w-4 h-4" />
            </button>
          </div>
        </header>

        <section className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex gap-2 p-1 rounded-xl bg-white border border-floral-muted/10 dark:bg-white/5 dark:border-white/10 w-fit">
            <button type="button" className="px-4 py-2 rounded-lg text-sm font-semibold text-floral-muted dark:text-white/70">Bu gün</button>
            <button type="button" className="px-4 py-2 rounded-lg text-sm font-semibold text-floral-muted dark:text-white/70">Bu həftə</button>
            <button type="button" className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white">Bu ay</button>
            <button type="button" className="px-4 py-2 rounded-lg text-sm font-semibold text-floral-muted dark:text-white/70">Xüsusi aralıq</button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-floral-muted/20 bg-white dark:border-white/15 dark:bg-white/5 px-4 py-2 text-sm font-semibold text-floral-deep dark:text-white/80"
            >
              <Download className="w-4 h-4 text-rose-400" />
              PDF olaraq yüklə
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-floral-muted/20 bg-white dark:border-white/15 dark:bg-white/5 px-4 py-2 text-sm font-semibold text-floral-deep dark:text-white/80"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              Excel olaraq yüklə
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {stats.map((item) => (
            <div key={item.title} className="rounded-2xl border border-floral-muted/10 bg-white dark:bg-white/5 dark:border-white/10 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                  <item.icon className="w-5 h-5" />
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full font-bold ${
                    item.positive ? 'text-emerald-400 bg-emerald-500/15' : 'text-rose-400 bg-rose-500/15'
                  }`}
                >
                  {item.delta}
                </span>
              </div>
              <p className="text-sm text-floral-muted dark:text-white/45">{item.title}</p>
              <p className="text-3xl font-black mt-1">{item.value}</p>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 rounded-2xl border border-floral-muted/10 bg-white dark:bg-white/5 dark:border-white/10 p-6">
            <h3 className="text-xl font-black">Ən çox seçilən materiallar və lentlər</h3>
            <p className="text-xs text-floral-muted dark:text-white/45 mt-1">Xüsusi buket sifarişlərində populyarlıq reytinqi</p>
            <div className="space-y-5 mt-6">
              {topMaterials.map((item) => (
                <div key={item.name}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className={`w-3.5 h-3.5 rounded-full ${item.color} border border-white/20`} />
                      <span className="text-sm font-semibold">{item.name}</span>
                    </div>
                    <span className="text-sm font-bold text-floral-muted dark:text-white/55">{item.count} seçim</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-floral-muted/20 dark:bg-white/20 overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${item.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-floral-muted/10 bg-white dark:bg-white/5 dark:border-white/10 p-6">
            <h3 className="text-xl font-black mb-8">Kateqoriya payı</h3>
            <div className="w-48 h-48 mx-auto rounded-full border-[14px] border-emerald-500 relative flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-[14px] border-primary border-t-transparent border-l-transparent rotate-12" />
              <div className="absolute inset-0 rounded-full border-[14px] border-amber-400 border-t-transparent border-r-transparent border-b-transparent -rotate-45" />
              <div className="text-center">
                <p className="text-4xl font-black">100%</p>
                <p className="text-xs text-floral-muted dark:text-white/45">Satışlar</p>
              </div>
            </div>
            <div className="space-y-3 mt-8">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Təbii Güllər
                </span>
                <span className="font-bold">55%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                  Dibçək Gülləri
                </span>
                <span className="font-bold">30%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  Dekorasiyalar
                </span>
                <span className="font-bold">15%</span>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-floral-muted/10 bg-white dark:bg-white/5 dark:border-white/10 p-6">
          <div className="flex items-center justify-between mb-7">
            <h3 className="text-xl font-black">Gəlir Trendi (Ümumi Gəlir)</h3>
            <select className="rounded-lg border border-floral-muted/20 bg-[#f8f7ed] dark:border-white/15 dark:bg-background-dark px-3 py-1.5 text-xs">
              <option>Aylıq</option>
              <option>Həftəlik</option>
            </select>
          </div>
          <div className="h-56 flex items-end gap-2">
            {[40, 55, 45, 75, 60, 90, 80].map((h, idx) => (
              <div
                key={idx}
                className="flex-1 rounded-t-lg bg-primary/25 hover:bg-primary transition-colors"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between mt-4 text-[10px] font-bold uppercase tracking-wider text-floral-muted dark:text-white/40">
            <span>Yan</span>
            <span>Fev</span>
            <span>Mar</span>
            <span>Apr</span>
            <span>May</span>
            <span>İyun</span>
            <span>İyul</span>
          </div>
        </section>

        <section className="rounded-2xl border border-floral-muted/10 bg-white dark:bg-white/5 dark:border-white/10 overflow-hidden">
          <div className="px-6 py-4 border-b border-floral-muted/10 dark:border-white/10 flex items-center justify-between">
            <h3 className="text-xl font-black">Ən çox satılan məhsullar</h3>
            <button type="button" className="text-primary text-sm font-bold hover:underline">
              Hamısına bax
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="bg-[#f8f7ed] dark:bg-background-dark">
                <tr className="text-left text-xs uppercase tracking-wider text-floral-muted dark:text-white/45">
                  <th className="px-6 py-4">Məhsul adı</th>
                  <th className="px-6 py-4">Kateqoriya</th>
                  <th className="px-6 py-4 text-center">Satış sayı</th>
                  <th className="px-6 py-4 text-right">Ümumi gəlir</th>
                  <th className="px-6 py-4 text-center">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-floral-muted/10 dark:divide-white/10">
                {topProducts.map((item) => (
                  <tr key={item.name} className="hover:bg-primary/5 transition-colors">
                    <td className="px-6 py-4 font-semibold">{item.name}</td>
                    <td className="px-6 py-4 text-floral-muted dark:text-white/70 text-sm">{item.category}</td>
                    <td className="px-6 py-4 text-center font-medium">{item.qty} ədəd</td>
                    <td className="px-6 py-4 text-right font-bold">{item.revenue}</td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        {item.trend === 'up' ? (
                          <TrendingUp className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-rose-400" />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Yan panel ~260px: overlay yalnız əsas sahəni örtür; fixed + yüksək z-index həmişə üstdə görünsün */}
      <div
        className="fixed inset-0 top-0 z-[500] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm dark:bg-black/55 lg:inset-auto lg:left-[260px] lg:right-0 lg:top-0 lg:bottom-0"
      >
        <div
          role="dialog"
          aria-labelledby="dash-soon-title"
          aria-describedby="dash-soon-desc"
          className="relative z-[501] mx-auto max-w-[min(100%,380px)] rounded-3xl border-2 border-black/10 bg-white px-7 py-8 text-center shadow-2xl dark:border-white/25 dark:bg-slate-900"
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-primary/25 dark:text-primary">
            <Sparkles className="h-7 w-7 shrink-0" aria-hidden />
          </div>
          <p id="dash-soon-title" className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white">
            Admin Dashboard
          </p>
          <p className="mt-3 text-base font-black uppercase tracking-[0.35em] text-emerald-600 dark:text-primary">
            Coming Soon
          </p>
          <p className="mt-4 text-[15px] font-bold text-neutral-700 dark:text-white/85">Tezliklə aktiv olacaq.</p>
          <p id="dash-soon-desc" className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-white/65">
            Analitika və hesabat bölməsi üzərində iş gedir — hazır olan funksiyalar menyudan seçilə bilər.
          </p>
        </div>
      </div>
    </div>
  );
}
