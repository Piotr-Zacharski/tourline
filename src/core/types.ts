import type { ReactNode } from "react";

export type Placement = "top" | "bottom" | "left" | "right" | "center";

/**
 * App data that steps can read: feature flags, the current user, a router.
 * Empty by default; extend it once and pass the value to `<TourlineProvider context={…}>`:
 *
 *   declare module "tourline" {
 *     interface TourlineContext { user: User }
 *   }
 */
export interface TourlineContext {}

export interface TourStep<TStepId extends string = string> {
  /** Stable id used in analytics and remote content overrides. */
  id: TStepId;
  /** Value of the `data-tour-id` attribute to anchor to. Omit for a centered step. */
  target?: string;
  title: string;
  content: ReactNode;
  /** Defaults to the provider's `ui.placement`. */
  placement?: Placement;
  /** Space between the target and the edge of the spotlight, in px. Defaults to the provider's `ui.padding`. */
  padding?: number;
  /** Let the user click and type in the highlighted element. Implied by `advanceOn`. */
  interactive?: boolean;
  /** DOM event on the target that moves the tour on, e.g. `"click"` or `"change"`. */
  advanceOn?: keyof HTMLElementEventMap;
  /** Show the Back button and accept ←. Default `true`. */
  allowBack?: boolean;
  /** Show Skip and ×, accept Esc and backdrop clicks. Default `true`. */
  allowSkip?: boolean;
  /** Show the step only when this returns true, e.g. behind a feature flag. Hidden steps are skipped. */
  when?: (context: TourlineContext) => boolean;
  /** Page the target lives on. The provider's `navigate` goes there before the step waits for its target. */
  route?: string;
  /** Runs when the step is shown. */
  onEnter?: (context: TourlineContext) => void;
  /** Runs when the step is left: next, back, skip or completion. */
  onLeave?: (context: TourlineContext) => void;
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
