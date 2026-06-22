import { useEffect, useRef, useState } from "react";

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export type ExamTimerState = {
  secondsRemaining: number;
  formatted: string;
  isExpired: boolean;
};

export function useExamTimer(
  durationMinutes: number,
  enabled: boolean,
  onExpire: () => void,
  initialSecondsRemaining?: number | null,
): ExamTimerState {
  const [secondsRemaining, setSecondsRemaining] = useState(() => {
    if (initialSecondsRemaining != null) {
      return Math.max(0, initialSecondsRemaining);
    }
    return durationMinutes * 60;
  });
  const expiredRef = useRef(false);
  const initializedRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!enabled) {
      initializedRef.current = false;
      expiredRef.current = false;
      return;
    }

    if (!initializedRef.current) {
      const startingSeconds =
        initialSecondsRemaining != null
          ? Math.max(0, initialSecondsRemaining)
          : Math.max(0, durationMinutes * 60);

      setSecondsRemaining(startingSeconds);
      expiredRef.current = startingSeconds <= 0;
      initializedRef.current = true;

      if (startingSeconds <= 0) {
        queueMicrotask(() => onExpireRef.current());
      }
    }
  }, [durationMinutes, enabled, initialSecondsRemaining]);

  useEffect(() => {
    if (!enabled || expiredRef.current) return;

    const interval = window.setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          if (!expiredRef.current) {
            expiredRef.current = true;
            onExpireRef.current();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [enabled]);

  return {
    secondsRemaining,
    formatted: formatCountdown(secondsRemaining),
    isExpired: secondsRemaining <= 0,
  };
}
