import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { X, Smartphone } from 'lucide-react';

const BANNER_DISMISSED_KEY = 'rc_mobile_banner_dismissed';

export function MobileBanner() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const isDismissed = sessionStorage.getItem(BANNER_DISMISSED_KEY) === 'true';
    
    if (isDismissed) {
      setShowBanner(false);
      return;
    }

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isSmallScreen = window.innerWidth < 1024;
    
    if (isMobile || isSmallScreen) {
      setShowBanner(true);
    }
  }, []);

  useEffect(() => {
    if (showBanner) {
      document.body.classList.add('has-mobile-banner');
    } else {
      document.body.classList.remove('has-mobile-banner');
    }
    
    return () => {
      document.body.classList.remove('has-mobile-banner');
    };
  }, [showBanner]);

  const handleDismiss = () => {
    sessionStorage.setItem(BANNER_DISMISSED_KEY, 'true');
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div 
      className="fixed top-0 left-0 right-0 h-11 flex items-center justify-between px-4 z-[9999]"
      style={{ 
        background: 'linear-gradient(90deg, #1a1a2e 0%, #2d2d44 100%)',
        borderBottom: '1px solid #333',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
      }}
      data-testid="mobile-banner"
    >
      <div className="flex items-center gap-2.5">
        <Smartphone className="w-4 h-4 text-orange-500" />
        <span className="text-white text-sm">
          We have a mobile-optimized experience!
        </span>
        <Link 
          href="/mobile" 
          className="text-orange-500 text-sm font-semibold no-underline px-3 py-1.5 border border-orange-500 rounded-md transition-all hover:bg-orange-500 hover:text-white"
          data-testid="link-try-mobile"
        >
          Try it now →
        </Link>
      </div>
      <button 
        className="bg-transparent border-none text-gray-500 cursor-pointer p-2 flex items-center justify-center hover:text-white transition-colors"
        onClick={handleDismiss}
        aria-label="Dismiss banner"
        data-testid="button-dismiss-banner"
      >
        <X size={18} />
      </button>
    </div>
  );
}
