import { motion } from 'motion/react';
import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, FileText, Leaf, MapPin, Phone } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { plantDoctorService } from '../../services/api';

type DoctorRecord = {
  id: number;
  ownerUserId: number;
  kind: string;
  status: string;
  createdAt: string;
  plantType: string;
  symptoms: string;
  response: string;
  visitDate: string;
  visitTimeSlot: string;
  phone: string;
  address: string;
  totalFee: number | null;
  image: string;
};

const toText = (...values: any[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const toNum = (...values: any[]) => {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
};

/** Backend bəzən kind boş qaytarır və ya visit tarix/slot sahələrini hər iki axında doldurur — ayırmaq üçün daha etibarlı siqnallar. */
const classifyDoctorKind = (src: any): 'CONSULTATION' | 'HOME_VISIT' => {
  const k = String(src?.kind ?? src?.diagnosisKind ?? src?.requestType ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');

  if (k.includes('HOME_VISIT') || k === 'HOMEVISIT') return 'HOME_VISIT';
  if (k.includes('HOME') && k.includes('VISIT') && !k.includes('CONSULT')) return 'HOME_VISIT';
  if (k.includes('CONSULTATION')) return 'CONSULTATION';
  if (k === 'CONSULT' || (k.includes('CONSULT') && !k.includes('HOME'))) return 'CONSULTATION';

  const plantCountRange = String(src?.plantCountRange ?? src?.plant_count_range ?? '').trim();
  const visitTimeSlot = String(src?.visitTimeSlot ?? src?.timeSlot ?? src?.reservationTimeSlot ?? '').trim();
  const hasSlotEnum = /^SLOT_/i.test(visitTimeSlot);
  const saveAddress =
    typeof src?.saveAddress === 'boolean' ? src.saveAddress : ['true', '1', 'yes'].includes(String(src?.saveAddress ?? '').toLowerCase());

  if (plantCountRange || hasSlotEnum || saveAddress) return 'HOME_VISIT';

  const hasConsultImage =
    Boolean(
      String(
        src?.imageUrl ??
          src?.image ??
          src?.diagnosisImageUrl ??
          src?.consultationImageUrl ??
          src?.attachedImage ??
          ''
      ).trim()
    ) && !plantCountRange;

  if (hasConsultImage) return 'CONSULTATION';

  if (visitTimeSlot || String(src?.visitDate ?? src?.reservationDate ?? '').trim()) return 'HOME_VISIT';

  return 'CONSULTATION';
};

const parseRecord = (raw: any): DoctorRecord => {
  const src = raw?.data && typeof raw.data === 'object' ? raw.data : raw || {};
  const status = String(src?.status ?? src?.diagnosisStatus ?? 'PENDING').trim().toUpperCase();
  const canonicalKind = classifyDoctorKind(src);
  const totalFeeRaw = Number(src?.totalFee ?? src?.price ?? src?.amount);
  return {
    id: toNum(src?.id, src?.diagnosisId, src?.homeVisitId),
    ownerUserId: toNum(
      src?.clientResolvedOwnerUserId,
      src?.userId,
      src?.customerUserId,
      src?.ownerUserId,
      src?.requestUserId,
      src?.createdByUserId,
      src?.user?.id,
      src?.customer?.id,
      src?.owner?.id
    ),
    kind: canonicalKind,
    status,
    createdAt: String(src?.createdAt ?? src?.createdDate ?? src?.date ?? ''),
    plantType: toText(src?.plantType, src?.plantName, src?.category, 'Bitki'),
    symptoms: toText(src?.symptoms, src?.problemDescription, src?.description),
    response: toText(src?.response, src?.reply, src?.agronomistResponse, src?.doctorResponse),
    visitDate: toText(src?.visitDate, src?.reservationDate),
    visitTimeSlot: toText(src?.visitTimeSlot, src?.timeSlot, src?.reservationTimeSlot),
    phone: toText(src?.phoneNumber, src?.contactPhone, src?.phone),
    address: toText(src?.fullAddressLine, src?.addressLine, src?.address),
    totalFee: Number.isFinite(totalFeeRaw) ? totalFeeRaw : null,
    image: toText(
      src?.imageUrl,
      src?.image,
      src?.diagnosisImageUrl,
      src?.photoUrl,
      src?.attachmentUrl
    ),
  };
};

const statusLabel = (status: string) => {
  const s = String(status || '').toUpperCase();
  if (s.includes('COMPLETED') || s.includes('REPLIED')) return 'Cavablandırılıb';
  if (s.includes('RESERVED')) return 'Rezerv edilib';
  if (s.includes('CANCEL')) return 'Ləğv edilib';
  if (s.includes('PENDING') || !s) return 'Gözləmədə';
  return s;
};

export default function DoctorRequestsPage() {
  const { userId, user } = useAuth();
  const [rows, setRows] = useState<DoctorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'consultations' | 'reservations'>('consultations');

  useEffect(() => {
    const run = async () => {
      if (!userId || !user?.email) {
        setRows([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const list = await plantDoctorService.getUserDiagnoses(user.email, { cacheBust: true });
        const parsed = (Array.isArray(list) ? list : [])
          .map(parseRecord)
          .filter((x) => x.id > 0);
        parsed.sort((a, b) => {
          const ta = new Date(a.createdAt || 0).getTime();
          const tb = new Date(b.createdAt || 0).getTime();
          return tb - ta;
        });
        setRows(parsed);
      } catch (e: any) {
        setRows([]);
        setError(String(e?.response?.data?.message || e?.message || 'Müraciətlər yüklənmədi.'));
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [userId]);

  const countInfo = useMemo(
    () => ({
      total: rows.length,
      consultations: rows.filter((x) => x.kind === 'CONSULTATION').length,
      reservations: rows.filter((x) => x.kind === 'HOME_VISIT').length,
    }),
    [rows]
  );
  const filteredRows = useMemo(
    () =>
      rows.filter((x) =>
        activeTab === 'consultations'
          ? x.kind === 'CONSULTATION'
          : x.kind === 'HOME_VISIT'
      ),
    [rows, activeTab]
  );

  return (
    <section>
      <div className="mb-8 flex items-center justify-between">
        <h2 className="text-2xl font-black text-floral-deep dark:text-floral-deep-dark">Həkim müraciət və rezervasiyalarım</h2>
        <span className="rounded-xl bg-primary/15 px-3 py-1 text-xs font-black text-primary">
          Cəmi: {countInfo.total}
        </span>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('consultations')}
          className={`rounded-full px-3 py-1.5 transition-colors ${
            activeTab === 'consultations'
              ? 'bg-primary text-floral-deep'
              : 'bg-white text-floral-muted dark:bg-white/10 dark:text-white/70'
          }`}
        >
          Müraciət: {countInfo.consultations}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('reservations')}
          className={`rounded-full px-3 py-1.5 transition-colors ${
            activeTab === 'reservations'
              ? 'bg-primary text-floral-deep'
              : 'bg-white text-floral-muted dark:bg-white/10 dark:text-white/70'
          }`}
        >
          Rezervasiya: {countInfo.reservations}
        </button>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-floral-muted/10 bg-white p-6 text-sm font-semibold text-floral-muted dark:border-white/10 dark:bg-white/5">
          Məlumatlar yüklənir...
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-3xl border border-floral-muted/10 bg-white p-6 text-sm text-floral-muted dark:border-white/10 dark:bg-white/5">
          {activeTab === 'consultations'
            ? 'Hələ həkimə onlayn müraciət yoxdur.'
            : 'Hələ evə həkim rezervasiyası yoxdur.'}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRows.map((row, i) => (
            <motion.article
              key={`${row.id}-${i}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-3xl border border-floral-muted/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-floral-deep dark:text-white">
                    {row.kind === 'CONSULTATION' ? 'Onlayn həkim müraciəti' : 'Evə həkim rezervasiyası'} #{row.id}
                  </p>
                  <p className="mt-1 text-xs text-floral-muted dark:text-white/60">
                    {row.createdAt ? new Date(row.createdAt).toLocaleString('az-AZ') : '-'}
                  </p>
                </div>
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-black text-primary">
                  {statusLabel(row.status)}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                <p className="flex items-center gap-2"><Leaf className="h-4 w-4 text-primary" /> {row.plantType || '-'}</p>
                {row.visitDate ? <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /> {row.visitDate} {row.visitTimeSlot ? `• ${row.visitTimeSlot}` : ''}</p> : null}
                {row.phone ? <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /> {row.phone}</p> : null}
                {row.address ? <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> {row.address}</p> : null}
                {typeof row.totalFee === 'number' ? <p className="font-bold text-primary">Məbləğ: {row.totalFee.toFixed(2)} ₼</p> : null}
              </div>

              {row.symptoms ? (
                <div className="mt-4 rounded-2xl border border-floral-muted/10 bg-[#fdfcf7] p-3 text-sm dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="mb-1 text-xs font-black uppercase tracking-wide text-floral-muted">Müraciət mətni</p>
                  <p>{row.symptoms}</p>
                </div>
              ) : null}

              {row.response ? (
                <div className="mt-3 rounded-2xl border border-emerald-200/70 bg-emerald-50/60 p-3 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200">
                  <p className="mb-1 text-xs font-black uppercase tracking-wide">Həkim cavabı</p>
                  <p>{row.response}</p>
                </div>
              ) : null}

              {row.image ? (
                <div className="mt-3">
                  <p className="mb-1 flex items-center gap-1 text-xs font-black uppercase tracking-wide text-floral-muted">
                    <FileText className="h-3.5 w-3.5" />
                    Əlavə şəkil
                  </p>
                  <img src={row.image} alt="Müraciət şəkli" className="h-24 w-24 rounded-xl object-cover" referrerPolicy="no-referrer" />
                </div>
              ) : null}
            </motion.article>
          ))}
        </div>
      )}
    </section>
  );
}
