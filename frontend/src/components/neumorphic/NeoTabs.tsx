import { motion } from 'framer-motion';
import { useState } from 'react';

interface Tab {
  id: string;
  label: string;
}

interface NeoTabsProps {
  tabs: Tab[];
  defaultTab?: string;
  onChange?: (tabId: string) => void;
}

export const NeoTabs = ({ tabs, defaultTab, onChange }: NeoTabsProps) => {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    onChange?.(tabId);
  };

  return (
    <div className="flex gap-2 bg-neo-bg p-1 rounded-full shadow-neo-raised">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <motion.button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`
              px-6 py-2 rounded-full font-medium transition-all duration-300
              relative flex-1
              ${isActive 
                ? 'text-gray-900' 
                : 'text-gray-600 hover:text-gray-800'
              }
              focus:outline-none focus:ring-3 focus:ring-green-300 focus:ring-opacity-50
            `}
          >
            {isActive && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 rounded-full bg-white shadow-neo-raised -z-0"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
};
