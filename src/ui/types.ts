import type { ReactNode } from "react";
import type { Rect } from "../core/position";
import type { ActiveTour } from "../react/hooks";

export interface StepRenderProps {
  active: ActiveTour;
  /** Viewport rect of the anchored element, or null for centered steps. */
  targetRect: Rect | null;
  next: () => void;
  prev: () => void;
  skip: () => void;
}

export type StepRenderer = (props: StepRenderProps) => ReactNode;
