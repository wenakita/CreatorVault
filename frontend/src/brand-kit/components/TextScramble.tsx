import React, { useState, useEffect, useRef } from 'react';

interface TextScrambleProps {
  text: string;
  className?: string;
  font?: 'sans' | 'mono' | 'doto';
  trigger?: boolean;
  speed?: number;
  complexity?: 'simple' | 'complex';
}

// Geometric primitives for the technical "Base" aesthetic
const SIMPLE_SYMBOLS = ['●', '■', '▲', '◆', '○', '□', '△', '◊', '⬡', '⬢', '✶', '✕', '✧', '✦', '✢'];
const COMPLEX_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?";

export const TextScramble: React.FC<TextScrambleProps> = ({ 
  text, 
  className = '', 
  font = 'sans',
  trigger = true,
  speed = 1.0, // Increased default speed for more impact
  complexity = 'simple'
}) => {
  const [output, setOutput] = useState<Array<{char: string, style: React.CSSProperties}>>([]);
  const frameRef = useRef<number>(0);
  const progressRef = useRef<number>(0);

  useEffect(() => {
    // If not triggered (e.g. initial state or mouse leave), show full text
    if (!trigger) {
      setOutput(text.split('').map(char => ({ char, style: {} })));
      return;
    }

    // Reset progress when triggered
    progressRef.current = 0;
    
    const animate = () => {
      // Increment progress. 
      // Speed multiplier increased to 0.5 for faster resolution
      progressRef.current += speed * 0.5; 
      
      const newOutput = text.split('').map((char, index) => {
        if (char === ' ') return { char: ' ', style: {} };

        // If the "decoder" cursor has passed this index, it's resolved
        if (index < Math.floor(progressRef.current)) {
          return { char, style: {} };
        }

        // Otherwise, it's in a scrambled/morphing state
        const isComplex = complexity === 'complex';
        
        // Extended character set logic
        let randomChar = SIMPLE_SYMBOLS[Math.floor(Math.random() * SIMPLE_SYMBOLS.length)];
        
        if (isComplex && Math.random() > 0.3) {
            randomChar = COMPLEX_CHARS[Math.floor(Math.random() * COMPLEX_CHARS.length)];
        }
        
        let style: React.CSSProperties = {
            opacity: 0.7,
            display: 'inline-block',
            width: '1ch', // Attempt to stabilize width
            textAlign: 'center'
        };

        if (isComplex) {
             // Random rotation for that "tumbling" effect
             const rotate = Math.floor(Math.random() * 180) - 90; 
             // Slight scaling for depth
             const scale = 0.8 + Math.random() * 0.4;
             
             style = {
                 ...style,
                 transform: `rotate(${rotate}deg) scale(${scale})`,
                 // Occasional brand color flash
                 color: Math.random() > 0.8 ? '#0052FF' : 'inherit',
                 // Subtle blur glitch
                 filter: Math.random() > 0.9 ? 'blur(1px)' : 'none'
             };
        }
        
        return { char: randomChar, style };
      });

      setOutput(newOutput);

      if (progressRef.current < text.length + 5) { // Run slightly longer to clear any trailing artifacts
        frameRef.current = requestAnimationFrame(animate);
      }
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [trigger, text, speed, complexity]);

  const fontClass = font === 'doto' ? 'font-doto' : font === 'mono' ? 'font-mono' : 'font-sans';

  return (
    <span className={`${fontClass} ${className} inline-flex whitespace-pre`}>
      {output.map((item, i) => (
        <span key={i} style={item.style} className="transition-colors duration-75">
          {item.char}
        </span>
      ))}
    </span>
  );
};