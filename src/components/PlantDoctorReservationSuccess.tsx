import { CheckCircle2, PhoneCall } from 'lucide-react';
import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function PlantDoctorReservationSuccess() {
  const location = useLocation();
  const state = (location.state as { phoneNumber?: string } | null) || null;
  const phoneNumber = state?.phoneNumber || '+994';

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen">
      <main className="mx-auto max-w-[900px] px-6 lg:px-10 py-16">
        <section className="bg-white dark:bg-slate-900/50 p-10 rounded-2xl border border-primary/10 shadow-sm text-center">
          <div className="mx-auto mb-5 w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <CheckCircle2 className="w-9 h-9 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-3xl font-black mb-3">Rezervasiya uğurla təsdiqləndi</h1>
          <p className="text-slate-500 mb-7">
            Sorğunuz qəbul edildi. Qısa zamanda əməkdaşımız sizinlə əlaqə saxlayacaq.
          </p>

          <div className="mx-auto max-w-[520px] rounded-xl border border-primary/10 bg-primary/5 p-5 text-left">
            <p className="text-sm font-semibold text-floral-muted mb-2">Əlaqə üçün nömrə</p>
            <div className="flex items-center justify-between gap-3">
              <span className="text-lg font-black text-floral-deep dark:text-floral-deep-dark">{phoneNumber}</span>
              <PhoneCall className="w-5 h-5 text-primary shrink-0" />
            </div>
            <p className="text-xs text-floral-muted mt-2">
              Zəhmət olmasa bu nömrəni aktiv saxlayın. Təsdiq və ziyarət detalları bu nömrə üzərindən paylaşılacaq.
            </p>
          </div>

          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              to="/plant-doctor"
              className="px-5 py-3 rounded-xl bg-primary text-background-dark text-sm font-black hover:opacity-90"
            >
              Plant Doctor səhifəsinə qayıt
            </Link>
            <Link
              to="/"
              className="px-5 py-3 rounded-xl border border-primary/30 text-primary text-sm font-black hover:bg-primary/5"
            >
              Ana səhifə
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
