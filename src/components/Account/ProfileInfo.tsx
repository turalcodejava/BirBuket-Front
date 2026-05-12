import { motion } from 'motion/react';
import React, { useEffect, useRef, useState } from 'react';
import { Save } from 'lucide-react';
import { authService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function ProfileInfo() {
  const { user, setAuthUser } = useAuth();
  const didInitialLoadRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    username: '',
    email: '',
    name: '',
    surname: '',
    phoneNumber: '',
    gender: '',
    birthDate: '',
  });

  useEffect(() => {
    if (didInitialLoadRef.current) return;
    didInitialLoadRef.current = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await authService.getMe();
        const me = (res as any)?.data ?? res ?? {};
        const next = {
          username: String(me?.username ?? me?.userName ?? ''),
          email: String(me?.email ?? ''),
          name: String(me?.name ?? ''),
          surname: String(me?.surname ?? ''),
          phoneNumber: String(me?.phoneNumber ?? me?.phone_number ?? ''),
          gender: String(me?.gender ?? ''),
          birthDate: String(me?.birthDate ?? me?.birth_date ?? ''),
        };
        setForm(next);
        setAuthUser({
          id: Number(me?.id ?? me?.userId ?? 0),
          username: next.username,
          email: next.email,
          name: next.name,
          surname: next.surname,
          phoneNumber: next.phoneNumber,
          gender: next.gender,
          birthDate: next.birthDate,
          role: String(me?.role ?? ''),
          status: String(me?.status ?? ''),
        });
      } catch (e: any) {
        setError(String(e?.response?.data?.message || e?.message || 'Profil məlumatları yüklənmədi.'));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [setAuthUser]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        username: form.username.trim(),
        email: form.email.trim(),
        name: form.name.trim(),
        surname: form.surname.trim(),
        phoneNumber: form.phoneNumber.trim(),
        gender: form.gender.trim(),
        birthDate: form.birthDate.trim(),
      };
      const res = await authService.updateMe(payload);
      const next = (res as any)?.data ?? res ?? payload;
      setAuthUser({
        id: Number(next?.id ?? next?.userId ?? user?.id ?? 0),
        username: String(next?.username ?? payload.username),
        email: String(next?.email ?? payload.email),
        name: String(next?.name ?? payload.name),
        surname: String(next?.surname ?? payload.surname),
        phoneNumber: String(next?.phoneNumber ?? next?.phone_number ?? payload.phoneNumber),
        gender: String(next?.gender ?? payload.gender),
        birthDate: String(next?.birthDate ?? next?.birth_date ?? payload.birthDate),
        role: String(next?.role ?? user?.role ?? ''),
        status: String(next?.status ?? user?.status ?? ''),
      });
      setSuccess('Profil məlumatları yeniləndi.');
    } catch (e: any) {
      setError(String(e?.response?.data?.message || e?.message || 'Profil yenilənmədi.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-black text-floral-deep dark:text-floral-deep-dark">Profil məlumatlarım</h2>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-white/5 rounded-3xl border border-floral-muted/5 p-6 md:p-8 shadow-sm"
      >
        {loading ? (
          <div className="rounded-2xl border border-floral-muted/10 bg-primary/5 px-5 py-4 text-sm font-semibold text-floral-muted">
            Profil məlumatları yüklənir...
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-black uppercase tracking-wide text-floral-muted">Username</label>
                <input
                  value={form.username}
                  onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                  className="w-full rounded-xl border border-floral-muted/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary dark:bg-white/5"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-black uppercase tracking-wide text-floral-muted">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  className="w-full rounded-xl border border-floral-muted/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary dark:bg-white/5"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-black uppercase tracking-wide text-floral-muted">Ad</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-xl border border-floral-muted/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary dark:bg-white/5"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-black uppercase tracking-wide text-floral-muted">Soyad</label>
                <input
                  value={form.surname}
                  onChange={(e) => setForm((p) => ({ ...p, surname: e.target.value }))}
                  className="w-full rounded-xl border border-floral-muted/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary dark:bg-white/5"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-black uppercase tracking-wide text-floral-muted">Telefon</label>
                <input
                  value={form.phoneNumber}
                  onChange={(e) => setForm((p) => ({ ...p, phoneNumber: e.target.value }))}
                  className="w-full rounded-xl border border-floral-muted/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary dark:bg-white/5"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-black uppercase tracking-wide text-floral-muted">Cins</label>
                <input
                  value={form.gender}
                  onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value }))}
                  className="w-full rounded-xl border border-floral-muted/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary dark:bg-white/5"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-black uppercase tracking-wide text-floral-muted">Doğum tarixi</label>
                <input
                  type="date"
                  value={form.birthDate ? String(form.birthDate).slice(0, 10) : ''}
                  onChange={(e) => setForm((p) => ({ ...p, birthDate: e.target.value }))}
                  className="w-full rounded-xl border border-floral-muted/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary dark:bg-white/5"
                />
              </div>
            </div>
            {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
            {success ? <p className="text-sm font-semibold text-emerald-600">{success}</p> : null}
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-black uppercase tracking-wider text-floral-deep disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Yadda saxlanır...' : 'Yadda saxla'}
            </button>
          </form>
        )}
      </motion.div>
    </section>
  );
}
