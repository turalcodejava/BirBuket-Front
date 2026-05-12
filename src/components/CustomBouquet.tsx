import { Wrench } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';

export default function CustomBouquet() {
  return (
    <section className="px-6 lg:px-20 py-20 bg-white dark:bg-background-dark">
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        className="max-w-[1440px] mx-auto bg-[#0d1b12] rounded-[64px] overflow-hidden relative"
      >
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary rounded-full blur-[150px] -mr-80 -mt-80"></div>
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-primary rounded-full blur-[120px] -ml-40 -mb-40"></div>
        </div>
        
        <div className="relative z-10 px-8 lg:px-24 py-28 flex flex-col items-center text-center gap-10">
          <div className="bg-primary/20 p-6 rounded-full">
            <Wrench className="text-primary w-12 h-12" />
          </div>
          
          <h2 className="text-4xl lg:text-7xl font-black text-white dark:text-floral-deep-dark tracking-tight max-w-4xl leading-tight">
            Xəyallarınızdakı buketi bizimlə yaradın
          </h2>
          
          <p className="text-white/60 dark:text-floral-muted-dark/60 text-lg lg:text-xl max-w-2xl leading-relaxed">
            Hansı gülləri sevirsiniz? Hansı rəng sizi ifadə edir? Öz zövqünüzə uyğun çiçəkləri seçin, biz peşəkar floristlərimizlə onu sənət əsərinə çevirək.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-6">
            <Link to="/studio">
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-primary text-floral-deep px-12 py-5 rounded-full font-extrabold text-xl shadow-xl shadow-primary/10"
              >
                Buket Konfiquratoruna Başla
              </motion.button>
            </Link>
            <Link to="/collections">
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-transparent border-2 border-white/20 text-white px-12 py-5 rounded-full font-extrabold text-xl hover:bg-white/5 transition-colors"
              >
                Nümunələrə bax
              </motion.button>
            </Link>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
