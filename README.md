# Pastillas

Registro personal de medicamentos hecho con React, Vite, Firebase y modo PWA. Tiene dos calendarios con vistas de mes, semana y año: **Mis tomas** para uso ocasional y registros históricos, y **Tratamientos** para medicación programada. Pulsa una fecha para abrir sus detalles; las tomas aparecen como etiquetas bajo el número del día. La semana muestra el medicamento, su icono, hora y estado.

## Desarrollo

Requiere Node.js 24.12 o posterior.

1. Ejecuta npm install.
2. Ejecuta npm run dev.
3. Ejecuta npm run build para generar dist.

La entrada de desarrollo es `app/index.html`. La raíz `index.html` contiene el build publicado, por lo que Vite usa la carpeta `app` para compilar siempre el código fuente actualizado.

## Firebase

En Firebase Console, para el proyecto regis-b73aa:

1. En Authentication > Sign-in method, habilita Anonymous.
2. En Authentication > Settings > Authorized domains, añade sxmmy123.github.io para que funcione el inicio anónimo en GitHub Pages. Añade también cualquier dominio propio que uses.
3. Crea Firestore Database.
4. En Firestore > Rules, pega el contenido de firestore.rules y publícalo.

Las reglas permiten a cada usuario anónimo acceder solo a usuarios/{uid} y sus registros, donde uid es su identidad Firebase. Dos personas con el mismo nombre quedan separadas y el perfil muestra un identificador corto. Si este proyecto Firebase ya guarda datos de otra aplicación, revisa sus reglas antes de reemplazarlas: estas reglas cierran el acceso a cualquier otra ruta.

El nombre es una etiqueta visible, no una credencial. La identidad anónima se conserva en ese navegador, pero no se recupera automáticamente en otro dispositivo o después de borrar los datos del navegador.

## Registros anteriores

Las claves antiguas YYYY-MM-DD con valor tomada se conservan intactas. La app las lee al iniciar, sin esperar a Firebase y aunque cambie la identidad anónima, y las presenta como “Pastilla sin especificar · hora no registrada”. También guarda una copia duradera en el historial actual y las sincroniza asociadas al usuario anónimo cuando Firebase está disponible. El enlace bajo el calendario lleva al mes del último registro histórico.

LocalStorage pertenece a un navegador y un origen concretos. Para recuperar las fechas anteriores debes abrir el mismo navegador y la dirección donde las guardaste. Un navegador integrado, otro perfil, otro dispositivo o una página local no pueden acceder a ese almacenamiento. La aplicación nunca borra las claves originales ni inventa un medicamento u hora para esas fechas.

## Registro rápido

El botón + en móvil y Registrar toma en escritorio abren el modal de registro. Las seis pastillas más registradas se ordenan por frecuencia, agrupando nombres con diferencias de mayúsculas, acentos y espacios, y se guardan con un toque. Estos botones representan frecuencia de uso registrada; no son recomendaciones de consumo. También puedes escribir otra pastilla y ajustar fecha u hora para recuperar una toma olvidada. Las tomas nuevas conservan los segundos; en el detalle se muestra el tiempo desde la toma anterior del mismo medicamento y, para tratamientos, la diferencia con la hora prevista.

## Tratamientos y avisos

Cada tratamiento permite elegir fecha inicial, hora, repetición en días o semanas y duración en días, semanas, meses o sin fecha final. Los tratamientos pausados dejan de crear tomas futuras en el calendario. El aviso al abrir la app se puede desactivar desde el perfil. Los avisos del navegador requieren permiso y se programan mientras la app permanece abierta; el aviso al abrir sirve como recordatorio adicional.

El informe se abre desde **Informe para el médico** en escritorio o el icono de documento en móvil. Es un modal independiente con periodo, fecha de referencia y filtro de tomas ocasionales, tratamientos o ambas. La impresión incluye únicamente el informe con cantidades por medicamento y una tabla de fechas, horas y tipo de toma; permite guardarlo como PDF desde el diálogo del dispositivo.

## GitHub Pages

El workflow de .github/workflows/pages.yml construye y publica dist en cada push a main. También copia el build a la raíz para que la página funcione si GitHub Pages está configurado para publicar main desde la carpeta raíz. Después de cambiar la app, ejecuta `npm run build:pages` antes de confirmar los cambios.
