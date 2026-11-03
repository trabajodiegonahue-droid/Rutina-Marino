# Lector de fotos (OCR)

Archivos de [tesseract.js](https://github.com/naptha/tesseract.js) 5.1.1 y
[tesseract.js-core](https://github.com/naptha/tesseract.js-core) 5.1.1 (licencia Apache 2.0,
ver `LICENSE-*`), más el idioma inglés `eng.traineddata.gz` de
[@tesseract.js-data/eng](https://www.npmjs.com/package/@tesseract.js-data/eng) 1.0.0 (`4.0.0_best_int`).

La app los usa en «📷 Anotar con foto» para leer la captura de adidas Running, Strava o el reloj
dentro del mismo teléfono. Van junto a la app para que funcione sin depender de otro sitio
y, después de la primera vez, sin internet (el service worker los guarda).
