import { describe, it, expect } from "vitest";
import { computePaneLayout, findNeighborPane } from "./pane-navigation";
import type { PaneNode, SplitDirection } from "../types/session";

const leaf = (id: string): PaneNode => ({ type: "leaf", id, title: id });
const split = (direction: SplitDirection, first: PaneNode, second: PaneNode, ratio = 0.5, id = `s-${Math.random()}`): PaneNode => ({
  type: "split", id, direction, first, second, ratio,
});

describe("computePaneLayout", () => {
  it("computes full unit square and zero splitters for a single leaf", () => {
    const layout = computePaneLayout(leaf("a"));
    expect(layout.leaves).toHaveLength(1);
    expect(layout.leaves[0]).toMatchObject({ pane: { id: "a" }, x: 0, y: 0, w: 1, h: 1 });
    expect(layout.splitters).toHaveLength(0);
  });

  it("computes normalized leaf rectangles and splitter container bounds for nested splits", () => {
    // Izquierda (40%): a. Derecha (60%): b arriba (30%) y c abajo (70%).
    const tree = split("horizontal", leaf("a"), split("vertical", leaf("b"), leaf("c"), 0.3, "s-vert"), 0.4, "s-horiz");
    const { leaves, splitters } = computePaneLayout(tree);

    expect(leaves.map((l) => l.pane.id)).toEqual(["a", "b", "c"]);
    expect(leaves[0]).toMatchObject({ x: 0, y: 0, w: 0.4, h: 1 });
    expect(leaves[1].x).toBeCloseTo(0.4);
    expect(leaves[1].y).toBeCloseTo(0);
    expect(leaves[1].w).toBeCloseTo(0.6);
    expect(leaves[1].h).toBeCloseTo(0.3);
    expect(leaves[2].x).toBeCloseTo(0.4);
    expect(leaves[2].y).toBeCloseTo(0.3);
    expect(leaves[2].w).toBeCloseTo(0.6);
    expect(leaves[2].h).toBeCloseTo(0.7);

    expect(splitters).toHaveLength(2);
    expect(splitters[0]).toMatchObject({
      id: "s-horiz",
      direction: "horizontal",
      ratio: 0.4,
      x: 0.4,
      y: 0,
      h: 1,
      containerX: 0,
      containerY: 0,
      containerW: 1,
      containerH: 1,
    });
    expect(splitters[1].id).toBe("s-vert");
    expect(splitters[1].direction).toBe("vertical");
    expect(splitters[1].x).toBeCloseTo(0.4);
    expect(splitters[1].y).toBeCloseTo(0.3);
    expect(splitters[1].w).toBeCloseTo(0.6);
    expect(splitters[1].containerX).toBeCloseTo(0.4);
    expect(splitters[1].containerW).toBeCloseTo(0.6);
    expect(splitters[1].containerH).toBeCloseTo(1);
  });
});

describe("findNeighborPane", () => {
  it("returns null for a single pane and for unknown ids", () => {
    expect(findNeighborPane(leaf("a"), "a", "right")).toBeNull();
    expect(findNeighborPane(split("horizontal", leaf("a"), leaf("b")), "zzz", "right")).toBeNull();
  });

  it("moves between two side-by-side panes (horizontal split)", () => {
    const t = split("horizontal", leaf("a"), leaf("b"));
    expect(findNeighborPane(t, "a", "right")).toBe("b");
    expect(findNeighborPane(t, "b", "left")).toBe("a");
    expect(findNeighborPane(t, "a", "left")).toBeNull();
    expect(findNeighborPane(t, "b", "right")).toBeNull();
    expect(findNeighborPane(t, "a", "up")).toBeNull();
    expect(findNeighborPane(t, "a", "down")).toBeNull();
  });

  it("moves between two stacked panes (vertical split)", () => {
    const t = split("vertical", leaf("a"), leaf("b"));
    expect(findNeighborPane(t, "a", "down")).toBe("b");
    expect(findNeighborPane(t, "b", "up")).toBe("a");
    expect(findNeighborPane(t, "a", "up")).toBeNull();
    expect(findNeighborPane(t, "a", "right")).toBeNull();
  });

  it("navigates a 2x2 grid in every direction", () => {
    const t = split("vertical", split("horizontal", leaf("tl"), leaf("tr")), split("horizontal", leaf("bl"), leaf("br")));
    expect(findNeighborPane(t, "tl", "right")).toBe("tr");
    expect(findNeighborPane(t, "tl", "down")).toBe("bl");
    expect(findNeighborPane(t, "br", "left")).toBe("bl");
    expect(findNeighborPane(t, "br", "up")).toBe("tr");
    expect(findNeighborPane(t, "tr", "right")).toBeNull();
    expect(findNeighborPane(t, "bl", "down")).toBeNull();
  });

  it("with one pane on the left and two stacked on the right, picks the one whose centre is closest", () => {
    // izquierda: a (alto completo); derecha: b (arriba, 30 %) y c (abajo, 70 %)
    const t = split("horizontal", leaf("a"), split("vertical", leaf("b"), leaf("c"), 0.3));
    // el centro vertical de `a` (0.5) cae dentro de `c`, que es el más próximo
    expect(findNeighborPane(t, "a", "right")).toBe("c");
    expect(findNeighborPane(t, "b", "left")).toBe("a");
    expect(findNeighborPane(t, "c", "left")).toBe("a");
    expect(findNeighborPane(t, "b", "down")).toBe("c");
    expect(findNeighborPane(t, "c", "up")).toBe("b");
  });

  it("breaks ties between equally overlapping neighbours by picking the first in order", () => {
    const t = split("horizontal", leaf("a"), split("vertical", leaf("b"), leaf("c")));
    expect(findNeighborPane(t, "a", "right")).toBe("b");
  });

  it("chooses the closest pane along the movement axis in nested asymmetric layouts", () => {
    // a | (b | c) con proporciones distintas: desde a hacia la derecha el vecino directo es b
    const t = split("horizontal", leaf("a"), split("horizontal", leaf("b"), leaf("c"), 0.2), 0.4);
    expect(findNeighborPane(t, "a", "right")).toBe("b");
    expect(findNeighborPane(t, "b", "right")).toBe("c");
    expect(findNeighborPane(t, "c", "left")).toBe("b");
  });

  it("does not jump over panes that only touch at a corner", () => {
    const t = split("horizontal", split("vertical", leaf("tl"), leaf("bl")), split("vertical", leaf("tr"), leaf("br")));
    expect(findNeighborPane(t, "tl", "right")).toBe("tr");
    expect(findNeighborPane(t, "bl", "right")).toBe("br");
  });
});
