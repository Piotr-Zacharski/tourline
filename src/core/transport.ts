import type { TourEvent } from "./types";

export interface Transport {
  send: (event: TourEvent) => void;
  flush: () => void;
}

export interface HttpTransportOptions {
  endpoint: string;
  projectKey: string;
  /** Milliseconds to wait before sending a batch. */
  flushInterval?: number;
  maxBatchSize?: number;
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
}: HttpTransportOptions): Transport => {
  let queue: TourEvent[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (queue.length === 0) return;
    const body = JSON.stringify({ projectKey, events: queue });
    queue = [];
    const beaconSent =
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function" &&
      navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
    if (!beaconSent) {
      void fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => undefined);
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", flush);
  }

  return {
    send: (event) => {
      queue.push(event);
      if (queue.length >= maxBatchSize) {
        flush();
        return;
      }
      if (timer === null) timer = setTimeout(flush, flushInterval);
    },
    flush,
  };
};
