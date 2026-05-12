import { BadgeCheck, ShoppingBasket, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';

export default function Hero() {
  return (
    <section className="px-6 lg:px-20 py-12 lg:py-24 bg-white dark:bg-background-dark overflow-hidden relative">
      {/* Dark mode specific glow */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none hidden dark:block -mr-40 -mt-40"></div>
      
      <div className="max-w-[1440px] mx-auto grid lg:grid-cols-[45%_auto] gap-16 items-center relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-col gap-8"
        >
          <div className="inline-flex items-center gap-2 bg-[#e8fded] dark:bg-primary/10 text-[#4c9a66] dark:text-primary px-4 py-1.5 rounded-full w-fit">
            <BadgeCheck className="w-4 h-4" />
            <span className="text-[11px] font-bold uppercase tracking-wider">Premium Çiçək Xidməti</span>
          </div>
          
          <h1 className="text-5xl lg:text-8xl font-black leading-[1.05] tracking-tight text-[#1a1a1a] dark:text-floral-deep-dark">
            Hər Çiçəkdə <span className="text-primary italic">Bir Hekayə</span> Var
          </h1>
          
          <p className="text-lg lg:text-xl text-[#4c9a66] dark:text-floral-muted-dark max-w-xl leading-relaxed">
            Təbii güllər, estetik dibçək bitkiləri və unudulmaz tədbirləriniz üçün xüsusi dizayn edilmiş dekorasiyalar. Sizin sevginizi çiçəklərlə ifadə edirik.
          </p>
          
          <div className="flex flex-wrap gap-4 pt-4">
            <Link to="/collections">
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="bg-primary text-floral-deep px-8 py-4 rounded-full font-bold text-lg flex items-center gap-3 shadow-lg shadow-primary/20"
              >
                <div className="bg-floral-deep/10 p-1.5 rounded-full">
                  <ShoppingBasket className="w-5 h-5" />
                </div>
                İndi sifariş et
              </motion.button>
            </Link>
            <Link to="/collections">
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="bg-[#f8f9f8] dark:bg-slate-800 text-floral-deep dark:text-white border border-black/5 dark:border-white/5 px-8 py-4 rounded-full font-bold text-lg"
              >
                Kolleksiyalara bax
              </motion.button>
            </Link>
          </div>
          
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="relative justify-self-end"
        >
          <div className="w-full max-w-[600px] aspect-[1/1.1] rounded-[48px] overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.12)]">
            <img 
              className="w-full h-full object-cover" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAVeTd2Xo2UXUw8ZFknjhX6B_NilOVtK7_DPy8zsg0cQHUJA1M29VGKrwgXhEU4y7APaSSDG9_xNSJ8UqJ7QpIkYFw7yLrEE3KLZf7VsRGPjHZIuzZP9fkMcQHQws311Gz6beN8tNsTb2Ku6XnO7JB2ecRTU8-E1q8Dy4a99UVsEtWfEBpZorbKHFIrpZwVJVv7Xakw7I-xfSJGqNLp4-SHCJ4dhLz83I8vnfbHxfNCkGVptgQnXknHaml3rQ93W_olZN9GzT_g2YmC" 
              alt="Premium floral arrangement"
              referrerPolicy="no-referrer"
            />
          </div>
          <motion.div 
            initial={{ x: -20, opacity: 0 }}
            whileInView={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="absolute bottom-10 -left-12 bg-white dark:bg-slate-800 p-8 rounded-[32px] shadow-[0_20px_40px_rgba(0,0,0,0.06)] border border-primary/5 max-w-[280px]"
          >
            <p className="text-primary font-black text-3xl leading-none mb-2">45+ növ</p>
            <p className="text-sm font-semibold text-[#4c9a66] leading-snug">Təzə kəsilmiş gül növləri hər gün anbarda</p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
