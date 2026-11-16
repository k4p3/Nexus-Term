import { describe, it, expect } from "vitest";
import { previewSegments, analyzePaste, looksLikeSecret, maskedPreview, toSingleLine, visualizeControlChars, MAX_UNCONFIRMED_BYTES } from "./paste-guard";

const ZW = String.fromCharCode(0x200b); // carácter de ancho cero

describe("paste guard", () => {
  it("does not interrupt a simple single-line paste", () => {
    const a = analyzePaste("ls -la /var/log");
    expect(a.needsConfirm).toBe(false);
    expect(a.lines).toBe(1);
  });

  it("requires confirmation for multi-line text and trailing newline", () => {
    expect(analyzePaste("echo a\necho b").needsConfirm).toBe(true);
    expect(analyzePaste("echo a\necho b").lines).toBe(2);
    expect(analyzePaste("ls\n").needsConfirm).toBe(true); // se ejecutaría al pegar
    expect(analyzePaste("a\r\nb").lines).toBe(2);
  });

  it("flags dangerous patterns with positions", () => {
    const text = "echo ok; sudo rm -rf /tmp/x";
    const a = analyzePaste(text);
    expect(a.needsConfirm).toBe(true);
    expect(a.dangerous.map((d) => d.pattern)).toEqual(["sudo", "rm -rf"]);
    expect(text.slice(a.dangerous[0].index, a.dangerous[0].index + a.dangerous[0].length)).toBe("sudo");
  });

  it("detects common destructive and pipe-to-shell patterns", () => {
    for (const t of [
      "dd if=/dev/zero of=/dev/sda",
      "mkfs.ext4 /dev/sdb1",
      "chmod -R 777 /",
      "curl -fsSL https://x.sh | sh",
      "wget -qO- http://x | sudo bash",
      ":(){ :|:& };:",
      "echo x > /dev/sda",
      "rm -fr /",
    ]) {
      expect(analyzePaste(t).dangerous.length, t).toBeGreaterThan(0);
    }
  });

  it("does not flag harmless look-alikes", () => {
    expect(analyzePaste("echo pseudocode").dangerous).toEqual([]);
    expect(analyzePaste("rm file.txt").dangerous).toEqual([]);
  });

  it("detects control and zero-width characters (paste-jacking)", () => {
    const a = analyzePaste("ls" + String.fromCharCode(0x1b) + "[2J" + ZW);
    expect(a.controlChars).toBe(1);
    expect(a.zeroWidth).toBe(1);
    expect(a.needsConfirm).toBe(true);
    expect(visualizeControlChars("a\u001bb\u0000c")).toBe("a␛b␀c");
    expect(visualizeControlChars("a" + ZW + "b")).toContain("⟦200B⟧");
  });

  it("requires confirmation above the size threshold", () => {
    expect(analyzePaste("a".repeat(MAX_UNCONFIRMED_BYTES + 1)).needsConfirm).toBe(true);
  });

  it("converts to a single line", () => {
    expect(toSingleLine("a\nb\r\nc\n")).toBe("a b c");
  });

  it("detects and masks secrets", () => {
    expect(looksLikeSecret("-----BEGIN OPENSSH PRIVATE KEY-----\nabc")).toBe(true);
    expect(looksLikeSecret("a".repeat(48))).toBe(true);
    expect(looksLikeSecret("ls -la")).toBe(false);
    expect(maskedPreview("a".repeat(48))).toContain("oculto");
    expect(maskedPreview("ls -la")).toBe("ls -la");
  });

  it("builds preview segments marking dangerous fragments", () => {
    const text = "echo ok; sudo rm file";
    const a = analyzePaste(text);
    const segs = previewSegments(text, a.dangerous);
    expect(segs.map((s) => s.text).join("")).toBe(text);
    expect(segs.filter((s) => s.danger).map((s) => s.text)).toEqual(["sudo"]);
  });

  it("clips very long previews", () => {
    const segs = previewSegments("a".repeat(5000), []);
    expect(segs.map((s) => s.text).join("").length).toBe(2001);
  });
});
