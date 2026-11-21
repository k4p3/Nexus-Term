import { describe, it, expect } from "vitest";
import { isVaultLockedError } from "./vault-errors";

describe("isVaultLockedError", () => {
  it("detects the plain backend message", () => {
    expect(isVaultLockedError("VAULT_LOCKED: Vault is currently locked. Unlock with master password first.")).toBe(true);
  });
  it("detects the code when another layer wraps the message", () => {
    expect(isVaultLockedError("Vault error: VAULT_LOCKED: Vault is currently locked.")).toBe(true);
    expect(isVaultLockedError("Fallo al iniciar: Vault error: VAULT_LOCKED: x")).toBe(true);
  });
  it("detects it inside Error objects", () => {
    expect(isVaultLockedError(new Error("VAULT_LOCKED: x"))).toBe(true);
  });
  it("ignores other errors and non-errors", () => {
    expect(isVaultLockedError("Current master password is incorrect")).toBe(false);
    expect(isVaultLockedError(new Error("boom"))).toBe(false);
    expect(isVaultLockedError(null)).toBe(false);
    expect(isVaultLockedError(undefined)).toBe(false);
    expect(isVaultLockedError(42)).toBe(false);
  });
});
