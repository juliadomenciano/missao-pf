import { aulaEstudada } from './quest.js';
import { setReminders, askPermission } from './native.js';

let C;
const BOX_DIAS = [1, 3, 7, 14, 30];
const NOVOS_DIA = 15;

export function initRevisao(ctx) {
  C = ctx;
  C.registerDoc('rev', { aulas: {}, fc: {}, lei: {}, novos: {} });
  Object.assign(C.EXT, {
    revisao: renderRevisao,
    flash: renderFlash,
    lei: renderLei,
    counts: () => { const d = dueAulas().length; const f = flashDueCount(); const n = d + (f ? 1 : 0); return n ? { revisao: n } : {}; },
    hoje: hojeCard,
    config: renderConfigRev,
  });
  C.listen((t) => { if (t === 'estudada') C.renderNav(); });
}

const R = () => C.getDoc('rev');
const cfgRev = () => { const c = C.getDoc('cfg'); c.rev = c.rev || { int: [1, 7, 30] }; return c.rev; };

function addDaysKey(k, n) { return C.dkey(C.addDays(C.parseKey(k), n)); }

function aulaReviewState(id) {
  const p = C.getDoc('aulas').p[id];
  if (!p || !p.estudada) return null;
  const ints = cfgRev().int;
  const st = R().aulas[id] || { k: 0, feitas: [] };
  if (st.k >= ints.length) return { done: true, st };
  return { due: addDaysKey(p.estudada, ints[st.k]), etapa: st.k + 1, total: ints.length, st };
}

function dueAulas() {
  const hoje = C.dkey();
  const p = C.getDoc('aulas').p;
  return Object.keys(p).map((id) => ({ id, s: aulaReviewState(id) })).filter((x) => x.s && !x.s.done && x.s.due <= hoje);
}

async function catalogMap() {
  const list = await C.loadCatalog();
  return Object.fromEntries(list.map((a) => [a.id, a]));
}

function marcarRevisao(id) {
  const r = R();
  const st = r.aulas[id] || (r.aulas[id] = { k: 0, feitas: [] });
  st.k++; st.feitas.push(C.dkey());
  C.save('rev');
  C.onEvent('revisao', id);
}

function hojeCard() {
  const d = dueAulas().length;
  const f = flashDueCount();
  if (!d && !f) return `<div class="card accent" style="--c:var(--col)"><span class="k">Revisão</span><h2>Nada para revisar hoje ✓</h2><div class="row"><button class="btn sm ghost" type="button" data-go="revisao">Ver próximas revisões</button></div></div>`;
  return `<div class="card accent" style="--c:var(--col)"><span class="k">Revisão de hoje</span><h2>${d ? `${d} ${d === 1 ? 'aula' : 'aulas'} para revisar` : ''}${d && f ? ' · ' : ''}${f ? `${f} flashcards` : ''}</h2><div class="row"><button class="btn sm" type="button" data-go="revisao">Revisar agora</button></div></div>`;
}

async function renderRevisao(v) {
  v.innerHTML = '<p class="empty">Carregando…</p>';
  const cat = await catalogMap();
  const hoje = C.dkey();
  const p = C.getDoc('aulas').p;
  const all = Object.keys(p).filter((id) => p[id].estudada && cat[id]).map((id) => ({ id, a: cat[id], s: aulaReviewState(id) }));
  const due = all.filter((x) => !x.s.done && x.s.due <= hoje).sort((a, b) => (a.s.due < b.s.due ? -1 : 1));
  const prox = all.filter((x) => !x.s.done && x.s.due > hoje).sort((a, b) => (a.s.due < b.s.due ? -1 : 1));
  const fdue = flashDueCount();
  const nErr = Object.keys(C.getDoc('quest').erros || {}).length;
  const ints = cfgRev().int;
  const card = (x, isDue) => {
    const m = C.MM[x.a.materia] || { c: '#888', n: '' };
    const atraso = isDue && x.s.due < hoje ? ` · atrasada desde ${C.fmtDate(x.s.due)}` : '';
    return `<div class="li" style="border-left:4px solid ${m.c};align-items:flex-start"><span class="t"><b>${C.esc(m.n)} · Aula ${x.a.numero}</b><br><span class="small">${C.esc(x.a.titulo)}</span><br><span class="small muted">Revisão ${x.s.etapa} de ${x.s.total}${isDue ? atraso : ` · ${C.fmtDate(x.s.due)}`}</span></span>${isDue ? `<div style="display:grid;gap:6px;justify-items:end"><button class="btn sm" type="button" data-open="${x.id}">Abrir aula</button><button class="btn sm primary" type="button" data-done="${x.id}">Revisei ✓</button></div>` : ''}</div>`;
  };
  v.innerHTML = `<div class="vhead"><h1>Revisar hoje</h1><p class="muted">Revisões em ${ints.join(', ')} dias depois de marcar a aula como estudada. Dá para mudar em Configurações.</p></div>
    <div class="stats"><div class="stat"><span class="k">Aulas para revisar</span><span class="v">${due.length}</span></div><div class="stat"><span class="k">Flashcards de hoje</span><span class="v">${fdue}</span></div><div class="stat"><span class="k">Caderno de erros</span><span class="v">${nErr}</span></div></div>
    <div class="card"><h2>Aulas para revisar</h2>${due.length ? `<p class="small muted">Sugestão: leia a lei seca e os esquemas, faça os flashcards da aula e refaça os erros. Depois toque em "Revisei".</p><div class="list">${due.map((x) => card(x, true)).join('')}</div>` : '<p class="empty">Nenhuma aula com revisão para hoje.</p>'}</div>
    <div class="row"><button class="btn" type="button" data-go="flash">Flashcards (${fdue})</button><button class="btn" type="button" data-go="lei">Lei seca</button><button class="btn" type="button" data-go="erros">Caderno de erros (${nErr})</button></div>
    <div class="card"><h2>Próximas revisões</h2>${prox.length ? `<div class="list">${prox.slice(0, 15).map((x) => card(x, false)).join('')}</div>` : `<p class="empty">${all.length ? 'Todas as revisões programadas foram feitas.' : 'Marque uma aula como estudada para começar a programar revisões.'}</p>`}</div>`;
  v.querySelectorAll('[data-open]').forEach((b) => b.onclick = () => { location.hash = 'aula-' + b.dataset.open; });
  v.querySelectorAll('[data-done]').forEach((b) => b.onclick = () => { marcarRevisao(b.dataset.done); C.toast('Revisão registrada.'); C.renderNav(); renderRevisao(v); });
}

let deck = null;

function flashDueCount() {
  const hoje = C.dkey();
  const fc = R().fc;
  let n = 0;
  for (const id in fc) if (fc[id].due <= hoje && aulaEstudada(id.split(':')[0])) n++;
  return n;
}

async function allCards(todas) {
  const list = (await C.loadCatalog()).filter((a) => !a.embreve && (todas || aulaEstudada(a.id)));
  const out = [];
  for (const a of list) {
    let A; try { A = await C.fetchAula(a); } catch (e) { continue; }
    (A.data.flashcards || []).forEach((c, i) => out.push({ id: `${a.id}:${i}`, a, ...c }));
  }
  return out;
}

async function renderFlash(v) {
  if (deck) return drawCard(v);
  v.innerHTML = '<p class="empty">Carregando flashcards…</p>';
  const todas = !!C.local.get('flashTodas');
  const cards = await allCards(todas);
  const r = R();
  const hoje = C.dkey();
  const due = cards.filter((c) => r.fc[c.id] && r.fc[c.id].due <= hoje);
  const novosHoje = r.novos[hoje] || 0;
  const novos = cards.filter((c) => !r.fc[c.id]).slice(0, Math.max(0, NOVOS_DIA - novosHoje));
  const total = cards.length;
  const dom = cards.filter((c) => r.fc[c.id] && r.fc[c.id].b >= 4).length;
  v.innerHTML = `<div class="vhead"><h1>Flashcards</h1><p class="muted">Marque "Sabia" ou "Não sabia". Os difíceis voltam logo, e os fáceis aparecem cada vez mais espaçados (1, 3, 7, 14 e 30 dias).</p></div>
    <div class="stats"><div class="stat"><span class="k">Para hoje</span><span class="v">${due.length}</span></div><div class="stat"><span class="k">Novos</span><span class="v">${novos.length}</span></div><div class="stat"><span class="k">Dominados</span><span class="v">${dom} / ${total}</span></div></div>
    <div class="card">${due.length + novos.length ? `<h2>${due.length + novos.length} cards na sessão de hoje</h2><button class="btn primary" type="button" id="fcStart" style="justify-self:start">Começar</button>` : `<h2>${total ? 'Tudo em dia ✓' : 'Nenhum flashcard disponível'}</h2><p class="muted">${total ? 'Volte amanhã para os próximos cards.' : 'Marque uma aula como estudada ou inclua todas as aulas.'}</p>`}
      <label class="toggle"><span class="t">Incluir aulas ainda não estudadas</span><input class="sw" type="checkbox" id="fcTodas" ${todas ? 'checked' : ''}></label></div>`;
  v.querySelector('#fcTodas').onchange = (e) => { C.local.set('flashTodas', e.target.checked); renderFlash(v); };
  const st = v.querySelector('#fcStart');
  if (st) st.onclick = () => { deck = { fila: [...due, ...novos].sort(() => Math.random() - 0.5), feitos: 0, sabia: 0, total: due.length + novos.length }; drawCard(v); };
}

function drawCard(v) {
  if (!deck.fila.length) {
    v.innerHTML = `<div class="vhead"><h1>Sessão concluída ✓</h1></div><div class="card"><p>${deck.total} cards revisados. Você sabia ${deck.sabia} de ${deck.feitos} respostas.</p><div class="row"><button class="btn primary" type="button" id="fcBack">Voltar</button></div></div>`;
    v.querySelector('#fcBack').onclick = () => { deck = null; renderFlash(v); };
    C.onEvent('flash');
    return;
  }
  const c = deck.fila[0];
  const m = C.MM[c.a.materia] || { c: '#888', n: '' };
  v.innerHTML = `<div class="row between"><span class="k">${C.esc(m.n)} · Aula ${c.a.numero} · ${C.esc(c.k)}</span><span class="small muted num">${deck.fila.length} restantes</span></div>
    <button type="button" class="fc big-fc" id="fcCard" aria-pressed="false"><span class="fk">${c.k}</span><span class="front">${c.f}</span><span class="back">${c.b}</span><span class="small muted fc-hint">Toque para ver a resposta</span></button>
    <div class="row fc-ans" id="fcAns" hidden><button class="btn" type="button" id="fcNo" style="flex:1;border-color:var(--bad)">Não sabia</button><button class="btn" type="button" id="fcYes" style="flex:1;border-color:var(--ok)">Sabia</button></div>
    <div class="row"><button class="btn sm ghost" type="button" id="fcStop">Encerrar sessão</button></div>`;
  const card = v.querySelector('#fcCard');
  card.onclick = () => { card.classList.add('on'); card.setAttribute('aria-pressed', 'true'); v.querySelector('#fcAns').hidden = false; };
  const answer = (ok) => {
    const r = R();
    const hoje = C.dkey();
    const novo = !r.fc[c.id];
    if (novo) r.novos[hoje] = (r.novos[hoje] || 0) + 1;
    Object.keys(r.novos).forEach((k) => { if (k < addDaysKey(hoje, -7)) delete r.novos[k]; });
    const st = r.fc[c.id] || { b: 0 };
    deck.feitos++;
    deck.fila.shift();
    if (ok) { deck.sabia++; st.b = Math.min(5, st.b + 1); st.due = addDaysKey(hoje, BOX_DIAS[st.b - 1]); }
    else { st.b = 1; st.due = hoje; deck.fila.push(c); }
    r.fc[c.id] = st;
    C.save('rev');
    drawCard(v);
  };
  v.querySelector('#fcYes').onclick = () => answer(true);
  v.querySelector('#fcNo').onclick = () => answer(false);
  v.querySelector('#fcStop').onclick = () => { deck = null; C.renderNav(); renderFlash(v); };
}

let leiAula = null;

async function renderLei(v) {
  v.innerHTML = '<p class="empty">Carregando…</p>';
  const list = (await C.loadCatalog()).filter((a) => !a.embreve);
  const comLei = [];
  for (const a of list) {
    let A; try { A = await C.fetchAula(a); } catch (e) { continue; }
    const sec = A.secs.find((s) => /lei seca/i.test(s.dataset.sec || ''));
    if (sec) comLei.push({ a, arts: [...sec.querySelectorAll('.law p')].map((p) => p.innerHTML) });
  }
  if (!leiAula || !comLei.find((x) => x.a.id === leiAula)) leiAula = (comLei[0] || {}).a?.id;
  const sel = comLei.find((x) => x.a.id === leiAula);
  const L = R().lei;
  v.innerHTML = `<div class="vhead"><h1>Lei seca com lacunas</h1><p class="muted">Tente lembrar o trecho escondido antes de tocar. Depois marque se lembrou. Os artigos em que você errou ficam destacados.</p></div>
    ${comLei.length ? `<div class="seg" id="leiSel">${comLei.map((x) => `<button type="button" data-a="${x.a.id}" aria-pressed="${x.a.id === leiAula}">${C.esc(C.MM[x.a.materia]?.n || '')} · Aula ${x.a.numero}</button>`).join('')}</div>` : '<p class="empty">Nenhuma aula com lei seca ainda.</p>'}
    ${sel ? `<div class="row"><button class="btn sm" type="button" id="leiRev">Revelar tudo</button><button class="btn sm ghost" type="button" id="leiHide">Esconder tudo</button><span class="small muted" id="leiScore"></span></div><div class="law lacunas" id="leiList">${sel.arts.map((h, i) => {
      const id = `${sel.a.id}:${i}`; const st = L[id];
      const html = h.replace(/<mark>(.*?)<\/mark>/g, (_, t) => `<span role="button" tabindex="0" class="gap" data-t="${encodeURIComponent(t)}">${'_'.repeat(Math.min(18, Math.max(6, t.replace(/<[^>]+>/g, '').length)))}</span>`);
      const hasGap = /<mark>/.test(h);
      return `<div class="lei-art${st && !st.ok ? ' miss' : ''}" data-id="${id}"><p>${html}</p>${hasGap ? `<div class="row small lei-ctl"><button class="btn sm" type="button" data-r="0">Errei</button><button class="btn sm" type="button" data-r="1">Lembrei</button>${st ? `<span class="muted">${st.ok ? '✓' : '✗'} ${C.fmtDate(st.em)}</span>` : ''}</div>` : ''}</div>`;
    }).join('')}</div>` : ''}`;
  v.querySelectorAll('#leiSel button').forEach((b) => b.onclick = () => { leiAula = b.dataset.a; renderLei(v); });
  const reveal = (g) => { g.innerHTML = decodeURIComponent(g.dataset.t); g.classList.add('on'); };
  v.querySelectorAll('.gap').forEach((g) => { g.onclick = () => reveal(g); g.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reveal(g); } }; });
  const rv = v.querySelector('#leiRev'); if (rv) rv.onclick = () => v.querySelectorAll('.gap').forEach(reveal);
  const hd = v.querySelector('#leiHide'); if (hd) hd.onclick = () => renderLei(v);
  v.querySelectorAll('.lei-art').forEach((art) => art.querySelectorAll('[data-r]').forEach((b) => b.onclick = () => {
    const r = R(); r.lei[art.dataset.id] = { ok: b.dataset.r === '1', em: C.dkey() }; C.save('rev');
    art.classList.toggle('miss', b.dataset.r !== '1');
    art.querySelectorAll('.gap').forEach(reveal);
    const ctl = art.querySelector('.lei-ctl span.muted'); const t = `${b.dataset.r === '1' ? '✓' : '✗'} ${C.fmtDate(C.dkey())}`;
    if (ctl) ctl.textContent = t; else art.querySelector('.lei-ctl').insertAdjacentHTML('beforeend', `<span class="muted">${t}</span>`);
  }));
  if (sel) {
    const ids = sel.arts.map((_, i) => `${sel.a.id}:${i}`).filter((id) => L[id]);
    const ok = ids.filter((id) => L[id].ok).length;
    const sc = v.querySelector('#leiScore'); if (sc && ids.length) sc.textContent = `Último treino: ${ok} de ${ids.length} lembrados`;
  }
}

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const LEMB = [
  ['estudar', 'Hora de estudar', 'Um aviso por dia para começar o estudo.', '19:00'],
  ['rev', 'Revisões do dia', 'Revisões espaçadas, flashcards e caderno de erros.', '08:00'],
  ['qdia', 'Questão do dia', 'Aviso de que os itens do dia estão prontos.', '12:00'],
  ['taf', 'Treino do TAF', 'Nos dias da semana que você escolher.', '07:00'],
];

function lembCfg() {
  const c = C.getDoc('cfg');
  c.lemb = c.lemb || {};
  LEMB.forEach(([k, , , h]) => { c.lemb[k] = c.lemb[k] || { on: false, h }; });
  if (!c.lemb.taf.dias) c.lemb.taf.dias = [1, 3, 5];
  return c.lemb;
}

export async function applyReminders() {
  const l = lembCfg();
  const hm = (s) => { const [h, m] = (s || '08:00').split(':').map(Number); return { hour: h || 0, minute: m || 0 }; };
  const list = [];
  if (l.estudar.on) list.push({ id: 101, title: 'Hora de estudar 📚', body: 'Abra o Missão PF e comece o próximo bloco do ciclo.', on: hm(l.estudar.h) });
  if (l.rev.on) list.push({ id: 102, title: 'Revisões de hoje', body: 'Confira as revisões, os flashcards e o caderno de erros.', on: hm(l.rev.h) });
  if (l.qdia.on) list.push({ id: 103, title: 'Questão do dia', body: 'Seus itens Cebraspe de hoje estão esperando.', on: hm(l.qdia.h) });
  if (l.taf.on) (l.taf.dias || []).forEach((d) => list.push({ id: 110 + d, title: 'Treino do TAF 💪', body: 'Hoje é dia de treino. Bora bater os índices!', on: { ...hm(l.taf.h), weekday: d + 1 } }));
  return setReminders(list);
}

function renderConfigRev() {
  const rc = cfgRev();
  const card = C.$('#cfgRevCard'); card.hidden = false;
  C.$('#cfgRev').innerHTML = `<label class="f">Intervalos em dias, separados por vírgula<input type="text" id="crInt" value="${rc.int.join(', ')}" inputmode="numeric"></label><p class="small muted">Contados a partir do dia em que a aula foi marcada como estudada. Padrão: 1, 7, 30.</p>`;
  C.$('#crInt').onchange = (e) => {
    const arr = e.target.value.split(/[^0-9]+/).map(Number).filter((n) => n > 0 && n < 400).sort((a, b) => a - b);
    rc.int = arr.length ? [...new Set(arr)] : [1, 7, 30];
    e.target.value = rc.int.join(', ');
    C.save('cfg'); C.renderNav(); C.toast('Intervalos salvos.');
  };
  const l = lembCfg();
  C.$('#cfgLembCard').hidden = false;
  C.$('#cfgLemb').innerHTML = (C.isNative ? '' : '<p class="small" style="color:var(--warn)">Os lembretes funcionam no app Android. Aqui você pode configurar, e eles valem quando abrir o app no celular.</p>') + LEMB.map(([k, n, d]) => `<div class="toggle" style="flex-wrap:wrap"><span class="t">${n}<small>${d}</small></span><input type="time" data-h="${k}" value="${l[k].h}" style="width:110px"><input class="sw" type="checkbox" data-on="${k}" ${l[k].on ? 'checked' : ''} aria-label="${n}">${k === 'taf' ? `<div class="seg" style="flex-basis:100%">${DIAS.map((dn, i) => `<button type="button" data-dia="${i}" aria-pressed="${l.taf.dias.includes(i)}">${dn}</button>`).join('')}</div>` : ''}</div>`).join('');
  const changed = async () => { C.save('cfg'); if (C.isNative) { await applyReminders(); C.toast('Lembretes atualizados.'); } };
  C.$('#cfgLemb').querySelectorAll('[data-on]').forEach((i) => i.onchange = async () => { l[i.dataset.on].on = i.checked; if (i.checked) await askPermission(true); changed(); });
  C.$('#cfgLemb').querySelectorAll('[data-h]').forEach((i) => i.onchange = () => { l[i.dataset.h].h = i.value || l[i.dataset.h].h; changed(); });
  C.$('#cfgLemb').querySelectorAll('[data-dia]').forEach((b) => b.onclick = () => { const d = +b.dataset.dia; const s = new Set(l.taf.dias); s.has(d) ? s.delete(d) : s.add(d); l.taf.dias = [...s].sort(); b.setAttribute('aria-pressed', s.has(d)); changed(); });
}
