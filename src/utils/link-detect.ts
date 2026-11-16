import { isValidIPv4, isValidIPv6 } from "./quick-select";

export interface PathLink {
  start: number;
  end: number; // exclusivo
  text: string;
  path: string;
  line?: number;
  col?: number;
}

export interface IpLink {
  start: number;
  end: number;
  ip: string;
}

const PATH_RE =
  /(?<![\w/:.-])((?:~|\.{1,2})?\/[\w.@+-]+(?:\/[\w.@+-]+)*|(?:[\w.@+-]+\/)+[\w@+-]+\.[A-Za-z0-9]{1,8})(?::(\d+))?(?::(\d+))?/g;

/** Detecta `ruta`, `ruta:línea` y `ruta:línea:col` en una línea de la terminal. */
export function findPathLinks(line: string): PathLink[] {
  const out: PathLink[] = [];
  PATH_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PATH_RE.exec(line))) {
    let path = m[1];
    const trimmed = path.replace(/[.,;]+$/, "");
    if (trimmed !== path && !m[2]) path = trimmed;
    if (path.length < 2 || /^\/+$/.test(path)) continue;
    const text = m[2] || m[3] ? m[0] : path;
    out.push({
      start: m.index,
      end: m.index + text.length,
      text,
      path,
      line: m[2] ? Number(m[2]) : undefined,
      col: m[3] ? Number(m[3]) : undefined,
    });
  }
  return out;
}

const IPV4_RE = /(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.]*\d)/g;
const IPV6_RE = /(?<![\w:])[0-9a-f:]{3,39}(?![\w:])/gi;

export function findIpLinks(line: string): IpLink[] {
  const out: IpLink[] = [];
  for (const re of [IPV4_RE, IPV6_RE]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      const ip = m[0];
      const ok = re === IPV4_RE ? isValidIPv4(ip) : ip.includes(":") && isValidIPv6(ip);
      if (ok) out.push({ start: m.index, end: m.index + ip.length, ip });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

export function dirname(path: string): string {
  const i = path.lastIndexOf("/");
  if (i < 0) return ".";
  return i === 0 ? "/" : path.slice(0, i);
}
