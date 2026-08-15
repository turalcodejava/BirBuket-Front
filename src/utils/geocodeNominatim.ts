/**
 * OpenStreetMap Nominatim — çatdırılma ünvanını xəritədə göstərmək üçün mətn→koordinat.
 * Azərbaycan ünvanları üçün countrycodes=az, bir neçə sorğu variantı və Bakı ərazisi üstünlüyü.
 * https://nominatim.org/release-docs/latest/api/Search/
 */

const UA = 'BirBuket/1.0 (delivery-tracking; contact: BirBuket)';

/** Bakının təxminən perimetri — səhv ölkə/OSM uyğunsuzluğunu azaldır */
const BAKU_BBOX = { minLat: 40.2, maxLat: 40.55, minLng: 49.6, maxLng: 50.25 };

const inBakuBox = (lat: number, lng: number) =>
  lat >= BAKU_BBOX.minLat &&
  lat <= BAKU_BBOX.maxLat &&
  lng >= BAKU_BBOX.minLng &&
  lng <= BAKU_BBOX.maxLng;

type OsmHit = {
  lat: number;
  lon: number;
  importance: number;
};

const delay = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

function buildQueryVariants(raw: string): string[] {
  const t = String(raw || '').replace(/\s+/g, ' ').trim();
  const out = new Set<string>();

  const push = (s: string) => {
    const v = s.trim();
    if (v.length >= 3) out.add(v);
  };

  push(t);

  push(t.replace(/,?\s*Azərbaycan\s*$/iu, '').trim());
  push(t.replace(/Bakı\s+İnzibati\s+Ərazisi/giu, '').replace(/,\s*,/g, ',').trim());

  const bk = /^Bakı\s*(\d+)\s*[,:]\s*(.+)$/iu.exec(t);
  if (bk) {
    const rest = bk[2].trim();
    const firstSeg = rest.split(',')[0]?.trim() || rest;
    push(`${firstSeg} ${bk[1]}, Yasamal rayonu, Bakı`.replace(/\s+/g, ' '));
    push(`${firstSeg}, ${bk[1]}, Yasamal Bakı Azərbaycan`.replace(/\s+/g, ' '));
    push(`${firstSeg}, Bakı, Azərbaycan`);
  }

  const parts = t.split(',').map((x) => x.trim()).filter(Boolean);
  if (parts.length >= 3) {
    const streetParts = parts.filter((p) => /prospekt|prospect|küç|cavid|javid|rayon/i.test(p));
    const streetLike = streetParts[0] || parts[1] || '';
    const num = /\b\d{3,5}\b/.exec(t)?.[0] || /^Bakı\s*(\d+)/iu.exec(t)?.[1];
    if (streetLike) {
      if (num) push(`${streetLike}, ${num}, Bakı Azerbaycan`);
      push(`${streetLike}, Bakı, Azərbaycan`);
    }
    push(parts.slice(-4).join(', '));
    push(parts.slice(0, 3).join(', ') + ', Bakı');
  }

  return [...out].filter(Boolean);
}

function pickBest(hits: OsmHit[]): [number, number] | null {
  if (!hits.length) return null;
  const inBox = hits.filter((h) => inBakuBox(h.lat, h.lon));
  const pool = inBox.length > 0 ? inBox : hits;
  pool.sort((a, b) => (b.importance || 0) - (a.importance || 0));
  const best = pool[0];
  return [best.lat, best.lon];
}

async function searchOnce(query: string, base: string): Promise<OsmHit[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url = `${base}/search?format=json&addressdetails=0&countrycodes=az&limit=8&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'az,ru,en',
      'User-Agent': UA,
    },
  });
  if (!res.ok) return [];
  const body = (await res.json()) as Array<{ lat?: string; lon?: string; importance?: string | number }>;
  if (!Array.isArray(body)) return [];
  return body
    .map((row) => {
      const lat = row?.lat != null ? Number(row.lat) : NaN;
      const lon = row?.lon != null ? Number(row.lon) : NaN;
      const impRaw = row?.importance;
      const importance = typeof impRaw === 'number' ? impRaw : Number(String(impRaw ?? 0).replace(',', '.')) || 0;
      return { lat, lon, importance };
    })
    .filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lon) && Math.abs(h.lat) <= 90 && Math.abs(h.lon) <= 180);
}

function nominatimBases(): string[] {
  const custom = String(process.env.NEXT_PUBLIC_NOMINATIM_BASE || '').trim();
  const fallback = '/geo-nominatim';
  const pub = 'https://nominatim.openstreetmap.org';
  return [...new Set((custom ? [custom, pub] : [fallback, pub]).filter(Boolean))];
}

async function searchWithBaseFallback(query: string): Promise<OsmHit[]> {
  const bases = nominatimBases();
  for (let b = 0; b < bases.length; b++) {
    if (b > 0) await delay(1100);
    try {
      const hits = await searchOnce(query, bases[b]);
      if (hits.length) return hits;
    } catch {
      //
    }
  }
  return [];
}

export async function geocodeAddressNominatim(query: string): Promise<[number, number] | null> {
  const variants = buildQueryVariants(query);
  for (let i = 0; i < variants.length; i++) {
    try {
      if (i > 0) await delay(1050);
      const hits = await searchWithBaseFallback(variants[i]);
      const best = pickBest(hits);
      if (best) return best;
    } catch {
      //
    }
  }
  return null;
}
