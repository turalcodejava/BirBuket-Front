/// <reference types="vite/client" />
import axios, { AxiosInstance } from 'axios';
import { 
  APIResponse, 
  APIProduct, 
  Category, 
  Product, 
  LoginResponse,
  User,
  PageableResponse,
  Cart
} from '../types';

const apiBaseUrl = 
  import.meta.env.DEV 
    ? '' 
    : (import.meta.env.VITE_API_BASE_URL || '');

/** `/api/plantdoctor` — siyahı sorğuları 10s-də tez-tez kəsilir; `.env`-də `VITE_PLANT_DOCTOR_TIMEOUT_MS` ilə artırıla bilər */
const resolvePlantDoctorAxiosTimeoutMs = () => {
  const n = Number(import.meta.env.VITE_PLANT_DOCTOR_TIMEOUT_MS);
  return n > 0 ? n : 60000;
};

const apiClient: AxiosInstance = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30000,
  headers: {
    Accept: 'application/json',
  },
});

let redirectingToLogin = false;

const redirectToLoginNow = () => {
  if (typeof window === 'undefined') return;
  if (redirectingToLogin) return;
  const path = window.location.pathname || '';
  if (path.startsWith('/login')) return;
  redirectingToLogin = true;
  window.location.href = '/login';
};

const clearStoredAuth = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('access_token');
  localStorage.removeItem('token');
  localStorage.removeItem('authToken');
  sessionStorage.removeItem('accessToken');
  sessionStorage.removeItem('access_token');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('authToken');
};

const normalizeTokenCandidate = (raw: string): string => {
  const unquoted = raw.replace(/^"(.*)"$/, '$1').trim();
  if (
    (unquoted.startsWith('{') && unquoted.endsWith('}')) ||
    (unquoted.startsWith('[') && unquoted.endsWith(']'))
  ) {
    try {
      const parsed = JSON.parse(unquoted);
      const nested =
        parsed?.accessToken ||
        parsed?.access_token ||
        parsed?.token ||
        parsed?.data?.accessToken ||
        parsed?.data?.access_token;
      if (typeof nested === 'string') {
        return nested.replace(/^Bearer\s+/i, '').trim();
      }
    } catch {
      // ignore parse error
    }
  }
  return unquoted.replace(/^Bearer\s+/i, '').trim();
};

const readStoredAuthToken = (): string => {
  const rawCandidates = [
    localStorage.getItem('accessToken'),
    localStorage.getItem('access_token'),
    sessionStorage.getItem('accessToken'),
    sessionStorage.getItem('access_token'),
  ];
  for (const raw of rawCandidates) {
    if (!raw) continue;
    const normalized = normalizeTokenCandidate(raw);
    if (normalized) return normalized;
  }
  return '';
};

const postWithFallback = async <T>(endpoints: string[], payload: any) => {
  let lastError: any = null;
  for (const endpoint of endpoints) {
    try {
      const res = await apiClient.post<T>(endpoint, payload);
      return res.data;
    } catch (err: any) {
      lastError = err;
      // Continue to next endpoint for auth-path mismatches and payload contract differences.
      // We only stop after all endpoints are exhausted.
    }
  }
  throw lastError || new Error('No auth endpoint matched');
};

const getWithFallback = async <T>(endpoints: string[]) => {
  let lastError: any = null;
  for (const endpoint of endpoints) {
    try {
      const res = await apiClient.get<T>(endpoint);
      return res.data;
    } catch (err: any) {
      lastError = err;
      // Continue to next endpoint; throw only if all candidates fail.
    }
  }
  throw lastError || new Error('No auth endpoint matched');
};

const normalizeUserResponse = (payload: any): APIResponse<User> => {
  if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
    return payload as APIResponse<User>;
  }

  if (payload && typeof payload === 'object' && 'data' in payload && payload.data && typeof payload.data === 'object') {
    return {
      success: true,
      data: payload.data as User,
      message: payload.message,
      errorCode: payload.errorCode
    };
  }

  return {
    success: true,
    data: payload as User
  };
};

// Request Interceptor for Auth + Plant Doctor timeout (default 10s bütün layihə üçün çox qısa ola bilər)
apiClient.interceptors.request.use((config) => {
  const url = config.url || '';
  if (url.includes('/api/plantdoctor')) {
    config.timeout = resolvePlantDoctorAxiosTimeoutMs();
  }
  const existingAuthorization =
    (config.headers as any)?.Authorization ||
    (config.headers as any)?.authorization ||
    (typeof (config.headers as any)?.get === 'function'
      ? (config.headers as any).get('Authorization') || (config.headers as any).get('authorization')
      : undefined);
  const isAuthEndpoint =
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('forgot-password') ||
    url.includes('forgot') ||
    url.includes('reset-password') ||
    url.includes('password-reset');
  const needsAuthToken =
    url.includes('/auth/me') ||
    url.includes('/api/auth/me') ||
    url.includes('/api/auth/profile') ||
    url.includes('/api/user/me') ||
    url.includes('/api/users/me');
  if (isAuthEndpoint) {
    if (config.headers && 'Authorization' in config.headers) {
      delete (config.headers as any).Authorization;
    }
    return config;
  }

  /** Müştəri/kuryer `?access=` ilə anonim çatdırılma sorğusu — Bearer əlavə olunmasın (bəzi backend-lər bloklayır). */
  const anonOrderTrackingUrl =
    /\b\/api\/order\/[^/?]+\/(tracking|track|courier-tracking|delivery-tracking|public-tracking)\?/i.test(url) ||
    /\b\/api\/public\/order\/[^/?]+\/tracking\?/i.test(url) ||
    /\b\/api\/order\/[^/?]+\/(courier\/live|courier-location|live-location)\?/i.test(url);
  if (anonOrderTrackingUrl && !existingAuthorization) {
    if (config.headers) {
      delete (config.headers as any).Authorization;
      delete (config.headers as any).authorization;
    }
    return config;
  }

  const token = readStoredAuthToken();
  if (existingAuthorization) {
    config.headers.Authorization = existingAuthorization;
    return config;
  }

  if (token) {
    const normalizedToken = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    config.headers.Authorization = normalizedToken;
  } else if (needsAuthToken && config.headers && 'Authorization' in config.headers) {
    delete (config.headers as any).Authorization;
  }

  if (import.meta.env.DEV) {
    const shouldTraceAuth =
      url.includes('/auth/me') ||
      url.includes('/api/auth/me') ||
      url.includes('/api/auth/profile') ||
      url.includes('/api/user/me') ||
      url.includes('/api/order/custom-bouquet/draft') ||
      url.includes('/api/order/custom-bouquet/checkout');
    if (shouldTraceAuth) {
      const authHeader =
        (config.headers as any)?.Authorization ||
        (config.headers as any)?.authorization ||
        '';
      const hasBearer = typeof authHeader === 'string' && authHeader.startsWith('Bearer ');
      const tokenLength = hasBearer ? authHeader.slice('Bearer '.length).length : 0;
      // eslint-disable-next-line no-console
      console.debug('[api auth debug]', { url, hasBearer, tokenLength });
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = String(error?.config?.url || '');
    const method = String(error?.config?.method || 'get').toLowerCase();
    const isAuthEndpoint =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('forgot-password') ||
      url.includes('forgot') ||
      url.includes('reset-password') ||
      url.includes('password-reset');

    const isMeEndpoint =
      url.includes('/auth/me') ||
      url.includes('/api/auth/me') ||
      url.includes('/api/auth/profile') ||
      url.includes('/api/user/me') ||
      url.includes('/api/users/me');

    const message = String(
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message ||
      ''
    ).toLowerCase();
    const looksLikeExpiredSession =
      message.includes('token') ||
      message.includes('expired') ||
      message.includes('session') ||
      message.includes('sessiya') ||
      message.includes('etibars');

    // Avoid forced logout on some write endpoints that may return transient/misclassified 401.
    const shouldForceReauth =
      status === 401 &&
      !isAuthEndpoint &&
      (isMeEndpoint || looksLikeExpiredSession);

    if (shouldForceReauth) {
      clearStoredAuth();
      redirectToLoginNow();
    }
    return Promise.reject(error);
  }
);

// Helper to map API Product to Frontend Product
const mapProduct = (item: APIProduct): Product => {
  const variants = item.productVariants || [];
  const images = item.images || [];
  const minPrice =
    variants.length > 0 ? Math.min(...variants.map((v) => v.price)) : 0;

  // Real-world APIs might have variations in field names
  const title = item.productName || (item as any).name || 'Məhsul';
  const desc = item.description || (item as any).desc || '';
  const rawSingle = item.single ?? (item as any).isSingle ?? (item as any).is_single;
  let single: boolean | undefined;
  if (rawSingle === true || rawSingle === 'true') single = true;
  else if (rawSingle === false || rawSingle === 'false') single = false;

  return {
    id: item.id,
    title,
    price: `${minPrice} AZN`,
    desc,
    img: images[0]?.imageUrl || (item as any).img || '',
    hoverImg: images[1]?.imageUrl || images[0]?.imageUrl || '',
    rating: item.rating || 0,
    slug: item.slug,
    categoryId: item.productCategory?.id || (item as any).category_id || 1,
    single
  };
};

const normalizeProductPageResponse = (
  payload: any,
  opts?: { isSingle?: boolean }
): APIResponse<PageableResponse<Product>> | null => {
  const rawData = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  const content = Array.isArray(rawData?.content) ? rawData.content : null;
  if (!content) return null;

  return {
    success: true,
    data: {
      ...rawData,
      content: content.map((item: APIProduct) => {
        const p = mapProduct(item);
        if (opts?.isSingle === true && p.single !== false) {
          return { ...p, single: true as const };
        }
        return p;
      }),
    },
    message: payload?.message,
    errorCode: payload?.errorCode,
  };
};

const normalizeRawProductPageResponse = (
  payload: any
): APIResponse<PageableResponse<APIProduct>> | null => {
  const rawData = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  const content = Array.isArray(rawData?.content) ? rawData.content : null;
  if (!content) return null;
  return {
    success: true,
    data: {
      ...rawData,
      content: content as APIProduct[],
    },
    message: payload?.message,
    errorCode: payload?.errorCode,
  };
};

/** `/api/product?productType=…` cavabı bəzən `{ data: { content } }`, bəzən `{ data: APIProduct[] }`, bəzən birbaşa `APIProduct[]` olur */
const extractApiProductsFromProductListPayload = (payload: any): APIProduct[] => {
  const looksLikeProductRow = (x: unknown) =>
    x != null && typeof x === 'object' && 'id' in (x as object);

  const firstProductArray = (arr: unknown): APIProduct[] | null => {
    if (!Array.isArray(arr) || arr.length === 0 || !looksLikeProductRow(arr[0])) return null;
    return arr as APIProduct[];
  };

  const fromObj = (o: any): APIProduct[] | null => {
    if (o == null || typeof o !== 'object') return null;
    for (const k of ['content', 'products', 'items', 'results', 'data'] as const) {
      const hit = firstProductArray((o as any)[k]);
      if (hit) return hit;
    }
    return null;
  };

  return (
    firstProductArray(payload) ??
    firstProductArray(payload?.data) ??
    fromObj(payload?.data != null ? payload.data : payload) ??
    []
  );
};

const productRowStableId = (row: APIProduct): number | null => {
  const raw = (row as any)?.id ?? (row as any)?.productId;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const mergeApiProductsUnique = (acc: APIProduct[], rows: APIProduct[]) => {
  const seen = new Set(acc.map((r) => productRowStableId(r)).filter((x): x is number => x != null));
  for (const row of rows) {
    const id = productRowStableId(row);
    if (id == null || seen.has(id)) continue;
    seen.add(id);
    acc.push(row);
  }
};

/** Bəzi backendlər yalnız səhifələnmiş ümumi siyahıda `productType` saxlayır; filter query boş qayıdanda bu kömək edir */
const collectProductsByScanningAllPages = async (productType: string): Promise<APIProduct[]> => {
  const want = String(productType || '').trim().toUpperCase();
  if (!want) return [];
  const acc: APIProduct[] = [];
  const seen = new Set<number>();
  const pageSize = 100;
  for (let page = 0; page < 40; page += 1) {
    const res = await productService.getAllRaw(page, pageSize);
    if (!res?.success || !res.data) break;
    const content = (res.data.content ?? []) as APIProduct[];
    for (const item of content) {
      const pt = String((item as any).productType ?? (item as any).type ?? '').trim().toUpperCase();
      if (pt !== want) continue;
      const id = productRowStableId(item);
      if (id == null || seen.has(id)) continue;
      seen.add(id);
      acc.push(item);
    }
    if (content.length === 0) break;
    if (res.data.last === true) break;
  }
  return acc;
};

const normalizeProductType = (raw: unknown): string => {
  const value = String(raw ?? '').trim().toUpperCase();
  return value;
};

const normalizeVariantSize = (raw: unknown): string | undefined => {
  const value = String(raw ?? '').trim().toUpperCase();
  if (!value) return undefined;
  if (/^CM\d{2}$/.test(value)) return value;
  if (/^\d{2}$/.test(value)) return `CM${value}`;
  return value;
};

const normalizeVariantColor = (raw: unknown): string | undefined => {
  const value = String(raw ?? '').trim().toUpperCase();
  return value || undefined;
};

const normalizeBooleanLike = (raw: unknown): boolean | undefined => {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') return raw === 1;
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return undefined;
  if (['true', '1', 'yes', 'y', 'single', 'active', 'enabled'].includes(s)) return true;
  if (['false', '0', 'no', 'n', 'inactive', 'disabled'].includes(s)) return false;
  return undefined;
};

const readVariantDiscountFromObj = (v: any): number | undefined => {
  if (!v || typeof v !== 'object') return undefined;
  if (!Object.prototype.hasOwnProperty.call(v, 'discountPercentage') && !Object.prototype.hasOwnProperty.call(v, 'discount_percentage')) {
    return undefined;
  }
  const d = Number(v?.discountPercentage ?? v?.discount_percentage);
  if (!Number.isFinite(d)) return undefined;
  return Math.min(100, Math.max(0, d));
};

const normalizeProductVariantEntries = (variantsRaw: unknown[]): Array<Record<string, unknown>> => {
  return variantsRaw
    .map((v: any) => {
      const price = Number(v?.price ?? v?.unitPrice ?? 0);
      const size = normalizeVariantSize(v?.size);
      const color = normalizeVariantColor(v?.color);
      const out: Record<string, unknown> = {};
      if (Number.isFinite(price) && price > 0) out.price = price;
      if (size) out.size = size;
      if (color) out.color = color;
      if (v?.variantName) out.variantName = String(v.variantName).trim();
      const imgUrl = String(v?.imageUrl ?? v?.image_url ?? '').trim();
      if (imgUrl) out.imageUrl = imgUrl;
      const vd = readVariantDiscountFromObj(v);
      if (vd !== undefined) out.discountPercentage = vd;
      return out;
    })
    .filter((v: Record<string, unknown>) => typeof v.price === 'number');
};

/**
 * PATCH /api/product/:id üçün: yalnız input-da olan açarları göndərir.
 * Məs: { discountPercentage: 15 } — başqa sahələr serverdə toxunulmaz qalır.
 */
const normalizeProductPayloadForPatch = (input: Record<string, unknown>): Record<string, unknown> => {
  const src = input || {};
  const out: Record<string, unknown> = {};

  if ('productName' in src || 'title' in src || 'name' in src) {
    out.productName = String(src.productName ?? src.title ?? src.name ?? '').trim();
  }
  if ('description' in src || 'desc' in src) {
    out.description = String(src.description ?? src.desc ?? '').trim();
  }
  if ('productType' in src || 'type' in src) {
    const productType = normalizeProductType(src.productType ?? src.type);
    if (productType) out.productType = productType;
  }
  if ('productCategoryId' in src || 'categoryId' in src || (src as any).productCategory) {
    const categoryRaw =
      src.productCategoryId ??
      src.categoryId ??
      ((src as any)?.productCategory?.id);
    const categoryIdNum = Number(categoryRaw ?? 0);
    if (Number.isFinite(categoryIdNum) && categoryIdNum > 0) {
      out.productCategoryId = categoryIdNum;
    }
  }
  if ('isSingle' in src || 'is_single' in src || 'single' in src || 'singleProduct' in src) {
    const isSingleNormalized = normalizeBooleanLike(
      src.isSingle ?? src.is_single ?? src.single ?? src.singleProduct
    );
    if (typeof isSingleNormalized === 'boolean') out.isSingle = isSingleNormalized;
  }
  if ('productVariants' in src || 'variants' in src) {
    const variantsRaw = Array.isArray(src.productVariants)
      ? src.productVariants
      : Array.isArray(src.variants)
        ? src.variants
        : [];
    out.productVariants = normalizeProductVariantEntries(variantsRaw);
  }
  if ('slug' in src && src.slug != null) {
    const slug = String(src.slug).trim();
    if (slug) out.slug = slug;
  }
  if ('discountPercentage' in src || 'discount_percentage' in src) {
    const discountRaw = src.discountPercentage ?? src.discount_percentage;
    if (discountRaw !== undefined && discountRaw !== null && String(discountRaw).trim() !== '') {
      const d = Number(discountRaw);
      if (Number.isFinite(d) && d >= 0 && d <= 100) {
        out.discountPercentage = d;
      }
    }
  }
  if ('active' in src) {
    const a = normalizeBooleanLike(src.active);
    if (typeof a === 'boolean') out.active = a;
  }

  return out;
};

const normalizeProductPayloadForBackend = (input: Record<string, unknown>): Record<string, unknown> => {
  const src = input || {};
  const productName = String(src.productName ?? src.title ?? src.name ?? '').trim();
  const description = String(src.description ?? src.desc ?? '').trim();
  const productType = normalizeProductType(src.productType ?? src.type);
  const categoryRaw =
    src.productCategoryId ??
    src.categoryId ??
    ((src as any)?.productCategory?.id);
  const categoryIdNum = Number(categoryRaw ?? 0);

  const variantsRaw = Array.isArray(src.productVariants)
    ? src.productVariants
    : Array.isArray(src.variants)
      ? src.variants
      : [];
  const normalizedVariants = normalizeProductVariantEntries(variantsRaw);

  const out: Record<string, unknown> = {
    ...src,
    productName,
    description,
    productVariants: normalizedVariants,
  };
  if (productType) out.productType = productType;
  const isSingleNormalized = normalizeBooleanLike(
    src.isSingle ?? src.is_single ?? src.single ?? src.singleProduct
  );
  if (typeof isSingleNormalized === 'boolean') out.isSingle = isSingleNormalized;

  if (Number.isFinite(categoryIdNum) && categoryIdNum > 0) {
    out.productCategoryId = categoryIdNum;
  }

  const discountRaw = src.discountPercentage ?? src.discount_percentage;
  if (discountRaw !== undefined && discountRaw !== null && String(discountRaw).trim() !== '') {
    const d = Number(discountRaw);
    if (Number.isFinite(d) && d >= 0 && d <= 100) {
      out.discountPercentage = d;
    }
  } else {
    delete (out as any).discountPercentage;
    delete (out as any).discount_percentage;
  }
  delete (out as any).discount_percentage;

  delete (out as any).title;
  delete (out as any).name;
  delete (out as any).desc;
  delete (out as any).type;
  delete (out as any).categoryId;
  delete (out as any).variants;
  return out;
};

export const productService = {
  listForAdmin: async (params?: {
    page?: number;
    size?: number;
    isSingle?: boolean;
    productType?: string;
  }) => {
    const page = Number(params?.page ?? 0);
    const size = Number(params?.size ?? 12);
    const query = new URLSearchParams();
    query.set('page', String(page));
    query.set('size', String(size));
    if (typeof params?.isSingle === 'boolean') {
      query.set('isSingle', String(params.isSingle));
      query.set('is_single', String(params.isSingle));
    }
    if (String(params?.productType || '').trim()) {
      query.set('productType', String(params?.productType).trim());
    }
    const res = await apiClient.get<any>(`/api/product?${query.toString()}`, {
      headers: getAuthHeaders(),
    });
    const payload = res?.data?.data ?? res?.data ?? {};
    const content = Array.isArray(payload?.content) ? payload.content : [];
    return {
      success: true,
      data: content,
      page: Number(payload?.number ?? page),
      size: Number(payload?.size ?? size),
      totalPages: Number(payload?.totalPages ?? 1),
      totalElements: Number(payload?.totalElements ?? content.length),
    };
  },
  getByProductType: async (productType: string) => {
    const acc: APIProduct[] = [];
    const pageSize = 100;

    const mergeFromPayload = (payload: any) => {
      const rows = extractApiProductsFromProductListPayload(payload);
      mergeApiProductsUnique(acc, rows);
    };

    let first: { data: any } = { data: {} };
    const tryFirstUrls = [
      `/api/product?productType=${encodeURIComponent(productType)}`,
      `/api/product?type=${encodeURIComponent(productType)}`,
    ];
    for (const url of tryFirstUrls) {
      try {
        first = await apiClient.get<any>(url);
        mergeFromPayload(first.data);
        if (acc.length > 0) break;
      } catch {
        // nävbəti variant və ya səhifə skanı
      }
    }

    const pagedNorm = normalizeProductPageResponse(first.data);
    const lastFlag = Boolean(pagedNorm?.data?.last);

    // 2) If still empty OR page response suggests more pages, try explicit pagination
    if (acc.length === 0 || !lastFlag) {
      for (let page = 0; page < 30; page += 1) {
        try {
          const res = await apiClient.get<any>(
            `/api/product?productType=${encodeURIComponent(productType)}&page=${page}&size=${pageSize}`
          );
          mergeFromPayload(res.data);
          const norm = normalizeProductPageResponse(res.data);
          const chunk = extractApiProductsFromProductListPayload(res.data);
          if (!norm && chunk.length === 0 && page === 0) continue;
          if (norm?.data?.last === true) break;
          if (chunk.length < pageSize) break;
        } catch {
          break;
        }
      }
    }

    if (acc.length === 0) {
      try {
        const scanned = await collectProductsByScanningAllPages(productType);
        mergeApiProductsUnique(acc, scanned);
      } catch {
        // yalnız filter sorğusuna güvənirik
      }
    }

    if (acc.length > 0) {
      const meta = normalizeProductPageResponse(first.data)?.data ?? {};
      return {
        success: true,
        data: {
          ...meta,
          content: acc.map((item: APIProduct) => mapProduct(item)),
          empty: false,
          numberOfElements: acc.length,
        } as PageableResponse<Product>,
        message: first.data?.message,
        errorCode: first.data?.errorCode,
      };
    }

    const normalizedFallback = normalizeProductPageResponse(first.data);
    if (normalizedFallback) return normalizedFallback;
    return first.data as APIResponse<PageableResponse<Product>>;
  },
  getAllRaw: async (page = 0, size = 12, opts?: { isSingle?: boolean }) => {
    const qp = `page=${page}&size=${size}${opts?.isSingle === true ? '&isSingle=true&is_single=true' : ''}`;
    const res = await apiClient.get<any>(`/api/product?${qp}`);
    const normalized = normalizeRawProductPageResponse(res.data);
    if (normalized) return normalized;
    return res.data as APIResponse<PageableResponse<APIProduct>>;
  },
  getAll: async (page = 0, size = 12, opts?: { isSingle?: boolean }) => {
    const qp = `page=${page}&size=${size}${opts?.isSingle === true ? '&isSingle=true&is_single=true' : ''}`;
    const res = await apiClient.get<APIResponse<PageableResponse<APIProduct>>>(`/api/product?${qp}`);
    const normalized = normalizeProductPageResponse(res.data, opts);
    if (normalized) return normalized;
    return res.data as any;
  },
  getByCategory: async (categoryId: number, page = 0, size = 12, opts?: { isSingle?: boolean }) => {
    const qp = `page=${page}&size=${size}${opts?.isSingle === true ? '&isSingle=true&is_single=true' : ''}`;
    const res = await apiClient.get<APIResponse<PageableResponse<APIProduct>>>(
      `/api/product/category/${categoryId}/product?${qp}`
    );
    const normalized = normalizeProductPageResponse(res.data, opts);
    if (normalized) return normalized;
    return res.data as any;
  },
  getBySlug: async (slug: string) => {
    const res = await apiClient.get<APIResponse<APIProduct>>(`/api/product/${slug}`);
    return res.data;
  },
  getById: async (id: number) => {
    const candidates = [
      `/api/product/${id}`,
      `/api/product/id/${id}`,
    ];
    for (const endpoint of candidates) {
      try {
        const res = await apiClient.get<any>(endpoint);
        const payload = res?.data?.data ?? res?.data ?? null;
        if (payload && typeof payload === 'object') return payload;
      } catch {
        // try next endpoint
      }
    }

    // Fallback: scan product pages and return matched id if direct endpoint is unavailable.
    const pageSize = 100;
    let page = 0;
    let totalPages = 1;
    while (page < totalPages) {
      const res = await apiClient.get<any>(`/api/product?page=${page}&size=${pageSize}`);
      const payload = res.data?.data ?? res.data ?? {};
      const content = Array.isArray(payload?.content) ? payload.content : [];
      const found = content.find((p: any) => Number(p?.id) === Number(id));
      if (found) return found;
      totalPages = Number(payload?.totalPages ?? 1);
      page += 1;
    }
    return null;
  },
  create: async (payload: {
    product: Record<string, unknown>;
    images?: File[];
  }) => {
    const normalizedPayload = normalizeProductPayloadForBackend(payload.product || {});
    const formData = new FormData();
    formData.append('product', JSON.stringify(normalizedPayload));
    for (const file of payload.images || []) {
      formData.append('images', file);
    }
    try {
      const res = await apiClient.post<any>('/api/product', formData, {
        headers: getAuthHeaders(),
        transformRequest: [(data: any, reqHeaders: any) => {
          if (reqHeaders) {
            delete reqHeaders['Content-Type'];
            delete reqHeaders.common?.['Content-Type'];
            delete reqHeaders.post?.['Content-Type'];
          }
          return data;
        }],
      });
      return res.data;
    } catch (err: any) {
      console.error('status:', err?.response?.status);
      console.error('backend message:', err?.response?.data?.message);
      console.error('backend body:', err?.response?.data);
      throw err;
    }
  },
  update: async (id: number, payload: Record<string, unknown>, images?: File[]) => {
    const normalizedPayload = normalizeProductPayloadForPatch(payload || {});
    const imageList = Array.isArray(images) ? images.filter(Boolean) : [];
    if (imageList.length > 0) {
      const makeFormData = (asJsonBlob: boolean) => {
        const formData = new FormData();
        const raw = JSON.stringify(normalizedPayload);
        formData.append(
          'product',
          asJsonBlob ? (new Blob([raw], { type: 'application/json' }) as any) : raw
        );
        for (const file of imageList) {
          formData.append('images', file);
          // Compat: bəzi serverlər tək fayl üçün `image` açarı gözləyir.
          formData.append('image', file);
        }
        return formData;
      };

      const cfg = {
        headers: getAuthHeaders(),
        transformRequest: [(data: any, reqHeaders: any) => {
          if (reqHeaders) {
            delete reqHeaders['Content-Type'];
            delete reqHeaders.common?.['Content-Type'];
            delete reqHeaders.patch?.['Content-Type'];
            delete reqHeaders.post?.['Content-Type'];
          }
          return data;
        }],
      };

      let lastError: any = null;
      for (const asJsonBlob of [false, true]) {
        try {
          const res = await apiClient.patch<any>(
            `/api/product/${id}`,
            makeFormData(asJsonBlob),
            cfg
          );
          return res.data;
        } catch (err: any) {
          console.error('status:', err?.response?.status);
          console.error('backend message:', err?.response?.data?.message);
          console.error('backend body:', err?.response?.data);
          lastError = err;
        }
      }
      throw lastError;
    }

    try {
      const res = await apiClient.patch<any>(`/api/product/${id}`, normalizedPayload, {
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      });
      return res.data;
    } catch (err: any) {
      console.error('status:', err?.response?.status);
      console.error('backend message:', err?.response?.data?.message);
      console.error('backend body:', err?.response?.data);
      throw err;
    }
  },

  /**
   * PATCH qismən yeniləmə (Gateway məs: `PATCH /api/product/{id}`, JSON).
   * Məsələn: `patchFields(id, { discountPercentage: 15 })` — yalnız endirim göndərilir.
   */
  patchFields: async (id: number, partial: Record<string, unknown>) => {
    const body = normalizeProductPayloadForPatch(partial || {});
    const res = await apiClient.patch<any>(`/api/product/${id}`, body, {
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    });
    return res.data;
  },

  remove: async (id: number) => {
    const res = await apiClient.delete<any>(`/api/product/${id}`, {
      headers: getAuthHeaders(),
    });
    return res.data;
  },
  filter: async (params: {
    categoryId?: number;
    minPrice?: number;
    maxPrice?: number;
    color?: string;
    isSingle?: boolean;
  }) => {
    // The filter endpoint returns a direct list of APIProduct[] based on user example
    const axiosParams = {
      ...(params.categoryId != null ? { categoryId: params.categoryId } : {}),
      ...(typeof params.minPrice === 'number' ? { minPrice: params.minPrice } : {}),
      ...(typeof params.maxPrice === 'number' ? { maxPrice: params.maxPrice } : {}),
      ...(params.color ? { color: params.color } : {}),
      ...(params.isSingle === true ? { isSingle: true } : {}),
    };
    const res = await apiClient.get<APIProduct[]>('/api/product/filter', { params: axiosParams });
    return {
      success: true,
      data: res.data.map(mapProduct)
    };
  }
};

export type ProductVariantAdmin = {
  id: number;
  price?: number;
  size?: string;
  color?: string;
  variantName?: string;
  imageUrl?: string;
  /** Variant üçün xüsusi endirim %; göstərilməyəndə məhsul səviyyəli endirim keçərlidir */
  discountPercentage?: number;
};

/** Admin UI data URL → upload üçün `File` (create/update multipart). */
export function variantDataUrlToImageFile(rawImageUrl: string): File | null {
  const trimmed = String(rawImageUrl || '').trim();
  if (!/^data:image\//i.test(trimmed)) return null;
  try {
    const [header, data] = trimmed.split(',');
    const mime = header.match(/data:(.*?)(;|$)/i)?.[1] || 'image/png';
    const ext = (mime.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '') || 'png';
    const binary = atob(data || '');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], `variant-${Date.now()}.${ext}`, { type: mime });
  } catch {
    return null;
  }
}

function variantMultipartAxiosExtras() {
  return {
    transformRequest: [
      (data: any, reqHeaders: any) => {
        if (reqHeaders) {
          delete reqHeaders['Content-Type'];
          delete reqHeaders.common?.['Content-Type'];
          delete reqHeaders.post?.['Content-Type'];
          delete reqHeaders.put?.['Content-Type'];
          delete reqHeaders.patch?.['Content-Type'];
        }
        return data;
      },
    ],
  };
}

export const variantService = {
  createForProduct: async (
    productId: number,
    payload: {
      price: number;
      size?: string;
      color?: string;
      variantName?: string;
      imageUrl?: string;
      quantity?: number;
      discountPercentage?: number;
    }
  ) => {
    const body: Record<string, unknown> = {
      price: payload.price,
      ...(payload.size ? { size: payload.size } : {}),
      ...(payload.color ? { color: payload.color } : {}),
      ...(payload.variantName ? { variantName: payload.variantName } : {}),
      ...(typeof payload.quantity === 'number' ? { quantity: payload.quantity } : {}),
      ...(typeof payload.discountPercentage === 'number' &&
      Number.isFinite(payload.discountPercentage) &&
      payload.discountPercentage >= 0 &&
      payload.discountPercentage <= 100
        ? { discountPercentage: payload.discountPercentage }
        : {}),
    };
    const rawImageUrl = String(payload.imageUrl || '').trim();
    const imageFile = variantDataUrlToImageFile(rawImageUrl);
    if (!imageFile && rawImageUrl) body.imageUrl = rawImageUrl;

    const formData = new FormData();
    formData.append('variant', JSON.stringify(body));
    if (imageFile) formData.append('image', imageFile);

    const headers: Record<string, string> = { ...getAuthHeaders() };
    const res = await apiClient.post<any>(`/api/variant/${productId}/multipart`, formData, {
      headers,
      ...variantMultipartAxiosExtras(),
    });
    return res.data;
  },

  /** Mövcud variant + yeni şəkil faylı (backend endpoint create ilə eyni üslubda). */
  updateMultipart: async (
    variantId: number,
    payload: Record<string, unknown>,
    imageFile: File | null
  ) => {
    const formData = new FormData();
    formData.append('variant', JSON.stringify(payload));
    if (imageFile) formData.append('image', imageFile);
    const headers: Record<string, string> = { ...getAuthHeaders() };
    const extra = variantMultipartAxiosExtras();
    let lastError: unknown = null;
    for (const method of ['patch', 'put', 'post'] as const) {
      try {
        const res = await apiClient[method]<any>(`/api/variant/${variantId}/multipart`, formData, {
          headers,
          ...extra,
        });
        return res.data;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError;
  },
  getById: async (id: number): Promise<ProductVariantAdmin | null> => {
    const res = await apiClient.get<any>(`/api/variant/${id}`, {
      headers: getAuthHeaders(),
    });
    const p = res?.data?.data ?? res?.data ?? null;
    if (!p || typeof p !== 'object') return null;
    const vd = readVariantDiscountFromObj(p as any);
    return {
      id: Number((p as any).id ?? id),
      price: Number((p as any).price ?? 0),
      size: String((p as any).size ?? ''),
      color: String((p as any).color ?? ''),
      variantName: String((p as any).variantName ?? (p as any).variant_name ?? ''),
      imageUrl: String((p as any).imageUrl ?? (p as any).image_url ?? ''),
      ...(vd !== undefined ? { discountPercentage: vd } : {}),
    };
  },
  listByProduct: async (productId: number): Promise<ProductVariantAdmin[]> => {
    try {
      const res = await apiClient.get<any>(`/api/variant/product/${productId}`, {
        headers: getAuthHeaders(),
      });
      const list = listFromAnyPayload(res.data);
      return list.map((v: any) => {
        const vd = readVariantDiscountFromObj(v);
        return {
          id: Number(v?.id ?? 0),
          price: Number(v?.price ?? 0),
          size: String(v?.size ?? ''),
          color: String(v?.color ?? ''),
          variantName: String(v?.variantName ?? v?.variant_name ?? ''),
          imageUrl: String(v?.imageUrl ?? v?.image_url ?? ''),
          ...(vd !== undefined ? { discountPercentage: vd } : {}),
        };
      }).filter((x: ProductVariantAdmin) => x.id > 0);
    } catch {
      const p = await productService.getById(productId);
      const list = Array.isArray((p as any)?.productVariants) ? (p as any).productVariants : [];
      return list.map((v: any) => {
        const vd = readVariantDiscountFromObj(v);
        return {
          id: Number(v?.id ?? 0),
          price: Number(v?.price ?? 0),
          size: String(v?.size ?? ''),
          color: String(v?.color ?? ''),
          variantName: String(v?.variantName ?? v?.variant_name ?? ''),
          imageUrl: String(v?.imageUrl ?? v?.image_url ?? ''),
          ...(vd !== undefined ? { discountPercentage: vd } : {}),
        };
      }).filter((x: ProductVariantAdmin) => x.id > 0);
    }
  },
  update: async (id: number, payload: Partial<ProductVariantAdmin> & { price?: number }) => {
    const bodies = [
      payload,
      { variantRequest: payload },
      { data: payload },
    ];
    const methods: Array<'patch' | 'put' | 'post'> = ['patch', 'put', 'post'];
    let lastError: any = null;
    for (const method of methods) {
      for (const body of bodies) {
        try {
          const res =
            method === 'patch'
              ? await apiClient.patch<any>(`/api/variant/${id}`, body, { headers: getAuthHeaders() })
              : method === 'put'
                ? await apiClient.put<any>(`/api/variant/${id}`, body, { headers: getAuthHeaders() })
                : await apiClient.post<any>(`/api/variant/${id}`, body, { headers: getAuthHeaders() });
          return res.data;
        } catch (err: any) {
          lastError = err;
        }
      }
    }
    throw lastError;
  },
  remove: async (id: number) => {
    const res = await apiClient.delete<any>(`/api/variant/${id}`, {
      headers: getAuthHeaders(),
    });
    return res.data;
  },
};

export const categoryService = {
  getById: async (id: number) => {
    const res = await apiClient.get<APIResponse<Category>>(`/api/category/${id}`);
    return res.data;
  },
  getAll: async () => {
    // If backend supports it, otherwise manually defined
    const res = await apiClient.get<APIResponse<Category[]>>('/api/category');
    return res.data;
  }
};

export const authService = {
  login: async (credentials: any) => {
    const res = await postWithFallback<LoginResponse>(
      ['/api/auth/login'],
      credentials
    );
    const accessToken =
      (res as any)?.data?.accessToken ??
      (res as any)?.accessToken ??
      (res as any)?.data?.access_token ??
      (res as any)?.access_token ??
      (res as any)?.data?.token ??
      (res as any)?.token ??
      (res as any)?.data?.jwt ??
      (res as any)?.jwt;
    const refreshToken =
      (res as any)?.data?.refreshToken ??
      (res as any)?.refreshToken;
    if (typeof accessToken === 'string' && accessToken.trim()) {
      const normalizedAccessToken = accessToken.trim().replace(/^Bearer\s+/i, '');
      localStorage.setItem('accessToken', normalizedAccessToken);
      localStorage.setItem('access_token', normalizedAccessToken);
      // Keep legacy key in sync for places still reading "token".
      localStorage.setItem('token', normalizedAccessToken);
    }
    if (typeof refreshToken === 'string' && refreshToken.trim()) {
      localStorage.setItem('refreshToken', refreshToken.trim());
    }
    return res;
  },
  register: async (data: any) => {
    return postWithFallback<any>(
      ['/api/auth/register'],
      data
    );
  },
  getMe: async () => {
    try {
      const res = await apiClient.get<any>('/api/auth/me', { headers: getAuthHeaders() });
      return normalizeUserResponse(res.data);
    } catch (e: any) {
      if (e?.response?.status === 401) {
        clearStoredAuth();
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
      throw e;
    }
  },
  getAllUsers: async () => {
    const candidates = [
      '/api/auth/users',
      '/auth/users',
      '/api/users',
      '/users',
    ];
    let lastError: any = null;
    for (const endpoint of candidates) {
      try {
        const res = await apiClient.get<any>(endpoint, { headers: getAuthHeaders() });
        const list = listFromAnyPayload(res.data);
        return {
          success: true,
          data: list,
          raw: res.data,
        };
      } catch (e: any) {
        const status = e?.response?.status;
        // Endpoint mismatch: keep trying alternative paths.
        if ([404, 405].includes(status)) {
          lastError = e;
          continue;
        }
        lastError = e;
        // For non-route errors (401/403/500...), stop early.
        break;
      }
    }
    throw lastError;
  },
  updateUserRole: async (
    id: number,
    role: 'USER' | 'ADMIN' | 'AGRONOMIST' | 'FLORIST' | 'COURIER'
  ) => {
    const body = { role };
    const candidates = [`/api/auth/users/${id}/role`, `/auth/users/${id}/role`];
    let lastError: any = null;
    for (const endpoint of candidates) {
      try {
        const res = await apiClient.patch<any>(endpoint, body, { headers: getAuthHeaders() });
        return res.data;
      } catch (e: any) {
        const status = e?.response?.status;
        if ([404, 405].includes(status)) {
          lastError = e;
          continue;
        }
        lastError = e;
        break;
      }
    }
    throw lastError;
  },
  updateUserStatus: async (id: number, active: boolean) => {
    const boolVal = Boolean(active);
    const statusText = boolVal ? 'ACTIVE' : 'INACTIVE';
    const bodyCandidates = [
      { status: statusText },
      { active: boolVal },
      { enabled: boolVal },
      { isActive: boolVal },
    ];
    const endpoint = `/api/auth/users/${id}/status`;
    let lastError: any = null;
    for (const body of bodyCandidates) {
      try {
        const res = await apiClient.patch<any>(endpoint, body, { headers: getAuthHeaders() });
        return res.data;
      } catch (ePatch: any) {
        lastError = ePatch;
      }
    }
    throw lastError;
  },
  forgotPassword: async (payload: { email: string }) => {
    const normalizedEmail = payload.email.trim().toLowerCase();
    const requestBody = { email: normalizedEmail };

    if (import.meta.env.DEV) {
      // Useful while validating what frontend actually sends.
      console.debug('[authService.forgotPassword] request payload:', requestBody);
    }

    const res = await apiClient.post<APIResponse<unknown>>(
      '/api/auth/forgot-password',
      requestBody
    );
    return res.data;
  },
  resetPassword: async (payload: { token: string; password: string; confirmPassword?: string }) => {
    const token = payload.token.trim();
    const password = payload.password;
    const confirmPassword = payload.confirmPassword ?? payload.password;

    return postWithFallback<APIResponse<unknown>>(
      [
        '/api/auth/reset-password',
        '/api/auth/password-reset',
      ],
      {
        token,
        password,
        newPassword: password,
        confirmPassword,
      }
    );
  },
  getSubscriptionPlans: async () => {
    const candidates = ['/api/auth/subscriptions/plans'];
    let lastError: any = null;
    for (const endpoint of candidates) {
      try {
        const res = await apiClient.get<any>(endpoint, { headers: getAuthHeaders() });
        return res.data?.data ?? res.data ?? [];
      } catch (err: any) {
        lastError = err;
      }
    }
    throw lastError;
  },
  getClubSettings: async () => {
    const candidates = ['/api/auth/subscriptions/settings'];
    let lastError: any = null;
    for (const endpoint of candidates) {
      try {
        const res = await apiClient.get<any>(endpoint, { headers: getAuthHeaders() });
        return res.data?.data ?? res.data ?? null;
      } catch (err: any) {
        lastError = err;
      }
    }
    throw lastError;
  },
  saveClubSettings: async (settings: any) => {
    const candidates = ['/api/auth/admin/subscriptions/settings'];
    let lastError: any = null;
    for (const endpoint of candidates) {
      try {
        const res = await apiClient.post<any>(endpoint, settings, { headers: getAuthHeaders() });
        return res.data?.data ?? res.data ?? null;
      } catch (err: any) {
        lastError = err;
      }
    }
    throw lastError;
  },
  saveSubscriptionPlan: async (plan: any) => {
    const candidates = ['/api/auth/admin/subscriptions/plans'];
    let lastError: any = null;
    for (const endpoint of candidates) {
      try {
        const res = await apiClient.post<any>(endpoint, plan, { headers: getAuthHeaders() });
        return res.data?.data ?? res.data ?? null;
      } catch (err: any) {
        lastError = err;
      }
    }
    throw lastError;
  },
  deleteSubscriptionPlan: async (code: string) => {
    const candidates = [`/api/auth/admin/subscriptions/plans/${code}`];
    let lastError: any = null;
    for (const endpoint of candidates) {
      try {
        const res = await apiClient.delete<any>(endpoint, { headers: getAuthHeaders() });
        return res.data?.data ?? res.data ?? null;
      } catch (err: any) {
        lastError = err;
      }
    }
    throw lastError;
  },
  checkoutSubscription: async (payload: {
    planCode: string;
    style: string;
    frequency: string;
    recipientName: string;
    recipientPhone: string;
    deliveryAddress: string;
    firstDeliveryDate: string;
  }) => {
    const candidates = ['/api/auth/subscriptions/checkout'];
    let lastError: any = null;
    for (const endpoint of candidates) {
      try {
        const res = await apiClient.post<any>(endpoint, payload, { headers: getAuthHeaders() });
        return res.data?.data ?? res.data ?? null;
      } catch (err: any) {
        lastError = err;
      }
    }
    throw lastError;
  },
  getMySubscription: async () => {
    const candidates = ['/api/auth/subscriptions/me'];
    let lastError: any = null;
    for (const endpoint of candidates) {
      try {
        const res = await apiClient.get<any>(endpoint, { headers: getAuthHeaders() });
        return res.data?.data ?? res.data ?? null;
      } catch (err: any) {
        lastError = err;
      }
    }
    throw lastError;
  },
  updateMe: async (data: Partial<User> & { password?: string; confirmPassword?: string }) => {
    const endpoints = [
      '/api/auth/me',
      '/api/auth/profile',
      '/api/user/me',
      '/api/users/me'
    ];

    for (const endpoint of endpoints) {
      try {
        const res = await apiClient.put<any>(endpoint, data);
        return normalizeUserResponse(res.data);
      } catch (err: any) {
        if (err?.response?.status && ![404, 405].includes(err.response.status)) {
          throw err;
        }
      }
    }

    throw new Error('Profil yeniləmə endpointi tapılmadı');
  },
  renderBouquet: async (config: any) => {
    const response = await apiClient.post('/api/bouquet/render', config, {
      headers: getAuthHeaders()
    });
    return response.data?.data ?? response.data;
  },
  getRenderPackages: async (opts?: { bypassCache?: boolean }) => {
    if (!opts?.bypassCache) {
      const cached = localStorage.getItem('mock_render_packages');
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          //
        }
      }
    }
    const candidates = ['/api/bouquet/render-packages', '/bouquet/render-packages'];
    let lastError: any = null;
    for (const endpoint of candidates) {
      try {
        const res = await apiClient.get<any>(endpoint);
        return res.data?.data ?? res.data ?? [];
      } catch (err: any) {
        lastError = err;
      }
    }
    throw lastError;
  },
  purchaseRenders: async (payload: { packageCode: string; paymentReference: string }) => {
    const candidates = ['/api/bouquet/purchase-renders', '/bouquet/purchase-renders'];
    let lastError: any = null;
    for (const endpoint of candidates) {
      try {
        const res = await apiClient.post<any>(endpoint, payload, { headers: getAuthHeaders() });
        return res.data?.data ?? res.data ?? null;
      } catch (err: any) {
        lastError = err;
      }
    }
    throw lastError;
  },
  logout: async () => {
    try {
      await apiClient.post('/api/auth/logout', null, { headers: getAuthHeaders() });
    } catch {
      // safe fallback
    }
  },
  refresh: async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    const res = await apiClient.post<any>('/api/auth/refresh', { refreshToken });
    return res.data?.data ?? res.data ?? null;
  }
};

export const cartService = {
  createCart: async (payload?: { userId?: number }) => {
    try {
      const res = await apiClient.post<Cart>('/api/cart', payload || {}, {
        headers: getAuthHeaders(),
      });
      return res.data;
    } catch (err: any) {
      // Some backends return conflict when cart already exists.
      if (err?.response?.status === 409 && payload?.userId) {
        return cartService.getCart(payload.userId);
      }
      throw err;
    }
  },
  addItem: async (
    userId: number,
    payload: {
      productId: number;
      productName: string;
      unitPrice: number;
      quantity: number;
      imageUrl?: string;
      productImageUrl?: string;
      productVariantId?: number;
      variantId?: number;
      size?: string;
      color?: string;
      variantName?: string;
    }
  ) => {
    const candidates = [
      `/api/cart/${userId}/items`,
      `/api/cart/items`,
    ];
    let lastError: any = null;
    for (const endpoint of candidates) {
      try {
        const res = await apiClient.post<Cart>(endpoint, payload, {
          headers: getAuthHeaders(),
        });
        return res.data;
      } catch (err: any) {
        lastError = err;
      }
    }
    throw lastError;
  },
  getCart: async (userId?: number) => {
    const candidates = [
      ...(userId ? [`/api/cart/${userId}`] : []),
      `/api/cart`,
    ];
    let lastError: any = null;
    for (const endpoint of candidates) {
      try {
        const res = await apiClient.get<Cart>(endpoint, {
          headers: getAuthHeaders(),
        });
        return res.data;
      } catch (err: any) {
        lastError = err;
      }
    }
    throw lastError;
  },
  updateItem: async (userId: number | undefined, productId: number, payload: { quantity: number }) => {
    const candidates = [
      ...(userId ? [`/api/cart/${userId}/items/${productId}`] : []),
      `/api/cart/items/${productId}`,
    ];
    let lastError: any = null;
    for (const endpoint of candidates) {
      try {
        const res = await apiClient.put<Cart>(endpoint, payload, {
          headers: getAuthHeaders(),
        });
        return res.data;
      } catch (err: any) {
        lastError = err;
      }
    }
    throw lastError;
  },
  deleteItem: async (userId: number | undefined, productId: number) => {
    const candidates = [
      ...(userId ? [`/api/cart/${userId}/items/${productId}`] : []),
      `/api/cart/items/${productId}`,
    ];
    let lastError: any = null;
    for (const endpoint of candidates) {
      try {
        const res = await apiClient.delete<Cart>(endpoint, {
          headers: getAuthHeaders(),
        });
        return res.data;
      } catch (err: any) {
        lastError = err;
      }
    }
    throw lastError;
  },
  clearCart: async (userId?: number) => {
    const candidates = [
      ...(userId ? [`/api/cart/${userId}/items`] : []),
      `/api/cart/items`,
      `/api/cart/clear`,
    ];
    let lastError: any = null;
    for (const endpoint of candidates) {
      try {
        const res = await apiClient.delete<Cart>(endpoint, {
          headers: getAuthHeaders(),
        });
        return res.data;
      } catch (err: any) {
        lastError = err;
      }
    }
    throw lastError;
  }
};

const getAuthHeaders = () => {
  const token = readStoredAuthToken();
  if (!token) return {};
  const normalizedToken = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  return { Authorization: normalizedToken };
};

export const checkoutService = {
  createCustomBouquetDraft: async (payload: {
    userId: number;
    composition: string;
    image: File;
  }) => {
    const formData = new FormData();
    formData.append('userId', String(payload.userId));
    formData.append('composition', payload.composition);
    formData.append('image', payload.image);

    const headers: Record<string, string> = { ...getAuthHeaders() };
    delete (apiClient.defaults.headers.post as any)?.['Content-Type'];
    const res = await apiClient.post<any>('/api/order/custom-bouquet/draft', formData, {
      headers,
      transformRequest: [(data, reqHeaders) => {
        if (reqHeaders) {
          delete (reqHeaders as any)['Content-Type'];
          delete (reqHeaders as any).common?.['Content-Type'];
          delete (reqHeaders as any).post?.['Content-Type'];
        }
        return data;
      }],
    });
    return res.data;
  },
  completeCustomBouquetOrder: async (payload: {
    draftId: number;
    userId?: number;
    addressLine: string;
    city: string;
    addressNote?: string;
    deliveryDate: string;
    deliveryTimeSlot:
      | 'SLOT_00_03'
      | 'SLOT_03_06'
      | 'SLOT_06_09'
      | 'SLOT_09_12'
      | 'SLOT_12_15'
      | 'SLOT_15_18'
      | 'SLOT_18_21'
      | 'SLOT_21_24';
    paymentMethod: 'CARD' | 'CASH';
    quantity: number;
    unitPrice: number;
    successUrl?: string;
    cancelUrl?: string;
    failUrl?: string;
    callbackUrl?: string;
  }) => {
    try {
      const res = await apiClient.post<any>('/api/order/custom-bouquet/checkout', payload, {
        headers: getAuthHeaders(),
      });
      return res.data;
    } catch (err: any) {
      // Some backends derive user from token and reject explicit userId with 403.
      if (err?.response?.status === 403 && payload?.userId != null) {
        const { userId, ...payloadWithoutUserId } = payload;
        const retryRes = await apiClient.post<any>(
          '/api/order/custom-bouquet/checkout',
          payloadWithoutUserId,
          { headers: getAuthHeaders() }
        );
        return retryRes.data;
      }
      throw err;
    }
  },
  completeOrder: async (payload: {
    userId: number;
    addressLine: string;
    city: string;
    distanceKm: number;
    addressNote?: string;
    deliveryDate: string;
    deliveryTimeSlot:
      | 'SLOT_00_03'
      | 'SLOT_03_06'
      | 'SLOT_06_09'
      | 'SLOT_09_12'
      | 'SLOT_12_15'
      | 'SLOT_15_18'
      | 'SLOT_18_21'
      | 'SLOT_21_24';
    paymentMethod: 'CARD' | 'CASH';
    contactPhone?: string;
    successUrl?: string;
    cancelUrl?: string;
    failUrl?: string;
    callbackUrl?: string;
  }) => {
    const {
      successUrl,
      cancelUrl,
      failUrl,
      callbackUrl,
      ...basePayload
    } = payload;

    const payloadWithUrls = {
      ...basePayload,
      ...(successUrl ? { successUrl } : {}),
      ...(cancelUrl ? { cancelUrl } : {}),
      ...(failUrl ? { failUrl } : {}),
      ...(callbackUrl ? { callbackUrl } : {}),
    };
    const payloadWithoutUrls = { ...basePayload };
    const candidates = [
      payloadWithUrls,
      payloadWithoutUrls,
    ];

    let lastError: any = null;
    for (const body of candidates) {
      try {
        const res = await apiClient.post<any>('/api/order/checkout', body, {
          headers: getAuthHeaders(),
        });
        return res.data;
      } catch (err: any) {
        lastError = err;
      }
    }
    throw lastError;
  },
  payOrder: async (payload: { orderId: number }) => {
    const res = await apiClient.post<any>('/api/order/pay', payload, {
      headers: getAuthHeaders(),
    });
    return res.data;
  },
  getOrders: async (userId: number) => {
    const res = await apiClient.get<any>(`/api/order?userId=${userId}`, {
      headers: getAuthHeaders(),
    });
    return res.data;
  },
  getVariant: async (variantId: number) => {
    const res = await apiClient.get<any>(`/api/variant/${variantId}`, {
      headers: getAuthHeaders(),
    });
    return res.data?.data ?? res.data ?? null;
  },
  getProductById: async (productId: number) => {
    try {
      // Primary flow requested: variant -> productId -> product by id
      const res = await apiClient.get<any>(`/api/product/${productId}`, {
        headers: getAuthHeaders(),
      });
      return res.data?.data ?? res.data ?? null;
    } catch {
      // Fallback for environments where product endpoint is slug-based.
      const pageSize = 100;
      let page = 0;
      let totalPages = 1;
      while (page < totalPages) {
        const res = await apiClient.get<any>(`/api/product?page=${page}&size=${pageSize}`, {
          headers: getAuthHeaders(),
        });
        const payload = res.data?.data ?? res.data ?? {};
        const content = Array.isArray(payload?.content) ? payload.content : [];
        const matched = content.find((p: any) => Number(p?.id) === Number(productId));
        if (matched) return matched;
        totalPages = Number(payload?.totalPages ?? 1);
        page += 1;
      }
      return null;
    }
  },
  getProfileOrderItems: async (userId: number) => {
    const ordersResponse = await checkoutService.getOrders(userId);
    const orders = Array.isArray(ordersResponse)
      ? ordersResponse
      : Array.isArray(ordersResponse?.data)
        ? ordersResponse.data
        : Array.isArray(ordersResponse?.content)
          ? ordersResponse.content
          : [];

    const variantIds: number[] = Array.from(
      new Set(
        orders.flatMap((order: any) =>
          (Array.isArray(order?.items) ? order.items : [])
            .map((item: any) => Number(item?.productVariantId))
            .filter((id: number) => Number.isFinite(id) && id > 0)
        )
      )
    );

    const variantMap = new Map<number, any | null>();
    await Promise.all(
      variantIds.map(async (id) => {
        try {
          variantMap.set(id, await checkoutService.getVariant(id));
        } catch {
          variantMap.set(id, null);
        }
      })
    );

    const productIds: number[] = Array.from(
      new Set(
        [...variantMap.values()]
          .filter((variant: any) => Boolean(variant))
          .map((variant: any) => Number(variant?.productId))
          .filter((id: number) => Number.isFinite(id) && id > 0)
      )
    );

    const productMap = new Map<number, any | null>();
    await Promise.all(
      productIds.map(async (id) => {
        try {
          productMap.set(id, await checkoutService.getProductById(id));
        } catch {
          productMap.set(id, null);
        }
      })
    );

    return orders.flatMap((order: any) => {
      const orderItems = Array.isArray(order?.items) ? order.items : [];
      return orderItems.map((item: any) => {
        const variantId = Number(item?.productVariantId);
        const variant = Number.isFinite(variantId) && variantId > 0 ? variantMap.get(variantId) ?? null : null;
        const productId = Number(variant?.productId);
        const product = Number.isFinite(productId) && productId > 0 ? productMap.get(productId) ?? null : null;
        const productImages = Array.isArray(product?.images) ? product.images : [];
        const firstImage = productImages[0];
        const directItemImage =
          item?.image ??
          item?.imageUrl ??
          item?.productImageUrl ??
          item?.product?.image ??
          item?.product?.imageUrl ??
          item?.product?.productImageUrl ??
          '';
        const resolvedImage =
          variant?.imageUrl ||
          variant?.image ||
          (typeof firstImage === 'string' ? firstImage : firstImage?.imageUrl || firstImage?.url) ||
          product?.imageUrl ||
          product?.img ||
          directItemImage ||
          '';

        return {
          orderId: Number(order?.orderId ?? order?.id ?? 0),
          orderStatus: String(order?.status || order?.orderStatus || ''),
          createdAt: String(order?.createdAt || order?.createdDate || order?.date || ''),
          orderTotalPrice: Number(order?.totalPrice ?? order?.amount ?? 0),
          quantity: Number(item?.quantity ?? 0),
          orderPrice: Number(item?.price ?? item?.unitPrice ?? 0),
          variantId: Number.isFinite(variantId) ? variantId : 0,
          productId: Number.isFinite(productId) ? productId : undefined,
          slug: product?.slug ? String(product.slug) : undefined,
          productStatus: product?.status ? String(product.status) : undefined,
          image: resolvedImage || undefined,
          title: product?.productName || product?.name || item?.productName || item?.title || undefined,
          color: variant?.color || undefined,
          size: variant?.size || undefined,
          variantName: variant?.variantName || variant?.variant_name || undefined,
        };
      });
    });
  },
};

export type FavoriteItemResponse = {
  id: number;
  userId: number;
  productId: number;
  createdAt?: string;
  product?: APIProduct | null;
};

const normalizeFavoriteItem = (raw: any): FavoriteItemResponse | null => {
  const src = raw?.data && typeof raw.data === 'object' ? raw.data : raw;
  if (!src || typeof src !== 'object') return null;
  const productRaw =
    src?.product && typeof src.product === 'object'
      ? src.product
      : src?.productResponse && typeof src.productResponse === 'object'
        ? src.productResponse
        : null;
  const productId = Number(src?.productId ?? productRaw?.id ?? 0);
  if (!Number.isFinite(productId) || productId <= 0) return null;
  const out: FavoriteItemResponse = {
    id: Number(src?.id ?? 0),
    userId: Number(src?.userId ?? src?.user_id ?? 0),
    productId,
    createdAt: String(src?.createdAt ?? src?.created_at ?? '') || undefined,
    product: productRaw ? (productRaw as APIProduct) : null,
  };
  return out;
};

export const favoriteService = {
  addFavorite: async (productId: number, userId: number): Promise<FavoriteItemResponse | null> => {
    const res = await apiClient.post<any>(`/api/favorites/${productId}`, null, {
      headers: getAuthHeaders(),
      params: { userId },
    });
    return normalizeFavoriteItem(res.data);
  },
  removeFavorite: async (productId: number, userId: number): Promise<boolean> => {
    await apiClient.delete(`/api/favorites/${productId}`, {
      headers: getAuthHeaders(),
      params: { userId },
    });
    return true;
  },
  getFavorites: async (userId: number): Promise<FavoriteItemResponse[]> => {
    const res = await apiClient.get<any>('/api/favorites', {
      headers: getAuthHeaders(),
      params: { userId },
    });
    const list = listFromAnyPayload(res.data);
    return list.map(normalizeFavoriteItem).filter(Boolean) as FavoriteItemResponse[];
  },
  isFavorite: async (productId: number, userId: number): Promise<boolean> => {
    const res = await apiClient.get<any>(`/api/favorites/check/${productId}`, {
      headers: getAuthHeaders(),
      params: { userId },
    });
    const src = res.data?.data && typeof res.data.data === 'object' ? res.data.data : res.data;
    return Boolean(src?.favorite);
  },
};

const listFromAnyPayload = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.data?.rows)) return payload.data.rows;
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.data?.content)) return payload.data.content;
  if (Array.isArray(payload?.result?.content)) return payload.result.content;
  if (Array.isArray(payload?.orders)) return payload.orders;
  if (Array.isArray(payload?.data?.orders)) return payload.data.orders;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.data?.result)) return payload.data.result;

  // Deep fallback for inconsistent backend envelopes.
  const queue: unknown[] = [payload];
  const seen = new Set<unknown>();
  while (queue.length > 0) {
    const cur = queue.shift();
    if (!cur || typeof cur !== 'object' || seen.has(cur)) continue;
    seen.add(cur);
    if (Array.isArray(cur)) {
      const first = cur[0] as any;
      if (
        cur.length > 0 &&
        first &&
        typeof first === 'object' &&
        ('orderId' in first || 'id' in first || 'status' in first || 'orderStatus' in first)
      ) {
        return cur as any[];
      }
      for (const item of cur) queue.push(item);
      continue;
    }
    for (const v of Object.values(cur as Record<string, unknown>)) {
      queue.push(v);
    }
  }
  return [];
};

export const floristService = {
  getAllOrders: async () => {
    const candidates = [
      '/api/order/all/florist-view',
      '/api/order/florist-view',
      '/api/order/florist/my',
      '/api/order/me/florist/orders',
      '/api/order/florist/active',
      '/api/order/all',
    ];
    let lastError: any = null;
    for (let i = 0; i < candidates.length; i++) {
      const endpoint = candidates[i];
      try {
        const res = await apiClient.get<any>(endpoint, { headers: getAuthHeaders() });
        const list = listFromAnyPayload(res.data);
        // Bəzi endpointlər 200 + boş siyahı qaytarır, növbəti endpointdə data ola bilər.
        if (list.length === 0 && i < candidates.length - 1) {
          continue;
        }
        return {
          success: true,
          data: list,
          raw: res.data,
        };
      } catch (err: any) {
        lastError = err;
      }
    }
    const status = lastError?.response?.status;
    if (status === 403) {
      throw new Error('Florist roluna bütün sifarişləri görmək icazəsi verilməyib (403).');
    }
    if (status === 401) {
      throw new Error('Sessiya etibarsızdır və ya token göndərilmir (401). Yenidən daxil olun.');
    }
    throw lastError;
  },
  confirmPreparation: async (orderId: number, canPrepare: boolean) => {
    const candidates: Array<{ url: string; body: any }> = [
      { url: `/api/order/${orderId}/florist/confirm-preparable`, body: { preparable: canPrepare } },
      { url: `/api/order/${orderId}/florist/feasibility`, body: { canPrepare } },
      { url: `/api/order/${orderId}/prepare-confirmation`, body: { canPrepare } },
      { url: `/api/order/${orderId}/status`, body: { status: canPrepare ? 'PREPARING' : 'FLORIST_REJECTED' } },
      { url: `/api/order/${orderId}/status`, body: { status: canPrepare ? 'FLORIST_CONFIRMED' : 'FLORIST_REJECTED' } },
    ];
    let lastError: any = null;
    for (const candidate of candidates) {
      try {
        const res = await apiClient.patch<any>(candidate.url, candidate.body, { headers: getAuthHeaders() });
        return res.data;
      } catch (err: any) {
        lastError = err;
      }
    }
    throw lastError;
  },
  markPrepared: async (orderId: number) => {
    const candidates: Array<{ url: string; body: any }> = [
      { url: `/api/order/${orderId}/florist/ready`, body: {} },
      { url: `/api/order/${orderId}/florist/prepared`, body: {} },
      { url: `/api/order/${orderId}/prepared`, body: {} },
      { url: `/api/order/${orderId}/status`, body: { status: 'READY' } },
      { url: `/api/order/${orderId}/status`, body: { status: 'PREPARED' } },
    ];
    let lastError: any = null;
    for (const candidate of candidates) {
      try {
        const res = await apiClient.patch<any>(candidate.url, candidate.body, { headers: getAuthHeaders() });
        return res.data;
      } catch (err: any) {
        lastError = err;
      }
    }
    throw lastError;
  },
  markPreparedWithImage: async (orderId: number, image: File) => {
    const formData = new FormData();
    formData.append('image', image);
    formData.append('status', 'READY');

    const candidates: Array<{ method: 'patch' | 'post'; url: string }> = [
      { method: 'patch', url: `/api/order/${orderId}/florist/ready` },
      { method: 'post', url: `/api/order/${orderId}/florist/ready` },
      { method: 'patch', url: `/api/order/${orderId}/florist/prepared` },
      { method: 'post', url: `/api/order/${orderId}/florist/prepared` },
      { method: 'patch', url: `/api/order/${orderId}/prepared` },
      { method: 'post', url: `/api/order/${orderId}/prepared` },
      { method: 'patch', url: `/api/order/${orderId}/florist/ready-with-image` },
      { method: 'post', url: `/api/order/${orderId}/florist/ready-with-image` },
    ];

    let lastError: any = null;
    for (const candidate of candidates) {
      try {
        const headers: Record<string, string> = { ...getAuthHeaders() };
        const reqConfig = {
          headers,
          transformRequest: [(data: any, reqHeaders: any) => {
            if (reqHeaders) {
              delete reqHeaders['Content-Type'];
              delete reqHeaders.common?.['Content-Type'];
              delete reqHeaders.post?.['Content-Type'];
              delete reqHeaders.patch?.['Content-Type'];
            }
            return data;
          }],
        };
        const res =
          candidate.method === 'post'
            ? await apiClient.post<any>(candidate.url, formData, reqConfig)
            : await apiClient.patch<any>(candidate.url, formData, reqConfig);
        return res.data;
      } catch (err: any) {
        lastError = err;
      }
    }

    // Final fallback: status-ı yenilə, şəkil endpointi backenddə yoxdursa əməliyyat dayanmasın.
    await floristService.markPrepared(orderId);
    return { success: true };
  },
  handoverToCourier: async (
    orderId: number,
    courierInfo?: {
      courierPhone?: string;
      courierWhatsappPhone?: string;
      courierCarPlate?: string;
      courierCarModel?: string;
      courierPanelLink?: string;
    }
  ) => {
    const body = {
      courierPhone: courierInfo?.courierPhone || undefined,
      courierWhatsappPhone: courierInfo?.courierWhatsappPhone || undefined,
      courierCarPlate: courierInfo?.courierCarPlate || undefined,
      courierCarModel: courierInfo?.courierCarModel || undefined,
      courierPanelLink: courierInfo?.courierPanelLink || undefined,
    };
    const candidates: Array<{ url: string; body: any }> = [
      { url: `/api/order/${orderId}/florist/handover-courier`, body },
      { url: `/api/order/${orderId}/handover-courier`, body },
      { url: `/api/order/${orderId}/courier/handover`, body },
      { url: `/api/order/${orderId}/status`, body: { status: 'WITH_COURIER', ...body } },
      { url: `/api/order/${orderId}/status`, body: { status: 'ON_THE_WAY', ...body } },
    ];
    let lastError: any = null;
    for (const candidate of candidates) {
      try {
        const res = await apiClient.patch<any>(candidate.url, candidate.body, { headers: getAuthHeaders() });
        return res.data;
      } catch (err: any) {
        lastError = err;
      }
    }
    throw lastError;
  },
};

/**
 * Token ilə anonim çatdırılma məlumatı (endpoint backend-də varsa dolur).
 */
export const orderPublicTrackingService = {
  getSnapshot: async (orderId: number, access: string): Promise<any | null> => {
    if (!orderId || !access) return null;
    const enc = encodeURIComponent(access);
    const candidates = [
      `/api/public/order/${orderId}/tracking?access=${enc}`,
      `/api/order/${orderId}/tracking?access=${enc}`,
      `/api/order/${orderId}/track?access=${enc}`,
      `/api/order/${orderId}/courier-tracking?access=${enc}`,
      `/api/order/${orderId}/courier/live?access=${enc}`,
      `/api/order/${orderId}/courier-location?access=${enc}`,
      `/api/order/${orderId}/live-location?access=${enc}`,
      `/api/order/${orderId}/delivery-tracking?access=${enc}`,
      `/api/order/${orderId}/public-tracking?access=${enc}`,
      // Bəzi backend versiyalarında access query-siz public tracking mövcuddur.
      `/api/public/order/${orderId}/tracking`,
      `/api/order/${orderId}/tracking`,
      `/api/order/${orderId}/track`,
      `/api/order/${orderId}/courier-tracking`,
      `/api/order/${orderId}/courier/live`,
      `/api/order/${orderId}/courier-location`,
      `/api/order/${orderId}/live-location`,
      `/api/order/${orderId}/delivery-tracking`,
      `/api/order/${orderId}/public-tracking`,
    ];
    let mergedPayload: Record<string, unknown> | null = null;
    for (const endpoint of candidates) {
      try {
        const res = await apiClient.get<any>(endpoint);
        const layer = unwrapTrackingPayload(res.data);
        if (!layer) continue;
        mergedPayload = mergeNonEmptySnapFields(mergedPayload, layer);
      } catch {
        // növbəti path
      }
    }
    return mergedPayload;
  },
};

function unwrapTrackingPayload(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object') return null;
  const p = body as Record<string, unknown>;
  let inner: Record<string, unknown> =
    'data' in p && typeof p.data === 'object' && p.data ? (p.data as Record<string, unknown>) : p;
  if (inner.order && typeof inner.order === 'object') {
    inner = { ...inner, ...(inner.order as Record<string, unknown>) };
  }
  return inner;
}

function mergeNonEmptySnapFields(
  prev: Record<string, unknown> | null,
  next: Record<string, unknown>
): Record<string, unknown> {
  if (!prev) return { ...next };
  const out = { ...prev };
  for (const [k, v] of Object.entries(next)) {
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (s === '') continue;
    out[k] = v;
  }
  return out;
}

export const courierService = {
  /**
   * Kuryerə təyin olunmuş / çatdırılmalı sifarişlər.
   * Backend prioritetləri: yalnız cari kuryerə aid orderlar qaytarmalıdır.
   */
  getCourierOrders: async (opts?: { cacheBust?: boolean }) => {
    const bust = opts?.cacheBust ? { params: { _t: Date.now() } as const } : {};
    const candidates = [
      '/api/order/courier/my',
      '/api/order/me/courier/orders',
      '/api/order/courier/active',
      '/api/order/all/courier-view',
      '/api/order/courier-view',
      '/api/order/all',
    ];
    let lastError: any = null;
    for (const endpoint of candidates) {
      try {
        const res = await apiClient.get<any>(endpoint, { headers: getAuthHeaders(), ...bust });
        return {
          success: true,
          data: listFromAnyPayload(res.data),
          raw: res.data,
        };
      } catch (err: any) {
        lastError = err;
      }
    }
    const status = lastError?.response?.status;
    if (status === 403) {
      throw new Error(
        'Kuryer kimi sifarişləri görmək icazəsi verilməyib (403). Backend-də courier endpoint və ROLE_COURIER yoxlayın.'
      );
    }
    if (status === 401) {
      throw new Error('Sessiya bitib və ya token yanlışdır (401). Yenidən daxil olun.');
    }
    throw lastError;
  },
  markDelivered: async (orderId: number) => {
    const candidates: Array<{ url: string; body: any }> = [
      { url: `/api/order/${orderId}/courier/delivered`, body: {} },
      { url: `/api/order/${orderId}/delivered`, body: {} },
      { url: `/api/order/${orderId}/status`, body: { status: 'DELIVERED' } },
      { url: `/api/order/${orderId}/status`, body: { status: 'COMPLETED' } },
    ];
    let lastError: any = null;
    for (const candidate of candidates) {
      try {
        const res = await apiClient.patch<any>(candidate.url, candidate.body, { headers: getAuthHeaders() });
        return res.data;
      } catch (err: any) {
        lastError = err;
      }
    }
    throw lastError;
  },
  updateLocation: async (orderId: number, coords: { courierLatitude: number; courierLongitude: number }) => {
    if (!orderId) throw new Error('orderId tələb olunur');
    const body = {
      courierLatitude: coords.courierLatitude,
      courierLongitude: coords.courierLongitude,
    };
    const candidates = [
      `/api/order/${orderId}/courier/location`,
      `/api/order/${orderId}/courier-location`,
      `/api/order/${orderId}/location`,
    ];
    let lastError: any = null;
    for (const url of candidates) {
      try {
        const res = await apiClient.patch<any>(url, body, { headers: getAuthHeaders() });
        return res.data;
      } catch (err: any) {
        lastError = err;
      }
    }
    throw lastError;
  },
};

export const adminService = {
  getAllOrders: async () => {
    const candidates = [
      '/api/order',
      '/api/order/all',
      '/api/order/all/admin-view',
      '/api/order/admin-view',
      '/api/order/all/florist-view',
    ];
    let lastError: any = null;
    for (const endpoint of candidates) {
      try {
        const res = await apiClient.get<any>(endpoint, { headers: getAuthHeaders() });
        const list = listFromAnyPayload(res.data);
        if (list.length === 0) continue;
        return {
          success: true,
          data: list,
          raw: res.data,
        };
      } catch (err: any) {
        lastError = err;
      }
    }
    const status = lastError?.response?.status;
    if (status === 403) {
      throw new Error('Admin sifarişləri üçün icazə yoxdur (403).');
    }
    if (status === 401) {
      throw new Error('Sessiya bitib və ya token etibarsızdır (401).');
    }
    throw lastError;
  },
  saveRenderPackage: async (pkg: any) => {
    const res = await apiClient.post<any>('/api/bouquet/admin/render-packages', pkg, { headers: getAuthHeaders() });
    return res.data?.data ?? res.data ?? null;
  },
  deleteRenderPackage: async (code: string) => {
    const res = await apiClient.delete<any>(`/api/bouquet/admin/render-packages/${code}`, { headers: getAuthHeaders() });
    return res.data?.data ?? res.data ?? null;
  },
  getUserRenderStatus: async (userId: number) => {
    const res = await apiClient.get<any>(`/api/bouquet/admin/user-renders/${userId}`, { headers: getAuthHeaders() });
    return res.data?.data ?? res.data ?? null;
  },
  updateUserRenderLimit: async (userId: number, limit: number) => {
    const res = await apiClient.post<any>(`/api/bouquet/admin/user-renders/${userId}/override`, { limit }, { headers: getAuthHeaders() });
    return res.data?.data ?? res.data ?? null;
  }
};

export type DirectChatConversation = {
  id: number;
  type?: string;
  customerUserId?: number;
  courierUserId?: number;
  orderId?: number;
  createdAt?: string;
};

export type DirectChatMessage = {
  id: number | string;
  conversationId: number;
  senderId: number;
  content: string;
  createdAt?: string;
};

const toNum = (v: unknown): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return Number(v.trim());
  return 0;
};

const normalizeDirectConversation = (raw: any): DirectChatConversation | null => {
  const p = raw?.data && typeof raw.data === 'object' ? raw.data : raw;
  if (!p || typeof p !== 'object') return null;
  const id = toNum((p as any).id ?? (p as any).conversationId ?? (p as any).conversation_id);
  if (id <= 0) return null;
  return {
    id,
    type: String((p as any).type ?? 'DIRECT'),
    customerUserId: toNum((p as any).customerUserId ?? (p as any).customer_user_id) || undefined,
    courierUserId: toNum((p as any).courierUserId ?? (p as any).courier_user_id) || undefined,
    orderId: toNum((p as any).orderId ?? (p as any).order_id) || undefined,
    createdAt: String((p as any).createdAt ?? (p as any).created_at ?? ''),
  };
};

const normalizeDirectMessages = (raw: any): DirectChatMessage[] => {
  const list = listFromAnyPayload(raw);
  return list
    .map((row: any) => {
      const p = row?.data && typeof row.data === 'object' ? row.data : row;
      const conversationId = toNum(p?.conversationId ?? p?.conversation_id);
      const senderId = toNum(p?.senderId ?? p?.sender_id ?? p?.userId ?? p?.user_id);
      const content = String(p?.content ?? p?.message ?? p?.text ?? '').trim();
      const id = p?.id ?? p?.messageId ?? p?.message_id;
      if (!conversationId || !senderId || !content) return null;
      return {
        id: id ?? `${conversationId}-${senderId}-${Date.now()}`,
        conversationId,
        senderId,
        content,
        createdAt: String(p?.createdAt ?? p?.created_at ?? p?.sentAt ?? ''),
      } as DirectChatMessage;
    })
    .filter((m): m is DirectChatMessage => Boolean(m));
};

export const chatService = {
  createOrGetDirectConversation: async (payload: {
    customerUserId: number;
    courierUserId: number;
    orderId: number;
  }): Promise<DirectChatConversation> => {
    const body = {
      customerUserId: payload.customerUserId,
      courierUserId: payload.courierUserId,
      orderId: payload.orderId,
    };
    const candidates = ['/api/chat/conversations/direct', '/chat/conversations/direct'];
    let lastError: any = null;
    for (const url of candidates) {
      try {
        const res = await apiClient.post<any>(url, body, { headers: getAuthHeaders() });
        const conv = normalizeDirectConversation(res.data);
        if (conv) return conv;
      } catch (err: any) {
        lastError = err;
      }
    }
    throw lastError || new Error('Direct conversation yaratmaq mümkün olmadı.');
  },
  getConversationMessages: async (conversationId: number): Promise<DirectChatMessage[]> => {
    if (!conversationId) return [];
    const candidates = [
      `/api/chat/conversations/${conversationId}/messages`,
      `/api/chat/messages?conversationId=${conversationId}`,
      `/chat/conversations/${conversationId}/messages`,
    ];
    for (const url of candidates) {
      try {
        const res = await apiClient.get<any>(url, { headers: getAuthHeaders() });
        const list = normalizeDirectMessages(res.data);
        if (list.length > 0) return list;
      } catch {
        // try next shape
      }
    }
    return [];
  },
  sendConversationMessage: async (payload: {
    conversationId: number;
    senderId: number;
    content: string;
  }): Promise<DirectChatMessage | null> => {
    const body = {
      conversationId: payload.conversationId,
      senderId: payload.senderId,
      content: payload.content,
    };
    const candidates = ['/api/chat/messages', '/api/chat/message', '/chat/messages'];
    let lastError: any = null;
    for (const url of candidates) {
      try {
        const res = await apiClient.post<any>(url, body, { headers: getAuthHeaders() });
        const list = normalizeDirectMessages(res.data);
        if (list.length > 0) return list[list.length - 1];
        const p = res?.data?.data && typeof res.data.data === 'object' ? res.data.data : res.data;
        const conversationId = toNum(p?.conversationId ?? p?.conversation_id);
        const senderId = toNum(p?.senderId ?? p?.sender_id ?? p?.userId ?? p?.user_id);
        const content = String(p?.content ?? p?.message ?? p?.text ?? '').trim();
        if (conversationId && senderId && content) {
          return {
            id: p?.id ?? `${conversationId}-${senderId}-${Date.now()}`,
            conversationId,
            senderId,
            content,
            createdAt: String(p?.createdAt ?? p?.created_at ?? ''),
          };
        }
      } catch (err: any) {
        lastError = err;
      }
    }
    throw lastError || new Error('Mesaj göndərmək mümkün olmadı.');
  },
};

/**
 * `GET /api/plantdoctor/diagnosis/pending` cavabındakı hər elementdə `kind` olmalıdır;
 * yalnız onlayn müraciətlər üçün siyahını bu funksiya ilə süzün.
 */
export function filterPendingDiagnosesByConsultationKind<T extends { kind?: string }>(rows: T[]): T[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter((row) => String(row?.kind ?? '').trim().toUpperCase() === 'CONSULTATION');
}

/** 400 validasiya, 409 (`Əvvəl rezerv edin`) — `{ success?, message?, error? }`-dan mətn */
export function parsePlantDoctorApiError(error: unknown): string {
  const e = error as {
    code?: string;
    response?: { status?: number; data?: unknown };
    message?: string;
  };
  if (e?.code === 'ECONNABORTED') {
    return 'Sorğu vaxtında bitdi (server çox gec cavab verdi). İnternet bağlantısını və ya backend-i yoxlayın; `VITE_PLANT_DOCTOR_TIMEOUT_MS` dəyərini artırmaq olar.';
  }
  const rawMsg = typeof e?.message === 'string' ? e.message.trim() : '';
  if (rawMsg && /timeout\s+of\s+\d+ms\s+exceeded/i.test(rawMsg)) {
    return 'Sorğu vaxtında bitdi (axios timeout). Plant doctor sorğuları üçün `.env`-də `VITE_PLANT_DOCTOR_TIMEOUT_MS=120000` kimi artırın.';
  }
  const raw = e?.response?.data;
  if (raw && typeof raw === 'object') {
    const d = raw as Record<string, unknown>;
    const msg = d.message ?? d.error ?? d.errorMessage ?? d.details;
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
  }
  if (rawMsg) return rawMsg;
  const st = e?.response?.status;
  return typeof st === 'number' ? `Sorğu uğursuz (${st})` : 'Xəta baş verdi.';
}

/** PATCH/POST-dan sonra GET-in köhnə HTML/keş məlumatı göstərməsinə qarşı (query əlavə edir) */
const pdNoCacheParams = (enabled?: boolean) =>
  enabled ? ({ params: { _t: Date.now() } } as const) : {};

export const plantDoctorService = {
  /** Onlayn bitki həkimi sualı: şəkil + mətn (multipart). `GET …/consultation` (paramsız) YOXdur — yalnız `/consultation/pending` və `POST /consultation`. */
  /**
   * Konsultasiyalar (kind === CONSULTATION) — yalnız gözləyən (PENDING) onlayn müraciətlər.
   * Əsas: `GET /api/plantdoctor/consultation/pending` (gateway: `http://<host>:<port>/api/plantdoctor/consultation/pending`).
   * Eyni məlumat: {@link getAgronomistInboxConsultations}, {@link getPendingConsultationsForAgronomist}.
   */
  getConsultationPending: async () => {
    const res = await apiClient.get<any>('/api/plantdoctor/consultation/pending', {
      headers: getAuthHeaders(),
    });
    return res.data;
  },
  /**
   * Aqronom paneli üçün gözləyən konsult növbəsi: əvvəlcə əsas `GET /api/plantdoctor/consultation/pending`,
   * endpoint yoxdursa (məs. 404) — `GET /api/plantdoctor/agronomist/inbox/consultations`.
   * Hamısı (ev + konsult) üçün: {@link getPendingDiagnoses} + {@link filterPendingDiagnosesByConsultationKind}.
   */
  getPendingConsultationsForAgronomist: async (opts?: { cacheBust?: boolean }) => {
    const headers = getAuthHeaders();
    const nocache = pdNoCacheParams(opts?.cacheBust === true);
    const primary = '/api/plantdoctor/consultation/pending';
    const alternate = '/api/plantdoctor/agronomist/inbox/consultations';
    try {
      const res = await apiClient.get<any>(primary, { headers, ...nocache });
      return res.data;
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404 || status === 405 || status === 501) {
        const res = await apiClient.get<any>(alternate, { headers, ...nocache });
        return res.data;
      }
      throw err;
    }
  },
  /** Onlayn bitki həkimi sualı: şəkil + mətn (multipart). `/diagnosis` JSON yalnız ev ziyarəti üçündür. */
  createConsultation: async (payload: {
    userId: number;
    plantType: string;
    symptoms: string;
    image: File;
    specialNote?: string;
  }) => {
    const formData = new FormData();
    formData.append('userId', String(payload.userId));
    formData.append('plantType', payload.plantType.trim());
    formData.append('symptoms', payload.symptoms.trim());
    formData.append('image', payload.image);
    if (payload.specialNote?.trim()) {
      formData.append('specialNote', payload.specialNote.trim());
    }

    const plantDoctorTimeoutMs =
      Number(import.meta.env.VITE_PLANT_DOCTOR_TIMEOUT_MS) > 0
        ? Number(import.meta.env.VITE_PLANT_DOCTOR_TIMEOUT_MS)
        : 60000;

    const headers: Record<string, string> = { ...getAuthHeaders() };
    const res = await apiClient.post<any>('/api/plantdoctor/consultation', formData, {
      headers,
      transformRequest: [(data, reqHeaders) => {
        if (reqHeaders) {
          delete (reqHeaders as any)['Content-Type'];
          delete (reqHeaders as any).common?.['Content-Type'];
          delete (reqHeaders as any).post?.['Content-Type'];
        }
        return data;
      }],
      timeout: plantDoctorTimeoutMs,
    });
    return res.data;
  },
  /**
   * Gözləyən hər şey: ev ziyarəti + konsultasiya — `GET /api/plantdoctor/diagnosis/pending`.
   * Cavabda hər elementdə `kind` olur; yalnız konsultasiya üçün: {@link filterPendingDiagnosesByConsultationKind}.
   * Aqronom birləşik növbə: {@link getAgronomistInboxPending}.
   */
  getPendingDiagnoses: async () => {
    const res = await apiClient.get<any>('/api/plantdoctor/diagnosis/pending', {
      headers: getAuthHeaders(),
    });
    return res.data;
  },
  /**
   * Bütün diaqnoz/qeydlər — `GET /api/plantdoctor/diagnosis`.
   * Nümunə cavab: `{ success, message?, data: Diagnosis[], errorCode? }`; hər elementdə `kind`, `status` və s.
   * Aqronom panelində ev üçün: aktiv növbə → `HOME_VISIT` + `PENDING`; tamamlanıb → `HOME_VISIT` + `COMPLETED`.
   * Eyni məlumat (başqa URL): {@link getAgronomistDiagnoses}.
   */
  getAllDiagnoses: async (opts?: { cacheBust?: boolean }) => {
    const res = await apiClient.get<any>('/api/plantdoctor/diagnosis', {
      headers: getAuthHeaders(),
      ...pdNoCacheParams(opts?.cacheBust === true),
    });
    return res.data;
  },
  /** Tək qeydin təfsili; konsultasiyadırsa `kind === CONSULTATION`. Alternativ aqronom yolu: {@link getAgronomistInboxItem}. */
  getDiagnosisById: async (diagnosisId: number) => {
    const res = await apiClient.get<any>(`/api/plantdoctor/diagnosis/${diagnosisId}`, {
      headers: getAuthHeaders(),
    });
    return res.data;
  },
  replyToDiagnosis: async (diagnosisId: number, response: string) => {
    const res = await apiClient.patch<any>(
      `/api/plantdoctor/diagnosis/${diagnosisId}/reply`,
      { response },
      {
        headers: getAuthHeaders(),
      }
    );
    return res.data;
  },
  /** Ümumi siyahı (aqronom panel adı ilə) — `{@link getAllDiagnoses}` ilə eyni məlumat. */
  getAgronomistDiagnoses: async (opts?: { cacheBust?: boolean }) => {
    const res = await apiClient.get<any>('/api/plantdoctor/agronomist/diagnosis', {
      headers: getAuthHeaders(),
      ...pdNoCacheParams(opts?.cacheBust === true),
    });
    return res.data;
  },
  /** Gözləyənlər birləşik (ev ziyarəti + konsultasiya); `{@link getPendingDiagnoses}` ilə paralel. */
  getAgronomistInboxPending: async () => {
    const res = await apiClient.get<any>('/api/plantdoctor/agronomist/inbox/pending', {
      headers: getAuthHeaders(),
    });
    return res.data;
  },
  getAgronomistInboxHomeVisits: async () => {
    const res = await apiClient.get<any>('/api/plantdoctor/agronomist/inbox/home-visits', {
      headers: getAuthHeaders(),
    });
    return res.data;
  },
  /**
   * Yalnız gözləyən konsultasiyalar — `GET /api/plantdoctor/agronomist/inbox/consultations`
   * (aqronom paneli alternativi; eyni məlumat: {@link getConsultationPending}).
   */
  getAgronomistInboxConsultations: async () => {
    const res = await apiClient.get<any>('/api/plantdoctor/agronomist/inbox/consultations', {
      headers: getAuthHeaders(),
    });
    return res.data;
  },
  /** Tək məsələ (aqronom); `{@link getDiagnosisById}` ilə eyni təfsil, path fərqi. `{id}` yalnız rəqəm. */
  getAgronomistInboxItem: async (diagnosisId: number) => {
    const res = await apiClient.get<any>(`/api/plantdoctor/agronomist/inbox/${diagnosisId}`, {
      headers: getAuthHeaders(),
    });
    return res.data;
  },
  /**
   * Köhnə yol — eyni nəticə: `PATCH …/diagnosis/{id}/reserve`.
   * Yenisini istifadə edin: {@link reserveHomeVisitAsAgronomist}.
   */
  reserveAgronomistDiagnosis: async (diagnosisId: number, agronomistId: number) => {
    const res = await apiClient.patch<any>(
      `/api/plantdoctor/agronomist/diagnosis/${diagnosisId}/reserve`,
      { agronomistId },
      {
        headers: getAuthHeaders(),
      }
    );
    return res.data;
  },
  /** İzləmə / tək qeyd — `plant_home_visit` id ilə `GET /home-visit/{id}`. */
  getHomeVisitById: async (homeVisitId: number) => {
    const res = await apiClient.get<any>(`/api/plantdoctor/home-visit/${homeVisitId}`, {
      headers: getAuthHeaders(),
    });
    return res.data;
  },
  /** Aqronom: gözləyən ev ziyarəti növbəsi — `GET /home-visit/pending`. */
  getHomeVisitPending: async (opts?: { cacheBust?: boolean }) => {
    const res = await apiClient.get<any>('/api/plantdoctor/home-visit/pending', {
      headers: getAuthHeaders(),
      ...pdNoCacheParams(opts?.cacheBust === true),
    });
    return res.data;
  },
  /**
   * PENDING → RESERVED; istifadəçiyə qəbul məktubu — `PATCH /agronomist/home-visit/{id}/reserve`
   * (`id` adətən `plant_home_visit` id; obyektdə yoxdursa `diagnosisId` göndərirsiniz).
   */
  reserveHomeVisitAsAgronomist: async (homeVisitId: number, agronomistId: number) => {
    const res = await apiClient.patch<any>(
      `/api/plantdoctor/agronomist/home-visit/${homeVisitId}/reserve`,
      { agronomistId },
      {
        headers: getAuthHeaders(),
      }
    );
    return res.data;
  },
  /**
   * Yekun: `PATCH /agronomist/home-visit/{id}/reply`
   * Bədən: `{ agronomistId, response }` — `response` adı başqa (`message`, `text`…) olmayacaq (400 validasiya).
   * RESERVED → tamamlama; konsult üçün deyil.
   * Əlavə: `forceReserveAndComplete: true` — PENDING üçün tək PATCH (reserve + məktublar); normal axında 2 addım tövsiyyə olunur.
   */
  replyHomeVisitAsAgronomist: async (
    homeVisitId: number,
    agronomistId: number,
    response: string,
    opts?: { forceReserveAndComplete?: boolean }
  ) => {
    const body: Record<string, unknown> = { agronomistId, response: response.trim() };
    if (opts?.forceReserveAndComplete === true) {
      body.forceReserveAndComplete = true;
    }
    const res = await apiClient.patch<any>(
      `/api/plantdoctor/agronomist/home-visit/${homeVisitId}/reply`,
      body,
      {
        headers: getAuthHeaders(),
      }
    );
    return res.data;
  },
  getReservedDiagnosesForAgronomist: async (agronomistId: number, opts?: { cacheBust?: boolean }) => {
    const params: Record<string, number> = { agronomistId };
    if (opts?.cacheBust === true) params._t = Date.now();
    const res = await apiClient.get<any>('/api/plantdoctor/agronomist/diagnosis/reserved', {
      headers: getAuthHeaders(),
      params,
    });
    return res.data;
  },
  /**
   * Köhnə diaqnoz PATCH — `kind` parametrsiz HOME_VISIT default; konsultasiya üçün `?kind=CONSULTATION`.
   * Bədən: `{ agronomistId, response }`.
   */
  replyAsAgronomist: async (
    diagnosisId: number,
    response: string,
    agronomistId: number,
    options?: { kind?: 'CONSULTATION' }
  ) => {
    const qs = options?.kind === 'CONSULTATION' ? '?kind=CONSULTATION' : '';
    const res = await apiClient.patch<any>(
      `/api/plantdoctor/agronomist/diagnosis/${diagnosisId}/reply${qs}`,
      { agronomistId, response: response.trim() },
      {
        headers: getAuthHeaders(),
      }
    );
    return res.data;
  },
  getAgronomistPanelUrl: () => {
    return `${apiBaseUrl}/api/plantdoctor/agronomist/panel`;
  },
  getAddresses: async (userId: number) => {
    const res = await apiClient.get<any>(`/api/plantdoctor/addresses?userId=${userId}`, {
      headers: getAuthHeaders(),
    });
    return res.data;
  },
  getStoreLocation: async () => {
    const res = await apiClient.get<any>('/api/plantdoctor/store-location', {
      headers: getAuthHeaders(),
    });
    return res.data;
  },
  createAddress: async (payload: {
    userId: number;
    phoneNumber: string;
    fullAddressLine: string;
    latitude?: number;
    longitude?: number;
  }) => {
    const res = await apiClient.post<any>('/api/plantdoctor/addresses', payload, {
      headers: getAuthHeaders(),
    });
    return res.data;
  },
  createHomeVisitReservation: async (payload: {
    userId: number;
    plantType: string;
    symptoms: string;
    addressId?: number;
    phoneNumber?: string;
    fullAddressLine?: string;
    latitude?: number;
    longitude?: number;
    saveAddress?: boolean;
    plantCountRange: 'RANGE_1_3' | 'RANGE_4_7' | 'RANGE_8_PLUS';
    visitDate: string;
    visitTimeSlot: 'SLOT_09_12' | 'SLOT_12_15' | 'SLOT_15_18' | 'SLOT_18_21';
    specialNote?: string;
    distanceKm?: number;
  }) => {
    const requestBody = {
      userId: payload.userId,
      plantType: payload.plantType,
      symptoms: payload.symptoms,
      plantCountRange: payload.plantCountRange,
      visitDate: payload.visitDate,
      visitTimeSlot: payload.visitTimeSlot,
      ...(typeof payload.addressId === 'number' ? { addressId: payload.addressId } : {}),
      ...(payload.phoneNumber ? { phoneNumber: payload.phoneNumber } : {}),
      ...(payload.fullAddressLine ? { fullAddressLine: payload.fullAddressLine } : {}),
      ...(typeof payload.latitude === 'number' ? { latitude: payload.latitude } : {}),
      ...(typeof payload.longitude === 'number' ? { longitude: payload.longitude } : {}),
      ...(typeof payload.distanceKm === 'number' ? { distanceKm: payload.distanceKm } : {}),
      ...(payload.specialNote ? { specialNote: payload.specialNote } : {}),
      ...(typeof payload.saveAddress === 'boolean' ? { saveAddress: payload.saveAddress } : {}),
    };

    const res = await apiClient.post<any>('/api/plantdoctor/diagnosis', JSON.stringify(requestBody), {
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json;charset=UTF-8',
        Accept: 'application/json',
      },
      timeout: 60000,
    });
    return res.data;
  },
  getUserDiagnoses: async (email: string, opts?: { cacheBust?: boolean }) => {
    const headers = getAuthHeaders();
    const params = { email, ...(opts?.cacheBust ? { _t: Date.now() } : {}) };
    const res = await apiClient.get<any>('/api/plantdoctor/diagnosis', {
      headers,
      params,
    });
    return listFromAnyPayload(res.data);
  },
};

export default apiClient;
