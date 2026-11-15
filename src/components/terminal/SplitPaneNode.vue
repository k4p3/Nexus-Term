<script setup lang="ts">
import type { PaneNode } from "../../types/session";
import TerminalPane from "./TerminalPane.vue";

defineProps<{
  node: PaneNode;
  tabId: string;
  activePaneId: string;
}>();
</script>

<template>
  <div class="h-full w-full flex-1 overflow-hidden">
    <!-- Leaf Terminal Pane -->
    <TerminalPane
      v-if="node.type === 'leaf'"
      :pane="node"
      :tab-id="tabId"
      :is-active="node.id === activePaneId"
    />

    <!-- Split Pane Container -->
    <div
      v-else
      class="h-full w-full flex overflow-hidden"
      :class="node.direction === 'horizontal' ? 'flex-row' : 'flex-col'"
    >
      <div class="flex-1 overflow-hidden h-full">
        <SplitPaneNode
          :node="node.first"
          :tab-id="tabId"
          :active-pane-id="activePaneId"
        />
      </div>

      <!-- Split Divider Line -->
      <div
        class="bg-slate-800 shrink-0"
        :class="node.direction === 'horizontal' ? 'w-1 cursor-col-resize hover:bg-cyan-500/50' : 'h-1 cursor-row-resize hover:bg-cyan-500/50'"
      ></div>

      <div class="flex-1 overflow-hidden h-full">
        <SplitPaneNode
          :node="node.second"
          :tab-id="tabId"
          :active-pane-id="activePaneId"
        />
      </div>
    </div>
  </div>
</template>
