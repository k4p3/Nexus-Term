# Tasks: Acceso Gráfico VNC y RDP

## 1. Spike y Dependencias
- [x] 1.1 Añadir `ironrdp*`, `vnc-rs` y `tokio-rustls` a `Cargo.toml`; ejecutar `cargo license`/`cargo deny check licenses` y documentar el árbol transitivo en `design.md`.
- [ ] 1.2 Spike: conectar a un VNC (x11vnc) y un RDP (xrdp/Windows) de prueba, medir latencia de render y tamaño del binario; ajustar decisiones del diseño. _(Pendiente: requiere servidores reales; se cubrirá en 5.3. Entretanto VNC se valida con un servidor RFB simulado.)_

## 2. Backend Rust y Persistencia
- [x] 2.1 Migración SQLite: `hosts.protocol`, `hosts.rdp_domain` y tabla `rdp_cert_fingerprints`.
- [x] 2.2 Extender `HostSummary`/`SaveHostPayload` con `protocol` y `rdp_domain`, con validación y puertos por defecto.
- [x] 2.3 Pruebas unitarias de migración, validación de protocolo y fingerprints en `vault/inventory.rs`.
- [x] 2.4 Crear `remote_desktop/transport.rs` reutilizando `ChannelStream` de jump hosts (TCP directo o `direct-tcpip`).
- [x] 2.5 Implementar `frame.rs` (formato binario, coalescencia de rects, límites) con pruebas.
- [x] 2.6 Implementar `vnc.rs` (handshake, auth, codificaciones, input, portapapeles).
- [x] 2.7 Implementar `rdp.rs`: NLA/CredSSP, TOFU de certificado (aviso antes de enviar credenciales), vídeo, teclado, ratón y Ctrl+Alt+Supr. _(Verificado solo por compilación y pruebas unitarias; falta probar contra un servidor real, ver 5.3.)_
- [ ] 2.7b Completar `rdp.rs`: portapapeles de texto (CLIPRDR) y redimensionado dinámico (Display Control con reactivación de sesión). _(Pendiente: requiere un servidor RDP real para validarse.)_
- [x] 2.8 Implementar `RemoteDesktopManager` y comandos `rd_*` con `Zeroizing` para credenciales; registrarlos en `lib.rs`.
- [x] 2.9 Pruebas con servidores simulados (`tokio::io::duplex`) para handshake, errores de auth y desconexión. _(Cubierto para VNC con un servidor RFB simulado; RDP solo con pruebas unitarias de TOFU, configuración y entrada.)_

## 3. IPC, Store y Servicios
- [x] 3.1 Espejar tipos en `src/types/` (`protocol`, `InputEvent`, estados de sesión).
- [x] 3.2 Crear `remote-desktop.service.ts` y `remote-desktop.store.ts`; extender `sessions.store.ts` con `kind`.
- [x] 3.3 Implementar `src/utils/keymap.ts` y el decodificador de frames con pruebas Vitest.
- [x] 3.4 Pruebas Vitest del store (conexión, errores, reconexión, cierre).

## 4. Componentes Vue
- [x] 4.1 `HostModal.vue`: selector de protocolo, dominio RDP y ocultar opciones SSH-only.
- [x] 4.2 Badges por protocolo en `HostTreeSidebar.vue` y `QuickConnectModal.vue`.
- [x] 4.3 `RemoteDesktopPane.vue` (canvas, foco, escalado, cursor remoto) y `RemoteToolbar.vue` (Ctrl+Alt+Supr, pantalla completa, desconectar).
- [x] 4.4 `CertPromptModal.vue` para aceptar certificados RDP y overlay de desconexión/reconexión.
- [x] 4.5 Ajuste de Settings: conmutador de portapapeles y aviso de VNC sin cifrar.

## 5. Verificación
- [x] 5.1 `cd src-tauri && cargo test` y `cargo clippy` sin warnings.
- [x] 5.2 `pnpm test`, `vue-tsc --noEmit` y `vite build` sin errores.
- [ ] 5.3 Prueba manual: RDP a Windows/xrdp, VNC directo y VNC vía Jump Host en Linux.
- [ ] 5.4 `openspec validate` y compilación `tauri build`. _(`openspec validate` y `vite build` correctos; `tauri build` no ejecutado aún.)_
