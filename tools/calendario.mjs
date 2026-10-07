// Genera un archivo .ics con la orden de cada día para importar en Google Calendar.
// Uso: node tools/calendario.mjs [AAAA-MM-DD desde] [días] [--turno 13|16|libre] [--inicio AAAA-MM-DD] > bitacora.ics
import { loadApp, ordenDelDia } from './app-logic.mjs';
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const pos = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1] || '').startsWith('--'));
const A = loadApp();
const from = pos[0] ? A.parse(pos[0]) : new Date();
const days = +(pos[1] || 56), turno = opt('turno', '13');
const LINK = 'https://claude.ai/artifact/Y7MgtsGPPBnXAaGzJpKC7H';
const utc = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const esc = s => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const fold = line => { const out = []; let s = line; while (Buffer.byteLength(s) > 74) { let n = 74; while (Buffer.byteLength(s.slice(0, n)) > 74) n--; out.push(s.slice(0, n)); s = ' ' + s.slice(n); } out.push(s); return out.join('\r\n'); };
const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Bitacora Buzo Tactico//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Bitácora Buzo Táctico', 'X-WR-TIMEZONE:America/Santiago'];
for (let i = 0; i < days; i++) {
  const d = new Date(from); d.setDate(d.getDate() + i);
  const o = ordenDelDia(A, d, { turno, start: opt('inicio', '2026-10-19') });
  if (!o.L) continue;
  const [sh, sm] = (o.rest ? '10:00' : o.shift.A).split(':').map(Number);
  const [eh, em] = (o.rest ? '10:30' : o.shift.lunch).split(':').map(Number);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), sh, sm), end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), eh, em);
  const summary = `⚓ Sem ${o.L.w} · Día ${o.L.dow + 1} · ${o.test ? 'PRUEBA · ' : ''}${o.title}`;
  L.push('BEGIN:VEVENT', `UID:bitacora-${A.iso(d)}@rutina-marino`, `DTSTAMP:${utc(new Date())}`, `DTSTART:${utc(start)}`, `DTEND:${utc(end)}`,
    fold('SUMMARY:' + esc(summary)), fold('DESCRIPTION:' + esc(o.lines.join('\n') + '\n\nÓrdenes paso a paso: ' + LINK)), 'TRANSP:OPAQUE');
  if (!o.rest) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(summary), 'TRIGGER:-PT15M', 'END:VALARM');
  L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(summary), 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT');
}
L.push('END:VCALENDAR');
process.stdout.write(L.join('\r\n') + '\r\n');
