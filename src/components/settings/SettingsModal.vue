<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSettingsStore } from '../../stores/settings.store';
import { useVaultStore } from '../../stores/vault.store';
import { SUPPORTED_LOCALES } from '../../locales';
import CustomSelect, { type SelectOption } from '../common/CustomSelect.vue';
import {
  X,
  Globe,
  Terminal,
  Cpu,
  ShieldCheck,
  Info,
  RotateCcw,
  Upload,
  Check,
  AlertCircle,
} from 'lucide-vue-next';

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const { t } = useI18n();
const settingsStore = useSettingsStore();
const vaultStore = useVaultStore();

const activeTab = ref<'general' | 'terminal' | 'shell' | 'security' | 'about'>('general');

// Password change state
const currentPassword = ref('');
const newPassword = ref('');
const confirmNewPassword = ref('');
const passwordError = ref('');
const passwordSuccess = ref(false);
const isRotating = ref(false);

// Theme import state
const importThemeError = ref('');
const importThemeSuccess = ref(false);

// Locale import state
const customLocaleCode = ref('');
const importLocaleError = ref('');
const importLocaleSuccess = ref(false);

const nerdFontPresets = [
  { label: 'MesloLGS NF (Default)', value: "'MesloLGS NF', 'Hack Nerd Font Mono', monospace" },
  { label: 'Hack Nerd Font', value: "'Hack Nerd Font Mono', 'Hack Nerd Font', monospace" },
  { label: 'JetBrains Mono NF', value: "'JetBrainsMono Nerd Font', 'JetBrains Mono', monospace" },
  { label: 'Fira Code NF', value: "'FiraCode Nerd Font', 'Fira Code', monospace" },
  { label: 'Monospace Generic', value: "monospace" },
];

const fontOptions = computed<SelectOption[]>(() => {
  return nerdFontPresets.map((f) => ({
    value: f.value,
    label: f.label,
  }));
});

const cursorStyleOptions = computed<SelectOption[]>(() => [
  { value: 'block', label: t('settings.block') },
  { value: 'bar', label: t('settings.bar') },
  { value: 'underline', label: t('settings.underline') },
]);

async function handleRotatePassword() {
  passwordError.value = '';
  passwordSuccess.value = false;

  if (!currentPassword.value) {
    passwordError.value = t('vault.emptyPassword');
    return;
  }
  if (!newPassword.value) {
    passwordError.value = t('vault.emptyPassword');
    return;
  }
  if (newPassword.value !== confirmNewPassword.value) {
    passwordError.value = t('vault.mismatchPassword');
    return;
  }

  isRotating.value = true;
  try {
    await vaultStore.changePassword(currentPassword.value, newPassword.value);
    passwordSuccess.value = true;
    currentPassword.value = '';
    newPassword.value = '';
    confirmNewPassword.value = '';
  } catch (err: any) {
    passwordError.value = String(err);
  } finally {
    isRotating.value = false;
  }
}

function handleThemeFileUpload(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  importThemeError.value = '';
  importThemeSuccess.value = false;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const content = e.target?.result as string;
      const parsed = JSON.parse(content);
      const name = parsed.name || file.name.replace(/\.[^/.]+$/, '');
      const themeObj = parsed.theme || parsed;

      settingsStore.importCustomTheme(name, themeObj);
      importThemeSuccess.value = true;
    } catch (err: any) {
      importThemeError.value = 'Invalid JSON theme file: ' + err.message;
    }
  };
  reader.readAsText(file);
}

function handleLocaleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  importLocaleError.value = '';
  importLocaleSuccess.value = false;

  const code = customLocaleCode.value.trim() || file.name.replace(/\.[^/.]+$/, '').toLowerCase();

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const content = e.target?.result as string;
      settingsStore.importCustomLocale(code, content);
      importLocaleSuccess.value = true;
    } catch (err: any) {
      importLocaleError.value = 'Invalid JSON translation file: ' + err.message;
    }
  };
  reader.readAsText(file);
}

async function handleResetDefaults() {
  if (confirm(t('common.confirm') + ': ' + t('settings.resetDefaults') + '?')) {
    await settingsStore.resetSettings();
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
    <div
      class="bg-theme-surface border border-theme rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden text-theme-main transition-colors"
    >
      <!-- Modal Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-theme bg-theme-header">
        <div class="flex items-center gap-2.5">
          <div class="p-1.5 bg-theme-app text-theme-accent rounded-lg border border-theme">
            <Cpu class="w-5 h-5" />
          </div>
          <h2 class="text-base font-semibold text-theme-main tracking-wide">
            {{ t('settings.title') }}
          </h2>
        </div>
        <button
          @click="emit('close')"
          class="p-1.5 text-theme-muted hover:text-theme-main rounded-lg hover:bg-theme-active transition-colors cursor-pointer"
          :title="t('common.close')"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Main Layout: Sidebar Tabs + Content Area -->
      <div class="flex flex-1 overflow-hidden">
        <!-- Sidebar Navigation -->
        <nav class="w-56 border-r border-theme bg-theme-app/50 p-3 space-y-1 shrink-0">
          <button
            @click="activeTab = 'general'"
            :class="[
              'w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors text-left cursor-pointer',
              activeTab === 'general'
                ? 'bg-theme-active text-theme-accent border border-theme shadow-xs font-semibold'
                : 'text-theme-muted hover:text-theme-main hover:bg-theme-active/50',
            ]"
          >
            <Globe class="w-4 h-4 shrink-0" />
            <span>{{ t('settings.tabs.general') }}</span>
          </button>

          <button
            @click="activeTab = 'terminal'"
            :class="[
              'w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors text-left cursor-pointer',
              activeTab === 'terminal'
                ? 'bg-theme-active text-theme-accent border border-theme shadow-xs font-semibold'
                : 'text-theme-muted hover:text-theme-main hover:bg-theme-active/50',
            ]"
          >
            <Terminal class="w-4 h-4 shrink-0" />
            <span>{{ t('settings.tabs.terminal') }}</span>
          </button>

          <button
            @click="activeTab = 'shell'"
            :class="[
              'w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors text-left cursor-pointer',
              activeTab === 'shell'
                ? 'bg-theme-active text-theme-accent border border-theme shadow-xs font-semibold'
                : 'text-theme-muted hover:text-theme-main hover:bg-theme-active/50',
            ]"
          >
            <Cpu class="w-4 h-4 shrink-0" />
            <span>{{ t('settings.tabs.shell') }}</span>
          </button>

          <button
            @click="activeTab = 'security'"
            :class="[
              'w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors text-left cursor-pointer',
              activeTab === 'security'
                ? 'bg-theme-active text-theme-accent border border-theme shadow-xs font-semibold'
                : 'text-theme-muted hover:text-theme-main hover:bg-theme-active/50',
            ]"
          >
            <ShieldCheck class="w-4 h-4 shrink-0" />
            <span>{{ t('settings.tabs.security') }}</span>
          </button>

          <button
            @click="activeTab = 'about'"
            :class="[
              'w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors text-left cursor-pointer',
              activeTab === 'about'
                ? 'bg-theme-active text-theme-accent border border-theme shadow-xs font-semibold'
                : 'text-theme-muted hover:text-theme-main hover:bg-theme-active/50',
            ]"
          >
            <Info class="w-4 h-4 shrink-0" />
            <span>{{ t('settings.tabs.about') }}</span>
          </button>
        </nav>

        <!-- Tab Content -->
        <div class="flex-1 overflow-y-auto p-6 space-y-6 bg-theme-app/30">
          <!-- 1. GENERAL TAB (LANGUAGE & EXTENSION) -->
          <div v-if="activeTab === 'general'" class="space-y-6">
            <div>
              <h3 class="text-sm font-medium text-neutral-200 mb-1">
                {{ t('settings.language') }}
              </h3>
              <p class="text-xs text-neutral-400 mb-3">
                {{ t('settings.selectLanguage') }}
              </p>

              <div class="grid grid-cols-2 gap-3 max-w-md">
                <button
                  v-for="loc in SUPPORTED_LOCALES"
                  :key="loc.code"
                  @click="settingsStore.updateSettings({ locale: loc.code })"
                  :class="[
                    'flex items-center justify-between p-3 rounded-lg border text-sm font-medium transition-all text-left',
                    settingsStore.settings.locale === loc.code
                      ? 'border-blue-500 bg-blue-500/10 text-white'
                      : 'border-neutral-800 bg-neutral-950/40 text-neutral-300 hover:border-neutral-700',
                  ]"
                >
                  <span>{{ loc.name }}</span>
                  <Check
                    v-if="settingsStore.settings.locale === loc.code"
                    class="w-4 h-4 text-blue-400"
                  />
                </button>
              </div>
            </div>

            <div class="pt-4 border-t border-neutral-800">
              <h4 class="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
                {{ t('settings.importTranslation') }}
              </h4>
              <p class="text-xs text-neutral-400 mb-3">
                Load a community-created JSON translation file. Claves ausentes utilizarán el idioma base (Inglés).
              </p>

              <div class="flex flex-col sm:flex-row items-center gap-3 max-w-lg">
                <input
                  v-model="customLocaleCode"
                  type="text"
                  placeholder="Locale Code (e.g. fr, de, pt-BR)"
                  class="w-full sm:w-44 px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-white focus:outline-hidden focus:border-blue-500"
                />

                <label
                  class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium rounded-lg cursor-pointer transition-colors"
                >
                  <Upload class="w-3.5 h-3.5" />
                  <span>Choose JSON</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    class="hidden"
                    @change="handleLocaleFileUpload"
                  />
                </label>
              </div>

              <div v-if="importLocaleSuccess" class="mt-2 text-xs text-emerald-400 flex items-center gap-1.5">
                <Check class="w-3.5 h-3.5" />
                <span>{{ t('settings.translationImported') }}</span>
              </div>
              <div v-if="importLocaleError" class="mt-2 text-xs text-rose-400 flex items-center gap-1.5">
                <AlertCircle class="w-3.5 h-3.5" />
                <span>{{ importLocaleError }}</span>
              </div>
            </div>

            <!-- Window & System Tray Behavior -->
            <div class="pt-4 border-t border-theme">
              <h4 class="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                Bandeja del Sistema (System Tray)
              </h4>
              <p class="text-xs text-neutral-400 mb-3">
                Permite que NexusTerm continúe ejecutándose en segundo plano para no interrumpir túneles SSH ni transferencias activas.
              </p>

              <label class="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  :checked="settingsStore.settings.close_to_tray"
                  @change="settingsStore.updateSettings({ close_to_tray: ($event.target as HTMLInputElement).checked })"
                  class="w-4 h-4 rounded border-theme text-theme-accent focus:ring-0 focus:ring-offset-0 bg-theme-app"
                />
                <span class="text-xs text-theme-main font-medium">
                  Minimizar a la bandeja del sistema al presionar el botón de cerrar (X)
                </span>
              </label>
            </div>
          </div>

          <!-- 2. TERMINAL APPEARANCE TAB -->
          <div v-if="activeTab === 'terminal'" class="space-y-6">
            <!-- Font Selection -->
            <div>
              <label class="block text-xs font-medium text-neutral-300 mb-1.5">
                {{ t('settings.fontFamily') }}
              </label>
              <CustomSelect
                :model-value="settingsStore.settings.font_family"
                @update:model-value="(val) => settingsStore.updateSettings({ font_family: String(val) })"
                :options="fontOptions"
                class="max-w-lg"
              />
            </div>

            <!-- Size and Line Height -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
              <div>
                <label class="block text-xs font-medium text-neutral-300 mb-1.5">
                  {{ t('settings.fontSize') }}: <span class="text-blue-400 font-semibold">{{ settingsStore.settings.font_size }}px</span>
                </label>
                <input
                  type="range"
                  min="10"
                  max="22"
                  step="1"
                  :value="settingsStore.settings.font_size"
                  @input="(e) => settingsStore.updateSettings({ font_size: Number((e.target as HTMLInputElement).value) })"
                  class="w-full accent-blue-500 cursor-pointer"
                />
              </div>

              <div>
                <label class="block text-xs font-medium text-neutral-300 mb-1.5">
                  {{ t('settings.lineHeight') }}: <span class="text-blue-400 font-semibold">{{ settingsStore.settings.line_height }}</span>
                </label>
                <input
                  type="range"
                  min="1.0"
                  max="1.8"
                  step="0.05"
                  :value="settingsStore.settings.line_height"
                  @input="(e) => settingsStore.updateSettings({ line_height: Number((e.target as HTMLInputElement).value) })"
                  class="w-full accent-blue-500 cursor-pointer"
                />
              </div>
            </div>

            <!-- Cursor Style and Blink -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
              <div>
                <label class="block text-xs font-medium text-neutral-300 mb-1.5">
                  {{ t('settings.cursorStyle') }}
                </label>
                <CustomSelect
                  :model-value="settingsStore.settings.cursor_style"
                  @update:model-value="(val) => settingsStore.updateSettings({ cursor_style: val as any })"
                  :options="cursorStyleOptions"
                />
              </div>

              <div class="flex items-center pt-5">
                <label class="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    :checked="settingsStore.settings.cursor_blink"
                    @change="(e) => settingsStore.updateSettings({ cursor_blink: (e.target as HTMLInputElement).checked })"
                    class="w-4 h-4 rounded-sm bg-neutral-950 border-neutral-700 text-blue-500 focus:ring-0 focus:ring-offset-0"
                  />
                  <span class="text-xs font-medium text-neutral-300">{{ t('settings.cursorBlink') }}</span>
                </label>
              </div>
            </div>

            <!-- Color Themes Grid -->
            <div>
              <div class="flex items-center justify-between max-w-2xl mb-3">
                <label class="block text-xs font-medium text-neutral-300">
                  {{ t('settings.colorTheme') }}
                </label>

                <label
                  class="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 cursor-pointer"
                >
                  <Upload class="w-3.5 h-3.5" />
                  <span>{{ t('settings.importTheme') }}</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    class="hidden"
                    @change="handleThemeFileUpload"
                  />
                </label>
              </div>

              <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-2xl">
                <button
                  v-for="item in settingsStore.allThemes"
                  :key="item.id"
                  @click="settingsStore.updateSettings({ theme_id: item.id })"
                  :class="[
                    'flex flex-col p-3 rounded-lg border text-left transition-all relative overflow-hidden',
                    settingsStore.settings.theme_id === item.id
                      ? 'border-blue-500 ring-1 ring-blue-500 bg-neutral-950'
                      : 'border-neutral-800 bg-neutral-950/60 hover:border-neutral-700',
                  ]"
                >
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-semibold text-neutral-200 truncate">{{ item.name }}</span>
                    <Check
                      v-if="settingsStore.settings.theme_id === item.id"
                      class="w-3.5 h-3.5 text-blue-400"
                    />
                  </div>

                  <!-- Theme Color Palette Bar Preview -->
                  <div
                    class="h-5 rounded-sm flex overflow-hidden border border-neutral-800"
                    :style="{ backgroundColor: item.theme.background || '#1a1b26' }"
                  >
                    <div class="w-1/4 h-full" :style="{ backgroundColor: item.theme.red || '#ff5555' }"></div>
                    <div class="w-1/4 h-full" :style="{ backgroundColor: item.theme.green || '#50fa7b' }"></div>
                    <div class="w-1/4 h-full" :style="{ backgroundColor: item.theme.yellow || '#f1fa8c' }"></div>
                    <div class="w-1/4 h-full" :style="{ backgroundColor: item.theme.blue || '#61afef' }"></div>
                  </div>
                </button>
              </div>

              <div v-if="importThemeSuccess" class="mt-2 text-xs text-emerald-400 flex items-center gap-1.5">
                <Check class="w-3.5 h-3.5" />
                <span>{{ t('settings.themeImported') }}</span>
              </div>
              <div v-if="importThemeError" class="mt-2 text-xs text-rose-400 flex items-center gap-1.5">
                <AlertCircle class="w-3.5 h-3.5" />
                <span>{{ importThemeError }}</span>
              </div>
            </div>
          </div>

          <!-- 3. LOCAL SHELL TAB -->
          <div v-if="activeTab === 'shell'" class="space-y-4 max-w-lg">
            <div>
              <label class="block text-xs font-medium text-neutral-300 mb-1">
                {{ t('settings.defaultShell') }}
              </label>
              <p class="text-xs text-neutral-400 mb-2">
                {{ t('settings.shellHelp') }}
              </p>
              <input
                type="text"
                :value="settingsStore.settings.default_shell || ''"
                @input="(e) => settingsStore.updateSettings({ default_shell: (e.target as HTMLInputElement).value.trim() || null })"
                :placeholder="t('settings.defaultShellPlaceholder')"
                class="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs font-mono text-white focus:outline-hidden focus:border-blue-500"
              />
            </div>
          </div>

          <!-- 4. VAULT SECURITY TAB -->
          <div v-if="activeTab === 'security'" class="space-y-4 max-w-lg">
            <div>
              <h3 class="text-sm font-medium text-neutral-200 mb-1">
                {{ t('settings.securityNotice') }}
              </h3>
              <p class="text-xs text-neutral-400 mb-4">
                {{ t('settings.securityHelp') }}
              </p>
            </div>

            <div class="space-y-3 bg-neutral-950/50 p-4 border border-neutral-800 rounded-xl">
              <div>
                <label class="block text-xs font-medium text-neutral-300 mb-1">
                  {{ t('settings.currentPassword') }}
                </label>
                <input
                  v-model="currentPassword"
                  type="password"
                  class="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-white focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label class="block text-xs font-medium text-neutral-300 mb-1">
                  {{ t('settings.newPassword') }}
                </label>
                <input
                  v-model="newPassword"
                  type="password"
                  class="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-white focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label class="block text-xs font-medium text-neutral-300 mb-1">
                  {{ t('settings.confirmNewPassword') }}
                </label>
                <input
                  v-model="confirmNewPassword"
                  type="password"
                  class="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-white focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div v-if="passwordError" class="text-xs text-rose-400 flex items-center gap-1.5">
                <AlertCircle class="w-3.5 h-3.5" />
                <span>{{ passwordError }}</span>
              </div>

              <div v-if="passwordSuccess" class="text-xs text-emerald-400 flex items-center gap-1.5">
                <Check class="w-3.5 h-3.5" />
                <span>{{ t('settings.passwordChanged') }}</span>
              </div>

              <button
                @click="handleRotatePassword"
                :disabled="isRotating"
                class="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors mt-2"
              >
                {{ isRotating ? t('common.loading') : t('settings.rotatePassword') }}
              </button>
            </div>
          </div>

          <!-- 5. ABOUT TAB -->
          <div v-if="activeTab === 'about'" class="space-y-4 max-w-lg">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 bg-blue-600/20 text-blue-400 rounded-xl flex items-center justify-center font-bold text-lg border border-blue-500/30">
                NT
              </div>
              <div>
                <h3 class="text-base font-semibold text-white">NexusTerm</h3>
                <p class="text-xs text-neutral-400">v0.1.0 (Alpha)</p>
              </div>
            </div>

            <p class="text-xs text-neutral-300 leading-relaxed">
              Gestor SSH, SFTP y emulador de terminal ligero, moderno y de alto rendimiento optimizado para Linux (KDE Plasma Wayland), Windows y macOS.
            </p>

            <div class="p-3 bg-neutral-950/60 border border-neutral-800 rounded-lg text-xs text-neutral-400 space-y-1 font-mono">
              <p>• Tauri v2 + Tokio Async Runtime</p>
              <p>• Rust + Russh + Portable-PTY</p>
              <p>• Argon2id + AES-256-GCM Zero-Knowledge Vault</p>
              <p>• Vue 3 + TypeScript + Tailwind CSS v4</p>
              <p>• xterm.js WebGL Hardware Acceleration</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Bar -->
      <div class="flex items-center justify-between px-6 py-3 border-t border-neutral-800 bg-neutral-950/40">
        <button
          @click="handleResetDefaults"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
        >
          <RotateCcw class="w-3.5 h-3.5" />
          <span>{{ t('settings.resetDefaults') }}</span>
        </button>

        <button
          @click="emit('close')"
          class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
        >
          {{ t('common.close') }}
        </button>
      </div>
    </div>
  </div>
</template>
