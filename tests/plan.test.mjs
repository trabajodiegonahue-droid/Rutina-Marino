// Pruebas del plan (sin navegador): todas las semanas, días, turnos, lago y piscina.
// Uso: node tests/plan.test.mjs
import { loadApp } from '../tools/app-logic.mjs';
const A = loadApp();
let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) passes++; else { fails++; if (fails <= 25) console.log('  ✗ ' + msg); } };
const TEMP = [18, 18, 16, 14, 12, 10, 9, 9, 10, 11, 13, 15];
console.log('Plan completo');
for (let w = 0; w <= 52; w++) for (let dow = 0; dow < 7; dow++) for (const month of [0, 3, 6, 9]) for (const neo of [false, true]) for (const place of ['lago', 'piscina']) for (const turno of ['13', '16', 'libre']) {
  const ctx = { month, place, partner: false, neo, temp: '', barras: '9' };
  const where = `sem ${w} día ${dow + 1} mes ${month + 1} ${place}${neo ? ' neopreno' : ''} turno ${turno}`;
  let plan; try { plan = A.applyShift(A.applyMode(A.dayPlan(w, dow, ctx), ''), turno, 70); } catch (e) { ok(false, `${where}: se cae (${e.message})`); continue; }
  ok(plan.tasks.length > 0, `${where}: día sin tareas`);
  const txt = JSON.stringify(plan);
  ok(!/undefined|NaN|\[object/.test(txt), `${where}: texto roto (${(txt.match(/.{0,30}(undefined|NaN|\[object).{0,10}/) || [''])[0]})`);
  // lago: nada se pasa del tope, con agua muy fría no se entra, y cada nado a tope lleva las reglas del lago
  plan.tasks.filter(t => t.lake).forEach(t => {
    const prot = t.blocks.find(b => b.n === 'Antes de entrar');
    if (!prot) { ok(/en seco$/.test(t.t) && !t.blocks.some(b => b.m), `${where}: ${t.t} sin tope y sin “en seco”`); return; }
    const cap = parseInt(prot.p.replace('máximo ', ''), 10), swim = t.blocks.filter(b => b !== prot && b.tm && !/^(Al salir)$/.test(b.n));
    ok(cap > 0 && cap <= 50, `${where}: tope raro ${prot.p}`);
    ok(swim.every(b => b.tm <= cap * 60), `${where}: ${t.t} tiene un temporizador más largo que el tope de ${cap} min`);
    ok(swim.reduce((a, b) => a + b.tm * (b.s > 1 ? 1 : 1), 0) <= cap * 60 + 60, `${where}: ${t.t} suma más minutos que el tope de ${cap}`);
    ok(t.blocks.every(b => !/brazadas/.test(b.n) || !/aletas|patada/.test(b.p)), `${where}: patada con aletas contada en brazadas`);
  });
  if (place === 'lago') plan.tasks.forEach(t => t.blocks.filter(b => /^Nado [\d.–]+ m$/.test(b.n)).forEach(b => ok(b.opt || /En el lago/.test(b.note || ''), `${where}: nado a tope sin reglas del lago`)));
  // cuerda: nunca más de 8 subidas en una sesión
  plan.tasks.forEach(t => t.blocks.filter(b => b.n === 'Cuerda').forEach(b => ok(b.s <= 8 && /en total/.test(b.p), `${where}: cuerda ${b.p} en ${b.s} series`)));
  // horario: nada a la hora del trabajo y en orden
  const sh = plan.shift; if (sh && sh.leave) { const lv = A.toMin(sh.leave), bk = A.toMin(sh.back) + (A.toMin(sh.back) < 240 ? 1440 : 0);
    plan.tasks.filter(t => t.h && t.id !== 'noche').forEach(t => { const m = A.toMin(t.h) + (A.toMin(t.h) < 240 ? 1440 : 0); ok(m < lv || m >= bk, `${where}: ${t.t} a las ${t.h}, en horario de trabajo`); }); }
}
console.log(`\n${passes} correctas, ${fails} fallidas`);
process.exit(fails ? 1 : 0);
