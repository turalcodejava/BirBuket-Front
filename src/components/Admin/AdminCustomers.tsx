import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, MoreVertical, Users } from 'lucide-react';
import { authService } from '../../services/api';

type AdminUser = {
  id: number;
  username: string;
  email: string;
  phoneNumber: string;
  name: string;
  surname: string;
  role: string;
  status: string;
  isActive: boolean;
  createdAt: string;
};

const parseUser = (raw: any): AdminUser => {
  const src = raw?.data && typeof raw.data === 'object' ? raw.data : raw || {};
  const statusRaw = String(src?.status ?? src?.userStatus ?? src?.accountStatus ?? '').trim().toUpperCase();
  const activeRaw = src?.active ?? src?.enabled ?? src?.isActive ?? src?.is_active;
  const isActive =
    typeof activeRaw === 'boolean'
      ? activeRaw
      : ['ACTIVE', 'ENABLED', 'AKTIV', 'TRUE', '1'].includes(statusRaw) || Number(activeRaw) === 1;
  const status = statusRaw || (isActive ? 'ACTIVE' : 'INACTIVE');
  const createdAt = String(
    src?.created_at ??
      src?.createdAt ??
      src?.createdDate ??
      src?.createDate ??
      src?.registeredAt ??
      src?.registrationDate ??
      ''
  );
  return {
    id: Number(src?.id ?? src?.userId ?? src?.user_id ?? 0),
    username: String(src?.username ?? src?.userName ?? ''),
    email: String(src?.email ?? ''),
    phoneNumber: String(src?.phoneNumber ?? src?.phone_number ?? src?.phone ?? ''),
    name: String(src?.name ?? ''),
    surname: String(src?.surname ?? ''),
    role: String(src?.role ?? ''),
    status,
    isActive,
    createdAt,
  };
};

export default function AdminCustomers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [roleDraftByUserId, setRoleDraftByUserId] = useState<Record<number, string>>({});
  const [savingRoleUserId, setSavingRoleUserId] = useState<number | null>(null);
  const [savingStatusUserId, setSavingStatusUserId] = useState<number | null>(null);
  const [statusMenuUserId, setStatusMenuUserId] = useState<number | null>(null);
  const [roleActionError, setRoleActionError] = useState('');
  const roleOptions = ['USER', 'ADMIN', 'AGRONOMIST', 'FLORIST', 'COURIER'] as const;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await authService.getAllUsers();
        const list = Array.isArray(res?.data) ? res.data : [];
        const parsed = list.map(parseUser).filter((u) => u.id > 0);
        if (!cancelled) setUsers(parsed);
      } catch (e: any) {
        if (!cancelled) {
          setUsers([]);
          setError(String(e?.response?.data?.message || e?.message || 'Userlər yüklənmədi.'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((u) =>
      [u.username, u.email, u.phoneNumber, `${u.name} ${u.surname}`]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    );
  }, [users, q]);

  const handleRoleSave = async (user: AdminUser) => {
    const nextRole = String(roleDraftByUserId[user.id] || user.role || '').trim().toUpperCase();
    if (!nextRole || nextRole === user.role) return;
    if (!roleOptions.includes(nextRole as any)) return;
    setSavingRoleUserId(user.id);
    setRoleActionError('');
    try {
      await authService.updateUserRole(user.id, nextRole as any);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role: nextRole } : u)));
    } catch (e: any) {
      setRoleActionError(String(e?.response?.data?.message || e?.message || 'Rol update alınmadı.'));
    } finally {
      setSavingRoleUserId(null);
    }
  };

  const hasRoleChanged = (user: AdminUser): boolean => {
    const current = String(user.role || '').trim().toUpperCase();
    const draft = String(roleDraftByUserId[user.id] ?? user.role ?? '').trim().toUpperCase();
    return Boolean(draft) && draft !== current;
  };

  const handleToggleStatus = async (user: AdminUser) => {
    const nextActive = !user.isActive;
    setSavingStatusUserId(user.id);
    setRoleActionError('');
    try {
      await authService.updateUserStatus(user.id, nextActive);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? { ...u, isActive: nextActive, status: nextActive ? 'ACTIVE' : 'INACTIVE' }
            : u
        )
      );
    } catch (e: any) {
      setRoleActionError(
        String(e?.response?.data?.message || e?.message || 'User status update alınmadı.')
      );
    } finally {
      setSavingStatusUserId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#fdfcf0] p-6 lg:p-8 dark:bg-background-dark">
      <div className="rounded-2xl border border-floral-muted/10 bg-white p-5 dark:border-white/10 dark:bg-white/5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-black">Müştərilər</h2>
          <span className="rounded-lg bg-primary/15 px-3 py-1 text-xs font-black text-primary">Cəmi: {users.length}</span>
        </div>
        <div className="mb-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Username, email, telefon üzrə axtar..."
            className="w-full rounded-xl border border-floral-muted/20 px-3 py-2 text-sm outline-none"
          />
        </div>
        {roleActionError ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {roleActionError}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-floral-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Userlər yüklənir...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center gap-2 py-8 text-sm text-floral-muted">
            <Users className="h-4 w-4" />
            User tapılmadı.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_30px_rgba(16,24,40,0.06)] dark:border-white/10 dark:bg-slate-950/40">
            <table className="w-full min-w-[980px] border-separate [border-spacing:0_10px] px-2">
              <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur border-b border-slate-200 text-left text-[11px] uppercase tracking-[0.08em] text-slate-600 dark:bg-slate-900/95 dark:border-white/10 dark:text-white/60">
                <tr>
                  <th className="px-3 py-3">ID</th>
                  <th className="px-3 py-3">Username</th>
                  <th className="px-3 py-3">Ad Soyad</th>
                  <th className="px-3 py-3">Email</th>
                  <th className="px-3 py-3">Telefon</th>
                  <th className="px-3 py-3">Rol</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-center">Rol update</th>
                  <th className="px-3 py-3">created_at</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, idx) => (
                  <tr key={u.id} className={`text-sm transition-shadow hover:shadow-sm ${idx % 2 === 0 ? '' : ''}`}>
                    <td className="rounded-l-2xl border-y border-l border-slate-200/80 bg-white px-3 py-3 font-semibold dark:border-white/10 dark:bg-white/[0.02]">#{u.id}</td>
                    <td className="border-y border-slate-200/80 bg-white px-3 py-3 dark:border-white/10 dark:bg-white/[0.02]">{u.username || '-'}</td>
                    <td className="border-y border-slate-200/80 bg-white px-3 py-3 dark:border-white/10 dark:bg-white/[0.02]">{`${u.name} ${u.surname}`.trim() || '-'}</td>
                    <td className="border-y border-slate-200/80 bg-white px-3 py-3 dark:border-white/10 dark:bg-white/[0.02]">{u.email || '-'}</td>
                    <td className="border-y border-slate-200/80 bg-white px-3 py-3 dark:border-white/10 dark:bg-white/[0.02]">{u.phoneNumber || '-'}</td>
                    <td className="border-y border-slate-200/80 bg-white px-3 py-3 dark:border-white/10 dark:bg-white/[0.02]">{u.role || '-'}</td>
                    <td className="border-y border-slate-200/80 bg-white px-3 py-3 dark:border-white/10 dark:bg-white/[0.02]">
                      <div className="relative inline-flex items-center gap-1.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            u.isActive
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                          }`}
                        >
                          {u.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setStatusMenuUserId((prev) => (prev === u.id ? null : u.id))
                          }
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-white/15 dark:text-white/70 dark:hover:bg-white/10"
                          title="Status əməliyyatları"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {statusMenuUserId === u.id ? (
                          <div className="absolute left-full top-1/2 z-20 ml-2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-slate-900">
                            <button
                              type="button"
                              onClick={() => {
                                void handleToggleStatus(u);
                                setStatusMenuUserId(null);
                              }}
                              disabled={savingStatusUserId === u.id}
                              className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                                u.isActive
                                  ? 'text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40'
                                  : 'text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40'
                              }`}
                            >
                              {savingStatusUserId === u.id
                                ? '...'
                                : u.isActive
                                  ? 'Deaktiv et'
                                  : 'Aktiv et'}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="border-y border-slate-200/80 bg-white px-3 py-3 dark:border-white/10 dark:bg-white/[0.02]">
                      <div className="flex items-center justify-center gap-2">
                        <select
                          value={roleDraftByUserId[u.id] ?? u.role ?? 'USER'}
                          onChange={(e) =>
                            setRoleDraftByUserId((prev) => ({ ...prev, [u.id]: e.target.value }))
                          }
                          className="rounded-lg border border-floral-muted/20 px-2 py-1 text-xs outline-none"
                        >
                          {roleOptions.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => void handleRoleSave(u)}
                          disabled={savingRoleUserId === u.id || !hasRoleChanged(u)}
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-black transition-colors ${
                            hasRoleChanged(u)
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                              : 'bg-white text-slate-400 border border-slate-200 cursor-not-allowed'
                          } ${savingRoleUserId === u.id ? 'opacity-60' : ''}`}
                        >
                          {savingRoleUserId === u.id ? '...' : 'Yadda saxla'}
                        </button>
                      </div>
                    </td>
                    <td className="rounded-r-2xl border-y border-r border-slate-200/80 bg-white px-3 py-3 dark:border-white/10 dark:bg-white/[0.02]">{u.createdAt ? new Date(u.createdAt).toLocaleString('az-AZ') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
