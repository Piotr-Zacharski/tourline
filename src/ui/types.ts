import type { ReactNode } from "react";
import type { Rect } from "../core/position";
import type { Placement } from "../core/types";
import type { ActiveTour } from "../react/hooks";

export interface TourlineLabels {
  next: string;
  back: string;
  skip: string;
  done: string;
  /** Accessible name of the × button. */
  close: string;
  /** Progress text, "2 / 4" by default. */
  progress: (current: number, total: number) => string;
}

/** Defaults for the built-in step UI, set once on `<TourlineProvider ui={…}>`. */
export interface TourlineUIOptions {
  /** Button texts, e.g. for translations. Missing keys fall back to English. */
  labels?: Partial<TourlineLabels>;
  /** Show the "2 / 4" counter. Default `true`. */
  showProgress?: boolean;
  /** Show the progress dots. Default `true`. */
  showDots?: boolean;
  /** Clicking the dimmed backdrop skips the tour. Default `true`. */
  closeOnBackdropClick?: boolean;
  /** Esc skips, ← and → navigate. Default `true`. */
  keyboard?: boolean;
  /** Placement for steps that do not set one. Default `"bottom"`. */
  placement?: Placement;
  /** Distance between the target and the popover, in px. Default `12`. */
  gap?: number;
  /** Space between the target and the edge of the spotlight, in px. Default `6`. */
  padding?: number;
  /** How long a step waits for a target that is not rendered yet before it shows centered, in ms. Default `5000`. */
  targetTimeout?: number;
}

export type ResolvedUIOptions = Required<Omit<TourlineUIOptions, "labels">> & { labels: TourlineLabels };

const DEFAULT_LABELS: TourlineLabels = {
  next: "Next",
  back: "Back",
  skip: "Skip",
  done: "Done",
  close: "Close tour",
  progress: (current, total) => `${current} / ${total}`,
};

const pick = <T>(value: T | undefined, fallback: T): T => (value === undefined ? fallback : value);

export const resolveUIOptions = (options: TourlineUIOptions = {}): ResolvedUIOptions => ({
  labels: { ...DEFAULT_LABELS, ...options.labels },
  showProgress: pick(options.showProgress, true),
  showDots: pick(options.showDots, true),
  closeOnBackdropClick: pick(options.closeOnBackdropClick, true),
  keyboard: pick(options.keyboard, true),
  placement: pick(options.placement, "bottom"),
  gap: pick(options.gap, 12),
  padding: pick(options.padding, 6),
  targetTimeout: pick(options.targetTimeout, 5000),
});

export interface StepRenderProps {
  active: ActiveTour;
  /** Viewport rect of the anchored element, or null for centered steps. */
  targetRect: Rect | null;
  /** Provider UI options with defaults filled in. */
  ui: ResolvedUIOptions;
  next: () => void;
  prev: () => void;
  skip: () => void;
}

export type StepRenderer = (props: StepRenderProps) => ReactNode;
