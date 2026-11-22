<script setup lang="ts">
import BaseModal from "../common/BaseModal.vue";
import BaseButton from "../common/BaseButton.vue";
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSettingsStore } from '../../stores/settings.store';
import { useVaultStore } from '../../stores/vault.store';
import { useHistoryStore } from '../../stores/history.store';
import { useUiStore } from '../../stores/ui.store';
import { createCanvasInstalledChecker, ligatureStatus } from '../../utils/font-check';
import { SUPPORTED_LOCALES } from '../../locales';
import { APP_VERSION } from '../../utils/app-version';
import { themeModeById } from '../../types/themes';
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
  Trash2,
  Check,
  AlertCircle,
} from 'lucide-vue-next';

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const { t } = useI18n();
const settingsStore = useSettingsStore();
const vaultStore = useVaultStore();
const historyStore = useHistoryStore();
const uiStoreSettings = useUiStore();

// Aviso de ligaduras: la ligadura la dibuja la fuente, que debe estar instalada y soportarla
const isFontInstalled = createCanvasInstalledChecker();
const ligStatus = computed(() => ligatureStatus(settingsStore.settings.font_family, isFontInstalled));

// Gestión del historial de comandos
const historyHostChoice = ref<string>('local');
async function clearHostHistory() {
  if (!confirm(t('settings.historyClearHostConfirm'))) return;
  const n = await historyStore.clear(historyHostChoice.value);
  uiStoreSettings.pushToast(t('settings.historyCleared', { n }), { kind: 'success' });
}
async function clearAllHistory() {
  if (!confirm(t('settings.historyClearAllConfirm'))) return;
  const n = await historyStore.clear();
  uiStoreSettings.pushToast(t('settings.historyCleared', { n }), { kind: 'success' });
}

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

const sftpConcurrentOptions = computed<SelectOption[]>(() => [
  { value: 1, label: t('settings.sftpConcurrent1') },
  { value: 2, label: t('settings.sftpConcurrent2') },
  { value: 3, label: t('settings.sftpConcurrent3') },
  { value: 4, label: t('settings.sftpConcurrent4') },
  { value: 5, label: t('settings.sftpConcurrent5') },
]);

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

const appearanceModeOptions = computed<SelectOption[]>(() => [
  { value: 'manual', label: t('settings.modeManual') },
  { value: 'system', label: t('settings.modeSystem') },
]);
const densityOptions = computed<SelectOption[]>(() => [
  { value: 'comfortable', label: t('settings.densityComfortable') },
  { value: 'compact', label: t('settings.densityCompact') },
]);
const themeOptionsFor = (mode: 'light' | 'dark') =>
  settingsStore.allThemes
    .filter((th) => themeModeById(th.id, settingsStore.customThemes) === mode)
    .map((th) => ({ value: th.id, label: th.name }));
const lightThemeOptions = computed<SelectOption[]>(() => themeOptionsFor('light'));
const darkThemeOptions = computed<SelectOption[]>(() => themeOptionsFor('dark'));
const isSystemMode = computed(() => settingsStore.settings.appearance_mode === 'system');

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
  <BaseModal :title="t('settings.title')" size="xl" @close="emit('close')">
    <template #icon><Cpu class="w-4 h-4" /></template>
      <!-- Main Layout: Sidebar Tabs + Content Area -->
      <div class="-m-4 flex h-[62vh] overflow-hidden">
        <!-- Sidebar Navigation -->
        <nav class="w-56 border-r border-line bg-app/50 p-3 space-y-1 shrink-0">
          <button
            @click="activeTab = 'general'"
            data-autofocus
            :class="[
              'w-full flex items-center gap-3 px-3 h-9 text-sm font-medium rounded-control transition-colors text-left cursor-pointer',
              activeTab === 'general'
                ? 'bg-active text-fg font-semibold'
                : 'text-fg-muted hover:text-fg hover:bg-active/50',
            ]"
          >
            <Globe class="w-4 h-4 shrink-0" />
            <span>{{ t('settings.tabs.general') }}</span>
          </button>

          <button
            @click="activeTab = 'terminal'"
            :class="[
              'w-full flex items-center gap-3 px-3 h-9 text-sm font-medium rounded-control transition-colors text-left cursor-pointer',
              activeTab === 'terminal'
                ? 'bg-active text-fg font-semibold'
                : 'text-fg-muted hover:text-fg hover:bg-active/50',
            ]"
          >
            <Terminal class="w-4 h-4 shrink-0" />
            <span>{{ t('settings.tabs.terminal') }}</span>
          </button>

          <button
            @click="activeTab = 'shell'"
            :class="[
              'w-full flex items-center gap-3 px-3 h-9 text-sm font-medium rounded-control transition-colors text-left cursor-pointer',
              activeTab === 'shell'
                ? 'bg-active text-fg font-semibold'
                : 'text-fg-muted hover:text-fg hover:bg-active/50',
            ]"
          >
            <Cpu class="w-4 h-4 shrink-0" />
            <span>{{ t('settings.tabs.shell') }}</span>
          </button>

          <button
            @click="activeTab = 'security'"
            :class="[
              'w-full flex items-center gap-3 px-3 h-9 text-sm font-medium rounded-control transition-colors text-left cursor-pointer',
              activeTab === 'security'
                ? 'bg-active text-fg font-semibold'
                : 'text-fg-muted hover:text-fg hover:bg-active/50',
            ]"
          >
            <ShieldCheck class="w-4 h-4 shrink-0" />
            <span>{{ t('settings.tabs.security') }}</span>
          </button>

          <button
            @click="activeTab = 'about'"
            :class="[
              'w-full flex items-center gap-3 px-3 h-9 text-sm font-medium rounded-control transition-colors text-left cursor-pointer',
              activeTab === 'about'
                ? 'bg-active text-fg font-semibold'
                : 'text-fg-muted hover:text-fg hover:bg-active/50',
            ]"
          >
            <Info class="w-4 h-4 shrink-0" />
            <span>{{ t('settings.tabs.about') }}</span>
          </button>
        </nav>

        <!-- Tab Content -->
        <div class="flex-1 overflow-y-auto p-6 space-y-6 bg-app/30">
          <!-- 1. GENERAL TAB (LANGUAGE & EXTENSION) -->
          <div v-if="activeTab === 'general'" class="space-y-6">
            <div>
              <h3 class="text-sm font-medium text-fg mb-1">
                {{ t('settings.language') }}
              </h3>
              <p class="text-xs text-fg-muted mb-3">
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
                      ? 'border-accent bg-accent/10 text-fg'
                      : 'border-line bg-app/40 text-fg hover:border-line',
                  ]"
                >
                  <span>{{ loc.name }}</span>
                  <Check
                    v-if="settingsStore.settings.locale === loc.code"
                    class="w-4 h-4 text-accent"
                  />
                </button>
              </div>
            </div>

            <div class="pt-4 border-t border-line">
              <h4 class="text-xs font-semibold text-fg uppercase tracking-wider mb-2">
                {{ t('settings.importTranslation') }}
              </h4>
              <p class="text-xs text-fg-muted mb-3">
                {{ t('ui.settings.localeHelp') }}
              </p>

              <div class="flex flex-col sm:flex-row items-center gap-3 max-w-lg">
                <input
                  v-model="customLocaleCode"
                  type="text"
                  :placeholder="t('ui.settings.localeCode')"
                  class="w-full sm:w-44 px-3 py-2 bg-app border border-line rounded-lg text-xs text-fg focus:outline-hidden focus:border-accent"
                />

                <label
                  class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3 py-2 bg-active hover:bg-active text-fg text-xs font-medium rounded-lg cursor-pointer transition-colors"
                >
                  <Upload class="w-3.5 h-3.5" />
                  <span>{{ t('ui.settings.chooseJson') }}</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    class="hidden"
                    @change="handleLocaleFileUpload"
                  />
                </label>
              </div>

              <div v-if="importLocaleSuccess" class="mt-2 text-xs text-success flex items-center gap-1.5">
                <Check class="w-3.5 h-3.5" />
                <span>{{ t('settings.translationImported') }}</span>
              </div>
              <div v-if="importLocaleError" class="mt-2 text-xs text-danger flex items-center gap-1.5">
                <AlertCircle class="w-3.5 h-3.5" />
                <span>{{ importLocaleError }}</span>
              </div>
            </div>

            <!-- Window & System Tray Behavior -->
            <div class="pt-4 border-t border-line">
              <h4 class="text-xs font-semibold text-fg uppercase tracking-wider mb-1">
                {{ t('ui.settings.trayTitle') }}
              </h4>
              <p class="text-xs text-fg-muted mb-3">
                {{ t('ui.settings.trayHelp') }}
              </p>

              <label class="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  :checked="settingsStore.settings.close_to_tray"
                  @change="settingsStore.updateSettings({ close_to_tray: ($event.target as HTMLInputElement).checked })"
                  class="w-4 h-4 rounded border-line text-accent focus:ring-0 focus:ring-offset-0 bg-app"
                />
                <span class="text-xs text-fg font-medium">
                  {{ t('ui.settings.trayOption') }}
                </span>
              </label>
            </div>

            <!-- SFTP Transfers Settings -->
            <div class="pt-4 border-t border-line">
              <h4 class="text-xs font-semibold text-fg uppercase tracking-wider mb-1">
                {{ t('settings.sftpSection') }}
              </h4>
              <p class="text-xs text-fg-muted mb-3">
                {{ t('settings.sftpConcurrentDesc') }}
              </p>

              <div class="max-w-md">
                <label class="block text-xs font-medium text-fg-muted mb-1.5">
                  {{ t('settings.sftpConcurrentTransfers') }}
                </label>
                <CustomSelect
                  :model-value="settingsStore.settings.sftp_max_concurrent_transfers || 2"
                  :options="sftpConcurrentOptions"
                  @update:model-value="settingsStore.updateSettings({ sftp_max_concurrent_transfers: Number($event) })"
                />
              </div>
            </div>

            <div class="pt-4 border-t border-line space-y-3">
              <h4 class="text-sm font-semibold text-fg">{{ t('settings.terminalProductivitySection') }}</h4>
              <label class="flex items-start space-x-2 cursor-pointer max-w-md">
                <input type="checkbox" class="mt-0.5" :checked="settingsStore.settings.paste_warning"
                  @change="settingsStore.updateSettings({ paste_warning: ($event.target as HTMLInputElement).checked })" />
                <span>
                  <span class="block text-xs font-medium text-fg">{{ t('settings.pasteWarning') }}</span>
                  <span class="block text-xs text-fg-muted">{{ t('settings.pasteWarningDesc') }}</span>
                </span>
              </label>
              <label class="flex items-center space-x-2 max-w-md">
                <span class="text-xs font-medium text-fg flex-1">{{ t('settings.pasteHistorySize') }}</span>
                <input type="number" min="0" max="100" class="w-20 px-2 py-1 bg-app border border-line rounded-lg text-xs"
                  :value="settingsStore.settings.paste_history_size"
                  @change="settingsStore.updateSettings({ paste_history_size: Math.min(100, Math.max(0, Number(($event.target as HTMLInputElement).value) || 0)) })" />
              </label>
              <label class="flex items-start space-x-2 cursor-pointer max-w-md">
                <input type="checkbox" class="mt-0.5" :checked="settingsStore.settings.notify_long_commands"
                  @change="settingsStore.updateSettings({ notify_long_commands: ($event.target as HTMLInputElement).checked })" />
                <span>
                  <span class="block text-xs font-medium text-fg">{{ t('settings.notifyLong') }}</span>
                  <span class="block text-xs text-fg-muted">{{ t('settings.notifyLongDesc') }}</span>
                </span>
              </label>
              <label class="flex items-center space-x-2 max-w-md">
                <span class="text-xs font-medium text-fg flex-1">{{ t('settings.notifyThreshold') }}</span>
                <input type="number" min="1" max="3600" class="w-20 px-2 py-1 bg-app border border-line rounded-lg text-xs"
                  :value="settingsStore.settings.notify_threshold_seconds"
                  @change="settingsStore.updateSettings({ notify_threshold_seconds: Math.min(3600, Math.max(1, Number(($event.target as HTMLInputElement).value) || 10)) })" />
              </label>
              <label class="flex items-start space-x-2 cursor-pointer max-w-md">
                <input type="checkbox" class="mt-0.5" :checked="settingsStore.settings.notify_include_command"
                  @change="settingsStore.updateSettings({ notify_include_command: ($event.target as HTMLInputElement).checked })" />
                <span>
                  <span class="block text-xs font-medium text-fg">{{ t('settings.notifyIncludeCommand') }}</span>
                  <span class="block text-xs text-fg-muted">{{ t('settings.notifyIncludeCommandDesc') }}</span>
                </span>
              </label>
            </div>

            <div class="pt-4 border-t border-line space-y-3">
              <h4 class="text-sm font-semibold text-fg mb-1">{{ t('settings.historySection') }}</h4>
              <label class="flex items-start space-x-2 cursor-pointer max-w-md">
                <input type="checkbox" class="mt-0.5" :checked="settingsStore.settings.history_enabled"
                  @change="settingsStore.updateSettings({ history_enabled: ($event.target as HTMLInputElement).checked })" />
                <span>
                  <span class="block text-xs font-medium text-fg">{{ t('settings.historyEnabled') }}</span>
                  <span class="block text-xs text-fg-muted">{{ t('settings.historyEnabledDesc') }}</span>
                </span>
              </label>
              <label class="flex items-start space-x-2 cursor-pointer max-w-md">
                <input type="checkbox" class="mt-0.5" :checked="settingsStore.settings.osc52_clipboard"
                  @change="settingsStore.updateSettings({ osc52_clipboard: ($event.target as HTMLInputElement).checked })" />
                <span>
                  <span class="block text-xs font-medium text-fg">{{ t('settings.osc52') }}</span>
                  <span class="block text-xs text-fg-muted">{{ t('settings.osc52Desc') }}</span>
                </span>
              </label>
              <label class="flex items-start space-x-2 cursor-pointer max-w-md">
                <input type="checkbox" class="mt-0.5" :checked="settingsStore.settings.inline_images"
                  @change="settingsStore.updateSettings({ inline_images: ($event.target as HTMLInputElement).checked })" />
                <span>
                  <span class="block text-xs font-medium text-fg">{{ t('settings.inlineImages') }}</span>
                  <span class="block text-xs text-fg-muted">{{ t('settings.inlineImagesDesc') }}</span>
                </span>
              </label>
              <label class="flex items-start space-x-2 cursor-pointer max-w-md">
                <input type="checkbox" class="mt-0.5" :checked="settingsStore.settings.font_ligatures"
                  @change="settingsStore.updateSettings({ font_ligatures: ($event.target as HTMLInputElement).checked })" />
                <span>
                  <span class="block text-xs font-medium text-fg">{{ t('settings.fontLigatures') }}</span>
                  <span class="block text-xs text-fg-muted">{{ t('settings.fontLigaturesDesc') }}</span>
                  <span v-if="settingsStore.settings.font_ligatures && ligStatus.ok" class="block text-xs text-success mt-1">
                    ✓ {{ t('settings.fontLigaturesOk', { font: ligStatus.effective }) }}
                  </span>
                  <span v-else-if="settingsStore.settings.font_ligatures" class="block text-xs text-warning mt-1">
                    ⚠ {{ ligStatus.effective
                      ? t('settings.fontLigaturesNoSupport', { font: ligStatus.effective })
                      : t('settings.fontLigaturesNoFont') }}
                    <template v-if="ligStatus.missing.length"> {{ t('settings.fontLigaturesMissing', { fonts: ligStatus.missing.join(', ') }) }}</template>
                  </span>
                </span>
              </label>
              <label class="flex items-center space-x-2 max-w-md">
                <span class="flex-1">
                  <span class="block text-xs font-medium text-fg">{{ t('settings.restoreSessions') }}</span>
                  <span class="block text-xs text-fg-muted">{{ t('settings.restoreSessionsDesc') }}</span>
                </span>
                <select class="px-2 py-1 bg-app border border-line rounded-lg text-xs"
                  :value="settingsStore.settings.restore_sessions"
                  @change="settingsStore.updateSettings({ restore_sessions: ($event.target as HTMLSelectElement).value as 'ask' | 'auto' | 'off' })">
                  <option value="ask">{{ t('settings.restoreAsk') }}</option>
                  <option value="auto">{{ t('settings.restoreAuto') }}</option>
                  <option value="off">{{ t('settings.restoreOff') }}</option>
                </select>
              </label>
              <label class="flex items-start space-x-2 cursor-pointer max-w-md">
                <input type="checkbox" class="mt-0.5" :checked="settingsStore.settings.instant_replay"
                  @change="settingsStore.updateSettings({ instant_replay: ($event.target as HTMLInputElement).checked })" />
                <span>
                  <span class="block text-xs font-medium text-fg">{{ t('settings.instantReplay') }}</span>
                  <span class="block text-xs text-fg-muted">{{ t('settings.instantReplayDesc') }}</span>
                </span>
              </label>
              <div class="flex items-center space-x-2 max-w-md">
                <select v-model="historyHostChoice" class="flex-1 px-2 py-1 bg-app border border-line rounded-lg text-xs">
                  <option value="local">{{ t('settings.historyLocalShells') }}</option>
                  <option v-for="h in vaultStore.hosts" :key="h.id" :value="h.id">{{ h.label }}</option>
                </select>
                <button type="button" class="px-2 py-1 text-xs rounded-lg border border-line hover:bg-active cursor-pointer" @click="clearHostHistory">
                  {{ t('settings.historyClearHost') }}
                </button>
              </div>
              <button type="button" class="px-2 py-1 text-xs rounded-lg border border-danger/40 text-danger hover:bg-danger/10 cursor-pointer" @click="clearAllHistory">
                {{ t('settings.historyClearAll') }}
              </button>
            </div>

            <div class="pt-4 border-t border-line">
              <h4 class="text-sm font-semibold text-fg mb-1">{{ t('settings.remoteDesktopSection') }}</h4>
              <label class="flex items-start space-x-2 cursor-pointer max-w-md">
                <input
                  type="checkbox"
                  class="mt-0.5"
                  :checked="settingsStore.settings.remote_desktop_clipboard"
                  @change="settingsStore.updateSettings({ remote_desktop_clipboard: ($event.target as HTMLInputElement).checked })"
                />
                <span>
                  <span class="block text-xs font-medium text-fg">{{ t('settings.remoteClipboard') }}</span>
                  <span class="block text-xs text-fg-muted">{{ t('settings.remoteClipboardDesc') }}</span>
                </span>
              </label>
            </div>
          </div>

          <!-- 2. TERMINAL APPEARANCE TAB -->
          <div v-if="activeTab === 'terminal'" class="space-y-6">
            <!-- Font Selection -->
            <div>
              <label class="block text-xs font-medium text-fg mb-1.5">
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
                <label class="block text-xs font-medium text-fg mb-1.5">
                  {{ t('settings.fontSize') }}: <span class="text-accent font-semibold">{{ settingsStore.settings.font_size }}px</span>
                </label>
                <input
                  type="range"
                  min="10"
                  max="22"
                  step="1"
                  :value="settingsStore.settings.font_size"
                  @input="(e) => settingsStore.updateSettings({ font_size: Number((e.target as HTMLInputElement).value) })"
                  class="w-full accent-accent cursor-pointer"
                />
              </div>

              <div>
                <label class="block text-xs font-medium text-fg mb-1.5">
                  {{ t('settings.lineHeight') }}: <span class="text-accent font-semibold">{{ settingsStore.settings.line_height }}</span>
                </label>
                <input
                  type="range"
                  min="1.0"
                  max="1.8"
                  step="0.05"
                  :value="settingsStore.settings.line_height"
                  @input="(e) => settingsStore.updateSettings({ line_height: Number((e.target as HTMLInputElement).value) })"
                  class="w-full accent-accent cursor-pointer"
                />
              </div>
            </div>

            <!-- Cursor Style and Blink -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
              <div>
                <label class="block text-xs font-medium text-fg mb-1.5">
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
                    class="w-4 h-4 rounded-sm bg-app border-line text-accent focus:ring-0 focus:ring-offset-0"
                  />
                  <span class="text-xs font-medium text-fg">{{ t('settings.cursorBlink') }}</span>
                </label>
              </div>
            </div>

            <!-- Appearance mode and density -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
              <div>
                <label class="block text-xs font-medium text-fg mb-1.5">{{ t('settings.appearanceMode') }}</label>
                <CustomSelect
                  :model-value="settingsStore.settings.appearance_mode"
                  @update:model-value="(val) => settingsStore.updateSettings({ appearance_mode: val as any })"
                  :options="appearanceModeOptions"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-fg mb-1.5">{{ t('settings.uiDensity') }}</label>
                <CustomSelect
                  :model-value="settingsStore.settings.ui_density"
                  @update:model-value="(val) => settingsStore.updateSettings({ ui_density: val as any })"
                  :options="densityOptions"
                />
              </div>
              <template v-if="isSystemMode">
                <div>
                  <label class="block text-xs font-medium text-fg mb-1.5">{{ t('settings.lightTheme') }}</label>
                  <CustomSelect
                    :model-value="settingsStore.settings.theme_light_id"
                    @update:model-value="(val) => settingsStore.updateSettings({ theme_light_id: val })"
                    :options="lightThemeOptions"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-fg mb-1.5">{{ t('settings.darkTheme') }}</label>
                  <CustomSelect
                    :model-value="settingsStore.settings.theme_dark_id"
                    @update:model-value="(val) => settingsStore.updateSettings({ theme_dark_id: val })"
                    :options="darkThemeOptions"
                  />
                </div>
              </template>
            </div>

            <!-- Color Themes Grid -->
            <div v-if="!isSystemMode">
              <div class="flex items-center justify-between max-w-2xl mb-3">
                <label class="block text-xs font-medium text-fg">
                  {{ t('settings.colorTheme') }}
                </label>

                <label
                  class="inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent cursor-pointer"
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
                      ? 'border-accent ring-1 ring-accent bg-app'
                      : 'border-line bg-app/60 hover:border-line',
                  ]"
                >
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-semibold text-fg truncate">{{ item.name }}</span>
                    <span class="flex items-center gap-1.5">
                      <span
                        v-if="item.id.startsWith('custom-')"
                        role="button"
                        tabindex="0"
                        :title="t('settings.removeTheme')"
                        :aria-label="t('settings.removeTheme')"
                        class="text-fg-muted hover:text-danger"
                        @click.stop="settingsStore.removeCustomTheme(item.id)"
                        @keydown.enter.stop="settingsStore.removeCustomTheme(item.id)"
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                      </span>
                      <Check
                        v-if="settingsStore.settings.theme_id === item.id"
                        class="w-3.5 h-3.5 text-accent"
                      />
                    </span>
                  </div>

                  <!-- Theme Color Palette Bar Preview -->
                  <div
                    class="h-5 rounded-sm flex overflow-hidden border border-line"
                    :style="{ backgroundColor: item.theme.background || '#1a1b26' }"
                  >
                    <div class="w-1/4 h-full" :style="{ backgroundColor: item.theme.red || '#ff5555' }"></div>
                    <div class="w-1/4 h-full" :style="{ backgroundColor: item.theme.green || '#50fa7b' }"></div>
                    <div class="w-1/4 h-full" :style="{ backgroundColor: item.theme.yellow || '#f1fa8c' }"></div>
                    <div class="w-1/4 h-full" :style="{ backgroundColor: item.theme.blue || '#61afef' }"></div>
                  </div>
                </button>
              </div>

              <div v-if="importThemeSuccess" class="mt-2 text-xs text-success flex items-center gap-1.5">
                <Check class="w-3.5 h-3.5" />
                <span>{{ t('settings.themeImported') }}</span>
              </div>
              <div v-if="importThemeError" class="mt-2 text-xs text-danger flex items-center gap-1.5">
                <AlertCircle class="w-3.5 h-3.5" />
                <span>{{ importThemeError }}</span>
              </div>
            </div>
          </div>

          <!-- 3. LOCAL SHELL TAB -->
          <div v-if="activeTab === 'shell'" class="space-y-4 max-w-lg">
            <div>
              <label class="block text-xs font-medium text-fg mb-1">
                {{ t('settings.defaultShell') }}
              </label>
              <p class="text-xs text-fg-muted mb-2">
                {{ t('settings.shellHelp') }}
              </p>
              <input
                type="text"
                :value="settingsStore.settings.default_shell || ''"
                @input="(e) => settingsStore.updateSettings({ default_shell: (e.target as HTMLInputElement).value.trim() || null })"
                :placeholder="t('settings.defaultShellPlaceholder')"
                class="w-full px-3 py-2 bg-app border border-line rounded-lg text-xs font-mono text-fg focus:outline-hidden focus:border-accent"
              />
              <label class="flex items-start space-x-2 cursor-pointer max-w-md mt-3">
                <input type="checkbox" class="mt-0.5" :checked="settingsStore.settings.shell_integration"
                  @change="settingsStore.updateSettings({ shell_integration: ($event.target as HTMLInputElement).checked })" />
                <span>
                  <span class="block text-xs font-medium text-fg">{{ t('settings.shellIntegration') }}</span>
                  <span class="block text-xs text-fg-muted">{{ t('settings.shellIntegrationDesc') }}</span>
                </span>
              </label>
              <label class="flex items-start space-x-2 cursor-pointer max-w-md mt-3">
                <input type="checkbox" class="mt-0.5" :checked="settingsStore.settings.inline_suggestion"
                  @change="settingsStore.updateSettings({ inline_suggestion: ($event.target as HTMLInputElement).checked })" />
                <span>
                  <span class="block text-xs font-medium text-fg">{{ t('settings.inlineSuggestion') }}</span>
                  <span class="block text-xs text-fg-muted">{{ t('settings.inlineSuggestionDesc') }}</span>
                </span>
              </label>
            </div>
          </div>

          <!-- 4. VAULT SECURITY TAB -->
          <div v-if="activeTab === 'security'" class="space-y-4 max-w-lg">
            <div>
              <h3 class="text-sm font-medium text-fg mb-1">
                {{ t('settings.securityNotice') }}
              </h3>
              <p class="text-xs text-fg-muted mb-4">
                {{ t('settings.securityHelp') }}
              </p>
            </div>

            <div class="space-y-3 bg-app/50 p-4 border border-line rounded-xl">
              <label class="flex items-start space-x-2 cursor-pointer">
                <input type="checkbox" class="mt-0.5" :checked="settingsStore.settings.ask_password_on_startup"
                  @change="settingsStore.updateSettings({ ask_password_on_startup: ($event.target as HTMLInputElement).checked })" />
                <span>
                  <span class="block text-xs font-medium text-fg">{{ t('settings.askPasswordOnStartup') }}</span>
                  <span class="block text-xs text-fg-muted">{{ t('settings.askPasswordOnStartupDesc') }}</span>
                </span>
              </label>
              <label class="flex items-start space-x-2 cursor-pointer">
                <input type="checkbox" class="mt-0.5" :checked="settingsStore.settings.auto_lock_enabled"
                  @change="settingsStore.updateSettings({ auto_lock_enabled: ($event.target as HTMLInputElement).checked })" />
                <span>
                  <span class="block text-xs font-medium text-fg">{{ t('settings.autoLock') }}</span>
                  <span class="block text-xs text-fg-muted">{{ t('settings.autoLockDesc') }}</span>
                </span>
              </label>
              <label class="flex items-center space-x-2" :class="{ 'opacity-50': !settingsStore.settings.auto_lock_enabled }">
                <span class="text-xs font-medium text-fg flex-1">{{ t('settings.autoLockMinutes') }}</span>
                <input type="number" min="1" max="1440" :disabled="!settingsStore.settings.auto_lock_enabled"
                  class="w-20 px-2 py-1 bg-app border border-line rounded-lg text-xs"
                  :value="settingsStore.settings.auto_lock_minutes"
                  @change="settingsStore.updateSettings({ auto_lock_minutes: Math.min(1440, Math.max(1, Math.floor(Number(($event.target as HTMLInputElement).value)) || 10)) })" />
              </label>
            </div>

            <div class="space-y-3 bg-app/50 p-4 border border-line rounded-xl">
              <div>
                <label class="block text-xs font-medium text-fg mb-1">
                  {{ t('settings.currentPassword') }}
                </label>
                <input
                  v-model="currentPassword"
                  type="password"
                  class="w-full px-3 py-2 bg-app border border-line rounded-lg text-xs text-fg focus:outline-hidden focus:border-accent"
                />
              </div>

              <div>
                <label class="block text-xs font-medium text-fg mb-1">
                  {{ t('settings.newPassword') }}
                </label>
                <input
                  v-model="newPassword"
                  type="password"
                  class="w-full px-3 py-2 bg-app border border-line rounded-lg text-xs text-fg focus:outline-hidden focus:border-accent"
                />
              </div>

              <div>
                <label class="block text-xs font-medium text-fg mb-1">
                  {{ t('settings.confirmNewPassword') }}
                </label>
                <input
                  v-model="confirmNewPassword"
                  type="password"
                  class="w-full px-3 py-2 bg-app border border-line rounded-lg text-xs text-fg focus:outline-hidden focus:border-accent"
                />
              </div>

              <div v-if="passwordError" class="text-xs text-danger flex items-center gap-1.5">
                <AlertCircle class="w-3.5 h-3.5" />
                <span>{{ passwordError }}</span>
              </div>

              <div v-if="passwordSuccess" class="text-xs text-success flex items-center gap-1.5">
                <Check class="w-3.5 h-3.5" />
                <span>{{ t('settings.passwordChanged') }}</span>
              </div>

              <button
                @click="handleRotatePassword"
                :disabled="isRotating"
                class="w-full py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-on-accent text-xs font-medium rounded-lg transition-colors mt-2"
              >
                {{ isRotating ? t('common.loading') : t('settings.rotatePassword') }}
              </button>
            </div>
          </div>

          <!-- 5. ABOUT TAB -->
          <div v-if="activeTab === 'about'" class="space-y-4 max-w-lg">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 bg-accent/20 text-accent rounded-xl flex items-center justify-center font-bold text-lg border border-accent/30">
                NT
              </div>
              <div>
                <h3 class="text-base font-semibold text-fg">NexusTerm</h3>
                <p class="text-xs text-fg-muted">v{{ APP_VERSION }}</p>
              </div>
            </div>

            <p class="text-xs text-fg leading-relaxed">
              {{ t('ui.settings.aboutBody') }}
            </p>

            <div class="p-3 bg-app/60 border border-line rounded-lg text-xs text-fg-muted space-y-1 font-mono">
              <p>• Tauri v2 + Tokio Async Runtime</p>
              <p>• Rust + Russh + Portable-PTY</p>
              <p>• Argon2id + AES-256-GCM Zero-Knowledge Vault</p>
              <p>• Vue 3 + TypeScript + Tailwind CSS v4</p>
              <p>• xterm.js WebGL Hardware Acceleration</p>
            </div>
          </div>
        </div>
      </div>

    <template #footer>
      <BaseButton variant="ghost" class="mr-auto" @click="handleResetDefaults">
        <RotateCcw class="w-3.5 h-3.5" />
        <span>{{ t('settings.resetDefaults') }}</span>
      </BaseButton>
      <BaseButton variant="primary" @click="emit('close')">{{ t('common.close') }}</BaseButton>
    </template>
  </BaseModal>
</template>
