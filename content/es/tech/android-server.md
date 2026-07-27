---
title: "Convierte un teléfono Android en un servidor Ubuntu remoto (sin acceso root en Android)"
date: 2026-07-25
tags: [android, termux, ubuntu, ssh, vscode, cloudflare]
category: [tecnología]
translation_id: android-server
---

Esta guía explica cómo ejecutar Ubuntu 26.04 en un teléfono Android mediante Termux y PRoot, habilitar un acceso SSH seguro y permitir el acceso remoto al servidor a través de un túnel de Cloudflare protegido por Cloudflare Access.

Esta configuración se probó en un Samsung Galaxy S8 y un Samsung Galaxy S20.

La conexión final funciona de la siguiente manera:

```text
SSH o VS Code
      │
      ▼
cloudflared en el cliente
      │
      ▼
Autenticación de Cloudflare Access
      │
      ▼
Túnel de Cloudflare
      │
      ▼
cloudflared dentro de Ubuntu
      │
      ▼
Servidor SSH en 127.0.0.1:2022
```

No necesitas abrir ningún puerto de entrada ni en el teléfono ni en el router. El túnel de Cloudflare establece una conexión saliente desde el teléfono hacia Cloudflare.

> [!WARNING] Disponibilidad
> Esta configuración resulta útil para desarrollo personal, experimentos y acceso remoto ocasional. No equivale a un servidor de producción convencional. Android puede finalizar Termux debido a sus políticas de gestión de la batería, a la presión de memoria o a actualizaciones del sistema; reiniciar el teléfono también detendrá el servidor.

## Requisitos

Antes de comenzar, asegúrate de disponer de lo siguiente:

- Un teléfono Android.
- Una cuenta de Cloudflare.
- Un dominio cuyo DNS se gestione mediante Cloudflare.
- Un ordenador desde el que conectarte.
- OpenSSH instalado en el ordenador cliente.
- Una dirección de correo electrónico autorizada por la política de Cloudflare Access.
- Acceso físico al teléfono durante la configuración inicial.
- [Termux, versión 0.118.3](https://f-droid.org/repo/com.termux_1002.apk).

A lo largo de esta guía, `ssh.example.com` representa el nombre de host que quieras utilizar y `<TUNNEL_UUID>` representa el UUID generado por Cloudflare.

Utiliza siempre el mismo nombre de host en:

- La aplicación de Cloudflare Access.
- La ruta DNS del túnel de Cloudflare.
- El archivo de configuración del túnel.
- El comando `cloudflared` del cliente.
- La configuración del cliente SSH.

## 1. Instalar Termux

Instala Termux desde una de estas fuentes:

- [F-Droid](https://f-droid.org/en/packages/com.termux/).
- Las versiones oficiales de Termux publicadas en GitHub.

F-Droid es la opción más sencilla para la mayoría de los usuarios.

No mezcles aplicaciones ni complementos de Termux instalados desde fuentes distintas. Por ejemplo, no instales Termux desde F-Droid y Termux:Boot desde GitHub, ya que los paquetes utilizan claves de firma diferentes. Actualmente, el proyecto Termux considera la versión de Google Play una compilación experimental independiente.

Después de instalarlo, abre Termux y deja que complete su configuración inicial.

## 2. Desactivar las restricciones de batería

Abre los ajustes de la aplicación Termux en Android y establece su uso de batería en **Sin restricciones** (**Unrestricted** si Android está en inglés) o exclúyela de la optimización de batería.

La ubicación exacta varía según la versión de Android y el fabricante del dispositivo. En los dispositivos Samsung suele encontrarse en:

```text
Ajustes → Aplicaciones → Termux → Batería
```

Termux recomienda desactivar la optimización de batería para los procesos de larga duración.

Vuelve a Termux y activa un bloqueo de activación (_wake lock_):

```bash
termux-wake-lock
```

Aprueba la solicitud relacionada con la optimización de batería si Android la muestra.

Un bloqueo de activación ayuda a mantener el procesador activo cuando la pantalla está apagada, pero no puede impedir que Android finalice Termux.

Para liberar el bloqueo de activación más adelante, ejecuta:

```bash
termux-wake-unlock
```

## 3. Instalar Ubuntu 26.04

Actualiza los paquetes de Termux:

```bash
pkg update
pkg upgrade -y
```

Instala `proot-distro`:

```bash
pkg install proot-distro -y
```

Instala una imagen de Ubuntu 26.04 con la versión fijada:

```bash
proot-distro install ubuntu:26.04
```

Fijar la versión de la imagen evita que el comando instale de forma inesperada una versión más reciente de Ubuntu o una versión en desarrollo. La documentación actual de `proot-distro` utiliza `ubuntu:26.04` como ejemplo para Ubuntu.

Entra en Ubuntu:

```bash
proot-distro login ubuntu
```

El indicador de la línea de comandos debería cambiar para señalar que ahora estás trabajando dentro de Ubuntu.

Los comandos restantes del servidor deben ejecutarse dentro de Ubuntu, salvo que una sección indique expresamente lo contrario.

Comprueba la versión instalada:

```bash
cat /etc/os-release
```

La salida debería indicar Ubuntu 26.04.

## 4. Instalar los paquetes de Ubuntu

Dentro de Ubuntu, actualiza la base de datos de paquetes y los paquetes instalados:

```bash
apt update
apt upgrade -y
```

Instala OpenSSH y las demás herramientas necesarias para esta guía:

```bash
apt install openssh-server nano curl ca-certificates iproute2 procps -y
```

Estos paquetes cumplen las siguientes funciones:

- `openssh-server`: proporciona el servidor SSH.
- `nano`: permite editar archivos de texto.
- `curl`: descarga la clave de firma de Cloudflare.
- `ca-certificates`: permite verificar certificados HTTPS.
- `iproute2`: proporciona el comando de red `ss`.
- `procps`: proporciona comandos de inspección de procesos como `pgrep`.

## 5. Generar una clave SSH en el cliente

La autenticación mediante clave SSH es más segura que la autenticación con contraseña para la cuenta root de Ubuntu.

Ejecuta el comando correspondiente en el ordenador que se conectará al teléfono, no dentro de Termux.

En Linux o macOS:

```bash
ssh-keygen -t ed25519 -a 64 -f ~/.ssh/android-server
```

En Windows PowerShell:

```powershell
ssh-keygen -t ed25519 -a 64 -f "$HOME\.ssh\android-server"
```

En el símbolo del sistema de Windows:

```bat
ssh-keygen -t ed25519 -a 64 -f "%USERPROFILE%\.ssh\android-server"
```

Introduce una frase de contraseña cuando se solicite. Esta protege la clave privada si el ordenador o el archivo de la clave se ven comprometidos.

El comando crea dos archivos en el directorio `.ssh`: `android-server` y `android-server.pub`.

El primer archivo es la clave privada. No la compartas.

El archivo `.pub` es la clave pública y se puede copiar al teléfono de forma segura. `ssh-keygen` es la utilidad estándar de OpenSSH para crear claves de autenticación.

Muestra la clave pública en Linux o macOS:

```bash
cat ~/.ssh/android-server.pub
```

En Windows PowerShell:

```powershell
Get-Content "$HOME\.ssh\android-server.pub"
```

En el símbolo del sistema de Windows:

```bat
type "%USERPROFILE%\.ssh\android-server.pub"
```

Copia la línea completa. Debe comenzar por `ssh-ed25519`.

## 6. Añadir la clave del cliente a Ubuntu

Vuelve a la sesión de Ubuntu en el teléfono.

Crea el directorio `.ssh` del usuario root:

```bash
install -d -m 700 /root/.ssh
```

Abre el archivo `authorized_keys`:

```bash
nano /root/.ssh/authorized_keys
```

Pega la clave pública que copiaste del ordenador cliente.

La clave completa debe permanecer en una sola línea.

Guarda el archivo con <kbd>Ctrl</kbd>+<kbd>O</kbd>, pulsa <kbd>Enter</kbd> y sal con <kbd>Ctrl</kbd>+<kbd>X</kbd>.

Establece los permisos necesarios:

```bash
chmod 600 /root/.ssh/authorized_keys
```

Establece una contraseña segura para la cuenta root de Ubuntu:

```bash
passwd
```

Esto garantiza que la cuenta esté desbloqueada. La siguiente sección desactiva la autenticación mediante contraseña, por lo que esta contraseña no se aceptará a través de SSH.

> [!NOTE] El usuario root de Ubuntu frente al acceso root de Android
> El usuario root de esta guía controla el entorno PRoot de Ubuntu. Esto no concede al entorno Ubuntu acceso root al sistema operativo Android subyacente.

## 7. Configurar el servidor SSH

Ubuntu admite fragmentos de configuración de SSH en:

```text
/etc/ssh/sshd_config.d/
```

Crea un archivo de configuración específico:

```bash
nano /etc/ssh/sshd_config.d/99-android-server.conf
```

Añade los siguientes ajustes:

```text
Port 2022
ListenAddress 127.0.0.1

PubkeyAuthentication yes
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitEmptyPasswords no
PermitRootLogin prohibit-password
```

Guarda el archivo y sal.

Esta configuración:

- Ejecuta SSH en el puerto `2022`.
- Limita el servicio de escucha SSH a la interfaz de bucle local (_loopback_) del teléfono.
- Habilita la autenticación mediante clave pública.
- Deshabilita la autenticación mediante contraseña y la interactiva por teclado.
- Permite iniciar sesión como root únicamente mediante autenticación por clave pública.

`PermitRootLogin prohibit-password` permite iniciar sesión como root mediante autenticación por clave pública y deshabilita para root la autenticación mediante contraseña y la interactiva por teclado.

Como SSH solo escucha en `127.0.0.1`, los demás dispositivos de la red Wi-Fi del teléfono no pueden conectarse directamente al puerto `2022`. En su lugar, el túnel de Cloudflare se conectará al servicio de escucha local.

Genera las claves de host del servidor SSH:

```bash
ssh-keygen -A
```

Crea el directorio de separación de privilegios de SSH:

```bash
install -d -m 0755 /run/sshd
```

OpenSSH utiliza `/run/sshd` durante el proceso de separación de privilegios previo a la autenticación.

Valida la configuración de SSH:

```bash
/usr/sbin/sshd -t
```

Si no aparece ninguna salida, la configuración ha superado la validación.

Inspecciona los ajustes efectivos:

```bash
/usr/sbin/sshd -T | grep -E \
  '^(port|listenaddress|pubkeyauthentication|passwordauthentication|kbdinteractiveauthentication|permitrootlogin) '
```

La salida debería incluir ajustes similares a estos:

```text
port 2022
listenaddress 127.0.0.1:2022
pubkeyauthentication yes
passwordauthentication no
kbdinteractiveauthentication no
permitrootlogin without-password
```

OpenSSH puede mostrar `without-password`, un alias obsoleto de `prohibit-password`.

Inicia el servidor SSH:

```bash
/usr/sbin/sshd
```

Comprueba que se esté ejecutando:

```bash
pgrep -a sshd
```

Comprueba que esté escuchando en el puerto `2022`:

```bash
ss -ltnp | grep ':2022'
```

La dirección de escucha debe ser `127.0.0.1:2022`, no `0.0.0.0:2022`.

> [!WARNING] No habilites el inicio de sesión mediante contraseña
> No cambies `PasswordAuthentication` a `yes` solo para facilitar la resolución de problemas. En su lugar, valida la clave pública, los permisos de los archivos y la clave privada seleccionada.

## 8. Instalar `cloudflared`

Sin salir de Ubuntu, crea el directorio de llaveros de APT:

```bash
mkdir -p --mode=0755 /usr/share/keyrings
```

Descarga la clave de firma de paquetes de Cloudflare:

```bash
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
  | tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
```

Añade el repositorio estable de Cloudflare, independiente de la distribución:

```bash
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' \
  | tee /etc/apt/sources.list.d/cloudflared.list
```

Actualiza la base de datos de paquetes e instala `cloudflared`:

```bash
apt-get update
apt-get install cloudflared -y
```

El uso de la suite `any` evita vincular la fuente de paquetes de Cloudflare al nombre de una versión concreta de Ubuntu. Cloudflare publica tanto un canal estable como otro de compilaciones nocturnas; esta guía utiliza el estable.

Comprueba la instalación:

```bash
cloudflared --version
```

## 9. Autenticar `cloudflared`

Ejecuta:

```bash
cloudflared tunnel login
```

`cloudflared` intentará abrir un navegador. Dentro del entorno PRoot, puede que el comando
muestre una URL en su lugar.

Cuando se muestre una URL:

1. Cópiala.
2. Ábrela en el navegador de Android o en otro ordenador.
3. Inicia sesión en la cuenta de Cloudflare correcta.
4. Selecciona el dominio de `ssh.example.com`.
5. Vuelve a Termux después de que Cloudflare confirme la autorización.

El comando crea un certificado de cuenta en:

```text
/root/.cloudflared/cert.pem
```

Cloudflare documenta que `cloudflared tunnel login` abre una página de autenticación y crea
`cert.pem` en el directorio predeterminado de `cloudflared`.

> [!WARNING] Protege `cert.pem`
> El certificado de cuenta autoriza acciones de administración de túneles en tu cuenta de
> Cloudflare. No lo publiques, no lo envíes por correo electrónico ni lo añadas a un repositorio.

Protege el directorio y el certificado:

```bash
chmod 700 /root/.cloudflared
chmod 600 /root/.cloudflared/cert.pem
```

## 10. Crear el túnel de Cloudflare

Crea un túnel gestionado localmente:

```bash
cloudflared tunnel create android-server
```

El comando muestra un UUID de túnel similar a:

```text
12345678-1234-1234-1234-123456789abc
```

También crea un archivo de credenciales:

```text
/root/.cloudflared/<TUNNEL_UUID>.json
```

El UUID del túnel identifica el túnel, mientras que el archivo JSON contiene las credenciales
necesarias para ejecutarlo.

Protege el archivo de credenciales:

```bash
chmod 600 /root/.cloudflared/<TUNNEL_UUID>.json
```

Anota el UUID. Se utilizará en varios comandos posteriores.

Puedes consultar la lista de túneles en cualquier momento con:

```bash
cloudflared tunnel list
```

## 11. Crear la aplicación de Cloudflare Access

Crea la aplicación de Access **antes de publicar la ruta DNS**, tal como recomienda Cloudflare.
Esto evita que el nombre de host quede disponible brevemente sin una política de Access. Las
aplicaciones de Access deniegan el acceso de forma predeterminada y, para conectarse, un usuario
debe cumplir los criterios de una política **Allow**.

Abre el panel de Cloudflare y ve a:

```text
Zero Trust → Access controls → Applications
```

A continuación:

1. Selecciona **Create new application**.

2. Selecciona **Self-hosted and private**.

3. Selecciona **Add public hostname**.

4. Introduce un nombre para la aplicación, como:

   ```text
   Android Ubuntu SSH
   ```

5. Selecciona tu dominio.

6. Introduce la parte del nombre de host correspondiente al subdominio.

Para `ssh.example.com`, utiliza:

```text
Subdomain: ssh
Domain: example.com
```

En **Access policies**, crea una política con:

```text
Policy name: Only me
Action: Allow
Include selector: Emails
Value: your-email@example.com
```

Introduce la dirección de correo electrónico exacta que utilizarás para autenticarte.

No configures una política con la acción **Allow** y el selector **Everyone**, a menos que la aplicación deba estar
disponible expresamente para todos los usuarios que puedan autenticarse.

Como método de autenticación, selecciona una de las siguientes opciones:

- Cloudflare One-time PIN.
- Un proveedor de identidad ya configurado en tu cuenta de Zero Trust.

Cloudflare One-time PIN envía un código de inicio de sesión a una dirección de correo electrónico
autorizada sin necesidad de integrar por separado un proveedor de identidad externo.

Elige una duración de sesión adecuada y crea la aplicación.

El nombre de host configurado para la aplicación de Access debe coincidir exactamente con:

```text
ssh.example.com
```

En el flujo de aplicaciones actual de Cloudflare, la política aparece directamente en **Access
policies**, dentro de la configuración de la aplicación autohospedada.

## 12. Crear la ruta DNS del túnel

Vuelve a Ubuntu en Termux.

Crea la ruta DNS:

```bash
cloudflared tunnel route dns android-server ssh.example.com
```

Esto crea un registro DNS de Cloudflare que asocia `ssh.example.com` con el túnel.

La ruta no contiene el puerto SSH local. El servicio y el puerto locales se definen en el archivo de
configuración del túnel.

## 13. Configurar el túnel

Crea o abre el archivo de configuración del túnel:

```bash
nano /root/.cloudflared/config.yml
```

Añade:

```yaml
tunnel: <TUNNEL_UUID>
credentials-file: /root/.cloudflared/<TUNNEL_UUID>.json

ingress:
  - hostname: ssh.example.com
    service: tcp://127.0.0.1:2022
  - service: http_status:404
```

Sustituye ambos marcadores de posición `<TUNNEL_UUID>` por el UUID real.

Por ejemplo:

```yaml
tunnel: 12345678-1234-1234-1234-123456789abc
credentials-file: /root/.cloudflared/12345678-1234-1234-1234-123456789abc.json

ingress:
  - hostname: ssh.example.com
    service: tcp://127.0.0.1:2022
  - service: http_status:404
```

La regla comodín final es necesaria para que las solicitudes cuyo nombre de host no coincida con
ninguna regla reciban una respuesta HTTP `404` en lugar de reenviarse al servicio SSH.

Esta guía utiliza el tipo de servicio TCP (`tcp://127.0.0.1:2022`) porque el cliente se conecta con
`cloudflared access tcp`.

Cloudflare admite los tipos de servicio TCP y SSH:

```yaml
tcp://127.0.0.1:2022
ssh://127.0.0.1:2022
```

No son intercambiables desde la perspectiva del cliente. Las rutas TCP utilizan
`cloudflared access tcp`, mientras que las rutas SSH utilizan `cloudflared access ssh`.

Protege la configuración:

```bash
chmod 600 /root/.cloudflared/config.yml
```

Valida la configuración de entrada:

```bash
cloudflared tunnel ingress validate
```

Un resultado correcto debería indicar:

```text
Validating rules from /root/.cloudflared/config.yml
OK
```

Comprueba qué regla coincide con el nombre de host:

```bash
cloudflared tunnel ingress rule https://ssh.example.com
```

Debería coincidir con la regla cuyo servicio es:

```text
tcp://127.0.0.1:2022
```

Cloudflare proporciona ambos comandos para validar y comprobar configuraciones de entrada
locales.

## 14. Iniciar el servidor y el túnel

Confirma que SSH esté en ejecución:

```bash
pgrep -x sshd >/dev/null || /usr/sbin/sshd
```

Inicia el túnel de Cloudflare:

```bash
cloudflared tunnel run <TUNNEL_UUID>
```

También puedes ejecutar el túnel por su nombre:

```bash
cloudflared tunnel run android-server
```

Deja este comando en ejecución.

El túnel solo está disponible mientras se cumplan todas las condiciones siguientes:

- Termux está en ejecución.
- El entorno PRoot de Ubuntu está en ejecución.
- `sshd` está en ejecución.
- `cloudflared` está en ejecución.
- El teléfono tiene conexión a Internet.

`cloudflared` se ejecuta en primer plano. Pulsar <kbd>Ctrl</kbd>+<kbd>C</kbd> detiene el túnel.

## 15. Instalar `cloudflared` en el ordenador cliente

Instala `cloudflared` en cada ordenador que vaya a conectarse al servidor.

El método de Cloudflare para conexiones TCP de cualquier tipo requiere `cloudflared` tanto en el
servidor como en el cliente.

Verifica la instalación:

```bash
cloudflared --version
```

El cliente también necesita:

- Un navegador.
- OpenSSH.
- La clave privada generada anteriormente.
- Permiso para autenticarse mediante la política de Cloudflare Access.

## 16. Iniciar el relé TCP del cliente

En el ordenador cliente, abre un terminal y ejecuta:

```bash
cloudflared access tcp \
  --hostname ssh.example.com \
  --url 127.0.0.1:9000
```

Mantén abierto este terminal.

El comando crea un socket de escucha TCP local en:

```text
127.0.0.1:9000
```

El relé reenvía las conexiones mediante Cloudflare Access y el túnel a la siguiente dirección
dentro de Ubuntu en el teléfono:

```text
127.0.0.1:2022
```

Cuando se inicia el relé, `cloudflared` abre una ventana del navegador para la autenticación. Según
tu configuración de Access, inicia sesión mediante el proveedor de identidad o introduce el PIN de
un solo uso enviado a tu correo electrónico. Cloudflare documenta este flujo de autenticación
mediante navegador para `cloudflared access tcp`.

Si el puerto `9000` ya está en uso, selecciona otro puerto local:

```bash
cloudflared access tcp \
  --hostname ssh.example.com \
  --url 127.0.0.1:9001
```

Utiliza ese nuevo puerto tanto en el comando SSH como en la configuración de VS Code.

## 17. Conectarse mediante SSH

Abre un segundo terminal en el ordenador cliente.

Conéctate mediante el relé local:

```bash
ssh \
  -i ~/.ssh/android-server \
  -o HostKeyAlias=ssh.example.com \
  -p 9000 \
  root@127.0.0.1
```

En la primera conexión, OpenSSH mostrará la huella digital de la clave de host del servidor.

Antes de aceptarla, muestra desde Ubuntu en el teléfono la huella digital esperada de la clave de
host Ed25519:

```bash
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

Compara las dos huellas digitales. Si coinciden, introduce:

```text
yes
```

Introduce la frase de contraseña de la clave privada SSH si se te solicita.

A continuación, deberías obtener un intérprete de comandos de Ubuntu en el teléfono Android.

La opción `HostKeyAlias` indica a OpenSSH que almacene y busque la clave de host del servidor con
el alias `ssh.example.com` en lugar de `[127.0.0.1]:9000`.

## 18. Conectarse desde VS Code

Instala la extensión **Remote - SSH** en Visual Studio Code.

Abre tu archivo de configuración de SSH:

En Linux o macOS:

```text
~/.ssh/config
```

En Windows:

```text
%USERPROFILE%\.ssh\config
```

Añade lo siguiente:

```ssh-config
Host android-server
  HostName 127.0.0.1
  User root
  Port 9000
  IdentityFile ~/.ssh/android-server
  IdentitiesOnly yes
  HostKeyAlias ssh.example.com
  ServerAliveInterval 30
  ServerAliveCountMax 3
```

Antes de conectarte desde VS Code, inicia el relé y déjalo en ejecución:

```bash
cloudflared access tcp \
  --hostname ssh.example.com \
  --url 127.0.0.1:9000
```

A continuación:

1. Abre la paleta de comandos de VS Code.
2. Selecciona **Remote-SSH: Connect to Host...**
3. Selecciona `android-server`.
4. Completa la autenticación de Cloudflare si se solicita.
5. Introduce la frase de contraseña de la clave privada si se solicita.

> [!NOTE] Requisito del relé
> VS Code no inicia el relé `cloudflared access tcp` desde esta configuración. El terminal del relé debe permanecer abierto durante toda la sesión de VS Code.

## 19. Crear un script de inicio del servidor

En lugar de iniciar SSH y el túnel manualmente cada vez, crea un script dentro de Ubuntu.

Abre el script en `nano`:

```bash
nano /root/start-android-server.sh
```

Añade el siguiente contenido:

```bash
#!/usr/bin/env bash

set -euo pipefail

install -d -m 0755 /run/sshd
ssh-keygen -A
/usr/sbin/sshd -t

if ! pgrep -x sshd >/dev/null; then
  /usr/sbin/sshd
fi

exec cloudflared tunnel run <TUNNEL_UUID>
```

Sustituye `<TUNNEL_UUID>` por el UUID real.

Haz que el script sea ejecutable:

```bash
chmod 700 /root/start-android-server.sh
```

Sal de Ubuntu:

```bash
exit
```

Ahora deberías estar de nuevo en el intérprete de comandos habitual de Termux.

Crea un script lanzador para Termux:

```bash
nano ~/start-android-server.sh
```

Añade el siguiente contenido:

```bash
#!/data/data/com.termux/files/usr/bin/bash

set -e

termux-wake-lock

exec proot-distro login ubuntu -- \
  /root/start-android-server.sh
```

Guarda el archivo y haz que sea ejecutable:

```bash
chmod 700 ~/start-android-server.sh
```

Ahora puedes iniciar el servidor y el túnel desde Termux con:

```bash
~/start-android-server.sh
```

## 20. Opcional: iniciar automáticamente con Termux:Boot

Instala Termux:Boot desde la misma fuente que utilizaste para instalar Termux.

Por ejemplo:

- Si instalaste Termux desde F-Droid, instala Termux:Boot desde F-Droid.
- Si instalaste Termux desde GitHub, instala Termux:Boot desde GitHub.

Abre la aplicación Termux:Boot una vez después de instalarla, tal como recomienda la documentación del proyecto. Esto inicializa su integración con el arranque.

Termux:Boot ejecuta los scripts ejecutables ubicados en:

```text
~/.termux/boot/
```

En el intérprete de comandos habitual de Termux, crea el directorio de arranque:

```bash
mkdir -p ~/.termux/boot
```

Crea el script de arranque:

```bash
nano ~/.termux/boot/start-android-server
```

Añade el siguiente contenido:

```bash
#!/data/data/com.termux/files/usr/bin/bash

termux-wake-lock

sleep 20

nohup proot-distro login ubuntu -- \
  /root/start-android-server.sh \
  >> "$HOME/android-server.log" 2>&1 &
```

Haz que sea ejecutable:

```bash
chmod 700 ~/.termux/boot/start-android-server
```

Después de reiniciar el teléfono, Termux:Boot debería intentar iniciar el servidor de Ubuntu y el túnel.

Consulta el registro de inicio con:

```bash
cat ~/android-server.log
```

> [!WARNING] Limitaciones del inicio automático
> El inicio automático depende de las políticas de ejecución en segundo plano de Android y de cualquier restricción adicional impuesta por el fabricante del dispositivo. Un script de arranque no garantiza una disponibilidad ininterrumpida. Algunos dispositivos pueden requerir que se desbloquee el teléfono una vez después de reiniciarlo.

## 21. Detener el servidor

Cuando `cloudflared` se esté ejecutando en primer plano, pulsa <kbd>Ctrl</kbd>+<kbd>C</kbd> para detener el túnel.

Para detener el servidor SSH desde Ubuntu:

```bash
pkill sshd
```

Para liberar el bloqueo de activación de Termux después de salir de Ubuntu:

```bash
termux-wake-unlock
```

## 22. Actualizar el servidor

Actualiza los paquetes de Termux desde el intérprete de comandos habitual de Termux:

```bash
pkg update
pkg upgrade -y
```

Entra en Ubuntu:

```bash
proot-distro login ubuntu
```

Actualiza los paquetes de Ubuntu, incluido `cloudflared`:

```bash
apt update
apt upgrade -y
```

Reinicia el túnel después de actualizar `cloudflared`.

Actualizar o reiniciar `cloudflared` interrumpe las conexiones TCP y SSH activas.

## 23. Lista de comprobación de seguridad

Antes de confiar en el servidor para acceder de forma remota, comprueba lo siguiente:

- Termux procede de F-Droid o de las versiones oficiales de GitHub.
- Los complementos de Termux proceden de la misma fuente que Termux.
- El servidor SSH solo escucha en `127.0.0.1:2022`.
- `PasswordAuthentication` está configurado como `no`.
- `KbdInteractiveAuthentication` está configurado como `no`.
- `PermitRootLogin` está configurado como `prohibit-password`.
- `/root/.ssh` tiene los permisos establecidos en `700`.
- `/root/.ssh/authorized_keys` tiene los permisos establecidos en `600`.
- El nombre de host configurado para la aplicación de Cloudflare Access coincide exactamente con el nombre de host del túnel y del cliente.
- La política de Access con la acción **Allow** solo contiene identidades autorizadas y no utiliza el selector **Everyone**.
- `/root/.cloudflared` tiene los permisos establecidos en `700`.
- `cert.pem`, `config.yml` y el archivo JSON del túnel tienen los permisos establecidos en `600`.
- La clave privada del cliente está protegida con una frase de contraseña.
- La clave privada, `cert.pem` y el archivo JSON del túnel nunca se añaden al control de versiones.

## 24. Solución de problemas

### `sshd` indica que no hay claves de host disponibles

Genera las claves de host del servidor:

```bash
ssh-keygen -A
```

A continuación, valida la configuración e inicia SSH:

```bash
/usr/sbin/sshd -t
/usr/sbin/sshd
```

### `sshd` indica que falta un directorio para la separación de privilegios

Créalo:

```bash
install -d -m 0755 /run/sshd
```

A continuación, vuelve a iniciar SSH:

```bash
/usr/sbin/sshd
```

### SSH no escucha en el puerto 2022

Comprueba la configuración efectiva:

```bash
/usr/sbin/sshd -T | grep -E '^(port|listenaddress) '
```

Comprueba el proceso:

```bash
pgrep -a sshd
```

Comprueba el socket de escucha:

```bash
ss -ltnp | grep ':2022'
```

Reinicia SSH:

```bash
pkill sshd 2>/dev/null || true
/usr/sbin/sshd
```

### SSH muestra `Permission denied (publickey)`

Comprueba los permisos del directorio y del archivo:

```bash
ls -ld /root/.ssh
ls -l /root/.ssh/authorized_keys
```

Corrígelos:

```bash
chmod 700 /root/.ssh
chmod 600 /root/.ssh/authorized_keys
```

Confirma que la clave pública de `authorized_keys` coincide con la clave pública almacenada en el archivo `android-server.pub` del cliente.

Asegúrate de que el cliente SSH utiliza la clave privada correcta:

```bash
ssh -vvv \
  -i ~/.ssh/android-server \
  -o HostKeyAlias=ssh.example.com \
  -p 9000 \
  root@127.0.0.1
```

### `cloudflared tunnel login` no abre un navegador

Copia la URL que aparece en el terminal y ábrela manualmente en el navegador de Android o en otro ordenador.

Después de completar la autenticación, confirma que el certificado existe:

```bash
ls -l /root/.cloudflared/cert.pem
```

### El túnel no encuentra sus credenciales

Confirma que el UUID de `config.yml` coincide con el nombre del archivo JSON:

```bash
ls -l /root/.cloudflared
cat /root/.cloudflared/config.yml
```

Los valores deben coincidir:

```yaml
tunnel: <TUNNEL_UUID>
credentials-file: /root/.cloudflared/<TUNNEL_UUID>.json
```

### La página de Access indica que no tienes permiso

Comprueba lo siguiente:

- El nombre de host de la aplicación de Access es exactamente `ssh.example.com`.
- La política contiene el correo electrónico utilizado durante el inicio de sesión.
- La acción de la política es **Allow**.
- El método de autenticación seleccionado está habilitado.
- La política está asociada a la aplicación correcta.
- La aplicación de Access se ha guardado.

Las aplicaciones de Access deniegan el acceso de forma predeterminada a menos que un usuario cumpla los criterios de una política con la acción **Allow**.

### El relé del cliente se conecta, pero SSH falla

Confirma que los tres valores del nombre de host coinciden y que el servicio local está configurado exactamente como se muestra:

```text
Nombre de host del túnel:   ssh.example.com
Aplicación de Access:       ssh.example.com
Nombre de host del cliente: ssh.example.com
Servicio local del túnel:   tcp://127.0.0.1:2022
```

Valida la configuración del túnel:

```bash
cloudflared tunnel ingress validate
cloudflared tunnel ingress rule https://ssh.example.com
```

### El puerto 9000 ya está en uso

Utiliza otro puerto local:

```bash
cloudflared access tcp \
  --hostname ssh.example.com \
  --url 127.0.0.1:9001
```

A continuación, conéctate con:

```bash
ssh \
  -i ~/.ssh/android-server \
  -o HostKeyAlias=ssh.example.com \
  -p 9001 \
  root@127.0.0.1
```

Actualiza la configuración SSH de VS Code para utilizar el mismo puerto.

### VS Code se desconecta inmediatamente

Asegúrate de que el terminal que ejecuta `cloudflared access tcp` sigue abierto.

Prueba también la conexión fuera de VS Code:

```bash
ssh \
  -i ~/.ssh/android-server \
  -o HostKeyAlias=ssh.example.com \
  -p 9000 \
  root@127.0.0.1
```

Resuelve los problemas de SSH en la línea de comandos antes de volver a intentarlo con VS Code.

### SSH indica que la clave de host ha cambiado

Un cambio en la clave de host puede ser legítimo si se ha reinstalado Ubuntu o se han regenerado sus claves de host de forma deliberada. También puede indicar que la conexión está llegando a un servidor diferente.

Comprueba el motivo antes de eliminar la clave almacenada.

Si has reconstruido deliberadamente el entorno de Ubuntu, elimina la entrada antigua de la clave de host correspondiente al alias solo después de confirmar el cambio:

```bash
ssh-keygen -R ssh.example.com
```

Vuelve a conectarte y revisa la nueva huella digital.

### Termux se detiene cuando la pantalla está apagada

Ejecuta:

```bash
termux-wake-lock
```

Confirma que el ajuste de uso de la batería de Termux en Android está establecido en **Sin restricciones**.

Comprueba también los ajustes específicos del fabricante, como las aplicaciones en suspensión, los límites de uso en segundo plano y la limpieza automática de memoria.

## 25. Limitaciones

Ubuntu se ejecuta dentro de un entorno PRoot en lugar de hacerlo como una máquina virtual convencional o un servicio nativo de Android. Por lo tanto, la configuración depende de que Termux permanezca activo.

El modo TCP público del túnel transporta el tráfico TCP mediante una conexión WebSocket. Para las conexiones que deban permanecer activas durante periodos prolongados, Cloudflare recomienda utilizar en su lugar su arquitectura Client-to-Tunnel.

Ten en cuenta las siguientes limitaciones:

- La administración ocasional mediante SSH debería funcionar bien.
- VS Code Remote - SSH puede funcionar, pero las sesiones largas podrían desconectarse.
- Suspender el ordenador cliente puede detener el relé.
- Cambiar de red en el teléfono puede interrumpir el túnel.
- Actualizar o reiniciar `cloudflared` finaliza las conexiones actuales.
- Reiniciar el teléfono detiene el servidor hasta que Termux o Termux:Boot lo vuelvan a iniciar.

Para disponer de un servidor permanentemente disponible, utiliza un equipo Linux convencional, un servidor privado virtual o una configuración Client-to-Tunnel de Cloudflare sobre una red privada.
