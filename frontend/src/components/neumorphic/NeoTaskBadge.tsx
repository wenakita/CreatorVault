import { motion } from 'framer-motion';
import { FileText } from 'lucide-react';

interface NeoTaskBadgeProps {
  primaryLabel: string;
  secondaryLabel: string;
  secondaryColor?: 'orange' | 'green' | 'blue';
  icon?: React.ReactNode;
  className?: string;
}

export const NeoTaskBadge = ({
  primaryLabel,
  secondaryLabel,
  secondaryColor = 'orange',
  icon,
  className = ''
}: NeoTaskBadgeProps) => {
  const colorMap = {
    orange: {
      bg: 'bg-orange-200',
      text: 'text-orange-700',
      gradient: 'from-orange-200 to-orange-300',
    },
    green: {
      bg: 'bg-green-200',
      text: 'text-green-700',
      gradient: 'from-green-200 to-green-300',
    },
    blue: {
      bg: 'bg-blue-200',
      text: 'text-blue-700',
      gradient: 'from-blue-200 to-blue-300',
    },
  };

  const colors = colorMap[secondaryColor];

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -1 }}
      className={`
        flex items-center rounded-full
        bg-neo-bg shadow-neo-raised
        hover:shadow-neo-raised-hover
        overflow-hidden
        transition-all duration-300
        ${className}
      `}
    >
      {/* Primary Segment */}
      <div className="flex items-center gap-2 px-4 py-2 bg-neo-bg">
        {icon || <FileText className="w-4 h-4 text-gray-700" />}
        <span className="font-semibold text-gray-900">{primaryLabel}</span>
      </div>

      {/* Secondary Segment with Gradient */}
      <div
        className={`
          px-4 py-2
          bg-gradient-to-r ${colors.gradient}
          ${colors.text}
          font-semibold
          relative
        `}
      >
        <div className="absolute inset-0 bg-white bg-opacity-20 blur-sm" />
        <span className="relative z-10">{secondaryLabel}</span>
      </div>
    </motion.div>
  );
};
