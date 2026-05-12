/** `YYYY-MM-DD` — `<input type="date" />` üçün (brauzerin yerli təqvimi) */
export function toLocalDateInputString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayLocalDateInput(): string {
  return toLocalDateInputString(new Date());
}

/** `from` günündən `days` təqvim günü əlavə (DST təhlükəsi yox; yalnız tarix) */
export function addCalendarDaysLocal(from: Date, days: number): Date {
  return new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
}
