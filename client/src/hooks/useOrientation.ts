import { useState, useEffect } from "react";

export function useOrientation() {
  const [isPortrait, setIsPortrait] = useState(false);
  const [isLandscape, setIsLandscape] = useState(true);

  useEffect(() => {
    const checkOrientation = () => {
      const portrait = window.matchMedia("(orientation: portrait)").matches;
      setIsPortrait(portrait);
      setIsLandscape(!portrait);
    };

    checkOrientation();

    const mql = window.matchMedia("(orientation: portrait)");
    const handler = (e: MediaQueryListEvent) => {
      setIsPortrait(e.matches);
      setIsLandscape(!e.matches);
    };

    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return { isPortrait, isLandscape };
}
