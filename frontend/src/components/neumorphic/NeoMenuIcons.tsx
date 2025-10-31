import { motion } from 'framer-motion';
import { 
  Home, 
  Bookmark, 
  Paperclip, 
  Calendar, 
  MoreHorizontal,
  LucideIcon
} from 'lucide-react';

interface MenuItem {
  id: string;
  icon: LucideIcon;
  label?: string;
}

interface NeoMenuIconsProps {
  items?: MenuItem[];
  activeItem?: string;
  onItemClick?: (itemId: string) => void;
  className?: string;
}

const defaultItems: MenuItem[] = [
  { id: 'home', icon: Home, label: 'Home' },
  { id: 'bookmark', icon: Bookmark, label: 'Bookmark' },
  { id: 'paperclip', icon: Paperclip, label: 'Attachment' },
  { id: 'calendar', icon: Calendar, label: 'Calendar' },
  { id: 'more', icon: MoreHorizontal, label: 'More' },
];

export const NeoMenuIcons = ({
  items = defaultItems,
  activeItem,
  onItemClick,
  className = ''
}: NeoMenuIconsProps) => {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {items.map((item) => {
        const isActive = activeItem === item.id;
        const Icon = item.icon;
        
        return (
          <motion.button
            key={item.id}
            onClick={() => onItemClick?.(item.id)}
            whileHover={{ y: -2, scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`
              w-12 h-12 rounded-2xl
              flex items-center justify-center
              transition-all duration-300
              relative
              ${isActive
                ? ''
                : 'bg-neo-bg shadow-neo-raised hover:shadow-neo-raised-hover'
              }
              focus:outline-none focus:ring-3 focus:ring-green-300 focus:ring-opacity-50
            `}
            aria-label={item.label || item.id}
          >
            {isActive && (
              <motion.div
                layoutId="activeMenuIcon"
                className="absolute inset-0 rounded-2xl bg-white shadow-neo-raised-lift -z-0"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
            <Icon
              className={`
                w-5 h-5 transition-colors duration-300 relative z-10
                ${isActive ? 'text-gray-900' : 'text-gray-600'}
              `}
            />
          </motion.button>
        );
      })}
    </div>
  );
};
