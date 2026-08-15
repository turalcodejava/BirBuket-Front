import React from 'react';
import { Eye, Lock, ShieldCheck, FileText, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PrivacyPolicy() {
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
            <ShieldCheck className="w-8 h-8" />
            <span className="text-xs font-black uppercase tracking-wider">Təhlükəsizlik və Məxfilik</span>
          </div>
          <h1 className="text-3xl font-black text-floral-deep dark:text-white">Məxfilik Siyasəti</h1>
          <p className="mt-2 text-sm text-floral-muted dark:text-white/65">
            Sizin məlumatlarınızın məxfiliyi və təhlükəsizliyi bizim üçün çox vacibdir. Bu sənəddə məlumatların necə toplanması, saxlanması və istifadəsi təsvir olunur.
          </p>
        </section>

        {/* Content Section 1: Toplanan Məlumatlar */}
        <section className="rounded-3xl border border-floral-muted/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5 space-y-4">
          <div className="flex items-center gap-2 text-floral-deep dark:text-white font-black text-xl">
            <Eye className="w-5 h-5 text-primary" />
            <h2>1. Toplanan Məlumatlar</h2>
          </div>
          <p className="text-sm text-floral-muted dark:text-white/70 leading-relaxed">
            Biz sizə yüksək keyfiyyətli xidmət göstərmək və sifarişlərinizi çatdırmaq məqsədilə aşağıdakı şəxsi məlumatları toplayırıq:
          </p>
          <ul className="list-disc pl-5 text-sm text-floral-muted dark:text-white/70 space-y-2">
            <li><strong>Şəxsi məlumatlar:</strong> Adınız, soyadınız, əlaqə telefonunuz və e-poçt ünvanınız.</li>
            <li><strong>Çatdırılma məlumatları:</strong> Sifarişin gedəcəyi ünvan, alıcının adı və əlaqə nömrəsi.</li>
            <li><strong>Sifariş məlumatları:</strong> Seçdiyiniz buket üslubları, rənglər, çatdırılma tezliyi və tarix qeydləri.</li>
            <li><strong>Sistem məlumatları:</strong> IP ünvanı, brauzer növü, daxil olduğunuz səhifələr və çərəz (cookie) qeydləri.</li>
          </ul>
        </section>

        {/* Content Section 2: Məlumatların İstifadəsi */}
        <section className="rounded-3xl border border-floral-muted/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5 space-y-4">
          <div className="flex items-center gap-2 text-floral-deep dark:text-white font-black text-xl">
            <FileText className="w-5 h-5 text-primary" />
            <h2>2. Məlumatların İstifadə Qaydası</h2>
          </div>
          <p className="text-sm text-floral-muted dark:text-white/70 leading-relaxed">
            Toplanmış məlumatlar yalnız aşağıdakı məqsədlər üçün istifadə olunur:
          </p>
          <ul className="list-disc pl-5 text-sm text-floral-muted dark:text-white/70 space-y-2">
            <li>Sifarişlərinizin düzgün hazırlanması və təyin olunmuş ünvana çatdırılması.</li>
            <li>BirBuketClub abunəliyinizin idarə olunması və prioritet çatdırılma marşrutlarının qurulması.</li>
            <li>Dəstək mərkəzi və canlı çat vasitəsilə suallarınızın cavablandırılması.</li>
            <li>Xidmət keyfiyyətini artırmaq üçün statistik təhlillərin aparılması.</li>
            <li>İstifadəçinin razılığı ilə yeni kolleksiyalar və kampaniyalar barədə bildirişlərin göndərilməsi.</li>
          </ul>
        </section>

        {/* Content Section 3: Məlumatların Qorunması */}
        <section className="rounded-3xl border border-floral-muted/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5 space-y-4">
          <div className="flex items-center gap-2 text-floral-deep dark:text-white font-black text-xl">
            <Lock className="w-5 h-5 text-primary" />
            <h2>3. Təhlükəsizlik və Məlumatların Qorunması</h2>
          </div>
          <p className="text-sm text-floral-muted dark:text-white/70 leading-relaxed">
            Şəxsi məlumatlarınızın təhlükəsizliyini təmin etmək üçün qabaqcıl texnologiyalardan istifadə edirik:
          </p>
          <ul className="list-disc pl-5 text-sm text-floral-muted dark:text-white/70 space-y-2">
            <li>Bütün məlumat ötürülmələri <strong>SSL/TLS</strong> şifrələmə protokolları vasitəsilə qorunur.</li>
            <li>Ödənişlər birbaşa lisenziyalı və təhlükəsiz ödəniş şlüzləri vasitəsilə həyata keçirilir. Kart məlumatlarınız heç bir halda bizim serverlərimizdə yadda saxlanılmır.</li>
            <li>Məlumatlarınıza giriş hüququ yalnız səlahiyyətli əməkdaşlara və kuryerlərə (çatdırılma üçün zəruri olan qədər) məhdudlaşdırılır.</li>
          </ul>
        </section>

        {/* Content Section 4: Çərəzlər (Cookies) */}
        <section className="rounded-3xl border border-floral-muted/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5 space-y-4">
          <h2 className="text-floral-deep dark:text-white font-black text-xl">4. Çərəz (Cookie) Siyasəti</h2>
          <p className="text-sm text-floral-muted dark:text-white/70 leading-relaxed">
            Veb-saytımızda naviqasiyanı asanlaşdırmaq, sessiyanızı yadda saxlamaq və fərdi seçimlərinizi tətbiq etmək üçün çərəzlərdən istifadə olunur. Brauzerinizin nizamlamalarından çərəzləri istənilən vaxt söndürə bilərsiniz, lakin bu halda saytın bəzi funksiyaları düzgün işləməyə bilər.
          </p>
        </section>

        {/* Content Section 5: Əlaqə */}
        <section className="rounded-3xl border border-floral-muted/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5 space-y-4">
          <h2 className="text-floral-deep dark:text-white font-black text-xl">5. Siyasətdə Dəyişikliklər və Əlaqə</h2>
          <p className="text-sm text-floral-muted dark:text-white/70 leading-relaxed">
            Biz zaman-zaman bu Məxfilik Siyasətini yeniləyə bilərik. Ən son yenilənmə tarixi sənədin yuxarı hissəsində qeyd olunur. Suallarınız yarandıqda dəstək mərkəzimiz və ya info@birbuket.com e-poçt ünvanı vasitəsilə bizimlə əlaqə saxlaya bilərsiniz.
          </p>
        </section>
      </div>
    </div>
  );
}
