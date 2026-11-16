import type { TourEvent } from "./types";

export interface Transport {
  send: (event: TourEvent) => void;
  flush: () => void;
  dispose?: () => void;
}

export interface HttpTransportOptions {
  endpoint: string;
  projectKey: string;
  /** Milliseconds to wait before sending a batch. */
  flushInterval?: number;
  maxBatchSize?: number;
  /** Use text/plain for a CORS-safelisted cross-origin request. Defaults to application/json. */
  contentType?: "application/json" | "text/plain";
}

/**
 * Batches events and ships them to the Tourline dashboard (or your own endpoint).
 * Uses sendBeacon on page hide so the last step is not lost when the tab closes.
 */
export const createHttpTransport = ({
  endpoint,
  projectKey,
  flushInterval = 2000,
  maxBatchSize = 20,
  contentType = "application/json",
}: HttpTransportOptions): Transport => {
  let queue: TourEvent[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (queue.length === 0) return;
    const events = queue;
    const body = JSON.stringify({ projectKey, events });
    queue = [];
    const beaconSent =
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function" &&
      navigator.sendBeacon(endpoint, new Blob([body], { type: contentType }));
    if (!beaconSent) {
      void fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": contentType },
        body,
        keepalive: true,
      }).then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      }).catch(() => {
        queue = [...events, ...queue];
        if (!disposed && timer === null) timer = setTimeout(flush, flushInterval);
      });
    }
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") flush();
  };
  if (typeof window !== "undefined") window.addEventListener("pagehide", flush);
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibilityChange);

  return {
    send: (event) => {
      if (disposed) return;
      queue.push(event);
      if (queue.length >= maxBatchSize) {
        flush();
        return;
      }
      if (timer === null) timer = setTimeout(flush, flushInterval);
    },
    flush,
    dispose: () => {
      flush();
      disposed = true;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      if (typeof window !== "undefined") window.removeEventListener("pagehide", flush);
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibilityChange);
    },
  };
};
