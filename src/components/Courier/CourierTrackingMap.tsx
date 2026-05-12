import { memo, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchOsrmDrivingRoute } from '../../utils/osrmRoute';

const DELIVERY_ROUTE_COLOR = '#d41152';

/** Bakı üçün default mərkəz (markers yoxdursa) */
const DEFAULT_CENTER: [number, number] = [40.4093, 49.8671];

type LatLngTuple = [number, number];

/** Grid/flex layout sonra ölçü təyin olunanda xəritənin boş qalmasının qarşısı */
function MapInvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const fix = () => {
      map.invalidateSize({ animate: false });
    };
    fix();
    const t = window.setTimeout(fix, 160);
    window.addEventListener('resize', fix);
    const outer = map.getContainer().parentElement;
    const ro =
      typeof ResizeObserver !== 'undefined' && outer
        ? new ResizeObserver(() => {
            fix();
          })
        : null;
    if (outer && ro) ro.observe(outer);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', fix);
      ro?.disconnect();
    };
  }, [map]);
  return null;
}

const validatePt = (p: LatLngTuple | null | undefined): p is LatLngTuple =>
  Array.isArray(p) &&
  p.length === 2 &&
  Number.isFinite(p[0]) &&
  Number.isFinite(p[1]) &&
  Math.abs(p[0]) <= 90 &&
  Math.abs(p[1]) <= 180;

function MapFitPositions({ positions }: { positions: LatLngTuple[] }) {
  const map = useMap();
  useEffect(() => {
    const valid = positions.filter(validatePt);
    if (valid.length === 0) return;
    if (valid.length === 1) {
      map.setView(valid[0], 16);
      return;
    }
    const b = L.latLngBounds(valid);
    map.fitBounds(b, {
      paddingTopLeft: L.point(48, 56),
      paddingBottomRight: L.point(120, 108),
      maxZoom: 16,
    });
  }, [map, positions]);
  return null;
}

/**
 * Bir dəfə bütün nöqtələri əhatə edir; sonra mövcudge kuryeri izləmək üçün yüngül flyTo
 * — public trackingdə API intervalı ilə sıçrayan nöqtələri gözəl göstərir.
 */
function LiveMapViewport({
  viewportKey,
  delivery,
  courier,
  trail,
  followCourierMoves,
}: {
  viewportKey: string;
  delivery: LatLngTuple | null;
  courier: LatLngTuple | null;
  trail: LatLngTuple[];
  followCourierMoves: boolean;
}) {
  const map = useMap();
  const sess = useRef({
    viewportKey,
    initialFitDone: false,
    lastCourier: null as LatLngTuple | null,
  });

  useEffect(() => {
    if (sess.current.viewportKey !== viewportKey) {
      sess.current = {
        viewportKey,
        initialFitDone: false,
        lastCourier: null,
      };
    }
  }, [viewportKey]);

  useEffect(() => {
    const pts: LatLngTuple[] = [];
    for (const p of trail) {
      if (validatePt(p)) pts.push([p[0], p[1]]);
    }
    if (validatePt(delivery)) pts.push([delivery[0], delivery[1]]);
    if (validatePt(courier)) pts.push([courier[0], courier[1]]);

    const unique = pts;
    if (unique.length === 0) return;

    if (!sess.current.initialFitDone) {
      sess.current.initialFitDone = true;
      /** LiveTracking.tsx məntiqi ilə yumşaq ilk mərkəzləndirmə (rəng/laylər toxunulmayıb). */
      const ease = { easeLinearity: 0.25 } as const;
      if (unique.length === 1) {
        map.setView(unique[0], 14, { animate: true, duration: 1, ...ease });
      } else {
        const b = L.latLngBounds(unique);
        map.fitBounds(b, {
          paddingTopLeft: L.point(40, 48),
          paddingBottomRight: L.point(100, 92),
          maxZoom: 16,
          animate: true,
          duration: 1,
          ...ease,
        });
      }
    }

    if (!followCourierMoves || !courier || !validatePt(courier)) return;
    const last = sess.current.lastCourier;
    sess.current.lastCourier = [courier[0], courier[1]];

    const movedEnough =
      !last ||
      Math.hypot(courier[0] - last[0], courier[1] - last[1]) >
        /** ~22 m dəyişikdə yenidən flyTo — kiçik qıpıltıların xıltını azaldır */
        0.0002;

    if (movedEnough) {
      const zTarget = Math.max(map.getZoom(), 15);
      map.flyTo([courier[0], courier[1]], zTarget, { duration: 1.5, easeLinearity: 0.25 });
    }
  }, [
    map,
    viewportKey,
    delivery?.[0],
    delivery?.[1],
    courier?.[0],
    courier?.[1],
    trail,
    followCourierMoves,
  ]);

  return null;
}

const createCourierShipIcon = (pulsate: boolean) =>
  L.divIcon({
    className: 'bb-tracking-div-icon',
    html: `<div class="bb-courier-ship-wrap">${pulsate ? '<span class="bb-courier-ship-ring" aria-hidden="true"></span>' : ''}<div class="bb-courier-ship-core"><span class="material-symbols-outlined bb-courier-ship-glyph">directions_car</span></div></div>`,
    iconSize: [54, 54],
    iconAnchor: [27, 44],
    popupAnchor: [0, -42],
  });

const deliveryHomeLeafletIcon = L.divIcon({
  className: 'bb-tracking-div-icon',
  html: `<div class="bb-delivery-home-wrap"><div class="bb-delivery-home-core"><span class="material-symbols-outlined bb-delivery-home-glyph">home</span></div></div>`,
  iconSize: [52, 52],
  iconAnchor: [26, 42],
  popupAnchor: [0, -40],
});

const DeliveryHomeMarker = memo(function DeliveryHomeMarker({
  position,
  deliveryAddressLine,
  onDeliveryNavigate,
}: {
  position: LatLngTuple;
  deliveryAddressLine: string;
  onDeliveryNavigate?: () => void;
}) {
  return (
    <Marker
      position={position}
      icon={deliveryHomeLeafletIcon}
      eventHandlers={
        onDeliveryNavigate
          ? {
              click: () => {
                onDeliveryNavigate();
              },
            }
          : undefined
      }
    >
      <Tooltip
        permanent
        direction="top"
        offset={[0, -10]}
        className={`!m-0 !rounded-lg !border !px-2 !py-1.5 !text-[11px] !font-semibold !shadow-md ${
          onDeliveryNavigate
            ? '!cursor-pointer !border-emerald-500/35 !bg-white/95 !text-emerald-950 dark:!bg-slate-900/95 dark:!text-emerald-100'
            : '!border-emerald-600/25 !bg-white/95 !text-emerald-950 dark:!border-emerald-500/30 dark:!bg-slate-900/95 dark:!text-emerald-100'
        }`}
      >
        <span className="flex items-start gap-1.5 leading-tight">
          <span className="material-symbols-outlined shrink-0 text-base leading-none text-emerald-600 dark:text-emerald-300" aria-hidden>
            home
          </span>
          <span className="block">Çatdırılma ünvanı</span>
        </span>
        {deliveryAddressLine.trim() ? (
          <span className="mt-0.5 block max-w-[220px] font-normal leading-snug text-slate-600 dark:text-slate-300">
            {deliveryAddressLine.trim()}
          </span>
        ) : null}
        {onDeliveryNavigate ? (
          <span className="mt-1 block text-[10px] font-bold text-emerald-700 dark:text-emerald-300">Klik: naviqasiya (Waze)</span>
        ) : null}
      </Tooltip>
    </Marker>
  );
});

const CourierShippingMarker = memo(function CourierShippingMarker({
  position,
  pulsate,
  courierApproximateGeocode,
  courierDetailLine,
}: {
  position: LatLngTuple;
  pulsate: boolean;
  courierApproximateGeocode: boolean;
  courierDetailLine: string;
}) {
  const icon = useMemo(() => createCourierShipIcon(pulsate && !courierApproximateGeocode), [pulsate, courierApproximateGeocode]);

  return (
    <Marker position={position} icon={icon}>
      <Tooltip
        permanent
        direction="top"
        offset={[0, -10]}
        className="!m-0 !max-w-[min(92vw,280px)] !rounded-lg !border !border-[#be185d]/30 !bg-slate-900/94 !px-2 !py-1.5 !text-[11px] !font-semibold !text-slate-100 !shadow-lg"
      >
        <span className="flex items-start gap-1.5 leading-tight">
          <span className="material-symbols-outlined shrink-0 text-base leading-none text-sky-200" aria-hidden>
            directions_car
          </span>
          <span className="min-w-0">
            Kuryer (bu nöqtədə)
            {courierApproximateGeocode ? (
              <span className="mt-0.5 block text-[10px] font-semibold normal-case text-slate-400">
                Götürmə nöqtəsi, təxmini
              </span>
            ) : (
              <span className="mt-0.5 block text-[10px] font-semibold normal-case text-slate-400">Canlı / xəritə mövqesi</span>
            )}
          </span>
        </span>
        <p className="mt-1.5 border-t border-white/15 pt-1.5 font-mono text-[10px] font-bold tabular-nums leading-snug text-amber-100">
          {position[0].toFixed(6)}, {position[1].toFixed(6)}
        </p>
        {courierDetailLine.trim() ? (
          <span className="mt-1 block max-w-[260px] text-[10px] font-normal leading-snug text-slate-300">
            {courierDetailLine.trim()}
          </span>
        ) : null}
      </Tooltip>
    </Marker>
  );
});

export type CourierTrackingVisualMode = 'street' | 'satellite';

type Props = {
  deliveryPosition: LatLngTuple | null;
  courierPosition: LatLngTuple | null;
  geocodingDelivery: boolean;
  onDeliveryNavigate?: () => void;
  geocodingCourier?: boolean;
  courierApproximateGeocode?: boolean;
  deliveryAddressLine?: string;
  courierDetailLine?: string;
  className?: string;
  /** Səhifəsində canlı trayektoriya, maşın ikonası, marşrut izləmə */
  interactiveLiveTracking?: boolean;
  /** Kuryerdən nöqtələrdən qurulmuş ardıcıllıq (eyni sessiyada saxlanılır) */
  courierTrail?: LatLngTuple[];
  /** “Yoldadır” kimi animasiya: canlı GPS + aktiv status üçün */
  courierLiveRouteAnimation?: boolean;
  /** Köçərlən zaman initial fit sıfırı */
  viewportSessionKey?: string;
};

export default function CourierTrackingMap({
  deliveryPosition,
  courierPosition,
  geocodingDelivery,
  onDeliveryNavigate,
  geocodingCourier = false,
  courierApproximateGeocode = false,
  deliveryAddressLine = '',
  courierDetailLine = '',
  className = '',
  interactiveLiveTracking = false,
  courierTrail = [],
  courierLiveRouteAnimation = false,
  viewportSessionKey = 'default',
}: Props) {
  const [mapViewMode, setMapViewMode] = useState<CourierTrackingVisualMode>('satellite');
  /** Kuryer → çatdırılma ünvanı üzrə yol şəbəkəsi (OSRM, sürmə) */
  const [courierToDeliveryRoute, setCourierToDeliveryRoute] = useState<LatLngTuple[] | null>(null);
  const [courierDeliveryRouteLoading, setCourierDeliveryRouteLoading] = useState(false);

  const positionsBoth: LatLngTuple[] = [];
  if (deliveryPosition && validatePt(deliveryPosition)) positionsBoth.push([deliveryPosition[0], deliveryPosition[1]]);
  if (courierPosition && validatePt(courierPosition)) positionsBoth.push([courierPosition[0], courierPosition[1]]);

  const center: [number, number] = deliveryPosition || courierPosition || DEFAULT_CENTER;
  const hasAny =
    Boolean(deliveryPosition && validatePt(deliveryPosition)) ||
    Boolean(courierPosition && validatePt(courierPosition));

  const trailValid =
    courierTrail.filter(validatePt).map((x) => [x[0], x[1]] as LatLngTuple);
  const showLiveTrail = interactiveLiveTracking && trailValid.length >= 2;

  /** Yalnız real GPS zamanı sıx izləmə — götürmə nöqtəsi geocode xılt edir */
  const followCourier =
    interactiveLiveTracking && Boolean(courierPosition && validatePt(courierPosition) && !courierApproximateGeocode);

  const pulsateCourier =
    interactiveLiveTracking &&
    Boolean(courierPosition && validatePt(courierPosition)) &&
    !courierApproximateGeocode &&
    courierLiveRouteAnimation;

  useEffect(() => {
    const d = deliveryPosition && validatePt(deliveryPosition) ? deliveryPosition : null;
    const c = courierPosition && validatePt(courierPosition) ? courierPosition : null;

    if (!d || !c) {
      setCourierToDeliveryRoute(null);
      setCourierDeliveryRouteLoading(false);
      return;
    }

    let cancelled = false;
    const ac = new AbortController();
    const tid = window.setTimeout(() => {
      setCourierDeliveryRouteLoading(true);
      void fetchOsrmDrivingRoute([c[0], c[1]], [d[0], d[1]], ac.signal)
        .then((line) => {
          if (cancelled || ac.signal.aborted) return;
          setCourierDeliveryRouteLoading(false);
          setCourierToDeliveryRoute(line && line.length >= 2 ? line : null);
        })
        .catch(() => {
          if (cancelled || ac.signal.aborted) return;
          setCourierDeliveryRouteLoading(false);
          setCourierToDeliveryRoute(null);
        });
    }, 500);

    return () => {
      cancelled = true;
      ac.abort();
      window.clearTimeout(tid);
    };
  }, [deliveryPosition, courierPosition]);

  const hasDrivingRoute = Boolean(courierToDeliveryRoute && courierToDeliveryRoute.length >= 2);

  return (
    <div
      className={`relative isolate z-0 flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden ${className}`}
    >
      <MapContainer
        center={[center[0], center[1]]}
        zoom={hasAny ? 13 : 11}
        className="z-0 min-h-[360px] flex-1 rounded-none"
        style={{ minHeight: 360, height: '100%', width: '100%' }}
        scrollWheelZoom
      >
        {mapViewMode === 'satellite' ? (
          <TileLayer
            attribution='&copy; <a href="https://www.esri.com">Esri</a> — Esri, Maxar'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        ) : (
          <TileLayer attribution="© OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        )}
        <MapInvalidateSize />
        {interactiveLiveTracking ? (
          <LiveMapViewport
            viewportKey={viewportSessionKey}
            delivery={deliveryPosition && validatePt(deliveryPosition) ? deliveryPosition : null}
            courier={courierPosition && validatePt(courierPosition) ? courierPosition : null}
            trail={trailValid}
            followCourierMoves={followCourier}
          />
        ) : (
          <MapFitPositions positions={[...positionsBoth]} />
        )}

        {showLiveTrail ? (
          <>
            <Polyline
              positions={trailValid}
              pathOptions={{
                color: '#38bdf8',
                weight: 9,
                opacity: 0.22,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            <Polyline
              positions={trailValid}
              pathOptions={{
                color: pulsateCourier ? '#7dd3fc' : '#60a5fa',
                weight: 5,
                opacity: pulsateCourier ? 0.95 : 0.72,
                lineCap: 'round',
                lineJoin: 'round',
                className: pulsateCourier ? 'bb-courier-route-polyline bb-courier-route-polyline--live' : 'bb-courier-route-polyline',
              }}
            />
          </>
        ) : null}

        {deliveryPosition && validatePt(deliveryPosition) ? (
          <DeliveryHomeMarker
            position={[deliveryPosition[0], deliveryPosition[1]]}
            deliveryAddressLine={deliveryAddressLine}
            onDeliveryNavigate={onDeliveryNavigate}
          />
        ) : null}

        {courierPosition && validatePt(courierPosition) ? (
          <CourierShippingMarker
            position={[courierPosition[0], courierPosition[1]]}
            pulsate={pulsateCourier}
            courierApproximateGeocode={courierApproximateGeocode}
            courierDetailLine={courierDetailLine}
          />
        ) : null}

        {deliveryPosition &&
        courierPosition &&
        validatePt(deliveryPosition) &&
        validatePt(courierPosition) &&
        hasDrivingRoute && courierToDeliveryRoute ? (
          <>
            <Polyline
              positions={courierToDeliveryRoute}
              pathOptions={{
                color: 'rgba(41, 8, 22, 0.45)',
                weight: interactiveLiveTracking ? 11 : 10,
                opacity: 1,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            <Polyline
              positions={courierToDeliveryRoute}
              pathOptions={{
                color: DELIVERY_ROUTE_COLOR,
                weight: interactiveLiveTracking ? 6 : 5,
                opacity: 0.93,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </>
        ) : null}

        {deliveryPosition &&
        courierPosition &&
        validatePt(deliveryPosition) &&
        validatePt(courierPosition) &&
        !hasDrivingRoute ?
          <Polyline
            positions={[
              [courierPosition[0], courierPosition[1]],
              [deliveryPosition[0], deliveryPosition[1]],
            ]}
            pathOptions={{
              color: DELIVERY_ROUTE_COLOR,
              weight: 3,
              dashArray: interactiveLiveTracking ? '6 14' : '8 12',
              opacity: interactiveLiveTracking ? 0.4 : 0.72,
            }}
          />
        : null}
      </MapContainer>

      <div className="pointer-events-auto absolute right-3 top-3 z-[430] inline-flex overflow-hidden rounded-lg border border-slate-200 bg-white/95 shadow-md dark:border-white/15 dark:bg-slate-900/95">
        <button
          type="button"
          onClick={() => setMapViewMode('street')}
          className={`px-3 py-1.5 text-[11px] font-bold transition ${
            mapViewMode === 'street'
              ? 'bg-primary text-white'
              : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          Klassik
        </button>
        <button
          type="button"
          onClick={() => setMapViewMode('satellite')}
          className={`border-l border-slate-200 px-3 py-1.5 text-[11px] font-bold transition dark:border-white/10 ${
            mapViewMode === 'satellite'
              ? 'bg-primary text-white'
              : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          Peyk
        </button>
      </div>

      {!hasAny ? (
        <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center bg-slate-900/35 p-4">
          <p className="max-w-xs rounded-xl bg-white/95 px-4 py-3 text-center text-xs font-semibold text-slate-800 shadow-lg dark:bg-slate-900/95 dark:text-slate-100">
            Çatdırılma ünvanı və ya kuryer mövqeyi hələ xəritəyə düşməyib.
          </p>
        </div>
      ) : null}

      {hasAny ? (
        <div
          className="pointer-events-none absolute bottom-3 right-3 z-[410] ml-auto flex max-h-[calc(100%-1.5rem)] max-w-[min(calc(100%-1.5rem),256px)] flex-col gap-1.5 overflow-y-auto rounded-lg border border-slate-200/90 bg-white/95 px-2.5 py-2 text-left text-[11px] leading-snug text-slate-700 shadow-md dark:border-white/15 dark:bg-slate-900/95 dark:text-slate-200"
          aria-label="Marker izahı"
        >
          <p className="m-0">
            <span className="mr-1 inline-block rounded-sm border border-emerald-400/60 bg-emerald-600/30 px-0.5 pb-0.5 pt-0 align-middle text-[13px] leading-none text-emerald-800 dark:border-emerald-500/50 dark:bg-emerald-500/20 dark:text-emerald-200" aria-hidden>
              <span className="material-symbols-outlined text-[14px] leading-none" style={{ fontVariationSettings: "'FILL' 1" }}>
                home
              </span>
            </span>
            <strong className="font-semibold text-slate-800 dark:text-white">Ev ikonası</strong> — çatdırılma ünvanı
            {geocodingDelivery ? (
              <span className="text-slate-500 dark:text-slate-400"> (ünvan əsasında).</span>
            ) : (
              '.'
            )}
            {onDeliveryNavigate ? (
              <span className="text-slate-500 dark:text-slate-400"> Ünvana klik → Waze.</span>
            ) : null}
          </p>
          <p
            className={`m-0 ${
              courierPosition && !courierApproximateGeocode
                ? ''
                : courierPosition && courierApproximateGeocode
                  ? 'text-sky-950 dark:text-sky-100/95'
                  : 'text-amber-900 dark:text-amber-200/95'
            }`}
          >
            <span className="mr-1 inline-block h-2 w-2 shrink-0 rounded-full bg-sky-400 ring-2 ring-sky-400/35" aria-hidden />
            Xəritədə <strong className="font-semibold text-slate-800 dark:text-white">maşın işarəsi</strong> kuryerdir.
            {interactiveLiveTracking && pulsateCourier ? (
              <span className="text-slate-600 dark:text-slate-400"> Yoldaykən xətt aktiv animasiya göstərir.</span>
            ) : interactiveLiveTracking ? (
              <span className="text-slate-600 dark:text-slate-400"> Son nöqtələrdən cızılmış yol görünür.</span>
            ) : geocodingCourier ? (
              <span className="text-slate-600 dark:text-slate-400"> Götürmə nöqtəsi yerləşdirilir…</span>
            ) : !courierPosition ? (
              <span className="text-slate-600 dark:text-slate-400"> GPS və ya keçiddə götürmə parametri lazımdır.</span>
            ) : courierApproximateGeocode ? (
              <span className="text-slate-600 dark:text-slate-400"> Hal-hazırda götürmə ünvanı təxmini.</span>
            ) : (
              ''
            )}
          </p>
          {deliveryPosition && courierPosition && validatePt(deliveryPosition) && validatePt(courierPosition) ? (
            <p className="m-0 text-slate-600 dark:text-slate-400">
              {courierDeliveryRouteLoading ? (
                <span>Ev ↔ maşın üçün yol ilə marşrut hesablanır…</span>
              ) : hasDrivingRoute ? (
                <span>
                  <strong className="text-slate-800 dark:text-white">Tünd + qırmızı xətt</strong> kuryerindən ünvana qədər yol şəbəkəsi üzrə təxmini avtomobil marşrutudur (OSRM / OpenStreetMap). Real hərəkət yoldan asılı ola bilər.
                </span>
              ) : (
                <span>
                  Marşrut alınmadı — müvəqqəti <strong className="text-slate-800 dark:text-white">nöqtəli düz xətt</strong> (təxmini istiqamət).
                </span>
              )}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
