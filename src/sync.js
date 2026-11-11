import { createClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL || '';
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const TABLE = 'mpf_docs';

export const sb = URL && KEY
  ? createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'mpf-auth' } })
  : null;

const ls = {
  get(k) { try { return JSON.parse(localStorage.getItem('mpf:' + k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem('mpf:' + k, JSON.stringify(v)); } catch (e) {} },
};

let user = null;
let hooks = { read: () => null, apply: () => {}, status: () => {} };
let pushTimer = null;
let pushing = false;
let channel = null;

const dirty = () => ls.get('dirty') || {};
const setDirty = (d) => ls.set('dirty', d);
const upd = () => ls.get('upd') || {};
const setUpd = (u) => ls.set('upd', u);

export function configured() { return !!sb; }
export function currentUser() { return user; }

export function markDirty(name) {
  const d = dirty();
  d[name] = (d[name] || 0) + 1;
  setDirty(d);
  if (!user) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(push, 700);
}

async function push() {
  if (!user || pushing) return;
  const d = dirty();
  const names = Object.keys(d);
  if (!names.length) { hooks.status('on'); return; }
  if (!navigator.onLine) { hooks.status('offline'); return; }
  pushing = true;
  hooks.status('busy');
  const now = new Date().toISOString();
  const rows = names.map((name) => ({ user_id: user.id, name, data: hooks.read(name) ?? {}, updated_at: now }));
  const { error } = await sb.from(TABLE).upsert(rows, { onConflict: 'user_id,name' });
  pushing = false;
  if (error) {
    console.warn('push', error);
    hooks.status('offline');
    clearTimeout(pushTimer);
    pushTimer = setTimeout(push, 15000);
    return;
  }
  const after = dirty();
  const u = upd();
  names.forEach((n) => { if (after[n] === d[n]) delete after[n]; u[n] = now; });
  setDirty(after);
  setUpd(u);
  if (Object.keys(after).length) { clearTimeout(pushTimer); pushTimer = setTimeout(push, 700); }
  else hooks.status('on');
}

function applyRow(row) {
  if (!row || !row.name) return false;
  if (dirty()[row.name]) return false;
  const u = upd();
  if (u[row.name] && u[row.name] >= row.updated_at) return false;
  u[row.name] = row.updated_at;
  setUpd(u);
  hooks.apply(row.name, row.data);
  return true;
}

export async function pull() {
  if (!user) return;
  if (!navigator.onLine) { hooks.status('offline'); return; }
  hooks.status('busy');
  const { data, error } = await sb.from(TABLE).select('name,data,updated_at');
  if (error) { console.warn('pull', error); hooks.status('offline'); return; }
  let changed = false;
  (data || []).forEach((r) => { if (applyRow(r)) changed = true; });
  if (changed) hooks.apply(null);
  await push();
}

function subscribe() {
  if (channel) sb.removeChannel(channel);
  channel = sb.channel('mpf-docs-' + user.id)
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE, filter: `user_id=eq.${user.id}` }, (p) => {
      if (applyRow(p.new)) hooks.apply(null);
    })
    .subscribe();
}

export async function start(h) {
  hooks = { ...hooks, ...h };
  if (!sb) { hooks.status('local'); return null; }
  const { data } = await sb.auth.getSession();
  user = data.session ? data.session.user : null;
  sb.auth.onAuthStateChange((_ev, session) => {
    const was = user && user.id;
    user = session ? session.user : null;
    if (user && user.id !== was) { subscribe(); pull(); }
    if (!user) { if (channel) { sb.removeChannel(channel); channel = null; } hooks.status('local'); }
  });
  if (user) { subscribe(); pull(); }
  else hooks.status('local');
  window.addEventListener('online', () => { if (user) pull(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && user) pull(); });
  return user;
}

export async function sendCode(email) {
  const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw error;
}

export async function verifyCode(email, token) {
  const { data, error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
  return data.user;
}

export async function signOut() {
  await sb.auth.signOut();
}
