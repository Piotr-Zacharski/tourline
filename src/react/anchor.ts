export const ANCHOR_ATTRIBUTE = "data-tour-id";

export interface AnchorProps {
  [ANCHOR_ATTRIBUTE]: string;
}

/**
 * Spread onto any element to make it a tour target: `<button {...tourAnchor("create-project")}>`.
 * A dedicated attribute survives class renames and refactors, unlike CSS selectors.
 */
export const tourAnchor = (id: string): AnchorProps => ({ [ANCHOR_ATTRIBUTE]: id });

export const findAnchor = (id: string, root: ParentNode = document): HTMLElement | null => {
  const escaped = typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(id) : id.replace(/"/g, '\\"');
  return root.querySelector<HTMLElement>(`[${ANCHOR_ATTRIBUTE}="${escaped}"]`);
};

/** True when the current URL is `route` (path, or path plus query). */
export const isOnRoute = (route: string) => {
  const { pathname, search } = window.location;
  return route === pathname || route === pathname + search;
};

/** Rendered and laid out: `display: none` (on the element or an ancestor) leaves no client rects. */
export const isAnchorVisible = (id: string) => {
  const element = findAnchor(id);
  return element !== null && element.getClientRects().length > 0;
};
