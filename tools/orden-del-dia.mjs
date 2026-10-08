// Imprime la orden del día con la misma lógica de la app (src/bitacora.html).
// Uso: node tools/orden-del-dia.mjs [AAAA-MM-DD] [--turno 13|16|libre] [--inicio AAAA-MM-DD] [--lugar lago|piscina] [--nube carpeta | --datos bitacora.json]
// --nube: carpeta donde ArtifactData guardó la bitácora (out_dir); --datos: {cfg, days} de la nube de la app; con eso la orden sigue lo que marcaste (días retomados, turno, modo).
import fs from 'node:fs';
import { loadApp, ordenDelDia, readNube } from './app-logic.mjs';
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const datos = opt('nube') ? readNube(opt('nube')) : opt('datos') ? JSON.parse(fs.readFileSync(opt('datos'), 'utf8')) : null;
const dateArg = args.find((a, i) => /^\d{4}-\d{2}-\d{2}$/.test(a) && args[i - 1] !== '--inicio');
const A = loadApp(datos);
const date = dateArg ? A.parse(dateArg) : A.today();
const o = ordenDelDia(A, date, { turno: opt('turno', A.Store.cfg.turno || '13'), start: datos ? undefined : opt('inicio', '2026-10-19'), place: opt('lugar') });
const head = o.L ? `ORDEN DEL DÍA · Semana ${o.L.w} · Día ${o.L.dow + 1} · ${A.dayName(date)} ${A.fmt(date)}\n${o.st.n} · ${o.st.name}${o.L.w === A.HELL ? ' · SEMANA DEL INFIERNO' : ''} · ${o.title}` : `ORDEN DEL DÍA · ${A.dayName(date)} ${A.fmt(date)}`;
console.log(head + '\n' + o.lines.join('\n'));
