import { motion } from 'framer-motion';

interface NeoStatCardProps {
  label: string;
  value: string;
  subtitle?: string;
  highlighted?: boolean;
  className?: string;
}

export const NeoStatCard = ({
  label,
  value,
  subtitle,
  highlighted = false,
  className = ''
}: NeoStatCardProps) => {
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className={`
        bg-neo-bg rounded-2xl p-6
        shadow-neo-raised hover:shadow-neo-raised-lift
        transition-all duration-300
        ${highlighted ? 'border-t-2 border-yellow-400' : ''}
        ${className}
      `}
    >
      <div className="text-sm text-gray-600 font-medium uppercase tracking-wider mb-2">{label}</div>
      <div className={`text-3xl font-bold mb-1 ${highlighted ? 'text-yellow-700' : 'text-gray-900'}`}>
        {value}
      </div>
      {subtitle && (
        <div className="text-xs text-gray-600">{subtitle}</div>
      )}
    </motion.div>
  );
};
