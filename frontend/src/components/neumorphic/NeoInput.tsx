import { motion } from 'framer-motion';

interface NeoInputProps {
  type?: 'text' | 'number' | 'email' | 'password';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  maxLabel?: string;
  onMaxClick?: () => void;
  className?: string;
}

export const NeoInput = ({
  type = 'text',
  value,
  onChange,
  placeholder,
  label,
  maxLabel,
  onMaxClick,
  className = ''
}: NeoInputProps) => {
  return (
    <div className={className}>
      {(label || maxLabel) && (
        <div className="flex justify-between mb-2">
          {label && <label className="text-sm text-gray-700 font-medium">{label}</label>}
          {maxLabel && onMaxClick && (
            <button
              onClick={onMaxClick}
              className="text-xs text-gray-600 hover:text-yellow-600 font-medium transition-colors"
            >
              {maxLabel}
            </button>
          )}
        </div>
      )}
      <motion.div
        whileFocus={{ scale: 1.01 }}
        className="relative"
      >
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="
            w-full px-4 py-3 rounded-2xl
            bg-neo-bg shadow-neo-pressed
            focus:shadow-neo-raised
            text-gray-900 placeholder-gray-500
            text-lg font-medium
            focus:outline-none
            transition-all duration-300
            border-none
          "
        />
      </motion.div>
    </div>
  );
};
