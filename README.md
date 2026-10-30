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
- **Waits for lazy UI.** If a target is not rendered yet (route change, async data), the step waits for it with the popover hidden, then appears in place.
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
| `ui` | `TourlineUIOptions` | Defaults for the built-in UI, see below. |
| `context` | `TourlineContext` | App data passed to each step's `when`, `onEnter` and `onLeave`, e.g. `{ user }`. |
| `navigate` | `(route) => void` | Client-side navigation for steps with a `route`: `router.push` (Next.js), `navigate` (react-router). |

#### `ui`

| Option | Default | Description |
| --- | --- | --- |
| `labels` | English | `{ next, back, skip, done, close, progress(current, total) }`; any subset. |
| `showProgress` | `true` | The "2 / 4" counter. |
| `showDots` | `true` | The progress dots. |
| `closeOnBackdropClick` | `true` | Clicking the dimmed page skips the tour. Clicks on the highlighted element never do. |
| `keyboard` | `true` | `Esc` skips, `←` / `→` navigate. |
| `placement` | `"bottom"` | For steps that do not set one. |
| `gap` | `12` | Distance between the target and the popover, in px. |
| `padding` | `6` | Space around the target inside the spotlight, in px. |
| `targetTimeout` | `5000` | How long a step waits for a target that has not rendered yet (the popover stays hidden meanwhile) before showing centered, in ms. |

```tsx
<TourlineProvider
  tours={onboarding.tours}
  ui={{ labels: { next: "Dalej", back: "Wstecz", skip: "Pomiń", done: "Gotowe" }, showDots: false }}
>
```

### Hooks

- `useTour(tourId)` → `{ tourId, status, stepIndex, totalSteps, isActive, isCompleted, isSkipped, isDone, isReady, start(fromStep?), resume(), reset() }`
  - `resume()` continues a skipped tour from the step the user left it on, and starts any other from the beginning.
  - `isReady` is false until stored progress is loaded; before that every tour reads `"idle"`.
- `useAutoStartTour(tourId, { enabled? })` starts a tour the first time a component renders: after progress is loaded, only if the tour was never started, and never over another running tour (it waits for it to end).
- `useTourlineProgress(tourIds?)` → `{ tours, completed, total, isReady }` for all tours or the ones listed, e.g. for a "3 of 8 done" ring.
- `useTourline()` → `{ active, next, prev, goTo, skip, complete }` for custom step UIs.

`createTourline` returns typed versions: `onboarding.useTour`, `onboarding.useAutoStartTour`, `onboarding.useProgress`.

```tsx
const SupportersPage = () => {
  onboarding.useAutoStartTour("supporters");
  …
};

const OnboardingRing = () => {
  const { completed, total, tours } = onboarding.useProgress();
  // tours[i].resume() picks up a skipped tour
};
```

Custom renderers (`renderStep`) get `{ active, targetRect, ui, next, prev, skip }`, where `ui` has every default filled in.

### Components

- `<Checklist items={[{ tourId, label, description? }]} />`: a getting-started list that launches tours and ticks them off. A skipped tour continues where it was left.

### Step

```ts
interface TourStep {
  id: string;            // stable, used in analytics and overrides
  target?: string;       // data-tour-id value; omit for a centered step
  title: string;
  content: ReactNode;
  placement?: "top" | "bottom" | "left" | "right" | "center";
  padding?: number;      // spotlight padding, overrides ui.padding
  interactive?: boolean; // the highlighted element stays clickable
  advanceOn?: "click" | "change" | …; // event on the target that goes to the next step (implies interactive)
  allowBack?: boolean;   // default true: Back button and ←
  allowSkip?: boolean;   // default true: Skip, ×, Esc and backdrop click
  when?: (ctx) => boolean; // show the step only when true, e.g. behind a feature flag
  optional?: boolean;    // skip the step when its target is missing or hidden (display: none)
  route?: string;        // page the target lives on; the provider's navigate goes there first
  onEnter?: (ctx) => void; // runs when the step is shown
  onLeave?: (ctx) => void; // runs when the step is left (next, back, skip, done)
}
```

Hidden steps (`when` returns false) are skipped by Next and Back, and the counter and dots only count the steps a user sees. Events keep the step's index in the definition, so funnels stay comparable across users.

`optional: true` does the same for UI that is not always there: a link only some plans get, a desktop-only sidebar, a button that needs data. Without it, a step waits for its target (up to `ui.targetTimeout`) and then shows centered. The check runs whenever the tour moves, and only once the user is on the step's `route`.

### Feature flags and multi-page tours

Type the context once, then pass it to the provider:

```ts
// tourline.d.ts
import "tourline";
declare module "tourline" {
  interface TourlineContext {
    user: User;
  }
}
```

```tsx
const steps = [
  { id: "plans", target: "plans-table", route: "/admin/my-projects", when: ({ user }) => user.canSeeProjectPlans, … },
];

<TourlineProvider tours={tours} context={{ user }} navigate={router.push}>
```

A step with a `route` navigates there and waits for its target (up to `ui.targetTimeout`) before showing.

```ts
{ id: "create", target: "new-invoice", title: "Try it", content: "Click New invoice.", advanceOn: "click", allowBack: false }
```

### Theming

Dark mode follows the OS, or the app when it sets `data-theme="dark"` or a `.dark` class on `<html>` (HeroUI, next-themes). `.light` / `data-theme="light"` force light.

The defaults have zero specificity, so tokens you set on `:root` win over the light and the dark ones alike. That also means a token you set stays the same in dark mode while the ones you did not set switch, so set colours in pairs: `--tl-accent` with `--tl-accent-text` and `--tl-accent-soft`.

A light-only app keeps the popover light under an OS dark theme by pinning every colour token:

```css
:root {
  --tl-surface: #ffffff;
  --tl-text: #161823;
  --tl-text-muted: #636779;
  --tl-border: #e4e6ee;
  --tl-accent: #0f766e;
  --tl-accent-text: #ffffff;
  --tl-accent-soft: #e6f4f2;
  --tl-success: #16a34a;
  --tl-overlay: rgba(15, 17, 26, 0.55);
}
```

```css
:root {
  --tl-accent: #0f766e;
  --tl-radius: 10px;
  --tl-font: "Inter", sans-serif;
}
```

## Next.js App Router

The package is marked `"use client"`, so `<TourlineProvider>` can go straight into a Server Component layout. Tour definitions (`defineTour`, `createTourline`) and `onboarding.anchor()` belong in Client Components too; in a Server Component write the attribute directly: `data-tour-id="plans-table"`.

```tsx
// app/(admin)/layout.tsx
import "tourline/styles.css";
import { AdminTours } from "./admin-tours"; // "use client": TourlineProvider with context and navigate

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminTours>{children}</AdminTours>;
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
