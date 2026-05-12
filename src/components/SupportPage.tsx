import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ExternalLink, Mail, Phone } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import DeliveryTariffsInfo from './DeliveryTariffsInfo';

const faqItems = [
  {
    q: 'Güllər neçə saat ərzində çatdırılır?',
    a: 'Bakı daxili sifarişlər adətən 2-4 saat ərzində çatdırılır. Pik saatlarda müddət bir qədər arta bilər.',
  },
  {
    q: 'Canlı izləmə linki necə işləyir?',
    a: 'Sifariş kuryerə təhvil veriləndən sonra “Çatdırılmanı canlı izlə” linki aktiv olur və xəritədə statusu görürsünüz.',
  },
  {
    q: 'Sifarişdə kart mesajı və qeyd əlavə etmək olar?',
    a: 'Bəli, checkout zamanı xüsusi qeyd bölməsinə mesajınızı əlavə edə bilərsiniz.',
  },
  {
    q: 'Həmin gün üçün sifariş qəbul olunur?',
    a: 'Bəli, stok və saat aralığı uyğun olduqda sifariş verilən gün, yəni həmin an üçün çatdırılma mümkündür.',
  },
];

type SupportSection = 'suallar' | 'catdirilma' | 'qaytarilma' | 'elaqe';

const SUPPORT_SECTIONS: readonly SupportSection[] = ['suallar', 'catdirilma', 'qaytarilma', 'elaqe'];

function readHashSection(): SupportSection {
  if (typeof window === 'undefined') return 'suallar';
  const h = String(window.location.hash || '').replace('#', '').trim();
  return SUPPORT_SECTIONS.includes(h as SupportSection) ? (h as SupportSection) : 'suallar';
}

export default function SupportPage() {
  const { hash } = useLocation();
  const normalizedHash = useMemo(() => String(hash || '').replace('#', '').trim(), [hash]);
  const [openSection, setOpenSection] = useState<SupportSection>(readHashSection);

  useEffect(() => {
    if (
      normalizedHash === 'suallar' ||
      normalizedHash === 'catdirilma' ||
      normalizedHash === 'qaytarilma' ||
      normalizedHash === 'elaqe'
    ) {
      setOpenSection(normalizedHash);
      const id = window.setTimeout(() => {
        document.getElementById(normalizedHash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 40);
      return () => window.clearTimeout(id);
    }
    return;
  }, [normalizedHash]);

  return (
    <div className="min-h-screen bg-[#fdfcf0] px-6 py-10 lg:px-20 dark:bg-background-dark">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-3xl border border-floral-muted/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
          <h1 className="text-3xl font-black text-floral-deep dark:text-white">Dəstək Mərkəzi</h1>
          <p className="mt-2 text-sm text-floral-muted dark:text-white/65">
            Sayt, sifariş və çatdırılma ilə bağlı ən çox verilən suallar və vacib qaydalar.
          </p>
        </section>

        <details id="suallar" open={openSection === 'suallar'} className="group rounded-3xl border border-floral-muted/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
          <summary onClick={(e) => { e.preventDefault(); setOpenSection((p) => (p === 'suallar' ? p : 'suallar')); }} className="flex cursor-pointer list-none items-center justify-between text-xl font-black text-floral-deep dark:text-white">
            Ən çox verilən suallar
            <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-4 space-y-3">
            {faqItems.map((item, idx) => (
              <details key={item.q} open={idx === 0} className="group/faq rounded-2xl border border-floral-muted/10 bg-[#fcfbf6] p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-black text-floral-deep dark:text-white">
                  {item.q}
                  <ChevronDown className="h-4 w-4 transition-transform group-open/faq:rotate-180" />
                </summary>
                <p className="mt-2 text-sm text-floral-muted dark:text-white/70">{item.a}</p>
              </details>
            ))}
          </div>
        </details>

        <details id="catdirilma" open={openSection === 'catdirilma'} className="group rounded-3xl border border-floral-muted/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
          <summary onClick={(e) => { e.preventDefault(); setOpenSection((p) => (p === 'catdirilma' ? p : 'catdirilma')); }} className="flex cursor-pointer list-none items-center justify-between text-xl font-black text-floral-deep dark:text-white">
            Çatdırılma qaydaları
            <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-3 space-y-3 text-sm text-floral-muted dark:text-white/70">
            <DeliveryTariffsInfo
              className="rounded-2xl border border-floral-muted/15 bg-[#fcfbf6] p-4 dark:border-white/10 dark:bg-white/[0.04]"
              titleClassName="font-black text-floral-deep dark:text-white"
              lineClassName="text-sm text-floral-muted dark:text-white/75"
            />
            <figure className="overflow-hidden rounded-2xl border border-floral-muted/15 shadow-md ring-1 ring-black/[0.04] dark:border-white/10 dark:ring-white/10">
              <img
                src="/catdirilma-premium-delivery.png"
                alt="BirBuket premium çatdırılma — diqqətlə paketlənmiş buketlərlə şəhər içi çatdırılma"
                className="aspect-[21/10] w-full object-cover object-center sm:aspect-[2.4/1]"
                loading="lazy"
                decoding="async"
              />
              <figcaption className="sr-only">
                Çiçək mağazası qarşısında premium avtomobil və BirBuket brendi ilə çatdırılma vizualı
              </figcaption>
            </figure>
            <p>- Çatdırılma Bakı şəhəri üzrə həyata keçirilir; qiymət göstərilən məsafə zonalarına görədir.</p>
            <p>- Həmin gün çatdırılma stok və saat aralığı uyğun olduqda mümkündür.</p>
            <p>- Kuryer çatdırılmadan əvvəl əlaqə nömrəsi ilə müştəriyə zəng edə bilər.</p>
            <p>- Ünvan düzgün qeyd edilmədikdə gecikmə yarana bilər.</p>
          </div>
        </details>

        <details id="qaytarilma" open={openSection === 'qaytarilma'} className="group rounded-3xl border border-floral-muted/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
          <summary onClick={(e) => { e.preventDefault(); setOpenSection((p) => (p === 'qaytarilma' ? p : 'qaytarilma')); }} className="flex cursor-pointer list-none items-center justify-between text-xl font-black text-floral-deep dark:text-white">
            Geri qaytarılma
            <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-3 space-y-2 text-sm text-floral-muted dark:text-white/70">
            <p>- Təzə gül məhsulları gigiyena səbəbilə ümumi qaydada geri qaytarılmır.</p>
            <p>- Məhsul zədəlidirsə və ya sifarişlə uyğun deyilsə, 24 saat ərzində dəstəyə müraciət edin.</p>
            <p>- Təsdiq olunduğu halda məhsul dəyişimi və ya qismən/tam geri ödəniş tətbiq oluna bilər.</p>
            <p>- Müraciət zamanı sifariş nömrəsi və foto sübut təqdim olunmalıdır.</p>
          </div>
        </details>

        <details id="elaqe" open={openSection === 'elaqe'} className="group rounded-3xl border border-floral-muted/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
          <summary onClick={(e) => { e.preventDefault(); setOpenSection((p) => (p === 'elaqe' ? p : 'elaqe')); }} className="flex cursor-pointer list-none items-center justify-between text-xl font-black text-floral-deep dark:text-white">
            Əlaqə
            <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-4 space-y-3 text-sm">
            <p className="flex items-center gap-2 text-floral-muted dark:text-white/70">
              <Mail className="h-4 w-4 text-primary" />
              <a className="font-semibold hover:underline" href="mailto:birbuket.az@gmail.com">birbuket.az@gmail.com</a>
            </p>
            <p className="flex items-center gap-2 text-floral-muted dark:text-white/70">
              <Phone className="h-4 w-4 text-primary" />
              <a className="font-semibold hover:underline" href="tel:+994518468551">+994 51 846 85 51</a>
            </p>
            <p className="text-floral-muted dark:text-white/70">
              Instagram:{' '}
              <a
                href="https://www.instagram.com/birbuket.az?igsh=MWJyMmg2NnY5bndxMA%3D%3D&utm_source=qr"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
              >
                @birbuket.az <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </p>
            <p className="text-floral-muted dark:text-white/70">
              Facebook:{' '}
              <a
                href="https://www.facebook.com/birbuket.az"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
              >
                facebook.com/birbuket.az <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}
