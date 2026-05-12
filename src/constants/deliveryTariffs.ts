/** Bakı çatdırılması — bütün UI-də eyni mətnlər. */
export const DELIVERY_TARIFFS_TITLE = 'Çatdırılma tarifləri:';

export const DELIVERY_TARIFF_LINES = [
  '4 km məsafəyə qədər: 5 AZN',
  '4-8 km məsafə: 10 AZN',
  '8-15 km məsafə: 15 AZN',
  '15 km-dən çox: 20 AZN',
] as const;

/** Canlı söhbət / qısa cavab üçün bir paraqraf. */
export function deliveryTariffsChatText(): string {
  return `${DELIVERY_TARIFFS_TITLE} ${DELIVERY_TARIFF_LINES.join('; ')}.`;
}
