import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import BaseModal from "./BaseModal.vue";
import BaseButton from "./BaseButton.vue";
import IconButton from "./IconButton.vue";
import EmptyState from "./EmptyState.vue";

const i18n = createI18n({ legacy: false, locale: "en", messages: { en: { common: { close: "Close" } } } });

describe("shared UI primitives", () => {
  it("BaseModal exposes dialog semantics, renders slots and closes on Escape and backdrop", async () => {
    const w = mount(BaseModal, {
      props: { title: "Settings" },
      slots: { default: "<input id='x' />", footer: "<button>Save</button>" },
      global: { plugins: [i18n] },
      attachTo: document.body,
    });
    const dialog = w.find("[role='dialog']");
    expect(dialog.attributes("aria-modal")).toBe("true");
    expect(dialog.attributes("aria-label")).toBe("Settings");
    expect(w.text()).toContain("Save");
    expect(document.activeElement?.id).toBe("x");

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(w.emitted("close")).toHaveLength(1);

    await w.find(".fixed").trigger("mousedown");
    expect(w.emitted("close")).toHaveLength(2);
    w.unmount();
  });

  it("BaseButton disables itself and flags busy while loading", () => {
    const w = mount(BaseButton, { props: { loading: true, variant: "primary" }, slots: { default: "Go" } });
    expect(w.attributes("disabled")).toBeDefined();
    expect(w.attributes("aria-busy")).toBe("true");
    expect(w.classes()).toContain("bg-accent");
  });

  it("IconButton uses its label for title and aria-label and reports pressed state", () => {
    const w = mount(IconButton, { props: { label: "Toggle sidebar", active: true } });
    expect(w.attributes("aria-label")).toBe("Toggle sidebar");
    expect(w.attributes("title")).toBe("Toggle sidebar");
    expect(w.attributes("aria-pressed")).toBe("true");
  });

  it("EmptyState shows title, description and action slot", () => {
    const w = mount(EmptyState, {
      props: { title: "No sessions", description: "Open a terminal" },
      slots: { default: "<button>New</button>" },
    });
    expect(w.text()).toContain("No sessions");
    expect(w.text()).toContain("Open a terminal");
    expect(w.find("button").exists()).toBe(true);
  });
});
