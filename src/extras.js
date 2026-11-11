import { stats as qStats, loadBank } from './quest.js';

let C;

export function initExtras(ctx) {
  C = ctx;
  C.registerDoc('disc', { textos: [] });
  const prevHoje = C.EXT.hoje;
  Object.assign(C.EXT, {
    painel: renderPainel,
    conquistas: renderConquistas,
    discursiva: renderDisc,
    patente: () => { const p = patente(); return `${p.nome} · ${p.xp} XP`; },
    taf: renderTafExtra,
    hoje: () => { checkConquistas(); return (prevHoje ? prevHoje() : '') + (C.modOn('patentes') ? patenteCard() : ''); },
  });
  C.listen(() => setTimeout(checkConquistas, 50));
}

function totalMinutes() {
  let t = 0;
  const seen = new Set();
  const add = (doc) => Object.values((doc && doc.d) || {}).forEach((d) => Object.values(d).forEach((m) => { t += m; }));
  Object.keys(C.S).filter((k) => k.startsWith('log-')).forEach((k) => { seen.add(k); add(C.S[k]); });
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('mpf:log-') && !seen.has(k.slice(4))) add(JSON.parse(localStorage.getItem(k)));
    }
  } catch (e) {}
  return t;
}

const NIVEIS = [[0, 'Recruta'], [150, 'Aluno da Academia'], [500, 'Agente 3ª Classe'], [1200, 'Agente 2ª Classe'], [2500, 'Agente 1ª Classe'], [5000, 'Agente Classe Especial']];

function xpParts() {
  const q = C.getDoc('quest');
  const acertos = Object.values(q.hist || {}).reduce((a, h) => a + (h.ok || 0), 0);
  const aulas = Object.values(C.getDoc('aulas').p || {}).filter((p) => p.estudada).length;
  const rev = C.getDoc('rev');
  const revs = Object.values(rev.aulas || {}).reduce((a, s) => a + (s.k || 0), 0);
  const treinos = (C.getDoc('taf').treinos || []).length;
  const horas = totalMinutes() / 60;
  return { horas, acertos, aulas, sims: (q.sims || []).length, revs, treinos, disc: (C.getDoc('disc').textos || []).length };
}

function patente() {
  const p = xpParts();
  const xp = Math.round(p.horas * 10 + p.acertos * 2 + p.aulas * 30 + p.sims * 15 + p.revs * 5 + p.treinos * 5 + p.disc * 20);
  let i = 0;
  while (i + 1 < NIVEIS.length && xp >= NIVEIS[i + 1][0]) i++;
  const prox = NIVEIS[i + 1];
  return { xp, nome: NIVEIS[i][1], nivel: i, prox, pct: prox ? (xp - NIVEIS[i][0]) / (prox[0] - NIVEIS[i][0]) : 1, parts: p };
}

function patenteCard() {
  const p = patente();
  return `<div class="card accent" style="--c:#e2b13c"><span class="k">Sua patente</span><h2>${p.nome}</h2><div class="bar" style="--c:#e2b13c"><i style="width:${Math.round(p.pct * 100)}%"></i></div><p class="small muted num">${p.xp} XP${p.prox ? ` · faltam ${p.prox[0] - p.xp} para ${p.prox[1]}` : ' · nível máximo'}</p></div>`;
}

const CONQ = [
  ['foco1', '🎯', 'Primeiro foco', 'Registrar o primeiro estudo.', (x) => x.p.horas > 0],
  ['h10', '⏱️', '10 horas', 'Acumular 10 horas de estudo.', (x) => x.p.horas >= 10],
  ['h50', '📚', '50 horas', 'Acumular 50 horas de estudo.', (x) => x.p.horas >= 50],
  ['h100', '🏛️', '100 horas', 'Acumular 100 horas de estudo.', (x) => x.p.horas >= 100],
  ['seq7', '🔥', '7 dias seguidos', 'Estudar 7 dias sem falhar.', (x) => x.seq >= 7],
  ['seq30', '🌋', '30 dias seguidos', 'Estudar 30 dias sem falhar.', (x) => x.seq >= 30],
  ['aula1', '📖', 'Primeira aula', 'Marcar uma aula como estudada.', (x) => x.p.aulas >= 1],
  ['q100', '✅', '100 itens', 'Responder 100 itens.', (x) => x.resp >= 100],
  ['q500', '🧠', '500 itens', 'Responder 500 itens.', (x) => x.resp >= 500],
  ['sim1', '📝', 'Primeiro simulado', 'Entregar um simulado.', (x) => x.p.sims >= 1],
  ['simok', '🏅', 'Acima do corte', 'Passar no corte em uma prova completa.', (x) => x.simOk],
  ['rev5', '🔁', 'Revisor', 'Fazer 5 revisões espaçadas.', (x) => x.p.revs >= 5],
  ['taf1', '💪', 'Primeiro índice', 'Bater um índice do TAF.', (x) => x.taf >= 1],
  ['taf4', '🦅', 'TAF completo', 'Bater os 4 índices do TAF.', (x) => x.taf >= 4],
  ['disc1', '✍️', 'Primeira redação', 'Escrever uma discursiva.', (x) => x.p.disc >= 1],
  ['caso1', '🕵️', 'Primeiro caso', 'Concluir um caso investigativo.', (x) => Object.keys(C.getDoc('quest').casos || {}).length >= 1],
];

function conqCtx() {
  const p = xpParts();
  const q = C.getDoc('quest');
  const resp = Object.values(q.hist || {}).reduce((a, h) => a + (h.n || 0), 0);
  const simOk = (q.sims || []).some((s) => s.modo === 'completa' && s.aprovado && s.total >= 120);
  const taf = C.PROVAS.filter((pr) => { const b = C.bestMark(pr.id); return b != null && (pr.dir > 0 ? b >= pr.meta : b <= pr.meta); }).length;
  return { p, resp, simOk, taf, seq: C.streak() };
}

export function checkConquistas() {
  const c = C.getDoc('cfg');
  c.conq = c.conq || {};
  const x = conqCtx();
  const novas = CONQ.filter(([id, , , , f]) => !c.conq[id] && f(x));
  if (!novas.length) return;
  novas.forEach(([id]) => { c.conq[id] = C.dkey(); });
  C.save('cfg');
  if (C.modOn('conquistas')) C.toast(`Conquista: ${novas.map((n) => n[1] + ' ' + n[2]).join(', ')}`);
}

function renderConquistas(v) {
  checkConquistas();
  const c = C.getDoc('cfg').conq || {};
  const p = patente();
  const got = CONQ.filter(([id]) => c[id]).length;
  v.innerHTML = `<div class="vhead"><h1>Conquistas</h1><p class="muted">${got} de ${CONQ.length} desbloqueadas.</p></div>
    ${C.modOn('patentes') ? `<div class="card"><h2>Patente: ${p.nome}</h2><div class="bar" style="--c:#e2b13c"><i style="width:${Math.round(p.pct * 100)}%"></i></div><p class="small muted num">${p.xp} XP${p.prox ? ` · faltam ${p.prox[0] - p.xp} para ${p.prox[1]}` : ''}</p>
      <div class="patentes">${NIVEIS.map(([xp, n], i) => `<div class="pat${i <= p.nivel ? ' on' : ''}"><b>${n}</b><span class="small muted">${xp} XP</span></div>`).join('')}</div>
      <p class="small muted">XP: 10 por hora de estudo, 2 por acerto, 30 por aula estudada, 15 por simulado, 20 por discursiva e 5 por revisão ou treino.</p></div>` : ''}
    <div class="conq-grid">${CONQ.map(([id, ic, n, d]) => `<div class="conq${c[id] ? ' on' : ''}"><span class="ic">${ic}</span><b>${n}</b><span class="small muted">${d}</span>${c[id] ? `<span class="small" style="color:var(--ok)">${C.fmtDate(c[id])}</span>` : ''}</div>`).join('')}</div>`;
}

function bars(data, opts = {}) {
  const W = 320, H = opts.h || 150, P = 24, n = data.length;
  const mx = Math.max(opts.min || 1, ...data.map((d) => d.v));
  const bw = (W - P) / n;
  return `<svg viewBox="0 0 ${W} ${H + 20}" class="chart" role="img" aria-label="${C.esc(opts.label || '')}">${data.map((d, i) => { const h = d.v / mx * (H - 18); const x = P / 2 + i * bw + bw * 0.15; return `<rect x="${x.toFixed(1)}" y="${(H - h).toFixed(1)}" width="${(bw * 0.7).toFixed(1)}" height="${Math.max(1, h).toFixed(1)}" rx="3" fill="${d.c || 'var(--acc)'}"><title>${C.esc(d.l)}: ${C.esc(d.t || d.v)}</title></rect>${d.v ? `<text x="${(x + bw * 0.35).toFixed(1)}" y="${(H - h - 4).toFixed(1)}" text-anchor="middle" class="cv">${C.esc(d.t || d.v)}</text>` : ''}<text x="${(x + bw * 0.35).toFixed(1)}" y="${H + 14}" text-anchor="middle" class="cl">${C.esc(d.l)}</text>`; }).join('')}</svg>`;
}

async function renderPainel(v) {
  v.innerHTML = '<p class="empty">Carregando…</p>';
  await loadBank();
  const ws = C.weekStart();
  const semanas = [];
  for (let w = 7; w >= 0; w--) {
    let t = 0;
    for (let d = 0; d < 7; d++) t += C.minutesOn(C.dkey(C.addDays(ws, -7 * w + d)));
    semanas.push({ l: w ? C.fmtDate(C.dkey(C.addDays(ws, -7 * w))).split(' ')[0] + '/' + (C.addDays(ws, -7 * w).getMonth() + 1) : 'atual', v: Math.round(t / 6) / 10, t: (Math.round(t / 6) / 10) + 'h' });
  }
  const st = qStats();
  const porM = Object.entries(st.porM).filter(([, s]) => s.n).map(([m, s]) => ({ m, pct: Math.round(s.ok / s.n * 100), n: s.n, net: s.ok - s.bad }));
  const sims = (st.sims || []).slice(-12);
  const tx = st.n ? Math.round(st.ok / st.n * 100) : 0;
  const totalH = Math.round(totalMinutes() / 6) / 10;
  v.innerHTML = `<div class="vhead"><h1>Desempenho</h1></div>
    <div class="stats"><div class="stat"><span class="k">Horas no total</span><span class="v">${totalH}h</span></div><div class="stat"><span class="k">Itens respondidos</span><span class="v">${st.n}</span></div><div class="stat"><span class="k">Taxa de acerto</span><span class="v">${tx}%</span></div><div class="stat"><span class="k">Simulados</span><span class="v">${(st.sims || []).length}</span></div></div>
    <div class="cols">
      <div class="card"><h2>Horas por semana</h2>${bars(semanas, { label: 'Horas por semana', min: 1 })}</div>
      <div class="card"><h2>Acerto por matéria</h2>${porM.length ? `<div class="mbars">${porM.map((x) => `<div class="mbar"><span class="n"><span class="dot" style="--c:${C.MM[x.m]?.c}"></span><span>${C.esc(C.MM[x.m]?.n || x.m)}</span></span><div class="bar" style="--c:${x.pct >= 70 ? 'var(--ok)' : x.pct >= 50 ? 'var(--warn)' : 'var(--bad)'}"><i style="width:${x.pct}%"></i></div><span class="num small" style="text-align:right">${x.pct}%</span></div>`).join('')}</div><p class="small muted">Percentual de itens certos na última resposta de cada item. Acima de 70% é ótimo para a Cebraspe.</p>` : '<p class="empty">Responda alguns itens para ver este gráfico.</p>'}</div>
      <div class="card"><h2>Simulados (líquido em %)</h2>${sims.length ? bars(sims.map((s) => ({ l: C.fmtDate(s.em).split(' ')[0], v: Math.max(0, Math.round(s.net / s.total * 100)), t: Math.round(s.net / s.total * 100) + '%', c: s.aprovado === false ? 'var(--bad)' : s.net / s.total >= 0.4 ? 'var(--ok)' : 'var(--warn)' })), { label: 'Simulados', min: 50 }) + '<p class="small muted">Referência: o corte total de 48 em 120 itens equivale a 40% líquido.</p>' : '<p class="empty">Nenhum simulado entregue ainda.</p>'}</div>
      <div class="card"><h2>TAF</h2><div class="list">${C.PROVAS.map((p) => { const b = C.bestMark(p.id); const ok = b != null && (p.dir > 0 ? b >= p.meta : b <= p.meta); const pct = b == null ? 0 : Math.min(100, Math.round((p.dir > 0 ? b / p.meta : p.meta / b) * 100)); return `<div class="mbar"><span class="n"><span>${p.n}</span></span><div class="bar" style="--c:${ok ? 'var(--ok)' : 'var(--warn)'}"><i style="width:${pct}%"></i></div><span class="num small" style="text-align:right">${b == null ? '–' : C.fmtMark(p, b)}</span></div>`; }).join('')}</div></div>
    </div>`;
}

const TEMAS = [
  ['Crime organizado transnacional e fronteiras', 'O Brasil tem cerca de 17 mil km de fronteira terrestre com dez países, por onde circulam drogas, armas e contrabando.', ['características do crime organizado transnacional', 'desafios da atuação policial na faixa de fronteira', 'importância da cooperação internacional e da integração entre órgãos']],
  ['Lavagem de dinheiro e criptoativos', 'A popularização dos criptoativos criou novas formas de ocultar a origem ilícita de recursos.', ['conceito e etapas da lavagem de dinheiro', 'riscos trazidos pelos criptoativos', 'instrumentos de prevenção e investigação']],
  ['Tecnologia na investigação criminal e privacidade', 'Ferramentas de análise de dados, reconhecimento facial e extração de dados de celulares ampliaram a capacidade investigativa.', ['ganhos da tecnologia para a investigação', 'limites impostos pelos direitos fundamentais', 'necessidade de controle judicial e de proteção de dados']],
  ['Crimes cibernéticos', 'Fraudes eletrônicas, invasões e ataques a sistemas públicos cresceram nos últimos anos.', ['principais modalidades de crimes cibernéticos', 'dificuldades de investigação e de obtenção de provas', 'medidas de prevenção e cooperação com o setor privado']],
  ['Crimes ambientais na Amazônia', 'Garimpo ilegal, desmatamento e tráfico de madeira afetam terras indígenas e unidades de conservação.', ['impactos sociais e ambientais desses crimes', 'conexão com outras atividades criminosas', 'papel da Polícia Federal e da integração com outros órgãos']],
  ['Combate à corrupção e ao desvio de recursos públicos', 'Operações policiais revelaram esquemas de desvio de verbas em diversas esferas de governo.', ['efeitos da corrupção sobre o Estado e a sociedade', 'instrumentos legais de investigação', 'importância da transparência e do controle social']],
  ['Segurança pública e direitos humanos', 'O uso da força pelo Estado deve observar a legalidade, a necessidade e a proporcionalidade.', ['relação entre segurança pública e direitos humanos', 'princípios do uso legítimo da força', 'mecanismos de controle da atividade policial']],
  ['Tráfico de drogas e de armas', 'O tráfico de drogas e de armas abastece facções e alimenta a violência urbana.', ['relação entre tráfico de drogas, armas e facções', 'estratégias de descapitalização das organizações criminosas', 'integração das forças de segurança no SUSP']],
  ['Desinformação e processo eleitoral', 'A circulação de notícias falsas pode interferir na formação da vontade do eleitor.', ['impactos da desinformação na democracia', 'limites entre liberdade de expressão e ilícito', 'papel das instituições na proteção do processo eleitoral']],
  ['Migração e controle de fronteiras', 'O Brasil recebeu grandes fluxos migratórios na última década.', ['atribuições da Polícia Federal na migração', 'equilíbrio entre acolhimento humanitário e segurança', 'combate ao tráfico de pessoas e ao contrabando de migrantes']],
];

let discState = null;
let discTick = null;
const CH_LINHA = 72;

function contaLinhas(t) { return t.split('\n').reduce((a, l) => a + Math.max(1, Math.ceil(l.length / CH_LINHA)), 0); }

function promptCorrecao(tema, txt) {
  const [t, ctxTxt, asp] = tema;
  return `Corrija esta redação como um examinador da banca Cebraspe, na prova discursiva de Agente de Polícia Federal (texto dissertativo de até 30 linhas, valendo 20 pontos).

TEMA: ${t}
Contexto: ${ctxTxt}
Ao elaborar o texto, o candidato deveria abordar:
${asp.map((a, i) => `${i + 1}. ${a}`).join('\n')}

Use o modelo de correção da Cebraspe:
- Apresentação e estrutura textual (legibilidade, respeito às margens e indicação de parágrafos).
- Desenvolvimento do tema: nota de cada um dos 3 aspectos acima.
- NC = nota de conteúdo (soma dos quesitos).
- NE = número de erros de língua portuguesa (grafia, morfossintaxe e propriedade vocabular).
- TL = número de linhas efetivamente escritas.
- NPD = NC − 2 × (NE ÷ TL).

Responda com: a nota de cada quesito, NC, a lista dos erros com a correção, NE, TL, a NPD final e 3 sugestões objetivas para melhorar.

TEXTO (${contaLinhas(txt)} linhas, aproximadamente):
${txt}`;
}

function renderDisc(v) {
  clearInterval(discTick);
  const D = C.getDoc('disc');
  if (!discState) {
    v.innerHTML = `<div class="vhead"><h1>Discursiva</h1><p class="muted">Texto dissertativo de até 30 linhas, valendo 20 pontos. Escolha um tema, escreva com tempo marcado e depois copie para o Claude corrigir no modelo da Cebraspe.</p></div>
      <div class="card"><h2>Escolha um tema</h2><div class="list">${TEMAS.map((t, i) => `<button type="button" class="li tema" data-i="${i}"><span class="t"><b>${C.esc(t[0])}</b><br><span class="small muted">${C.esc(t[1])}</span></span>${D.textos.some((x) => x.tema === i) ? '<span class="pill ok">feito</span>' : ''}</button>`).join('')}</div></div>
      ${D.textos.length ? `<div class="card"><h2>Suas redações</h2><div class="list">${[...D.textos].reverse().map((x) => `<div class="li"><span class="t"><b>${C.esc(TEMAS[x.tema]?.[0] || '')}</b><br><span class="small muted">${C.fmtDate(x.em)} · ${x.linhas} linhas · ${x.min} min</span></span><label class="small" style="display:flex;gap:6px;align-items:center">Nota<input type="number" step="0.01" min="0" max="20" value="${x.nota ?? ''}" data-nota="${x.id}" style="width:76px"></label><button class="btn sm" type="button" data-copy="${x.id}">Copiar</button><button class="x" type="button" data-del="${x.id}" aria-label="Apagar">×</button></div>`).join('')}</div><p class="small muted">Anote aqui a nota (NPD) que o Claude der na correção.</p></div>` : ''}`;
    v.querySelectorAll('.tema').forEach((b) => b.onclick = () => { discState = { tema: +b.dataset.i, txt: C.local.get('discDraft:' + b.dataset.i) || '', ini: null, dur: 60 }; renderDisc(v); });
    v.querySelectorAll('[data-nota]').forEach((i) => i.onchange = () => { const x = D.textos.find((t) => t.id === i.dataset.nota); if (x) { x.nota = i.value === '' ? null : +i.value; C.save('disc'); } });
    v.querySelectorAll('[data-copy]').forEach((b) => b.onclick = () => { const x = D.textos.find((t) => t.id === b.dataset.copy); copy(promptCorrecao(TEMAS[x.tema], x.txt), v); });
    v.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => { D.textos = D.textos.filter((t) => t.id !== b.dataset.del); C.save('disc'); renderDisc(v); });
    return;
  }
  const s = discState;
  const tema = TEMAS[s.tema];
  v.innerHTML = `<div class="row between"><button class="btn sm ghost" type="button" id="dBack">← Temas</button><div class="row"><select id="dDur" aria-label="Tempo">${[30, 45, 60, 90].map((m) => `<option value="${m}" ${m === s.dur ? 'selected' : ''}>${m} min</option>`).join('')}</select><button class="btn sm" type="button" id="dTimer">${s.ini ? 'Reiniciar tempo' : 'Iniciar tempo'}</button><span class="big num" id="dClock" style="font-size:22px"></span></div></div>
    <div class="card accent" style="--c:var(--lib)"><span class="k">Tema</span><h2>${C.esc(tema[0])}</h2><p class="small">${C.esc(tema[1])}</p><p class="small"><b>Ao elaborar seu texto, aborde os seguintes aspectos:</b></p><ol class="small" style="margin:0;padding-left:20px">${tema[2].map((a) => `<li>${C.esc(a)};</li>`).join('')}</ol></div>
    <div class="folha"><textarea id="dTxt" spellcheck="true" placeholder="Escreva seu texto aqui. Separe os parágrafos com uma linha.">${C.esc(s.txt)}</textarea></div>
    <div class="row between"><span class="small num" id="dLin"></span><div class="row"><button class="btn" type="button" id="dSave">Salvar</button><button class="btn primary" type="button" id="dCopy">Salvar e copiar para o Claude</button></div></div>
    <p class="small muted">A contagem de linhas é aproximada (${CH_LINHA} caracteres por linha da folha). Depois de copiar, cole em uma conversa com o Claude para receber a correção.</p>`;
  const ta = v.querySelector('#dTxt');
  const lin = () => { const n = contaLinhas(ta.value); const el = v.querySelector('#dLin'); el.textContent = `${ta.value.trim() ? n : 0} de 30 linhas`; el.style.color = n > 30 ? 'var(--bad)' : n >= 20 ? 'var(--ok)' : ''; };
  ta.oninput = () => { s.txt = ta.value; C.local.set('discDraft:' + s.tema, s.txt); lin(); };
  lin();
  const clock = () => { const el = v.querySelector('#dClock'); if (!el) return; if (!s.ini) { el.textContent = s.dur + ':00'; return; } const left = s.ini + s.dur * 60000 - Date.now(); el.textContent = left > 0 ? C.fmtClockH(left) : 'tempo esgotado'; el.style.color = left < 5 * 60000 ? 'var(--bad)' : ''; if (left <= 0 && !s.avisou) { s.avisou = true; C.beep(); } };
  discTick = setInterval(clock, 1000); clock();
  v.querySelector('#dDur').onchange = (e) => { s.dur = +e.target.value; clock(); };
  v.querySelector('#dTimer').onclick = () => { C.unlockAudio(); s.ini = Date.now(); s.avisou = false; v.querySelector('#dTimer').textContent = 'Reiniciar tempo'; clock(); };
  v.querySelector('#dBack').onclick = () => { discState = null; renderDisc(v); };
  const salvar = () => {
    if (!ta.value.trim()) { C.toast('Escreva o texto antes de salvar.'); return null; }
    const D2 = C.getDoc('disc');
    const min = s.ini ? Math.round((Date.now() - s.ini) / 60000) : 0;
    let x = s.id && D2.textos.find((t) => t.id === s.id);
    if (!x) { x = { id: C.uid(), tema: s.tema, nota: null }; D2.textos.push(x); s.id = x.id; }
    Object.assign(x, { txt: ta.value, em: C.dkey(), linhas: contaLinhas(ta.value), min });
    if (D2.textos.length > 40) D2.textos = D2.textos.slice(-40);
    C.save('disc'); C.onEvent('discursiva');
    return x;
  };
  v.querySelector('#dSave').onclick = () => { if (salvar()) C.toast('Redação salva.'); };
  v.querySelector('#dCopy').onclick = () => { const x = salvar(); if (x) copy(promptCorrecao(tema, x.txt), v); };
}

async function copy(txt, v) {
  try { await navigator.clipboard.writeText(txt); C.toast('Copiado! Cole numa conversa com o Claude.'); }
  catch (e) {
    const box = document.createElement('div'); box.className = 'confirm';
    box.innerHTML = `<div class="card"><h2>Copie o texto abaixo</h2><textarea rows="10" readonly>${C.esc(txt)}</textarea><button class="btn primary" type="button">Fechar</button></div>`;
    document.body.appendChild(box); const t = box.querySelector('textarea'); t.focus(); t.select();
    box.querySelector('button').onclick = () => box.remove();
  }
}

const PLANO = {
  corr: (r) => r < 0.8 ? [['Corrida contínua leve', '25 a 30 min em ritmo de conversa.'], ['Intervalado', '6 × 200 m forte, 1 min e 30 s de trote entre os tiros.'], ['Longão leve', '35 a 40 min bem leve.']]
    : r < 1 ? [['Intervalado no ritmo da prova', '5 × 400 m em 2 min e 40 s (o ritmo dos 1.800 m em 12 min), com 1 min e 30 s de trote.'], ['Fartlek', '30 min alternando 2 min forte e 2 min leve.'], ['Contínuo moderado', '35 min firme.']]
      : [['Manutenção', '4 × 600 m no ritmo da prova, com 2 min de trote.'], ['Contínuo leve', '30 min.'], ['Teste de 12 min', 'A cada 2 semanas, para acompanhar.']],
  barra: (r) => r < 0.5 ? [['Isometria assistida', '5 séries no máximo de tempo, com um pé apoiado ou elástico. 2 min de pausa.'], ['Negativas', '4 × 4 descidas lentas (5 s) a partir do queixo acima da barra.'], ['Remada invertida', '3 × 10 a 12.']]
    : r < 1 ? [['Isometria na barra', '5 séries no máximo de tempo, sem apoio. 2 min de pausa.'], ['Isometria com pausa curta', '6 × 8 s com 20 s de pausa.'], ['Puxada ou remada', '3 × 8 a 10 com carga.']]
      : [['Manutenção', '3 séries no máximo de tempo, com 2 min de pausa.'], ['Força de costas', '3 × 8 de remada ou puxada.']],
  imp: (r) => r < 1 ? [['Técnica de salto', '10 saltos máximos com 1 min de pausa, focando no balanço dos braços e na aterrissagem.'], ['Agachamento com salto', '4 × 6 explosivos.'], ['Saltos horizontais em sequência', '4 × 5 saltos seguidos.']]
    : [['Manutenção', '6 saltos máximos e 3 × 5 agachamentos com salto.']],
  nat: (r) => r < 0.85 ? [['Técnica de crawl', '10 × 25 m focando na respiração e na pernada, com 30 s de pausa.'], ['Resistência', '8 × 50 m leves, com 30 s de pausa.']]
    : r < 1 ? [['Velocidade', '8 × 25 m forte, com 45 s de pausa.'], ['Ritmo de prova', '4 × 50 m perto do tempo alvo (1 min e 4 s), com 2 min de pausa.']]
      : [['Manutenção', '4 × 50 m no ritmo de prova e saída e virada.']],
};

let crono = null;

function renderTafExtra() {
  let el = document.getElementById('tafExtra');
  if (!el) return;
  const l = (C.getDoc('cfg').lemb || {}).taf;
  const dias = (l && l.dias && l.dias.length ? l.dias : [1, 3, 5]);
  const DN = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const ratio = (p) => { const b = C.bestMark(p.id); if (b == null) return 0; return p.dir > 0 ? b / p.meta : p.meta / b; };
  const r = Object.fromEntries(C.PROVAS.map((p) => [p.id, ratio(p)]));
  const sessoes = [
    { n: 'Corrida', prova: 'corr', itens: PLANO.corr(r.corr).slice(0, 2) },
    { n: 'Barra e impulsão', prova: 'barra', itens: [...PLANO.barra(r.barra).slice(0, 2), ...PLANO.imp(r.imp).slice(0, 1)] },
    { n: 'Natação', prova: 'nat', itens: PLANO.nat(r.nat) },
    { n: 'Corrida e força', prova: 'corr', itens: [PLANO.corr(r.corr)[2] || PLANO.corr(r.corr)[0], ...PLANO.barra(r.barra).slice(2), ...PLANO.imp(r.imp).slice(1, 2)] },
  ];
  const plano = sessoes.slice(0, Math.max(3, Math.min(4, dias.length))).map((s, i) => ({ ...s, dia: dias[i % dias.length] }));
  el.innerHTML = `<div class="card"><div class="row between"><h2>Cronômetro de teste</h2>${crono ? '' : ''}</div><div class="seg" id="crSel">${[['barra', 'Barra'], ['nat', 'Natação 50 m'], ['corr', 'Corrida 12 min']].map(([k, n]) => `<button type="button" data-k="${k}" aria-pressed="${crono && crono.k === k}">${n}</button>`).join('')}</div><div id="crBox"></div></div>
    <div class="card"><h2>Plano de treino</h2><p class="small muted">A semana de treino (corrida do zero até 1.800 m, força A e B e natação) fica em Treino físico. As marcas dos treinos de barra, salto e natação entram aqui sozinhas.</p><button class="btn primary" type="button" data-go="treino" style="justify-self:start">Abrir Treino físico</button></div></div>`;
  el.querySelectorAll('#crSel button').forEach((b) => b.onclick = () => { crono = { k: b.dataset.k, ini: null, fim: null }; renderTafExtra(); });
  drawCrono();
}

let cronoTick = null;
function drawCrono() {
  clearInterval(cronoTick);
  const box = document.getElementById('crBox');
  if (!box || !crono) { if (box) box.innerHTML = '<p class="small muted">Escolha a prova para cronometrar o teste. O resultado já vai para as suas marcas.</p>'; return; }
  const k = crono.k;
  const regressivo = k === 'corr';
  const total = 12 * 60000;
  const tempo = () => { if (!crono.ini) return regressivo ? total : 0; const t = (crono.fim || Date.now()) - crono.ini; return regressivo ? Math.max(0, total - t) : t; };
  const fmt = (ms) => { const s = ms / 1000; return regressivo ? C.fmtClock(ms) : `${Math.floor(s / 60)}:${C.pad(Math.floor(s % 60))}.${Math.floor((ms % 1000) / 100)}`; };
  const fimCorrida = regressivo && crono.ini && tempo() <= 0;
  box.innerHTML = `<div class="crono"><div class="crono-t num" id="crT">${fmt(tempo())}</div>
    ${!crono.ini ? `<button class="btn primary" type="button" id="crGo">${regressivo ? 'Iniciar 12 min' : 'Iniciar'}</button>`
      : (!crono.fim && !fimCorrida) ? `<button class="btn primary" type="button" id="crStop" style="background:var(--bad);border-color:var(--bad)">Parar</button>`
        : regressivo ? `<label class="f">Distância percorrida (metros)<input type="number" id="crDist" min="200" max="4000" inputmode="numeric"></label><div class="row"><button class="btn primary" type="button" id="crSave">Salvar marca</button><button class="btn ghost" type="button" id="crReset">Descartar</button></div>`
          : `<div class="row"><button class="btn primary" type="button" id="crSave">Salvar ${fmt(tempo())}</button><button class="btn ghost" type="button" id="crReset">Descartar</button></div>`}</div>
    <p class="small muted">${k === 'barra' ? 'Inicie quando o queixo passar da barra e pare quando ele descer. Índice: 15 s.' : k === 'nat' ? 'Inicie na saída e pare no toque final. Índice: 1 min e 4 s.' : 'Corra durante 12 min. No fim, o app apita e você informa a distância. Índice: 1.800 m.'}</p>`;
  const go = box.querySelector('#crGo'); if (go) go.onclick = async () => { C.unlockAudio(); crono.ini = Date.now(); try { crono.lock = await navigator.wakeLock?.request('screen'); } catch (e) {} drawCrono(); };
  const stop = box.querySelector('#crStop'); if (stop) stop.onclick = () => { crono.fim = Date.now(); try { crono.lock?.release(); } catch (e) {} drawCrono(); };
  const reset = box.querySelector('#crReset'); if (reset) reset.onclick = () => { crono = { k, ini: null, fim: null }; drawCrono(); };
  const save = box.querySelector('#crSave'); if (save) save.onclick = () => {
    let v;
    if (regressivo) { v = +box.querySelector('#crDist').value; if (!(v > 0)) { C.toast('Informe a distância.'); return; } }
    else v = Math.round(tempo() / 100) / 10;
    C.addMarca(k, v);
    const p = C.PM[k]; const ok = p.dir > 0 ? v >= p.meta : v <= p.meta;
    C.toast(ok ? `${p.n}: índice atingido! 💪` : `${p.n}: ${C.fmtMark(p, v)} salvo.`);
    crono = null; C.onEvent('taf');
  };
  if (crono.ini && !crono.fim && !fimCorrida) {
    cronoTick = setInterval(() => {
      const el = document.getElementById('crT'); if (!el) { clearInterval(cronoTick); return; }
      el.textContent = fmt(tempo());
      if (regressivo && tempo() <= 0) { C.beep(); try { crono.lock?.release(); } catch (e) {} drawCrono(); }
    }, 100);
  }
}
