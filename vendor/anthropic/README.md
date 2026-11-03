# Conector de Claude (SDK oficial de Anthropic)

`anthropic-sdk.mjs` es [@anthropic-ai/sdk](https://www.npmjs.com/package/@anthropic-ai/sdk) 0.137.0
(licencia MIT, ver `LICENSE`) empaquetado en un solo archivo para el navegador con esbuild:

    npx esbuild entry.mjs --bundle --format=esm --platform=browser --target=es2019,safari15 --minify

(`entry.mjs` = `export { default } from "@anthropic-ai/sdk";`)

La app lo carga solo si pones tu clave de la API en el asistente (🤖 → ⚙️), en la versión instalada
desde GitHub. La clave queda solo en ese teléfono (`localStorage`, clave `bit-ai`): no va en el
respaldo ni a la nube.
