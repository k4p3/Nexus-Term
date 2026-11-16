<script setup lang="ts">
import { defineAsyncComponent } from "vue";
import type { PaneNode } from "../../types/session";
import TerminalPane from "./TerminalPane.vue";

const RemoteDesktopPane = defineAsyncComponent(() => import("../remote/RemoteDesktopPane.vue"));

const isGraphical = (host?: { protocol?: string } | null) =>
  host?.protocol === "rdp" || host?.protocol === "vnc";

defineProps<{
  node: PaneNode;
  tabId: string;
  activePaneId: string;
}>();
</script>

<template>
  <div class="h-full w-full flex-1 overflow-hidden">
    <!-- Leaf Remote Desktop Pane (RDP / VNC) -->
    <RemoteDesktopPane
      v-if="node.type === 'leaf' && isGraphical(node.host)"
      :key="node.id"
      :pane="node"
      :tab-id="tabId"
      :is-active="node.id === activePaneId"
    />

    <!-- Leaf Terminal Pane -->
    <TerminalPane
      v-else-if="node.type === 'leaf'"
      :key="node.id"
      :pane="node"
      :tab-id="tabId"
      :is-active="node.id === activePaneId"
    />

    <!-- Split Pane Container -->
    <div
      v-else
      :key="node.id"
      class="h-full w-full flex overflow-hidden"
      :class="node.direction === 'horizontal' ? 'flex-row' : 'flex-col'"
    >
      <div class="flex-1 overflow-hidden h-full">
        <SplitPaneNode
          :key="node.first.id"
          :node="node.first"
          :tab-id="tabId"
          :active-pane-id="activePaneId"
        />
      </div>

      <!-- Split Divider Line -->
      <div
        class="border-theme bg-theme-border shrink-0 transition-colors"
        :class="node.direction === 'horizontal' ? 'w-1 cursor-col-resize hover:bg-theme-accent' : 'h-1 cursor-row-resize hover:bg-theme-accent'"
      ></div>

      <div class="flex-1 overflow-hidden h-full">
        <SplitPaneNode
          :key="node.second.id"
          :node="node.second"
          :tab-id="tabId"
          :active-pane-id="activePaneId"
        />
      </div>
    </div>
  </div>
</template>
