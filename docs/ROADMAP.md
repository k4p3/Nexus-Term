# Hoja de Ruta de NexusTerm (Ideas Tentativas)

> **Importante**: esta página recoge ideas **tentativas**. No son compromisos ni tienen fecha. Cada una requeriría una propuesta de OpenSpec (`/opsx-propose`) aprobada antes de implementarse, y cumplir la política de pruebas y licencias del proyecto (GPLv3).

## En planificación (OpenSpec)
- `terminal-productivity-quick-wins`: Quick Select, paleta de comandos, enlaces inteligentes, pegado seguro, notificación de comandos largos y registro de atajos.
- `terminal-productivity-advanced`: bloques de comandos, historial por host, Instant Replay, restauración de sesiones y addons de xterm (implementado; pendiente de verificación manual y archivo).
- `vnc-rdp-graphical-access`: acceso a escritorios remotos RDP/VNC (en implementación).

## Ideas tentativas

### Sugerencias con IA para el terminal
Explicar el error de un comando fallido (bloque OSC 133), proponer correcciones o traducir lenguaje natural a comandos (como Warp).
- **Cuestiones abiertas**: proveedor (local con Ollama frente a servicios remotos), privacidad (nunca enviar credenciales ni salida sin consentimiento explícito), coste y modo sin conexión.
- **Dependencias**: requiere los bloques de comandos de `terminal-productivity-advanced`.

### Multiplexado persistente de sesiones remotas
Adjuntar automáticamente a `tmux`/`screen` en el host remoto y reconectar tras cortes de red sin perder el estado (similar a los *domains* de WezTerm o a Mosh).
- **Cuestiones abiertas**: detección y requisitos en el servidor, interacción con broadcast y *splits*, y alternativa nativa sin software remoto.

### Triggers (reglas sobre la salida)
Reglas por perfil de host que detectan texto (regex) y resaltan, notifican o lanzan acciones (como los *triggers* de iTerm2).
- **Cuestiones abiertas**: seguridad (una regla no debe poder ejecutar comandos a partir de salida remota no confiable), rendimiento y editor de reglas.

### Colapsar salidas de bloques
Plegar la salida de un comando largo como en Warp.
- **Limitación técnica**: xterm.js no permite ocultar líneas del búfer; requeriría un renderizador propio o migrar de motor. No viable a corto plazo.

### Otras ideas
- Atajos reconfigurables por el usuario (el registro único de `terminal-productivity-quick-wins` es la base).
- Abrir archivos locales con la aplicación del sistema desde los enlaces de ruta.
- *Autosuggest* en línea tipo Fish, usando el historial por host.
- Sincronización del historial y los layouts mediante BYOC.
- Redirección de archivos y portapapeles de archivos en RDP.
