# Bitácora Buzo Táctico

App de una sola página para seguir, día por día, la rutina de preparación para Buzos Tácticos de la Armada de Chile (semana 0 + 52 semanas en 4 etapas).

- **Hoy**: botón «Empezar la orden» que guía paso a paso (una orden a la vez, serie por serie, con descanso automático); la orden del día, cómo amaneciste (al 100%, cansado o con dolor) y cada sesión con series, repeticiones, metros, ritmos y descansos con temporizador.
- **Plan**: las 53 semanas por etapa (semana del infierno adaptada en la 48), la semana elegida día por día y los ajustes.
- **Progreso**: racha, cumplimiento y resultados de las semanas 0, 13, 26, 39 y 52 contra las metas. Si no llegas a la meta, la app te ofrece repetir las últimas 4 semanas y la prueba.
- **Guía**: cómo usar la app, el curso real, cómo sube el plan, técnica, lago sin compañero y reglas.

Uso: abre `index.html` en el navegador. Los datos se guardan en ese navegador (localStorage).
`src/bitacora.html` es la fuente de la versión publicada como Artifact en claude.ai, que guarda los datos en tu cuenta.

## Pruebas

`npm install` y después `npm test`. Corre tres cosas:

- `tools/orden-del-dia.mjs`: el aviso diario se genera sin errores.
- `tests/plan.test.mjs` (sin navegador): todas las semanas, días, meses, lago y piscina, con y sin neopreno, y los tres turnos. Revisa que ningún texto salga roto, que nada en el lago pase el tope de minutos, que con agua muy fría no se entre, que la cuerda no pase de 8 subidas y que nada caiga en horario de trabajo.
- `tests/app.test.mjs`: abre `index.html` en Chromium y prueba el uso real. Cubre guardado al recargar, racha, turnos, ajustes, temporizador y paso a paso, medianoche, prueba y repetición de semanas, nube con retraso, sin señal y dos dispositivos (con `tests/fake-cloud.js` y `tests/fake-cloud-ctl.js`), respaldo y restauración, progreso, una semana real en el celular y lago con ajustes.

Si Chromium está en otra ruta, usa `CHROMIUM_PATH=/ruta/al/chrome npm test`. `tools/build-index.sh` genera `index.html` desde `src/bitacora.html`.

Si cambias `src/bitacora.html`, regenera `index.html` (es el mismo contenido con `<!doctype html>`, `<head>` y `<body>` alrededor).

## Orden del día por consola

`node tools/orden-del-dia.mjs [AAAA-MM-DD] [--turno 13|16|libre] [--inicio AAAA-MM-DD] [--lugar lago|piscina]` imprime la orden de ese día (o de hoy, hora de Chile) con la misma lógica de la app. Lo usa el aviso diario de Claude.

## Calendario

`node tools/calendario.mjs [AAAA-MM-DD desde] [días] [--turno 13|16|libre] > archivo.ics` genera un calendario con la orden de cada día (aviso 15 min antes y a la hora). `calendario/bitacora-8-semanas.ics` trae del 7 oct al 1 dic 2026 con el turno de 13:00. Para importarlo en Google Calendar: en el computador, Configuración → Importar y exportar → Importar; conviene crear antes un calendario aparte ("Bitácora") para poder borrarlo entero si cambias el plan.
