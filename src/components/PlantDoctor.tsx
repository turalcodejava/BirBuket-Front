import {
  ClipboardPlus,
  HelpCircle,
  Home,
  ImagePlus,
  Leaf,
  Send,
  Sprout,
  Sun,
  Truck,
  Upload,
  Droplets,
  CheckCircle2,
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
    <div className="bg-[#fdfcf0] dark:bg-background-dark min-h-screen">
      <main className="mx-auto max-w-[1200px] px-6 lg:px-10 py-10">
        <section className="relative rounded-[28px] overflow-hidden mb-12 min-h-[320px] flex flex-col justify-end p-8 bg-[#0d1b12]">
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="relative z-10">
            <span className="inline-block px-3 py-1 bg-primary text-floral-deep text-xs font-black rounded-full mb-4">
              Peşəkar dəstək
            </span>
            <h1 className="text-white text-4xl lg:text-5xl font-black leading-tight mb-4">
              Bitkiniz solur?
            </h1>
            <p className="text-white/80 text-lg max-w-2xl">
              Peşəkar bağbanlarımız bitkilərinizin sağlamlığını bərpa etmək üçün buradadır.
              Şəkil və məlumat göndərin, BirBağban tövsiyələri ilə sizə geri dönüş edək.
            </p>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-10">
            <section>
              <div className="flex items-center gap-3 mb-5">
                <span className="rounded-xl bg-primary/10 p-2 text-primary">
                  <HelpCircle className="w-5 h-5" />
                </span>
                <h2 className="text-2xl font-black text-floral-deep dark:text-floral-deep-dark">
                  Tez-tez verilən suallar
                </h2>
              </div>
              <div className="space-y-3">
                {faqItems.map((item, idx) => (
                  <details
                    key={item.question}
                    open={idx === 0}
                    className="group rounded-2xl border border-floral-muted/15 bg-white dark:bg-white/5 overflow-hidden"
                  >
                    <summary className="cursor-pointer list-none px-5 py-4 font-bold text-floral-deep dark:text-floral-deep-dark">
                      {item.question}
                    </summary>
                    <p className="px-5 pb-5 text-sm text-floral-muted dark:text-floral-muted-dark leading-relaxed border-t border-floral-muted/10 pt-4">
                      {item.answer}
                    </p>
                  </details>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] border border-primary/20 bg-gradient-to-br from-white to-primary/5 dark:from-white/5 dark:to-primary/10 p-7">
              <div className="flex items-center gap-3 mb-4">
                <span className="rounded-xl bg-primary/10 p-2 text-primary">
                  <Home className="w-5 h-5" />
                </span>
                <h2 className="text-2xl font-black text-floral-deep dark:text-floral-deep-dark">
                  Eve Bağban Çağır
                </h2>
              </div>
              <p className="text-floral-muted dark:text-floral-muted-dark leading-relaxed">
                Bitkilərinizə yerində professional qulluq lazımdırsa, bağbanımız ünvanınıza gəlib
                budama, torpaq yenilənməsi, transplantasiya və ümumi baxım üzrə dəstək verir.
              </p>
              <ul className="mt-5 space-y-2 text-sm font-semibold text-floral-deep dark:text-floral-deep-dark">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> Sağlamlıq diaqnostikası</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> Torpaq və gübrələmə tövsiyəsi</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> Budama və yarpaq baxımı</li>
              </ul>
              <button
                type="button"
                onClick={() => navigate('/bir-bagban/reservation')}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-black text-floral-deep hover:opacity-90 transition-opacity"
              >
                <ClipboardPlus className="w-4 h-4" />
                Sifariş et
              </button>
            </section>

            <section>
              <div className="flex items-center gap-3 mb-5">
                <span className="rounded-xl bg-primary/10 p-2 text-primary">
                  <Leaf className="w-5 h-5" />
                </span>
                <h2 className="text-2xl font-black text-floral-deep dark:text-floral-deep-dark">
                  Bitki baxımı alətləri
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <article className="rounded-2xl border border-primary/15 bg-primary/5 p-5 flex items-start gap-3">
                  <Droplets className="w-8 h-8 text-primary shrink-0" />
                  <div>
                    <h3 className="font-black text-floral-deep dark:text-floral-deep-dark">Düzgün sulama</h3>
                    <p className="text-sm text-floral-muted dark:text-floral-muted-dark mt-1">
                      Bitkinin torpaq quruluğuna uyğun sulama planı qurun.
                    </p>
                  </div>
                </article>
                <article className="rounded-2xl border border-primary/15 bg-primary/5 p-5 flex items-start gap-3">
                  <Sun className="w-8 h-8 text-primary shrink-0" />
                  <div>
                    <h3 className="font-black text-floral-deep dark:text-floral-deep-dark">İşıq seçimi</h3>
                    <p className="text-sm text-floral-muted dark:text-floral-muted-dark mt-1">
                      Bitkinizi uyğun işıq rejimində yerləşdirin.
                    </p>
                  </div>
                </article>
              </div>
            </section>
          </div>

          <aside className="lg:col-span-1">
            <div className="rounded-[24px] border border-floral-muted/15 bg-white dark:bg-white/5 p-6 lg:sticky lg:top-24">
              <h3 className="text-xl font-black text-floral-deep dark:text-floral-deep-dark">
                Bağbana sual ver
              </h3>
              <p className="text-sm text-floral-muted dark:text-floral-muted-dark mt-2 mb-5">
                Sualınızı göndərin, peşəkar bağbanımız cavablandırsın.
              </p>

              <form className="space-y-4" onSubmit={handleConsultationSubmit}>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Bitkinin növü</label>
                  <input
                    type="text"
                    value={plantType}
                    onChange={(e) => setPlantType(e.target.value)}
                    placeholder="Məs: Monstera"
                    required
                    className="w-full rounded-xl border border-floral-muted/20 bg-[#fdfcf5] dark:bg-white/5 px-3 py-2.5 outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Simptomlar</label>
                  <textarea
                    rows={3}
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    placeholder="Yarpaqlar quruyur..."
                    className="w-full rounded-xl border border-floral-muted/20 bg-[#fdfcf5] dark:bg-white/5 px-3 py-2.5 outline-none focus:border-primary"
                  />
                </div>
                <label className="block rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-5 text-center cursor-pointer hover:bg-primary/10 transition-colors">
                  <Upload className="w-6 h-6 text-primary mx-auto mb-2" />
                  <p className="text-xs text-floral-muted">
                    {selectedFile ? selectedFile.name : 'Şəkil mütləqdir — JPG və ya PNG'}
                  </p>
                  <input type="file" accept="image/*" required className="hidden" onChange={handleFileChange} />
                </label>
                {previewUrl && (
                  <img src={previewUrl} alt="Bitki önizləmə" className="w-full h-36 object-cover rounded-xl border border-floral-muted/20" />
                )}
                <button
                  type="submit"
                  disabled={loadingAdvice}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-black text-floral-deep hover:opacity-90 transition-opacity"
                >
                  <Send className="w-4 h-4" />
                  {loadingAdvice ? 'Müraciət qeydə alınır...' : 'Müraciəti göndər'}
                </button>
              </form>
              {adviceError && <p className="mt-3 text-xs font-semibold text-red-500">{adviceError}</p>}
              {loadingAdvice && (
                <p className="mt-3 text-xs font-semibold text-floral-muted">
                  Müraciət qeydə alınır...
                </p>
              )}
              {requestNotice && (
                <p className="mt-3 text-xs font-semibold text-floral-muted">
                  {requestNotice}
                </p>
              )}
              <div className="mt-6 pt-5 border-t border-floral-muted/15 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                  <Sprout className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-black text-floral-deep dark:text-floral-deep-dark">Günel xanım</p>
                  <p className="text-xs text-primary">Baş Bağban</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
