# Pastillas

Registro personal de medicamentos hecho con React, Vite, Firebase y modo PWA. La vista diaria está pensada primero para móvil: muestra la hora programada y la hora real, y permite comparar la diferencia.

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

## GitHub Pages

El workflow de .github/workflows/pages.yml construye y publica dist en cada push a main. En Settings > Pages, selecciona GitHub Actions como publishing source.
