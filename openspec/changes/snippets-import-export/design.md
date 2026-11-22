## Context

Los snippets viven cifrados en la bóveda (`snippets` en `vault.db`) y se gestionan con `get_snippets`, `save_snippet` (crea si no hay `id`), `toggle_snippet_enabled` y `delete_snippet`. El frontend ya selecciona ficheros con `<input type="file">` (identidades, ajustes), sin plugin de diálogos.

## Goals / Non-Goals

**Goals:** formato sencillo y estable, validación estricta, resumen previo, duplicados sin sobrescribir, exportación simétrica.
**Non-Goals:** formatos ajenos (VS Code, YAML, CSV…; ampliables con nuevos analizadores sobre la misma interfaz), fusionar o actualizar snippets existentes, importar los integrados, sincronización.

## Decisions

1. **Formato.** `{ format: "nexusterm-snippets", version: 1, snippets: [{ title, command, description?, tags? }] }`. Se usa `command` (no `command_template`) por legibilidad; el mapeo a `SaveSnippetPayload` es explícito. Los campos desconocidos se ignoran para poder evolucionar; una `version` mayor se rechaza.
2. **Lógica pura en `snippet-io.ts`.** `parseSnippetFile(text, existing) → { ok: false, error } | { ok: true, toImport, skipped, invalid }` y `serializeSnippets(snippets) → string`. Sin acceso a Tauri, por lo que se prueba por completo con Vitest.
3. **Seguridad de contenido.** `title`, `command` y `description` se rechazan si contienen `\r`/`\n`, caracteres de control C0/C1 (salvo tabulador), controles bidi (`U+202A–202E`, `U+2066–2069`, `U+200E/F`) o de ancho cero/invisibles (`U+200B–200D`, `U+2060`, `U+FEFF`). El resumen lista cada comando completo con `analyzePaste` (`src/utils/paste-safety`) para marcar los de riesgo; el aviso es informativo, no bloquea.
3b. **Marca «importado».** Sin migración de esquema: se añade la etiqueta reservada `imported` a `tags` (se quita de la exportación para no propagarla). `SnippetDrawer` muestra la insignia cuando `tags` la incluye.
4. **Validación.** Límites: fichero ≤ 1 MB (comprobado con `file.size` antes de leer), ≤ 500 entradas, `title` 1–120 (tras `trim`), `command` 1–8000 (se conserva tal cual, solo se rechaza vacío), `description` ≤ 500, ≤ 10 etiquetas de ≤ 32. Los tipos incorrectos invalidan la entrada, no el fichero.
5. **Duplicados.** Clave `title.trim() + "\u0000" + command` comparada con todos los snippets existentes y con las entradas ya aceptadas del mismo fichero.
6. **Guardado.** Tras confirmar, `snippetsStore.importSnippets(items)` llama a `save_snippet` secuencialmente (sin `id`, `is_enabled: true`) y recarga la lista una vez. Si una falla se cuenta como error y se continúa; el resumen final informa del resultado real. Sin comando Rust nuevo.
7. **Exportación.** `Blob` + `<a download>` con nombre `nexusterm-snippets.json`, JSON con sangría de 2 espacios y solo los no integrados.
8. **UI.** Dos botones en la cabecera del cajón (Importar / Exportar). El diálogo `SnippetImportModal.vue` es diferido (`defineAsyncComponent`) y muestra los contadores y las entradas omitidas/ inválidas con su motivo.

## Risks / Trade-offs

- **Ficheros hostiles o enormes**: límites de tamaño y cantidad, `JSON.parse` en try/catch y nada se ejecuta; los textos se muestran siempre escapados por Vue.
- **Comandos peligrosos importados**: no se ejecutan al importar; el resumen los marca y la insignia los distingue. Que al usarlos no se ejecuten solos lo resuelve el cambio `snippets-insert-without-execute`. Un comando visiblemente dañino no tiene defensa técnica: depende de revisar el fichero y confiar en su origen.
- **Etiqueta `imported` editable**: el usuario puede quitarla; es solo informativa.
- **Importación parcial por error de E/S**: el resumen final lo refleja y reimportar omite los ya creados (idempotente).

## Migration Plan

Solo aditivo; sin cambios de esquema ni de datos.

## Open Questions

- Soporte de otros formatos (VS Code, Warp workflows) como analizadores adicionales en una fase posterior.
