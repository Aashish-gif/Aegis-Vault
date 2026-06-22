import { useEffect, useRef } from "react";

export type CheatViolationHandler = (violation: string) => void;

const BLOCKED_SHORTCUTS: Record<string, string> = {
  c: "COPY",
  v: "PASTE",
  x: "CUT",
  a: "SELECT_ALL",
};

function isSplitScreenViewport(): boolean {
  return window.innerWidth < 1000 || window.innerHeight < 600;
}

export function useExamArmor(
  onViolation: CheatViolationHandler,
  enabled = true,
): void {
  const handlerRef = useRef(onViolation);
  handlerRef.current = onViolation;

  useEffect(() => {
    if (!enabled) return;
    const emit = (violation: string) => {
      handlerRef.current(violation);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        emit("TAB_SWITCH");
      }
    };

    const handleResize = () => {
      if (isSplitScreenViewport()) {
        emit("SPLIT_SCREEN");
      }
    };

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      emit("RIGHT_CLICK");
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const modifier = event.ctrlKey || event.metaKey;

      if (modifier) {
        const violation = BLOCKED_SHORTCUTS[event.key.toLowerCase()];
        if (violation) {
          event.preventDefault();
          emit(violation);
          return;
        }
      }

      if (event.key === "F12") {
        event.preventDefault();
        emit("DEVTOOLS");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("resize", handleResize);
    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);

    handleResize();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled]);
}
