import { createI18n } from 'vue-i18n';
import en from './en.json';
import es from './es.json';

export type MessageSchema = typeof en;

export const SUPPORTED_LOCALES = [
  { code: 'en', name: 'English (US)' },
  { code: 'es', name: 'Español' },
];

export const i18n = createI18n<[MessageSchema], 'en' | 'es' | string>({
  legacy: false, // Use Composition API mode
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en,
    es,
  },
});

export function setAppLocale(locale: string) {
  // @ts-expect-error vue-i18n typed locale
  i18n.global.locale.value = locale;
}

export function registerCustomLocale(code: string, messages: Record<string, any>) {
  i18n.global.setLocaleMessage(code, messages);
}
