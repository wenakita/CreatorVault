import { useEffect, useState } from 'react';

/**
 * Hook to detect secret key combination
 * Combo: ↑ ↑ ↓ ↓ A (Arrow keys + A key)
 */
export function useSecretCode() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [sequence, setSequence] = useState<string[]>([]);

  useEffect(() => {
    const secretCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'KeyA'];
    
    const handleKeyPress = (e: KeyboardEvent) => {
      // Update sequence
      const newSequence = [...sequence, e.code].slice(-5); // Keep last 5 keys
      setSequence(newSequence);

      // Check if it matches
      if (JSON.stringify(newSequence) === JSON.stringify(secretCode)) {
        setIsUnlocked(true);
        // Play success sound or show notification
        console.log('🦅 Admin panel unlocked!');
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [sequence]);

  const lock = () => setIsUnlocked(false);

  return { isUnlocked, lock };
}

