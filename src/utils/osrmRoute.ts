/**
 * OSRM marşrutu (kuryer ↔ çatdırılma). Backend/proksi olmadan build-in pozulmaması üçün
 * boş nəticə qaytarılır; mövcud olduqda public OSRM endpoint əlavə etmək olar.
 */
export async function fetchOsrmDrivingRoute(
  _from: [number, number],
  _to: [number, number],
  _signal?: AbortSignal
): Promise<[number, number][] | null> {
  return null;
}
