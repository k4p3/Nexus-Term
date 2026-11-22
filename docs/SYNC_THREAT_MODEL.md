# Sincronización con servidor propio: modelo de amenazas (borrador)

Documento vivo de la línea `sync-*`. Estado: **fundamentos** (`sync-foundations`); aún no hay servidor ni red.

## Principio
El servidor es *zero-knowledge*: guarda solo sobres cifrados con una clave que **nunca** recibe. Un servidor comprometido no debe permitir leer hosts, credenciales ni snippets.

## Claves
| Elemento | Qué es | Dónde vive |
|---|---|---|
| Contraseña maestra | La del usuario | Solo en su cabeza |
| Secret Key (`NXT1-…`) | 128 bits aleatorios | Kit de emergencia (offline) y equipos enlazados |
| Clave de recuperación (`NXR1-…`) | 256 bits, **opcional** | Kit de emergencia (offline) |
| Clave de la bóveda | Cifra los registros | Envuelta en el paquete de clave; nunca en claro en el servidor |
| Clave de autenticación | Derivada de contraseña + Secret Key | Solo su hash en el servidor |

El paquete de clave guarda la clave de la bóveda envuelta de forma independiente con (a) contraseña + Secret Key y (b) la clave de recuperación, más los parámetros del KDF.

## Qué ve un servidor comprometido
- **Sí**: nombre de usuario de la cuenta, nº de registros, `kind`, `id`, `rev`, fechas, tamaños de los blobs, patrones de acceso, direcciones IP y dispositivos.
- **No**: hostnames, usuarios, credenciales, notas, snippets, nombres de carpetas ni la clave de la bóveda.
- **Integridad**: el AAD liga cada blob a `kind|id|rev|deleted`; el servidor no puede cambiar de sitio, reordenar a otra revisión ni convertir un registro en borrado sin que falle la apertura. Sí puede **retener o descartar** cambios (denegación de servicio) o devolver un estado antiguo (*rollback*); la detección de *rollback* se estudia en `sync-hardening-docs`.

## Ataques fuera de línea
Sin la Secret Key, el paquete de clave no permite fuerza bruta sobre la contraseña maestra (la AUK mezcla ambas). Con la contraseña débil **y** la Secret Key robada, sí. La clave de recuperación tiene 256 bits de entropía y se protege como una llave maestra.

## Pérdida de acceso
| Situación | Resultado |
|---|---|
| Olvidas la contraseña, hay un equipo ya abierto | Se cambia la contraseña desde ese equipo |
| Olvidas la contraseña y tienes la clave de recuperación | Se fija una contraseña nueva sin perder datos |
| Pierdes la Secret Key, hay un equipo enlazado | Ese equipo puede regenerarla |
| Pierdes contraseña y Secret Key, sin clave de recuperación ni equipos abiertos | **Irrecuperable** (el administrador solo puede borrar la cuenta) |

## Kit de emergencia
Contiene URL, cuenta, Secret Key y, si existe, la clave de recuperación. **Nunca** la contraseña maestra ni la clave de la bóveda. Quien tenga el kit y la contraseña puede acceder a la cuenta: debe custodiarse sin conexión.

## Riesgos pendientes
- Detección de *rollback* y de bifurcación de historial por un servidor malicioso.
- Firma del paquete de clave frente a sustitución por el servidor.
- Limitación de intentos de autenticación y revocación de dispositivos (`sync-server`).
