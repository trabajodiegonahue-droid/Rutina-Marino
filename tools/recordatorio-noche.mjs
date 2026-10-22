// Recordatorio de la noche: si hoy hay entrenamiento y quedó sin marcar, lo dice; si no, avisa que está todo en orden.
// Uso: node tools/recordatorio-noche.mjs --nube carpeta | --datos bitacora.json [AAAA-MM-DD]
import fs from 'node:fs';
import { loadApp, readNube } from './app-logic.mjs';
const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : null; };
if (!opt('nube') && !opt('datos')) { console.log('Falta --nube (carpeta de ArtifactData) o --datos (la bitácora leída de la app).'); process.exit(1); }
const A = loadApp(opt('nube') ? readNube(opt('nube')) : JSON.parse(fs.readFileSync(opt('datos'), 'utf8')));
const dateArg = args.find((a, j) => /^\d{4}-\d{2}-\d{2}$/.test(a) && !/^--/.test(args[j - 1] || ''));
const date = dateArg ? A.parse(dateArg) : A.today(), k = A.iso(date);
const L = A.locate(date), plan = L.before ? null : A.planFor(date);
const dd = A.Store.days[k] || {}, st = plan ? A.dayStatus(k, plan) : '';
if (L.before) { const left = Math.round((A.parse(A.Store.cfg.start) - A.parse(k)) / 864e5); console.log(left === 1 ? 'Mañana empieza la operación. Bolso listo y a la cama a la hora.' : `Faltan ${left} días para empezar. Deja listo lo de la lista y duerme bien.`); }
else if (!plan || plan.kind === 'descanso') console.log('Hoy era descanso. A la cama a la hora: mañana se sigue.');
else if (A.okSt(st)) console.log(`Día cumplido ✓ (${plan.title}). A la cama a la hora: mañana se sigue.`);
else if (st === 'fail' || dd.mode === 'enfermo' || dd.mode === 'dolor') console.log(`Hoy quedó registrado como ${dd.mode === 'enfermo' ? 'enfermo' : dd.mode === 'dolor' ? 'con dolor' : 'no cumplido'}: mañana retomas ${plan.title}. Descansa.`);
else {
  const falta = A.missingTasks(dd, plan);
  console.log(`¿Entrenaste hoy? «${plan.title}» ${st === 'part' ? 'quedó a medias' : 'está sin marcar'}${falta.length ? ` (falta: ${falta.slice(0, 4).join(', ')})` : ''}.\nMárcalo en la app antes de dormir: si lo hiciste, toca «Cumplí todo»; si hiciste una parte, «Cerrar el día así». Si no lo marcas, mañana se repite este día.`);
}
