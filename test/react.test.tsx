import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  Checklist,
  TourlineProvider,
  createMemoryStorageAdapter,
  createTourline,
  defineTour,
  useTour,
} from "../src";
import type { TourEvent } from "../src";

const welcome = defineTour({
  id: "welcome",
  steps: [
    { id: "intro", title: "Welcome aboard", content: "Let us show you around." },
    { id: "new", target: "new-project", title: "Create a project", content: "Start here." },
  ],
});
const onboarding = createTourline([welcome] as const);

const StartButton = () => {
  const tour = useTour("welcome");
  return (
    <button type="button" onClick={() => tour.start()}>
      Start ({tour.status})
    </button>
  );
};

const App = ({ onEvent, overrides }: { onEvent?: (event: TourEvent) => void; overrides?: Record<string, Record<string, { title?: string }>> }) => (
  <TourlineProvider tours={onboarding.tours} storage={createMemoryStorageAdapter()} onEvent={onEvent} contentOverrides={overrides} userId="u1">
    <StartButton />
    <button type="button" {...onboarding.anchor("new-project")}>
      New project
    </button>
    <Checklist items={[{ tourId: "welcome", label: "Take the tour" }]} />
  </TourlineProvider>
);

describe("React integration", () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = () => undefined;
  });

  it("runs a tour end to end and reports events with the user id", async () => {
    const events: TourEvent[] = [];
    render(<App onEvent={(event) => events.push(event)} />);

    fireEvent.click(screen.getByText("Start (idle)"));
    expect((await screen.findByRole("dialog")).textContent).toContain("Welcome aboard");
    expect(screen.getByText("Start (active)")).toBeTruthy();

    fireEvent.click(screen.getByText("Next"));
    expect((screen.getByRole("dialog")).textContent).toContain("Create a project");
    expect(screen.getByText("Done")).toBeTruthy();

    fireEvent.click(screen.getByText("Done"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Start (completed)")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100");

    expect(events.map((event) => event.type)).toEqual(["tour_started", "step_viewed", "step_viewed", "tour_completed"]);
    expect(events.every((event) => event.userId === "u1")).toBe(true);
  });

  it("supports keyboard navigation and Escape to skip", async () => {
    render(<App />);
    fireEvent.click(screen.getByText("Start (idle)"));
    await screen.findByRole("dialog");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect((screen.getByRole("dialog")).textContent).toContain("Create a project");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Start (skipped)")).toBeTruthy();
  });

  it("applies remote content overrides", async () => {
    render(<App overrides={{ welcome: { intro: { title: "Cześć!" } } }} />);
    fireEvent.click(screen.getByText("Start (idle)"));
    expect((await screen.findByRole("dialog")).textContent).toContain("Cześć!");
  });

  it("starts a tour from the checklist", async () => {
    render(<App />);
    fireEvent.click(screen.getByText("Take the tour"));
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });

  it("resumes a tour persisted as active", async () => {
    const storage = createMemoryStorageAdapter({
      welcome: { tourId: "welcome", status: "active", stepIndex: 1, updatedAt: 1 },
    });
    await act(async () => {
      render(
        <TourlineProvider tours={onboarding.tours} storage={storage}>
          <div />
        </TourlineProvider>,
      );
    });
    expect((screen.getByRole("dialog")).textContent).toContain("Create a project");
  });

  it("uses a custom renderer in headless mode", async () => {
    render(
      <TourlineProvider
        tours={onboarding.tours}
        storage={createMemoryStorageAdapter()}
        renderStep={({ active, next }) => (
          <button type="button" onClick={next}>
            custom:{active.step.id}
          </button>
        )}
      >
        <StartButton />
      </TourlineProvider>,
    );
    fireEvent.click(screen.getByText("Start (idle)"));
    fireEvent.click(await screen.findByText("custom:intro"));
    expect(screen.getByText("custom:new")).toBeTruthy();
  });

  it("rejects typos at compile time", () => {
    // @ts-expect-error — "new-projet" is not a target used by any step
    onboarding.anchor("new-projet");
    expect(onboarding.anchor("new-project")).toEqual({ "data-tour-id": "new-project" });
  });
});

describe("typed ids", () => {
  it("rejects unknown tour ids at compile time", () => {
    const check = (fn: () => void) => fn;
    // @ts-expect-error — "welcom" is not a defined tour
    check(() => onboarding.useTour("welcom"));
    expect(true).toBe(true);
  });
});
