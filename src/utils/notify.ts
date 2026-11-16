export type NotifyChannel = "desktop" | "toast" | "none";

export interface NotifyContext {
  enabled: boolean;
  thresholdSeconds: number;
  durationMs: number;
  windowFocused: boolean;
  paneVisible: boolean;
}

/** Decide cómo avisar de que ha terminado un comando largo. */
export function shouldNotify(c: NotifyContext): NotifyChannel {
  if (!c.enabled) return "none";
  if (c.durationMs < c.thresholdSeconds * 1000) return "none";
  if (!c.windowFocused) return "desktop";
  return c.paneVisible ? "none" : "toast";
}

export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export interface NotificationInput {
  ok: boolean;
  hostLabel: string;
  durationMs: number;
  command?: string;
  includeCommand: boolean;
}

/** El texto del comando solo se incluye si el usuario lo ha activado (puede contener secretos). */
export function buildNotificationBody(i: NotificationInput): { title: string; body: string } {
  const status = i.ok ? "✓" : "✗";
  let body = `${status} ${i.hostLabel} · ${formatDuration(i.durationMs)}`;
  if (i.includeCommand && i.command) {
    const cmd = i.command.length > 80 ? i.command.slice(0, 77) + "…" : i.command;
    body += `\n${cmd}`;
  }
  return { title: i.ok ? "Comando finalizado" : "Comando fallido", body };
}
