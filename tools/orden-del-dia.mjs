// Imprime la orden del día con la misma lógica de la app (src/bitacora.html).
// Uso: node tools/orden-del-dia.mjs [AAAA-MM-DD] [--turno 13|16|libre] [--inicio AAAA-MM-DD] [--lugar lago|piscina] [--nube carpeta | --datos bitacora.json]
// --eventos: imprime un JSON con un evento por tarea.
// --nube: carpeta donde ArtifactData guardó la bitácora (out_dir); --datos: {cfg, days} de la nube de la app; con eso la orden sigue lo que marcaste (días retomados, turno, modo).
import fs from 'node:fs';
import { loadApp, ordenDelDia, readNube } from './app-logic.mjs';
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const datos = opt('nube') ? readNube(opt('nube')) : opt('datos') ? JSON.parse(fs.readFileSync(opt('datos'), 'utf8')) : null;
const dateArg = args.find((a, i) => /^\d{4}-\d{2}-\d{2}$/.test(a) && args[i - 1] !== '--inicio');
const A = loadApp(datos);
const date = dateArg ? A.parse(dateArg) : A.today();
const o = ordenDelDia(A, date, { turno: opt('turno', A.Store.cfg.turno || '13'), start: datos ? undefined : opt('inicio', '2026-10-21'), place: opt('lugar') });
// --eventos: un evento de calendario por tarea (con aviso a la hora), para crearlos en Google Calendar
if (args.includes('--eventos')) {
  const pad = n => String(n).padStart(2, '0'), base = A.iso(date);
  const at = (h, add) => { let [a, b] = h.split(':').map(Number); let m = a * 60 + b + (add || 0), day = A.parse(base); if (a < 4) m += 1440; day = A.addDays(day, Math.floor(m / 1440)); m %= 1440; return `${A.iso(day)}T${pad(Math.floor(m / 60))}:${pad(m % 60)}:00`; };
  const ev = o.plan.tasks.filter(t => t.h).map(t => ({ summary: '▸ ' + t.t, startTime: at(t.h), endTime: at(t.h, Math.max(10, Math.min(120, Math.round(t.min || t.blocks.reduce((x, b) => x + (b.tm || 0) * (b.s || 1), 0) / 60 || 20)))),
    description: t.blocks.filter(b => !b.opt).map(b => '• ' + b.n + (b.p && b.p !== b.n ? ' ' + b.p : '')).join('\n') + '\n\nMárcalo en la app: https://claude.ai/artifact/Y7MgtsGPPBnXAaGzJpKC7H' }));
  console.log(JSON.stringify(ev, null, 1)); process.exit(0);
}
const head = o.L ? `PLAN DE HOY · Semana ${o.L.w} · Día ${o.L.dow + 1} · ${A.dayName(date)} ${A.fmt(date)}\n${o.st.n} · ${o.st.name}${o.L.w === A.HELL ? ' · SEMANA DEL INFIERNO' : ''} · ${o.title}` : `PLAN DE HOY · ${A.dayName(date)} ${A.fmt(date)}`;
console.log(head + '\n' + o.lines.join('\n'));
