let C;
let bank = null;
let bankLoading = null;

export function initQuest(ctx) { C = ctx; }

const BLOCOS = { 1: 60, 2: 36, 3: 24 };
const CORTE = { 1: 6, 2: 3, 3: 2, total: 48 };
const MIN_POR_ITEM = 2.2;

function Q() { return C.getDoc('quest'); }

export function aulaEstudada(id) {
  const p = C.getDoc('aulas').p[id];
  return !!(p && p.estudada);
}

export async function loadBank(force) {
  if (bank && !force) return bank;
  if (bankLoading) return bankLoading;
  bankLoading = (async () => {
    const list = (await C.loadCatalog()).filter((a) => !a.embreve);
    const items = [];
    for (const a of list) {
      let A;
      try { A = await C.fetchAula(a); } catch (e) { continue; }
      const m = C.MM[a.materia] || { b: 1 };
      const push = (sits, tag) => (sits || []).forEach((s, si) => s.itens.forEach((it, ii) => {
        items.push({ id: `${a.id}:${tag}${si}-${ii}`, aula: a.id, aulaNome: `Aula ${a.numero}`, m: a.materia, b: m.b || 1, sitKey: `${a.id}:${tag}${si}`, sitT: s.t, sitTxt: s.txt, s: it.s, g: it.g, c: it.c });
      }));
      push(A.data.situacoes, '');
      push(A.data.banco, 'b');
    }
    bank = items;
    bankLoading = null;
    return items;
  })();
  return bankLoading;
}

export function record(id, v, g, em) {
  const q = Q();
  const h = q.hist[id] || (q.hist[id] = { n: 0, ok: 0 });
  const r = v === 'B' ? 'bl' : v === g ? 'ok' : 'bad';
  h.n++; if (r === 'ok') h.ok++;
  h.r = r; h.em = em || C.dkey();
  if (r === 'ok') delete q.erros[id];
  else if (!q.erros[id]) q.erros[id] = { desde: h.em };
  C.save('quest');
  return r;
}

export function stats() {
  const q = Q();
  let n = 0, ok = 0, bad = 0, bl = 0;
  const porM = {};
  Object.entries(q.hist).forEach(([id, h]) => {
    n++;
    if (h.r === 'ok') ok++; else if (h.r === 'bad') bad++; else bl++;
    const aula = id.split(':')[0];
    const m = (bank && (bank.find((x) => x.id === id) || {}).m) || C.aulaMateria(aula);
    const pm = porM[m] || (porM[m] = { n: 0, ok: 0, bad: 0 });
    pm.n++; if (h.r === 'ok') pm.ok++; else if (h.r === 'bad') pm.bad++;
  });
  return { n, ok, bad, bl, porM, erros: Object.keys(q.erros).length, sims: q.sims };
}

function shuffle(a, rnd = Math.random) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
}

function pickBySit(pool, n, rnd) {
  const bySit = {};
  pool.forEach((it) => { (bySit[it.sitKey] = bySit[it.sitKey] || []).push(it); });
  const keys = shuffle(Object.keys(bySit), rnd);
  const out = [];
  for (const k of keys) {
    if (out.length >= n) break;
    const its = bySit[k];
    const room = n - out.length;
    out.push(...(its.length <= room ? its : shuffle([...its], rnd).slice(0, room)));
  }
  return out;
}

function runnerHTML(sess, itemsById, opts) {
  let lastSit = null, html = '', num = 0;
  sess.itens.forEach((id) => {
    const it = itemsById[id];
    if (!it) return;
    num++;
    if (it.sitKey !== lastSit) {
      if (lastSit) html += '</div>';
      html += `<div class="sit"><div class="sit-h"><span class="lbl" style="color:${C.MM[it.m]?.c || 'var(--q)'}">${C.esc(C.MM[it.m]?.n || '')} · ${C.esc(it.aulaNome)} · ${C.esc(it.sitT)}</span><p>${it.sitTxt}</p></div>`;
      lastSit = it.sitKey;
    }
    const st = sess.resp[id] || {};
    const show = st.done && !opts.hideFb;
    const r = st.v === 'B' ? 'blank' : st.v === it.g ? 'right' : 'wrong';
    html += `<div class="item${show ? ' done ' + r : ''}" data-id="${id}"><div class="st"><span class="n">${num}</span><p>${it.s}</p></div>
      <div class="ans" role="group" aria-label="Resposta do item ${num}">${['C', 'E', 'B'].map((v) => `<button type="button" data-v="${v}" aria-pressed="${st.v === v}" ${(st.done && !opts.editable) ? 'disabled' : ''}>${v === 'C' ? 'CERTO' : v === 'E' ? 'ERRADO' : 'Em branco'}</button>`).join('')}</div>
      <div class="fb"><span class="res">${show ? (r === 'right' ? 'Você acertou (+1).' : r === 'wrong' ? 'Você errou (−1).' : 'Em branco (0).') : ''}</span> Gabarito: <b>${it.g === 'C' ? 'CERTO' : 'ERRADO'}</b>. ${it.c}</div></div>`;
  });
  if (lastSit) html += '</div>';
  return html;
}

function score(sess, itemsById) {
  let ok = 0, bad = 0, bl = 0, done = 0;
  const bl3 = { 1: { ok: 0, bad: 0, n: 0 }, 2: { ok: 0, bad: 0, n: 0 }, 3: { ok: 0, bad: 0, n: 0 } };
  sess.itens.forEach((id) => {
    const it = itemsById[id]; if (!it) return;
    const st = sess.resp[id];
    const b = bl3[it.b] || bl3[1]; b.n++;
    if (!st || !st.v || st.v === 'B') { bl++; if (st && st.done) done++; return; }
    if (st.done) done++;
    if (st.v === it.g) { ok++; b.ok++; } else { bad++; b.bad++; }
  });
  return { ok, bad, bl, net: ok - bad, done, total: sess.itens.length, blocos: bl3 };
}

function scoreBar(sc, extra) {
  return `<div class="score" aria-live="polite"><div><div class="k">Acertos</div><div class="v ok">${sc.ok}</div></div><div><div class="k">Erros</div><div class="v bad">${sc.bad}</div></div><div><div class="k">Em branco</div><div class="v">${sc.bl}</div></div><div><div class="k">Líquido</div><div class="v ${sc.net > 0 ? 'ok' : sc.net < 0 ? 'bad' : ''}">${sc.net}</div></div>${extra || ''}</div>`;
}

function bindRunner(root, sess, itemsById, opts, onChange) {
  root.querySelectorAll('.item[data-id]').forEach((d) => {
    const id = d.dataset.id;
    d.querySelectorAll('.ans button').forEach((b) => b.onclick = () => {
      const st = sess.resp[id];
      if (st && st.done && !opts.editable) return;
      if (opts.instant) {
        sess.resp[id] = { v: b.dataset.v, done: true };
        record(id, b.dataset.v, itemsById[id].g);
      } else {
        sess.resp[id] = { v: b.dataset.v, done: false };
      }
      onChange(id);
    });
  });
}

export async function renderQdia(v) {
  const cfg = C.getDoc('cfg');
  const qc = cfg.qdia || (cfg.qdia = { n: 5, todas: false });
  v.innerHTML = '<p class="empty">Carregando questões…</p>';
  const items = await loadBank();
  const byId = Object.fromEntries(items.map((x) => [x.id, x]));
  const q = Q();
  const hoje = C.dkey();
  const estudadas = items.filter((it) => aulaEstudada(it.aula));
  const pool = qc.todas ? items : estudadas;
  if (!q.qdia || q.qdia.d !== hoje || !q.qdia.ids.every((id) => byId[id])) {
    if (!pool.length) {
      v.innerHTML = `<div class="vhead"><h1>Questão do dia</h1></div><div class="card"><h2>Nenhuma aula marcada como estudada ainda</h2><p class="muted">A questão do dia usa as aulas que você marcou como estudadas. Abra uma aula e toque em "Marcar como estudada", ou inclua todas as aulas.</p><div class="row"><button class="btn primary" type="button" id="qdTodas">Incluir aulas não estudadas</button><button class="btn" type="button" data-go="aulas">Ir para Aulas</button></div></div>`;
      v.querySelector('#qdTodas').onclick = () => { qc.todas = true; C.save('cfg'); renderQdia(v); };
      return;
    }
    const rnd = seeded(hoje);
    const nunca = pool.filter((x) => !q.hist[x.id]);
    const errados = pool.filter((x) => q.erros[x.id]);
    const pref = [...shuffle([...errados], rnd).slice(0, Math.ceil(qc.n / 2)), ...shuffle([...nunca], rnd)];
    const chosen = [];
    for (const it of [...pref, ...shuffle([...pool], rnd)]) { if (chosen.length >= qc.n) break; if (!chosen.includes(it.id)) chosen.push(it.id); }
    chosen.sort((a, b) => (byId[a].sitKey < byId[b].sitKey ? -1 : 1));
    q.qdia = { d: hoje, ids: chosen, resp: {} };
    C.save('quest');
  }
  const sess = { itens: q.qdia.ids, resp: q.qdia.resp };
  const draw = () => {
    const sc = score(sess, byId);
    const fim = sc.done === sc.total;
    v.innerHTML = `<div class="vhead"><span class="k">${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</span><h1>Questão do dia</h1><p class="muted">${sc.total} itens ${qc.todas ? 'de todas as aulas' : 'das aulas que você já estudou'}, com prioridade para os que você errou e os que nunca respondeu.</p></div>
      ${fim ? `<div class="card accent" style="--c:var(--ok)"><h2>Feito por hoje ✓</h2><p>Saldo líquido: <b>${sc.net}</b> (${sc.ok} certos, ${sc.bad} errados, ${sc.bl} em branco). Os erros foram para o caderno de erros.</p><div class="row"><button class="btn sm" type="button" data-go="erros">Abrir caderno de erros</button></div></div>` : ''}
      <div id="qdRun" style="display:grid;gap:16px">${runnerHTML(sess, byId, { instant: true })}</div>${scoreBar(sc, `<div class="grow muted small">${sc.done} de ${sc.total}</div>`)}`;
    bindRunner(v.querySelector('#qdRun'), sess, byId, { instant: true }, () => { C.save('quest'); draw(); });
  };
  draw();
}

let errosSess = null;
export async function renderErros(v) {
  v.innerHTML = '<p class="empty">Carregando…</p>';
  const items = await loadBank();
  const byId = Object.fromEntries(items.map((x) => [x.id, x]));
  const q = Q();
  const ids = Object.keys(q.erros).filter((id) => byId[id]);
  if (errosSess) {
    const sess = errosSess;
    const draw = () => {
      const sc = score(sess, byId);
      const fim = sc.done === sc.total;
      v.innerHTML = `<div class="row between"><div class="vhead"><h1>Refazendo erros</h1><p class="muted">Acertou, saiu do caderno. Errou de novo, continua nele.</p></div><button class="btn sm" type="button" id="erSair">${fim ? 'Concluir' : 'Parar'}</button></div><div id="erRun" style="display:grid;gap:16px">${runnerHTML(sess, byId, { instant: true })}</div>${scoreBar(sc, `<div class="grow muted small">${sc.done} de ${sc.total}</div>`)}`;
      bindRunner(v.querySelector('#erRun'), sess, byId, { instant: true }, () => draw());
      v.querySelector('#erSair').onclick = () => { errosSess = null; renderErros(v); };
    };
    draw();
    return;
  }
  const porM = {};
  ids.forEach((id) => { const m = byId[id].m; (porM[m] = porM[m] || []).push(id); });
  v.innerHTML = `<div class="vhead"><h1>Caderno de erros</h1><p class="muted">Todo item que você errar ou deixar em branco (nas aulas, na questão do dia ou nos simulados) vem para cá até você acertar.</p></div>
    ${ids.length ? `<div class="card"><div class="row between"><h2>${ids.length} ${ids.length === 1 ? 'item' : 'itens'} para refazer</h2><button class="btn primary" type="button" id="erAll">Refazer ${Math.min(30, ids.length)}</button></div>
      <div class="list">${Object.entries(porM).map(([m, l]) => `<div class="li"><span class="dot" style="--c:${C.MM[m]?.c}"></span><span class="t">${C.esc(C.MM[m]?.n || m)}</span><span class="num small">${l.length}</span><button class="btn sm" type="button" data-m="${m}">Refazer</button></div>`).join('')}</div></div>
      <div class="card"><h2>Itens no caderno</h2><div class="list">${ids.slice(0, 60).map((id) => { const it = byId[id]; return `<details class="erro"><summary><span class="dot" style="--c:${C.MM[it.m]?.c}"></span> ${it.s}</summary><p class="small"><b>Gabarito: ${it.g === 'C' ? 'CERTO' : 'ERRADO'}.</b> ${it.c}</p><p class="small muted">${C.esc(it.aulaNome)} · ${C.esc(it.sitT)} · no caderno desde ${C.fmtDate(q.erros[id].desde)}</p></details>`; }).join('')}</div></div>`
    : `<div class="card accent" style="--c:var(--ok)"><h2>Caderno vazio 🎯</h2><p class="muted">Nenhum erro pendente. Os itens que você errar daqui em diante aparecem aqui.</p></div>`}`;
  const start = (list) => { errosSess = { itens: shuffle([...list]).slice(0, 30).sort((a, b) => (byId[a].sitKey < byId[b].sitKey ? -1 : 1)), resp: {} }; renderErros(v); };
  const all = v.querySelector('#erAll'); if (all) all.onclick = () => start(ids);
  v.querySelectorAll('[data-m]').forEach((b) => b.onclick = () => start(porM[b.dataset.m]));
}

function simGet() { return C.local.get('sim'); }
function simSet(s) { C.local.set('sim', s); }
let simTick = null;

export async function renderSimulados(v) {
  clearInterval(simTick);
  v.innerHTML = '<p class="empty">Carregando banco de questões…</p>';
  const items = await loadBank();
  const byId = Object.fromEntries(items.map((x) => [x.id, x]));
  const sim = simGet();
  if (sim && !sim.fim) return runSim(v, sim, byId);
  if (sim && sim.fim) return resultSim(v, sim, byId);
  configSim(v, items);
}

function configSim(v, items) {
  const conf = C.local.get('simConf') || { modo: 'materia', m: 'const', n: 20, estudadas: true, real: false };
  const mats = [...new Set(items.map((x) => x.m))];
  const count = (c) => items.filter((x) => (c.modo === 'completa' || x.m === c.m) && (!c.estudadas || aulaEstudada(x.aula))).length;
  const hist = Q().sims.slice(-8).reverse();
  const draw = () => {
    const disp = count(conf);
    v.innerHTML = `<div class="vhead"><h1>Simulados</h1><p class="muted">Itens no estilo Cebraspe: certo +1, errado −1, em branco 0.</p></div>
    <div class="card"><h2>Novo simulado</h2>
      <div class="seg" id="smModo"><button type="button" data-v="materia" aria-pressed="${conf.modo === 'materia'}">Por matéria</button><button type="button" data-v="completa" aria-pressed="${conf.modo === 'completa'}">Prova completa</button></div>
      ${conf.modo === 'materia' ? `<div class="form"><label class="f">Matéria<select id="smM">${mats.map((m) => `<option value="${m}" ${m === conf.m ? 'selected' : ''}>${C.esc(C.MM[m]?.n || m)}</option>`).join('')}</select></label><label class="f">Quantidade de itens<input type="number" id="smN" min="5" max="120" value="${conf.n}"></label></div>`
      : `<p class="small muted">120 itens: Bloco I (60), Bloco II (36) e Bloco III (24), em 4h30, com corte de 6, 3 e 2 pontos por bloco e 48 no total.</p>`}
      <label class="row small"><input type="checkbox" id="smEst" ${conf.estudadas ? 'checked' : ''}> Só do que já estudei (aulas marcadas como estudadas)</label>
      <label class="row small"><input type="checkbox" id="smReal" ${conf.real ? 'checked' : ''}> Modo prova real: sem gabarito até entregar e com o tempo correndo</label>
      <p class="small ${disp ? 'muted' : ''}" style="${disp ? '' : 'color:var(--warn)'}">${disp ? `${disp} itens disponíveis com esses filtros.` : 'Nenhum item disponível com esses filtros. Desmarque "Só do que já estudei" ou marque aulas como estudadas.'}</p>
      <button class="btn primary" type="button" id="smGo" ${disp ? '' : 'disabled'} style="justify-self:start">Começar</button>
    </div>
    ${hist.length ? `<div class="card"><h2>Últimos simulados</h2><div class="list">${hist.map((s) => `<div class="li"><span class="t"><b>${s.modo === 'completa' ? 'Prova completa' : C.esc(C.MM[s.m]?.n || '')}</b> · ${s.total} itens${s.real ? ' · prova real' : ''}<br><span class="small muted">${C.fmtDate(s.em)} · ${s.ok}✓ ${s.bad}✗ ${s.bl}○</span></span><span class="pill ${s.aprovado === false ? 'bad' : s.net > 0 ? 'ok' : ''} num">líquido ${s.net}</span></div>`).join('')}</div></div>` : ''}`;
    v.querySelectorAll('#smModo button').forEach((b) => b.onclick = () => { conf.modo = b.dataset.v; draw(); });
    const sm = v.querySelector('#smM'); if (sm) sm.onchange = (e) => { conf.m = e.target.value; draw(); };
    const sn = v.querySelector('#smN'); if (sn) sn.onchange = (e) => { conf.n = Math.max(5, Math.min(120, +e.target.value || 20)); };
    v.querySelector('#smEst').onchange = (e) => { conf.estudadas = e.target.checked; draw(); };
    v.querySelector('#smReal').onchange = (e) => { conf.real = e.target.checked; };
    v.querySelector('#smGo').onclick = () => {
      C.local.set('simConf', conf);
      const pool = items.filter((x) => (conf.modo === 'completa' || x.m === conf.m) && (!conf.estudadas || aulaEstudada(x.aula)));
      let chosen = [], falta = null;
      if (conf.modo === 'completa') {
        falta = {};
        [1, 2, 3].forEach((b) => { const got = pickBySit(pool.filter((x) => x.b === b), BLOCOS[b]); chosen.push(...got); if (got.length < BLOCOS[b]) falta[b] = BLOCOS[b] - got.length; });
      } else chosen = pickBySit(pool, conf.n);
      chosen.sort((a, b) => a.b - b.b || (a.sitKey < b.sitKey ? -1 : 1));
      const dur = (conf.modo === 'completa' ? 270 : Math.ceil(chosen.length * MIN_POR_ITEM)) * 60000;
      simSet({ id: C.uid(), modo: conf.modo, m: conf.m, real: conf.real, ini: Date.now(), dur, itens: chosen.map((x) => x.id), resp: {}, falta, fim: null });
      renderSimulados(v);
    };
  };
  draw();
}

function runSim(v, sim, byId) {
  const real = sim.real;
  const timerEl = () => v.querySelector('#smTime');
  const draw = () => {
    const sc = score(sim, byId);
    const answered = Object.values(sim.resp).filter((r) => r.v).length;
    v.innerHTML = `<div class="sim-top"><div><span class="k">${sim.modo === 'completa' ? 'Prova completa' : C.esc(C.MM[sim.m]?.n || '')}${real ? ' · prova real' : ''}</span><div class="big num" id="smTime"></div></div><div class="row"><span class="muted small num">${answered} de ${sim.itens.length} respondidos</span><button class="btn primary sm" type="button" id="smEnd">Entregar</button>${real ? '' : '<button class="btn ghost sm" type="button" id="smQuit">Abandonar</button>'}</div></div>
      ${sim.falta && Object.keys(sim.falta).length ? `<p class="small" style="color:var(--warn)">O banco ainda não tem itens suficientes: faltaram ${Object.entries(sim.falta).map(([b, n]) => `${n} no Bloco ${'I'.repeat(+b)}`).join(', ')}. O simulado completo fica mais fiel conforme as aulas entram.</p>` : ''}
      <div id="smRun" style="display:grid;gap:16px">${runnerHTML(sim, byId, { instant: !real, hideFb: real, editable: real })}</div>
      ${real ? '' : scoreBar(sc)}
      <div class="row" style="margin-top:6px"><button class="btn primary" type="button" id="smEnd2">Entregar simulado</button></div>`;
    bindRunner(v.querySelector('#smRun'), sim, byId, { instant: !real, editable: real }, () => { simSet(sim); const y = window.scrollY; draw(); window.scrollTo(0, y); });
    const end = () => finishSim(v, sim, byId);
    v.querySelector('#smEnd').onclick = () => confirmEnd(v, sim, end);
    v.querySelector('#smEnd2').onclick = () => confirmEnd(v, sim, end);
    const qt = v.querySelector('#smQuit'); if (qt) qt.onclick = () => { simSet(null); renderSimulados(v); };
    upd();
  };
  const upd = () => {
    const left = sim.ini + sim.dur - Date.now();
    const el = timerEl();
    if (el) { el.textContent = (left < 0 ? '00:00' : C.fmtClockH(left)); el.style.color = left < 5 * 60000 ? 'var(--bad)' : ''; }
    if (left <= 0) { clearInterval(simTick); finishSim(v, sim, byId, true); }
  };
  clearInterval(simTick);
  simTick = setInterval(() => { if (!document.body.contains(v) || !v.classList.contains('on')) return; upd(); }, 1000);
  draw();
}

function confirmEnd(v, sim, end) {
  const pend = sim.itens.filter((id) => !sim.resp[id] || !sim.resp[id].v).length;
  if (!pend) return end();
  const box = document.createElement('div');
  box.className = 'confirm';
  box.innerHTML = `<div class="card"><h2>Entregar agora?</h2><p>${pend} ${pend === 1 ? 'item ficará' : 'itens ficarão'} em branco (0 ponto).</p><div class="row"><button class="btn primary" type="button" data-a="y">Entregar</button><button class="btn" type="button" data-a="n">Continuar respondendo</button></div></div>`;
  document.body.appendChild(box);
  box.querySelector('[data-a=y]').onclick = () => { box.remove(); end(); };
  box.querySelector('[data-a=n]').onclick = () => box.remove();
}

function finishSim(v, sim, byId, porTempo) {
  clearInterval(simTick);
  const em = C.dkey();
  sim.itens.forEach((id) => { const st = sim.resp[id]; const vv = (st && st.v) || 'B'; if (!st || !st.done || sim.real) { record(id, vv, byId[id].g, em); } sim.resp[id] = { v: vv, done: true }; });
  sim.fim = Date.now();
  const sc = score(sim, byId);
  let aprovado = null;
  if (sim.modo === 'completa') {
    const b = sc.blocos;
    aprovado = (b[1].ok - b[1].bad) >= CORTE[1] && (b[2].ok - b[2].bad) >= CORTE[2] && (b[3].ok - b[3].bad) >= CORTE[3] && sc.net >= CORTE.total;
  }
  const q = Q();
  q.sims.push({ id: sim.id, em, modo: sim.modo, m: sim.m, real: sim.real, total: sc.total, ok: sc.ok, bad: sc.bad, bl: sc.bl, net: sc.net, aprovado, min: Math.round((sim.fim - sim.ini) / 60000), blocos: Object.fromEntries([1, 2, 3].map((k) => [k, sc.blocos[k].ok - sc.blocos[k].bad])) });
  if (q.sims.length > 60) q.sims = q.sims.slice(-60);
  C.save('quest');
  simSet(sim);
  if (porTempo) C.toast('Tempo esgotado: simulado entregue.');
  C.onEvent && C.onEvent('simulado');
  resultSim(v, sim, byId);
}

function resultSim(v, sim, byId) {
  const sc = score(sim, byId);
  const comp = sim.modo === 'completa';
  const b = sc.blocos;
  const linha = (k) => { const net = b[k].ok - b[k].bad; const ok = net >= CORTE[k]; return `<div class="stat"><span class="k">Bloco ${'I'.repeat(k)} · ${b[k].n} itens</span><span class="v" style="color:${b[k].n ? (ok ? 'var(--ok)' : 'var(--bad)') : 'var(--muted)'}">${net}</span><span class="small muted">mínimo ${CORTE[k]}</span></div>`; };
  let veredito = '';
  if (comp) {
    const ap = [1, 2, 3].every((k) => b[k].ok - b[k].bad >= CORTE[k]) && sc.net >= CORTE.total;
    veredito = `<div class="card accent" style="--c:${ap ? 'var(--ok)' : 'var(--bad)'}"><h2>${ap ? 'Você passaria no corte da objetiva ✓' : 'Você seria eliminada neste simulado'}</h2><p class="muted">Corte do edital de 2025: 6, 3 e 2 pontos por bloco e 48 no total.${sc.total < 120 ? ` Este simulado teve ${sc.total} itens em vez de 120, então o resultado é só uma referência.` : ''}</p></div><div class="stats">${linha(1)}${linha(2)}${linha(3)}<div class="stat"><span class="k">Total</span><span class="v">${sc.net}</span><span class="small muted">mínimo 48</span></div></div>`;
  }
  const pct = sc.total ? Math.round(sc.net / sc.total * 100) : 0;
  v.innerHTML = `<div class="vhead"><span class="k">${comp ? 'Prova completa' : C.esc(C.MM[sim.m]?.n || '')} · ${Math.round((sim.fim - sim.ini) / 60000)} min</span><h1>Resultado do simulado</h1></div>
    ${scoreBar(sc, `<div class="grow muted small">Aproveitamento líquido: ${pct}%</div>`).replace('class="score"', 'class="score static"')}
    ${veredito}
    <div class="row"><button class="btn primary" type="button" id="smNovo">Novo simulado</button><button class="btn" type="button" data-go="erros">Caderno de erros</button></div>
    <h2>Gabarito comentado</h2><div id="smRes" style="display:grid;gap:16px">${runnerHTML(sim, byId, {})}</div>`;
  v.querySelector('#smNovo').onclick = () => { simSet(null); renderSimulados(v); };
}

export function lessonAnswered(aulaId, key, v, g) { record(`${aulaId}:${key}`, v, g); }
