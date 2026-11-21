import { describe, it, expect } from "vitest";
import { buildNotificationBody, formatDuration, shouldNotify } from "./notify";

const base = { enabled: true, thresholdSeconds: 10, durationMs: 12_000, windowFocused: false, paneVisible: false };

describe("shouldNotify", () => {
  it("notifies on desktop when the window is not focused", () => {
    expect(shouldNotify(base)).toBe("desktop");
  });
  it("shows a toast when focused but the pane is hidden", () => {
    expect(shouldNotify({ ...base, windowFocused: true })).toBe("toast");
  });
  it("is silent when the pane is visible and focused", () => {
    expect(shouldNotify({ ...base, windowFocused: true, paneVisible: true })).toBe("none");
  });
  it("ignores short commands and respects the setting", () => {
    expect(shouldNotify({ ...base, durationMs: 9_999 })).toBe("none");
    expect(shouldNotify({ ...base, enabled: false })).toBe("none");
    expect(shouldNotify({ ...base, durationMs: 10_000 })).toBe("desktop");
  });
});

describe("notification content", () => {
  it("formats durations", () => {
    expect(formatDuration(12_300)).toBe("12s");
    expect(formatDuration(125_000)).toBe("2m 5s");
    expect(formatDuration(3_700_000)).toBe("1h 1m");
  });
  it("never includes the command unless enabled", () => {
    const i = { ok: true, hostLabel: "web-1", durationMs: 12_000, command: "mysql -pSECRET", includeCommand: false };
    expect(buildNotificationBody(i).body).toBe("✓ web-1 · 12s");
    expect(buildNotificationBody(i).body).not.toContain("SECRET");
    expect(buildNotificationBody({ ...i, includeCommand: true }).body).toContain("mysql");
    expect(buildNotificationBody({ ...i, ok: false }).title).toBe("Command failed");
  });
  it("truncates long commands", () => {
    const b = buildNotificationBody({ ok: true, hostLabel: "h", durationMs: 1000, command: "x".repeat(200), includeCommand: true });
    expect(b.body.split("\n")[1].length).toBe(78);
  });
});
