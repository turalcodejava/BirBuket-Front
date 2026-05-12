import { Navigate, useLocation, useNavigate } from 'react-router-dom';

/** WhatsApp-da `/courier/invite` saxlanılır — məzmunu kod tələb etməyən izləmə ilə vahid `/courier/tracking`-ə yönləndirir. */
export default function CourierInvitePage() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const p = new URLSearchParams(search);
  const ok = Boolean(p.get('orderId') && p.get('access'));

  if (!ok) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f6f2ea] px-4 dark:bg-background-dark">
        <p className="text-center text-sm text-red-600">Link tam deyil (orderId və access parametrləri lazımdır).</p>
        <button
          type="button"
          onClick={() => navigate('/', { replace: true })}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-floral-deep"
        >
          Ana səhifə
        </button>
      </div>
    );
  }

  return <Navigate to={{ pathname: '/courier/tracking', search }} replace />;
}
