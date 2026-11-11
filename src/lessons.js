const REMOTE = (import.meta.env.VITE_AULAS_URL || '').replace(/\/$/, '');

function cacheGet(p) { try { return localStorage.getItem('mpf:aula:' + p); } catch (e) { return null; } }
function cacheSet(p, t) { try { localStorage.setItem('mpf:aula:' + p, t); } catch (e) {} }

async function fetchText(url, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { cache: 'no-cache', signal: ctl.signal });
    if (!r.ok) throw new Error(r.status);
    return await r.text();
  } finally { clearTimeout(t); }
}

export async function getLessonText(path) {
  const urls = REMOTE ? [REMOTE + '/' + path, path] : [path];
  for (const u of urls) {
    try {
      const txt = await fetchText(u, 6000);
      cacheSet(path, txt);
      return txt;
    } catch (e) {}
  }
  const c = cacheGet(path);
  if (c) return c;
  throw new Error('aula indisponível');
}
