import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { CheckCircle2, Loader2, MessageSquareReply, RefreshCw, Sparkles, Stethoscope, Home } from 'lucide-react';
import { parsePlantDoctorApiError, plantDoctorService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getPlantDoctorAdvice } from '../../services/geminiService';

type DiagnosisItem = {
  id: number;
  /** `PATCH …/home-visit/{id}/*` üçün — boşdursa `id` (diaqnoz id) risklidir: backend bəzən ayrı pk qaytarır */
  plantHomeVisitId?: number;
  homeVisitId?: number;
  plantHomeVisit?: { id?: number };
  homeVisit?: { id?: number };
  userId?: number;
  agronomistId?: number;
  kind?: string;
  email?: string;
  userEmail?: string;
  requesterEmail?: string;
  patientEmail?: string;
  customerEmail?: string;
  username?: string;
  user?: {
    email?: string;
    username?: string;
  };
  imageUrl?: string;
  image?: string;
  photoUrl?: string;
  pictureUrl?: string;
  fileUrl?: string;
  plantType?: string;
  symptoms?: string;
  status?: string;
  createdAt?: string;
  aiResponse?: string;
  agronomistResponse?: string;
  phoneNumber?: string;
  fullAddressLine?: string;
  specialNote?: string;
  visitDate?: string;
  visitTimeSlot?: string;
  distanceKm?: number;
  plantCountRange?: string;
  completedAt?: string;
  baseVisitFee?: number;
  plantCountFee?: number;
  transportFee?: number;
  totalFee?: number;
};

const extractList = (payload: any): DiagnosisItem[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.data?.content)) return payload.data.content;
  if (Array.isArray(payload?.data?.diagnoses)) return payload.data.diagnoses;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.diagnoses)) return payload.diagnoses;
  return [];
};

/** Siyahı elementi bəzən wrapper içində gəlir: `{ diagnosis: {...} }` */
const unwrapDiagnosisRow = (raw: any): DiagnosisItem => {
  if (!raw || typeof raw !== 'object') return raw as DiagnosisItem;
  const r = raw as Record<string, unknown>;
  const inner =
    r.diagnosis && typeof r.diagnosis === 'object'
      ? (r.diagnosis as DiagnosisItem)
      : r.plantDiagnosis && typeof r.plantDiagnosis === 'object'
        ? (r.plantDiagnosis as DiagnosisItem)
        : null;
  if (!inner) return raw as DiagnosisItem;
  /* Wrapper + əsas obyekt: daxili sahələr prioritetdir */
  return { ...(raw as DiagnosisItem), ...inner };
};

const mapExtractedDiagnosisList = (payload: any): DiagnosisItem[] =>
  extractList(payload).map((row) => unwrapDiagnosisRow(row));

const toLocaleDate = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('az-AZ');
};

const pickFirstString = (r: Record<string, unknown>, keys: string[]): string | undefined => {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
};

/** `SLOT_15_18` → `15:00 – 18:00` (UI-da “slot” sözü yox) */
const HOME_VISIT_SLOT_RANGE_LABEL: Record<string, string> = {
  SLOT_00_03: '00:00 – 03:00',
  SLOT_03_06: '03:00 – 06:00',
  SLOT_06_09: '06:00 – 09:00',
  SLOT_09_12: '09:00 – 12:00',
  SLOT_12_15: '12:00 – 15:00',
  SLOT_15_18: '15:00 – 18:00',
  SLOT_18_21: '18:00 – 21:00',
  SLOT_21_24: '21:00 – 00:00',
};

const formatHomeVisitSlotRange = (raw?: string): string => {
  if (!raw?.trim()) return '';
  const key = raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/-+/g, '_');
  if (HOME_VISIT_SLOT_RANGE_LABEL[key]) return HOME_VISIT_SLOT_RANGE_LABEL[key];
  const m = key.match(/^SLOT_(\d{1,2})_(\d{1,2})$/);
  if (m) {
    const h1 = m[1].padStart(2, '0');
    const h2 = m[2].padStart(2, '0');
    return `${h1}:00 – ${h2}:00`;
  }
  return raw.replace(/_/g, ' ').trim();
};

const pickOptionalMoney = (r: Record<string, unknown>, keys: string[]): number | undefined => {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim()) {
      const n = Number(String(v).replace(',', '.'));
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
};

const formatAzn = (n: number) => `${n.toFixed(2)} ₼`;

const feesFromRow = (row: Record<string, unknown>) => {
  const nested =
    row.pricing && typeof row.pricing === 'object' ? (row.pricing as Record<string, unknown>) : null;
  const pick = (keys: string[]) =>
    pickOptionalMoney(row, keys) ?? (nested ? pickOptionalMoney(nested, keys) : undefined);
  return {
    base: pick(['baseVisitFee', 'base_visit_fee', 'visitBaseFee']),
    plantCount: pick(['plantCountFee', 'plant_count_fee', 'countFee']),
    transport: pick(['transportFee', 'transport_fee', 'deliveryFee']),
    total: pick(['totalFee', 'total_fee', 'amount', 'grandTotal']),
  };
};

const mergeFeeParts = (
  a: ReturnType<typeof feesFromRow>,
  b: ReturnType<typeof feesFromRow>
): ReturnType<typeof feesFromRow> => ({
  base: a.base ?? b.base,
  plantCount: a.plantCount ?? b.plantCount,
  transport: a.transport ?? b.transport,
  total: a.total ?? b.total,
});

const resolveHomeVisitPricing = (item: DiagnosisItem) => {
  const r = item as Record<string, unknown>;
  let out = feesFromRow(r);
  for (const k of ['plantHomeVisit', 'homeVisit', 'plant_home_visit', 'home_visit'] as const) {
    const hv = r[k];
    if (hv && typeof hv === 'object') {
      out = mergeFeeParts(out, feesFromRow(hv as Record<string, unknown>));
    }
  }
  return out;
};

const resolvedCreatedAt = (item: DiagnosisItem): string | undefined => {
  if (typeof item.createdAt === 'string' && item.createdAt.trim()) return item.createdAt.trim();
  const raw = item as Record<string, unknown>;
  return pickFirstString(raw, ['created_at', 'submittedAt', 'submissionDate', 'creationTime', 'date']);
};

const resolveRequesterEmail = (item: DiagnosisItem) => {
  const raw = item as Record<string, unknown>;
  const fromFields =
    item.email ||
    item.userEmail ||
    item.requesterEmail ||
    item.patientEmail ||
    item.customerEmail ||
    item.user?.email ||
    pickFirstString(raw, ['userEmail', 'mail', 'contactEmail']);

  if (fromFields?.trim()) return fromFields.trim();
  const uname =
    item.username?.trim() ||
    item.user?.username?.trim() ||
    (typeof raw.username === 'string' ? raw.username.trim() : '') ||
    (typeof raw.userName === 'string' ? raw.userName.trim() : '');
  if (uname) return uname;

  const uid =
    typeof item.userId === 'number' && item.userId > 0 ? item.userId : typeof raw.userId === 'number' ? raw.userId : 0;
  if (uid > 0) return `İstifadəçi #${uid}`;
  return '-';
};

const resolveImageUrl = (item: DiagnosisItem) => {
  const raw = item as Record<string, unknown>;
  return (
    item.imageUrl ||
    item.image ||
    item.photoUrl ||
    item.pictureUrl ||
    item.fileUrl ||
    pickFirstString(raw, ['image_url', 'photoUrl', 'pictureUrl', 'fileUrl', 'attachmentUrl', 'imagePath']) ||
    ''
  );
};

const normalizeStatus = (item: DiagnosisItem) => {
  const raw = item as Record<string, unknown>;
  const s =
    (typeof item.status === 'string' && item.status.trim() ? item.status.trim() : undefined) ??
    pickFirstString(raw, ['diagnosisStatus', 'diagnosis_status', 'state']);
  let out = String(s || 'PENDING').toUpperCase();
  if (out === 'COMLETED') out = 'COMPLETED'; // bəzi sənədlərdə typo
  return out;
};

const resolvedPlantType = (item: DiagnosisItem) => {
  if (typeof item.plantType === 'string' && item.plantType.trim()) return item.plantType.trim();
  const raw = item as Record<string, unknown>;
  return (
    pickFirstString(raw, [
      'plantSpecies',
      'plant_species',
      'species',
      'plantName',
      'plant_name',
      'plant_type',
      'plantTitle',
      'speciesName',
    ]) || 'Bitki növü'
  );
};

const resolvedSymptoms = (item: DiagnosisItem) => {
  if (typeof item.symptoms === 'string' && item.symptoms.trim()) return item.symptoms.trim();
  const raw = item as Record<string, unknown>;
  return (
    pickFirstString(raw, [
      'symptom',
      'symptomDescription',
      'symptom_description',
      'description',
      'issueDescription',
      'notes',
      'message',
      'userMessage',
      'complaint',
      'details',
    ]) || '-'
  );
};

/** Tamamlanıb tarixçəsində server `ANSWERED` / `CLOSED` və s. qaytara bilər */
const DISPLAY_COMPLETE_STATUSES = new Set([
  'COMPLETED',
  'COMPLETE',
  'ANSWERED',
  'CLOSED',
  'RESOLVED',
  'DONE',
]);

const normalizeKind = (item: DiagnosisItem): 'HOME_VISIT' | 'CONSULTATION' => {
  const k = String(item.kind || '').trim().toUpperCase();
  if (k === 'CONSULTATION') return 'CONSULTATION';
  if (k === 'HOME_VISIT') return 'HOME_VISIT';

  // `kind` boş olsa: konsultasiyalar da kontakt üçün telefon/ünvan doldura bilər — yalnız ev ziyarəti
  // zamanı seçilən tarix/slot/bitki ədəd aralığı ilə HOME_VISITE infer edirik
  const hasHomeVisitSignals =
    Boolean(item.plantCountRange && String(item.plantCountRange).trim()) ||
    Boolean(item.visitDate) ||
    Boolean(item.visitTimeSlot && String(item.visitTimeSlot).trim());
  if (hasHomeVisitSignals) return 'HOME_VISIT';

  return 'CONSULTATION';
};

/** Cavab / AI draft state açarı: eyni `id` ev + konsultda təsadüfən eyni olsa belə qarışmaz */
const replyDraftKey = (item: DiagnosisItem) => `${normalizeKind(item)}:${item.id}`;

const pickPositiveId = (v: unknown): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
  if (typeof v === 'string' && /^\d+$/.test(v)) {
    const n = Number(v);
    if (n > 0) return n;
  }
  return undefined;
};

/** Gateway home-visit yollarında `{id}` — adətən `plant_home_visit.id`; diaqnoz `id`-dən fərqlənə bilər */
const resolveHomeVisitActionId = (item: DiagnosisItem): number => {
  const r = item as Record<string, unknown>;
  const keys = [
    'plantHomeVisitId',
    'homeVisitId',
    'visitId',
    'plantVisitId',
    'home_visit_id',
    'plant_home_visit_id',
    'plantHome_visit_id',
    'homeVisit_id',
  ] as const;
  for (const k of keys) {
    const id = pickPositiveId(r[k]);
    if (id != null) return id;
  }
  for (const nest of [r.plantHomeVisit, r.plant_home_visit, r.homeVisit, r.home_visit]) {
    if (nest && typeof nest === 'object') {
      const id = pickPositiveId((nest as Record<string, unknown>).id);
      if (id != null) return id;
    }
  }
  return item.id;
};

const coalesceNumber = (v: unknown): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && /^\d+$/.test(v)) return Number(v);
  return undefined;
};

/** Backend bəzən `response`, `agronomistReply` və s. qaytarır */
const resolvedAgronomistResponse = (item: DiagnosisItem): string => {
  const raw = item as Record<string, unknown>;
  const replyObj = raw.reply;
  const nestedText =
    replyObj && typeof replyObj === 'object' && typeof (replyObj as { text?: string }).text === 'string'
      ? String((replyObj as { text: string }).text).trim()
      : '';

  const candidates = [
    item.agronomistResponse,
    raw.agronomistReply,
    raw.response,
    raw.agronomReply,
    raw.diagnosisResponse,
    raw.agronomist_response,
    nestedText,
  ];
  for (const v of candidates) {
    if (typeof v === 'string') {
      const t = v.trim();
      if (t) return t;
    }
  }
  return '';
};

const hasAgronomistReply = (item: DiagnosisItem) => resolvedAgronomistResponse(item).length > 0;

/** Bir çox gateway cavabından sonra RESERVED əvəzinə DONE/ANSWERED və ya yalnız completedAt yazır */
const EV_ZIYARETI_HISTORY_STATUSES = new Set([
  'COMPLETED',
  'COMPLETE',
  'DONE',
  'FINISHED',
  'CLOSED',
  'ANSWERED',
  'RESOLVED',
  'ARCHIVED',
]);

const homeVisitHasCompletedTimestamp = (item: DiagnosisItem) => {
  const raw = item as Record<string, unknown>;
  const ca =
    (typeof item.completedAt === 'string' && item.completedAt.trim()) ||
    (typeof raw.completed_at === 'string' && raw.completed_at.trim()) ||
    '';
  return ca.length > 0;
};

const isCompletedDiagnosisLike = (item: DiagnosisItem) => {
  const kind = normalizeKind(item);
  const s = normalizeStatus(item);

  if (kind === 'HOME_VISIT') {
    if (EV_ZIYARETI_HISTORY_STATUSES.has(s)) return true;
    if (homeVisitHasCompletedTimestamp(item)) return true;
    // Cavab yazılıb və artıq aktiv/rezerv axınında deyil — tarixçəyə düşsün (status fərqli ad ola bilər)
    if (hasAgronomistReply(item) && s !== 'PENDING' && s !== 'RESERVED') return true;
    return false;
  }

  if (DISPLAY_COMPLETE_STATUSES.has(s)) return true;
  if (!hasAgronomistReply(item)) return false;
  if (kind === 'CONSULTATION') return true;
  if (s === 'PENDING' || s === 'RESERVED') return false;
  return true;
};

const toBase64 = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : '';
      if (!base64) {
        reject(new Error('Failed to parse base64'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

const mergeDraftsFromLists = (
  lists: DiagnosisItem[][],
  setDrafts: Dispatch<SetStateAction<Record<string, string>>>
) => {
  setDrafts((prev) => {
    const next = { ...prev };
    for (const list of lists) {
      for (const item of list) {
        const k = replyDraftKey(item);
        const reply = resolvedAgronomistResponse(item);
        if (!next[k] && reply) {
          next[k] = reply;
        }
      }
    }
    return next;
  });
};

/** Tam səhifə reload — yalnız bu, bəzi mühitlərdə GET keşini / köhnə cavabı SPA-dan təmiz qoparır */
const AGRONOM_PANEL_RESTORE_KEY = 'birbuket_agronom_panel_restore_v1';

type AgronomPanelRestore = {
  savedAt: number;
  successMessage?: string;
  sidebarModule?: 'home_visit' | 'consultation';
  homeEvStatusTab?: 'PENDING' | 'RESERVED' | 'COMPLETED';
  activeSection?: 'PENDING' | 'COMPLETED';
};

const writeAgronomPanelRestore = (payload: Omit<AgronomPanelRestore, 'savedAt'>) => {
  try {
    const data: AgronomPanelRestore = { ...payload, savedAt: Date.now() };
    sessionStorage.setItem(AGRONOM_PANEL_RESTORE_KEY, JSON.stringify(data));
  } catch {
    //
  }
};

const reloadAgronomPanel = () => {
  window.location.reload();
};

export default function AgronomistPanel() {
  const { logout, userId } = useAuth();
  const navigate = useNavigate();
  /** Üst-üstə düşən `refreshAllData` zamanı köhnə sorğu ən sonda tamamlanıb state-i əskitməsin */
  const refreshGenRef = useRef(0);
  const [sidebarModule, setSidebarModule] = useState<'home_visit' | 'consultation'>('home_visit');
  const [activeSection, setActiveSection] = useState<'PENDING' | 'COMPLETED'>('PENDING');
  /** Ev ziyarəti: üstdə hansı status tabı aktivdirsə yalnız o siyahı göstərilir */
  const [homeEvStatusTab, setHomeEvStatusTab] = useState<'PENDING' | 'RESERVED' | 'COMPLETED'>('PENDING');

  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [reservingId, setReservingId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [homePendingItems, setHomePendingItems] = useState<DiagnosisItem[]>([]);
  const [consultPendingItems, setConsultPendingItems] = useState<DiagnosisItem[]>([]);
  const [reservedItems, setReservedItems] = useState<DiagnosisItem[]>([]);
  const [completedItems, setCompletedItems] = useState<DiagnosisItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  /** PENDING kartda: tək PATCH ilə forceReserveAndComplete (istəyə bağlı) */
  const [homeVisitForceSingleRequest, setHomeVisitForceSingleRequest] = useState<Record<string, boolean>>({});

  const sortedHomePending = useMemo(() => {
    return [...homePendingItems].sort((a, b) => {
      const aTime = new Date(resolvedCreatedAt(a) || 0).getTime();
      const bTime = new Date(resolvedCreatedAt(b) || 0).getTime();
      return bTime - aTime;
    });
  }, [homePendingItems]);

  const sortedConsultPending = useMemo(() => {
    return [...consultPendingItems].sort((a, b) => {
      const aTime = new Date(resolvedCreatedAt(a) || 0).getTime();
      const bTime = new Date(resolvedCreatedAt(b) || 0).getTime();
      return bTime - aTime;
    });
  }, [consultPendingItems]);

  const sortedReserved = useMemo(() => {
    return [...reservedItems].sort((a, b) => {
      const aTime = new Date(resolvedCreatedAt(a) || 0).getTime();
      const bTime = new Date(resolvedCreatedAt(b) || 0).getTime();
      return bTime - aTime;
    });
  }, [reservedItems]);

  /** Ev ziyarəti bölməsində yalnız HOME_VISIT rezervlər (konsullar qarışmasın) */
  const sortedHomeReserved = useMemo(
    () => sortedReserved.filter((x) => normalizeKind(x) === 'HOME_VISIT'),
    [sortedReserved]
  );

  const sortedCompleted = useMemo(() => {
    return [...completedItems].sort((a, b) => {
      const aTime = new Date(resolvedCreatedAt(a) || 0).getTime();
      const bTime = new Date(resolvedCreatedAt(b) || 0).getTime();
      return bTime - aTime;
    });
  }, [completedItems]);

  const completedForModule = useMemo(() => {
    return sortedCompleted.filter((x) =>
      sidebarModule === 'home_visit'
        ? normalizeKind(x) === 'HOME_VISIT'
        : normalizeKind(x) === 'CONSULTATION'
    );
  }, [sortedCompleted, sidebarModule]);

  /** Ev ziyarəti — yalnız tamamlanmış (COMPLETED) tarixçə; statusa görə ayrıca bölmədə */
  const homeTamamlanmisItems = useMemo(
    () => sortedCompleted.filter((x) => normalizeKind(x) === 'HOME_VISIT'),
    [sortedCompleted]
  );

  const consultationSidebarCount = sortedConsultPending.length;

  /**
   * Ev ziyarəti: `GET /home-visit/pending` + `GET …/diagnosis/reserved`;
   * tamamlanmış + konsult tarixçəsi üçün `GET /diagnosis` (cavabda kind/status).
   */
  const refreshAllData = useCallback(async (opts?: { quiet?: boolean; bustCache?: boolean }) => {
    const quiet = opts?.quiet === true;
    const bust = opts?.bustCache === true;
    const gen = ++refreshGenRef.current;
    if (!quiet) {
      setLoading(true);
      setError(null);
    }
    try {
      const consultRes = await plantDoctorService.getPendingConsultationsForAgronomist(
        bust ? { cacheBust: true } : undefined
      );
      const consultList = mapExtractedDiagnosisList(consultRes).filter((x) => !hasAgronomistReply(x));

      const homePendingRes = await plantDoctorService.getHomeVisitPending(
        bust ? { cacheBust: true } : undefined
      );
      const homePendingList = mapExtractedDiagnosisList(homePendingRes)
        .filter((row) => normalizeStatus(row) === 'PENDING')
        .map((row) => ({ ...row, kind: row.kind || 'HOME_VISIT' }));

      let reservedList: DiagnosisItem[] = [];
      if (userId && userId > 0) {
        const reservedRes = await plantDoctorService.getReservedDiagnosesForAgronomist(
          userId,
          bust ? { cacheBust: true } : undefined
        );
        reservedList = mapExtractedDiagnosisList(reservedRes).map((row) => ({
          ...row,
          kind: row.kind || 'HOME_VISIT',
        }));
      }

      let diagList: DiagnosisItem[] = [];
      try {
        diagList = mapExtractedDiagnosisList(
          await plantDoctorService.getAllDiagnoses(bust ? { cacheBust: true } : undefined)
        );
      } catch (primaryErr: any) {
        const st = primaryErr?.response?.status;
        if (st === 403 || st === 404) {
          diagList = mapExtractedDiagnosisList(
            await plantDoctorService.getAgronomistDiagnoses(bust ? { cacheBust: true } : undefined)
          );
        } else {
          throw primaryErr;
        }
      }

      if (gen !== refreshGenRef.current) return;

      const completedFiltered = diagList.filter((row) => isCompletedDiagnosisLike(row));
      setConsultPendingItems(consultList);
      setHomePendingItems(homePendingList);
      setReservedItems(reservedList);
      setCompletedItems(completedFiltered);
      mergeDraftsFromLists([consultList, homePendingList, reservedList, diagList], setDrafts);
    } catch (err: any) {
      if (gen !== refreshGenRef.current) return;
      setError(`Verilənlər yüklənmədi: ${parsePlantDoctorApiError(err)}`);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(AGRONOM_PANEL_RESTORE_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    try {
      sessionStorage.removeItem(AGRONOM_PANEL_RESTORE_KEY);
    } catch {
      //
    }
    let parsed: AgronomPanelRestore;
    try {
      parsed = JSON.parse(raw) as AgronomPanelRestore;
    } catch {
      return;
    }
    if (typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt > 120_000) return;
    if (parsed.successMessage) setSuccess(parsed.successMessage);
    if (parsed.sidebarModule === 'home_visit' || parsed.sidebarModule === 'consultation') {
      setSidebarModule(parsed.sidebarModule);
    }
    if (parsed.homeEvStatusTab === 'PENDING' || parsed.homeEvStatusTab === 'RESERVED' || parsed.homeEvStatusTab === 'COMPLETED') {
      setHomeEvStatusTab(parsed.homeEvStatusTab);
    }
    if (parsed.activeSection === 'PENDING' || parsed.activeSection === 'COMPLETED') {
      setActiveSection(parsed.activeSection);
    }
  }, []);

  useEffect(() => {
    refreshAllData().catch(console.error);
  }, [refreshAllData]);

  const handleReserveHomeVisit = async (item: DiagnosisItem) => {
    if (!userId || userId <= 0) {
      setError('İstifadəçi ID tapılmadı. Yenidən daxil olun.');
      return;
    }
    if (normalizeKind(item) !== 'HOME_VISIT') return;
    setSuccess(null);
    setError(null);
    setReservingId(replyDraftKey(item));
    const visitId = resolveHomeVisitActionId(item);
    try {
      try {
        await plantDoctorService.reserveHomeVisitAsAgronomist(visitId, userId);
      } catch (err: any) {
        if (err?.response?.status === 404) {
          await plantDoctorService.reserveAgronomistDiagnosis(item.id, userId);
        } else {
          throw err;
        }
      }
      writeAgronomPanelRestore({
        successMessage: `Rezerv uğurla: #${visitId}. RESERVED bölməsində — istifadəçiyə qəbul məktubu göndərilir.`,
        sidebarModule: 'home_visit',
        homeEvStatusTab: 'RESERVED',
      });
      reloadAgronomPanel();
      return;
    } catch (err: any) {
      setError(parsePlantDoctorApiError(err));
    } finally {
      setReservingId(null);
    }
  };

  const isAuthError = (e: any) => {
    const c = e?.response?.status;
    return c === 401 || c === 403;
  };

  /**
   * Köhnə `PATCH …/diagnosis/…/reserve` fallback yalnız diaqnozu RESERVED edir; `home-visit` sətri PENDING qala bilər.
   * Həmin halda `…/home-visit/…/reply` 409 verir — bir dəfə `home-visit` reserve + reply yenilənir.
   */
  const replyHomeVisitWithReserveRecovery = async (hid: number, responseText: string) => {
    try {
      await plantDoctorService.replyHomeVisitAsAgronomist(hid, userId, responseText);
    } catch (err: any) {
      if (isAuthError(err)) throw err;
      if (err?.response?.status !== 409) throw err;
      try {
        await plantDoctorService.reserveHomeVisitAsAgronomist(hid, userId);
      } catch (re: any) {
        if (isAuthError(re)) throw re;
        if (re?.response?.status !== 409) throw re;
      }
      await plantDoctorService.replyHomeVisitAsAgronomist(hid, userId, responseText);
    }
  };

  /** RESERVED → yekun: əsas path `PATCH …/home-visit/{id}/reply` + `response` mətni məcburi */
  const handleFinalizeHomeVisit = async (e: FormEvent, item: DiagnosisItem) => {
    e.preventDefault();
    if (!userId || userId <= 0) {
      setError('İstifadəçi ID tapılmadı. Yenidən daxil olun.');
      return;
    }
    if (normalizeKind(item) !== 'HOME_VISIT') return;
    if (normalizeStatus(item) !== 'RESERVED') {
      setError('Yalnız RESERVED yazılara cavab göndərilə bilər (409: əvvəl rezerv edin).');
      return;
    }
    const ownerId = coalesceNumber(item.agronomistId);
    if (ownerId !== undefined && ownerId > 0 && ownerId !== userId) {
      setError('Bu ziyarət başqa aqronoma məxsusdur.');
      return;
    }

    const dk = replyDraftKey(item);
    const responseText = (drafts[dk] || '').trim();
    if (!responseText) {
      setError('Backend bədəninə "response" göndərilməlidir — yekun mətn yazın.');
      return;
    }

    const primaryVisitId = resolveHomeVisitActionId(item);
    setCompletingId(dk);
    setSuccess(null);
    setError(null);

    try {
      try {
        await replyHomeVisitWithReserveRecovery(primaryVisitId, responseText);
      } catch (err: any) {
        if (isAuthError(err)) throw err;
        if (primaryVisitId !== item.id) {
          try {
            await replyHomeVisitWithReserveRecovery(item.id, responseText);
          } catch (err2: any) {
            if (isAuthError(err2)) throw err2;
            await plantDoctorService.replyAsAgronomist(item.id, responseText, userId);
          }
        } else {
          await plantDoctorService.replyAsAgronomist(item.id, responseText, userId);
        }
      }
      writeAgronomPanelRestore({
        successMessage: 'Yekun cavab göndərildi — status COMPLETED; məktub backend tərəfindən göndərilir.',
        sidebarModule: 'home_visit',
        homeEvStatusTab: 'COMPLETED',
      });
      reloadAgronomPanel();
      return;
    } catch (err: any) {
      setError(parsePlantDoctorApiError(err));
    } finally {
      setCompletingId(null);
    }
  };

  /** PENDING üçün istəyə bağlı tək sorğu: `{ response, forceReserveAndComplete: true }` */
  const handlePendingForceReserveAndComplete = async (item: DiagnosisItem) => {
    if (!userId || userId <= 0) return;
    if (normalizeStatus(item) !== 'PENDING') return;

    const dk = replyDraftKey(item);
    const responseText = (drafts[dk] || '').trim();
    if (!responseText) {
      setError('Tək sorğuda yekun üçün "response" mətni yazılmalıdır.');
      return;
    }

    const visitId = resolveHomeVisitActionId(item);
    setCompletingId(dk);
    setError(null);
    setSuccess(null);
    try {
      try {
        await plantDoctorService.replyHomeVisitAsAgronomist(visitId, userId, responseText, {
          forceReserveAndComplete: true,
        });
      } catch (err: any) {
        if (isAuthError(err)) throw err;
        if (visitId !== item.id) {
          await plantDoctorService.replyHomeVisitAsAgronomist(item.id, userId, responseText, {
            forceReserveAndComplete: true,
          });
        } else throw err;
      }
      writeAgronomPanelRestore({
        successMessage: 'Tək sorğu ilə rezerv + yekun göndərildi (forceReserveAndComplete).',
        sidebarModule: 'home_visit',
        homeEvStatusTab: 'COMPLETED',
      });
      reloadAgronomPanel();
      return;
    } catch (err: any) {
      setError(parsePlantDoctorApiError(err));
    } finally {
      setCompletingId(null);
    }
  };

  const handleSubmitReply = async (e: FormEvent, item: DiagnosisItem) => {
    e.preventDefault();
    setSuccess(null);
    setError(null);
    const diagnosisId = item.id;
    const dk = replyDraftKey(item);
    const text = (drafts[dk] || '').trim();
    const kind = normalizeKind(item);
    const status = normalizeStatus(item);

    if (!text) {
      setError('Cavab mətni boş ola bilməz.');
      return;
    }
    if (!userId || userId <= 0) {
      setError('İstifadəçi ID tapılmadı. Zəhmət olmasa yenidən daxil olun.');
      return;
    }

    if (kind === 'HOME_VISIT') {
      setError('Ev ziyarəti üçün RESERVED bölməsində "Yekunlaşdır / Cavab göndər" formundan istifadə edin (response məcburi).');
      return;
    }

    if (kind === 'CONSULTATION' && status === 'RESERVED') {
      if (typeof item.agronomistId === 'number' && item.agronomistId > 0 && item.agronomistId !== userId) {
        setError('Bu onlayn müraciət başqa aqronoma bağlıdır.');
        return;
      }
    }

    setSendingId(dk);
    try {
      await plantDoctorService.replyAsAgronomist(diagnosisId, text, userId, {
        kind: 'CONSULTATION',
      });
      writeAgronomPanelRestore({
        successMessage: `#${diagnosisId} üçün cavab göndərildi (email bildirişi backend tərəfindən işlənir).`,
        sidebarModule: 'consultation',
        activeSection: 'COMPLETED',
      });
      reloadAgronomPanel();
      return;
    } catch (err: any) {
      setError(parsePlantDoctorApiError(err));
    } finally {
      setSendingId(null);
    }
  };

  const handleGenerateAiDraft = async (item: DiagnosisItem) => {
    setError(null);
    setSuccess(null);
    const dk = replyDraftKey(item);
    setAiLoadingId(dk);
    try {
      const imageUrl = resolveImageUrl(item);
      let imageBase64: string | undefined;
      let imageMimeType: string | undefined;

      if (imageUrl) {
        try {
          const imgRes = await fetch(imageUrl);
          if (imgRes.ok) {
            const blob = await imgRes.blob();
            imageBase64 = await toBase64(blob);
            imageMimeType = blob.type || 'image/jpeg';
          }
        } catch {
          //
        }
      }

      const aiDraft = await getPlantDoctorAdvice({
        plantType: resolvedPlantType(item) === 'Bitki növü' ? 'Bilinmir' : resolvedPlantType(item),
        symptoms: resolvedSymptoms(item) === '-' ? 'Qeyd edilməyib' : resolvedSymptoms(item),
        imageBase64,
        imageMimeType,
      });

      const draftText = [
        aiDraft.summary ? `Ilkin diaqnoz: ${aiDraft.summary}` : '',
        Array.isArray(aiDraft.possibleIssues) && aiDraft.possibleIssues.length > 0
          ? `Mumkun sebebler:\n- ${aiDraft.possibleIssues.join('\n- ')}`
          : '',
        Array.isArray(aiDraft.carePlan) && aiDraft.carePlan.length > 0
          ? `Tovsiyye olunan addimlar:\n- ${aiDraft.carePlan.join('\n- ')}`
          : '',
        aiDraft.urgency ? `Tecililik: ${aiDraft.urgency}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      setDrafts((prev) => ({
        ...prev,
        [dk]: draftText || prev[dk] || '',
      }));
      setSuccess(`AI draft hazır (${normalizeKind(item)} #${item.id}). Redaktə edib göndərin.`);
    } catch {
      setError('AI draft yaradılmadı.');
    } finally {
      setAiLoadingId(null);
    }
  };

  const renderReplyForm = (item: DiagnosisItem) => {
    const dk = replyDraftKey(item);
    return (
      <form onSubmit={(e) => handleSubmitReply(e, item)} className="mt-4 space-y-3">
        <textarea
          key={dk}
          value={drafts[dk] || ''}
          onChange={(e) => setDrafts((prev) => ({ ...prev, [dk]: e.target.value }))}
          placeholder="Aqronom cavabını yazın..."
          rows={4}
          className="w-full rounded-xl border border-floral-muted/25 bg-[#fcfaf6] px-3 py-2.5 text-sm outline-none focus:border-primary dark:bg-slate-900 dark:text-white"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleGenerateAiDraft(item)}
            disabled={aiLoadingId === dk}
            className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-black text-primary disabled:opacity-60"
            title="AI ilə ilkin cavab layihəsi"
          >
            {aiLoadingId === dk ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            AI draft
          </button>
          <button
            type="submit"
            disabled={sendingId === dk}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-black text-floral-deep disabled:opacity-60"
          >
            {sendingId === dk ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquareReply className="h-4 w-4" />}
            Cavab göndər
          </button>
        </div>
      </form>
    );
  };

  const renderKindBadge = (item: DiagnosisItem) =>
    normalizeKind(item) === 'HOME_VISIT' ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
        <Home className="h-3 w-3" />
        Ev ziyarəti
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">
        <Stethoscope className="h-3 w-3" />
        Onlayn sual
      </span>
    );

  const renderHomeVisitExtras = (item: DiagnosisItem) => {
    const slotLabel = formatHomeVisitSlotRange(item.visitTimeSlot);
    const fees = resolveHomeVisitPricing(item);
    const hasPricing =
      fees.base != null || fees.plantCount != null || fees.transport != null || fees.total != null;

    return (
      <div className="mt-2 flex flex-col gap-3 rounded-xl border border-emerald-200/60 bg-emerald-50/40 px-3 py-2 text-xs sm:flex-row sm:items-start sm:justify-between sm:gap-4 dark:border-emerald-900/35 dark:bg-emerald-950/20">
        <div className="min-w-0 flex-1 space-y-1">
          {item.phoneNumber ?
            <p>
              <span className="font-bold text-emerald-900 dark:text-emerald-200">Telefon: </span>
              <span>{item.phoneNumber}</span>
            </p>
          : null}
          {item.fullAddressLine ?
            <p className="whitespace-pre-wrap">
              <span className="font-bold text-emerald-900 dark:text-emerald-200">Ünvan: </span>
              {item.fullAddressLine}
            </p>
          : null}
          {item.visitDate || item.visitTimeSlot ?
            <p>
              <span className="font-bold text-emerald-900 dark:text-emerald-200">Ziyarət: </span>
              <span>
                {item.visitDate || '—'}
                {slotLabel ? (
                  <>
                    {' '}
                    <span className="text-emerald-800/90 dark:text-emerald-200/90">• {slotLabel}</span>
                  </>
                ) : null}
              </span>
            </p>
          : null}
          {typeof item.distanceKm === 'number' ?
            <p>
              <span className="font-bold text-emerald-900 dark:text-emerald-200">Məsafə: </span>
              {item.distanceKm} km
            </p>
          : null}
        </div>
        {hasPricing ?
          <div className="w-full shrink-0 rounded-lg border border-emerald-300/50 bg-white/80 px-3 py-2 sm:w-[min(100%,13.5rem)] dark:border-emerald-800/40 dark:bg-slate-900/50">
            <p className="mb-1.5 border-b border-emerald-200/60 pb-1 text-[10px] font-black uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
              Qiymət
            </p>
            <ul className="space-y-1 text-[11px] text-emerald-950 dark:text-emerald-50">
              {fees.base != null ?
                <li className="flex justify-between gap-2">
                  <span className="text-emerald-800/85 dark:text-emerald-200/90">Əsas ziyarət</span>
                  <span className="shrink-0 font-bold tabular-nums">{formatAzn(fees.base)}</span>
                </li>
              : null}
              {fees.plantCount != null ?
                <li className="flex justify-between gap-2">
                  <span className="text-emerald-800/85 dark:text-emerald-200/90">Bitki sayı</span>
                  <span className="shrink-0 font-bold tabular-nums">{formatAzn(fees.plantCount)}</span>
                </li>
              : null}
              {fees.transport != null ?
                <li className="flex justify-between gap-2">
                  <span className="text-emerald-800/85 dark:text-emerald-200/90">Nəqliyyat</span>
                  <span className="shrink-0 font-bold tabular-nums">{formatAzn(fees.transport)}</span>
                </li>
              : null}
              {fees.total != null ?
                <li className="mt-1.5 flex justify-between gap-2 border-t border-emerald-200/70 pt-1.5 text-xs font-black dark:border-emerald-800/50">
                  <span>Cəmi</span>
                  <span className="shrink-0 tabular-nums">{formatAzn(fees.total)}</span>
                </li>
              : null}
            </ul>
          </div>
        : null}
      </div>
    );
  };

  const renderQueueCard = (item: DiagnosisItem, panel: 'home' | 'consult') => {
    const kind = normalizeKind(item);
    const itemStatus = normalizeStatus(item);

    if (panel === 'consult' && kind !== 'CONSULTATION') {
      return null;
    }
    if (panel === 'home' && kind !== 'HOME_VISIT') {
      return null;
    }

    const reservedByOtherHome =
      panel === 'home' &&
      kind === 'HOME_VISIT' &&
      itemStatus === 'RESERVED' &&
      typeof item.agronomistId === 'number' &&
      item.agronomistId > 0 &&
      item.agronomistId !== userId;

    const showConsultationReserveNote = panel === 'consult' && kind === 'CONSULTATION' && itemStatus === 'PENDING';

    return (
      <article key={`q-${panel}-${replyDraftKey(item)}`} className="rounded-2xl border border-floral-muted/20 bg-white p-5 shadow-sm dark:bg-white/5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-black text-floral-muted dark:text-floral-muted-dark">#{item.id}</span>
          <span className="text-floral-muted/50">•</span>
          {renderKindBadge(item)}
          <span className="text-floral-muted/50">•</span>
          <span className="text-xs font-bold text-floral-muted dark:text-floral-muted-dark">{item.status || 'PENDING'}</span>
          <span className="text-floral-muted/50">•</span>
          <span className="text-xs font-semibold text-floral-muted">{toLocaleDate(resolvedCreatedAt(item))}</span>
        </div>
        <p className="text-xs font-semibold text-floral-muted dark:text-floral-muted-dark">Email: {resolveRequesterEmail(item)}</p>
        {resolveImageUrl(item) && (
          <a href={resolveImageUrl(item)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-bold text-primary underline">
            Şəkilə bax
          </a>
        )}
        <h2 className="mt-2 text-lg font-black text-floral-deep dark:text-floral-deep-dark">{resolvedPlantType(item)}</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-floral-muted dark:text-floral-muted-dark">{resolvedSymptoms(item)}</p>
        {item.specialNote ? (
          <p className="mt-2 whitespace-pre-wrap text-xs text-floral-muted/90 dark:text-floral-muted-dark/90">
            <span className="font-bold">Qeyd: </span>
            {item.specialNote}
          </p>
        ) : null}
        {kind === 'HOME_VISIT' ? renderHomeVisitExtras(item) : null}

        {kind === 'CONSULTATION' && item.aiResponse ?
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
            AI: {item.aiResponse}
          </p>
        : null}

        {reservedByOtherHome ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-3 text-sm text-amber-950">
            Bu ev ziyarəti artıq başqa aqronom tərəfindən qəbul olunub.
          </p>
        ) : kind === 'HOME_VISIT' && itemStatus === 'PENDING' ? (
          <div className="mt-4 space-y-3">
            <p className="text-xs font-semibold text-floral-muted dark:text-floral-muted-dark">
              Addım 1: <span className="font-black text-emerald-800 dark:text-emerald-200">Rezerv et</span> — PENDING→RESERVED, istifadəçiyə qəbul
              məktubu. Əvvəl rezerv olmadan yekun sorğusu 409 verə bilər.
            </p>
            <button
              type="button"
              disabled={reservingId === replyDraftKey(item) || !userId || completingId === replyDraftKey(item)}
              onClick={() => handleReserveHomeVisit(item)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"
            >
              {reservingId === replyDraftKey(item) ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Rezerv et
            </button>
            <div className="rounded-xl border border-dashed border-emerald-300/80 bg-emerald-50/30 px-3 py-2 dark:border-emerald-900/40 dark:bg-emerald-950/25">
              <label className="flex cursor-pointer items-start gap-2 text-xs font-semibold text-emerald-900 dark:text-emerald-100">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={!!homeVisitForceSingleRequest[replyDraftKey(item)]}
                  onChange={() =>
                    setHomeVisitForceSingleRequest((prev) => ({
                      ...prev,
                      [replyDraftKey(item)]: !prev[replyDraftKey(item)],
                    }))
                  }
                />
                İstəyə bağlı — bir sorğuda rezerv + yekun:&nbsp;
                <code className="rounded bg-emerald-100 px-1 text-[10px] dark:bg-emerald-900/60">forceReserveAndComplete</code>
              </label>
              {homeVisitForceSingleRequest[replyDraftKey(item)] ? (
                <>
                  <p className="mt-2 text-[11px] text-emerald-800 dark:text-emerald-200">
                    &quot;response&quot; yazın və göndərin (normal axın üçün hələ də əvvəl Rezerv et tövsiye olunur).
                  </p>
                  <textarea
                    value={drafts[replyDraftKey(item)] || ''}
                    onChange={(e) =>
                      setDrafts((p) => ({ ...p, [replyDraftKey(item)]: e.target.value }))
                    }
                    rows={3}
                    placeholder='Yekun mətn ("response")'
                    className="mt-2 w-full rounded-lg border border-emerald-200/80 bg-white px-3 py-2 text-sm outline-none dark:border-emerald-900/40 dark:bg-slate-900"
                  />
                  <button
                    type="button"
                    disabled={completingId === replyDraftKey(item) || !userId}
                    onClick={() => handlePendingForceReserveAndComplete(item)}
                    className="mt-2 inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-3 py-2 text-xs font-black text-white disabled:opacity-60 dark:bg-emerald-700"
                  >
                    {completingId === replyDraftKey(item) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    Tək sorğuda göndər
                  </button>
                </>
              ) : null}
            </div>
          </div>
        ) : panel === 'consult' && kind === 'CONSULTATION' ? (
          <>
            {showConsultationReserveNote ? (
              <p className="mt-4 rounded-xl border border-sky-200 bg-sky-50/70 px-3 py-2 text-xs font-semibold text-sky-950 dark:border-sky-900/40 dark:bg-sky-950/25 dark:text-sky-100">
                Onlayn məsləhət: rezerv lazım deyil — cavabı birbaşa göndərin.
              </p>
            ) : null}
            {renderReplyForm(item)}
          </>
        ) : null}
      </article>
    );
  };

  const renderReservedCard = (item: DiagnosisItem) => {
    const ownerId = coalesceNumber(item.agronomistId);
    const mine = ownerId === undefined || ownerId <= 0 || ownerId === userId;
    const dk = replyDraftKey(item);

    return (
      <article key={`r-${dk}`} className="rounded-2xl border border-emerald-300/60 bg-emerald-50/30 p-5 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/20">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-black">#{item.id}</span>
          {renderKindBadge(item)}
          <span className="text-xs font-bold text-emerald-800 dark:text-emerald-200">RESERVED • sizdə</span>
          <span className="text-xs text-emerald-700">{toLocaleDate(resolvedCreatedAt(item))}</span>
        </div>
        <p className="text-xs font-semibold">Email: {resolveRequesterEmail(item)}</p>
        <h2 className="mt-2 text-lg font-black">{resolvedPlantType(item)}</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm">{resolvedSymptoms(item)}</p>
        {normalizeKind(item) === 'HOME_VISIT' ? renderHomeVisitExtras(item) : null}
        {mine ?
          <form onSubmit={(e) => handleFinalizeHomeVisit(e, item)} className="mt-4 space-y-2">
            <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
              Addım 2: backend üçün bədəndə sırf <code className="font-mono font-bold">&quot;response&quot;</code> sahəsi lazımdır.
            </p>
            <textarea
              required
              value={drafts[dk] || ''}
              onChange={(e) => setDrafts((p) => ({ ...p, [dk]: e.target.value }))}
              rows={4}
              placeholder="Yekun cavab mətniniz..."
              className="w-full rounded-xl border border-emerald-200/80 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-emerald-900/40 dark:bg-slate-900"
            />
            <button
              type="submit"
              disabled={completingId === dk || !userId}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-black text-white shadow-sm disabled:opacity-60 dark:bg-emerald-700"
            >
              {completingId === dk ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Yekunlaşdır / Cavab göndər
            </button>
          </form>
        : <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">Bu rezerv sizə məxsus deyil.</p>}
      </article>
    );
  };

  const mainSubtitle =
    sidebarModule === 'home_visit'
      ? 'Ev ziyarəti: əvvəl təsdiq (PENDING → RESERVED, istifadəçiyə bildiriş), sonra ziyarətdən sonra Tamamla (COMPLETED).'
      : 'Həkimə onlayn müraciətlər — oxunmamış növbə və cavablanmış tarixçə.';

  const renderTamamlanmisCard = (item: DiagnosisItem) => {
    const img = resolveImageUrl(item);
    const displayStatus = normalizeStatus(item);
    return (
      <article
        key={`done-${replyDraftKey(item)}`}
        className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-900/15"
      >
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
          <span>#{item.id}</span>
          {renderKindBadge(item)}
          <span>•</span>
          <span>{displayStatus}</span>
          <span>•</span>
          <span>{toLocaleDate(resolvedCreatedAt(item))}</span>
        </div>
        <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-100">Əlaqə: {resolveRequesterEmail(item)}</p>
        {img ?
          <a
            href={img}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-xs font-bold text-primary underline"
          >
            Şəkilə bax
          </a>
        : null}
        <h3 className="mt-2 text-base font-black">{resolvedPlantType(item)}</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm">{resolvedSymptoms(item)}</p>
        {item.specialNote ?
          <p className="mt-2 whitespace-pre-wrap text-xs text-emerald-900/90 dark:text-emerald-100/90">
            <span className="font-bold">Qeyd: </span>
            {item.specialNote}
          </p>
        : null}
        {normalizeKind(item) === 'HOME_VISIT' ? renderHomeVisitExtras(item) : null}
        {normalizeKind(item) === 'CONSULTATION' ?
          <>
            {item.aiResponse ?
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/35 dark:text-amber-100">
                <span className="font-black">AI: </span>
                {item.aiResponse}
              </p>
            : null}
            <p className="mt-3 text-xs font-black uppercase tracking-wide text-emerald-900 dark:text-emerald-100">Aqronom cavabı</p>
            <p className="mt-1 whitespace-pre-wrap rounded-lg bg-white/90 px-3 py-2 text-sm dark:bg-slate-900/70">
              {resolvedAgronomistResponse(item) || '—'}
            </p>
          </>
        : null}
      </article>
    );
  };

  return (
    <div className="min-h-screen bg-[#f6f2ea] dark:bg-background-dark">
      <div className="mx-auto flex max-w-[1400px] flex-col lg:flex-row lg:min-h-screen">
        <aside className="w-full shrink-0 border-b border-floral-muted/20 bg-white lg:w-72 lg:border-b-0 lg:border-r dark:bg-slate-900/90">
          <div className="sticky top-0 space-y-1 p-4 lg:py-8">
            <p className="px-3 text-[10px] font-black uppercase tracking-[0.2em] text-floral-muted">Panel</p>
            <nav className="flex flex-row gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-2 lg:pb-0 lg:overflow-visible">
              <button
                type="button"
                onClick={() => {
                  setSidebarModule('home_visit');
                  setHomeEvStatusTab('PENDING');
                }}
                className={`flex shrink-0 items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors lg:w-full ${
                  sidebarModule === 'home_visit'
                    ? 'border-primary bg-primary/15 shadow-sm ring-2 ring-primary/20'
                    : 'border-transparent bg-[#fdfcf7] hover:border-floral-muted/25 dark:bg-white/5 dark:hover:bg-white/10'
                }`}
              >
                <Home className="h-5 w-5 shrink-0 text-emerald-600" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-[#0d1c12] dark:text-white">Ev ziyarəti</span>
                  <span className="mt-1.5 flex gap-1.5">
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-1 rounded-lg border border-emerald-200/90 bg-emerald-50/90 px-2 py-1 dark:border-emerald-800/50 dark:bg-emerald-950/35">
                      <span className="truncate text-[10px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
                        aktiv
                      </span>
                      <span className="shrink-0 text-[11px] font-black tabular-nums text-emerald-950 dark:text-emerald-50">
                        {sortedHomePending.length}
                      </span>
                    </span>
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-1 rounded-lg border border-teal-200/90 bg-teal-50/80 px-2 py-1 dark:border-teal-800/50 dark:bg-teal-950/30">
                      <span className="truncate text-[10px] font-bold uppercase tracking-wide text-teal-800 dark:text-teal-200">
                        rezerv
                      </span>
                      <span className="shrink-0 text-[11px] font-black tabular-nums text-teal-950 dark:text-teal-50">
                        {sortedHomeReserved.length}
                      </span>
                    </span>
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSidebarModule('consultation');
                  setActiveSection('PENDING');
                }}
                className={`flex shrink-0 items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors lg:w-full ${
                  sidebarModule === 'consultation'
                    ? 'border-primary bg-primary/15 shadow-sm ring-2 ring-primary/20'
                    : 'border-transparent bg-[#fdfcf7] hover:border-floral-muted/25 dark:bg-white/5 dark:hover:bg-white/10'
                }`}
              >
                <Stethoscope className="h-5 w-5 shrink-0 text-sky-600" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="block text-sm font-black text-[#0d1c12] dark:text-white">Həkimə müraciət</span>
                    <span className="rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-black text-white tabular-nums">
                      {consultationSidebarCount}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] font-medium text-floral-muted dark:text-floral-muted-dark">
                    Onlayn sual + şəkil
                  </span>
                </span>
              </button>
            </nav>
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-6 px-4 py-8 sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-black text-[#0d1c12] dark:text-floral-deep-dark">Agronom paneli</h1>
              <p className="mt-1 text-sm text-floral-muted dark:text-floral-muted-dark">{mainSubtitle}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => refreshAllData()}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-bold text-primary disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Yenilə
              </button>
              <button
                type="button"
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-600"
              >
                Çıxış
              </button>
            </div>
          </div>

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</p>
          )}
          {success && (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{success}</p>
          )}

          {sidebarModule === 'home_visit' ?
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setHomeEvStatusTab('PENDING')}
                className={`rounded-xl px-4 py-2 text-sm font-black transition-colors ${
                  homeEvStatusTab === 'PENDING'
                    ? 'bg-emerald-600 text-white'
                    : 'border border-floral-muted/25 bg-white text-floral-muted dark:bg-white/5 dark:text-floral-muted-dark'
                }`}
              >
                <span className="tabular-nums">PENDING</span>
                <span className="ml-2 font-semibold opacity-95">— Aktiv növbə</span>
                {sortedHomePending.length > 0 ?
                  <span
                    className={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs tabular-nums ${
                      homeEvStatusTab === 'PENDING' ? 'bg-white/25' : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100'
                    }`}
                  >
                    {sortedHomePending.length}
                  </span>
                : null}
              </button>
              <button
                type="button"
                onClick={() => setHomeEvStatusTab('RESERVED')}
                className={`rounded-xl px-4 py-2 text-sm font-black transition-colors ${
                  homeEvStatusTab === 'RESERVED'
                    ? 'bg-emerald-600 text-white'
                    : 'border border-floral-muted/25 bg-white text-floral-muted dark:bg-white/5 dark:text-floral-muted-dark'
                }`}
              >
                <span className="tabular-nums">RESERVED</span>
                <span className="ml-2 font-semibold opacity-95">— Rezerv</span>
                {userId && sortedHomeReserved.length > 0 ?
                  <span
                    className={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs tabular-nums ${
                      homeEvStatusTab === 'RESERVED' ? 'bg-white/25' : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100'
                    }`}
                  >
                    {sortedHomeReserved.length}
                  </span>
                : null}
              </button>
              <button
                type="button"
                onClick={() => setHomeEvStatusTab('COMPLETED')}
                className={`rounded-xl px-4 py-2 text-sm font-black transition-colors ${
                  homeEvStatusTab === 'COMPLETED'
                    ? 'bg-emerald-600 text-white'
                    : 'border border-floral-muted/25 bg-white text-floral-muted dark:bg-white/5 dark:text-floral-muted-dark'
                }`}
              >
                <span className="tabular-nums">COMPLETED</span>
                <span className="ml-2 font-semibold opacity-95">— Tamamlanmış</span>
                {homeTamamlanmisItems.length > 0 ?
                  <span
                    className={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs tabular-nums ${
                      homeEvStatusTab === 'COMPLETED' ? 'bg-white/25' : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100'
                    }`}
                  >
                    {homeTamamlanmisItems.length}
                  </span>
                : null}
              </button>
            </div>
          : <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveSection('PENDING')}
                className={`rounded-xl px-4 py-2 text-sm font-black transition-colors ${
                  activeSection === 'PENDING'
                    ? 'bg-primary text-floral-deep'
                    : 'border border-floral-muted/25 bg-white text-floral-muted dark:bg-white/5 dark:text-floral-muted-dark'
                }`}
              >
                Aktiv / oxunmamış növbə
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('COMPLETED')}
                className={`rounded-xl px-4 py-2 text-sm font-black transition-colors ${
                  activeSection === 'COMPLETED'
                    ? 'bg-emerald-600 text-white'
                    : 'border border-floral-muted/25 bg-white text-floral-muted dark:bg-white/5 dark:text-floral-muted-dark'
                }`}
              >
                Tamamlanıb
                {completedForModule.length > 0 ?
                  <span className="ml-2 inline-block rounded-full bg-white/25 px-2 py-0.5 text-xs tabular-nums">
                    {completedForModule.length}
                  </span>
                : null}
              </button>
            </div>
          }

          {loading ? (
            <div className="flex items-center justify-center rounded-2xl bg-white/80 p-10 dark:bg-white/5">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : sidebarModule === 'home_visit' ?
            <div className="space-y-4">
              {homeEvStatusTab === 'PENDING' ?
                <section className="space-y-4">
                  <p className="text-xs text-floral-muted dark:text-floral-muted-dark">
                    <span className="font-bold text-[#0d1c12] dark:text-white">HOME_VISIT</span> • aktiv növbə •{' '}
                    <span className="font-mono font-bold">PENDING</span>
                  </p>
                  {sortedHomePending.length === 0 ?
                    <div className="rounded-2xl border border-floral-muted/20 bg-white p-8 text-sm text-floral-muted dark:bg-white/5 dark:text-floral-muted-dark">
                      Bu statusda ev ziyarəti yoxdur.
                    </div>
                  : sortedHomePending.map((item) => renderQueueCard(item, 'home'))}
                </section>
              : homeEvStatusTab === 'RESERVED' ?
                <section className="space-y-4">
                  <p className="text-xs text-floral-muted dark:text-floral-muted-dark">
                    <span className="font-bold text-[#0d1c12] dark:text-white">HOME_VISIT</span> • rezerv •{' '}
                    <span className="font-mono font-bold">RESERVED</span> • sizin aqronom ID
                  </p>
                  {!userId ?
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      İstifadəçi ID tapılmadı — rezerv siyahısı göstərilə bilmir.
                    </p>
                  : sortedHomeReserved.length === 0 ?
                    <div className="rounded-2xl border border-floral-muted/20 bg-white p-6 text-sm text-floral-muted dark:bg-white/5">
                      Bu statusda rezerv yoxdur.
                    </div>
                  : sortedHomeReserved.map((item) => renderReservedCard(item))}
                </section>
              : <section className="space-y-4">
                  <p className="text-xs text-floral-muted dark:text-floral-muted-dark">
                    <span className="font-bold text-[#0d1c12] dark:text-white">HOME_VISIT</span> • tamamlanmış •{' '}
                    <span className="font-mono font-bold">COMPLETED</span> / COMPLETE
                  </p>
                  {homeTamamlanmisItems.length === 0 ?
                    <div className="rounded-2xl border border-floral-muted/20 bg-white p-8 text-sm text-floral-muted dark:bg-white/5 dark:text-floral-muted-dark">
                      Bu statusda tamamlanmış ev ziyarəti yoxdur.
                    </div>
                  : homeTamamlanmisItems.map((item) => renderTamamlanmisCard(item))}
                </section>
              }
            </div>
          : activeSection === 'PENDING' ?
            <section className="space-y-4">
              <h2 className="text-lg font-black text-[#0d1c12] dark:text-white">Həkimə müraciət — gözləyən növbə</h2>
              {sortedConsultPending.length === 0 ?
                <div className="rounded-2xl border border-floral-muted/20 bg-white p-8 text-sm text-floral-muted dark:bg-white/5 dark:text-floral-muted-dark">
                  Oxunmamış onlayn müraciət yoxdur.
                </div>
              : sortedConsultPending.map((item) => renderQueueCard(item, 'consult'))}
            </section>
          : <section className="space-y-4">
              <h2 className="sr-only">Tamamlanıb</h2>
              <p className="text-xs text-floral-muted dark:text-floral-muted-dark">
                Konsult tarixçəsi: <span className="font-bold">CONSULTATION</span> — tamamlanmış / cavablanmış yazılar.
              </p>
              {completedForModule.length === 0 ?
                <div className="rounded-2xl border border-floral-muted/20 bg-white p-8 text-sm text-floral-muted dark:bg-white/5 dark:text-floral-muted-dark">
                  Bu bölmə üçün tamamlanmış qeyd yoxdur.
                </div>
              : completedForModule.map((item) => renderTamamlanmisCard(item))}
            </section>
          }
        </div>
      </div>
    </div>
  );
}
