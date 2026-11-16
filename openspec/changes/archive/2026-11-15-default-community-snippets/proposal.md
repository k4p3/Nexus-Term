# Propuesta: Biblioteca de Snippets Comunitarios por Defecto y Gestión de Estado

## 1. Resumen Ejecutivo
NexusTerm cuenta actualmente con un sistema de snippets que permite al usuario crear y parametrizar comandos reutilizables (`{{variable}}`). Sin embargo, una instalación limpia comienza con la biblioteca completamente vacía, perdiendo la oportunidad de ofrecer valor inmediato.

Esta propuesta introduce una **biblioteca curada de snippets comunitarios por defecto** que abarca las tareas más comunes de administración de servidores, DevOps y soporte técnico (Docker, monitoreo de sistema, redes, análisis de logs y Systemd). Además, incorpora la capacidad de **habilitar o deshabilitar** cualquier snippet (especialmente los comunitarios), permitiendo que el usuario conserve una biblioteca limpia y adaptada a su flujo de trabajo sin perder los comandos originales.

---

## 2. Motivación y Contexto
- **Valor Inmediato para el Usuario**: Al conectar a un servidor SSH por primera vez, el usuario puede ejecutar inmediatamente diagnósticos de red (`ss -tulpn`), inspección de contenedores (`docker ps`, `docker logs`) o revisión de logs (`journalctl`) con un solo clic.
- **Evitar la Sobrecarga Cognitiva**: No todos los usuarios utilizan Docker o Systemd. Proveer un control de activación (`is_enabled`) permite al usuario apagar snippets que no le resulten útiles sin tener que eliminarlos irreversiblemente.
- **Distinción Visual**: Separar claramente los snippets integrados (*Built-in / Comunidad*) de los snippets creados por el usuario (*Custom*).

---

## 3. Alcance del Cambio

### Dentro de Alcance (In Scope)
- **Extensión de Modelo y Esquema SQLite**:
  - Migración en la tabla `snippets` añadiendo `is_builtin INTEGER NOT NULL DEFAULT 0` e `is_enabled INTEGER NOT NULL DEFAULT 1`.
  - Mecanismo de siembra (*seeding*) de snippets comunitarios en la primera inicialización o migración de la base de datos sin sobrescribir personalizaciones del usuario.
- **Colección Curada de Snippets Comunitarios**:
  - **Docker**: Logs interactivos, ejecución de shell interactiva, inspección de puertos, formateo de procesos y prune de recursos.
  - **Monitoreo & Logs**: Lectura de `journalctl`, uso de RAM (`free -h`), particiones de disco (`df -hT`) y mensajes del kernel (`dmesg`).
  - **Redes & Puertos**: Puertos escuchando (`ss -tulpn`), resumen de IPs (`ip -br -c a`), estado de firewall (`ufw`) y sondeo HTTP (`curl -I`).
  - **Almacenamiento & Servicios**: Búsqueda de archivos pesados con `find`, control de servicios `systemctl` (status, restart).
- **Frontend y UX del SnippetDrawer**:
  - Interruptor (*Toggle switch*) para activar/desactivar snippets directamente en la lista.
  - Filtros por categoría: *"Todos"*, *"Comunidad"* e *"Insertados por Mí"*.
  - Ocultamiento por defecto de snippets deshabilitados, con opción de *"Mostrar deshabilitados"*.
  - Badge distintivo "Comunidad" / "Built-in" en las tarjetas de snippets.
  - Acción de clonar/duplicar un snippet comunitario para personalizarlo.

### Fuera de Alcance (Out of Scope)
- Descarga dinámica de snippets desde un servidor remoto en la nube (todo funciona 100% offline y local en SQLite).

---

## 4. Capacidades Afectadas
- **`command-snippets`**: Modificación de la especificación existente para incluir las colecciones por defecto y el flag de activación/desactivación.

---

## 5. Cumplimiento de Licencias FOSS (GNU GPLv3)
Todos los comandos y plantillas de snippets propuestos son comandos estándar POSIX / Linux / Docker / Systemd de dominio público. No se utiliza ninguna biblioteca externa privativa.
