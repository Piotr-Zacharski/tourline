import type { Placement } from "./types";

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface PositionResult {
  top: number;
  left: number;
  placement: Placement;
}

const OPPOSITE: Record<Exclude<Placement, "center">, Exclude<Placement, "center">> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

const place = (target: Rect, size: Size, placement: Exclude<Placement, "center">, gap: number) => {
  const centerX = target.left + target.width / 2 - size.width / 2;
  const centerY = target.top + target.height / 2 - size.height / 2;
  switch (placement) {
    case "top":
      return { top: target.top - size.height - gap, left: centerX };
    case "bottom":
      return { top: target.top + target.height + gap, left: centerX };
    case "left":
      return { top: centerY, left: target.left - size.width - gap };
    case "right":
      return { top: centerY, left: target.left + target.width + gap };
  }
};

const fits = (pos: { top: number; left: number }, size: Size, viewport: Size, margin: number) =>
  pos.top >= margin &&
  pos.left >= margin &&
  pos.top + size.height <= viewport.height - margin &&
  pos.left + size.width <= viewport.width - margin;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

/** Places the popover next to the target, flipping to the opposite side and clamping to the viewport. */
export const computePosition = (
  target: Rect | null,
  size: Size,
  viewport: Size,
  preferred: Placement = "bottom",
  gap = 12,
  margin = 8,
): PositionResult => {
  if (target === null || preferred === "center") {
    return {
      top: Math.max(margin, (viewport.height - size.height) / 2),
      left: Math.max(margin, (viewport.width - size.width) / 2),
      placement: "center",
    };
  }
  const candidates: Exclude<Placement, "center">[] = [preferred, OPPOSITE[preferred], "bottom", "top", "right", "left"];
  const chosen = candidates.find((candidate) => fits(place(target, size, candidate, gap), size, viewport, margin));
  const placement = chosen === undefined ? preferred : chosen;
  const raw = place(target, size, placement, gap);
  return {
    top: clamp(raw.top, margin, viewport.height - size.height - margin),
    left: clamp(raw.left, margin, viewport.width - size.width - margin),
    placement,
  };
};
