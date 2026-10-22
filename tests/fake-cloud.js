// Nube falsa para las pruebas: imita el guardado de claude.ai con retraso y
// con "fotos" atrasadas (una actualización periódica que llega con datos viejos).
(() => {
  const server = {};           // path -> data
  const subs = [];             // {prefix, isCol, fn}
  const snapshotFor = (s) => {
    if (s.isCol) { const docs = Object.keys(server).filter(p => p.startsWith(s.prefix + '/') && p.slice(s.prefix.length + 1).indexOf('/') < 0).map(p => ({ id: p.split('/').pop(), exists: true, data: () => JSON.parse(JSON.stringify(server[p])), metadata: {} })); return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: {} }; }
    const v = server[s.prefix]; return { id: s.prefix.split('/').pop(), exists: v !== undefined, data: () => v === undefined ? undefined : JSON.parse(JSON.stringify(v)), metadata: {} };
  };
  const emit = (stale) => subs.forEach(s => { const snap = stale && s.old ? s.old : snapshotFor(s); s.fn(snap); });
  // cada 700 ms llega una foto tomada 1,2 s antes (atrasada)
  setInterval(() => { subs.forEach(s => { s.hist = s.hist || []; s.hist.push({ t: Date.now(), snap: snapshotFor(s) }); s.hist = s.hist.filter(h => Date.now() - h.t < 3000); const old = s.hist.find(h => Date.now() - h.t >= 1200); if (old) s.fn(old.snap); }); }, 700);
  const docRef = (path) => ({ id: path.split('/').pop(), path,
    set: (data) => new Promise(r => setTimeout(() => { server[path] = JSON.parse(JSON.stringify(data)); emit(false); r(); }, 400)),
    onSnapshot: (fn) => { const s = { prefix: path, isCol: false, fn }; subs.push(s); setTimeout(() => fn(snapshotFor(s)), 50); return () => {}; },
    collection: (c) => colRef(path + '/' + c) });
  const colRef = (path) => ({ path, doc: (id) => docRef(path + '/' + id), limit() { return this; },
    onSnapshot: (fn) => { const s = { prefix: path, isCol: true, fn }; subs.push(s); setTimeout(() => fn(snapshotFor(s)), 50); return () => {}; } });
  const db = { doc: docRef, collection: colRef };
  const user = { id: async () => 'u1', isOwner: () => true };
  window.claude = { use: async (name) => name === 'db' ? db : name === 'user' ? user : null };
})();
