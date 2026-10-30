import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { readFileSync } from "node:fs";
import {
  TourlineProvider,
  createMemoryStorageAdapter,
  createTourline,
  defineTour,
  tourAnchor,
  useAutoStartTour,
  useTour,
  useTourlineProgress,
} from "../src";
import type { ProgressMap } from "../src";

const first = defineTour({
  id: "first",
  steps: [
    { id: "a", title: "First A", content: "…" },
    { id: "b", title: "First B", content: "…" },
    { id: "c", title: "First C", content: "…" },
  ],
});
const second = defineTour({
  id: "second",
  steps: [{ id: "a", title: "Second A", content: "…" }],
});
const tours = createTourline([first, second] as const).tours;

const AutoStart = ({ tourId }: { tourId: string }) => {
  useAutoStartTour(tourId);
  return null;
};

const renderWith = async (ui: React.ReactNode, initial: ProgressMap = {}) => {
  const storage = createMemoryStorageAdapter(initial);
  await act(async () => {
    render(
      <TourlineProvider tours={tours} storage={storage}>
        {ui}
      </TourlineProvider>,
    );
  });
  return storage;
};

const dialogText = () => screen.queryByRole("dialog")?.textContent ?? null;

describe("useAutoStartTour", () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = () => undefined;
  });

  it("does not restart a tour finished in a previous visit, nor overwrite its stored progress", async () => {
    // 0.1.0: a child's mount effect started the tour before the provider loaded storage.
    const storage = await renderWith(<AutoStart tourId="first" />, {
      first: { tourId: "first", status: "completed", stepIndex: 2, updatedAt: 1 },
    });
    expect(dialogText()).toBeNull();
    expect(storage.load().first?.status).toBe("completed");
  });

  it("starts a tour that was never started", async () => {
    await renderWith(<AutoStart tourId="first" />);
    expect(dialogText()).toContain("First A");
  });

  it("does not let two auto-starts in the same render cancel each other", async () => {
    const storage = await renderWith(
      <>
        <AutoStart tourId="first" />
        <AutoStart tourId="second" />
      </>,
    );
    expect(dialogText()).toContain("First A");
    expect(storage.load().first?.status).toBe("active");

    // The second one waits for the first to end, then starts.
    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(dialogText()).toContain("Second A");
  });
});

const Controls = ({ tourId }: { tourId: string }) => {
  const tour = useTour(tourId);
  return (
    <div>
      <span data-testid="flags">
        {[tour.status, tour.isCompleted, tour.isSkipped, tour.isDone, tour.stepIndex].join(" ")}
      </span>
      <button type="button" onClick={() => tour.start()}>
        start
      </button>
      <button type="button" onClick={() => tour.resume()}>
        resume
      </button>
    </div>
  );
};

describe("resume and status flags", () => {
  it("continues a skipped tour from the step it was left on", async () => {
    await renderWith(<Controls tourId="first" />);
    fireEvent.click(screen.getByText("start"));
    fireEvent.click(screen.getByText("Next"));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByTestId("flags").textContent).toBe("skipped false true true 1");

    fireEvent.click(screen.getByText("resume"));
    expect(dialogText()).toContain("First B");
  });

  it("starts a completed tour over", async () => {
    await renderWith(<Controls tourId="first" />, {
      first: { tourId: "first", status: "completed", stepIndex: 2, updatedAt: 1 },
    });
    expect(screen.getByTestId("flags").textContent).toBe("completed true false true 2");
    fireEvent.click(screen.getByText("resume"));
    expect(dialogText()).toContain("First A");
  });
});

const Progress = ({ tourIds }: { tourIds?: string[] }) => {
  const progress = useTourlineProgress(tourIds);
  return (
    <span data-testid="progress">
      {progress.isReady ? "ready" : "loading"} {progress.completed}/{progress.total}{" "}
      {progress.tours.map((tour) => `${tour.tourId}:${tour.status}`).join(",")}
    </span>
  );
};

describe("useTourlineProgress", () => {
  it("counts completed tours across all tours, in definition order", async () => {
    await renderWith(<Progress />, {
      second: { tourId: "second", status: "completed", stepIndex: 0, updatedAt: 1 },
      first: { tourId: "first", status: "skipped", stepIndex: 1, updatedAt: 1 },
    });
    expect(screen.getByTestId("progress").textContent).toBe("ready 1/2 first:skipped,second:completed");
  });

  it("limits to the tours asked for", async () => {
    await renderWith(<Progress tourIds={["second"]} />);
    expect(screen.getByTestId("progress").textContent).toBe("ready 0/1 second:idle");
  });

  it("throws on an unknown tour id", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(renderWith(<Progress tourIds={["nope"]} />)).rejects.toThrow('unknown tour "nope"');
    spy.mockRestore();
  });
});

describe("optional steps", () => {
  const withOptional = defineTour({
    id: "optional",
    steps: [
      { id: "intro", title: "Intro", content: "…" },
      { id: "missing", target: "not-rendered", title: "Missing", content: "…", optional: true },
      { id: "hidden", target: "hidden-one", title: "Hidden", content: "…", optional: true },
      { id: "shown", target: "visible-one", title: "Shown", content: "…", optional: true },
    ],
  });

  beforeAll(() => {
    // jsdom has no layout: report rects only for elements marked visible.
    vi.spyOn(Element.prototype, "getClientRects").mockImplementation(function (this: Element) {
      return { length: this.getAttribute("data-visible") === "true" ? 1 : 0 } as DOMRectList;
    });
  });
  afterAll(() => {
    vi.restoreAllMocks();
  });

  it("skips steps whose target is missing or hidden and counts only the rest", async () => {
    const storage = createMemoryStorageAdapter();
    const Start = () => {
      const tour = useTour("optional");
      return (
        <button type="button" onClick={() => tour.start()}>
          go
        </button>
      );
    };
    await act(async () => {
      render(
        <TourlineProvider tours={[withOptional]} storage={storage}>
          <Start />
          <div {...tourAnchor("hidden-one")} data-visible="false" />
          <div {...tourAnchor("visible-one")} data-visible="true" />
        </TourlineProvider>,
      );
    });
    fireEvent.click(screen.getByText("go"));
    expect(dialogText()).toContain("1 / 2");
    fireEvent.click(screen.getByText("Next"));
    expect(dialogText()).toContain("Shown");
    expect(dialogText()).toContain("2 / 2");
  });
});

describe("optional steps after advanceOn", () => {
  const menuTour = defineTour({
    id: "menu",
    steps: [
      { id: "open", target: "menu-button", title: "Open the menu", content: "…", advanceOn: "click" },
      { id: "item", target: "menu-item", title: "Pick an item", content: "…", optional: true },
      { id: "end", title: "End", content: "…" },
    ],
  });

  beforeAll(() => {
    // jsdom has no layout: anything rendered counts as visible here.
    vi.spyOn(Element.prototype, "getClientRects").mockImplementation(() => ({ length: 1 }) as DOMRectList);
  });
  afterAll(() => {
    vi.restoreAllMocks();
  });

  it("shows a step whose target the click itself reveals", async () => {
    const Menu = () => {
      const [open, setOpen] = useState(false);
      const tour = useTour("menu");
      return (
        <>
          <button type="button" onClick={() => tour.start()}>
            go
          </button>
          <button type="button" {...tourAnchor("menu-button")} onClick={() => setOpen(true)}>
            Open
          </button>
          {open ? <div {...tourAnchor("menu-item")}>Item</div> : null}
        </>
      );
    };
    await act(async () => {
      render(
        <TourlineProvider tours={[menuTour]} storage={createMemoryStorageAdapter()}>
          <Menu />
        </TourlineProvider>,
      );
    });
    fireEvent.click(screen.getByText("go"));
    fireEvent.click(screen.getByText("Open"));
    await waitFor(() => expect(dialogText()).toContain("Pick an item"));
  });
});

describe("theme", () => {
  it("keeps every default token inside :where() so app overrides always win", () => {
    // Vitest runs from the package root.
    const css = readFileSync("src/styles/tourline.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const selectorsDefiningTokens = [...css.matchAll(/([^{}]+)\{[^{}]*--tl-[a-z-]+\s*:/g)].map((match) =>
      match[1]?.trim(),
    );
    expect(selectorsDefiningTokens.length).toBeGreaterThan(0);
    for (const selector of selectorsDefiningTokens) {
      expect(selector).toMatch(/^:where\(/);
    }
  });
});
