import {
  ClipboardPlus,
  HelpCircle,
  Home,
  ImagePlus,
  Leaf,
  Send,
  Sprout,
  Sun,
  Upload,
  Droplets,
  CheckCircle2,
  Calendar,
  Sparkles,
  ArrowRight,
  Info
} from 'lucide-react';
import { ChangeEvent, FormEvent, useState } from 'react';
import { authService, plantDoctorService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const faqItems = [
  {
    question: 'Yarpaqlar niyə saralır?',
    answer:
      'Yarpaqların saralması çox vaxt həddindən artıq sulama və ya zəif drenajla bağlı olur. Torpağın üst hissəsi quruduqdan sonra sulamaq daha düzgündür.',
  },
  {
    question: 'Bitkimi nə qədər tez-tez sulamalıyam?',
    answer:
      'Bitki növünə görə dəyişir. Əksər otaq bitkilərində torpağın yuxarı qatı quruduqda sulamaq kifayətdir, sukkulentlər isə daha az su tələb edir.',
  },
  {
    question: 'Bitkilər üçün ən uyğun işıq hansıdır?',
    answer:
      'Əksər bitkilər parlaq, birbaşa olmayan günəş işığını sevir. Şərq və qərb istiqamətli pəncərələr adətən daha uyğundur.',
  },
  {
    question: 'Yarpaqlardakı ağ nöqtələr nədir?',
    answer:
      'Bu, bəzən zərərverici ola bilər. Yarpaqları yumşaq təmizləmə və uyğun bitki qoruyucu vasitələrlə qulluq etmək tövsiyə olunur.',
  },
];

export default function PlantDoctor() {
  const navigate = useNavigate();
  const { token, userId } = useAuth();
  const [plantType, setPlantType] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [adviceError, setAdviceError] = useState<string | null>(null);
  const [requestNotice, setRequestNotice] = useState<string | null>(null);
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const resolveEffectiveUserId = async (): Promise<number | null> => {
    if (!token) return null;
    try {
      const meRes = await authService.getMe();
      const me = meRes?.data;
      if (!me) return userId && userId > 0 ? userId : null;
      const idCandidates = [(me as any)?.userId, (me as any)?.id, (me as any)?.user_id, (me as any)?.uid, (me as any)?.sub];
      for (const rawId of idCandidates) {
        if (typeof rawId === 'number' && rawId > 0) return rawId;
        if (typeof rawId === 'string' && /^\d+$/.test(rawId.trim())) return Number(rawId.trim());
      }
    } catch {
      return userId && userId > 0 ? userId : null;
    }
    return userId && userId > 0 ? userId : null;
  };

  const handleConsultationSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAdviceError(null);
    setRequestNotice(null);
    if (!token) {
      navigate('/login', { state: { message: 'Bağbana sual vermək üçün əvvəlcə daxil olun.' } });
      return;
    }
    if (!plantType.trim()) {
      setAdviceError('Zəhmət olmasa bitkinin növünü qeyd edin.');
      return;
    }
    if (!symptoms.trim()) {
      setAdviceError('Zəhmət olmasa simptomları daxil edin.');
      return;
    }
    if (!selectedFile) {
      setAdviceError('Bağban üçün şəkil əlavə edin (JPG və ya PNG).');
      return;
    }

    setLoadingAdvice(true);
    try {
      const effectiveUserId = await resolveEffectiveUserId();
      if (!effectiveUserId) {
        navigate('/login', { state: { message: 'Bağbana sual vermək üçün əvvəlcə daxil olun.' } });
        return;
      }

      const response = await plantDoctorService.createConsultation({
        userId: effectiveUserId,
        plantType: plantType.trim(),
        symptoms: symptoms.trim(),
        image: selectedFile,
      });
      setRequestNotice(
        response?.message ||
          'Sualınız bağbana yönləndirildi. Tezliklə cavablandırılacaq.'
      );
      setPlantType('');
      setSymptoms('');
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch (err: any) {
      setAdviceError(err?.response?.data?.message || 'Sual göndərilmədi. Zəhmət olmasa yenidən cəhd edin.');
    } finally {
      setLoadingAdvice(false);
    }
  };

  return (
    <div 
      className="min-h-screen bg-cover bg-no-repeat bg-fixed relative text-[#e2ede6]"
      style={{ backgroundImage: "url('/gardener-bg.jpg')", backgroundPosition: 'center' }}
    >
      {/* Dark overlay with low opacity to keep the background image fully clear */}
      <div className="absolute inset-0 bg-[#040f09]/20 pointer-events-none" />

      <main className="mx-auto max-w-[1200px] px-6 lg:px-10 py-12 relative z-10">
        
        {/* Header Section (Banner) */}
        <section className="relative rounded-[32px] overflow-hidden mb-12 min-h-[300px] flex flex-col justify-end p-8 lg:p-12 bg-[#061d11]/85 border border-[#18462b] shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-t from-[#040f09]/90 via-[#040f09]/30 to-transparent" />
          
          <div className="relative z-10 max-w-3xl">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#143f25] border border-[#23683f] text-primary text-xs font-bold rounded-full mb-5 uppercase tracking-widest">
              <Sprout className="w-3.5 h-3.5" />
              BirBağban Professional Dəstək
            </span>
            <h1 className="text-white text-4xl lg:text-6xl font-black leading-tight mb-4 tracking-tight">
              Bitkiniz solur?
            </h1>
            <p className="text-[#a4ccb2] text-base lg:text-lg max-w-2xl leading-relaxed">
              Ev və dibçək bitkilərinizin sağlamlığını bərpa etmək üçün peşəkar bağbanlarımız köməyə hazırdır. Aşağıdakı form vasitəsilə sualınızı verin və ya ünvanınıza peşəkar bağban sifariş edin.
            </p>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          
          {/* Left Column: Diagnostics, Visit, FAQs */}
          <div className="lg:col-span-2 space-y-10">
            
            {/* Call Gardener Card (Pill style container matching user design) */}
            <section className="rounded-[32px] border border-[#1d4f32] bg-[#072415]/90 p-8 lg:p-10 shadow-xl relative overflow-hidden">
              <div className="flex flex-col gap-6">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 bg-[#143c23] border border-[#1e5834] text-primary px-3.5 py-1 rounded-full text-xs font-bold">
                    <Home className="w-3.5 h-3.5" />
                    Eve Bağban Xidməti
                  </div>
                  <h2 className="text-3xl font-black text-white tracking-tight">Eve Bağban Çağır</h2>
                  <p className="text-[#a4ccb2] leading-relaxed text-sm">
                    Bitkilərinizə yerində peşəkar diaqnostika, budama, torpaq və dibçək yenilənməsi, gübrələmə və ümumi baxım dəstəyi.
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                    {[
                      'Sağlamlıq diaqnostikası',
                      'Torpağın peşəkar yenilənməsi',
                      'Xəstəliklərə qarşı dərmanlama',
                      'Budama və yarpaq baxımı'
                    ].map((item) => (
                      <div key={item} className="flex items-center gap-2 text-xs font-semibold text-[#a4ccb2]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => navigate('/bir-bagban/reservation')}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary hover:opacity-95 text-[#0b1c14] px-8 py-3.5 font-bold text-sm transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-primary/10"
                  >
                    <ClipboardPlus className="w-4 h-4" />
                    Sifariş et
                  </button>
                </div>
              </div>
            </section>

            {/* Quick Tips */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-[#143f25] border border-[#23683f] p-2.5 text-primary">
                  <Sun className="w-5 h-5" />
                </span>
                <h2 className="text-2xl font-black text-[#072415] tracking-tight">Bitki Baxım Alətləri</h2>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <article className="rounded-2xl border border-[#18442a] bg-[#051c0f]/80 p-6 flex items-start gap-4 hover:border-[#2a6d45] transition-all">
                  <Droplets className="w-8 h-8 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-extrabold text-white text-lg">Düzgün sulama</h3>
                    <p className="text-sm text-[#a4ccb2] mt-2 leading-relaxed">
                      Hər bitkinin ehtiyacına görə torpağın quruluğunu barmağınızla yoxlayaraq sulayın. Həddindən artıq rütubət çürüməyə səbəb olar.
                    </p>
                  </div>
                </article>
                <article className="rounded-2xl border border-[#18442a] bg-[#051c0f]/80 p-6 flex items-start gap-4 hover:border-[#2a6d45] transition-all">
                  <Sun className="w-8 h-8 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-extrabold text-white text-lg">İşıq seçimi</h3>
                    <p className="text-sm text-[#a4ccb2] mt-2 leading-relaxed">
                      Bitkilərinizin növünə uyğun birbaşa olmayan, parlaq günəş işığı olan yerləri seçin. Yarpaqlar işığa doğru yönəlir.
                    </p>
                  </div>
                </article>
              </div>
            </section>

            {/* FAQs Accordion */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-[#143f25] border border-[#23683f] p-2.5 text-primary">
                  <HelpCircle className="w-5 h-5" />
                </span>
                <h2 className="text-2xl font-black text-[#072415] tracking-tight">Tez-tez verilən suallar</h2>
              </div>

              <div className="space-y-3">
                {faqItems.map((item, idx) => {
                  const isOpen = openFaqIdx === idx;
                  return (
                    <div
                      key={item.question}
                      className="rounded-2xl border border-[#18442a] bg-[#051a0e]/90 overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                        className="w-full flex items-center justify-between px-6 py-4 text-left font-bold text-white hover:text-primary transition-colors focus:outline-none"
                      >
                        <span className="text-sm lg:text-base">{item.question}</span>
                        <span className="text-primary text-xl">{isOpen ? '−' : '+'}</span>
                      </button>
                      {isOpen && (
                        <div className="px-6 pb-5 text-sm text-[#a4ccb2] leading-relaxed border-t border-[#18442a]/30 pt-3">
                          {item.answer}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Right Column: Ask a Gardener Box */}
          <aside className="lg:col-span-1">
            <div className="rounded-3xl border border-[#1e5835] bg-[#072112]/95 backdrop-blur-md p-6 lg:sticky lg:top-24 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-[#143f25] border border-[#23683f] rounded-xl">
                  <Leaf className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-xl font-extrabold text-white">Bağbana sual ver</h3>
              </div>
              <p className="text-xs text-[#a4ccb2] mb-6 leading-relaxed">
                Sualınızı və simptomları daxil edin. Peşəkar bağbanımız Günel xanım sizə köməklik göstərəcək.
              </p>

              <form className="space-y-4" onSubmit={handleConsultationSubmit}>
                <div>
                  <label className="block text-xs font-bold text-[#a4ccb2] uppercase tracking-widest mb-1.5 ml-1">Bitkinin növü</label>
                  <input
                    type="text"
                    value={plantType}
                    onChange={(e) => setPlantType(e.target.value)}
                    placeholder="Məs: Monstera"
                    required
                    className="w-full rounded-xl border border-[#1b4b2e] bg-[#04120a] text-white px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-[#a4ccb2] uppercase tracking-widest mb-1.5 ml-1">Simptomlar</label>
                  <textarea
                    rows={3}
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    placeholder="Məs: Yarpaqlarda saralma..."
                    required
                    className="w-full rounded-xl border border-[#1b4b2e] bg-[#04120a] text-white px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm resize-none"
                  />
                </div>

                <label className="block rounded-xl border-2 border-dashed border-[#1b4b2e] bg-[#04120a]/40 p-5 text-center cursor-pointer hover:bg-primary/5 hover:border-primary/30 transition-all">
                  <Upload className="w-6 h-6 text-primary mx-auto mb-2" />
                  <p className="text-xs font-bold text-white">
                    {selectedFile ? selectedFile.name : 'Bitkinin Şəkli'}
                  </p>
                  <p className="text-[9px] text-[#a4ccb2] mt-1">Diaqnoz qoyulması üçün şəkil mütləqdir</p>
                  <input type="file" accept="image/*" required className="hidden" onChange={handleFileChange} />
                </label>

                {previewUrl && (
                  <div className="relative rounded-xl overflow-hidden border border-[#1b4b2e] h-32 mt-2">
                    <img src={previewUrl} alt="Bitki önizləmə" className="w-full h-full object-cover" />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loadingAdvice}
                  className="w-full bg-primary hover:opacity-95 text-[#0b1c14] py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/10 transition-transform active:scale-95 disabled:opacity-75"
                >
                  <Send className="w-4 h-4" />
                  {loadingAdvice ? 'Göndərilir...' : 'Müraciəti Göndər'}
                </button>
              </form>

              {adviceError && (
                <div className="mt-4 p-3 bg-red-950/20 border border-red-900/40 text-red-400 text-xs rounded-xl font-semibold">
                  {adviceError}
                </div>
              )}
              {requestNotice && (
                <div className="mt-4 p-3 bg-[#143f25]/30 border border-[#23683f]/50 text-[#85e19f] text-xs rounded-xl font-semibold">
                  {requestNotice}
                </div>
              )}

              <div className="mt-6 pt-5 border-t border-[#1e5835] flex items-center gap-4">
                <div className="h-11 w-11 rounded-full border-2 border-primary/45 overflow-hidden bg-[#143f25] flex items-center justify-center text-primary shrink-0">
                  <Sprout className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-black text-white">Günel xanım</p>
                  <p className="text-xs text-primary font-bold">Baş Bağban (BirBağban)</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
