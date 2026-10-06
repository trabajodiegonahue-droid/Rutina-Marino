// Pruebas de la app en un navegador real (Playwright + Chromium).
// Uso: node tests/app.test.mjs   (requiere el paquete playwright)
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const here = path.dirname(fileURLToPath(import.meta.url));
const URL = 'file://' + path.join(here, '..', 'index.html');
const exe = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) { passes++; } else { fails++; console.log('  ✗ ' + msg); } };
async function page(time) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 1200 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.clock.install({ time: new Date(time) });
  await p.goto(URL); await p.waitForTimeout(200);
  return { p, ctx, errs };
}
const text = p => p.$eval('#app', e => e.textContent);
const reload = async p => { await p.reload(); await p.waitForTimeout(200); };

// 1. Progreso diario: las series marcadas quedan guardadas al recargar
{ console.log('1. Guardado del progreso');
  const { p, ctx, errs } = await page('2026-10-13T09:00:00');
  const first = p.locator('.dot').first();
  await first.click();
  ok(await first.evaluate(e => e.classList.contains('on')), 'la serie se marca');
  await reload(p);
  ok(await p.locator('.dot').first().evaluate(e => e.classList.contains('on')), 'la serie sigue marcada después de recargar');
  await p.click('[data-mode="cansado"]'); await reload(p);
  ok(await p.locator('[data-mode="cansado"]').evaluate(e => e.classList.contains('on')), '“Cansado” queda guardado');
  await p.locator('summary', { hasText: 'Notas' }).click(); await p.fill('#f-note', 'hoy costó');
  await reload(p); await p.locator('summary', { hasText: 'Notas' }).click();
  ok(await p.inputValue('#f-note') === 'hoy costó', 'la nota queda guardada');
  ok(errs.length === 0, 'sin errores: ' + errs.join(' | '));
  await ctx.close(); }

// 2. Cumplir el día y la racha
{ console.log('2. Día cumplido y racha');
  const { p, ctx } = await page('2026-10-13T09:00:00');
  await p.click('[data-st="done"]');
  ok((await text(p)).includes('Misión cumplida'), 'muestra misión cumplida');
  ok((await text(p)).includes('Racha 1'), 'la racha sube a 1');
  await reload(p);
  ok((await text(p)).includes('Racha 1'), 'la racha se mantiene al recargar');
  await p.click('[data-clear]');
  ok((await text(p)).includes('Racha 0'), 'desmarcar el día baja la racha');
  await ctx.close(); }

// 3. Turno: cambian las horas y queda guardado
{ console.log('3. Turno de trabajo');
  const { p, ctx } = await page('2026-10-13T09:00:00');
  ok((await text(p)).includes('Despiertas 7:30'), 'turno 13 por defecto');
  await p.click('[data-turno="16"]');
  ok((await text(p)).includes('Despiertas 9:15'), 'turno 16 cambia la hora');
  await reload(p);
  ok((await text(p)).includes('Despiertas 9:15'), 'el turno del día queda guardado');
  await p.click('[data-go="1"]');
  ok((await text(p)).includes('Despiertas 7:30'), 'el día siguiente vuelve al turno habitual');
  await ctx.close(); }

// 4. Ajustes: cambian el plan
{ console.log('4. Ajustes');
  const { p, ctx } = await page('2026-10-13T09:00:00');
  ok((await text(p)).includes('· lago'), 'lago por defecto');
  await p.click('[data-tab="plan"]');
  await p.click('[data-cset="place|piscina"]');
  await p.fill('#c-peso', '80'); await p.fill('#c-maxb', '10'); await p.fill('#c-name', 'Diego');
  await p.click('[data-tab="hoy"]');
  const t = await text(p);
  ok(!t.includes('· lago'), 'piscina quita el modo lago');
  ok(!/× \d+ brazadas/.test(t) && t.includes('150 m suave'), 'piscina muestra metros, no brazadas');
  ok(t.includes('4 × 8'), 'barras = máximo 10 − 2');
  await reload(p);
  ok((await text(p)).includes('4 × 8'), 'el máximo de barras queda guardado');
  await p.click('[data-tab="plan"]');
  ok(await p.inputValue('#c-peso') === '80', 'el peso queda guardado');
  await p.click('[data-cset="partner|true"]'); await p.click('[data-tab="hoy"]');
  for (let i = 0; i < 5; i++) await p.click('[data-go="1"]'); // día 6: nado largo + apnea
  ok((await text(p)).includes('Apnea supervisada'), 'con compañero y piscina aparece la apnea supervisada');
  await p.click('[data-tab="plan"]'); await p.click('[data-cset="partner|false"]'); await p.click('[data-tab="hoy"]');
  ok(!(await text(p)).includes('Apnea supervisada'), 'sin compañero no hay apnea en el agua');
  await ctx.close(); }

// 5. Fecha de inicio: mover el inicio mueve las semanas
{ console.log('5. Fecha de inicio');
  const { p, ctx } = await page('2026-10-13T09:00:00');
  ok((await text(p)).includes('SEM 1 · DÍA 1'), 'hoy es semana 1 día 1');
  await p.click('[data-tab="plan"]');
  await p.fill('#c-start', '2026-10-13'); await p.dispatchEvent('#c-start', 'change');
  await p.click('[data-tab="hoy"]');
  ok((await text(p)).includes('SEM 0 · DÍA 1'), 'con inicio hoy, es semana 0 día 1');
  await reload(p);
  ok((await text(p)).includes('SEM 0 · DÍA 1'), 'la fecha de inicio queda guardada');
  await ctx.close(); }

// 6. Temporizador
{ console.log('6. Temporizador');
  const { p, ctx } = await page('2026-10-13T09:00:00');
  await p.locator('.tmr').first().click();
  ok(await p.isVisible('#timerbar .tin'), 'se abre el temporizador');
  const t0 = await p.$eval('#timerbar b', e => e.textContent);
  await p.clock.runFor(3000);
  const t1 = await p.$eval('#timerbar b', e => e.textContent);
  ok(t0 !== t1, `cuenta hacia atrás (${t0} → ${t1})`);
  await p.click('[data-tstop]');
  ok(!(await p.isVisible('#timerbar .tin')), 'parar lo cierra');
  // descanso automático al marcar una serie
  await p.locator('.dot', { hasText: /^1$/ }).first().click();
  ok(await p.isVisible('#timerbar .tin'), 'marcar una serie arranca el descanso');
  await p.clock.runFor(10 * 60 * 1000);
  ok((await p.$eval('#timerbar', e => e.textContent)).includes('¡Tiempo!') || !(await p.isVisible('#timerbar .tin')), 'llega a cero');
  await p.clock.runFor(7000);
  ok(!(await p.isVisible('#timerbar .tin')), 'se cierra solo después de terminar');
  await ctx.close(); }

// 7. Modo paso a paso
{ console.log('7. Paso a paso');
  const { p, ctx } = await page('2026-10-13T09:00:00');
  await p.click('[data-rstart]');
  const lbl = () => p.$eval('.rhead .lbl', e => e.textContent);
  ok((await lbl()).startsWith('Paso 1 de'), 'empieza en el paso 1');
  await p.click('[data-rdone]'); ok((await lbl()).startsWith('Paso 2'), 'Hecho avanza');
  await p.click('[data-rgo]:has-text("Saltar")'); ok((await lbl()).startsWith('Paso 3'), 'Saltar avanza');
  await p.click('[data-rgo]:has-text("Atrás")'); ok((await lbl()).startsWith('Paso 2'), 'Atrás retrocede');
  await p.click('[data-rexit]');
  ok((await p.$eval('[data-rstart]', e => e.textContent)).includes('Continuar · paso 2'), 'Continuar retoma donde quedó');
  await reload(p);
  ok((await p.$eval('[data-rstart]', e => e.textContent)).includes('Continuar · paso 2'), 'el avance se guarda al recargar');
  await ctx.close(); }

// 8. Cambio de día con la app abierta (pasa la medianoche)
{ console.log('8. Medianoche');
  const { p, ctx } = await page('2026-10-13T23:50:00');
  ok((await text(p)).includes('13 oct'), 'muestra el 13');
  await p.clock.runFor(15 * 60 * 1000);
  await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await p.waitForTimeout(50);
  ok((await text(p)).includes('14 oct'), 'al pasar la medianoche cambia solo al 14');
  await ctx.close(); }

// 9. Prueba de evaluación: resultados y repetir semanas
{ console.log('9. Prueba');
  const { p, ctx } = await page('2027-01-10T09:00:00'); // semana 13, día 6 con inicio 6 oct
  const t = await text(p);
  ok(t.includes('SEM 13 · DÍA 6'), 'semana 13 día 6 (' + (t.match(/SEM \d+ · DÍA \d/) || [''])[0] + ')');
  for (const [id, v] of [['apnea', '10'], ['swim', '14:00'], ['barras', '7'], ['sent', '60'], ['flex', '40'], ['abd', '45'], ['run', '11:00']]) await p.fill('#t-' + id, v);
  await p.dispatchEvent('#t-run', 'change');
  ok((await text(p)).includes('No llegaste a la meta'), 'evalúa contra la meta');
  await p.click('[data-ask="rep"]'); await p.click('[data-rep]');
  await p.click('[data-go="1"]');
  ok((await text(p)).includes('SEM 9 · DÍA 0') || (await text(p)).includes('SEM 13 · DÍA 7'), 'sigue el día 7 de la semana 13');
  await p.click('[data-go="1"]');
  ok((await text(p)).includes('SEM 9 · DÍA 1'), 'después se repite la semana 9');
  await reload(p);
  const sched = await p.evaluate(() => JSON.parse(localStorage.getItem('bitacora-buzo-v1')).cfg.sched);
  ok(sched.slice(13, 19).join() === '13,9,10,11,12,13', 'la repetición queda guardada en el plan (' + sched.slice(13, 19).join() + ')');
  await ctx.close(); }

// 10. Navegación y pestañas
{ console.log('10. Navegación');
  const { p, ctx, errs } = await page('2026-10-13T09:00:00');
  for (const tab of ['plan', 'progreso', 'guia', 'hoy']) { await p.click(`[data-tab="${tab}"]`); }
  await p.click('[data-go="-1"]'); ok((await text(p)).includes('12 oct'), 'día anterior');
  await p.click('[data-go="0"]'); ok((await text(p)).includes('13 oct'), 'botón Hoy');
  await p.click('[data-tab="plan"]'); await p.click('[data-wk="5"]'); await p.locator('[data-goto]').first().click();
  ok((await text(p)).includes('SEM 5 · DÍA 1'), 'abrir un día desde el plan');
  ok(errs.length === 0, 'sin errores: ' + errs.join(' | '));
  await ctx.close(); }

await browser.close();
console.log(`\n${passes} correctas, ${fails} fallidas`);
process.exit(fails ? 1 : 0);
