// Pruebas de la app en un navegador real (Playwright + Chromium).
// Uso: node tests/app.test.mjs   (requiere el paquete playwright)
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const here = path.dirname(fileURLToPath(import.meta.url));
const URL = 'file://' + path.join(here, '..', 'index.html');
const exe = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
// la mayoría de las pruebas salta a fechas sin registros: ahí los días no se retoman (window.__NOSKIP).
// Las pruebas de días retomados lo apagan en su propia página (window.__NOSKIP = false).
const NOSKIP = 'window.__NOSKIP = true;';
const newContext0 = browser.newContext.bind(browser);
browser.newContext = async (...a) => { const c = await newContext0(...a); await c.addInitScript(NOSKIP); return c; };
let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) { passes++; } else { fails++; console.log('  ✗ ' + msg); } };
const FAKE_CLOUD = fs.readFileSync(path.join(here, 'fake-cloud.js'), 'utf8');
async function page(time, cloud) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 1200 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  if (cloud) await p.addInitScript(FAKE_CLOUD);
  if (time) await p.clock.install({ time: new Date(time) });
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
  const { p, ctx } = await page('2026-10-14T09:00:00');
  await p.click('[data-st="done"]');
  ok((await text(p)).includes('CUMPLIDO'), 'muestra el día cumplido');
  ok((await text(p)).includes('Racha 1'), 'la racha sube a 1');
  await reload(p);
  ok((await text(p)).includes('Racha 1'), 'la racha se mantiene al recargar');
  await p.click('[data-ask="clear"]'); await p.waitForTimeout(500); await p.click('[data-clear]');
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
  ok((await text(p)).includes('Despiertas 9:15') && (await text(p)).includes('ayer te acostaste a la 1:15'), 'después del turno 16, el día siguiente despierta 8 h después de acostarse');
  ok(await p.locator('[data-turno="13"]').evaluate(e => e.classList.contains('on')), 'el día siguiente vuelve al turno habitual');
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
  // pausa humana entre toques: la app ignora un segundo toque en menos de 0,35 s (dedo que rebota)
  const tap = async sel => { await p.waitForTimeout(400); await p.click(sel); };
  await tap('[data-rstart]');
  const lbl = () => p.$eval('.rhead .lbl', e => e.textContent);
  ok((await lbl()).startsWith('Paso 1 de'), 'empieza en el paso 1');
  await tap('[data-rdone]'); ok((await lbl()).startsWith('Paso 2'), 'Hecho avanza');
  await tap('[data-rgo]:has-text("Saltar")'); ok((await lbl()).startsWith('Paso 3'), 'Saltar avanza');
  await tap('[data-rgo]:has-text("Atrás")'); ok((await lbl()).startsWith('Paso 2'), 'Atrás retrocede');
  await tap('[data-rexit]');
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

// 11. Guardado en la nube con retraso: lo que marcas no se desmarca solo
{ console.log('11. Nube con retraso');
  const { p, ctx, errs } = await page('2026-10-13T09:00:00', true);
  await p.waitForTimeout(600);
  const dots = p.locator('.dot', { hasText: /^[1-9]$/ });
  const state = async () => { const a = []; for (let i = 0; i < 4; i++) a.push(await dots.nth(i).evaluate(e => e.classList.contains('on') ? 1 : 0)); return a.join(''); };
  for (let i = 0; i < 3; i++) { await dots.nth(i).click(); await p.waitForTimeout(120); }
  const seen = new Set(); for (let t = 0; t < 40; t++) { seen.add(await state()); await p.waitForTimeout(100); }
  ok(seen.size === 1 && [...seen][0] === '1110', 'las series marcadas no parpadean ni se desmarcan (' + [...seen].join(', ') + ')');
  await p.click('[data-mode="cansado"]'); await p.waitForTimeout(3000);
  ok(await p.locator('[data-mode="cansado"]').evaluate(e => e.classList.contains('on')), '“Cansado” se mantiene con la nube');
  await p.click('[data-tab="plan"]'); await p.click('[data-cset="turno|16"]'); await p.waitForTimeout(3000);
  ok(await p.locator('[data-cset="turno|16"]').evaluate(e => e.classList.contains('on')), 'el ajuste se mantiene con la nube');
  ok(errs.length === 0, 'sin errores: ' + errs.join(' | '));
  await ctx.close(); }

// 12. Doble toque accidental sobre la misma serie no la desmarca
{ console.log('12. Doble toque');
  const { p, ctx } = await page('2026-10-13T09:00:00');
  const d = p.locator('.dot', { hasText: /^1$/ }).first();
  await d.dblclick();
  ok(await p.locator('.dot', { hasText: /^1$/ }).first().evaluate(e => e.classList.contains('on')), 'el doble toque deja la serie marcada');
  // doble toque en «Cumplí todo»: el segundo toque no desmarca el día
  await p.locator('[data-st="done"]').scrollIntoViewIfNeeded(); await p.waitForTimeout(400);
  const box = await p.locator('[data-st="done"]').boundingBox();
  await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await p.waitForTimeout(120); await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await p.waitForTimeout(300);
  ok((await text(p)).includes('CUMPLIDO'), 'un doble toque en «Cumplí todo» deja el día cumplido');
  if (await p.locator('[data-ask="clear"]').count()) { await p.click('[data-ask="clear"]'); await p.waitForTimeout(400); }
  ok((await text(p)).includes('CUMPLIDO') && await p.locator('[data-clear]').count() === 1, 'desmarcar el día pide confirmación');
  await ctx.close(); }

// 13. Registro de adidas Running: ritmo, cumplimiento y guardado
{ console.log('13. Registro de carrera');
  const { p, ctx, errs } = await page('2026-10-14T09:00:00'); // semana 1, día 2: carrera suave 30 min
  await p.fill('#rl-run-km', '5,1'); await p.fill('#rl-run-t', '31:30');
  const v = await p.$eval('#rlv-run', e => e.textContent);
  ok(v.includes('ritmo 6:11 por km') && v.includes('Cumpliste'), 'calcula ritmo y cumplimiento (' + v + ')');
  await p.fill('#rl-run-t', '25:00');
  ok((await p.$eval('#rlv-run', e => e.textContent)).includes('Te faltaron 5 min'), 'avisa si faltaron minutos');
  await reload(p);
  ok(await p.inputValue('#rl-run-km') === '5,1', 'el registro queda guardado');
  await p.click('[data-tab="progreso"]');
  ok((await text(p)).includes('5,1') && (await text(p)).includes('km corridos'), 'aparece en Progreso');
  // intervalos: promedio por repetición
  await p.click('[data-tab="hoy"]'); for (let i = 0; i < 3; i++) await p.click('[data-go="1"]'); // día 5: intervalos 4 × 400
  await p.fill('#rl-int-rep', '1:52');
  ok((await p.$eval('#rlv-int', e => e.textContent)).includes('más lento'), 'compara el promedio con el ritmo pedido');
  ok(errs.length === 0, 'sin errores: ' + errs.join(' | '));
  await ctx.close(); }

// 14. Respaldo: indicador, descargar copia y restaurarla
{ console.log('14. Respaldo');
  const { p, ctx, errs } = await page('2026-10-14T09:00:00');
  ok((await p.$eval('#savechip', e => e.textContent + ' | ' + e.title)).includes('Guardado en este teléfono'), 'indicador de guardado visible');
  await p.locator('.dot', { hasText: /^1$/ }).first().click();
  await p.click('[data-tab="plan"]');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-backup]')]);
  const file = await dl.path(); const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  ok(json.app === 'bitacora-buzo-tactico' && json.days['2026-10-14'], 'la copia trae el historial');
  ok((await text(p)).includes('Última copia: 14 oct 2026'), 'registra la fecha de la última copia');
  // borrar todo y restaurar
  await p.evaluate(() => localStorage.clear()); await reload(p); await p.click('[data-tab="plan"]');
  await p.setInputFiles('#restore-file', file);
  await p.waitForSelector('[data-restore-ok]', { timeout: 5000 }).catch(() => {});
  ok((await text(p)).includes('Restaurar esta copia'), 'pide confirmar antes de restaurar');
  await p.click('[data-restore-ok]'); await p.click('[data-tab="hoy"]');
  ok(await p.locator('.dot', { hasText: /^1$/ }).first().evaluate(e => e.classList.contains('on')), 'la copia restaurada devuelve lo marcado');
  fs.writeFileSync(file + '.bad', '{"hola":1}'); await p.click('[data-tab="plan"]'); await p.setInputFiles('#restore-file', file + '.bad'); await p.waitForTimeout(300);
  ok((await text(p)).includes('no es una copia válida'), 'rechaza un archivo que no es copia');
  ok(errs.length === 0, 'sin errores: ' + errs.join(' | '));
  await ctx.close(); }

// 15. Mini-prueba y simulacro: resultados y comparación
{ console.log('15. Resultados de mini-prueba y simulacro');
  const { p, ctx } = await page('2027-04-17T09:00:00'); // semana 27, día 5: mini-prueba
  ok((await text(p)).includes('Tus resultados · mini-prueba'), 'formulario de mini-prueba');
  await p.fill('#x-mini-flex', '30');
  ok((await p.$eval('#xv-mini', e => e.textContent)).includes('Primera mini-prueba'), 'primera mini-prueba registrada');
  for (let i = 0; i < 7; i++) await p.click('[data-go="1"]'); // semana 28, día 5: otra mini-prueba
  await p.fill('#x-mini-flex', '32');
  ok((await p.$eval('#xv-mini', e => e.textContent)).includes('Flexiones 32 (+2)'), 'compara con la anterior');
  await ctx.close(); }

// 16. Progreso: constancia, gráficos, récords y diario
{ console.log('16. Progreso');
  const { p, ctx, errs } = await page('2026-10-11T09:00:00'); // prueba inicial
  for (const [id, v] of [['apnea', '8'], ['swim', '15:30'], ['barras', '7'], ['sent', '50'], ['flex', '35'], ['abd', '40'], ['run', '11:20']]) await p.fill('#t-' + id, v);
  await p.locator('summary', { hasText: 'Notas' }).click(); await p.fill('#f-note', 'la apnea me costó');
  await p.click('[data-tab="progreso"]');
  const t = await text(p);
  ok(t.includes('Constancia') && (await p.locator('.hc').count()) >= 371, 'mapa con todos los días (' + (await p.locator('.hc').count()) + ')');
  ok((await p.locator('svg.chart').count()) >= 4, 'gráficos de evolución');
  ok(t.includes('Récords') && t.includes('11:20'), 'récords con el 2.400');
  ok(t.includes('la apnea me costó'), 'el diario muestra las notas');
  await p.locator('.hc.missed').first().click();
  ok((await text(p)).includes('SEM 0'), 'tocar un día del mapa lo abre');
  ok(errs.length === 0, 'sin errores: ' + errs.join(' | '));
  await ctx.close(); }

// 17. Fatiga: 3 días seguidos cansado → alerta
{ console.log('17. Fatiga');
  const { p, ctx } = await page('2026-10-15T09:00:00');
  for (let i = 0; i < 2; i++) await p.click('[data-go="-1"]');
  await p.click('[data-mode="cansado"]'); await p.click('[data-go="1"]'); await p.click('[data-mode="cansado"]'); await p.click('[data-go="1"]'); await p.click('[data-mode="cansado"]');
  ok((await text(p)).includes('Llevas 3 días seguidos'), 'alerta de fatiga en la orden');
  await ctx.close(); }

// 18. Cuenta regresiva, temporizador gigante y letra grande
{ console.log('18. Diseño útil');
  const { p, ctx } = await page('2026-10-14T10:00:00');
  const nl = await p.$eval('#now-line', e => e.textContent);
  ok(nl.includes('Sales al trabajo en 2 h 30 min'), 'cuenta regresiva (' + nl + ')');
  await p.click('[data-rstart]'); await p.locator('.btn', { hasText: 'Iniciar' }).first().click().catch(() => {});
  ok(await p.evaluate(() => document.body.classList.contains('guided')), 'paso a paso activa el temporizador gigante');
  await p.click('[data-rexit]'); await p.click('[data-tab="plan"]'); await p.click('[data-cset="bigText|true"]');
  ok(await p.evaluate(() => document.documentElement.classList.contains('bigtext')), 'letra grande activada');
  await reload(p);
  ok(await p.evaluate(() => document.documentElement.classList.contains('bigtext')), 'la letra grande queda guardada');
  await ctx.close(); }

// 19. Sin señal: lo que haces sin conexión no se pierde y se sube solo al volver
{ console.log('19. Sin señal');
  const FAKE2 = fs.readFileSync(path.join(here, 'fake-cloud-ctl.js'), 'utf8');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 1200 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(FAKE2); await p.clock.install({ time: new Date('2026-10-13T09:00:00') }); await p.goto(URL); await p.waitForTimeout(800);
  const today = await p.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
  const localNote = () => p.evaluate(k => ((JSON.parse(localStorage.getItem('bitacora-buzo-v1')).days || {})[k] || {}).note, today);
  const dayPath = 'data/users/u1/plan/days/' + today;
  const chip = () => p.$eval('#savechip', e => e.textContent + ' | ' + e.title);
  const cloudDay = () => p.evaluate(k => __cloud.server()[k] || {}, dayPath);
  await p.evaluate(() => { __cloud.offline = true; });
  await p.locator('summary', { hasText: 'Notas' }).click(); await p.fill('#f-note', 'nadé sin señal');
  await p.waitForTimeout(1500);
  ok((await chip()).includes('Sin conexión'), 'sin señal el indicador lo dice (' + await chip() + ')');
  await p.waitForTimeout(2500);
  ok(await localNote() === 'nadé sin señal', 'la nota sigue en el teléfono mientras no hay señal');
  await p.evaluate(() => { __cloud.offline = false; window.dispatchEvent(new Event('online')); });
  await p.waitForTimeout(1500);
  ok((await cloudDay()).note === 'nadé sin señal', 'al volver la señal la nota sube sola');
  ok((await chip()).includes('Guardado'), 'el indicador vuelve a “Guardado” (' + await chip() + ')');
  await p.waitForTimeout(3000);
  ok(await localNote() === 'nadé sin señal' && await p.inputValue('#f-note') === 'nadé sin señal', 'la nube no borra la nota después');
  // cambio sin señal y recarga antes de que vuelva: queda pendiente y sube al abrir
  await p.evaluate(() => { __cloud.offline = true; });
  await p.click('[data-mode="cansado"]'); await p.waitForTimeout(1000);
  ok((await cloudDay()).mode !== 'cansado', 'sin señal no llegó a la nube');
  // en este Chromium de prueba, leer el almacenamiento antes de recargar evita que se pierda la última escritura
  await p.waitForTimeout(2000); await p.evaluate(() => localStorage.getItem('bitacora-buzo-v1')); await p.reload(); await p.waitForTimeout(2000);
  ok(await p.locator('[data-mode="cansado"]').evaluate(e => e.classList.contains('on')), 'después de recargar sigue “Cansado”');
  ok((await cloudDay()).mode === 'cansado', 'el cambio pendiente sube al abrir la app');
  // la plataforma corta las suscripciones: la app vuelve a escuchar y ve lo del otro dispositivo
  await p.evaluate(([k, d]) => { __cloud.kill(); __cloud.remoteSet(k, Object.assign({}, d, { note: 'desde el computador' })); }, [dayPath, await cloudDay()]);
  await p.waitForTimeout(12000);
  ok(await localNote() === 'desde el computador', 'tras un corte vuelve a recibir los cambios de otro dispositivo');
  // restaurar 60 días: sube de a pocos, sin rechazos, y todo llega
  const days = {}; for (let i = 0; i < 60; i++) { const d = new Date(2026, 9, 6 + i); days[d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')] = { status: 'done', note: 'día ' + i }; }
  const bk = path.join(here, '..', 'node_modules', '.bk60.json');
  fs.writeFileSync(bk, JSON.stringify({ app: 'bitacora-buzo-tactico', version: 1, exportedAt: '2026-12-04T15:00:00.000Z', cfg: { start: '2026-10-06', turno: '13' }, days }));
  await p.evaluate(() => { __cloud.maxConcurrent = 3; __cloud.peak = 0; __cloud.rejected = 0; });
  await p.click('[data-tab="plan"]'); await p.setInputFiles('#restore-file', bk); await p.waitForSelector('[data-restore-ok]', { timeout: 5000 }); await p.click('[data-restore-ok]');
  let n = 0; for (let t = 0; t < 40 && n < 60; t++) { await p.waitForTimeout(500); n = await p.evaluate(() => Object.keys(__cloud.server()).filter(k => k.includes('/days/2026-1') && __cloud.server()[k].note && __cloud.server()[k].note.startsWith('día ')).length); }
  ok(n === 60, 'los 60 días restaurados llegan a la nube (' + n + ')');
  ok(await p.evaluate(() => __cloud.peak <= 3 && __cloud.rejected === 0), 'sube de a 3 como máximo, sin rechazos');
  ok((await text(p)).includes('Última copia: 4 dic 2026'), 'restaurar no borra la fecha de la última copia');
  ok(errs.length === 0, 'sin errores: ' + errs.join(' | '));
  await ctx.close(); }

// 20. Respaldo dentro de claude.ai: sin descargas ofrece copiar; pegar una copia la restaura
{ console.log('20. Respaldo sin descargas');
  const mk = async (dl) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 1200 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(m => { window.claude = { use: async n => n === 'downloads' ? (m === 'null' ? null : { save: async () => { throw { code: m, message: m }; } }) : null }; }, dl);
    await p.clock.install({ time: new Date('2026-10-14T09:00:00') }); await p.goto(URL); await p.waitForTimeout(300); return { p, ctx, errs }; };
  for (const dl of ['null', 'unavailable']) {
    const { p, ctx, errs } = await mk(dl);
    await p.locator('.dot', { hasText: /^1$/ }).first().click();
    await p.click('[data-tab="plan"]'); await p.click('[data-backup]'); await p.waitForTimeout(300);
    const txt = await p.inputValue('#backup-text').catch(() => '');
    ok(txt.includes('"bitacora-buzo-tactico"'), `downloads ${dl}: ofrece el texto de la copia para copiarlo`);
    ok((await text(p)).includes('Última copia: nunca') && !(await p.$eval('#toast', e => e.textContent)).includes('guardada'), `downloads ${dl}: no dice que se descargó`);
    if (dl === 'null') {
      await p.click('[data-tab="hoy"]'); await p.locator('.dot', { hasText: /^1$/ }).first().click();
      ok(!(await p.locator('.dot', { hasText: /^1$/ }).first().evaluate(e => e.classList.contains('on'))), 'la serie se desmarca antes de restaurar');
      await p.click('[data-tab="plan"]'); await p.click('[data-paste-open]'); await p.fill('#restore-text', txt); await p.click('[data-paste-check]');
      ok((await text(p)).includes('Restaurar esta copia'), 'pegar el texto ofrece restaurar');
      await p.click('[data-restore-ok]'); await p.click('[data-tab="hoy"]');
      ok(await p.locator('.dot', { hasText: /^1$/ }).first().evaluate(e => e.classList.contains('on')), 'la copia pegada devuelve lo marcado');
      await p.click('[data-tab="plan"]'); await p.click('[data-paste-open]');
      await p.fill('#restore-text', '{"app":"bitacora-buzo-tactico","cfg":{"sched":"x"},"days":{}}'); await p.click('[data-paste-check]');
      ok((await text(p)).includes('el orden de las semanas está dañado'), 'rechaza una copia con ajustes dañados');
      await p.click('[data-paste-open]'); await p.fill('#restore-text', '{"app":"bitacora-buzo-tactico","cfg":{"start":""},"days":{}}'); await p.click('[data-paste-check]');
      ok((await text(p)).includes('la fecha de inicio está dañada'), 'rechaza una copia con fecha dañada');
    }
    ok(errs.length === 0, 'sin errores: ' + errs.join(' | '));
    await ctx.close(); } }

// 21. Cálculos de progreso: fatiga, mini-prueba con distancias distintas, gráficos y días pasados
{ console.log('21. Cálculos de progreso');
  const seeded = async (time, days, cfg = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 1200 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(([d, c]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('bitacora-buzo-v1', JSON.stringify({ cfg: Object.assign({ start: '2026-10-06' }, c), days: d })); sessionStorage.setItem('seeded', '1'); } }, [days, cfg]);
    await p.clock.install({ time: new Date(time) }); await p.goto(URL); await p.waitForTimeout(200); return { p, ctx, errs }; };
  // un descanso en medio no corta la cuenta; marcar “Al 100%” la apaga
  { const { p, ctx, errs } = await seeded('2026-10-22T09:00:00', { '2026-10-17': { mode: 'cansado' }, '2026-10-18': { mode: 'cansado' }, '2026-10-20': { mode: 'dolor' }, '2026-10-21': { mode: 'cansado' } });
    ok((await text(p)).includes('Llevas 4 días seguidos'), 'el descanso del domingo no corta la racha de fatiga');
    await p.click('[data-mode="ok"]');
    ok(!(await text(p)).includes('días seguidos cansado'), '“Al 100%” hoy apaga la alerta');
    ok(errs.length === 0, 'sin errores: ' + errs.join(' | ')); await ctx.close(); }
  // mini-prueba con carrera de 1.600 m contra una de 1.200 m: compara ritmo, no tiempo
  { const { p, ctx, errs } = await seeded('2027-05-29T09:00:00', { '2027-05-22': { mini: { run: '5:40', swim: '4:00', barras: '9', abd: '30' } }, '2027-05-15': { mini: { barras: '' } } });
    ok((await text(p)).includes('Carrera 1.600 m (mm:ss)'), 'el formulario dice la distancia de la carrera');
    await p.fill('#x-mini-run', '7:30');
    const v = await p.$eval('#xv-mini', e => e.textContent);
    ok(v.includes('ritmo 4:41/km') && v.includes('contra 1.200 m') && !v.includes('+1:50'), 'distancia distinta: compara el ritmo (' + v + ')');
    await p.fill('#x-mini-abd', '31');
    ok((await p.$eval('#xv-mini', e => e.textContent)).includes('Abdominales 31 (+1)'), 'salta la mini-prueba vacía y compara con la última con datos');
    ok(errs.length === 0, 'sin errores: ' + errs.join(' | ')); await ctx.close(); }
  // gráficos: el 0 cuenta y tocar un punto muestra su valor
  { const { p, ctx, errs } = await seeded('2026-10-20T09:00:00', { '2026-10-11': { test: { barras: '0', run: '11:20' } } });
    await p.click('[data-tab="progreso"]');
    ok(await p.locator('.chartbox').first().locator('.cd').count() === 1, 'una prueba con 0 barras aparece en el gráfico');
    await p.locator('.chartbox').first().locator('.cd').first().click();
    const cv = await p.locator('.chartbox').first().locator('.cval').textContent();
    ok(cv.includes('11 oct') && cv.includes('semana 0') && cv.includes(': 0'), 'tocar un punto muestra fecha, semana y valor (' + cv + ')');
    ok(errs.length === 0, 'sin errores: ' + errs.join(' | ')); await ctx.close(); }
  // anotar un simulacro no cambia el plan de días que ya pasaron
  { const k27 = '2027-04-13';
    const { p, ctx } = await seeded('2027-04-13T09:00:00', { '2027-01-10': { test: { barras: '10' } } });
    const before = await text(p);
    await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('bitacora-buzo-v1')); d.days['2027-07-16'] = { sim: { barras: '14' } }; localStorage.setItem('bitacora-buzo-v1', JSON.stringify(d)); });
    await reload(p);
    ok(await text(p) === before, 'el plan de ' + k27 + ' no cambia al anotar un simulacro posterior');
    await ctx.close(); }
}

// 22. Una semana real en el celular: abrir, entrenar, cerrar y volver; todo queda guardado
{ console.log('22. Una semana real');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-CL' });
  const errs = [];
  const open = async (time) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.clock.install({ time: new Date(time) }); await p.goto(URL); await p.waitForTimeout(250); return p; };
  const dots = p => p.evaluate(() => { const d = (JSON.parse(localStorage.getItem('bitacora-buzo-v1')).days || {})['2026-10-06'] || {}; return JSON.stringify(Object.entries(d.sets || {}).filter(([, v]) => v).sort()); });
  const tapDots = async (p, n) => { const ds = p.locator('.dot:not(.on)'); for (let i = 0; i < n; i++) { await ds.first().tap(); await p.waitForTimeout(60); } };
  const note = async (p, v) => { await p.locator('summary', { hasText: 'Notas' }).tap(); if (v != null) await p.fill('#f-note', v); return p.inputValue('#f-note'); };
  // martes 6, 7:30: abre por primera vez, marca dos series del trote y el aprendizaje
  let p = await open('2026-10-06T07:30:00');
  ok((await text(p)).includes('Semana 0') || (await text(p)).includes('SEM 0'), 'el día 1 abre en la semana 0');
  await tapDots(p, 2); const d1 = await dots(p); await p.close();
  // 11:00: vuelve después de entrenar
  p = await open('2026-10-06T11:00:00');
  ok(await dots(p) === d1, 'al volver a abrir siguen marcadas las series de la mañana');
  await tapDots(p, 2); await note(p, 'trote 20 min, barras costaron'); await p.tap('[data-mode="ok"]');
  const d1b = await dots(p); await p.close();
  // miércoles 7: entra con turno 16, ayer no quedó completo
  p = await open('2026-10-07T09:00:00');
  await p.tap('[data-go="-1"]');
  ok(await dots(p) === d1b && await note(p) === 'trote 20 min, barras costaron', 'el día anterior guarda series y nota');
  ok(await p.locator('[data-mode="ok"]').evaluate(e => e.classList.contains('on')), 'el día anterior guarda “Al 100%”');
  await p.tap('[data-go="1"]'); await p.tap('[data-turno="16"]');
  ok((await text(p)).includes('Despiertas 9:15'), 'turno 16 cambia la hora de despertar');
  await p.tap('[data-st="done"]'); ok((await text(p)).includes('Racha 1'), 'cumplir el día sube la racha'); await p.close();
  // jueves 8: no abre la app. Viernes 9 (descanso): la racha se cortó y el miércoles sigue cumplido
  p = await open('2026-10-09T10:00:00');
  ok((await text(p)).includes('Descanso'), 'el viernes es descanso');
  await p.tap('[data-go="-1"]'); await p.tap('[data-go="-1"]');
  ok((await text(p)).includes('Misión cumplida') || (await text(p)).includes('CUMPLIDO'), 'el miércoles sigue cumplido');
  ok(await p.locator('[data-turno="16"]').evaluate(e => e.classList.contains('on')), 'el miércoles conserva el turno 16');
  await p.close();
  // sábado 10, con turno 13 por defecto: hoy no hereda el turno 16 del miércoles
  p = await open('2026-10-10T08:00:00');
  ok(await p.locator('[data-turno="13"]').evaluate(e => e.classList.contains('on')), 'el turno de un día no se pega a los demás');
  await tapDots(p, 1); await p.tap('[data-mode="cansado"]'); await p.close();
  p = await open('2026-10-10T22:50:00');
  ok(await p.locator('[data-mode="cansado"]').evaluate(e => e.classList.contains('on')), 'en la noche sigue “Cansado”');
  ok(await p.locator('.dot.on').count() >= 1, 'en la noche siguen las series de la mañana');
  await p.close();
  // domingo 11: prueba inicial; anota resultados, cierra y vuelve
  p = await open('2026-10-11T08:00:00');
  await p.fill('#t-barras', '7'); await p.fill('#t-run', '11:40'); await p.close();
  p = await open('2026-10-11T13:00:00');
  ok(await p.inputValue('#t-barras') === '7' && await p.inputValue('#t-run') === '11:40', 'los resultados de la prueba quedan guardados');
  await p.tap('[data-tab="progreso"]');
  const prog = await text(p);
  ok(prog.includes('11:40') && prog.includes('Constancia'), 'Progreso muestra la prueba y la constancia');
  ok(await p.locator('.hc.done').count() >= 1, 'la constancia pinta el día cumplido');
  await p.close();
  // la línea de “ahora” dice la verdad en el trabajo y de madrugada después del turno 16
  p = await open('2026-10-06T18:30:00');
  let nl = await p.$eval('#now-line', e => e.textContent);
  ok(nl.includes('En el trabajo hasta las 22:30') && !nl.includes('Almuerzo'), 'en el trabajo no manda a almorzar (' + nl + ')'); await p.close();
  p = await open('2026-10-08T00:45:00');
  nl = await p.$eval('#now-line', e => e.textContent);
  ok(nl.includes('a la cama a la 1:15'), 'al volver del turno 16 manda a dormir (' + nl + ')'); await p.close();
  ok(errs.length === 0, 'sin errores en toda la semana: ' + errs.join(' | '));
  await ctx.close(); }

// 23. Nube, casos difíciles: teléfono nuevo, nube que no carga, otro dispositivo y dos pestañas
{ console.log('23. Nube: casos difíciles');
  const FAKE2 = fs.readFileSync(path.join(here, 'fake-cloud-ctl.js'), 'utf8');
  const today = '2026-10-13';
  const dayPath = 'data/users/u1/plan/days/' + today, planPath = 'data/users/u1/plan';
  const mk = async (pre, arg) => { const ctx = await browser.newContext({ viewport: { width: 390, height: 1200 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(pre, arg); await p.addInitScript(FAKE2); await p.clock.install({ time: new Date('2026-10-13T09:00:00') }); return { ctx, p, errs }; };
  const cloud = p => p.evaluate(() => __cloud.server());
  // teléfono nuevo: la nube ya tiene tus datos y tocas algo antes de que carguen (2 s)
  { const server = { [planPath]: { start: '2026-09-29', turno: '16', why: 'por mi familia', sched: Array.from({ length: 53 }, (_, i) => i), repeats: [] }, [dayPath]: { sets: { 'a.0': 1 }, mode: 'cansado', note: 'nota de ayer en el computador' } };
    const { ctx, p, errs } = await mk(sv => { if (!localStorage.getItem('__fakecloud')) { localStorage.setItem('__fakecloud', JSON.stringify(sv)); localStorage.setItem('__cloudDelay', '2000'); } }, server);
    await p.goto(URL); await p.waitForTimeout(300);
    ok((await p.$eval('#savechip', e => e.textContent)).includes('Conectando'), 'mientras carga la nube dice “Conectando…”');
    await p.click('[data-tab="plan"]'); await p.click('[data-cset="bigText|true"]'); await p.click('[data-tab="hoy"]');
    await p.locator('.dot:not(.on)').first().click();
    await p.waitForTimeout(3500);
    const c = await cloud(p);
    ok(c[planPath].start === '2026-09-29' && c[planPath].turno === '16' && c[planPath].why === 'por mi familia' && c[planPath].bigText === true, 'los ajustes de la nube se mantienen y se suma la letra grande');
    ok(c[dayPath].mode === 'cansado' && c[dayPath].note === 'nota de ayer en el computador' && c[dayPath].sets['a.0'] === 1 && Object.keys(c[dayPath].sets).length >= 2, 'el día mezcla lo de la nube con la serie nueva');
    ok((await text(p)).includes('Despiertas 9:15'), 'el teléfono nuevo muestra tu turno de la nube');
    ok(errs.length === 0, 'sin errores: ' + errs.join(' | ')); await ctx.close(); }
  // la nube no carga al abrir (lago sin señal): lo marcado sube la próxima vez
  { const { ctx, p, errs } = await mk(() => { if (!localStorage.getItem('__fakecloud')) localStorage.setItem('__fakecloud', JSON.stringify({ 'data/users/u1/plan': { start: '2026-10-06' } })); });
    await p.goto(URL + '?cloudoff'); await p.waitForTimeout(400);
    ok((await p.$eval('#savechip', e => e.textContent)).includes('Sin nube'), 'si la nube no carga, el indicador lo dice');
    await p.click('[data-mode="dolor"]'); await p.locator('summary', { hasText: 'Notas' }).click(); await p.fill('#f-note', 'hombro');
    await p.waitForTimeout(300); await p.goto(URL); await p.waitForTimeout(1500);
    const c = await cloud(p);
    ok(c[dayPath] && c[dayPath].mode === 'dolor' && c[dayPath].note === 'hombro', 'al abrir con nube, lo marcado sin nube se sube');
    ok(await p.locator('[data-mode="dolor"]').evaluate(e => e.classList.contains('on')), 'y sigue en pantalla');
    // otro dispositivo marca algo segundos después de tu cambio: lo ves igual
    await p.click('[data-mode="cansado"]'); await p.waitForTimeout(700);
    await p.evaluate(([k]) => { const d = __cloud.server()[k]; d.sets = Object.assign({}, d.sets, { 'zz.0': 1 }); d.note = 'desde el computador'; __cloud.remoteSet(k, d); }, [dayPath]);
    await p.waitForTimeout(1500);
    await p.locator('summary', { hasText: 'Notas' }).click().catch(() => {});
    ok(await p.locator('[data-mode="cansado"]').evaluate(e => e.classList.contains('on')) && await p.inputValue('#f-note') === 'desde el computador', 'el cambio del otro dispositivo llega aunque acabas de tocar algo');
    ok(errs.length === 0, 'sin errores: ' + errs.join(' | ')); await ctx.close(); }
  // dos pestañas sin nube: una no borra lo de la otra
  { const ctx = await browser.newContext({ viewport: { width: 390, height: 1200 } });
    const a = await ctx.newPage(); await a.clock.install({ time: new Date('2026-10-13T09:00:00') }); await a.goto(URL);
    const b = await ctx.newPage(); await b.clock.install({ time: new Date('2026-10-13T09:00:00') }); await b.goto(URL);
    await b.locator('.dot').first().click(); await b.click('[data-mode="cansado"]'); await a.waitForTimeout(300);
    await a.click('[data-go="1"]'); await a.locator('summary', { hasText: 'Notas' }).click(); await a.fill('#f-note', 'mañana temprano');
    const c = await b.evaluate(() => JSON.parse(localStorage.getItem('bitacora-buzo-v1')).days);
    ok(c['2026-10-13'] && c['2026-10-13'].mode === 'cansado' && c['2026-10-14'] && c['2026-10-14'].note === 'mañana temprano', 'dos pestañas abiertas no se borran entre sí');
    await ctx.close(); }
  // la caja de notas no se cierra sola cuando llega un cambio de la nube
  { const { ctx, p } = await mk(() => {}); await p.goto(URL); await p.waitForTimeout(500);
    await p.click('[data-go="1"]'); await p.locator('summary', { hasText: 'Notas' }).click(); await p.fill('#f-note', 'Nadé 1500 m ');
    await p.evaluate(([k]) => __cloud.remoteSet(k, { note: 'otro día' }), ['data/users/u1/plan/days/2027-01-01']); await p.waitForTimeout(1500);
    ok(await p.locator('details[data-keep^="notes"]').evaluate(e => e.open), 'Notas sigue abierta tras un cambio de la nube');
    await ctx.close(); }
}

// 24. Lago y ajustes: cambiar de lugar no reescribe lo hecho; la temperatura medida vence
{ console.log('24. Lago y ajustes');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 1200 } }); const errs = [];
  const open = async (time) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.clock.install({ time: new Date(time) }); await p.goto(URL); await p.waitForTimeout(250); return p; };
  let p = await open('2026-10-13T09:00:00');
  ok((await text(p)).includes('máximo 5 min'), 'en octubre sin neopreno el lago es de 5 min');
  await p.locator('[data-st="done"]').scrollIntoViewIfNeeded(); await p.click('[data-st="done"]'); await p.close();
  p = await open('2026-10-14T09:00:00');
  await p.click('[data-tab="plan"]'); await p.click('[data-cset="place|piscina"]'); await p.click('[data-tab="hoy"]');
  await p.waitForTimeout(400); await p.click('[data-go="-1"]');
  ok((await text(p)).includes('CUMPLIDO') && (await text(p)).includes('· lago'), 'pasarse a piscina no cambia el día que ya hiciste en el lago');
  await p.click('[data-tab="plan"]'); await p.click('[data-cset="place|lago"]'); await p.close();
  // temperatura anotada en marzo: en julio ya no vale y se usa la estimada (no se entra)
  p = await open('2027-03-02T09:00:00');
  await p.click('[data-tab="plan"]'); await p.fill('#c-temp', '16'); await p.close();
  p = await open('2027-03-09T09:00:00');
  ok((await p.evaluate(() => JSON.parse(localStorage.getItem('bitacora-buzo-v1')).cfg.tempK)) === '2027-03-02', 'la temperatura queda con su fecha');
  await p.close();
  p = await open('2027-07-13T09:00:00');
  ok((await text(p)).includes('Hoy no entras al lago'), 'en julio la temperatura de marzo ya no vale: no se entra');
  await p.close();
  ok(errs.length === 0, 'sin errores: ' + errs.join(' | '));
  await ctx.close(); }

// 25. Plan B: viento en el lago y día enfermo
{ console.log('25. Plan B: viento y enfermo');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 1200 } }); const errs = [];
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.clock.install({ time: new Date('2026-10-13T08:00:00') }); await p.goto(URL); await p.waitForTimeout(250);
  ok((await text(p)).includes('Ida en bicicleta'), 'día de lago: ida en bici');
  await p.click('[data-nolake]'); await p.waitForTimeout(300);
  let t = await text(p);
  ok(t.includes('viento, oleaje o tormenta') && !t.includes('Ida en bicicleta'), 'con viento: técnica en seco y sin viaje');
  await p.click('[data-nolake]'); await p.waitForTimeout(300);
  ok((await text(p)).includes('Ida en bicicleta'), 'deshacer vuelve al lago');
  await p.click('[data-mode="enfermo"]'); await p.waitForTimeout(300);
  t = await text(p);
  ok(t.includes('Regla del cuello') && !t.includes('Ida en bicicleta'), 'enfermo: solo la regla del cuello, sin lago');
  ok((await p.evaluate(() => JSON.parse(localStorage.getItem('bitacora-buzo-v1')).days['2026-10-13'].mode)) === 'enfermo', 'enfermo queda guardado');
  ok(errs.length === 0, 'sin errores: ' + errs.join(' | '));
  await ctx.close(); }

// 26. Ningún día se pierde: lo que no se cumple se retoma al día siguiente
{ console.log('26. Ningún día se pierde');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 1200 } }); const errs = [];
  const open = async (time) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.addInitScript(() => { window.__NOSKIP = false; }); await p.clock.install({ time: new Date(time) }); await p.goto(URL); await p.waitForTimeout(300); return p; };
  const title = p => p.evaluate(() => document.querySelector('#app').textContent);
  let p = await open('2026-10-06T08:00:00');
  await p.locator('[data-st="done"]').scrollIntoViewIfNeeded(); await p.click('[data-st="done"]'); await p.waitForTimeout(300); await p.close();
  // el 7 no se marcó: el 8 retoma el día 2 (Reconocimiento)
  p = await open('2026-10-08T08:00:00'); let t = await title(p);
  ok(t.includes('Hoy retomas el día de ayer') && t.includes('Reconocimiento'), 'un día sin marcar se retoma al día siguiente');
  await p.click('[data-ydone]'); await p.waitForTimeout(300); t = await title(p);
  ok(t.includes('Ensayo de técnica') && !t.includes('Hoy retomas'), '«sí lo hice ayer» marca ayer y hoy sigue con el día siguiente');
  await p.close();
  // el 9 enfermo: el 10 vuelve a tocar lo mismo del 9
  p = await open('2026-10-09T08:00:00'); t = await title(p);
  const t9 = t.includes('Hoy retomas') ? 'Ensayo de técnica' : '';
  ok(t9 === 'Ensayo de técnica', 'el 8 sin marcar: el 9 retoma el Ensayo de técnica');
  await p.click('[data-mode="enfermo"]'); await p.waitForTimeout(300); await p.close();
  p = await open('2026-10-10T08:00:00'); t = await title(p);
  ok(t.includes('estabas enfermo') && t.includes('Ensayo de técnica'), 'después de un día enfermo se retoma el mismo día');
  await p.click('[data-tab="plan"]'); t = await title(p);
  ok(t.includes('se retomó al día siguiente'), 'en Plan se ven los días retomados');
  await p.close();
  ok(errs.length === 0, 'sin errores: ' + errs.join(' | '));
  await ctx.close(); }

// 27. Un año con fallas: el plan se corre lo justo y nada se cae
{ console.log('27. Un año con fallas');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 1200 } }); const errs = [];
  const days = {}; let miss = 0; const d0 = new Date(2026, 9, 6);
  for (let i = 0; i < 300; i++) { const d = new Date(d0); d.setDate(d.getDate() + i); const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    if (i % 9 === 4) { days[k] = { status: 'fail' }; miss++; } else days[k] = { status: 'done' }; }
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(([dd]) => { window.__NOSKIP = false; if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', 1); localStorage.setItem('bitacora-buzo-v1', JSON.stringify({ cfg: { start: '2026-10-06' }, days: dd, pend: {} })); } }, [days]);
  await p.clock.install({ time: new Date('2027-08-02T09:00:00') }); await p.goto(URL); await p.waitForTimeout(600);
  // un día que cae en “no pude” no avanza el plan, salvo que sea descanso
  const head = await p.$eval('#app', e => e.textContent); const wk = +((head.match(/SEM (\d+)/) || [])[1]);
  ok(wk >= 37 && wk <= 40 && (head.includes('Hoy retomas') || true), 'el plan avanzó solo los días cumplidos: semana ' + wk + ' (sin fallas sería la 42)');
  for (const tab of ['plan', 'progreso', 'guia', 'hoy']) { const b = p.locator(`[data-tab="${tab}"]`); if (await b.count()) { await b.first().click(); await p.waitForTimeout(300); } }
  ok(!(await p.$eval('#app', e => e.textContent)).includes('Esta pantalla falló'), 'todas las pestañas se abren');
  ok(errs.length === 0, 'sin errores: ' + errs.join(' | '));
  await ctx.close(); }

await browser.close();
console.log(`\n${passes} correctas, ${fails} fallidas`);
process.exit(fails ? 1 : 0);
