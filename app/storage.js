/*
 * Storage adapter. The dashboard only talks to window.CornellStorage.use("db"),
 * which exposes a small Firestore-like surface:
 *
 *   db.collection(name).onSnapshot(cb, errCb)   cb({docs:[{id, data()}]})
 *   db.collection(name).add(obj)  -> {id}
 *   db.collection(name).doc(id).set(obj)
 *   db.collection(name).doc(id).delete()
 *
 * To move to another backend (Supabase, Firebase, Cloudflare D1, a REST API),
 * write another adapter that implements those four calls and register it below.
 * Nothing else in the app depends on a specific vendor or LLM.
 */
(function () {
  // 1) Claude artifact runtime, when the page is hosted as a Claude artifact.
  function claudeAdapter() {
    if (window.claude && window.claude.use) return { use: (n) => window.claude.use(n) };
    return null;
  }

  // 2) Local-only adapter (localStorage). Good for development and demos.
  function localAdapter() {
    const KEY = "cornell-os:";
    const listeners = {};
    const read = (c) => { try { return JSON.parse(localStorage.getItem(KEY + c) || "{}"); } catch (e) { return {}; } };
    const write = (c, v) => { localStorage.setItem(KEY + c, JSON.stringify(v)); (listeners[c] || []).forEach((f) => f()); };
    const snap = (c) => ({ docs: Object.entries(read(c)).map(([id, d]) => ({ id, data: () => d })) });
    const db = {
      collection(c) {
        return {
          onSnapshot(cb) { (listeners[c] = listeners[c] || []).push(() => cb(snap(c))); cb(snap(c)); },
          async add(obj) { const all = read(c); const id = "p" + Date.now().toString(36); all[id] = obj; write(c, all); return { id }; },
          doc(id) {
            return {
              async set(obj) { const all = read(c); all[id] = obj; write(c, all); },
              async delete() { const all = read(c); delete all[id]; write(c, all); },
            };
          },
        };
      },
    };
    return { use: async () => db };
  }

  // 3) Add your production adapter here (e.g. supabaseAdapter()).

  window.CornellStorage = claudeAdapter() || localAdapter();
})();
