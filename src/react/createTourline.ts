import type { TourDefinition } from "../core/types";
import { tourAnchor } from "./anchor";
import type { AnchorProps } from "./anchor";
import { useTour } from "./hooks";
import type { TourControls } from "./hooks";

type TourIds<T extends readonly TourDefinition[]> = T[number]["id"];
type StepOf<T extends readonly TourDefinition[]> = T[number]["steps"][number];
type TargetOf<S> = S extends { target: infer X extends string } ? X : never;
type Targets<T extends readonly TourDefinition[]> = TargetOf<StepOf<T>>;

export interface TypedTourline<T extends readonly TourDefinition[]> {
  tours: T;
  /** Only accepts ids of tours you defined — typos fail at compile time. */
  useTour: (tourId: TourIds<T>) => TourControls;
  /** Only accepts targets referenced by your steps. */
  anchor: (target: Targets<T>) => AnchorProps;
}

/**
 * Type-safe entry point:
 *   export const onboarding = createTourline([welcomeTour, billingTour] as const);
 *   onboarding.anchor("new-project")  // ✅
 *   onboarding.anchor("new-projet")   // ❌ compile error
 */
export const createTourline = <const T extends readonly TourDefinition[]>(tours: T): TypedTourline<T> => ({
  tours,
  useTour: (tourId) => useTour(tourId),
  anchor: (target) => tourAnchor(target),
});

/** Identity helper that keeps literal ids for `createTourline`. */
export const defineTour = <const T extends TourDefinition>(tour: T): T => tour;
