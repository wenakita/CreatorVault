import React, { useEffect, useState } from 'react';

interface RevealProps {
  children: React.ReactNode;
  width?: 'fit-content' | '100%';
  className?: string;
  delay?: number; // ms
}

export const Reveal: React.FC<RevealProps> = ({ 
  children, 
  width = "fit-content", 
  className = "",
  delay = 0 
}) => {
  const [start, setStart] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setStart(true);
    }, delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ width }}>
      {/* The Content */}
      <div 
        className={`transition-opacity duration-500 ease-out ${start ? 'opacity-100' : 'opacity-0'}`}
        style={{ transitionDelay: '0.2s' }}
      >
        {children}
      </div>

      {/* The Blue Wipe Block */}
      <div 
        className="absolute inset-0 bg-brand-primary z-20 pointer-events-none"
        style={{
          transform: start ? 'translateX(101%)' : 'translateX(0)', // Move out to right
          left: start ? '0' : '0',
          right: start ? 'auto' : '100%',
          width: '100%',
          transition: 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)',
        }}
      ></div>
      
      {/* Initial state blocker to hide content before wipe starts if desired, 
          but opacity handles it nicely. This div is the actual wiper. */}
      {!start && (
         <div className="absolute inset-0 bg-brand-primary z-20"></div>
      )}
    </div>
  );
};