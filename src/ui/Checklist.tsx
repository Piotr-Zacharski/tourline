import { useTourlineContext } from "../react/context";
import type { TourStatus } from "../core/types";

export interface ChecklistItem {
  tourId: string;
  label: string;
  description?: string;
}

export interface ChecklistProps {
  title?: string;
  items: readonly ChecklistItem[];
  /** Count skipped tours as done. Defaults to false: only completed tours tick the box. */
  countSkipped?: boolean;
}

const isDone = (status: TourStatus, countSkipped: boolean) =>
  status === "completed" || (countSkipped && status === "skipped");

/** "Getting started" list — each item launches a tour and ticks off when it is finished. */
export const Checklist = ({ title = "Getting started", items, countSkipped = false }: ChecklistProps) => {
  const { state, dispatch } = useTourlineContext();
  const statuses = items.map((item) => {
    const progress = state.progress[item.tourId];
    return progress === undefined ? "idle" : progress.status;
  });
  // A skipped tour picks up where the user left it; any other starts from the beginning.
  const launch = (tourId: string) => {
    const progress = state.progress[tourId];
    const fromStep = progress !== undefined && progress.status === "skipped" ? progress.stepIndex : 0;
    dispatch({ type: "start", tourId, fromStep });
  };
  const doneCount = statuses.filter((status) => isDone(status, countSkipped)).length;
  const percent = items.length === 0 ? 0 : Math.round((doneCount / items.length) * 100);

  return (
    <section className="tl-checklist" aria-label={title}>
      <header className="tl-checklist__header">
        <h3 className="tl-checklist__title">{title}</h3>
        <span className="tl-checklist__count">
          {doneCount}/{items.length}
        </span>
      </header>
      <div
        className="tl-checklist__bar"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      <ul className="tl-checklist__list">
        {items.map((item, index) => {
          const status = statuses[index];
          const done = status !== undefined && isDone(status, countSkipped);
          return (
            <li key={item.tourId}>
              <button
                type="button"
                className="tl-checklist__item"
                data-done={done}
                onClick={() => launch(item.tourId)}
              >
                <span className="tl-checklist__check" aria-hidden="true">
                  {done ? "✓" : ""}
                </span>
                <span className="tl-checklist__text">
                  <span className="tl-checklist__label">{item.label}</span>
                  {item.description === undefined ? null : (
                    <span className="tl-checklist__description">{item.description}</span>
                  )}
                </span>
                <span className="tl-visually-hidden">{done ? "(done)" : "(not started)"}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
