<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { ChevronDown, Check } from "lucide-vue-next";

export interface SelectOption {
  value: string | number | null;
  label: string;
  icon?: any;
  iconColor?: string;
  subtitle?: string;
  badge?: string;
}

const props = withDefaults(
  defineProps<{
    modelValue: string | number | null | undefined;
    options: SelectOption[];
    placeholder?: string;
    disabled?: boolean;
  }>(),
  {
    placeholder: "Seleccionar opción...",
    disabled: false,
  }
);

const emit = defineEmits<{
  (e: "update:modelValue", value: any): void;
  (e: "change", value: any): void;
}>();

const isOpen = ref(false);
const containerRef = ref<HTMLElement | null>(null);

const selectedOption = computed(() => {
  return props.options.find((opt) => opt.value === props.modelValue);
});

function toggleDropdown() {
  if (props.disabled) return;
  isOpen.value = !isOpen.value;
}

function selectOption(opt: SelectOption) {
  emit("update:modelValue", opt.value);
  emit("change", opt.value);
  isOpen.value = false;
}

function handleClickOutside(e: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    isOpen.value = false;
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === "Escape" && isOpen.value) {
    isOpen.value = false;
  }
}

onMounted(() => {
  window.addEventListener("click", handleClickOutside);
  window.addEventListener("keydown", handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener("click", handleClickOutside);
  window.removeEventListener("keydown", handleKeyDown);
});
</script>

<template>
  <div ref="containerRef" class="relative w-full text-left select-none">
    <!-- Trigger Button -->
    <button
      type="button"
      @click="toggleDropdown"
      :disabled="disabled"
      class="w-full px-3 py-2 bg-app border border-line rounded-xl text-sm text-fg flex items-center justify-between transition focus:outline-none focus:border-accent focus:ring-1 focus:ring-theme-accent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-active/50"
      :class="{ 'border-accent ring-1 ring-theme-accent': isOpen }"
    >
      <div class="flex items-center space-x-2 truncate min-w-0 pr-2">
        <!-- Selected Option Icon -->
        <component
          :is="selectedOption.icon"
          v-if="selectedOption?.icon"
          class="w-4 h-4 shrink-0"
          :class="selectedOption.iconColor || 'text-accent'"
        />

        <div class="truncate flex items-center space-x-2">
          <span v-if="selectedOption" class="truncate font-medium text-fg">
            {{ selectedOption.label }}
          </span>
          <span v-else class="text-fg-muted truncate">
            {{ placeholder }}
          </span>

          <span
            v-if="selectedOption?.badge"
            class="px-1.5 py-0.2 text-[10px] font-mono rounded bg-app border border-line text-fg-muted shrink-0"
          >
            {{ selectedOption.badge }}
          </span>
        </div>
      </div>

      <ChevronDown
        class="w-4 h-4 text-fg-muted shrink-0 transition-transform duration-200"
        :class="{ 'rotate-180 text-accent': isOpen }"
      />
    </button>

    <!-- Dropdown Menu -->
    <transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="transform scale-95 opacity-0 -translate-y-1"
      enter-to-class="transform scale-100 opacity-100 translate-y-0"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="transform scale-100 opacity-100 translate-y-0"
      leave-to-class="transform scale-95 opacity-0 -translate-y-1"
    >
      <div
        v-if="isOpen"
        class="absolute left-0 right-0 mt-1.5 z-50 bg-surface border border-line rounded-xl shadow-2xl p-1 max-h-60 overflow-y-auto space-y-0.5 backdrop-blur-md"
      >
        <div
          v-for="opt in options"
          :key="String(opt.value)"
          @click="selectOption(opt)"
          class="flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer text-xs transition group"
          :class="
            opt.value === modelValue
              ? 'bg-accent/15 text-accent font-semibold'
              : 'text-fg hover:bg-active hover:text-fg'
          "
        >
          <div class="flex items-center space-x-2.5 truncate min-w-0 pr-2">
            <component
              :is="opt.icon"
              v-if="opt.icon"
              class="w-4 h-4 shrink-0 transition-colors"
              :class="
                opt.value === modelValue
                  ? 'text-accent'
                  : opt.iconColor || 'text-fg-muted group-hover:text-fg'
              "
            />

            <div class="truncate">
              <div class="flex items-center space-x-1.5">
                <span class="truncate">{{ opt.label }}</span>
                <span
                  v-if="opt.badge"
                  class="px-1.5 py-0.2 text-[9px] font-mono rounded bg-app border border-line text-fg-muted shrink-0"
                >
                  {{ opt.badge }}
                </span>
              </div>
              <div
                v-if="opt.subtitle"
                class="text-[10px] text-fg-muted font-mono truncate leading-tight mt-0.5"
              >
                {{ opt.subtitle }}
              </div>
            </div>
          </div>

          <Check
            v-if="opt.value === modelValue"
            class="w-3.5 h-3.5 text-accent shrink-0 ml-2"
          />
        </div>

        <div v-if="options.length === 0" class="px-3 py-2 text-center text-xs text-fg-muted">
          No hay opciones disponibles
        </div>
      </div>
    </transition>
  </div>
</template>
