// Carga la lógica de la app (src/bitacora.html) en Node, sin navegador.
process.env.TZ = 'America/Santiago';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export function loadApp() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const html = fs.readFileSync(path.join(here, '..', 'src', 'bitacora.html'), 'utf8');
  let js = html.split('<script>')[1].split('</script>')[0];
  // Solo la lógica del plan: la pantalla nunca se dibuja aquí (Store.init no se llama),
  // así los cambios de diseño de la app no pueden romper el aviso diario ni el calendario.
  js = js.replace('Store.init(()=>', 'globalThis.APP={dayPlan,applyMode,applyShift,locate,orders,stageOf,rankOf,Store,parse,iso,dayName,fmt,HELL,TESTS,toMin,fromMin};(()=>{})(()=>');
  const el = { hidden: true, innerHTML: '', textContent: '', contains: () => false };
  const cl = { classList: { toggle() {}, add() {}, remove() {} } };
  globalThis.document = { getElementById: () => el, addEventListener() {}, activeElement: null, querySelector: () => null, hidden: false, documentElement: cl, body: cl };
  globalThis.window = { addEventListener() {} };
  globalThis.localStorage = { getItem: () => null, setItem() {} };
  globalThis.sessionStorage = globalThis.localStorage;
  try { globalThis.navigator = globalThis.navigator || {}; } catch (e) {}
  globalThis.setInterval = () => 0;
  new Function(js)();
  return globalThis.APP;
}
// Texto de la orden de un día (lo usan el aviso diario y el calendario).
export function ordenDelDia(A, date, { turno = '13', start, place } = {}) {
  const cfg = A.Store.cfg;
  if (start) cfg.start = start;
  if (place) cfg.place = place;
  const L = A.locate(date), out = [];
  if (L.before) return { title: 'Antes del inicio', lines: [`La operación empieza el ${A.fmt(A.parse(cfg.start))}.`], rest: true };
  const ctx = { month: date.getMonth(), place: cfg.place, partner: cfg.partner, neo: cfg.neo, temp: cfg.temp };
  // después de la semana 52, la app da una semana de mantención (la 47 con menos carga)
  const base = L.after ? Object.assign(A.dayPlan(47, L.dow, ctx), { w: 52, deload: false, maint: true }) : A.dayPlan(L.w, L.dow, ctx);
  if (L.after) base.title = 'Mantención · ' + base.title;
  const plan = A.applyShift(A.applyMode(base, ''), turno, null);
  const st = L.after ? { n: 'Mantención', name: 'Plan terminado' } : A.stageOf(L.w);
  const say = A.orders(plan, A.iso(date), false, {}).filter(([t]) => t === 'say').map(([, x]) => x)[0];
  const skip = /^(Calentamiento|Elongación|Autochequeo|La orden|Al salir|Antes de entrar|Cuando quieras parar|Al terminar|Lee|Tarea|Agua|Levántate|Algo liviano|Desayuno|Agua del día|Comida al llegar|Colación para el trabajo|Almuerzo)$/;
  if (say) out.push(`«${say}»`, '');
  plan.tasks.filter(t => !['despertar', 'desayuno', 'almuerzo', 'noche'].includes(t.id)).forEach(t => {
    const h = t.h ? t.h + ' ' : '';
    // lago: el tope de minutos y las reglas van siempre en el aviso; con agua muy fría, no se entra
    if (/ · en seco$/.test(t.t)) { out.push(`${h}HOY NO ENTRAS AL LAGO (agua muy fría): técnica en seco 20 min, como dice la app.`); return; }
    const prot = t.blocks.find(b => b.n === 'Antes de entrar');
    const parts = t.blocks.filter(b => !skip.test(b.n)).map(b => b.opt && /^Nado /.test(b.n) ? `${b.n}: en piscina o pendiente (agua muy fría)` : b.n + (b.p && b.p !== b.n ? ' ' + b.p : '') + (/^En el lago: máximo (\d+) min/.test(b.note || '') ? ` (lago: máximo ${b.note.match(/máximo (\d+) min/)[1]} min, solo donde haces pie)` : ''));
    out.push(`${h}${t.t}${prot ? ` [máximo ${prot.p.replace('máximo ', '')} en el agua · solo donde haces pie · avisa a alguien]` : ''}${parts.length && t.kind !== 'estudio' ? ': ' + parts.join(' · ') : ''}`);
    if (t.safe && !prot) out.push(`   ⚠ ${t.safe}`);
  });
  const sh = plan.shift;
  out.push('', `Despiertas ${sh.wake} · entrenas desde ${sh.A}${sh.leave ? ' · sales al trabajo ' + sh.leave : ''} · cama ${sh.bed}`);
  if (turno === '13') { const s16 = A.applyShift(A.applyMode(base, ''), '16', null).shift; out.push(`Si hoy entras a las 16:00: despiertas ${s16.wake} · entrenas desde ${s16.A} · sales ${s16.leave} · cama ${s16.bed} (en la app toca «Entro 16:00»).`); }
  out.push('Si repetiste semanas o cambiaste ajustes, manda lo que dice la app.');
  return { L: L.after ? null : L, plan, st, shift: sh, title: plan.title, lines: out, rest: plan.kind === 'descanso', test: plan.test };
}
