import { useCallback, useEffect, useRef, useState } from "react";

export default function useToast(timeoutMs = 3000) {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const showToast = useCallback((msg, type = "success") => {
    clearTimer();
    setToast({ msg, type });
    timerRef.current = setTimeout(() => {
      setToast(null);
      timerRef.current = null;
    }, timeoutMs);
  }, [clearTimer, timeoutMs]);

  const hideToast = useCallback(() => {
    clearTimer();
    setToast(null);
  }, [clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return { toast, showToast, hideToast };
}
