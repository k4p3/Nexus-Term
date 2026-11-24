import { describe, it, expect, beforeEach } from "vitest";
import { defineComponent, h, nextTick, onBeforeUnmount, onMounted } from "vue";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import SplitPaneNode from "./SplitPaneNode.vue";
import { useSessionsStore } from "../../stores/sessions.store";

describe("SplitPaneNode flat rendering & session preservation", () => {
  let mountedIds: string[] = [];
  let unmountedIds: string[] = [];
  let instanceCounter = 0;
  let instanceByPaneId: Map<string, number>;

  const TerminalPaneStub = defineComponent({
    name: "TerminalPane",
    props: {
      pane: { type: Object, required: true },
      tabId: { type: String, required: true },
      isActive: { type: Boolean, required: true },
    },
    setup(props) {
      const myInstanceId = ++instanceCounter;
      onMounted(() => {
        mountedIds.push(props.pane.id);
        instanceByPaneId.set(props.pane.id, myInstanceId);
      });
      onBeforeUnmount(() => {
        unmountedIds.push(props.pane.id);
      });
      return () =>
        h(
          "div",
          {
            "data-testid": `term-${props.pane.id}`,
            "data-instance": String(myInstanceId),
            "data-active": String(props.isActive),
          },
          props.pane.title,
        );
    },
  });

  beforeEach(() => {
    setActivePinia(createPinia());
    mountedIds = [];
    unmountedIds = [];
    instanceCounter = 0;
    instanceByPaneId = new Map();
  });

  it("never unmounts or remounts surviving panes when splitting in all 4 directions and closing panes", async () => {
    const store = useSessionsStore();
    const tabId = store.createTab("Session 1");
    const tab = store.tabs[0];
    const p1 = tab.activePaneId;

    const HostWrapper = defineComponent({
      setup() {
        return () =>
          h(SplitPaneNode, {
            node: store.tabs[0].rootPane,
            tabId,
            activePaneId: store.tabs[0].activePaneId,
          });
      },
    });

    const wrapper = mount(HostWrapper, {
      global: {
        stubs: {
          TerminalPane: TerminalPaneStub,
        },
      },
    });

    expect(mountedIds).toEqual([p1]);
    expect(unmountedIds).toEqual([]);
    const p1InitialInstance = instanceByPaneId.get(p1);

    // 1. Dividir a la derecha (horizontal + after)
    store.splitPane(tabId, p1, "horizontal", undefined, "after");
    const pRight = store.tabs[0].activePaneId;
    await nextTick();

    expect(unmountedIds).toEqual([]);
    expect(mountedIds).toEqual([p1, pRight]);
    expect(wrapper.get(`[data-testid="term-${p1}"]`).attributes("data-instance")).toBe(String(p1InitialInstance));

    // 2. Dividir a la izquierda sobre p1 (horizontal + before)
    store.splitPane(tabId, p1, "horizontal", undefined, "before");
    const pLeft = store.tabs[0].activePaneId;
    await nextTick();

    expect(unmountedIds).toEqual([]);
    expect(mountedIds).toEqual([p1, pRight, pLeft]);

    // 3. Dividir abajo sobre pRight (vertical + after)
    store.splitPane(tabId, pRight, "vertical", undefined, "after");
    const pDown = store.tabs[0].activePaneId;
    await nextTick();

    expect(unmountedIds).toEqual([]);
    expect(mountedIds).toEqual([p1, pRight, pLeft, pDown]);

    // 4. Dividir arriba sobre p1 (vertical + before)
    store.splitPane(tabId, p1, "vertical", undefined, "before");
    const pUp = store.tabs[0].activePaneId;
    await nextTick();

    expect(unmountedIds).toEqual([]);
    expect(mountedIds).toEqual([p1, pRight, pLeft, pDown, pUp]);
    expect(wrapper.findAll("[data-splitter-id]")).toHaveLength(4);

    // Todas las instancias originales siguen siendo exactamente las mismas
    for (const id of [p1, pRight, pLeft, pDown, pUp]) {
      expect(wrapper.get(`[data-testid="term-${id}"]`).attributes("data-instance")).toBe(
        String(instanceByPaneId.get(id)),
      );
    }

    // 5. Cerrar pDown: SOLO pDown se desmonta; los otros 4 paneles permanecen intactos
    store.closePane(tabId, pDown);
    await nextTick();
    expect(unmountedIds).toEqual([pDown]);
    expect(mountedIds).toHaveLength(5);

    // 6. Cerrar pLeft y pUp: solo esos dos se desmontan; p1 y pRight jamás se reiniciaron
    store.closePane(tabId, pLeft);
    store.closePane(tabId, pUp);
    await nextTick();
    expect(unmountedIds).toEqual([pDown, pLeft, pUp]);
    expect(mountedIds).toHaveLength(5);
    expect(wrapper.get(`[data-testid="term-${p1}"]`).attributes("data-instance")).toBe(String(p1InitialInstance));

    // 7. Cerrar pRight (quedando otra vez una sola hoja raíz p1): p1 sigue sin desmontarse
    store.closePane(tabId, pRight);
    await nextTick();
    expect(unmountedIds).toEqual([pDown, pLeft, pUp, pRight]);
    expect(mountedIds).toHaveLength(5);
    expect(wrapper.get(`[data-testid="term-${p1}"]`).attributes("data-instance")).toBe(String(p1InitialInstance));
    expect(wrapper.findAll("[data-splitter-id]")).toHaveLength(0);
  });

  it("preserves destination tab panes when docking another tab and updates ratio on splitter drag", async () => {
    const store = useSessionsStore();
    const targetTabId = store.createTab("Target Tab");
    const pTarget = store.tabs[0].activePaneId;
    const sourceTabId = store.createTab("Source Tab");
    const pSource = store.tabs[1].activePaneId;
    store.activeTabId = targetTabId;

    const HostWrapper = defineComponent({
      setup() {
        return () =>
          h(SplitPaneNode, {
            node: store.tabs[0].rootPane,
            tabId: targetTabId,
            activePaneId: store.tabs[0].activePaneId,
          });
      },
    });

    const wrapper = mount(HostWrapper, {
      global: {
        stubs: {
          TerminalPane: TerminalPaneStub,
        },
      },
    });

    expect(mountedIds).toEqual([pTarget]);

    // Acoplar pestaña secundaria arriba de pTarget
    store.dockTabIntoPane(sourceTabId, targetTabId, pTarget, "vertical", "before");
    await nextTick();

    expect(unmountedIds).toEqual([]);
    expect(mountedIds).toEqual([pTarget, pSource]);

    // Simular arrastre del divisor vertical
    const containerEl = wrapper.element as HTMLElement;
    containerEl.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

    const splitter = wrapper.get("[data-splitter-id]");
    await splitter.trigger("pointerdown", { clientX: 500, clientY: 400 });
    window.dispatchEvent(new PointerEvent("pointermove", { clientX: 500, clientY: 240 }));
    window.dispatchEvent(new PointerEvent("pointerup"));
    await nextTick();

    expect(store.tabs[0].rootPane.type).toBe("split");
    if (store.tabs[0].rootPane.type === "split") {
      expect(store.tabs[0].rootPane.ratio).toBeCloseTo(0.3);
    }
    expect(unmountedIds).toEqual([]);
  });
});
