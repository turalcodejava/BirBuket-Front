import React from 'react';
import { FileText, Gift, HelpCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TermsOfUse() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#fdfcf0] px-6 py-10 lg:px-20 dark:bg-background-dark">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Back Button */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm font-semibold text-primary hover:opacity-80 transition-opacity"
        >
          <ArrowLeft className="w-4 h-4" /> Geri Qayıt
        </button>

        {/* Page Header */}
        <section className="rounded-3xl border border-floral-muted/10 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center gap-3 text-primary mb-2">
            <FileText className="w-8 h-8" />
            <span className="text-xs font-black uppercase tracking-wider">Müqavilə və Qaydalar</span>
          </div>
          <h1 className="text-3xl font-black text-floral-deep dark:text-white">İstifadə Qaydaları</h1>
          <p className="mt-2 text-sm text-floral-muted dark:text-white/65">
            BirBuket platformasından istifadə etməzdən əvvəl zəhmət olmasa aşağıdakı istifadə şərtləri və qaydalarla tanış olun. Saytdan istifadə etməklə siz bu şərtləri qəbul etmiş hesab olunursunuz.
          </p>
        </section>

        {/* Section 1: Ümumi Şərtlər */}
        <section className="rounded-3xl border border-floral-muted/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5 space-y-4">
          <div className="flex items-center gap-2 text-floral-deep dark:text-white font-black text-xl">
            <AlertCircle className="w-5 h-5 text-primary" />
            <h2>1. Ümumi Xidmət Şərtləri</h2>
          </div>
          <p className="text-sm text-floral-muted dark:text-white/70 leading-relaxed">
            Bizim platforma vasitəsilə siz premium buketlər sifariş verə, Bouquet Studio alətindən istifadə edərək öz buketinizi dizayn edə və Bitki Həkimi xidmətlərindən yararlana bilərsiniz. Sifariş verərkən təqdim etdiyiniz məlumatların doğruluğuna görə birbaşa məsuliyyət daşıyırsınız.
          </p>
        </section>

        {/* Section 2: BirBuketClub Abunəlik Qaydaları */}
        <section className="rounded-3xl border border-floral-muted/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5 space-y-4">
          <div className="flex items-center gap-2 text-floral-deep dark:text-white font-black text-xl">
            <Gift className="w-5 h-5 text-primary" />
            <h2>2. BirBuketClub Üzvlük və Abunəlik Şərtləri</h2>
          </div>
          <p className="text-sm text-floral-muted dark:text-white/70 leading-relaxed">
            BirBuketClub üzvü olduqda aşağıdakı qaydalar qüvvəyə minir:
          </p>
          <ul className="list-disc pl-5 text-sm text-floral-muted dark:text-white/70 space-y-2">
            <li><strong>Yenilənmə və Ödənişlər:</strong> Abunəlik haqları seçdiyiniz dövrə uyğun olaraq (Aylıq, Rüblük, Yarımillik, İllik) avtomatik şəkildə hesabınızdan çıxılır.</li>
            <li><strong>Çatdırılma tezliyi:</strong> Sifariş zamanı seçilmiş tezlik (Hər Həftə, 2 Həftədən Bir, Ayda Bir) əsasında çiçəkləriniz təyin olunmuş ünvana göndərilir.</li>
            <li><strong>Dəyişiklik və Ləğvetmə:</strong> Siz istənilən vaxt profilinizdən çatdırılma ünvanını və ya buket üslubunu dəyişə, həmçinin heç bir əlavə komissiya olmadan abunəliyinizi tamamilə dayandıra bilərsiniz.</li>
          </ul>
        </section>

        {/* Section 3: Çatdırılma və İmtina Qaydaları */}
        <section className="rounded-3xl border border-floral-muted/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5 space-y-4">
          <div className="flex items-center gap-2 text-floral-deep dark:text-white font-black text-xl">
            <HelpCircle className="w-5 h-5 text-primary" />
            <h2>3. Çatdırılma, Geri Qaytarma və İmtina</h2>
          </div>
          <p className="text-sm text-floral-muted dark:text-white/70 leading-relaxed">
            Çiçəklərin təzəliyini və müştəri məmnuniyyətini qorumaq bizim ən böyük hədəfimizdir:
          </p>
          <ul className="list-disc pl-5 text-sm text-floral-muted dark:text-white/70 space-y-2">
            <li>Buketin keyfiyyəti və ya təzəliyi ilə bağlı hər hansı ciddi problem aşkar olunarsa, çatdırılmadan sonra <strong>2 saat ərzində</strong> dəstək komandamıza müraciət edərək buketin yenisi ilə əvəzlənməsini və ya ödənişin geri qaytarılmasını tələb edə bilərsiniz.</li>
            <li>Çatdırılma ünvanında heç kim tapılmadıqda kuryer alıcı ilə əlaqə saxlayır. Cavab verilmədikdə buket geri qaytarılır və təkrar çatdırılma əlavə ödənişli ola bilər.</li>
          </ul>
        </section>

        {/* Section 4: Məsuliyyətin Məhdudlaşdırılması */}
        <section className="rounded-3xl border border-floral-muted/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5 space-y-4">
          <h2 className="text-floral-deep dark:text-white font-black text-xl">4. Müəllif Hüquqları və Məsuliyyət</h2>
          <p className="text-sm text-floral-muted dark:text-white/70 leading-relaxed">
            Saytda yerləşdirilmiş bütün mətnlər, Bouquet Studio dizayn elementləri, şəkillər və loqolar BirBuket brendinə məxsusdur və müəllif hüquqları ilə qorunur. İcazəsiz istifadəsi qadağandır. Təbii fəlakət, fors-major və ya nəqliyyat tıxacları səbəbindən yaranan gecikmələrə görə BirBuket məsuliyyət daşımır, lakin komandamız gecikmələri minimuma endirmək üçün əlindən gələni edəcəkdir.
          </p>
        </section>
      </div>
    </div>
  );
}
