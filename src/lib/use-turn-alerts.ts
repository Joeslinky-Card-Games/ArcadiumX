import { useEffect, useRef } from "react";
import {
  armAlerts,
  playTurnSound,
  restoreTabTitle,
  showNotification,
} from "@/lib/notify";

/** Poll live matches even when the tab is in the background so turn alerts can fire. */
export const MATCH_LIVE_QUERY = {
  refetchIntervalInBackground: true,
} as const;

export function useTurnAlerts({
  isMyTurn,
  active,
  title,
  body,
  tag,
}: {
  isMyTurn: boolean;
  active: boolean;
  title: string;
  body: string;
  tag: string;
}) {
  const wasMyTurn = useRef(false);

  useEffect(() => {
    const onInteract = () => armAlerts();
    window.addEventListener("pointerdown", onInteract);
    window.addEventListener("keydown", onInteract);
    return () => {
      window.removeEventListener("pointerdown", onInteract);
      window.removeEventListener("keydown", onInteract);
    };
  }, []);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") restoreTabTitle();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, []);

  useEffect(() => {
    if (isMyTurn && active && !wasMyTurn.current) {
      playTurnSound();
      showNotification(title, body, tag);
    }
    wasMyTurn.current = isMyTurn && active;
    if (!(isMyTurn && active)) restoreTabTitle();
  }, [isMyTurn, active, title, body, tag]);
}
