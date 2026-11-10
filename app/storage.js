/*
 * Storage adapter. Apps only talk to window.CornellStorage.use("db"), a small
 * Firestore-like surface:
 *   db.collection(name).onSnapshot(cb, errCb)   cb({docs:[{id, data()}]})
 *   db.collection(name).add(obj)  -> {id}
 *   db.collection(name).doc(id).set(obj)
 *   db.collection(name).doc(id).delete()
 *
 * Adapters, tried in order:
 *   1. Claude artifact runtime (when hosted as a Claude artifact)
 *   2. REST adapter for the Cloudflare Pages Functions in /functions (production)
 *   3. localStorage (development and demos)
 * To change backends, add another adapter that implements the four calls above.
 */
(function () {
  function claudeAdapter() {
    if (window.claude && window.claude.use) return (n) => window.claude.use(n);
    return null;
  }

  function restAdapter() {
    const POLL_MS = 15000;
    async function call(method, url, body) {
      const r = await fetch(url, {
        method, credentials: "same-origin",
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!r.ok) {
        let m = r.statusText;
        try { m = (await r.json()).error || m; } catch (e) {}
        throw new Error(m);
      }
      return r.json();
    }
    const base = (c) => "/api/db/" + encodeURIComponent(c);
    const listeners = {};
    async function refresh(c) {
      const out = await call("GET", base(c));
      const snap = { docs: out.docs.map((d) => ({ id: d.id, data: () => d.data })) };
      (listeners[c] || []).forEach((l) => l.cb(snap));
    }
    return {
      collection(c) {
        return {
          onSnapshot(cb, errCb) {
            (listeners[c] = listeners[c] || []).push({ cb });
            const tick = () => refresh(c).catch((e) => errCb && errCb(e));
            tick();
            setInterval(tick, POLL_MS);
          },
          async add(obj) { const r = await call("POST", base(c), obj); refresh(c).catch(() => {}); return { id: r.id }; },
          doc(id) {
            return {
              async set(obj) { await call("PUT", base(c) + "/" + encodeURIComponent(id), obj); refresh(c).catch(() => {}); },
              async delete() { await call("DELETE", base(c) + "/" + encodeURIComponent(id)); refresh(c).catch(() => {}); },
            };
          },
        };
      },
    };
  }

  function localAdapter() {
    const KEY = "cornell-os:";
    const listeners = {};
    const read = (c) => { try { return JSON.parse(localStorage.getItem(KEY + c) || "{}"); } catch (e) { return {}; } };
    const write = (c, v) => { localStorage.setItem(KEY + c, JSON.stringify(v)); (listeners[c] || []).forEach((f) => f()); };
    const snap = (c) => ({ docs: Object.entries(read(c)).map(([id, d]) => ({ id, data: () => d })) });
    return {
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
  }

  async function me() {
    try {
      const r = await fetch("/api/me", { credentials: "same-origin" });
      if (!r.ok) return null;
      return await r.json();
    } catch (e) { return null; }
  }

  const viaClaude = claudeAdapter();
  window.CornellStorage = {
    me,
    async use() {
      if (viaClaude) return viaClaude("db");
      if (await me()) return restAdapter();
      return localAdapter();
    },
  };
})();
