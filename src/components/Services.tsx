import { ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { categoryService } from '../services/api';
import { Link } from 'react-router-dom';
import BrandLoading from './BrandLoading';
import { useLanguage } from '../context/LanguageContext';

const defaultServices = [
  {
    id: 2,
    title: "Yüklənir...",
    desc: "Məlumatlar API-dan alınır...",
    img: undefined,
    action: "Sifariş ver"
  },
  {
    id: 3,
    title: "Yüklənir...",
    desc: "Məlumatlar API-dan alınır...",
    img: undefined,
    action: "Kolleksiyaya bax"
  },
  {
    id: 4,
    title: "Yüklənir...",
    desc: "Məlumatlar API-dan alınır...",
    img: undefined,
    action: "Məsləhət al"
  }
];

export default function Services() {
  const { t } = useLanguage();
  const [dynamicServices, setDynamicServices] = useState(defaultServices);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategoryData = async () => {
      try {
        setLoading(true);
        // Fetching categories 2, 3, and 4 as requested
        const [res2, res3, res4] = await Promise.all([
          categoryService.getById(2).catch(() => null),
          categoryService.getById(3).catch(() => null),
          categoryService.getById(4).catch(() => null)
        ]);

        setDynamicServices(prev => prev.map(s => {
          if (s.id === 2 && res2?.success) {
            const data2 = res2.data;
            return { ...s, title: data2.title, desc: data2.subtitle || '', img: data2.imageUrl };
          }
          if (s.id === 3 && res3?.success) {
            const data3 = res3.data;
            return { ...s, title: data3.title, desc: data3.subtitle || '', img: data3.imageUrl };
          }
          if (s.id === 4 && res4?.success) {
            const data4 = res4.data;
            return { ...s, title: data4.title, desc: data4.subtitle || '', img: data4.imageUrl };
          }
          return s;
        }));
      } catch (error) {
        console.error("Error fetching categories:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCategoryData();
  }, []);

  return (
    <section id="services" className="px-6 lg:px-20 py-24 bg-white dark:bg-background-dark/80 relative">
      <div className="max-w-[1440px] mx-auto">
        <div className="flex flex-col items-center text-center mb-20 gap-4">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl lg:text-6xl font-black text-[#1a1a1a] dark:text-floral-deep-dark"
          >
            {t('services_title')}
          </motion.h2>
          <p className="text-[#4c9a66] dark:text-floral-muted-dark max-w-2xl text-lg">
            {t('services_subtitle')}
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-10">
          {dynamicServices.map((service, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.15 }}
              className="bg-white dark:bg-white/5 p-6 rounded-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.04)] hover:shadow-[0_30px_60px_rgba(0,0,0,0.08)] transition-all group border border-transparent dark:border-white/5 dark:backdrop-blur-md h-full flex flex-col"
            >
              <div className="aspect-[4/3] rounded-[32px] overflow-hidden mb-8 relative flex-shrink-0">
                <img 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                  src={service.img || undefined} 
                  alt={service.title}
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="flex flex-col flex-1">
                <h3 className="text-2xl font-bold mb-3 text-[#1a1a1a] dark:text-floral-deep-dark">
                  {loading && (service.id === 2 || service.id === 3 || service.id === 4) ? (
                    <BrandLoading compact className="justify-start" />
                  ) : service.title}
                </h3>
                <p className="text-[#4c9a66] dark:text-floral-muted-dark/80 leading-relaxed mb-6 flex-1">{service.desc}</p>
                <div className="mt-auto">
                  <Link to={`/collections?category=${service.id}`}>
                    <button className="flex items-center gap-2 text-primary font-bold group/btn">
                      {service.action}
                      <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
