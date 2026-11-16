import { describe, it, expect, vi } from "vitest";
import {
  planAddons, createWriteOnlyClipboardProvider, TerminalAddonManager, OSC52_MAX_BYTES,
  type AddonName, type AddonSpec,
} from "./terminal-addons";

const prefs = (o: Partial<{ osc52_clipboard: boolean; inline_images: boolean; font_ligatures: boolean }> = {}) => ({
  osc52_clipboard: true, inline_images: true, font_ligatures: false, ...o,
});

describe("planAddons", () => {
  it("defaults: unicode11, clipboard, images and WebGL on; ligatures and canvas off", () => {
    expect(planAddons(prefs())).toEqual({
      unicode11: true, clipboard: true, canvas: false, webgl: true, ligatures: false, image: true,
    });
  });
  it("ligatures replace the WebGL renderer with the canvas renderer (not DOM)", () => {
    const p = planAddons(prefs({ font_ligatures: true }));
    expect(p.ligatures).toBe(true);
    expect(p.canvas).toBe(true);
    expect(p.webgl).toBe(false);
  });
  it("loads the renderer before the ligatures addon", () => {
    const keys = Object.keys(planAddons(prefs({ font_ligatures: true })));
    expect(keys.indexOf("canvas")).toBeLessThan(keys.indexOf("ligatures"));
  });
  it("each preference toggles only its addon", () => {
    expect(planAddons(prefs({ osc52_clipboard: false })).clipboard).toBe(false);
    expect(planAddons(prefs({ inline_images: false })).image).toBe(false);
    expect(planAddons(prefs({ inline_images: false })).clipboard).toBe(true);
  });
  it("unicode 11 is always on", () => {
    expect(planAddons(prefs({ osc52_clipboard: false, inline_images: false })).unicode11).toBe(true);
  });
});

describe("createWriteOnlyClipboardProvider", () => {
  it("copies text to the local clipboard and reports it", async () => {
    const write = vi.fn();
    const onCopied = vi.fn();
    const p = createWriteOnlyClipboardProvider(write, { onCopied });
    await p.writeText("c", "hello");
    expect(write).toHaveBeenCalledWith("hello");
    expect(onCopied).toHaveBeenCalledWith("hello");
  });

  it("refuses read requests: never returns clipboard data", async () => {
    const write = vi.fn();
    const p = createWriteOnlyClipboardProvider(write);
    expect(await p.readText("c")).toBe("");
    expect(write).not.toHaveBeenCalled();
  });

  it("rejects payloads above 1 MiB (measured in bytes) and accepts the limit", async () => {
    const write = vi.fn();
    const onRejected = vi.fn();
    const p = createWriteOnlyClipboardProvider(write, { onRejected });
    await p.writeText("c", "a".repeat(OSC52_MAX_BYTES + 1));
    expect(write).not.toHaveBeenCalled();
    expect(onRejected).toHaveBeenCalledWith(OSC52_MAX_BYTES + 1);
    await p.writeText("c", "é".repeat(OSC52_MAX_BYTES / 2 + 1)); // 2 bytes por carácter
    expect(write).not.toHaveBeenCalled();
    await p.writeText("c", "a".repeat(OSC52_MAX_BYTES));
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("ignores empty payloads and swallows clipboard errors", async () => {
    const write = vi.fn(async () => { throw new Error("denied"); });
    const onCopied = vi.fn();
    const p = createWriteOnlyClipboardProvider(write, { onCopied });
    await p.writeText("c", "");
    expect(write).not.toHaveBeenCalled();
    await expect(p.writeText("c", "x")).resolves.toBeUndefined();
    expect(onCopied).not.toHaveBeenCalled();
  });
});

describe("TerminalAddonManager", () => {
  function setup(failOn: AddonName[] = []) {
    const loadAddon = vi.fn();
    const disposed: AddonName[] = [];
    const hooks: string[] = [];
    const names: AddonName[] = ["unicode11", "clipboard", "canvas", "webgl", "ligatures", "image"];
    const specs = Object.fromEntries(
      names.map((n): [AddonName, AddonSpec] => [n, {
        create: () => {
          if (failOn.includes(n)) throw new Error(`${n} unavailable`);
          return { dispose: () => disposed.push(n) };
        },
        onLoaded: () => hooks.push(`+${n}`),
        onUnloaded: () => hooks.push(`-${n}`),
      }]),
    ) as Record<AddonName, AddonSpec>;
    const warn = vi.fn();
    const mgr = new TerminalAddonManager({ loadAddon }, specs, warn);
    return { mgr, loadAddon, disposed, hooks, warn };
  }

  const plan = (o: Partial<Record<AddonName, boolean>> = {}) =>
    ({ unicode11: true, clipboard: true, canvas: false, webgl: true, ligatures: false, image: true, ...o }) as Record<AddonName, boolean>;

  it("loads exactly the planned addons", () => {
    const { mgr, loadAddon } = setup();
    expect(mgr.apply(plan())).toEqual(["unicode11", "clipboard", "webgl", "image"]);
    expect(loadAddon).toHaveBeenCalledTimes(4);
    expect(mgr.isLoaded("ligatures")).toBe(false);
  });

  it("is idempotent when the plan does not change", () => {
    const { mgr, loadAddon } = setup();
    mgr.apply(plan());
    expect(mgr.apply(plan())).toEqual([]);
    expect(loadAddon).toHaveBeenCalledTimes(4);
  });

  it("disposes an addon when its preference is turned off", () => {
    const { mgr, disposed, hooks } = setup();
    mgr.apply(plan());
    expect(mgr.apply(plan({ clipboard: false }))).toEqual(["clipboard"]);
    expect(disposed).toEqual(["clipboard"]);
    expect(hooks).toContain("-clipboard");
    expect(mgr.isLoaded("clipboard")).toBe(false);
  });

  it("swaps WebGL for canvas + ligatures and back, unloading before loading", () => {
    const { mgr, hooks } = setup();
    mgr.apply(plan());
    hooks.length = 0;
    mgr.apply(plan({ ligatures: true, canvas: true, webgl: false }));
    expect(hooks).toEqual(["-webgl", "+canvas", "+ligatures"]);
    hooks.length = 0;
    mgr.apply(plan());
    expect(hooks).toEqual(["-canvas", "-ligatures", "+webgl"]);
  });

  it("a failing addon is reported, left unloaded and does not block the others", () => {
    const { mgr, warn } = setup(["image"]);
    const changed = mgr.apply(plan());
    expect(changed).toEqual(["unicode11", "clipboard", "webgl"]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toBe("image");
    expect(mgr.isLoaded("image")).toBe(false);
    mgr.apply(plan()); // no reintenta en bucle
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("retries a failed addon after it is disabled and enabled again", () => {
    const { mgr, warn } = setup(["image"]);
    mgr.apply(plan());
    mgr.apply(plan({ image: false }));
    mgr.apply(plan());
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("dispose() releases everything", () => {
    const { mgr, disposed } = setup();
    mgr.apply(plan());
    mgr.dispose();
    expect(disposed.sort()).toEqual(["clipboard", "image", "unicode11", "webgl"]);
    expect(mgr.isLoaded("unicode11")).toBe(false);
  });
});
