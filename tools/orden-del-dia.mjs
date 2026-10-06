// Imprime la orden del día con la misma lógica de la app (src/bitacora.html).
// Uso: node tools/orden-del-dia.mjs [AAAA-MM-DD] [--turno 13|16|libre] [--inicio AAAA-MM-DD] [--lugar lago|piscina]
process.env.TZ = 'America/Santiago';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const dateArg = args.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a) && args[args.indexOf(a) - 1] !== '--inicio');

const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, '..', 'src', 'bitacora.html'), 'utf8');
let js = html.split('<script>')[1].split('</script>')[0];
js = js.replace('Store.init(()=>', 'globalThis.APP={dayPlan,applyMode,applyShift,locate,orders,stageOf,rankOf,Store,parse,iso,dayName,fmt,HELL,TESTS};Store.init(()=>');

const el = { hidden: true, innerHTML: '', textContent: '', contains: () => false };
globalThis.document = { getElementById: () => el, addEventListener() {}, activeElement: null, querySelector: () => null, hidden: false };
globalThis.window = { addEventListener() {} };
globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.sessionStorage = globalThis.localStorage;
try { globalThis.navigator = globalThis.navigator || {}; } catch (e) {}
globalThis.setInterval = () => 0;
new Function(js)();

const A = globalThis.APP;
const cfg = A.Store.cfg;
cfg.start = opt('inicio', cfg.start);
cfg.place = opt('lugar', cfg.place);
const turno = opt('turno', cfg.turno || '13');
const date = dateArg ? A.parse(dateArg) : new Date();
const L = A.locate(date);

const out = [];
if (L.before) {
  out.push(`ORDEN DEL DÍA · ${A.dayName(date)} ${A.fmt(date)}`, `La operación empieza el ${A.fmt(A.parse(cfg.start))}. Hoy: bolso listo y a la cama temprano.`);
} else if (L.after) {
  out.push(`ORDEN DEL DÍA · ${A.dayName(date)} ${A.fmt(date)}`, 'Plan de 52 semanas terminado. Mantención: 3 nados y 2 sesiones de fuerza continua por semana.');
} else {
  const ctx = { month: date.getMonth(), place: cfg.place, partner: cfg.partner, neo: cfg.neo, temp: cfg.temp };
  const plan = A.applyShift(A.applyMode(A.dayPlan(L.w, L.dow, ctx), ''), turno, null);
  const st = A.stageOf(L.w);
  out.push(`ORDEN DEL DÍA · Semana ${L.w} · Día ${L.dow + 1} · ${A.dayName(date)} ${A.fmt(date)}`);
  out.push(`${st.n} · ${st.name}${L.w === A.HELL ? ' · SEMANA DEL INFIERNO' : ''} · ${plan.title}`);
  const say = A.orders(plan, A.iso(date), false, {}).filter(([t]) => t === 'say').map(([, x]) => x)[0];
  if (say) out.push(`«${say}»`);
  out.push('');
  const skip = /^(Calentamiento|Elongación|Autochequeo|La orden|Al salir|Antes de entrar|Cuando quieras parar|Al terminar|Lee|Tarea|Agua|Levántate|Algo liviano|Desayuno|Agua del día|Comida al llegar|Colación para el trabajo|Almuerzo)$/;
  plan.tasks.filter(t => !['despertar', 'desayuno', 'almuerzo', 'noche'].includes(t.id)).forEach(t => {
    const parts = t.blocks.filter(b => !skip.test(b.n)).map(b => b.n + (b.p && b.p !== b.n ? ' ' + b.p : ''));
    out.push(`${t.h ? t.h + ' ' : ''}${t.t}${parts.length && t.kind !== 'estudio' ? ': ' + parts.join(' · ') : ''}`);
  });
  const sh = plan.shift;
  out.push('', `Despiertas ${sh.wake} · entrenas desde ${sh.A}${sh.leave ? ' · sales al trabajo ' + sh.leave : ''} · cama ${sh.bed}`);
}
console.log(out.join('\n'));
