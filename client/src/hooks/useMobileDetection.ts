import { useState, useEffect } from "react";

export function useMobileDetection() {
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(false);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      const userAgentMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
      const touchCapable = navigator.maxTouchPoints > 0;
      const smallScreen = window.innerWidth < 1024;
      
      setIsMobileOrTablet(userAgentMobile || (touchCapable && smallScreen));
      setIsTouch(touchCapable);
    };

    checkDevice();
    window.addEventListener("resize", checkDevice);
    return () => window.removeEventListener("resize", checkDevice);
  }, []);

  return { isMobileOrTablet, isTouch };
}
