import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode, useState } from "react";
import {
  Checklist,
  TourlineProvider,
  createMemoryStorageAdapter,
  createTourline,
  defineTour,
  useTour,
} from "../src";
import type { TourEvent, TourlineUIOptions } from "../src";

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

  it("scopes default persisted progress by user id", async () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    render(
      <TourlineProvider tours={onboarding.tours} userId="alice">
        <StartButton />
      </TourlineProvider>,
    );
    await waitFor(() => expect(screen.getByText("Start (idle)")).toBeTruthy());
    fireEvent.click(screen.getByText("Start (idle)"));
    expect(localStorage.getItem("tourline:progress:alice")).toContain('"welcome"');
    expect(localStorage.getItem("tourline:progress")).toBeNull();
    vi.unstubAllGlobals();
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

  it("leaves modified, prevented and widget arrow keys to the page", async () => {
    render(<App />);
    fireEvent.click(screen.getByText("Start (idle)"));
    await screen.findByRole("dialog");
    fireEvent.keyDown(window, { key: "ArrowRight", altKey: true });
    const prevented = new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true });
    prevented.preventDefault();
    act(() => window.dispatchEvent(prevented));
    const slider = document.body.appendChild(document.createElement("div"));
    slider.setAttribute("role", "slider");
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(screen.getByRole("dialog").textContent).toContain("Welcome aboard");
    slider.remove();
  });

  it("makes non-interactive page content inert and restores focus when done", async () => {
    render(<App />);
    const start = screen.getByText("Start (idle)");
    start.focus();
    fireEvent.click(start);
    await screen.findByRole("dialog");
    expect(start.closest("div")?.inert).toBe(true);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.activeElement).toBe(start);
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

  it("emits one resumed step view in StrictMode", async () => {
    const events: TourEvent[] = [];
    const storage = createMemoryStorageAdapter({
      welcome: { tourId: "welcome", status: "active", stepIndex: 1, updatedAt: 1 },
    });
    await act(async () => {
      render(
        <StrictMode>
          <TourlineProvider tours={onboarding.tours} storage={storage} onEvent={(event) => events.push(event)}>
            <div />
          </TourlineProvider>
        </StrictMode>,
      );
    });
    expect(events.map((event) => event.type)).toEqual(["step_viewed"]);
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

const guided = defineTour({
  id: "guided",
  steps: [
    { id: "intro", title: "Locked in", content: "No way out.", allowSkip: false },
    { id: "click", target: "create", title: "Click it", content: "Go on.", advanceOn: "click", allowBack: false },
    { id: "end", title: "Done here", content: "Bye." },
  ],
});
const guidedLine = createTourline([guided] as const);

const GuidedStart = () => {
  const tour = useTour("guided");
  return (
    <button type="button" onClick={() => tour.start()}>
      Start guided
    </button>
  );
};

const GuidedApp = ({ ui, onEnter }: { ui?: TourlineUIOptions; onEnter?: () => void }) => {
  const tours = onEnter === undefined ? guidedLine.tours : [{ ...guided, steps: [{ ...guided.steps[0], onEnter }, ...guided.steps.slice(1)] }];
  return (
    <TourlineProvider tours={tours} storage={createMemoryStorageAdapter()} ui={ui}>
      <GuidedStart />
      <button type="button" {...guidedLine.anchor("create")}>
        Create
      </button>
    </TourlineProvider>
  );
};

const lazy = defineTour({
  id: "lazy",
  steps: [{ id: "wait", target: "later", title: "Late arrival", content: "Rendered after a delay." }],
});

const lazyTours = [lazy];

const LazyStart = () => {
  const tour = useTour("lazy");
  return (
    <button type="button" onClick={() => tour.start()}>
      Start lazy
    </button>
  );
};

const LazyApp = ({ ui, onEvent }: { ui?: TourlineUIOptions; onEvent?: (event: TourEvent) => void }) => {
  const [storage] = useState(createMemoryStorageAdapter);
  const [shown, setShown] = useState(false);
  return (
    <TourlineProvider tours={lazyTours} storage={storage} ui={ui} onEvent={onEvent}>
      <LazyStart />
      <button type="button" onClick={() => setShown(true)}>
        Render target
      </button>
      {shown && <div data-tour-id="later">Later</div>}
    </TourlineProvider>
  );
};

describe("options", () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = () => undefined;
  });

  it("uses custom labels and hides progress and dots", async () => {
    render(
      <GuidedApp
        ui={{ labels: { next: "Dalej", progress: (current, total) => `Krok ${current} z ${total}` }, showDots: false }}
      />,
    );
    fireEvent.click(screen.getByText("Start guided"));
    const dialog = await screen.findByRole("dialog");
    expect(screen.getByText("Dalej")).toBeTruthy();
    expect(dialog.textContent).toContain("Krok 1 z 3");
    expect(dialog.querySelector(".tl-dots")).toBeNull();
  });

  it("hides the progress counter", async () => {
    render(<GuidedApp ui={{ showProgress: false }} />);
    fireEvent.click(screen.getByText("Start guided"));
    expect((await screen.findByRole("dialog")).querySelector(".tl-progress")).toBeNull();
  });

  it("respects allowSkip: no Skip, no ×, Escape ignored", async () => {
    render(<GuidedApp />);
    fireEvent.click(screen.getByText("Start guided"));
    await screen.findByRole("dialog");
    expect(screen.queryByText("Skip")).toBeNull();
    expect(screen.queryByLabelText("Close tour")).toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("dialog").textContent).toContain("Locked in");
  });

  it("advances when the target is clicked and respects allowBack", async () => {
    render(<GuidedApp />);
    fireEvent.click(screen.getByText("Start guided"));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByRole("dialog").textContent).toContain("Click it");
    expect(screen.queryByText("Back")).toBeNull();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByRole("dialog").textContent).toContain("Click it");
    fireEvent.click(screen.getByText("Create"));
    await waitFor(() => expect(screen.getByRole("dialog").textContent).toContain("Done here"));
  });

  it("leaves arrow keys to inputs", async () => {
    render(<App />);
    fireEvent.click(screen.getByText("Start (idle)"));
    await screen.findByRole("dialog");
    const input = document.body.appendChild(document.createElement("input"));
    fireEvent.keyDown(input, { key: "ArrowRight" });
    expect(screen.getByRole("dialog").textContent).toContain("Welcome aboard");
    input.remove();
  });

  it("keeps the popover hidden until a late target renders", async () => {
    render(<LazyApp />);
    fireEvent.click(screen.getByText("Start lazy"));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.getAttribute("data-ready")).toBe("false");
    fireEvent.click(screen.getByText("Render target"));
    await waitFor(() => expect(screen.getByRole("dialog").getAttribute("data-ready")).toBe("true"));
  });

  it("shows the step centered when the target never renders", async () => {
    render(<LazyApp ui={{ targetTimeout: 30 }} />);
    fireEvent.click(screen.getByText("Start lazy"));
    await waitFor(() => expect(screen.getByRole("dialog").getAttribute("data-ready")).toBe("true"));
    expect(screen.getByRole("dialog").getAttribute("data-placement")).toBe("center");
  });

  it("reports a target that times out", async () => {
    const events: TourEvent[] = [];
    render(<LazyApp ui={{ targetTimeout: 10 }} onEvent={(event) => events.push(event)} />);
    fireEvent.click(screen.getByText("Start lazy"));
    await waitFor(() => expect(events.map((event) => event.type)).toContain("target_missing"));
  });

  it("can turn off the keyboard", async () => {
    render(<GuidedApp ui={{ keyboard: false }} />);
    fireEvent.click(screen.getByText("Start guided"));
    await screen.findByRole("dialog");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByRole("dialog").textContent).toContain("Locked in");
  });

  it("calls onEnter when a step is shown", async () => {
    let entered = 0;
    render(<GuidedApp onEnter={() => (entered += 1)} />);
    fireEvent.click(screen.getByText("Start guided"));
    await screen.findByRole("dialog");
    expect(entered).toBeGreaterThan(0);
  });
});

interface FlagContext {
  canSeeReports: boolean;
}

const flagged = defineTour({
  id: "flagged",
  steps: [
    { id: "one", title: "First", content: "Always shown." },
    {
      id: "gated",
      title: "Reports",
      content: "Behind a flag.",
      when: (context) => (context as FlagContext).canSeeReports,
    },
    { id: "away", target: "elsewhere", route: "/reports", title: "Over there", content: "On another page." },
  ],
});
const flaggedTours = [flagged];

const FlaggedStart = () => {
  const tour = useTour("flagged");
  return (
    <button type="button" onClick={() => tour.start()}>
      Start flagged
    </button>
  );
};

const FlaggedApp = ({ flags, navigate, isOnRoute }: { flags: FlagContext; navigate?: (route: string) => void; isOnRoute?: (route: string) => boolean }) => {
  const [storage] = useState(createMemoryStorageAdapter);
  return (
    <TourlineProvider tours={flaggedTours} storage={storage} context={flags} navigate={navigate} isOnRoute={isOnRoute}>
      <FlaggedStart />
    </TourlineProvider>
  );
};

describe("context, when and route", () => {
  it("hides steps whose when() is false and counts only shown steps", async () => {
    render(<FlaggedApp flags={{ canSeeReports: false }} navigate={() => undefined} />);
    fireEvent.click(screen.getByText("Start flagged"));
    expect((await screen.findByRole("dialog")).textContent).toContain("1 / 2");
    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByRole("dialog").textContent).toContain("Over there");
    expect(screen.getByRole("dialog").textContent).toContain("2 / 2");
  });

  it("shows gated steps when the context allows them", async () => {
    render(<FlaggedApp flags={{ canSeeReports: true }} navigate={() => undefined} />);
    fireEvent.click(screen.getByText("Start flagged"));
    expect((await screen.findByRole("dialog")).textContent).toContain("1 / 3");
    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByRole("dialog").textContent).toContain("Reports");
  });

  it("navigates to a step's route", async () => {
    const routes: string[] = [];
    render(<FlaggedApp flags={{ canSeeReports: false }} navigate={(route) => routes.push(route)} />);
    fireEvent.click(screen.getByText("Start flagged"));
    await screen.findByRole("dialog");
    expect(routes).toEqual([]);
    fireEvent.click(screen.getByText("Next"));
    await waitFor(() => expect(routes).toEqual(["/reports"]));
  });

  it("accepts a custom route matcher", async () => {
    const navigate = vi.fn();
    render(<FlaggedApp flags={{ canSeeReports: false }} navigate={navigate} isOnRoute={(route) => route === "/reports"} />);
    fireEvent.click(screen.getByText("Start flagged"));
    fireEvent.click(await screen.findByText("Next"));
    await waitFor(() => expect(navigate).not.toHaveBeenCalled());
  });

  it("does not repeat lifecycle hooks when an inline route matcher changes identity", async () => {
    const onEnter = vi.fn();
    const routed = defineTour({ id: "routed", steps: [{ id: "route", route: "/projects/1", title: "Route", content: "…", onEnter }] });
    const RoutedStart = () => {
      const tour = useTour("routed");
      return <button onClick={() => tour.start()}>Start routed</button>;
    };
    const RoutedApp = ({ tick }: { tick: number }) => {
      const [storage] = useState(createMemoryStorageAdapter);
      return (
        <TourlineProvider tours={[routed]} storage={storage} isOnRoute={(route) => route.startsWith("/projects/")}>
          <RoutedStart />
          <span>{tick}</span>
        </TourlineProvider>
      );
    };
    const view = render(<RoutedApp tick={0} />);
    fireEvent.click(screen.getByText("Start routed"));
    await screen.findByRole("dialog");
    view.rerender(<RoutedApp tick={1} />);
    expect(onEnter).toHaveBeenCalledTimes(1);
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
