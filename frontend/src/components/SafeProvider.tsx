import { SafeProvider as SafeSDKProvider } from '@safe-global/safe-apps-react-sdk';
import { ReactNode, useEffect, useState } from 'react';

interface SafeProviderProps {
  children: ReactNode;
}

/**
 * Wrapper component that provides Safe Apps SDK context to the entire app
 * This enables the app to work both as a standalone app and as a Safe App
 * 
 * If not running in a Safe context, it simply renders children without the SDK wrapper
 */
export function SafeProvider({ children }: SafeProviderProps) {
  const [isSafeContext, setIsSafeContext] = useState(false);
  const [isChecked, setIsChecked] = useState(false);

  useEffect(() => {
    // Check if we're running inside a Safe App iframe
    const checkSafeContext = () => {
      try {
        // Safe Apps run in an iframe and have access to window.parent
        const inIframe = window.self !== window.top;
        const hasSafeInUrl = window.location.ancestorOrigins?.[0]?.includes('safe') ||
                            window.location.ancestorOrigins?.[0]?.includes('gnosis');
        
        setIsSafeContext(inIframe && hasSafeInUrl);
      } catch (e) {
        // If we can't access window.top, we're likely in an iframe (could be Safe)
        setIsSafeContext(false);
      } finally {
        setIsChecked(true);
      }
    };

    checkSafeContext();
  }, []);

  // Wait for check to complete
  if (!isChecked) {
    return <div className="min-h-screen bg-neo-bg-light dark:bg-neo-bg-dark flex items-center justify-center">
      <div className="text-gray-600 dark:text-gray-400">Loading...</div>
    </div>;
  }

  // If not in Safe context, just render children without SDK wrapper
  if (!isSafeContext) {
    console.log('[SafeProvider] Not running in Safe context, rendering without SDK');
    return <>{children}</>;
  }

  // In Safe context, use the SDK provider
  console.log('[SafeProvider] Running in Safe context, initializing SDK');
  return (
    <SafeSDKProvider
      opts={{
        allowedDomains: [/app.safe.global$/, /gnosis-safe.io$/],
        debug: import.meta.env.DEV,
      }}
    >
      {children}
    </SafeSDKProvider>
  );
}

