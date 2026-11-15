# Proposal: Gestor de Túneles SSH y Port Forwarding

## Why

Los administradores de sistemas y desarrolladores requieren acceder con frecuencia a bases de datos internas (PostgreSQL, MySQL, Redis), dashboards web de infraestructura (Kubernetes, Grafana) o exponer servicios de prueba locales sin abrir puertos en firewalls perimetrales. Actualmente NexusTerm permite abrir sesiones interactivas de terminal y gestionar identidades, pero carece de un gestor de túneles y reenvío de puertos SSH visual y multiplexado.

Implementar un gestor nativo de Port Forwarding (Local `-L`, Remoto `-R` y Dinámico SOCKS5 `-D`) integrado con la bóveda cifrada y el motor de multiplexación de `russh` permite a los usuarios configurar, encender y monitorear túneles con un solo clic, sin recurrir a comandos complejos de terminal o utilidades externas.

## What Changes

- **Persistencia de Túneles en la Bóveda**:
  - Creación de la tabla `ssh_tunnels` en SQLite dentro de `src-tauri/src/vault/db.rs` para almacenar de forma persistente configuraciones de túneles vinculadas a servidores del inventario (`host_id`).
- **Motor de Túneles Multiplexados en Rust**:
  - **Local Port Forwarding (`-L`)**: Abre un `TcpListener` local en `bind_address:local_port` y reenvía cada conexión entrante mediante un canal SSH `direct-tcpip` hacia `remote_host:remote_port`.
  - **Remote Port Forwarding (`-R`)**: Solicita al servidor remoto `tcpip_forward` en `remote_port` y reenvía el tráfico recibido hacia el servicio local `target_host:local_port`.
  - **Dynamic Port Forwarding SOCKS5 (`-D`)**: Implementa un servidor proxy SOCKS5 local sin autenticación (RFC 1928) que resuelve y enruta peticiones `CONNECT` a través de canales `direct-tcpip` de SSH.
  - Supervisión de ciclo de vida: inicio, detención, recuento de bytes transferidos/recibidos y estado de escucha.
- **Frontend y Experiencia de Usuario**:
  - Nuevo store Pinia `src/stores/tunnels.store.ts` para sincronizar la lista de túneles, sus estados (`active`, `stopped`, `error`) y métricas de tráfico.
  - Componente de gestión `src/components/tunnels/PortForwardManager.vue` con lista de reglas, badges de protocolo (`Local`, `Remote`, `Dynamic`), botón toggle rápido (start/stop) y estadísticas en vivo.
  - Modal interactivo `src/components/tunnels/TunnelModal.vue` para crear y editar reglas con validación de puertos.
  - Integración en la navegación principal o barra lateral de herramientas de NexusTerm.
- **Pruebas Automatizadas**:
  - Pruebas unitarias en Rust para la persistencia, validación de configuraciones de túneles y protocolo SOCKS5 handshake.
  - Pruebas unitarias en TypeScript para el store de túneles y validaciones de red.

## Capabilities

### New Capabilities
- `port-forwarding`: Gestión, configuración persistente, ciclo de vida (start/stop) y métricas de túneles de puertos SSH (Local -L, Remoto -R y Dinámico SOCKS5 -D) sobre multiplexación `russh`.

### Modified Capabilities
<!-- Ninguna capacidad previa cambia sus requerimientos normativos -->

## Impact

- **Backend (Rust)**:
  - Migración SQLite en `src-tauri/src/vault/db.rs` añadiendo la tabla `ssh_tunnels`.
  - Nuevo módulo `src-tauri/src/tunnels/` (`mod.rs`, `models.rs`, `manager.rs`, `socks5.rs`, `commands.rs`).
  - Registro de comandos Tauri IPC en `src-tauri/src/lib.rs`.
- **Frontend (Vue 3 / TypeScript)**:
  - Nuevo store `src/stores/tunnels.store.ts`.
  - Interfaces TypeScript `src/types/tunnels.ts`.
  - Servicio IPC `src/services/tunnels.service.ts`.
  - Componentes `src/components/tunnels/PortForwardManager.vue` y `TunnelModal.vue`.
- **Dependencias**:
  - Cero dependencias externas adicionales. Uso exclusivo de la biblioteca estándar de Rust, `tokio::net`, `russh` y crates ya existentes. 100% conforme con la licencia GNU GPLv3.
