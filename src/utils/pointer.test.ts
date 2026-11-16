import { describe, it, expect } from "vitest";
import { clientToRemote, fitSize, formatFingerprint } from "./pointer";

describe("pointer utils", () => {
  const rect = { left: 100, top: 50, width: 640, height: 360 };
  const fb = { w: 1280, h: 720 };

  it("maps client coordinates to remote pixels (scale 2x)", () => {
    expect(clientToRemote(100, 50, rect, fb)).toEqual({ x: 0, y: 0 });
    expect(clientToRemote(420, 230, rect, fb)).toEqual({ x: 640, y: 360 });
  });

  it("clamps coordinates outside the canvas", () => {
    expect(clientToRemote(0, 0, rect, fb)).toEqual({ x: 0, y: 0 });
    expect(clientToRemote(5000, 5000, rect, fb)).toEqual({ x: 1279, y: 719 });
  });

  it("handles degenerate rects safely", () => {
    expect(clientToRemote(10, 10, { left: 0, top: 0, width: 0, height: 0 }, fb)).toEqual({ x: 0, y: 0 });
  });

  it("computes fit and actual sizes preserving aspect ratio", () => {
    expect(fitSize({ w: 640, h: 640 }, { w: 1280, h: 720 }, "fit")).toEqual({ w: 640, h: 360 });
    expect(fitSize({ w: 2000, h: 360 }, { w: 1280, h: 720 }, "fit")).toEqual({ w: 640, h: 360 });
    expect(fitSize({ w: 10, h: 10 }, { w: 1280, h: 720 }, "actual")).toEqual({ w: 1280, h: 720 });
    expect(fitSize({ w: 10, h: 10 }, { w: 0, h: 0 }, "fit")).toEqual({ w: 0, h: 0 });
  });

  it("formats fingerprints", () => {
    expect(formatFingerprint("abcdef01")).toBe("AB:CD:EF:01");
    expect(formatFingerprint("")).toBe("");
  });
});
