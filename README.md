# Tourline

Product tours that live in your code. Type-safe steps, anchors that survive refactors, and events ready for a drop-off funnel.

```bash
npm install tourline
```

## Quick start

```tsx
// onboarding.ts
import { createTourline, defineTour } from "tourline";

export const welcomeTour = defineTour({
  id: "welcome",
  steps: [
    { id: "hello", title: "Welcome to Harbor", content: "This takes 30 seconds." },
    { id: "new", target: "new-invoice", title: "Create your first invoice", content: "Pick a client and send." },
  ],
});

export const onboarding = createTourline([welcomeTour] as const);
```

```tsx
// App.tsx
import "tourline/styles.css";
import { TourlineProvider } from "tourline";
import { onboarding } from "./onboarding";

export const App = () => (
  <TourlineProvider tours={onboarding.tours} onEvent={(event) => analytics.track(event.type, event)}>
    <button {...onboarding.anchor("new-invoice")}>New invoice</button>
    <StartTourButton />
  </TourlineProvider>
);

const StartTourButton = () => {
  const tour = onboarding.useTour("welcome");
  return <button onClick={() => tour.start()}>{tour.isDone ? "Replay tour" : "Take the tour"}</button>;
};
```

`onboarding.anchor("new-invoce")` and `onboarding.useTour("welcom")` are compile errors.

## Why

- **Anchors, not selectors.** Steps target a `data-tour-id` attribute, so renaming classes or restructuring markup does not break a tour.
- **Waits for lazy UI.** If a target is not rendered yet (route change, async data), the step waits for it.
- **Progress is persisted** (localStorage by default) and an interrupted tour resumes where the user left it.
- **Events for every step:** `tour_started`, `step_viewed`, `tour_completed`, `tour_skipped`, each with `stepIndex` and `totalSteps`.
- **Accessible:** dialog semantics, focus management, `Esc` / `←` / `→`, reduced-motion support.
- **Themeable** through `--tl-*` CSS variables, with light and dark built in.

## API

### `<TourlineProvider>`

| Prop | Type | Description |
| --- | --- | --- |
| `tours` | `TourDefinition[]` | All tours in the app. |
| `storage` | `StorageAdapter` | Defaults to `createLocalStorageAdapter()`. Use `createMemoryStorageAdapter()` in tests. |
| `onEvent` | `(event) => void` | Forward to PostHog, GA, Mixpanel, your backend. |
| `transport` | `Transport` | Batched delivery, e.g. `createHttpTransport({ endpoint, projectKey })`. |
| `contentOverrides` | `ContentOverrides` | `{ [tourId]: { [stepId]: { title?, content? } } }` to change copy without a deploy. |
| `userId` | `string` | Added to every event. |
| `renderStep` | `(props) => ReactNode` | Headless mode: replace the default popover with your own UI. |

### Hooks

- `useTour(tourId)` → `{ status, stepIndex, totalSteps, isActive, isDone, start(fromStep?), reset() }`
- `useTourline()` → `{ active, next, prev, goTo, skip, complete }` for custom step UIs.

### Components

- `<Checklist items={[{ tourId, label, description? }]} />`: a getting-started list that launches tours and ticks them off.

### Step

```ts
interface TourStep {
  id: string;            // stable, used in analytics and overrides
  target?: string;       // data-tour-id value; omit for a centered step
  title: string;
  content: ReactNode;
  placement?: "top" | "bottom" | "left" | "right" | "center";
}
```

### Theming

```css
:root {
  --tl-accent: #0f766e;
  --tl-radius: 10px;
  --tl-font: "Inter", sans-serif;
}
```

## Development

```bash
npm install
npm test          # vitest
npm run typecheck
npm run build     # ESM + CJS + types into dist/
node demo/build.mjs   # self-contained demo in demo/dist/index.html
```

The state machine (`src/core/engine.ts`) is pure and framework-free; React and the default UI sit on top of it.

## License

MIT
