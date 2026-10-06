// Imprime la orden del día con la misma lógica de la app (src/bitacora.html).
// Uso: node tools/orden-del-dia.mjs [AAAA-MM-DD] [--turno 13|16|libre] [--inicio AAAA-MM-DD] [--lugar lago|piscina]
import { loadApp, ordenDelDia } from './app-logic.mjs';
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const dateArg = args.find((a, i) => /^\d{4}-\d{2}-\d{2}$/.test(a) && args[i - 1] !== '--inicio');
const A = loadApp();
const date = dateArg ? A.parse(dateArg) : new Date();
const o = ordenDelDia(A, date, { turno: opt('turno', A.Store.cfg.turno || '13'), start: opt('inicio'), place: opt('lugar') });
const head = o.L ? `ORDEN DEL DÍA · Semana ${o.L.w} · Día ${o.L.dow + 1} · ${A.dayName(date)} ${A.fmt(date)}\n${o.st.n} · ${o.st.name}${o.L.w === A.HELL ? ' · SEMANA DEL INFIERNO' : ''} · ${o.title}` : `ORDEN DEL DÍA · ${A.dayName(date)} ${A.fmt(date)}`;
console.log(head + '\n' + o.lines.join('\n'));
