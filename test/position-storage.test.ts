import { computePosition } from "../src/core/position";
import { parseProgress } from "../src/core/storage";
import { createHttpTransport } from "../src/core/transport";
import type { TourEvent } from "../src/core/types";

const viewport = { width: 1000, height: 800 };
const size = { width: 300, height: 150 };

describe("computePosition", () => {
  it("centers when there is no target", () => {
    expect(computePosition(null, size, viewport)).toEqual({ top: 325, left: 350, placement: "center" });
  });

  it("places below the target by default", () => {
    const result = computePosition({ top: 100, left: 400, width: 200, height: 40 }, size, viewport);
    expect(result).toEqual({ top: 152, left: 350, placement: "bottom" });
  });

  it("flips to the top when there is no room below", () => {
    const result = computePosition({ top: 700, left: 400, width: 200, height: 40 }, size, viewport, "bottom");
    expect(result.placement).toBe("top");
    expect(result.top).toBe(538);
  });

  it("moves to the side that fits when the preferred one overflows", () => {
    const result = computePosition({ top: 100, left: 960, width: 30, height: 30 }, size, viewport, "bottom");
    expect(result).toEqual({ top: 40, left: 648, placement: "left" });
  });

  it("clamps inside the viewport when no side fits", () => {
    const small = { width: 320, height: 200 };
    const result = computePosition({ top: 20, left: 280, width: 30, height: 30 }, size, small, "bottom");
    expect(result.left).toBe(12);
    expect(result.top).toBeGreaterThanOrEqual(8);
  });
});

describe("parseProgress", () => {
  it("drops malformed entries and survives bad JSON", () => {
    expect(parseProgress("{not json")).toEqual({});
    expect(parseProgress(null)).toEqual({});
    const raw = JSON.stringify({
      ok: { tourId: "ok", status: "completed", stepIndex: 1, updatedAt: 1 },
      bad: { tourId: "bad", status: "weird", stepIndex: 1, updatedAt: 1 },
      mismatch: { tourId: "other", status: "active", stepIndex: 0, updatedAt: 1 },
    });
    expect(Object.keys(parseProgress(raw))).toEqual(["ok"]);
  });
});

describe("HTTP transport", () => {
  const event: TourEvent = { type: "step_viewed", tourId: "a", stepId: "b", stepIndex: 0, totalSteps: 1, timestamp: 1 };

  it("retries failed fetches and removes lifecycle listeners on dispose", async () => {
    vi.useFakeTimers();
    const pagehide = vi.spyOn(window, "removeEventListener");
    const visibility = vi.spyOn(document, "removeEventListener");
    vi.stubGlobal("navigator", { sendBeacon: () => false });
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false, status: 500 }).mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    const transport = createHttpTransport({ endpoint: "/events", projectKey: "p", flushInterval: 10 });
    transport.send(event);
    await vi.advanceTimersByTimeAsync(20);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ headers: { "Content-Type": "application/json" } });
    transport.dispose?.();
    transport.send(event);
    await vi.advanceTimersByTimeAsync(20);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(pagehide).toHaveBeenCalledWith("pagehide", expect.any(Function));
    expect(visibility).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("supports text/plain for cross-origin simple requests", () => {
    vi.stubGlobal("navigator", { sendBeacon: () => false });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    const transport = createHttpTransport({ endpoint: "https://events.example", projectKey: "p", contentType: "text/plain" });
    transport.send(event);
    transport.flush();
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ headers: { "Content-Type": "text/plain" } });
    transport.dispose?.();
    vi.unstubAllGlobals();
  });
});
