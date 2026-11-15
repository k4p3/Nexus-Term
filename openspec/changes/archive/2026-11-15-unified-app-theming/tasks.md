# Tasks: Unified App-Wide Theming

## 1. Tokens de Diseño y Tipos de Datos

- [x] 1.1 Declarar la interfaz `UiThemePalette` y asociar paletas completas de UI a los 6 temas predefinidos en `src/types/themes.ts`
- [x] 1.2 Implementar el generador algorítmico `deriveUiPalette(theme: ITheme)` para derivar superficies, bordes y acentos en temas importados sin paleta explícita
- [x] 1.3 Declarar las variables CSS base (`--theme-*`) y las clases utilitarias de soporte (`.bg-theme-app`, `.bg-theme-surface`, `.border-theme`, `.text-theme-main`, etc.) en `src/style.css`

## 2. Lógica Reactiva de Tematización en Pinia Store

- [x] 2.1 Implementar la función `applyThemeToDom(themeId: string)` en `src/stores/settings.store.ts` para inyectar reactivamente las propiedades CSS en `document.documentElement`
- [x] 2.2 Conectar `applyThemeToDom` dentro de `loadSettings()`, `updateSettings()`, `resetSettings()` e `importCustomTheme()`

## 3. Adaptación de Componentes de la Interfaz

- [x] 3.1 Refactorizar el contenedor raíz y la cabecera superior en `src/App.vue` reemplazando los grises fijos por las clases del tema
- [x] 3.2 Refactorizar el explorador lateral en `src/components/hosts/HostTreeSidebar.vue` para usar fondos, bordes y botones temáticos
- [x] 3.3 Refactorizar la barra de pestañas y botones de control en `src/components/terminal/TerminalWorkspace.vue`
- [x] 3.4 Adaptar los modales y paneles superpuestos (`SettingsModal.vue`, `QuickConnectModal.vue`, `SnippetDrawer.vue`) para sincronizarse con el tema seleccionado

## 4. Verificación y Validación

- [x] 4.1 Ejecutar verificación de tipos TypeScript y compilación de Vite (`./node_modules/.bin/vue-tsc --noEmit && ./node_modules/.bin/vite build`)
- [x] 4.2 Validar formalmente la propuesta y especificaciones con `openspec validate --all --strict`
