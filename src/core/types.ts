import type { ReactNode } from "react";

export type Placement = "top" | "bottom" | "left" | "right" | "center";

export interface TourStep<TStepId extends string = string> {
  /** Stable id used in analytics and remote content overrides. */
  id: TStepId;
  /** Value of the `data-tour-id` attribute to anchor to. Omit for a centered step. */
  target?: string;
  title: string;
  content: ReactNode;
  placement?: Placement;
}

export interface TourDefinition<TTourId extends string = string, TStepId extends string = string> {
  id: TTourId;
  steps: readonly TourStep<TStepId>[];
}

export type TourStatus = "idle" | "active" | "completed" | "skipped";

export interface TourProgress {
  tourId: string;
  status: TourStatus;
  stepIndex: number;
  updatedAt: number;
}

export type ProgressMap = Record<string, TourProgress>;

export interface EngineState {
  activeTourId: string | null;
  progress: ProgressMap;
}

export type TourEventType = "tour_started" | "step_viewed" | "tour_completed" | "tour_skipped";

export interface TourEvent {
  type: TourEventType;
  tourId: string;
  stepId: string;
  stepIndex: number;
  totalSteps: number;
  timestamp: number;
  userId?: string;
}

export interface StepContentOverride {
  title?: string;
  content?: string;
}

/** tourId -> stepId -> override. Lets copy change without a deploy. */
export type ContentOverrides = Record<string, Record<string, StepContentOverride>>;
