# GymTrack Multiusuario — Netlify + Firebase Authentication + Google Sheets

Aplicación web para administrar rutinas individuales, validar llegada al gimnasio por geolocalización y guardar el progreso corporal de cada usuario. Incluye frontend separado, backend de Apps Script y autenticación por Firebase.

## Panel de ejercicios mejorado

- Resumen de ejercicios asignados, días con rutina y tamaño del catálogo.
- Asignaciones agrupadas por día con búsqueda por nombre, músculo, descripción o prescripción.
- Vista previa de la descripción y las series antes de asignar un ejercicio.
- Catálogo buscable con botón para seleccionar rápidamente un ejercicio para la rutina.
- Tarjetas de rutina con estado pendiente/completado y contador de progreso actualizado al marcar ejercicios.

## Qué incluye

- Inicio de sesión con correo y contraseña (Firebase Authentication).
- Roles `admin` y `usuario`. No hay registro público.
- El administrador crea usuarios, activa/desactiva cuentas, asigna una rutina base o ejercicios individuales por día. Puede crear ejercicios con nombre, descripción, grupo muscular y prescripción.
- Rutina de lunes, miércoles, viernes y sábado basada en el plan actual; cada usuario tiene sus propias asignaciones.
- Gestión de múltiples gimnasios/sedes con enlace de Google Maps, coordenadas, radio y precisión configurables. El administrador asigna una o varias sedes permitidas a cada usuario. La llegada por GPS se valida en el servidor contra la sede elegida.
- Registro de series, kg, repeticiones, completado y notas por ejercicio.
- Finalización de sesiones e historial.
- Peso corporal, gráfica de tendencia, medidas corporales (16 medidas), historial y gráfica de una medida seleccionada.
- Registro de EVOLT 360 e historial de composición corporal.
- Importación de respaldo JSON de BodyTrack V3, exportación CSV de medidas y descarga JSON de los datos personales.
- Herramienta para importar los registros antiguos de las hojas `Pesos`, `Registro` y `Sesiones`.
- Las hojas antiguas se conservan. El sistema agrega hojas nuevas `Gym_*`; no ejecuta `clear()` ni elimina datos existentes.

## Archivos

- `index.html`: interfaz.
- `styles.css`: estilos responsive.
- `app.js`: lógica del frontend y conexión.
- `firebase-config.js`: configuración de Firebase y URL de Apps Script.
- `Codigo.gs`: backend de Google Apps Script. **No se sube a Netlify.**

---

## 1. Configurar Firebase Authentication

1. Abre [Firebase Console](https://console.firebase.google.com/) y crea un proyecto.
2. En **Authentication → Sign-in method**, habilita **Email/Password**.
3. En **Project settings → General → Your apps**, registra una aplicación web.
4. Copia `apiKey`, `authDomain`, `projectId` y `appId`.
5. Edita `firebase-config.js` y sustituye los valores `CONFIGURAR_API_KEY`, `TU-PROYECTO` y `CONFIGURAR_APP_ID` por los datos de tu proyecto.
6. La `apiKey` de Firebase también debe pegarse en `Codigo.gs`, en la constante `FIREBASE_API_KEY`.
7. En **Authentication → Settings → Authorized domains**, agrega el dominio de Netlify que utilizarás (por ejemplo, `tu-sitio.netlify.app`). No agregues una dirección que no sea tuya.

La API key de Firebase identifica el proyecto, no es una contraseña. No guardes contraseñas de usuarios en el código ni en Google Sheets. El inicio de sesión ocurre con Firebase; Apps Script valida el token antes de acceder a los datos.

### Nota sobre restricciones de API key

Si aplicas restricciones a la API key en Google Cloud, permite las APIs de Firebase Authentication/Identity Toolkit necesarias. Una restricción por referente HTTP puede bloquear la validación que hace Apps Script; en ese caso utiliza una clave de servidor separada con restricciones de API apropiadas.

---

## 2. Configurar Google Sheets y Apps Script

El proyecto está preparado para utilizar esta hoja de cálculo existente:

`12kPiHFHcqU5kndsWo2HpZjacHzJ31rfkUtbAsIwBdV4`

1. Abre el proyecto de Apps Script que corresponde a la implementación actual de la aplicación, o crea uno nuevo vinculado a la hoja de cálculo.
2. Reemplaza el contenido del archivo `.gs` por `Codigo.gs`.
3. En `Codigo.gs`, cambia:
   - `FIREBASE_API_KEY = 'CONFIGURAR_FIREBASE_API_KEY'` por la API key de tu proyecto Firebase.
4. Guarda el proyecto.
5. Selecciona y ejecuta `inicializarSistema()` desde el editor de Apps Script. Acepta los permisos solicitados.
6. Comprueba que se crearon las hojas `Gym_Usuarios`, `Gym_Catalogo`, `Gym_Asignaciones`, `Gym_Sesiones`, `Gym_Registros`, `Gym_Pesos`, `Gym_Medidas`, `Gym_EVOLT360`, `Gym_Config`, `Gym_Gimnasios` y `Gym_UsuarioGimnasios`.

**No borres ni renombres las hojas antiguas** `Rutina`, `Registro`, `Sesiones` y `Pesos`. La nueva versión no las usa para sus registros diarios, pero puede importarlas desde Administración.

### Crear el primer administrador

El primer administrador se habilita una vez de forma manual para evitar que cualquiera pueda registrarse como administrador.

1. En Firebase Console → Authentication → Users, pulsa **Add user** y crea tu cuenta de administrador con tu correo y una contraseña segura.
2. Copia el **UID** de esa cuenta.
3. En `Codigo.gs`, reemplaza los valores de estas constantes por tus propios datos:

```js
const INITIAL_ADMIN_UID = 'PEGA_AQUI_UID_DE_FIREBASE';
const INITIAL_ADMIN_EMAIL = 'admin@ejemplo.com';
const INITIAL_ADMIN_NAME = 'Administrador';
```

4. Guarda y ejecuta `autorizarAdministradorInicial()` desde Apps Script.
5. Vuelve a iniciar sesión en la web con ese correo y contraseña. Debe aparecer la sección **Administración**.

No compartas el UID ni la contraseña del administrador públicamente. No es necesario escribir contraseñas en la hoja de cálculo.

---

## 3. Implementar Apps Script como Web App

1. En Apps Script, entra en **Implementar → Gestionar implementaciones**.
2. Edita la implementación existente o crea una nueva implementación de tipo **Aplicación web**.
3. Configura **Ejecutar como: Yo** (tu cuenta propietaria).
4. Configura el acceso para que el endpoint pueda recibir solicitudes de la aplicación web (normalmente **Cualquier usuario**). La API no entrega datos solo por conocer el enlace: cada operación exige un token válido de Firebase y verifica el rol en el servidor.
5. Pulsa **Implementar** y copia la URL que termina en `/exec`.
6. Pega esa URL en `firebase-config.js`, en `appsScriptUrl`.

Si editaste la implementación que ya utilizaba el proyecto anterior, actualízala a una **nueva versión**. Si creaste una implementación nueva, usa su nueva URL en `firebase-config.js`.

La aplicación usa solicitudes POST para no enviar contraseñas ni tokens de sesión como parámetros de URL. Luego consulta el resultado por un identificador aleatorio temporal.

---

## 4. Subir a Netlify

Sube estos cuatro archivos en la raíz del sitio:

- `index.html`
- `styles.css`
- `app.js`
- `firebase-config.js`

No subas `Codigo.gs` a Netlify. Puedes arrastrar la carpeta o un ZIP del frontend a Netlify, siempre que estos archivos queden en la raíz publicada.

La geolocalización necesita un contexto seguro **HTTPS**. Netlify proporciona HTTPS de forma predeterminada.

---

## 5. Registrar varias sedes con Google Maps y asignarlas a usuarios

1. Inicia sesión como administrador y abre **Administración → Agregar gimnasio desde Google Maps**.
2. Escribe el nombre de la sede y, si quieres, su dirección.
3. Pega el enlace de Google Maps en el campo correspondiente y pulsa **Extraer coordenadas del enlace**. El sistema reconoce enlaces que contienen coordenadas en la URL, por ejemplo `@latitud,longitud`, `!3dLAT!4dLNG` o `?q=LAT,LNG`.
4. Si el enlace compartido es corto (por ejemplo `maps.app.goo.gl`) y no contiene coordenadas, abre Google Maps, busca la sede y haz clic derecho sobre el punto exacto de entrada. Pulsa las coordenadas que aparecen para copiarlas y pégalas en **Latitud** y **Longitud**. También puedes usar **Abrir Google Maps** para buscar la dirección.
5. Define el radio permitido (por ejemplo 100–150 m) y la precisión GPS máxima (por ejemplo 80 m). Pulsa **Guardar nueva sede**. Repite el proceso para cada gimnasio/sucursal.
6. En **Gimnasios autorizados por usuario**, selecciona al usuario desde el apartado **Asignar ejercicios**, marca las sedes a las que puede ir y pulsa **Guardar gimnasios permitidos**. Puedes marcar varias.
7. En el perfil del usuario, al pulsar **Confirmar llegada**, se mostrará un selector cuando tenga más de una sede autorizada. La rutina se habilita solo si el servidor confirma que está dentro del radio de la sede elegida.
8. Si una sede deja de estar disponible, usa **Desactivar** en la lista de gimnasios. Una sede desactivada no permite nuevas validaciones.

No requiere una API key de Google Maps porque se usa el enlace de Maps y las coordenadas. Los enlaces cortos no siempre permiten extraer coordenadas automáticamente; en ese caso usa la copia manual de coordenadas descrita arriba. La geolocalización requiere HTTPS y permiso de ubicación precisa.

### Importante sobre GPS

El servidor recalcula la distancia y verifica que la sede esté activa y asignada al usuario. Aun así, el GPS procede del dispositivo y puede falsificarse. Para mayor control, se recomienda complementar la ubicación con un QR rotativo dentro de cada sede.

---

## 6. Crear usuarios y asignar rutinas

1. Desde la sección **Administración**, utiliza **Crear usuario**.
2. Asigna correo, contraseña inicial y rol. La contraseña se envía directamente a Firebase; no se guarda en Sheets.
3. En **Asignar ejercicios**, selecciona el usuario y pulsa **Asignar rutina base** para asignar lunes, miércoles, viernes y sábado.
4. Para crear ejercicios, completa nombre, grupo muscular, descripción y prescripción en **Crear ejercicio nuevo**. Después, para personalizar una rutina, elige usuario, día y ejercicio del catálogo; ajusta series/repeticiones y pulsa **Añadir ejercicio**.
5. El usuario inicia sesión con sus credenciales. Solo verá sus propias asignaciones, pesos, medidas, EVOLT e historial.

Al aplicar la rutina base se desactivan las asignaciones activas anteriores de ese usuario, pero **no se borra su historial de entrenamientos**.

---

## 7. Importar datos existentes

### Historial del tracker anterior (Google Sheets)

En **Administración → Historial anterior**, selecciona el usuario que debe recibir los datos y pulsa **Importar historial del tracker anterior**. Esto intenta importar las hojas antiguas `Pesos`, `Registro` y `Sesiones`. Hazlo una sola vez por usuario. Las sesiones migradas se etiquetan como históricas y no habilitan el entrenamiento actual porque no tienen una validación de ubicación.

Las hojas originales no se borran. Si los datos antiguos corresponden a otra persona, selecciona correctamente el usuario destino antes de importar.

### Respaldo BodyTrack V3 (JSON)

1. En la versión anterior de BodyTrack V3, exporta/descarga un respaldo JSON de los perfiles y evaluaciones.
2. Inicia sesión en la nueva aplicación con el usuario que debe recibir esas medidas.
3. Abre **Control corporal → Importar respaldo BodyTrack JSON** y selecciona el archivo.
4. La app importará el historial del perfil seleccionado dentro del respaldo. Si el archivo contiene varios perfiles, se toma el perfil marcado como actual (`currentId`) o el primero si no existe.

---

## 8. Estructura de datos

| Hoja | Contenido |
|---|---|
| `Gym_Usuarios` | UID de Firebase, correo, nombre, rol y estado de cuenta |
| `Gym_Catalogo` | Catálogo de ejercicios, descripciones, grupos musculares y prescripciones |
| `Gym_Asignaciones` | Ejercicios asignados por usuario y día |
| `Gym_Sesiones` | Llegada validada, sede utilizada, estado y porcentaje de sesión |
| `Gym_Registros` | Ejercicios completados, series, kg, repeticiones y notas |
| `Gym_Pesos` | Peso corporal por fecha y usuario |
| `Gym_Medidas` | 16 medidas corporales por evaluación |
| `Gym_EVOLT360` | Datos de composición corporal EVOLT 360 |
| `Gym_Config` | Configuración heredada de la versión de una sola sede |
| `Gym_Gimnasios` | Catálogo de sedes, enlaces de Google Maps, coordenadas, radios y estado |
| `Gym_UsuarioGimnasios` | Sedes autorizadas por usuario |

## Seguridad y privacidad

- El backend comprueba el token de Firebase en cada operación y valida los permisos de administrador en el servidor.
- Cada registro de progreso está vinculado al UID de Firebase; un usuario normal no puede consultar datos de otro usuario desde la interfaz.
- El administrador gestiona cuentas y rutinas, pero la pantalla administrativa no expone las medidas corporales privadas de otros usuarios.
- Limita el acceso de edición a la hoja de cálculo y al proyecto de Apps Script solo a personas de confianza.
- Las hojas de Google Sheets son la base de datos; cualquier persona con permisos de edición sobre ellas puede leer sus datos. Configura los permisos de Drive de forma apropiada.


## Navegación multipágina y sesión persistente (actualización)

El frontend ahora incluye `login.html`, `index.html`, `control-corporal.html`, `evolt.html` y `administracion.html`. Todos los HTML cargan la misma lógica compartida para conservar las funciones existentes. Firebase Authentication usa `browserLocalPersistence`, por lo que la sesión se restaura al recargar o volver a abrir el navegador. Las páginas privadas redirigen al login si no hay sesión; Administración requiere rol administrador.

### Publicación

Sube a la raíz de Netlify todos estos archivos: `login.html`, `index.html`, `control-corporal.html`, `evolt.html`, `administracion.html`, `styles.css`, `app.js` y `firebase-config.js`. Mantén `Codigo.gs` en Apps Script, no en Netlify. En Firebase Authentication > Settings > Authorized domains verifica que esté agregado `gymtrack.netlify.app`.

### Apps Script

La URL del frontend apunta a la implementación compartida por el usuario. Si el código de Apps Script cambia, publica una nueva versión de la implementación web. La constante `FIREBASE_API_KEY` de `Codigo.gs` debe coincidir con la API key de `firebase-config.js`.
