#!/bin/sh
# Genera index.html (versión para abrir en el navegador) desde src/bitacora.html.
cd "$(dirname "$0")/.." || exit 1
{ printf '<!doctype html>\n<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n'; cat src/bitacora.html; printf '\n</body></html>\n'; } > index.html
