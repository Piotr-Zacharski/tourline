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
