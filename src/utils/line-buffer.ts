/**
 * Reconstruye en memoria la línea de comandos que se está escribiendo, a partir de lo que el
 * terminal envía al shell. Es una aproximación: el shell es quien edita la línea de verdad, así
 * que ante teclas que la hacen ambigua (flechas, Tab, Ctrl+R, pegado…) se marca como no fiable
 * hasta el siguiente Enter/Ctrl+C. Nunca se persiste ni se registra.
 */

/** Controles que no alteran el texto de la línea cuando el cursor está al final. */
const NO_OP_CONTROLS = new Set(["\x04", "\x05", "\x0b", "\x0c"]); // Ctrl+D, Ctrl+E, Ctrl+K, Ctrl+L

function isControl(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0;
  return c < 0x20 || c === 0x7f;
}

export class LineBuffer {
  private chars = "";
  private ok = true;

  /** Texto acumulado (solo es significativo si `reliable`). */
  get text(): string {
    return this.chars;
  }

  /** `false` cuando una tecla ambigua impide saber qué hay realmente escrito. */
  get reliable(): boolean {
    return this.ok;
  }

  reset(): void {
    this.chars = "";
    this.ok = true;
  }

  /** Fija el texto de la línea (p. ej. tras aceptar una sugerencia que la reemplazó). */
  set(text: string): void {
    this.chars = text;
    this.ok = true;
  }

  /** Procesa un fragmento de `term.onData`. */
  feed(data: string): void {
    if (data.includes("\x1b")) {
      // Flechas, Inicio/Fin, Supr, pegado entre corchetes, respuestas del terminal…
      this.ok = false;
      return;
    }
    const chars = Array.from(data);
    const hasControl = chars.some(isControl);
    if (!hasControl && chars.length > 1) {
      this.ok = false; // texto pegado: se desconoce dónde queda el cursor
      return;
    }
    for (const ch of chars) {
      if (ch === "\r" || ch === "\n" || ch === "\x03") {
        this.reset();
      } else if (ch === "\x7f" || ch === "\b") {
        const arr = Array.from(this.chars);
        arr.pop();
        this.chars = arr.join("");
      } else if (ch === "\x15") {
        this.chars = ""; // Ctrl+U
      } else if (ch === "\x17") {
        this.chars = this.chars.replace(/\s+$/u, "").replace(/\S+$/u, ""); // Ctrl+W
      } else if (NO_OP_CONTROLS.has(ch)) {
        // sin efecto sobre el texto
      } else if (isControl(ch)) {
        this.ok = false; // Tab, Ctrl+R, Ctrl+A, historial del shell…
      } else {
        this.chars += ch;
      }
    }
  }
}
