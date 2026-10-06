# Bitácora Buzo Táctico

App de una sola página para seguir, día por día, la rutina de preparación para Buzos Tácticos de la Armada de Chile (semana 0 + 52 semanas en 4 etapas).

- **Hoy**: botón «Empezar la orden» que guía paso a paso (una orden a la vez, serie por serie, con descanso automático); la orden del día, cómo amaneciste (al 100%, cansado o con dolor) y cada sesión con series, repeticiones, metros, ritmos y descansos con temporizador.
- **Plan**: las 53 semanas por etapa (semana del infierno adaptada en la 48), la semana elegida día por día y los ajustes.
- **Progreso**: racha, cumplimiento y resultados de las semanas 0, 13, 26, 39 y 52 contra las metas. Si no llegas a la meta, la app te ofrece repetir las últimas 4 semanas y la prueba.
- **Guía**: cómo usar la app, el curso real, cómo sube el plan, técnica, lago sin compañero y reglas.

Uso: abre `index.html` en el navegador. Los datos se guardan en ese navegador (localStorage).
`src/bitacora.html` es la fuente de la versión publicada como Artifact en claude.ai, que guarda los datos en tu cuenta.

## Pruebas

`npm install` y después `npm test`. Las pruebas abren `index.html` en Chromium y revisan: guardado del progreso, día cumplido y racha, turnos, ajustes, fecha de inicio, temporizador, modo paso a paso, cambio de día a medianoche, prueba de evaluación con repetición de semanas, navegación, guardado en la nube con retraso (con `tests/fake-cloud.js`) y doble toque. Si Chromium está en otra ruta, usa `CHROMIUM_PATH=/ruta/al/chrome npm test`.

Si cambias `src/bitacora.html`, regenera `index.html` (es el mismo contenido con `<!doctype html>`, `<head>` y `<body>` alrededor).

## Orden del día por consola

`node tools/orden-del-dia.mjs [AAAA-MM-DD] [--turno 13|16|libre] [--inicio AAAA-MM-DD] [--lugar lago|piscina]` imprime la orden de ese día (o de hoy, hora de Chile) con la misma lógica de la app. Lo usa el aviso diario de Claude.
