import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Car, 
  Sparkles, 
  ArrowLeft,
  Info,
  Clock,
  Heart,
  Calendar,
  Layers
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function BirToy() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-[#040f09] text-[#e2ede6] font-sans pb-16 relative flex flex-col justify-center">
      {/* Background Graphic elements */}
      <div 
        className="absolute inset-0 bg-cover bg-no-repeat bg-fixed pointer-events-none opacity-20"
        style={{ backgroundImage: "url('/gardener-bg.jpg')", backgroundPosition: 'center' }}
      />
      {/* Soft overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#040f09] via-[#040f09]/80 to-transparent pointer-events-none" />

      <main className="mx-auto max-w-[800px] px-6 py-12 relative z-10 text-center space-y-10">
        
        {/* Teaser Icon */}
        <div className="relative inline-flex items-center justify-center">
          <div className="w-24 h-24 bg-primary/10 text-primary border border-primary/20 rounded-full flex items-center justify-center shadow-2xl shadow-primary/10">
            <Car className="w-12 h-12 animate-pulse" />
          </div>
          <span className="absolute -top-1.5 -right-1.5 bg-primary text-[#0d1b12] text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1 shadow-md">
            <Clock className="w-3 h-3" />
            Tezliklə
          </span>
        </div>

        {/* Title */}
        <div className="space-y-4">
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-[#051c0f]">
            BirToy <span className="text-primary text-2xl md:text-3xl font-extrabold block md:inline-block md:ml-2">Studiyası</span>
          </h1>
          <p className="text-[#051c0f]/80 font-semibold text-base md:text-lg max-w-xl mx-auto leading-relaxed">
            Toy, nişan və xüsusi tədbirləriniz üçün avtomobil gül bəzəklərinin interaktiv süni intellekt (AI) vizualizasiya platforması.
          </p>
        </div>

        {/* Feature Teasers List */}
        <div className="bg-[#072112]/95 border border-[#1e5835]/60 rounded-3xl p-6 md:p-8 text-left shadow-2xl space-y-6 max-w-2xl mx-auto">
          <h3 className="text-xs font-black uppercase text-primary tracking-[0.25em] border-b border-[#1b4b2e] pb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Bizi Nələr Gözləyir?
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white mb-1">Fərdi Şəkil Yükləmə</h4>
                <p className="text-xs text-[#a4ccb2]/80 leading-relaxed">
                  Öz avtomobilinizin şəklini yükləyərək çiçək bəzəklərini birbaşa öz maşınınız üzərində sınayın.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white mb-1">Kataloqdan Gül Seçimi</h4>
                <p className="text-xs text-[#a4ccb2]/80 leading-relaxed">
                  Mağazamızın zəngin buket və gül bəzəyi çeşidləri arasından avtomobilə ən çox yaraşanı seçin.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white mb-1">AI Uyğunlaşdırma</h4>
                <p className="text-xs text-[#a4ccb2]/80 leading-relaxed">
                  Süni intellekt gül dizaynını avtomobilin bucağına, işığına və rənginə uyğun olaraq real şəkildə render edəcək.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white mb-1">Zərif Rezervasiya</h4>
                <p className="text-xs text-[#a4ccb2]/80 leading-relaxed">
                  Seçdiyiniz dizaynı bəyəndikdən sonra tarixi və ünvanı qeyd edərək peşəkar bəzədilmə xidmətini asanlıqla sifariş edin.
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* Go Back button */}
        <div className="pt-4">
          <Link to="/" className="inline-flex items-center gap-2 px-8 py-3.5 bg-primary text-[#0d1b12] font-black rounded-xl hover:scale-[1.02] active:scale-95 transition-transform shadow-lg shadow-primary/10 text-sm">
            <ArrowLeft className="w-4 h-4" />
            Ana Səhifəyə Qayıt
          </Link>
        </div>

      </main>
    </div>
  );
}

// Simple internal icon placeholders for safety
function Upload({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  );
}
