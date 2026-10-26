#!/bin/sh
# Genera index.html (versión para abrir en el navegador) desde src/bitacora.html.
cd "$(dirname "$0")/.." || exit 1
{ printf '<!doctype html>\n<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0D0F12"><link rel="manifest" href="manifest.webmanifest"><link rel="apple-touch-icon" href="icon-180.png"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="Atleta"></head><body>\n'; cat src/bitacora.html; printf '\n</body></html>\n'; } > index.html
