# Pastillas

Registro personal de medicamentos hecho con React, Vite, Firebase y modo PWA. El calendario es la pantalla principal y ofrece vistas de mes, semana y año. Desde una fecha puedes registrar una toma con la hora actual, programar tratamientos recurrentes y revisar o imprimir el consumo del periodo para compartirlo con tu médico.

## Desarrollo

Requiere Node.js 24.12 o posterior.

1. Ejecuta npm install.
2. Ejecuta npm run dev.
3. Ejecuta npm run build para generar dist.

## Firebase

En Firebase Console, para el proyecto regis-b73aa:

1. En Authentication > Sign-in method, habilita Anonymous.
2. En Authentication > Settings > Authorized domains, añade sxmmy123.github.io para que funcione el inicio anónimo en GitHub Pages. Añade también cualquier dominio propio que uses.
3. Crea Firestore Database.
4. En Firestore > Rules, pega el contenido de firestore.rules y publícalo.

Las reglas permiten a cada usuario anónimo acceder solo a usuarios/{uid} y sus registros, donde uid es su identidad Firebase. Dos personas con el mismo nombre quedan separadas y el perfil muestra un identificador corto. Si este proyecto Firebase ya guarda datos de otra aplicación, revisa sus reglas antes de reemplazarlas: estas reglas cierran el acceso a cualquier otra ruta.

El nombre es una etiqueta visible, no una credencial. La identidad anónima se conserva en ese navegador, pero no se recupera automáticamente en otro dispositivo o después de borrar los datos del navegador.

## Registros anteriores

Las claves antiguas YYYY-MM-DD con valor tomada se conservan intactas. La app las presenta como “Pastilla sin especificar · hora no registrada” y las sincroniza asociadas al usuario anónimo. Los registros nuevos se guardan en una clave independiente de LocalStorage y en Firestore.

## Tratamientos y avisos

Cada tratamiento permite elegir fecha inicial, hora, repetición en días o semanas y duración en días, semanas, meses o sin fecha final. Los tratamientos pausados dejan de crear tomas futuras en el calendario. El aviso al abrir la app se puede desactivar desde el perfil. Los avisos del navegador requieren permiso y se programan mientras la app permanece abierta; el aviso al abrir sirve como recordatorio adicional.

La sección “Consumo del periodo” permite imprimir el calendario y las tomas del mes, semana o año seleccionados, o guardarlos como PDF desde el diálogo de impresión del dispositivo.

## GitHub Pages

El workflow de .github/workflows/pages.yml construye y publica dist en cada push a main. También copia el build a la raíz para que la página funcione si GitHub Pages está configurado para publicar main desde la carpeta raíz. Después de cambiar la app, ejecuta `npm run build:pages` antes de confirmar los cambios.
