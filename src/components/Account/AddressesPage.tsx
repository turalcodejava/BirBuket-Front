import { MapPin, Plus } from 'lucide-react';
import React from 'react';

export default function AddressesPage() {
  return (
    <section>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-black text-floral-deep dark:text-floral-deep-dark">Ünvanlarım</h2>
        <button className="px-4 py-2 rounded-xl bg-primary text-floral-deep text-xs font-black uppercase tracking-wider flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Yeni ünvan
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-white/5 rounded-3xl border border-floral-muted/5 p-6">
          <div className="flex items-center gap-3 mb-3">
            <MapPin className="w-5 h-5 text-primary" />
            <p className="text-sm font-black text-floral-deep dark:text-white">Əsas ünvan</p>
          </div>
          <p className="text-sm text-floral-muted">Bakı şəhəri, Nəsimi rayonu, 28 May küçəsi 15</p>
        </div>

        <div className="bg-white dark:bg-white/5 rounded-3xl border border-floral-muted/5 p-6">
          <div className="flex items-center gap-3 mb-3">
            <MapPin className="w-5 h-5 text-primary" />
            <p className="text-sm font-black text-floral-deep dark:text-white">İş ünvanı</p>
          </div>
          <p className="text-sm text-floral-muted">Bakı şəhəri, Yasamal rayonu, İnşaatçılar prospekti 22</p>
        </div>
      </div>
    </section>
  );
}
