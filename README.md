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

## Entrada por nombre

Al entrar se pide solamente el nombre. Escribir **Sxmy** en cualquier dispositivo abre el mismo historial, también tras pasar tiempo. Se conserva la configuración Firebase del proyecto `regis-b73aa` y el acceso anónimo: la identidad anónima autentica la instalación y el nombre selecciona el perfil compartido. El nombre queda recordado en el navegador; desde **Perfil y recordatorios > Entrar con otro nombre** se puede cambiar de perfil. El nombre se recorta en sus extremos y se normaliza a Unicode NFC; distingue mayúsculas, por lo que **Sxmy** y **sxmy** son perfiles diferentes.

El usuario eligió explícitamente acceso solo por nombre, sin clave. Cualquier persona que escriba el mismo nombre comparte la lectura y edición de ese historial. No se permite listar todos los perfiles. Los nuevos datos se guardan en `perfiles/{SHA256(nombre)}/registros`, y cada instalación mantiene su selección en `sesiones/{uid}`. El hash proporciona una ruta estable, no una contraseña ni protección frente a quien conozca el nombre.

**Publica el archivo `firestore.rules` actualizado**: las reglas anteriores que permitían únicamente `usuarios/{uid}` no sirven para este acceso. La página `configurar-firebase.html` ofrece **Copiar reglas completas**, instrucciones y un enlace a la consola. Cada build genera esta página y `reglas-firebase.txt` a partir del archivo de reglas. La migración consulta los perfiles antiguos de `usuarios` con `displayName == nombre` y copia sus registros y tratamientos al perfil compartido. Los originales se conservan. La marca de importación se guarda después de subir las tomas, para que un corte de conexión no dé la migración por terminada prematuramente. Las eliminaciones se sincronizan en `eliminados` y evitan que otro dispositivo recupere por error una toma eliminada.

Las copias locales se separan por perfil y están disponibles sin conexión. **Volver a cargar desde Firebase** reintenta la lectura tras corregir reglas o conexión. Los errores aparecen sobre el calendario. Las copias de sesiones anteriores de este navegador se pueden recuperar con confirmación. Los cambios de otro dispositivo se reciben en tiempo real mientras la aplicación está abierta. Si el mes actual no tiene tomas, al cargar un historial se muestra el último mes con registros; **Hoy** vuelve a la fecha actual.

## Registros anteriores

Las claves antiguas YYYY-MM-DD con valor tomada se conservan intactas. La app las lee al iniciar, sin esperar a Firebase y aunque cambie la identidad anónima, y las presenta como “Pastilla sin especificar · hora no registrada”. También guarda una copia duradera en el historial actual y las sincroniza asociadas al usuario anónimo cuando Firebase está disponible. Puedes pulsar una pastilla registrada para añadir o corregir su nombre en un modal, incluso en los registros históricos: se mantienen su fecha y hora y las claves originales de LocalStorage. El enlace bajo el calendario lleva al mes del último registro histórico.

LocalStorage pertenece a un navegador y un origen concretos. Las fechas antiguas que solo existen localmente requieren abrir el navegador donde se guardaron para subir su copia al perfil por nombre. Los registros que ya están en Firebase bajo `displayName` se recuperan por ese nombre desde otros dispositivos. La aplicación nunca borra las claves originales ni inventa un medicamento u hora para esas fechas.

## Registro rápido

El botón + en móvil y Registrar toma en escritorio abren el modal de registro. Puedes guardar una toma sin nombre; aparecerá como “Pastilla sin especificar” y podrás nombrarla después al pulsarla. Las seis pastillas con nombre más registradas se ordenan por frecuencia, agrupando diferencias de mayúsculas, acentos y espacios, y se guardan con un toque. Las tomas sin especificar no aparecen en estos botones; los registros históricos cuentan una vez que les añades un nombre. Estos botones representan frecuencia de uso registrada; no son recomendaciones de consumo. También puedes escribir otra pastilla y ajustar fecha u hora para recuperar una toma olvidada. Las tomas nuevas conservan los segundos; en el detalle se muestra el tiempo desde la toma anterior del mismo medicamento y, para tratamientos, la diferencia con la hora prevista.

Sobre el calendario hay un catálogo compacto con los nombres de pastillas ya registradas. Pulsa una para abrir el registro o arrástrala hasta un día: en escritorio, arrastra directamente; en móvil, mantén pulsado y luego arrastra. Al soltarla en hoy se conserva la hora exacta del arrastre y aparece una cuenta atrás de cuatro segundos con **Anular**. La toma se guarda únicamente al terminar la cuenta; si la anulas, no se escribe en LocalStorage ni Firebase. Para fechas anteriores se abre un modal que exige elegir la hora real y, al confirmar, comienza la misma cuenta atrás. Cada toma pendiente se puede anular por separado; las fechas futuras no aceptan registros por arrastre.

Al tocar una pastilla del calendario puedes completar su nombre o elegir **Eliminar esta toma**, con confirmación. La papelera del detalle del día ofrece la misma acción, también para registros históricos. Las eliminaciones se recuerdan al recargar y se sincronizan cuando Firebase está disponible. Los registros originales de LocalStorage se conservan intactos y la app omite solamente las tomas que hayas decidido eliminar.

## Tratamientos y avisos

Los nuevos tratamientos se organizan por **cantidad de pastillas** y **pastillas por toma**. Se puede elegir cada ciertas horas (6, 8, 10, 12 o un intervalo personalizado), cada mañana, cada noche o mañana y noche con horas independientes e iconos de sol y luna. La fecha final se calcula por la cantidad, sin pedir duración. La vista previa muestra las primeras tomas, la última y si habrá tomas de madrugada (00:00–05:59). Los intervalos en horas mantienen el tiempo transcurrido exacto; los horarios diarios conservan sus horas locales. La aplicación no omite ni cambia automáticamente tomas nocturnas.

Una pauta de dos pastillas, una por toma, cada ocho horas desde las 08:00 programa 08:00 y 16:00. Cada ocurrencia tiene su identidad propia: varias tomas del mismo tratamiento pueden registrarse en un día. Registrar una toma descuenta la cantidad correspondiente; eliminarla devuelve esas pastillas a las disponibles. Para una fecha anterior se pide la hora real, sin inventarla.

Cuando quedan las dos últimas pastillas (o ya no se completa otra toma), la app ofrece reponer después de haber registrado al menos una toma. **No, terminar al acabarlas** conserva las tomas restantes y evita nuevas preguntas para esa compra. **Sí** permite añadir la cantidad comprada y extender el calendario. **Voy a comprarlas** alarga el calendario con tomas **Por comprar**, pero no aumenta las existencias disponibles. Para registrar esas tomas y recibir avisos hay que confirmar que la compra ya está disponible. Una compra pendiente se puede cancelar. Las reposiciones mantienen el historial; si el calendario ya terminó, las nuevas tomas retoman la siguiente hora futura de la misma pauta y no rellenan fechas pasadas con una compra posterior. Las pastillas sueltas que no completan una toma se conservan y se acumulan con la siguiente compra.

Los tratamientos anteriores se conservan con su horario original. Desde Administrar se pueden pasar a cantidad creando una pauta nueva y pausando la anterior, sin modificar sus registros. Pausar un tratamiento oculta sus tomas pendientes; los registros realizados siguen visibles. El aviso al abrir la app se puede desactivar desde el perfil. Las notificaciones del navegador requieren permiso y se programan para cada toma de hoy y mañana mientras la app permanece abierta; no se promete una alarma con la PWA cerrada.

## Estadísticas e informe para la consulta

**Estadísticas e informe** en escritorio y **Seguimiento** en la navegación móvil abren una página de estadísticas. Primero muestra tomas registradas, días con tomas, pastillas seleccionadas y actividad del periodo. La tabla permite elegir las pastillas por nombre e icono y filtrar uso ocasional, tratamientos o ambos. Las pastillas sin nombre siguen disponibles como **Pastilla sin especificar**.

El selector de fechas permite tocar el inicio, deslizar entre meses en el celular y tocar el final. Las fechas del intervalo se rellenan en secuencia y la fecha final tiene una breve animación de parada. También hay periodos rápidos (este mes, mes anterior, 30 días y todo), salto a un mes y entrada manual de fechas. Respeta la preferencia de movimiento reducido. Durante la selección del final no se puede preparar un informe incompleto.

**Preparar informe** abre la vista previa con la selección elegida. El PDF se genera en el dispositivo con tipografía incluida, resumen visual, iconos, gráfico de actividad, tabla por pastilla y detalle de fechas, horas, tipo de registro y tiempo entre tomas de la misma pastilla. No inventa nombres ni horas: los datos ausentes se indican y no se calcula un intervalo exacto a través de una hora desconocida. Las cifras cuentan registros, no dosis ni cantidad de comprimidos.

En navegadores que comparten archivos, **Compartir PDF** abre el selector del dispositivo; la descarga queda disponible. En los demás se ofrece **Descargar PDF**. El archivo se prepara antes de pulsar Compartir para conservar la activación necesaria del navegador. La aplicación no envía el informe a ningún destinatario por sí sola. La impresión conserva únicamente el informe. Las dependencias y las fuentes del PDF se incluyen en el caché de la PWA.

## GitHub Pages

La PWA usa un icono minimalista de cápsula con fondo verde. El manifest incluye PNG de 192 y 512 píxeles y una versión maskable; el HTML añade el icono Apple de 180 píxeles. El SVG es la fuente vectorial y el favicon. El caché de cada publicación incluye estos archivos y cambia también cuando se modifica únicamente un icono o el manifest.

El workflow de .github/workflows/pages.yml construye y publica dist en cada push a main. También copia el build a la raíz para que la página funcione si GitHub Pages está configurado para publicar main desde la carpeta raíz. Después de cambiar la app, ejecuta `npm run build:pages` antes de confirmar los cambios.
