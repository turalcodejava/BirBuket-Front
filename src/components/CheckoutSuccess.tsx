import { CheckCircle2, Copy } from 'lucide-react';
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { checkoutService } from '../services/api';

export default function CheckoutSuccess() {
  const location = useLocation();
  const state = (location.state as { orderNumber?: string; orderId?: string } | null) || null;
  
  const queryParams = React.useMemo(() => new URLSearchParams(location.search), [location.search]);
  const queryOrderId = queryParams.get('orderId');
  
  const orderNumber = state?.orderNumber || '-';
  const orderId = state?.orderId || queryOrderId || '';

  React.useEffect(() => {
    if (queryOrderId) {
      const id = Number(queryOrderId);
      if (Number.isFinite(id) && id > 0) {
        checkoutService.payOrder({ orderId: id }).catch((err) => {
          console.error('Payment confirmation error:', err);
        });
      }
    }
  }, [queryOrderId]);

  const shownCode =
    orderNumber && orderNumber !== '-'
      ? `#${orderNumber}`
      : orderId
        ? `#${orderId}`
        : '-';

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen">
      <main className="mx-auto max-w-[900px] px-6 lg:px-10 py-16">
        <section className="bg-white dark:bg-slate-900/50 p-10 rounded-2xl border border-primary/10 shadow-sm text-center">
          <div className="mx-auto mb-5 w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <CheckCircle2 className="w-9 h-9 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-3xl font-black mb-3">Sifariş uğurla tamamlandı</h1>
          <p className="text-slate-500 mb-5">
            Sifarişiniz qəbul edildi. Hazırlıq və çatdırılma vəziyyətini hesabınızdakı sifarişlər bölməsində izləyə bilərsiniz.
          </p>

          <div className="mx-auto max-w-[520px] rounded-xl border border-primary/10 bg-primary/5 p-5 text-left">
            <p className="text-sm font-semibold text-floral-muted mb-2">Sifariş kodu</p>
            <div className="flex items-center justify-between gap-3">
              <span className="text-lg font-black text-floral-deep dark:text-floral-deep-dark">{shownCode}</span>
              <button
                type="button"
                onClick={() => {
                  if (shownCode && shownCode !== '-') {
                    navigator.clipboard?.writeText(shownCode);
                  }
                }}
                className="rounded-lg border border-primary/30 p-2 text-primary hover:bg-primary/10"
                title="Kodu kopyala"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              to="/account/orders"
              className="px-5 py-3 rounded-xl bg-primary text-background-dark text-sm font-black hover:opacity-90"
            >
              Sifarişlərimə keç
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

