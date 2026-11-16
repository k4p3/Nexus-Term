# Decisiones de Diseño: performance-memory-optimization

## 1. Arquitectura de Carga Asíncrona en Frontend (Vue 3)

### 1.1 `defineAsyncComponent` en `App.vue`
Actualmente, componentes como `SettingsModal`, `SnippetDrawer`, `PortForwardManager`, `SftpSidebar`, `TransferQueue`, `ShortcutsModal`, `RestoreSessionsModal` y `TerminalCommandPalette` se importan directamente en el encabezado de `<script setup>`.

```typescript
// Antes:
import SettingsModal from "./components/settings/SettingsModal.vue";
import SnippetDrawer from "./components/snippets/SnippetDrawer.vue";
...

// Después:
import { defineAsyncComponent } from "vue";

const SettingsModal = defineAsyncComponent(() => import("./components/settings/SettingsModal.vue"));
const SnippetDrawer = defineAsyncComponent(() => import("./components/snippets/SnippetDrawer.vue"));
const PortForwardManager = defineAsyncComponent(() => import("./components/tunnels/PortForwardManager.vue"));
const SftpSidebar = defineAsyncComponent(() => import("./components/sftp/SftpSidebar.vue"));
const TransferQueue = defineAsyncComponent(() => import("./components/sftp/TransferQueue.vue"));
const ShortcutsModal = defineAsyncComponent(() => import("./components/terminal/ShortcutsModal.vue"));
const RestoreSessionsModal = defineAsyncComponent(() => import("./components/terminal/RestoreSessionsModal.vue"));
```

### 1.2 Beneficios en WebKitGTK / JavaScriptCore
- Reduce el heap inicial al arrancar al diferir el análisis y compilación JIT de los componentes secundarios.
- Disminuye los módulos de iconos Lucide cargados en el hilo principal durante el boot.

---

## 2. Optimización de Addons en `TerminalPane.vue`

`TerminalPane.vue` importa e instancia simultáneamente:
- `WebglAddon`
- `CanvasAddon`
- `Unicode11Addon`
- `ClipboardAddon`
- `ImageAddon`
- `LigaturesAddon`

### Decisión Técnica:
1. `LigaturesAddon` solo se instanciará si la preferencia del usuario `terminal.font_ligatures` está activa. Si está desactivada (valor por defecto habitual), no se crea la instancia ni se asignan buffers de ligaduras tipográficas.
2. `ImageAddon` mantiene un límite estricto de almacenamiento en memoria (`IMAGE_STORAGE_LIMIT_MB = 16`).

---

## 3. Configuración de Chunks en Vite (`vite.config.ts`)

Para evitar un único archivo JS gigante en el bundle final:

```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        vendor_terminal: ["@xterm/xterm", "@xterm/addon-fit", "@xterm/addon-search", "@xterm/addon-web-links"],
        vendor_icons: ["lucide-vue-next"],
        vendor_core: ["vue", "pinia", "vue-i18n"],
      },
    },
  },
}
```

---

## 4. Perfil de Compilación Release de Rust (`Cargo.toml`)

En `src-tauri/Cargo.toml`, agregar la configuración optimizada para producción:

```toml
[profile.release]
opt-level = 3
lto = true
codegen-units = 1
panic = "abort"
strip = true
```

### Justificación:
- **`opt-level = 3`**: Máxima velocidad de ejecución y optimizaciones agresivas de bucles.
- **`lto = true`**: Link-Time Optimization entre todos los crates de Rust (tokio, russh, ironrdp, etc.), eliminando código muerto y permitiendo inlining inter-módulo.
- **`codegen-units = 1`**: Permite a LLVM ver todo el programa como una sola unidad para mejor compresión y optimización (aumenta el tiempo de compilación final, pero maximiza el rendimiento).
- **`panic = "abort"`**: Elimina las tablas de unwinding de excepciones de C++, reduciendo el tamaño del binario y simplificando el runtime.
- **`strip = true`**: Remueve la totalidad de símbolos DWARF del ejecutable final.

---

## 5. Medición y Pruebas

- **Backend**: `cd src-tauri && cargo test` (debe mantener 100% de tests pasando).
- **Frontend**: `pnpm test` y `vue-tsc --noEmit` (cero regresiones en Vitest y TypeScript).
- **Benchmark de Memoria (Linux/KDE)**: Medir con `ps -o pid,rss,cmd -C nexus-term` y procesos `WebKitWebProcess` antes y después de aplicar los cambios.
