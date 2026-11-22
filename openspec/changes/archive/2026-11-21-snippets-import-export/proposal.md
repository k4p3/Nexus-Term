## Why

Los snippets solo se crean uno a uno desde el modal. No hay forma de traer una colección ya hecha (de otro equipo, de un repositorio o de una copia propia) ni de compartir la propia. Se quiere importar desde una estructura estándar y documentada, y poder exportar con el mismo formato.

## What Changes

- **Formato `nexusterm-snippets` v1** (JSON, documentado y versionado): `{ "format": "nexusterm-snippets", "version": 1, "snippets": [{ "title", "command", "description?", "tags?" }] }`. `command` admite los mismos `{{parámetros}}` y `{{param=valor}}` que el modal.
- **Importar** desde el cajón de snippets: elige un `.json`, se valida y se muestra un **resumen** (cuántos se importarán, se omiten por duplicados o son inválidos, con el motivo) antes de confirmar.
- **Duplicados**: un snippet con el mismo título y comando que otro existente se omite; nunca se sobrescribe nada. Los importados se crean como personalizados (no integrados) y habilitados.
- **Exportar** los snippets personalizados (los integrados no, pues ya vienen con la app) a un fichero con el mismo formato.
- **Seguridad frente a ficheros maliciosos**: el comando debe ser de **una sola línea** y se rechazan los caracteres de control (incluido `ESC`), los de dirección de texto (bidi) y los de ancho cero o invisibles; lo mismo en título y descripción. El resumen previo muestra **cada comando completo** y marca con aviso los de riesgo (`sudo`, `rm -rf`, `curl | sh`…) usando el analizador del pegado seguro. Los importados llevan la etiqueta reservada `imported`, que el cajón muestra como insignia **«importado»**.
- Validación estricta y límites: tamaño máximo del fichero (1 MB), hasta 500 snippets, título ≤ 120 y comando ≤ 8000 caracteres, etiquetas ≤ 10 de ≤ 32; versión desconocida se rechaza. Sin ejecutar ni interpretar nada del fichero.
- **Solo frontend** y reutilizando `save_snippet`: sin cambios en Rust ni dependencias nuevas (no aplica verificación de licencias). El diálogo de importación se carga con `defineAsyncComponent`.

## Capabilities

### New Capabilities
- (ninguna)

### Modified Capabilities
- `command-snippets`: requisitos de importación y exportación.

## Impact

- Nuevos: `src/utils/snippet-io.ts` (análisis, validación y serialización puros), `src/components/snippets/SnippetImportModal.vue` y pruebas.
- Modificados: `src/components/snippets/SnippetDrawer.vue` (botones Importar/Exportar), `src/stores/snippets.store.ts` (`importSnippets`), `src/locales/{es,en}.json`, `docs/FEATURES_MANUAL.md` (§4.2, con el esquema), `docs/MANUAL_TEST_CHECKLIST.md`, READMEs, sitio y `CHANGELOG.md`.
