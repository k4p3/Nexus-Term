import { describe, it, expect } from "vitest";
import { findNeighborPane } from "./pane-navigation";
import type { PaneNode, SplitDirection } from "../types/session";

const leaf = (id: string): PaneNode => ({ type: "leaf", id, title: id });
const split = (direction: SplitDirection, first: PaneNode, second: PaneNode, ratio = 0.5): PaneNode => ({
  type: "split", id: `s-${Math.random()}`, direction, first, second, ratio,
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
