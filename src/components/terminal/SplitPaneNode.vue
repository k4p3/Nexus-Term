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
