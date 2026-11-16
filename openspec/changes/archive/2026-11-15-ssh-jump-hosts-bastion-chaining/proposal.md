# Propuesta: Soporte de Servidores de Salto (Jump Hosts / Bastion Chaining)

## 1. Resumen Ejecutivo
En infraestructuras de nube y centros de datos empresariales (AWS VPCs, Google Cloud, Azure, servidores dedicados), los servidores de base de datos y producción no están expuestos a la internet pública; se encuentran en subredes privadas accesibles únicamente a través de un **servidor de salto o Bastión (*Jump Host / Bastion Host*)**.

Esta propuesta dota a NexusTerm de soporte nativo para **Jump Hosts encadenados (*ProxyJump*)**, permitiendo conectar a servidores privados a través de uno o múltiples servidores intermedios de forma transparente mediante canales `direct-tcpip` sobre SSH, manteniendo la multiplexación completa de PTY, SFTP, telemetría y túneles de puertos.

---

## 2. Motivación y Contexto
- **Requisito Indispensable en Entornos Corporativos y Cloud**: Los administradores de sistemas y desarrolladores no pueden conectarse directamente por IP pública a servidores internos. En OpenSSH se utiliza habitualmente la directiva `ProxyJump bastion.example.com`. NexusTerm debe ofrecer esta funcionalidad de manera visual y nativa.
- **Transparencia Operativa**: Una vez configurado el host de salto, la experiencia debe ser idéntica a una conexión directa: xterm.js interactivo, explorador SFTP y monitor de recursos deben funcionar fluidamente a través del túnel sin requerir configuraciones de red complejas ni scripts externos.
- **Seguridad Cero-Conocimiento**: Las credenciales del Jump Host y las credenciales del servidor destino se gestionan de forma independiente y aislada en la bóveda cifrada.

---

## 3. Alcance del Cambio

### Dentro de Alcance (In Scope)
- **Persistencia en Bóveda SQLite (`src-tauri/src/vault/`)**:
  - Migración en la tabla `hosts` añadiendo `jump_host_id TEXT REFERENCES hosts(id) ON DELETE SET NULL`.
  - Validación de ciclos en Rust (impedir que Host A salte a Host B y Host B salte a Host A).
- **Motor SSH y Canales `direct-tcpip` (`src-tauri/src/session.rs` / `ssh/`)**:
  - Orquestación de conexión en dos fases:
    1. Conectar y autenticar contra el Jump Host en memoria.
    2. Abrir un canal `direct-tcpip` hacia la dirección y puerto del servidor destino.
    3. Establecer el protocolo SSH secundario sobre el stream del canal previo.
  - Soporte de encadenamiento recursivo (A -> B -> Destino).
- **Frontend y UX (`src/components/hosts/`)**:
  - Selector de "Servidor de Salto (Opcional)" en `HostModal.vue`, con exclusión automática del propio host para evitar autorreferencias.
  - Indicador visual / insignia (*Badge*) de "Vía Bastión" en el árbol lateral (`HostTreeSidebar.vue`) y en la paleta de búsqueda rápida (`Ctrl+K`).
  - Detección e importación automática de la directiva `ProxyJump` en el analizador de `~/.ssh/config`.

### Fuera de Alcance (Out of Scope)
- Servidores de salto que utilicen comandos arbitrarios `ProxyCommand` con binarios externos no estándar (ej. netcat o scripts de bash de terceros). Se prioriza el estándar nativo `direct-tcpip` / `ProxyJump`.

---

## 4. Capacidades Afectadas
- **`host-inventory`**: Extensión del esquema de Host y soporte de importación de `ProxyJump`.
- **`terminal-multiplexer`**: Orquestación de canales SSH encapsulados sobre streams `direct-tcpip`.
- **`jump-hosts` (Nueva capacidad / especificación modular)**: Reglas normativas de ruteo, autenticación encadenada y prevención de ciclos.

---

## 5. Cumplimiento de Licencias FOSS (GNU GPLv3)
Toda la lógica de ruteo y canales `direct-tcpip` se implementa utilizando las bibliotecas existentes de código abierto (`russh` con licencia Apache-2.0 / MIT). No se incorporan dependencias externas adicionales.
