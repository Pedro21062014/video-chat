import * as React from "react"

const MOBILE_BREAKPOINT = 768;

function checkMobile(): boolean {
  if (typeof window === "undefined") return false;
  const isWidthMobile = window.innerWidth < MOBILE_BREAKPOINT;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent || ""
  );
  return isWidthMobile || (isMobileUA && window.innerWidth <= 1024);
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(checkMobile);

  React.useEffect(() => {
    const onChange = () => {
      setIsMobile(checkMobile());
    };
    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
    };
  }, []);

  return isMobile;
}
