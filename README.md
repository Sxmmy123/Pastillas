# Pastillas

Registro personal de medicamentos hecho con React, Vite, Firebase y modo PWA. Tiene dos calendarios con vistas de mes, semana y año: **Mis tomas** para uso ocasional y registros históricos, y **Tratamientos** para medicación programada. En móvil, desliza horizontalmente el calendario para cambiar de periodo; en escritorio, usa las flechas grandes de sus costados. Pulsa una fecha para abrir sus detalles. El mes muestra únicamente pequeños iconos de pastilla bajo el día; la semana muestra el medicamento, su icono, hora y estado. El año mantiene la vista compacta. Los gestos táctiles se procesan directamente y conservan el desplazamiento vertical de la página.

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

Las claves antiguas YYYY-MM-DD con valor tomada se conservan intactas. La app las lee al iniciar, sin esperar a Firebase y aunque cambie la identidad anónima, y las presenta como “Pastilla sin especificar · hora no registrada”. También guarda una copia duradera en el historial actual y las sincroniza asociadas al usuario anónimo cuando Firebase está disponible. Puedes pulsar una pastilla registrada para añadir o corregir su nombre en un modal, incluso en los registros históricos: se mantienen su fecha y hora y las claves originales de LocalStorage. El enlace bajo el calendario lleva al mes del último registro histórico.

LocalStorage pertenece a un navegador y un origen concretos. Para recuperar las fechas anteriores debes abrir el mismo navegador y la dirección donde las guardaste. Un navegador integrado, otro perfil, otro dispositivo o una página local no pueden acceder a ese almacenamiento. La aplicación nunca borra las claves originales ni inventa un medicamento u hora para esas fechas.

## Registro rápido

El botón + en móvil y Registrar toma en escritorio abren el modal de registro. Puedes guardar una toma sin nombre; aparecerá como “Pastilla sin especificar” y podrás nombrarla después al pulsarla. Las seis pastillas con nombre más registradas se ordenan por frecuencia, agrupando diferencias de mayúsculas, acentos y espacios, y se guardan con un toque. Las tomas sin especificar no aparecen en estos botones; los registros históricos cuentan una vez que les añades un nombre. Estos botones representan frecuencia de uso registrada; no son recomendaciones de consumo. También puedes escribir otra pastilla y ajustar fecha u hora para recuperar una toma olvidada. Las tomas nuevas conservan los segundos; en el detalle se muestra el tiempo desde la toma anterior del mismo medicamento y, para tratamientos, la diferencia con la hora prevista.

Sobre el calendario hay un catálogo compacto con los nombres de pastillas ya registradas. Pulsa una para abrir el registro o arrástrala hasta un día: en escritorio, arrastra directamente; en móvil, mantén pulsado y luego arrastra. Al soltarla en hoy se conserva la hora exacta del arrastre y aparece una cuenta atrás de cuatro segundos con **Anular**. La toma se guarda únicamente al terminar la cuenta; si la anulas, no se escribe en LocalStorage ni Firebase. Para fechas anteriores se abre un modal que exige elegir la hora real y, al confirmar, comienza la misma cuenta atrás. Cada toma pendiente se puede anular por separado; las fechas futuras no aceptan registros por arrastre.

Al tocar una pastilla del calendario puedes completar su nombre o elegir **Eliminar esta toma**, con confirmación. La papelera del detalle del día ofrece la misma acción, también para registros históricos. Las eliminaciones se recuerdan al recargar y se sincronizan cuando Firebase está disponible. Los registros originales de LocalStorage se conservan intactos y la app omite solamente las tomas que hayas decidido eliminar.

## Tratamientos y avisos

Cada tratamiento permite elegir fecha inicial, hora, repetición en días o semanas y duración en días, semanas, meses o sin fecha final. Los tratamientos pausados dejan de crear tomas futuras en el calendario. El aviso al abrir la app se puede desactivar desde el perfil. Los avisos del navegador requieren permiso y se programan mientras la app permanece abierta; el aviso al abrir sirve como recordatorio adicional.

El informe se abre desde **Informe para el médico** en escritorio o el icono de documento en móvil. Es un modal independiente con periodo, selector de mes para la consulta mensual y filtro de tomas ocasionales, tratamientos o ambas. Una tabla resume las tomas por medicamento, los días con consumo y el porcentaje de registros del periodo; las tomas sin nombre se agrupan como sin especificar. Otra tabla conserva el detalle de fechas, horas y tipo de toma. La impresión incluye únicamente el informe y permite guardarlo como PDF desde el diálogo del dispositivo.

## GitHub Pages

La PWA usa un icono minimalista de cápsula con fondo verde. El manifest incluye PNG de 192 y 512 píxeles y una versión maskable; el HTML añade el icono Apple de 180 píxeles. El SVG es la fuente vectorial y el favicon. El caché de cada publicación incluye estos archivos y cambia también cuando se modifica únicamente un icono o el manifest.

El workflow de .github/workflows/pages.yml construye y publica dist en cada push a main. También copia el build a la raíz para que la página funcione si GitHub Pages está configurado para publicar main desde la carpeta raíz. Después de cambiar la app, ejecuta `npm run build:pages` antes de confirmar los cambios.
