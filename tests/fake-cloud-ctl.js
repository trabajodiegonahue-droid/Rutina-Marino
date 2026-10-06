// Nube falsa controlable para las pruebas de "sin señal".
// window.__cloud permite cortar la señal, limitar escrituras simultáneas,
// matar las suscripciones y escribir como si fuera otro dispositivo.
// Lo guardado sobrevive a recargar la página (sessionStorage), como una nube real.
(() => {
  const KEY = '__fakecloud';
  let server = {};
  try { server = JSON.parse(sessionStorage.getItem(KEY) || '{}'); } catch (e) {}
  const persist = () => { try { sessionStorage.setItem(KEY, JSON.stringify(server)); } catch (e) {} };
  const subs = [];
  const C = window.__cloud = { offline: false, maxConcurrent: Infinity, active: 0, peak: 0, writes: 0, rejected: 0,
    server: () => JSON.parse(JSON.stringify(server)),
    // otro dispositivo escribe directo en la nube
    remoteSet: (path, data) => { server[path] = JSON.parse(JSON.stringify(data)); persist(); emit(); },
    // la plataforma deja de responder: las suscripciones mueren con "unavailable"
    kill: () => subs.forEach(s => { if (!s.dead) { s.dead = true; s.err && s.err({ code: 'unavailable', message: 'bridge' }); } }),
  };
  const snapshotFor = (s) => {
    if (s.isCol) { const docs = Object.keys(server).filter(p => p.startsWith(s.prefix + '/') && p.slice(s.prefix.length + 1).indexOf('/') < 0).map(p => ({ id: p.split('/').pop(), exists: true, data: () => JSON.parse(JSON.stringify(server[p])), metadata: {} })); return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: {} }; }
    const v = server[s.prefix]; return { id: s.prefix.split('/').pop(), exists: v !== undefined, data: () => v === undefined ? undefined : JSON.parse(JSON.stringify(v)), metadata: {} };
  };
  const emit = () => subs.forEach(s => { if (!s.dead) s.fn(snapshotFor(s)); });
  // actualización periódica (como el refresco de 30 s, pero más seguido)
  setInterval(emit, 1000);
  const docRef = (path) => ({ id: path.split('/').pop(), path,
    set: (data) => {
      if (C.offline) return new Promise((_, rej) => setTimeout(() => { C.rejected++; rej({ code: 'unavailable', message: 'offline' }); }, 100));
      if (C.active >= C.maxConcurrent) { C.rejected++; return Promise.reject({ code: 'resource_exhausted', message: 'too many concurrent writes' }); }
      C.active++; C.peak = Math.max(C.peak, C.active);
      return new Promise(r => setTimeout(() => { C.active--; C.writes++; server[path] = JSON.parse(JSON.stringify(data)); persist(); emit(); r(); }, 150));
    },
    onSnapshot: (fn, err) => { const s = { prefix: path, isCol: false, fn, err }; subs.push(s); setTimeout(() => !s.dead && fn(snapshotFor(s)), 50); return () => { s.dead = true; }; },
    collection: (c) => colRef(path + '/' + c) });
  const colRef = (path) => ({ path, doc: (id) => docRef(path + '/' + id), limit() { return this; },
    onSnapshot: (fn, err) => { const s = { prefix: path, isCol: true, fn, err }; subs.push(s); setTimeout(() => !s.dead && fn(snapshotFor(s)), 50); return () => { s.dead = true; }; } });
  const db = { doc: docRef, collection: colRef };
  const user = { id: async () => 'u1', isOwner: () => true };
  window.claude = { use: async (name) => name === 'db' ? db : name === 'user' ? user : null };
})();
