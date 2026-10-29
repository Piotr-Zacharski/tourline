import type { ProgressMap, TourProgress, TourStatus } from "./types";

export interface StorageAdapter {
  load: () => ProgressMap;
  save: (progress: ProgressMap) => void;
}

const STATUSES: readonly TourStatus[] = ["idle", "active", "completed", "skipped"];

const isProgress = (value: unknown): value is TourProgress => {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.tourId === "string" &&
    typeof record.stepIndex === "number" &&
    typeof record.updatedAt === "number" &&
    STATUSES.includes(record.status as TourStatus)
  );
};

/** Drops anything malformed so a corrupted entry never crashes the app. */
export const parseProgress = (raw: string | null): ProgressMap => {
  if (raw === null) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const result: ProgressMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (isProgress(value) && value.tourId === key) result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
};

export const createLocalStorageAdapter = (key = "tourline:progress"): StorageAdapter => ({
  load: () => {
    try {
      return parseProgress(window.localStorage.getItem(key));
    } catch {
      return {};
    }
  },
  save: (progress) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(progress));
    } catch {
      // Private mode or blocked storage: progress simply isn't persisted.
    }
  },
});

export const createMemoryStorageAdapter = (initial: ProgressMap = {}): StorageAdapter => {
  let current = initial;
  return {
    load: () => current,
    save: (progress) => {
      current = progress;
    },
  };
};
