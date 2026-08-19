import { HeartHandshake, Leaf, Truck, ShieldCheck, FileText, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

const highlights = (t: any) => [
  {
    icon: Leaf,
    title: t('hl_title_1'),
    description: t('hl_desc_1'),
  },
  {
    icon: Truck,
    title: t('hl_title_2'),
    description: t('hl_desc_2'),
  },
  {
    icon: HeartHandshake,
    title: t('hl_title_3'),
    description: t('hl_desc_3'),
  },
  {
    icon: ShieldCheck,
    title: t('hl_title_4'),
    description: t('hl_desc_4'),
  },
];

export default function About() {
  const { t } = useLanguage();
  return (
    <div className="bg-[#fdfcf0] dark:bg-background-dark min-h-screen">
      <main className="max-w-[1440px] mx-auto px-6 lg:px-20 py-12 lg:py-16">
        <section className="rounded-[36px] border border-floral-muted/10 bg-white dark:bg-white/5 p-8 lg:p-12">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">{t('about')}</p>
          <h1 className="mt-3 text-4xl lg:text-5xl font-black text-floral-deep dark:text-floral-deep-dark">
            {t('about_title')}
          </h1>
          <p className="mt-5 max-w-3xl text-floral-muted dark:text-floral-muted-dark leading-relaxed">
            {t('about_desc')}
          </p>
        </section>

        <section className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {highlights(t).map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="rounded-3xl border border-floral-muted/10 bg-white dark:bg-white/5 p-5"
              >
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="mt-4 text-lg font-black text-floral-deep dark:text-floral-deep-dark">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-floral-muted dark:text-floral-muted-dark leading-relaxed">
                  {item.description}
                </p>
              </article>
            );
          })}
        </section>

        <section className="mt-8 rounded-[36px] border border-floral-muted/10 bg-white dark:bg-white/5 p-8 lg:p-12">
          <h2 className="text-2xl lg:text-3xl font-black text-floral-deep dark:text-floral-deep-dark">
            {t('why_choose_us')}
          </h2>
          <ul className="mt-5 space-y-3 text-floral-muted dark:text-floral-muted-dark">
            <li>{t('why_choose_li_1')}</li>
            <li>{t('why_choose_li_2')}</li>
            <li>{t('why_choose_li_3')}</li>
          </ul>
          <div className="mt-7">
            <Link
              to="/collections"
              className="inline-flex items-center rounded-2xl bg-primary px-6 py-3 font-black text-floral-deep hover:opacity-90 transition-opacity"
            >
              {t('view_collections')}
            </Link>
          </div>
        </section>

        <section className="mt-8 rounded-[36px] border border-floral-muted/10 bg-white dark:bg-white/5 p-8 lg:p-12">
          <h2 className="text-2xl lg:text-3xl font-black text-floral-deep dark:text-floral-deep-dark">
            Hüquqi Məlumatlar
          </h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-floral-muted dark:text-floral-muted-dark">
            <div className="p-6 rounded-3xl bg-floral-muted/5 dark:bg-white/5 border border-floral-muted/10 flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase text-primary tracking-widest block mb-1">VÖEN</span>
                <p className="text-lg font-black text-floral-deep dark:text-floral-deep-dark">1602142502</p>
              </div>
            </div>
            <div className="p-6 rounded-3xl bg-floral-muted/5 dark:bg-white/5 border border-floral-muted/10 flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase text-primary tracking-widest block mb-1">Faktiki Ünvan</span>
                <p className="text-sm font-semibold text-floral-deep dark:text-floral-deep-dark leading-relaxed">
                  Bakı şəhəri, Nizami rayonu, Mirzə Xəlil Şərifli ev 1-2, m.11
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
