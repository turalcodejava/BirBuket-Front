import React, { useEffect, useMemo, useState } from 'react';
import { Moon, RefreshCcw, ShieldCheck, Sun } from 'lucide-react';

type AdminUiSettings = {
  darkMode: boolean;
  compactTables: boolean;
};

const STORAGE_KEY = 'birbuket_admin_ui_settings_v1';

const readSettings = (): AdminUiSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { darkMode: false, compactTables: false };
    const p = JSON.parse(raw) as Partial<AdminUiSettings>;
    return {
      darkMode: Boolean(p.darkMode),
      compactTables: Boolean(p.compactTables),
    };
  } catch {
    return { darkMode: false, compactTables: false };
  }
};

const writeSettings = (settings: AdminUiSettings) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    //
  }
};

export default function AdminSettings() {
  const [settings, setSettings] = useState<AdminUiSettings>(() => readSettings());
  const [saved, setSaved] = useState('');

  useEffect(() => {
    writeSettings(settings);
    const root = document.documentElement;
    if (settings.darkMode) root.classList.add('dark');
    else root.classList.remove('dark');
    setSaved('Yadda saxlanıldı');
    const id = window.setTimeout(() => setSaved(''), 1200);
    return () => window.clearTimeout(id);
  }, [settings]);

  const apiBase = useMemo(() => String(import.meta.env.VITE_API_BASE_URL || '').trim() || '(boş)', []);

  return (
    <div className="min-h-screen bg-[#fdfcf0] p-6 lg:p-8 dark:bg-background-dark">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_18px_45px_rgba(16,24,40,0.08)] dark:border-white/10 dark:bg-slate-950/40">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">Tənzimləmələr</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-white/60">
                Sadə, təmiz və əsas ayarlar.
              </p>
            </div>
            {saved ? (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                {saved}
              </span>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_10px_35px_rgba(16,24,40,0.06)] dark:border-white/10 dark:bg-slate-950/40">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.08em] text-slate-500 dark:text-white/55">Görünüş</p>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setSettings((prev) => ({ ...prev, darkMode: false }))}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                !settings.darkMode
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-white/80 dark:hover:bg-white/5'
              }`}
            >
              <Sun className="h-4 w-4" />
              Light
            </button>
            <button
              type="button"
              onClick={() => setSettings((prev) => ({ ...prev, darkMode: true }))}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                settings.darkMode
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-white/80 dark:hover:bg-white/5'
              }`}
            >
              <Moon className="h-4 w-4" />
              Dark
            </button>
            <label className="ml-1 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 dark:border-white/15 dark:text-white/80">
              <input
                type="checkbox"
                checked={settings.compactTables}
                onChange={(e) => setSettings((prev) => ({ ...prev, compactTables: e.target.checked }))}
              />
              Kompakt cədvəl
            </label>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_10px_35px_rgba(16,24,40,0.06)] dark:border-white/10 dark:bg-slate-950/40">
          <div className="mb-4 flex items-center justify-between gap-2">
            <p className="text-xs font-black uppercase tracking-[0.08em] text-slate-500 dark:text-white/55">Təhlükəsizlik</p>
            <span className="truncate text-[11px] text-slate-400 dark:text-white/45">API: {apiBase}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem('token');
                localStorage.removeItem('accessToken');
                localStorage.removeItem('access_token');
                localStorage.removeItem('authToken');
                window.location.href = '/login';
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
            >
              <ShieldCheck className="h-4 w-4" />
              Sessiyanı sıfırla
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/15 dark:text-white/80 dark:hover:bg-white/5"
            >
              <RefreshCcw className="h-4 w-4" />
              Səhifəni yenilə
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
