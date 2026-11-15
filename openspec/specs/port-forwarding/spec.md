# port-forwarding Specification

## Purpose
Permite a los usuarios definir, persistir y ejecutar túneles SSH de reenvío de puertos (Local -L, Remoto -R y Dinámico SOCKS5 -D) sobre multiplexación segura de canales con control de ciclo de vida y métricas de tráfico.

## Requirements

### Requirement: Configuración persistente de túneles SSH
The system SHALL allow users to create, list, update and delete SSH port forwarding tunnel configurations associated with inventory hosts. Each tunnel configuration MUST record an identifier, associated host_id, descriptive label, tunnel type (local, remote, dynamic), bind address, local port, and destination host and port for local/remote types.

#### Scenario: Crear y listar regla de túnel local
- **WHEN** el usuario crea una regla de túnel local con nombre "Postgres Prod", puerto local 5433 y destino `127.0.0.1:5432` sobre un host de la bóveda
- **THEN** el sistema guarda la regla de forma persistente en la base de datos de la bóveda y la lista con su estado inicial inactivo

#### Scenario: Eliminar regla de túnel existente
- **WHEN** el usuario solicita la eliminación de una regla de túnel inactiva
- **THEN** el sistema remueve el registro de la bóveda y actualiza la lista visual inmediatamente

### Requirement: Reenvío de puertos local (-L)
The system SHALL bind a local TCP socket on the configured local address and port, and for each accepted incoming TCP connection, open an SSH `direct-tcpip` channel toward the target remote host and port, bidirectionally piping payload data.

#### Scenario: Conexión entrante reenviada con éxito
- **WHEN** un cliente local se conecta al puerto local configurado mientras el túnel está activo
- **THEN** el sistema abre un canal `direct-tcpip` en la sesión SSH del host y retransmite datos bidireccionalmente entre el socket local y el servicio remoto

#### Scenario: Puerto local no disponible
- **WHEN** el usuario intenta iniciar un túnel local pero el puerto local ya se encuentra ocupado por otra aplicación
- **THEN** el sistema marca el túnel en estado de error e informa un mensaje claro indicando que el puerto local no pudo enlazarse

### Requirement: Reenvío de puertos remoto (-R)
The system SHALL request the remote SSH server to listen on the specified remote address and port, and route incoming connections from the remote server back to the designated local service destination.

#### Scenario: Solicitud de reenvío remoto aceptada por el servidor
- **WHEN** el usuario inicia un túnel remoto con puerto remoto 8080 y destino local `127.0.0.1:3000`
- **THEN** el sistema envía una solicitud de reenvío `tcpip_forward` al servidor SSH y enruta las conexiones entrantes hacia el puerto local 3000

#### Scenario: Servidor remoto rechaza el puerto solicitado
- **WHEN** el servidor SSH remoto rechaza la solicitud de enlace del puerto remoto especificado
- **THEN** el sistema detiene el intento de inicio del túnel y notifica al usuario el rechazo del servidor remoto

### Requirement: Proxy dinámico SOCKS5 (-D)
The system SHALL provide a local SOCKS5 proxy server without authentication conforming to RFC 1928, accepting client connection requests and routing TCP `CONNECT` commands through dynamic SSH `direct-tcpip` channels to destination addresses.

#### Scenario: Enrutamiento dinámico de tráfico web por SOCKS5
- **WHEN** una aplicación local configurada con el proxy SOCKS5 solicita conectar a un host y puerto remoto
- **THEN** el sistema realiza el protocolo de enlace SOCKS5, abre un canal `direct-tcpip` hacia el destino y canaliza el flujo de bytes de manera transparente

#### Scenario: Destino inalcanzable reportado al cliente SOCKS5
- **WHEN** la aplicación cliente solicita conectar a un destino que la máquina SSH remota no puede alcanzar
- **THEN** el proxy SOCKS5 responde con un código de error de fallo de conexión según el estándar RFC 1928 y cierra la conexión

### Requirement: Ciclo de vida y telemetría de túneles
The system SHALL track the runtime state (active, stopped, error) and real-time network telemetry (bytes sent, bytes received, active connection count) for each configured tunnel, allowing starting and stopping each tunnel independently without terminating terminal sessions.

#### Scenario: Inicio y parada manual de túnel
- **WHEN** el usuario hace clic en el interruptor para activar un túnel inactivo
- **THEN** el sistema inicia el listener en segundo plano, actualiza el estado a activo e incrementa los contadores de bytes al circular tráfico, deteniéndolo limpiamente al pulsar detener

#### Scenario: Cierre ordenado por desconexión del host
- **WHEN** la conexión SSH subyacente con el servidor remoto se interrumpe o finaliza
- **THEN** todos los túneles activos dependientes de dicho host se detienen ordenadamente y notifican su cambio de estado
