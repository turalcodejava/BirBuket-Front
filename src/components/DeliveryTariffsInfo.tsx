import { DELIVERY_TARIFF_LINES, DELIVERY_TARIFFS_TITLE } from '../constants/deliveryTariffs';

type Props = {
  className?: string;
  titleClassName?: string;
  lineClassName?: string;
};

export default function DeliveryTariffsInfo({
  className = '',
  titleClassName,
  lineClassName,
}: Props) {
  const titleCls = titleClassName ?? 'font-bold text-floral-deep dark:text-white';
  const lineCls = lineClassName ?? 'text-floral-muted dark:text-white/70';

  return (
    <div className={className}>
      <p className={titleCls}>{DELIVERY_TARIFFS_TITLE}</p>
      <ul className="mt-1 list-none space-y-1">
        {DELIVERY_TARIFF_LINES.map((line) => (
          <li key={line} className={lineCls}>
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
