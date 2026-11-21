# Propuesta: Desbloqueo Perezoso de la Bóveda (arranque con terminal local)

## 1. Resumen Ejecutivo
La aplicación deja de exigir la contraseña maestra al abrirse: arranca directamente con una **terminal local** y solicita el desbloqueo de la bóveda **solo cuando el usuario interactúa con algo que usa credenciales almacenadas** (hosts, identidades, conexiones SSH/SFTP/RDP/VNC). Se añade auto-bloqueo por inactividad configurable y se mantiene como opción el comportamiento actual ("pedir contraseña al iniciar").

## 2. Motivación y Contexto
- Hoy `App.vue` bloquea todo el workspace tras `VaultUnlockScreen`; no hay terminal hasta desbloquear, aunque `open_local_pty` y los ajustes no necesitan la clave.
- Quien usa NexusTerm como terminal local diaria debe teclear la contraseña maestra sin necesitarla.
- `lock()` destruye hoy todas las sesiones al desmontar el workspace; no hay auto-bloqueo por inactividad.

## 3. Alcance del Cambio

### Dentro de Alcance (In Scope)
- Arranque sin compuerta de bóveda: workspace siempre montado, pestaña local inicial (respetando `default_shell`).
- Modal de desbloqueo/creación de bóveda bajo demanda (carga perezosa) y composable `useEnsureUnlocked()`.
- Estado "bloqueada" y "bóveda no creada" en la barra lateral de hosts.
- Error `Locked` con código estable en el backend para que el frontend lo distinga y reintente tras desbloquear.
- Bloqueo (manual o automático) que **conserva las sesiones abiertas** (locales y remotas) y solo impide abrir nuevas conexiones con credenciales hasta desbloquear.
- Ajustes: `ask_password_on_startup`, `auto_lock_enabled`, `auto_lock_minutes` (por defecto 10).
- Restauración de sesiones: pestañas locales sin bóveda, remotas tras desbloquear, sin pisar el layout guardado.

### Fuera de Alcance (Out of Scope)
- Gate en backend para snippets, definiciones de túneles y ajustes (no contienen credenciales).
- Cifrado de `vault.db` completo o cambios en el esquema criptográfico (Argon2id / AES-256-GCM).
- Cerrar sesiones remotas al bloquear.

## 4. Capacidades Afectadas
- `vault-security` (MODIFIED: desbloqueo y bloqueo; ADDED: desbloqueo bajo demanda, auto-bloqueo).
- `app-settings` (ADDED: ajustes de bloqueo y arranque).

## 5. Dependencias y Licencias
No se añaden crates ni paquetes npm; no hay impacto en el cumplimiento GPLv3.

## 6. Riesgos
- La clave permanece en memoria más tiempo; se mitiga con auto-bloqueo configurable.
- Cambiar la semántica de `lock()` afecta a restauración de sesiones y paneles ya abiertos.
- Crear la bóveda en medio de una acción de conexión debe quedar claro en la UI.
