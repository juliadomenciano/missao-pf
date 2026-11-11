import { getLessonText } from './lessons.js';

let C;
let jogo = null;
const cache = {};

export function initCasos(ctx) {
  C = ctx;
  C.EXT.casos = renderCasos;
}

async function getJSON(path) {
  if (cache[path]) return cache[path];
  cache[path] = JSON.parse(await getLessonText(path));
  return cache[path];
}

async function renderCasos(v) {
  if (jogo) return drawNo(v);
  v.innerHTML = '<p class="empty">Carregando casos…</p>';
  let lista = [];
  try { lista = (await getJSON('casos/index.json')).casos || []; } catch (e) {}
  const res = C.getDoc('quest').casos || {};
  v.innerHTML = `<div class="vhead"><h1>Casos investigativos</h1><p class="muted">Você é Agente de Polícia Federal. Cada decisão tem uma consequência e um fundamento legal. No fim, você vê a pontuação e a revisão das decisões.</p></div>
    ${lista.length ? `<div class="cat">${lista.map((c) => { const m = C.MM[c.materia] || { c: '#888', n: '' }; const r = res[c.id]; return `<button type="button" class="lcard" style="--c:${m.c}" data-id="${c.id}"><span class="tag">${C.esc(m.n)}</span><h3>${C.esc(c.titulo)}</h3><p class="muted small">${C.esc(c.resumo)}</p>${r ? `<span class="pill ${r.best >= 80 ? 'ok' : ''} num">Melhor: ${r.best}%</span>` : '<span class="pill">Novo</span>'}</button>`; }).join('')}</div>` : '<p class="empty">Nenhum caso disponível.</p>'}`;
  v.querySelectorAll('[data-id]').forEach((b) => b.onclick = async () => {
    const meta = lista.find((x) => x.id === b.dataset.id);
    const caso = await getJSON(meta.arquivo);
    jogo = { caso, no: caso.inicio, pts: 0, max: 0, hist: [], fb: null };
    drawNo(v);
  });
}

function drawNo(v) {
  const { caso } = jogo;
  const no = caso.nos[jogo.no];
  const m = C.MM[caso.materia] || { c: 'var(--acc)' };
  const passo = jogo.hist.length + 1;
  if (no.fim) return drawFim(v, no);
  const fb = jogo.fb;
  v.innerHTML = `<div class="row between"><button class="btn sm ghost" type="button" id="csSair">← Casos</button><span class="small muted num">Decisão ${passo} · ${jogo.pts} pts</span></div>
    <div class="card accent caso" style="--c:${m.c}"><span class="k">${C.esc(caso.titulo)}</span><p>${no.texto}</p></div>
    ${fb ? `<div class="card accent" style="--c:${fb.ok ? 'var(--ok)' : fb.pts >= 4 ? 'var(--warn)' : 'var(--bad)'}"><span class="k">${fb.ok ? 'Boa decisão' : fb.pts >= 4 ? 'Dava para fazer melhor' : 'Decisão problemática'} · +${fb.pts} pts</span><p class="small"><b>Sua escolha:</b> ${C.esc(fb.t)}</p><p>${fb.fb}</p><button class="btn primary" type="button" id="csNext" style="justify-self:start">Continuar</button></div>`
      : `<div class="list">${no.opcoes.map((o, i) => `<button type="button" class="li opc" data-i="${i}"><span class="ord">${String.fromCharCode(65 + i)}</span><span class="t">${C.esc(o.t)}</span></button>`).join('')}</div>`}`;
  v.querySelector('#csSair').onclick = () => { jogo = null; renderCasos(v); };
  v.querySelectorAll('.opc').forEach((b) => b.onclick = () => {
    const o = no.opcoes[+b.dataset.i];
    const best = Math.max(...no.opcoes.map((x) => x.pts));
    jogo.pts += o.pts; jogo.max += best;
    jogo.hist.push({ q: no.texto, t: o.t, pts: o.pts, best, fb: o.fb, ok: !!o.ok });
    jogo.fb = o;
    drawNo(v);
    window.scrollTo(0, 0);
  });
  const nx = v.querySelector('#csNext');
  if (nx) nx.onclick = () => { jogo.no = jogo.fb.prox; jogo.fb = null; drawNo(v); window.scrollTo(0, 0); };
}

function drawFim(v, no) {
  const { caso } = jogo;
  const pct = jogo.max ? Math.round(jogo.pts / jogo.max * 100) : 0;
  const q = C.getDoc('quest');
  q.casos = q.casos || {};
  const prev = q.casos[caso.id];
  if (!jogo.salvo) {
    q.casos[caso.id] = { best: Math.max(pct, prev ? prev.best : 0), ult: pct, em: C.dkey(), n: (prev ? prev.n : 0) + 1 };
    C.save('quest');
    jogo.salvo = true;
    C.onEvent('caso', caso.id);
  }
  v.innerHTML = `<div class="vhead"><span class="k">${C.esc(caso.titulo)}</span><h1>Caso encerrado</h1></div>
    <div class="card accent" style="--c:${pct >= 80 ? 'var(--ok)' : pct >= 50 ? 'var(--warn)' : 'var(--bad)'}"><h2>${jogo.pts} de ${jogo.max} pontos (${pct}%)</h2><p>${no.texto}</p><p class="small muted">${pct >= 80 ? 'Atuação de agente experiente.' : pct >= 50 ? 'Boa base, mas revise os pontos marcados abaixo.' : 'Revise os fundamentos abaixo e tente de novo.'}</p></div>
    <h2>Revisão das decisões</h2>
    <div class="list">${jogo.hist.map((h, i) => `<details class="erro"${h.ok ? '' : ' open'}><summary><span class="pill ${h.ok ? 'ok' : h.pts >= 4 ? 'warn' : 'bad'} num">${h.pts}/${h.best}</span> Decisão ${i + 1}: ${C.esc(h.t)}</summary><p class="small">${h.fb}</p></details>`).join('')}</div>
    ${caso.fontes ? `<p class="small muted">Fontes: ${C.esc(caso.fontes)}</p>` : ''}
    <div class="row"><button class="btn primary" type="button" id="csDeNovo">Jogar de novo</button><button class="btn" type="button" id="csLista">Outros casos</button></div>`;
  v.querySelector('#csDeNovo').onclick = () => { jogo = { caso, no: caso.inicio, pts: 0, max: 0, hist: [], fb: null }; drawNo(v); };
  v.querySelector('#csLista').onclick = () => { jogo = null; renderCasos(v); };
}
