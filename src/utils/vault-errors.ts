/** Código estable que el backend (Rust) incluye en el error de bóveda bloqueada. */
export const VAULT_LOCKED_CODE = "VAULT_LOCKED:";

/**
 * Indica si un error proviene de una bóveda bloqueada. Otras capas pueden envolver el mensaje
 * (p. ej. "Vault error: VAULT_LOCKED: ..."), por eso se busca como subcadena.
 */
export function isVaultLockedError(err: unknown): boolean {
  if (typeof err === "string") return err.includes(VAULT_LOCKED_CODE);
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    return typeof m === "string" && m.includes(VAULT_LOCKED_CODE);
  }
  return false;
}
