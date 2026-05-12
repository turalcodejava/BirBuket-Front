import { HeartHandshake, Leaf, Truck, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

const highlights = [
  {
    icon: Leaf,
    title: 'Təzə güllər',
    description: 'Kompozisiyalar gündəlik seçilən təzə güllərlə hazırlanır.',
  },
  {
    icon: Truck,
    title: 'Sürətli çatdırılma',
    description:
      'Bakı daxili çatdırılma: məsafəyə görə 5–20 AZN (4 km-ə qədər 5 AZN; 15 km-dən çox 20 AZN). Vaxtında və təhlükəsiz çatdırılma.',
  },
  {
    icon: HeartHandshake,
    title: 'Fərdi yanaşma',
    description: 'Hər buket istəyinizə uyğun zövqlə formalaşdırılır.',
  },
  {
    icon: ShieldCheck,
    title: 'Etibarlı xidmət',
    description: 'Sifarişdən təhvila qədər hər addımda şəffaf proses.',
  },
];

export default function About() {
  return (
    <div className="bg-[#fdfcf0] dark:bg-background-dark min-h-screen">
      <main className="max-w-[1440px] mx-auto px-6 lg:px-20 py-12 lg:py-16">
        <section className="rounded-[36px] border border-floral-muted/10 bg-white dark:bg-white/5 p-8 lg:p-12">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Haqqımızda</p>
          <h1 className="mt-3 text-4xl lg:text-5xl font-black text-floral-deep dark:text-floral-deep-dark">
            BirBuket - hisslərin ən zərif ifadəsi
          </h1>
          <p className="mt-5 max-w-3xl text-floral-muted dark:text-floral-muted-dark leading-relaxed">
            BirBuket olaraq məqsədimiz sevdiklərinizə çatacaq hər buketi xüsusi etməkdir.
            Platformamız vasitəsilə siz həm sürətli sifariş verə, həm də sifarişinizin çatdırılma
            mərhələsini rahat izləyə bilərsiniz.
          </p>
        </section>

        <section className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {highlights.map((item) => {
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
            Nəyə görə bizi seçirlər?
          </h2>
          <ul className="mt-5 space-y-3 text-floral-muted dark:text-floral-muted-dark">
            <li>- Geniş buket çeşidləri və fərdi dizayn imkanı</li>
            <li>- Rahat ödəniş və sadə sifariş prosesi</li>
            <li>- Müştəri məmnuniyyətinə fokuslanan dəstək xidməti</li>
          </ul>
          <div className="mt-7">
            <Link
              to="/collections"
              className="inline-flex items-center rounded-2xl bg-primary px-6 py-3 font-black text-floral-deep hover:opacity-90 transition-opacity"
            >
              Kolleksiyaya bax
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
