import { motion } from 'motion/react';
import { Flower2 } from 'lucide-react';

interface BrandLoadingProps {
  compact?: boolean;
  className?: string;
}

export default function BrandLoading({ compact = false, className = '' }: BrandLoadingProps) {
  const textSize = compact ? 'text-sm' : 'text-xl';
  const iconSize = compact ? 'w-4 h-4' : 'w-6 h-6';

  return (
    <motion.div
      initial={{ opacity: 0.55 }}
      animate={{ opacity: [0.55, 1, 0.55] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      className={`flex items-center justify-center gap-2 ${className}`.trim()}
    >
      <Flower2 className={`text-primary ${iconSize} shrink-0 fill-current`} aria-hidden />
      <span className={`font-display ${textSize} font-extrabold tracking-tight text-floral-deep dark:text-floral-deep-dark`}>
        BirBuket
      </span>
    </motion.div>
  );
}
