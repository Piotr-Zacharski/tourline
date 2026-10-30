import { createRegistry, initialEngineState, transition } from "../src/core/engine";
import type { EngineState, TourDefinition } from "../src/core/types";

const welcome: TourDefinition = {
  id: "welcome",
  steps: [
    { id: "intro", title: "Hi", content: "Intro" },
    { id: "sidebar", target: "sidebar", title: "Sidebar", content: "Nav" },
    { id: "create", target: "create", title: "Create", content: "Create" },
  ],
};
const billing: TourDefinition = { id: "billing", steps: [{ id: "plan", title: "Plan", content: "Plan" }] };
const registry = createRegistry([welcome, billing]);

const run = (actions: Parameters<typeof transition>[1][], from: EngineState = initialEngineState) => {
  let state = from;
  const events: string[] = [];
  for (const action of actions) {
    const result = transition(state, action, registry, 1000);
    state = result.state;
    events.push(...result.events.map((event) => `${event.type}:${event.tourId}:${event.stepId}`));
  }
  return { state, events };
};

describe("transition", () => {
  it("starts a tour and emits start + first view", () => {
    const { state, events } = run([{ type: "start", tourId: "welcome" }]);
    expect(state.activeTourId).toBe("welcome");
    expect(state.progress.welcome).toMatchObject({ status: "active", stepIndex: 0 });
    expect(events).toEqual(["tour_started:welcome:intro", "step_viewed:welcome:intro"]);
  });

  it("walks through and completes on next after the last step", () => {
    const { state, events } = run([
      { type: "start", tourId: "welcome" },
      { type: "next" },
      { type: "next" },
      { type: "next" },
    ]);
    expect(state.activeTourId).toBeNull();
    expect(state.progress.welcome).toMatchObject({ status: "completed", stepIndex: 2 });
    expect(events.at(-1)).toBe("tour_completed:welcome:create");
  });

  it("does not go before the first step", () => {
    const { state, events } = run([{ type: "start", tourId: "welcome" }, { type: "prev" }]);
    expect(state.progress.welcome?.stepIndex).toBe(0);
    expect(events).toHaveLength(2);
  });

  it("records the step where the user skipped — that is the drop-off metric", () => {
    const { state, events } = run([{ type: "start", tourId: "welcome" }, { type: "next" }, { type: "skip" }]);
    expect(state.progress.welcome).toMatchObject({ status: "skipped", stepIndex: 1 });
    expect(events.at(-1)).toBe("tour_skipped:welcome:sidebar");
  });

  it("skips the running tour when another one starts", () => {
    const { state, events } = run([{ type: "start", tourId: "welcome" }, { type: "start", tourId: "billing" }]);
    expect(state.activeTourId).toBe("billing");
    expect(state.progress.welcome?.status).toBe("skipped");
    expect(events).toContain("tour_skipped:welcome:intro");
  });

  it("returns the same state object for no-op actions", () => {
    const result = transition(initialEngineState, { type: "next" }, registry);
    expect(result.state).toBe(initialEngineState);
    expect(result.events).toEqual([]);
  });

  it("resumes an active tour on hydrate and ignores unknown tours", () => {
    const { state } = run([
      {
        type: "hydrate",
        progress: {
          ghost: { tourId: "ghost", status: "active", stepIndex: 0, updatedAt: 1 },
          welcome: { tourId: "welcome", status: "active", stepIndex: 2, updatedAt: 1 },
        },
      },
    ]);
    expect(state.activeTourId).toBe("welcome");
  });

  it("resets progress", () => {
    const { state } = run([{ type: "start", tourId: "welcome" }, { type: "reset", tourId: "welcome" }]);
    expect(state.progress.welcome).toBeUndefined();
    expect(state.activeTourId).toBeNull();
  });

  it("throws on unknown tours and invalid definitions", () => {
    expect(() => run([{ type: "start", tourId: "nope" }])).toThrow(/Unknown tour/);
    expect(() => createRegistry([welcome, welcome])).toThrow(/Duplicate/);
    expect(() => createRegistry([{ id: "empty", steps: [] }])).toThrow(/no steps/);
  });
});

describe("hidden steps", () => {
  // Hides the middle "sidebar" step, as a feature flag would.
  const hideSidebar = (step: { id: string }) => step.id !== "sidebar";
  const runShown = (actions: Parameters<typeof transition>[1][], isShown: (step: { id: string }) => boolean) => {
    let state = initialEngineState;
    const events: string[] = [];
    for (const action of actions) {
      const result = transition(state, action, registry, 1000, isShown);
      state = result.state;
      events.push(...result.events.map((event) => `${event.type}:${event.stepId}`));
    }
    return { state, events };
  };

  it("skips hidden steps in both directions", () => {
    const forward = runShown([{ type: "start", tourId: "welcome" }, { type: "next" }], hideSidebar);
    expect(forward.state.progress.welcome?.stepIndex).toBe(2);
    expect(forward.events).toEqual(["tour_started:intro", "step_viewed:intro", "step_viewed:create"]);

    const back = runShown([{ type: "start", tourId: "welcome", fromStep: 2 }, { type: "prev" }], hideSidebar);
    expect(back.state.progress.welcome?.stepIndex).toBe(0);
  });

  it("starts at the first shown step and completes when nothing shown is left", () => {
    const hideIntro = (step: { id: string }) => step.id !== "intro";
    const started = runShown([{ type: "start", tourId: "welcome" }], hideIntro);
    expect(started.state.progress.welcome?.stepIndex).toBe(1);

    const onlyIntro = (step: { id: string }) => step.id === "intro";
    const done = runShown([{ type: "start", tourId: "welcome" }, { type: "next" }], onlyIntro);
    expect(done.state.progress.welcome?.status).toBe("completed");
  });

  it("does not start a tour whose steps are all hidden", () => {
    const { state, events } = runShown([{ type: "start", tourId: "welcome" }], () => false);
    expect(state).toBe(initialEngineState);
    expect(events).toEqual([]);
  });

  it("resumes on the next shown step after hydrate", () => {
    const { state } = runShown(
      [{ type: "hydrate", progress: { welcome: { tourId: "welcome", status: "active", stepIndex: 1, updatedAt: 1 } } }],
      hideSidebar,
    );
    expect(state.activeTourId).toBe("welcome");
    expect(state.progress.welcome?.stepIndex).toBe(2);
  });
});
