# Lista de Pruebas Manuales

Marca cada casilla al probarla. Arranca con `pnpm tauri dev`, desbloquea la bóveda y ten a mano una sesión SSH y una terminal local.

Cambios cubiertos: `terminal-productivity-quick-wins` (sección A), `vnc-rdp-graphical-access` (sección B, tarea 5.3) y `terminal-productivity-advanced` (sección D, tarea 9.3).

---

## A. Terminal (`terminal-productivity-quick-wins`)

### Atajos y hoja de atajos
- [ ] `Ctrl+Shift+/` abre la hoja de atajos con todos agrupados; `Escape` la cierra.
- [ ] Siguen funcionando: `Ctrl+K`, `Ctrl+B`, `Ctrl+,`, `Ctrl+F`, `Ctrl+Shift+O/D/E/W/B/↑/↓`.
- [ ] `Ctrl+Shift+O` divide **una sola vez** (antes podía ejecutarse dos veces).
- [ ] `Ctrl+Shift+B` activa/desactiva Broadcast **una sola vez**.
- [ ] En `vim` o `nano`, `Ctrl+R`, `Ctrl+W` y `Ctrl+K` siguen llegando al programa cuando no son atajos de la app.

### Quick Select (`Ctrl+Shift+Space`)
- [ ] Con `ls -l /etc`, `git log --oneline` e `ip a` en pantalla se resaltan rutas, hashes e IPs con etiquetas.
- [ ] Etiqueta en **minúscula**: copia y muestra aviso; pégalo en otro sitio para comprobarlo.
- [ ] Etiqueta en **mayúscula**: pega en el prompt **sin ejecutar**.
- [ ] `Escape` cancela y no escribe nada en el shell.
- [ ] Con pantalla vacía aparece "Nada que seleccionar".
- [ ] Con más de 26 coincidencias, las etiquetas son de dos letras.

### Paleta de comandos (`Ctrl+Shift+P`)
- [ ] Escribir "div" filtra "Dividir…"; `↑`/`↓`/`Enter` funcionan; `Escape` cierra.
- [ ] Cada acción muestra su atajo.
- [ ] Cambiar de tema desde la paleta se aplica al instante.
- [ ] Un snippet sin parámetros se ejecuta; uno con `{{parámetros}}` abre su formulario.
- [ ] En un panel RDP/VNC no aparecen acciones de terminal.

### Enlaces inteligentes (`Ctrl`+clic)
- [ ] `echo "ver src/main.rs:10:5 y 10.0.0.5"`: un clic normal solo selecciona texto.
- [ ] `Ctrl`+clic en la ruta, en SSH: menú "Copiar ruta" y "Mostrar en SFTP" (abre el directorio correcto).
- [ ] `Ctrl`+clic en la ruta, en local: solo "Copiar ruta".
- [ ] `Ctrl`+clic en la IP: "Conectar por SSH" abre Conexión Rápida con la IP rellenada.
- [ ] `echo 999.1.1.1 1.2.3.4.5 12:34:56` **no** crea enlaces.
- [ ] Las URLs `https://…` se siguen abriendo con un clic.

### Pegado seguro (`Ctrl+Shift+V`)
- [ ] Una línea simple: se pega sin diálogo.
- [ ] Dos líneas: diálogo con vista previa y foco en "Cancelar".
- [ ] "Pegar como una línea" une las líneas con espacios.
- [ ] `sudo rm -rf /tmp/x`: el fragmento peligroso sale resaltado.
- [ ] `curl https://x.sh | sh`: aviso de comando peligroso.
- [ ] Texto con salto de línea final (p. ej. `ls` + Enter): pide confirmación.
- [ ] Carácter de ancho cero: se muestra como `⟦200B⟧` y avisa.
- [ ] Con el aviso desactivado en Ajustes, ya no interrumpe.
- [ ] El clic derecho "Pegar" pasa por las mismas comprobaciones.

### Historial de pegado (`Ctrl+Alt+V`)
- [ ] Lista lo pegado, lo más reciente primero y sin duplicados.
- [ ] Re-pegar una entrada multilínea vuelve a pedir confirmación.
- [ ] Una clave privada pegada aparece enmascarada.
- [ ] **Bloquear y desbloquear la bóveda deja el historial vacío.**
- [ ] Cambiar el tamaño en Ajustes (p. ej. a 3) respeta el límite.

### Notificaciones de comandos largos (requiere que tu shell emita OSC 133)
- [ ] `sleep 12` y cambiar a otra aplicación: notificación de escritorio con ✓, host y duración.
- [ ] Un comando largo que falle muestra ✗.
- [ ] Al volver a NexusTerm se activa el panel que originó el aviso.
- [ ] Ventana enfocada pero en **otra pestaña**: aviso interno con botón "Ir".
- [ ] Panel visible y enfocado: no avisa.
- [ ] `sleep 3`: no avisa; cambiar el umbral en Ajustes y comprobar.
- [ ] El aviso **no** muestra el texto del comando.
- [ ] Con "Notificar" desactivado en Ajustes no hay avisos de ningún tipo.

### Ajustes e idioma
- [ ] Las opciones nuevas se guardan y persisten tras reiniciar.
- [ ] En inglés, los textos nuevos están traducidos.

---

## B. Escritorio remoto (`vnc-rdp-graphical-access`, tarea 5.3)

> El portapapeles de texto de RDP y el redimensionado dinámico de RDP **no están implementados todavía** (tarea 2.7b); no los pruebes aún.

### VNC
- [ ] VNC directo a un servidor real: se ve el escritorio; teclado, ratón y rueda responden.
- [ ] VNC por Jump Host: conecta aunque el VNC no sea accesible directamente.
- [ ] VNC sin bastión: aparece el aviso de que viaja sin cifrar.
- [ ] Contraseña incorrecta: error claro y botón "Reconectar".
- [ ] Portapapeles de texto en ambos sentidos; con el ajuste desactivado no pasa nada.
- [ ] Cerrar el servidor con la sesión abierta: aparece "Sesión desconectada".

### RDP
- [ ] Conexión a Windows/xrdp: aparece el diálogo del certificado con la huella.
- [ ] Rechazar el certificado: no se envían credenciales.
- [ ] Aceptarlo: conecta, y la siguiente conexión ya no pregunta.
- [ ] Certificado cambiado en el servidor: avisa "¡El certificado ha cambiado!".
- [ ] `Ctrl+Alt+Supr`, pantalla completa y escalado "ajustar/real".

### Inventario
- [ ] Crear hosts RDP y VNC: el puerto por defecto cambia (3389 / 5900) y se ven sus badges en el árbol y en `Ctrl+K`.
- [ ] Un host SSH existente sigue conectando como antes (migración).

---

## D. Productividad avanzada (`terminal-productivity-advanced`, tarea 9.3)

### Bloques de comandos (requiere integración de shell OSC 133)
- [ ] Tras cada comando aparece **✓** (verde) o **✗** (rojo) con la duración en el margen derecho de la línea del prompt; un `false` muestra ✗ y su código.
- [ ] Clic en la marca selecciona el bloque (se resalta); otro clic lo deselecciona.
- [ ] Copiar salida (botón de la barra) copia **solo** la salida del bloque seleccionado, no el prompt ni el siguiente.
- [ ] `Ctrl+F` con un bloque seleccionado busca **solo dentro** de él (las coincidencias de fuera no se resaltan).
- [ ] `Ctrl+Shift+R` repite el comando del bloque seleccionado (o del último); con `rm -rf /tmp/x` o `sudo …` pide confirmación antes de ejecutar.
- [ ] **Scrollback**: genera >10 000 líneas (`seq 1 20000`) y ejecuta varios comandos; los ✓/✗ de los comandos recientes siguen en su línea y los bloques ya descartados desaparecen sin errores en consola.
- [ ] En un shell **sin** OSC 133 no aparecen marcas ni botones de bloque y la terminal funciona como antes.

### Historial de comandos por host (`Ctrl+Shift+H`)
- [ ] Ejecuta `ls -la`, `uptime` y `echo hola`; `Ctrl+Shift+H` los lista (más recientes primero) junto con los snippets.
- [ ] Repetir `uptime` no lo duplica: aparece con `×2`.
- [ ] `Enter` inserta el comando **sin ejecutarlo**; `Ctrl+Enter` lo ejecuta; un comando peligroso pide confirmación.
- [ ] La búsqueda difusa (`upt`) ordena bien; escribir `echo` filtra.
- [ ] **No se registra**: ` echo oculto` (con espacio inicial), `mysql --password=x`, `export API_KEY=1`.
- [ ] **Entre sesiones**: cierra la app, ábrela, desbloquea y comprueba que el historial del host sigue; el de otro host no se mezcla; los shells locales tienen su propio historial.
- [ ] Ajustes → desactivar el historial: los comandos nuevos ya no se guardan.
- [ ] Ajustes → "Borrar este host" y "Borrar todo el historial" piden confirmación y vacían el selector.
- [ ] Borrar un host del inventario elimina su historial.
- [ ] Bloquear la bóveda y desbloquearla: el selector vuelve a cargar el historial (no queda caché visible bloqueada).
- [ ] (Opcional) `strings ~/.local/share/dev.nexusterm.app/vault.db | grep "uptime"` **no** encuentra los comandos en claro.

### Instant Replay (`Ctrl+Shift+Y`)
- [ ] Ejecuta `seq 1 40`, luego `clear`, y abre Instant Replay: moviendo la línea de tiempo hacia atrás se ve la salida anterior al `clear`.
- [ ] Los botones −5s / +5s / "Último" y las flechas funcionan; `Escape` cierra.
- [ ] El visor es de solo lectura: escribir en él no envía nada a la sesión, y la terminal real sigue recibiendo salida mientras está abierto.
- [ ] Ajustes → desactivar Instant Replay: `Ctrl+Shift+Y` avisa de que está desactivado y no se retiene salida.
- [ ] Cerrar el panel o bloquear la bóveda descarta el contenido (al reabrir en otro panel aparece vacío).

### Restauración de sesiones
- [ ] Abre 3 pestañas (SSH, shell local y un panel dividido) y espera ~1 s; cierra la app, ábrela y desbloquea: aparece el diálogo "Restaurar (3 pestañas)".
- [ ] **Restaurar** recrea pestañas y divisiones; solo la pestaña activa conecta al instante y las demás conectan **al abrirlas por primera vez**.
- [ ] **Empezar vacío** no restaura y, al abrir pestañas nuevas, el layout se guarda de nuevo.
- [ ] Modo *Siempre*: restaura sin preguntar. Modo *Nunca*: no pregunta ni restaura, y no guarda nada.
- [ ] Borra de la bóveda un host usado en una pestaña guardada: al restaurar se omite ese panel y aparece el aviso.
- [ ] Con hosts **RDP** y **VNC** en el layout: se restauran como paneles de escritorio remoto que conectan al activarse.
- [ ] Bloquear y desbloquear sin cerrar la app **no** vuelve a mostrar el diálogo.
- [ ] Cerrar todas las pestañas y reiniciar: no se ofrece restaurar nada.

### Compatibilidad de terminal
- [ ] **Unicode 11**: `echo "😀 漢字 ✓"` alinea el cursor y no descuadra el ajuste de línea.
- [ ] **OSC 52**: en `tmux` (con `set -g set-clipboard on`) o `vim` remoto, copiar una selección la pone en el portapapeles local y muestra el aviso.
- [ ] **OSC 52 solo escritura**: `printf '\033]52;c;?\a'` no devuelve el contenido del portapapeles al shell.
- [ ] Ajustes → desactivar OSC 52: la copia remota se ignora.
- [ ] **Imágenes**: con `img2sixel`, `chafa -f sixel` o `timg`, la imagen se dibuja en el cursor; con la opción desactivada no.
- [ ] **Ligaduras**: con JetBrains Mono (o Fira Code) instalada como primera fuente, activar la opción y ejecutar `echo "=== => <= <-> www"` muestra ligaduras; el aviso de Ajustes muestra ✓.
- [ ] Con `Hack` como primera fuente, el aviso de Ajustes muestra ⚠; con una fuente inexistente, nombra la que falta.
- [ ] Desactivar las ligaduras vuelve a WebGL y la terminal sigue funcionando (sin parpadeos ni redimensionado raro).
- [ ] Consola de desarrollo sin errores rojos al activar/desactivar las ligaduras (un `console.error` suelto del addon es aceptable).

---

## C. Antes de archivar los cambios
- [ ] `pnpm tauri build` compila.
- [ ] `cd src-tauri && cargo test` y `pnpm test` en verde.
- [ ] Cerrar las tareas pendientes de `openspec/changes/*/tasks.md` (1.2, 2.7b, 5.3, 5.4 de VNC/RDP; 6.3 de quick-wins; 9.3 de productividad avanzada).
