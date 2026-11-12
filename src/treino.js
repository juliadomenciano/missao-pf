import { scheduleSeries, cancelSeries, askPermission } from './native.js';

let C;
const DN = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DNL = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

const TIPOS = {
  corrida: { n: 'Corrida', c: '#ff7f6e' },
  forcaA: { n: 'Força A', c: '#6aa7ff' },
  forcaB: { n: 'Força B', c: '#f2b84b' },
  natacao: { n: 'Natação', c: '#2fc4c4' },
  beach: { n: 'Beach tennis / cardio livre', c: '#c4e36b' },
  livre: { n: 'Livre', c: '#8f98ab' },
};

const DEF_DIAS = { 0: 'livre', 1: 'corrida', 2: 'forcaA', 3: 'corrida', 4: 'forcaB', 5: 'corrida', 6: 'natacao' };

const m = (x) => x * 60;
const iv = (n, corre, anda) => ({ n, a: { t: 'corre', s: corre }, b: { t: 'anda', s: anda } });
const tiro = (n, alvo, rec, dist) => ({ n, a: { t: 'tiro', s: alvo, dist }, b: { t: 'trote', s: rec } });
const cont = (s) => ({ n: 1, a: { t: 'corre', s } });

const PROGRAMA = [
  [{ b: [iv(8, 60, 120)] }, { b: [iv(8, 60, 120)] }, { b: [iv(6, 90, 120)] }],
  [{ b: [iv(8, 90, 120)] }, { b: [iv(8, 90, 120)] }, { b: [iv(6, 120, 120)] }],
  [{ b: [iv(6, 120, 90)] }, { b: [iv(6, 120, 90)] }, { b: [iv(5, 180, 90)] }],
  [{ b: [iv(5, 180, 60)] }, { b: [iv(5, 180, 60)] }, { b: [iv(4, 240, 60)] }],
  [{ b: [iv(4, 300, 60)] }, { b: [iv(4, 300, 60)] }, { b: [iv(3, 420, 90)] }],
  [{ b: [iv(3, 480, 60)] }, { b: [iv(3, 480, 60)] }, { b: [iv(2, 720, 120)] }],
  [{ b: [cont(m(15))] }, { b: [cont(m(15))] }, { b: [cont(m(20))] }],
  [{ b: [cont(m(5)), tiro(6, 75, 120, 200)] }, { b: [cont(m(20))] }, { b: [cont(m(25))] }],
  [{ b: [cont(m(5)), tiro(5, 170, 120, 400)] }, { b: [cont(m(20))] }, { b: [cont(m(28))] }],
  [{ b: [cont(m(5)), tiro(5, 160, 90, 400)] }, { b: [cont(m(22))] }, { b: [cont(m(30))] }],
  [{ b: [cont(m(5)), tiro(3, 320, 120, 800)] }, { b: [cont(m(25))] }, { b: [cont(m(5))], teste: true }],
  [{ b: [cont(m(5)), tiro(4, 155, 90, 400)] }, { b: [cont(m(20))] }, { b: [cont(m(5))], teste: true }],
];
const RITMO_LEVE = 'leve, no ritmo de conversa (para você, hoje, entre 8:00 e 8:30 por km)';

function phases(sess) {
  const ph = [{ t: 'aquec', s: 300 }];
  sess.b.forEach((bl, bi) => {
    for (let i = 0; i < bl.n; i++) {
      ph.push({ ...bl.a, rep: bl.n > 1 ? `${i + 1}/${bl.n}` : '' });
      const ultimo = bi === sess.b.length - 1 && i === bl.n - 1;
      if (bl.b && !ultimo) ph.push({ ...bl.b });
    }
  });
  if (sess.teste) ph.push({ t: 'teste', s: 720 });
  ph.push({ t: 'desaq', s: 300 });
  return ph;
}

const PH = {
  aquec: ['Aquecimento', 'Caminhada rápida', '#8f98ab'],
  corre: ['Corra', RITMO_LEVE, '#ff7f6e'],
  anda: ['Caminhe', 'Recupere o fôlego', '#5fd38d'],
  tiro: ['Tiro', 'Forte, mas controlado', '#ff4d6d'],
  trote: ['Trote', 'Bem leve ou caminhando', '#5fd38d'],
  teste: ['Teste de 12 min', 'Ritmo de prova: 6:40 por km. Distribua o esforço!', '#e2b13c'],
  desaq: ['Volta à calma', 'Caminhe e alongue depois', '#8f98ab'],
};

function descSess(sess) {
  const parts = sess.b.map((bl) => {
    if (bl.a.t === 'tiro') return `${bl.n} × ${bl.a.dist} m em ${C.fmtClock(bl.a.s * 1000)} (${pace(bl.a.s, bl.a.dist / 1000)}/km), com ${fmtS(bl.b.s)} de trote`;
    if (!bl.b) return `${fmtS(bl.a.s)} contínuos e leves`;
    return `${bl.n} × (${fmtS(bl.a.s)} correndo + ${fmtS(bl.b.s)} caminhando)`;
  });
  if (sess.teste) parts.push('teste de 12 min no ritmo de prova');
  const tot = phases(sess).reduce((a, p) => a + p.s, 0);
  return { txt: parts.join(' + '), min: Math.round(tot / 60) };
}

function fmtS(s) { const mm = Math.floor(s / 60), ss = s % 60; return mm ? `${mm} min${ss ? ` ${ss} s` : ''}` : `${ss} s`; }
function pace(seg, km) { if (!km) return '–'; const p = seg / km; return `${Math.floor(p / 60)}:${C.pad(Math.round(p % 60))}`; }
function est12(km, seg) { if (!km || !seg) return null; return Math.round(km * 1000 * Math.pow(720 / seg, 1 / 1.06)); }
function parseTempo(s) { s = String(s).trim(); if (!s) return 0; const p = s.split(':').map(Number); if (p.some(isNaN)) return 0; return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0] * 60; }

const FICHAS = {
  forcaA: {
    nome: 'Força A: costas, braços e barra',
    ex: [
      { id: 'iso', n: 'Isometria na barra', series: 5, alvo: 'máx. (s)', unid: 's', acad: 'Queixo acima da barra, braços flexionados. 2 min de descanso.', casa: 'Barra de porta. Sem barra: remada invertida isométrica na mesa.', desc: 120 },
      { id: 'puxada', n: 'Puxada frente', series: 3, alvo: '8–12', acad: 'Na polia, pegada aberta, levando a barra até o peito.', casa: 'Puxada com elástico preso no alto da porta.', desc: 90 },
      { id: 'remada', n: 'Remada', series: 3, alvo: '8–12', acad: 'Remada curvada ou baixa com halter ou na máquina.', casa: 'Remada invertida embaixo de uma mesa firme, ou com mochila.', desc: 90 },
      { id: 'flexao', n: 'Flexão de braço', series: 3, alvo: '6–12', acad: 'No chão. Se precisar, apoie os joelhos.', casa: 'No chão. Se precisar, apoie os joelhos ou as mãos num banco.', desc: 75 },
      { id: 'ombro', n: 'Desenvolvimento de ombro', series: 3, alvo: '8–12', acad: 'Com halteres, sentada.', casa: 'Com garrafas ou mochila, ou pike push-up.', desc: 75 },
      { id: 'rosca', n: 'Rosca bíceps', series: 3, alvo: '10–12', acad: 'Com halteres. O bíceps ajuda a segurar os braços flexionados na barra.', casa: 'Com elástico ou mochila.', desc: 60 },
      { id: 'prancha', n: 'Prancha', series: 3, alvo: '30–45 s', unid: 's', acad: 'Corpo alinhado e abdômen firme.', casa: 'Igual.', desc: 45 },
    ],
  },
  forcaB: {
    nome: 'Força B: pernas, impulsão e abdômen',
    ex: [
      { id: 'salto', n: 'Saltos horizontais (técnica)', series: 6, alvo: 'máx. (cm)', unid: 'cm', acad: 'Salto parado, balançando os braços e aterrissando estável. 1 min de descanso.', casa: 'Igual, em piso que não escorregue.', desc: 60 },
      { id: 'agach', n: 'Agachamento', series: 4, alvo: '8–10', acad: 'Agachamento livre ou goblet com halter.', casa: 'Com mochila pesada no peito.', desc: 90 },
      { id: 'terra', n: 'Levantamento terra romeno', series: 3, alvo: '8–10', acad: 'Com halteres ou barra, coluna neutra.', casa: 'Unilateral, com mochila.', desc: 90 },
      { id: 'afundo', n: 'Afundo', series: 3, alvo: '10 cada perna', acad: 'Com halteres.', casa: 'Peso do corpo ou mochila.', desc: 60 },
      { id: 'agsalto', n: 'Agachamento com salto', series: 3, alvo: '6', acad: 'Explosivo, aterrissando suave.', casa: 'Igual.', desc: 60 },
      { id: 'pant', n: 'Panturrilha', series: 3, alvo: '15', acad: 'Em pé, na máquina ou num degrau.', casa: 'Num degrau, uma perna de cada vez.', desc: 45 },
      { id: 'core', n: 'Prancha lateral', series: 3, alvo: '30 s cada lado', unid: 's', acad: 'Quadril alto.', casa: 'Igual.', desc: 30 },
      { id: 'iso2', n: 'Isometria na barra (curta)', series: 3, alvo: 'máx. (s)', unid: 's', acad: 'Para treinar a barra 2 vezes por semana.', casa: 'Barra de porta.', desc: 120 },
    ],
  },
};

const EXTRA = {
  agachP: { id: 'agachP', n: 'Agachamento parcial', series: 3, alvo: '10', acad: 'No leg press com amplitude curta ou agachamento até onde não doer, com carga leve.', casa: 'Sentar e levantar de uma cadeira alta, sem peso.', desc: 75 },
  ponte: { id: 'ponte', n: 'Elevação pélvica', series: 3, alvo: '12', acad: 'Na máquina, ou no chão com a carga apoiada no quadril se não incomodar o ombro.', casa: 'Ponte de glúteo no chão, sem peso.', desc: 60 },
  flexora: { id: 'flexora', n: 'Flexão de joelhos (posterior)', series: 3, alvo: '10–12', acad: 'Mesa ou cadeira flexora, com carga moderada.', casa: 'Ponte unilateral ou flexão de joelhos com elástico.', desc: 60 },
  abd: { id: 'abd', n: 'Abdução de quadril', series: 3, alvo: '15', acad: 'Na máquina abdutora.', casa: 'Deitada de lado, com ou sem elástico.', desc: 45 },
  pernas: { id: 'pernas', n: 'Elevação de pernas deitada', series: 3, alvo: '10', acad: 'Braços ao lado do corpo, lombar apoiada no chão.', casa: 'Igual.', desc: 45 },
  deadbug: { id: 'deadbug', n: 'Dead bug só com as pernas', series: 3, alvo: '10 cada lado', acad: 'Braços apoiados no chão ao lado do corpo, alternando as pernas devagar.', casa: 'Igual.', desc: 45 },
};
const SUP = ['iso', 'puxada', 'remada', 'flexao', 'ombro', 'rosca', 'prancha', 'core', 'iso2', 'terra'];
const JOELHO = ['salto', 'agsalto', 'afundo'];

function fichaAtiva(tipo) {
  const r = (T().restr || {});
  if (tipo === 'forcaA' && r.sup) return { nome: 'Força A adaptada: glúteo, posterior e abdômen (sem braços)', ex: [EXTRA.ponte, EXTRA.flexora, EXTRA.abd, FICHAS.forcaB.ex.find((e) => e.id === 'pant'), EXTRA.pernas, EXTRA.deadbug], adapt: true };
  const base = FICHAS[tipo];
  if (!r.sup && !r.joelho) return base;
  let ex = base.ex.filter((e) => !(r.sup && SUP.includes(e.id)) && !(r.joelho && JOELHO.includes(e.id)));
  if (r.joelho) ex = ex.map((e) => (e.id === 'agach' ? EXTRA.agachP : e));
  [EXTRA.ponte, EXTRA.abd, EXTRA.flexora, EXTRA.deadbug].forEach((e) => { if (ex.length < 6 && !ex.some((x) => x.id === e.id)) ex.push(e); });
  return { nome: base.nome + ' (adaptada)', ex, adapt: true };
}

const NATACAO = [
  ['Aquecimento', '300 m soltos, misturando crawl e costas.'],
  ['Técnica', '4 × 50 m de educativos (pernada com prancha, braçada com pull buoy, respiração bilateral), com 20 s de pausa.'],
  ['Bloco aeróbico', '10 × 100 m confortáveis, com 20 s de pausa. Quando ficar fácil, passe para 6 × 200 m ou 1.200 m contínuos. É aqui que a natação ajuda a resistência da corrida.'],
  ['Ritmo da prova', '4 × 50 m em cerca de 55 a 60 s (o índice é 64 s), com 1 min e 30 s de pausa. Treine a saída e a chegada.'],
  ['Solto', '200 m bem leves.'],
];

export function initTreino(ctx) {
  C = ctx;
  C.registerDoc('treino', { dias: { ...DEF_DIAS }, local: 'academia', corrida: { semana: 1, feitas: {} }, runs: [], forca: [], nat: [] });
  C.EXT.treino = renderTreino;
  const prev = C.EXT.hoje;
  C.EXT.hoje = () => (prev ? prev() : '') + hojeCard();
}

const T = () => { const t = C.getDoc('treino'); t.restr = t.restr || { sup: false, joelho: false }; t.dias = t.dias || { ...DEF_DIAS }; t.corrida = t.corrida || { semana: 1, feitas: {} }; t.runs = t.runs || []; t.forca = t.forca || []; t.nat = t.nat || []; return t; };

function corridaIdx(dow) {
  const dias = T().dias;
  const runs = [1, 2, 3, 4, 5, 6, 0].filter((d) => dias[d] === 'corrida');
  return Math.min(2, Math.max(0, runs.indexOf(dow)));
}

function feitoEm(dk) {
  const t = T();
  return { run: t.runs.some((r) => r.d === dk), forca: t.forca.find((f) => f.d === dk), nat: t.nat.some((n) => n.d === dk) };
}

function hojeCard() {
  const dow = new Date().getDay();
  const tipo = T().dias[dow];
  const tp = TIPOS[tipo];
  if (!tp || tipo === 'livre') return '';
  const f = feitoEm(C.dkey());
  const done = (tipo === 'corrida' && f.run) || (tipo.startsWith('forca') && f.forca) || (tipo === 'natacao' && f.nat);
  return `<div class="card accent" style="--c:${tp.c}"><span class="k">Treino de hoje</span><h2>${tp.n}${done ? ' ✓' : ''}</h2><div class="row"><button class="btn sm" type="button" data-go="treino">${done ? 'Ver semana' : 'Abrir treino'}</button></div></div>`;
}

let modo = null;

function renderTreino(v) {
  if (modo && modo.tipo === 'guia') return drawGuia(v);
  if (modo && modo.tipo === 'forca') return drawForca(v);
  if (modo && modo.tipo === 'fim') return drawFimCorrida(v);
  const t = T();
  const ws = C.weekStart();
  const hoje = C.dkey();
  const sem = t.corrida.semana;
  const prog = PROGRAMA[Math.min(sem, PROGRAMA.length) - 1];
  const feitasSem = (t.corrida.feitas[sem] || []).length;
  const dias = [1, 2, 3, 4, 5, 6, 0].map((dow, i) => {
    const dk = C.dkey(C.addDays(ws, i));
    const tipo = t.dias[dow] || 'livre';
    const f = feitoEm(dk);
    const done = (tipo === 'corrida' && f.run) || (tipo.startsWith('forca') && f.forca) || (tipo === 'natacao' && f.nat) || (tipo === 'beach' && (C.getDoc('taf').treinos || []).some((x) => x.d === dk));
    let det = '';
    if (tipo === 'corrida') { const s = prog[corridaIdx(dow)]; const d = descSess(s); det = `Corrida ${'ABC'[corridaIdx(dow)]} · ~${d.min} min<br><span class="small muted">${d.txt}</span>`; }
    else if (tipo.startsWith('forca')) det = `${fichaAtiva(tipo).nome} · ~45 min`;
    else if (tipo === 'natacao') det = 'Natação · 60–75 min';
    else det = TIPOS[tipo].n;
    return { dow, dk, tipo, done, det, hoje: dk === hoje, passado: dk < hoje };
  });
  const runs = [...t.runs].sort((a, b) => (a.d < b.d ? 1 : -1));
  const comDist = runs.filter((r) => r.km > 0 && r.seg > 0);
  const melhorEst = comDist.reduce((a, r) => Math.max(a, est12(r.km, r.seg) || 0), 0);
  v.innerHTML = `<div class="vhead"><h1>Treino físico</h1><p class="muted">Semana pensada para chegar aos índices do TAF e melhorar o condicionamento geral. Domingo é livre.</p></div>
    <div class="card"><div class="row between"><h2>Esta semana</h2><div class="seg" id="trLocal"><button type="button" data-l="academia" aria-pressed="${t.local === 'academia'}">Academia</button><button type="button" data-l="casa" aria-pressed="${t.local === 'casa'}">Casa</button></div></div>
      <div class="list">${dias.map((d) => `<div class="li tday${d.hoje ? ' hoje' : ''}" style="border-left:4px solid ${TIPOS[d.tipo].c}"><span class="dname">${DN[d.dow]}</span><span class="t">${d.det}</span>${d.done ? '<span class="pill ok">✓</span>' : d.tipo === 'livre' ? '' : `<button class="btn sm${d.hoje ? ' primary' : ''}" type="button" data-start="${d.dow}">${d.hoje ? 'Começar' : 'Fazer'}</button>`}</div>`).join('')}</div>
      <button class="btn sm ghost" type="button" id="trDias" style="justify-self:start">Ajustar dias</button><div id="trDiasBox" hidden></div></div>
    <div class="card"><h2>Ajustes temporários</h2><p class="small muted">Para respeitar uma lesão ou uma orientação médica. Os treinos se adaptam sozinhos, e você desliga quando estiver liberada.</p>
      <label class="toggle"><span class="t">Pausar membros superiores<small>A Força A vira um treino de glúteo, posterior e abdômen sem apoio de braços. Saem a barra, a prancha e os exercícios segurando peso.</small></span><input class="sw" type="checkbox" id="rSup" ${t.restr.sup ? 'checked' : ''}></label>
      <label class="toggle"><span class="t">Poupar joelhos<small>Saem os saltos, o agachamento com salto e o afundo. O agachamento vira parcial, e entram exercícios de quadril.</small></span><input class="sw" type="checkbox" id="rJoe" ${t.restr.joelho ? 'checked' : ''}></label>
      ${t.restr.sup ? '<p class="small" style="color:var(--warn)">O nado crawl usa bastante o ombro. Confirme com o médico ou a fisioterapeuta se a natação está liberada durante a fisioterapia.</p>' : ''}
      ${t.restr.joelho ? '<p class="small muted">Na corrida, se o joelho doer (dor, não cansaço), troque o trecho por caminhada e registre como "muito difícil" para repetir a semana.</p>' : ''}</div>
    <div class="cols">
      <div class="card"><div class="row between"><h2>Programa de corrida</h2><span class="pill num">Semana ${sem} de ${PROGRAMA.length}</span></div>
        <div class="bar" style="--c:#ff7f6e"><i style="width:${Math.round(((sem - 1) * 3 + Math.min(3, feitasSem)) / (PROGRAMA.length * 3) * 100)}%"></i></div>
        <p class="small muted">${feitasSem} de 3 corridas desta semana feitas. Para avançar, complete as 3. Se a semana ficou pesada, repita: é normal.</p>
        <div class="row"><button class="btn sm" type="button" id="trAvanca" ${feitasSem >= 3 ? '' : 'disabled'}>Avançar para a semana ${Math.min(sem + 1, PROGRAMA.length)}</button><button class="btn sm ghost" type="button" id="trRepete">Repetir semana</button>${sem > 1 ? '<button class="btn sm ghost" type="button" id="trVolta">Voltar uma semana</button>' : ''}</div>
        <p class="small muted">Meta: 1.800 m em 12 min, o que dá 6:40 por km. Corra leve na maior parte do tempo, porque é isso que constrói a resistência.</p></div>
      <div class="card"><h2>Registrar corrida</h2><form class="form" id="runForm"><label class="f">Distância (km)<input type="text" inputmode="decimal" id="rKm" placeholder="1,0"></label><label class="f">Tempo (min:seg)<input type="text" inputmode="numeric" id="rT" placeholder="7:07"></label><label class="f">Data<input type="date" id="rD" value="${hoje}"></label><button class="btn" type="submit">Salvar</button></form>
        <p class="small" id="rPrev"></p>
        ${melhorEst ? `<div class="stat"><span class="k">Melhor estimativa para 12 min</span><span class="v" style="color:${melhorEst >= 1800 ? 'var(--ok)' : 'var(--warn)'}">${melhorEst.toLocaleString('pt-BR')} m</span><span class="small muted">índice: 1.800 m</span></div>` : ''}
        <div class="list">${runs.slice(0, 8).map((r) => `<div class="li"><span class="t">${r.km ? `<b>${String(r.km).replace('.', ',')} km</b> em ${C.fmtClock(r.seg * 1000)} · ${pace(r.seg, r.km)}/km` : `<b>${C.esc(r.desc || 'Corrida guiada')}</b> · ${Math.round(r.seg / 60)} min`}${r.km && r.seg ? `<br><span class="small muted">≈ ${est12(r.km, r.seg).toLocaleString('pt-BR')} m em 12 min</span>` : ''}</span><span class="small muted">${C.fmtDate(r.d)}</span><button class="x" type="button" data-delrun="${r.id}" aria-label="Apagar">×</button></div>`).join('')}</div></div>
    </div>`;
  v.querySelectorAll('#trLocal button').forEach((b) => b.onclick = () => { t.local = b.dataset.l; C.save('treino'); renderTreino(v); });
  v.querySelectorAll('[data-start]').forEach((b) => b.onclick = () => iniciar(v, +b.dataset.start));
  v.querySelector('#trDias').onclick = () => editDias(v);
  v.querySelector('#rSup').onchange = (e) => { t.restr.sup = e.target.checked; C.save('treino'); renderTreino(v); };
  v.querySelector('#rJoe').onchange = (e) => { t.restr.joelho = e.target.checked; C.save('treino'); renderTreino(v); };
  v.querySelector('#trAvanca').onclick = () => { t.corrida.semana = Math.min(PROGRAMA.length, sem + 1); C.save('treino'); C.toast(`Semana ${t.corrida.semana} liberada!`); renderTreino(v); };
  v.querySelector('#trRepete').onclick = () => { t.corrida.feitas[sem] = []; C.save('treino'); C.toast('Semana reiniciada.'); renderTreino(v); };
  const vt = v.querySelector('#trVolta'); if (vt) vt.onclick = () => { t.corrida.semana = sem - 1; t.corrida.feitas[sem - 1] = []; C.save('treino'); renderTreino(v); };
  const km = v.querySelector('#rKm'), tm = v.querySelector('#rT'), prev = v.querySelector('#rPrev');
  const upd = () => { const k = +String(km.value).replace(',', '.'); const s = parseTempo(tm.value); prev.textContent = k > 0 && s > 0 ? `Ritmo: ${pace(s, k)}/km · estimativa para 12 min: ≈ ${est12(k, s).toLocaleString('pt-BR')} m` : ''; };
  km.oninput = upd; tm.oninput = upd;
  v.querySelector('#runForm').onsubmit = (e) => {
    e.preventDefault();
    const k = +String(km.value).replace(',', '.'); const s = parseTempo(tm.value);
    if (!(k > 0) || !(s > 0)) { C.toast('Informe a distância e o tempo.'); return; }
    t.runs.push({ id: C.uid(), d: v.querySelector('#rD').value || hoje, km: k, seg: s, tipo: 'manual' });
    if (t.runs.length > 300) t.runs = t.runs.slice(-300);
    C.save('treino'); logTaf('Corrida', Math.round(s / 60), `${String(k).replace('.', ',')} km · ${pace(s, k)}/km`, v.querySelector('#rD').value || hoje);
    C.toast(`Corrida salva: ${pace(s, k)}/km`); renderTreino(v);
  };
  v.querySelectorAll('[data-delrun]').forEach((b) => b.onclick = () => { t.runs = t.runs.filter((r) => r.id !== b.dataset.delrun); C.save('treino'); renderTreino(v); });
}

function logTaf(tipo, min, obs, d) {
  const taf = C.getDoc('taf');
  taf.treinos.push({ id: C.uid(), tipo, min, obs: obs || '', d: d || C.dkey() });
  C.save('taf'); C.onEvent('treino');
}

function editDias(v) {
  const t = T();
  const box = v.querySelector('#trDiasBox');
  box.hidden = !box.hidden;
  if (box.hidden) return;
  box.innerHTML = `<div class="form">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<label class="f">${DNL[d]}<select data-d="${d}">${Object.entries(TIPOS).map(([k, x]) => `<option value="${k}" ${t.dias[d] === k ? 'selected' : ''}>${x.n}</option>`).join('')}</select></label>`).join('')}</div><p class="small muted">Para o programa de corrida, mantenha 3 dias de corrida. O 1º dia faz a Corrida A, o 2º a B e o 3º a C, a mais longa.</p><button class="btn sm" type="button" id="trPadrao">Voltar ao padrão</button>`;
  box.querySelectorAll('select').forEach((s) => s.onchange = () => { t.dias[s.dataset.d] = s.value; C.save('treino'); renderTreino(v); v.querySelector('#trDias').click(); });
  box.querySelector('#trPadrao').onclick = () => { t.dias = { ...DEF_DIAS }; C.save('treino'); renderTreino(v); };
}

function iniciar(v, dow) {
  const t = T();
  const tipo = t.dias[dow];
  C.unlockAudio();
  if (tipo === 'corrida') {
    const sess = PROGRAMA[t.corrida.semana - 1][corridaIdx(dow)];
    const ph = phases(sess);
    modo = { tipo: 'guia', sess, ph, i: 0, ini: null, pausa: null, acum: 0, letra: 'ABC'[corridaIdx(dow)], sem: t.corrida.semana };
    return drawGuia(v);
  }
  if (tipo === 'forcaA' || tipo === 'forcaB') {
    const ficha = fichaAtiva(tipo);
    const last = [...t.forca].reverse().find((f) => f.ficha === tipo);
    modo = { tipo: 'forca', ficha: tipo, fichaObj: ficha, local: t.local, sets: Object.fromEntries(ficha.ex.map((e) => [e.id, Array.from({ length: e.series }, (_, i) => { const l = last && last.ex[e.id] && last.ex[e.id][i]; return { r: l ? l.r : '', kg: l ? l.kg : '', ok: false }; })])), last };
    return drawForca(v);
  }
  if (tipo === 'natacao') return drawNatacao(v);
  logTaf(TIPOS[tipo].n, 60, '', C.dkey());
  C.toast('Treino registrado.');
  renderTreino(v);
}

let guiaTick = null;
let wake = null;

function guiaElapsedInPhase(g) { if (!g.ini) return 0; return (g.pausa || Date.now()) - g.ini - g.acum; }

function armSeries(g) {
  let at = Date.now() + (g.ph[g.i].s * 1000 - guiaElapsedInPhase(g));
  const items = [];
  for (let j = g.i + 1; j < g.ph.length; j++) {
    const p = g.ph[j]; items.push({ at, title: `${PH[p.t][0]}${p.rep ? ' ' + p.rep : ''}${p.dist ? ` · ${p.dist} m` : ''}`, body: `${fmtS(p.s)} · ${PH[p.t][1]}` }); at += p.s * 1000;
  }
  items.push({ at, title: 'Treino concluído! 🎉', body: 'Abra o app para salvar.' });
  scheduleSeries(items);
}

function drawGuia(v) {
  clearInterval(guiaTick);
  const g = modo;
  const p = g.ph[g.i];
  const [nome, sub, cor] = PH[p.t];
  const tot = g.ph.reduce((a, x) => a + x.s, 0);
  const antes = g.ph.slice(0, g.i).reduce((a, x) => a + x.s, 0);
  const prox = g.ph[g.i + 1];
  v.innerHTML = `<div class="guia" style="--gc:${cor}">
    <div class="row between"><span class="k">Semana ${g.sem} · Corrida ${g.letra}</span><span class="small muted num">Etapa ${g.i + 1} de ${g.ph.length}</span></div>
    <div class="guia-main"><div class="guia-nome">${nome}${p.rep ? ` <span class="num">${p.rep}</span>` : ''}</div>${p.dist ? `<div class="guia-sub">${p.dist} m · alvo ${C.fmtClock(p.s * 1000)}</div>` : ''}<div class="guia-t num" id="gT"></div><div class="guia-sub">${sub}</div></div>
    <div class="bar" style="--c:var(--gc)"><i id="gBar"></i></div>
    <p class="small muted" id="gProx">${prox ? `Depois: ${PH[prox.t][0]} · ${fmtS(prox.s)}` : 'Última etapa'}</p>
    <div class="row guia-ctl">${!g.ini ? '<button class="btn primary" type="button" id="gGo">Começar</button>' : `<button class="btn" type="button" id="gPause">${g.pausa ? 'Continuar' : 'Pausar'}</button><button class="btn" type="button" id="gSkip">Pular etapa</button>`}<button class="btn ghost" type="button" id="gStop">Encerrar</button></div>
    <p class="small muted">Com o app aberto, a tela fica ligada e você ouve o apito a cada troca de etapa. No Android, as trocas também chegam como notificação se a tela apagar.</p></div>`;
  const upd = () => {
    const el = v.querySelector('#gT'); if (!el) { clearInterval(guiaTick); return; }
    const e = guiaElapsedInPhase(g);
    const left = p.s * 1000 - e;
    el.textContent = C.fmtClock(Math.max(0, left));
    v.querySelector('#gBar').style.width = Math.min(100, (antes * 1000 + Math.min(e, p.s * 1000)) / (tot * 1000) * 100) + '%';
    if (g.ini && !g.pausa && left <= 0) next(v);
  };
  const go = v.querySelector('#gGo');
  if (go) go.onclick = async () => { await askPermission(); g.ini = Date.now(); g.acum = 0; g.inicioTreino = Date.now(); try { wake = await navigator.wakeLock?.request('screen'); } catch (e) {} armSeries(g); C.beep(); vib([200]); drawGuia(v); };
  const pz = v.querySelector('#gPause');
  if (pz) pz.onclick = () => { if (g.pausa) { g.acum += Date.now() - g.pausa; g.pausa = null; armSeries(g); } else { g.pausa = Date.now(); cancelSeries(); } drawGuia(v); };
  const sk = v.querySelector('#gSkip'); if (sk) sk.onclick = () => next(v, true);
  v.querySelector('#gStop').onclick = () => finishGuia(v, true);
  upd();
  if (g.ini && !g.pausa) guiaTick = setInterval(upd, 250);
}

function vib(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }

function next(v, manual) {
  const g = modo;
  if (g.i >= g.ph.length - 1) return finishGuia(v, false);
  g.i++; g.ini = Date.now(); g.acum = 0; g.pausa = null;
  if (manual) armSeries(g);
  C.beep(); vib([300, 120, 300]);
  drawGuia(v);
}

function finishGuia(v, cedo) {
  clearInterval(guiaTick); cancelSeries();
  try { wake && wake.release(); } catch (e) {}
  const g = modo;
  const correu = g.ph.slice(0, g.i + (cedo ? 0 : 1)).filter((p) => ['corre', 'tiro', 'teste'].includes(p.t)).length;
  modo = { tipo: 'fim', g, cedo, correu, min: g.inicioTreino ? Math.round((Date.now() - g.inicioTreino) / 60000) : 0 };
  drawFimCorrida(v);
}

function drawFimCorrida(v) {
  const f = modo;
  const g = f.g;
  const teste = g.sess.teste;
  v.innerHTML = `<div class="vhead"><span class="k">Semana ${g.sem} · Corrida ${g.letra}</span><h1>${f.cedo ? 'Treino encerrado' : 'Treino concluído! 🎉'}</h1></div>
    <div class="card"><p>${f.min} min de treino.${f.cedo ? ' Encerrado antes do fim: tudo bem, conta como tentativa.' : ''}</p>
      <form class="form" id="fimForm"><label class="f">${teste ? 'Distância no teste de 12 min (metros)' : 'Distância total, se souber (km)'}<input type="text" inputmode="decimal" id="fKm" placeholder="${teste ? '1650' : 'opcional'}"></label><label class="f">Como foi?<select id="fSens"><option>Tranquilo</option><option selected>Puxado, mas deu</option><option>Muito difícil</option></select></label><button class="btn primary" type="submit">Salvar</button></form>
      <p class="small muted">Se marcar "Muito difícil", o melhor é repetir esta sessão antes de avançar.</p></div>`;
  v.querySelector('#fimForm').onsubmit = (e) => {
    e.preventDefault();
    const t = T();
    const raw = +String(v.querySelector('#fKm').value).replace(',', '.');
    const sens = v.querySelector('#fSens').value;
    const d = C.dkey();
    const run = { id: C.uid(), d, seg: f.min * 60, tipo: 'guiado', desc: `Semana ${g.sem} · Corrida ${g.letra} (${sens.toLowerCase()})` };
    if (teste && raw > 0) { C.addMarca('corr', raw); run.km = raw / 1000; run.seg = 720; run.desc = 'Teste de 12 min'; }
    else if (raw > 0) run.km = raw;
    t.runs.push(run);
    if (!f.cedo && sens !== 'Muito difícil') { const fe = t.corrida.feitas[g.sem] || (t.corrida.feitas[g.sem] = []); if (!fe.includes(g.letra)) fe.push(g.letra); }
    C.save('treino');
    logTaf('Corrida', f.min, run.desc, d);
    modo = null;
    C.toast('Corrida salva.');
    renderTreino(v);
  };
}

let restTick = null;

function drawForca(v) {
  const f = modo;
  const ficha = f.fichaObj || fichaAtiva(f.ficha);
  v.innerHTML = `<div class="row between"><button class="btn sm ghost" type="button" id="fBack">← Semana</button><div class="seg" id="fLocal"><button type="button" data-l="academia" aria-pressed="${f.local === 'academia'}">Academia</button><button type="button" data-l="casa" aria-pressed="${f.local === 'casa'}">Casa</button></div></div>
    <div class="vhead"><h1>${ficha.nome}</h1><p class="muted">Preencha as repetições (ou segundos) e a carga de cada série. Os valores do último treino já vêm preenchidos.</p></div>
    <div class="rest" id="rest" hidden></div>
    ${ficha.ex.map((e) => { const sug = sugestao(e, f.last); return `<div class="card ex" data-ex="${e.id}"><div class="row between"><h3>${e.n}</h3><span class="pill">${e.series} × ${e.alvo}</span></div><p class="small muted">${f.local === 'casa' ? e.casa : e.acad}</p>${sug ? `<p class="small" style="color:var(--ok)">${sug}</p>` : ''}
      <div class="sets">${f.sets[e.id].map((s, i) => `<div class="set${s.ok ? ' ok' : ''}" data-i="${i}"><span class="n">${i + 1}</span><input type="number" inputmode="numeric" placeholder="${e.unid === 's' ? 'seg' : e.unid === 'cm' ? 'cm' : 'reps'}" value="${s.r}" data-f="r" aria-label="Série ${i + 1}">${e.unid ? '' : `<input type="number" inputmode="decimal" placeholder="kg" value="${s.kg}" data-f="kg" aria-label="Carga série ${i + 1}">`}<button class="btn sm${s.ok ? ' primary' : ''}" type="button" data-ok="${i}">✓</button></div>`).join('')}</div></div>`; }).join('')}
    <div class="row"><button class="btn primary" type="button" id="fSave">Concluir treino</button></div>`;
  v.querySelector('#fBack').onclick = () => { modo = null; renderTreino(v); };
  v.querySelectorAll('#fLocal button').forEach((b) => b.onclick = () => { f.local = b.dataset.l; drawForca(v); });
  v.querySelectorAll('.ex').forEach((card) => {
    const e = ficha.ex.find((x) => x.id === card.dataset.ex);
    card.querySelectorAll('.set').forEach((row) => {
      const i = +row.dataset.i; const s = f.sets[e.id][i];
      row.querySelectorAll('input').forEach((inp) => inp.oninput = () => { s[inp.dataset.f] = inp.value; });
      row.querySelector('[data-ok]').onclick = (ev) => { s.ok = !s.ok; row.classList.toggle('ok', s.ok); ev.target.classList.toggle('primary', s.ok); if (s.ok) startRest(v, e.desc || 60); };
    });
  });
  v.querySelector('#fSave').onclick = () => {
    const t = T();
    const ex = {};
    Object.entries(f.sets).forEach(([id, arr]) => { const done = arr.filter((s) => s.r !== '' && s.r != null).map((s) => ({ r: +s.r || 0, kg: s.kg === '' ? null : +s.kg })); if (done.length) ex[id] = done; });
    if (!Object.keys(ex).length) { C.toast('Preencha pelo menos uma série.'); return; }
    t.forca.push({ id: C.uid(), d: C.dkey(), ficha: f.ficha, local: f.local, ex });
    if (t.forca.length > 120) t.forca = t.forca.slice(-120);
    C.save('treino');
    const iso = [...(ex.iso || []), ...(ex.iso2 || [])].map((x) => x.r);
    if (iso.length) { const best = Math.max(...iso); if (best > 0) C.addMarca('barra', best); }
    const sal = (ex.salto || []).map((x) => x.r);
    if (sal.length) { const best = Math.max(...sal); if (best > 50) C.addMarca('imp', best / 100); }
    logTaf(TIPOS[f.ficha].n, 45, f.local === 'casa' ? 'em casa' : 'academia', C.dkey());
    clearInterval(restTick);
    modo = null;
    C.toast('Treino de força salvo 💪');
    renderTreino(v);
  };
}

function sugestao(e, last) {
  if (!last || !last.ex[e.id]) return '';
  const arr = last.ex[e.id];
  if (e.unid === 's') { const best = Math.max(...arr.map((x) => x.r)); return best ? `Último treino: melhor série de ${best} s. Tente passar disso.` : ''; }
  if (e.unid === 'cm') { const best = Math.max(...arr.map((x) => x.r)); return best ? `Último treino: melhor salto de ${best} cm (índice: 156 cm).` : ''; }
  const top = +String(e.alvo).split(/[–-]/).pop();
  if (top && arr.length >= e.series && arr.every((x) => x.r >= top)) return `Você fez ${top} repetições em todas as séries. Suba a carga neste treino.`;
  return '';
}

function startRest(v, s) {
  clearInterval(restTick);
  const box = v.querySelector('#rest'); if (!box) return;
  const fim = Date.now() + s * 1000;
  box.hidden = false;
  const upd = () => { const left = fim - Date.now(); if (!document.body.contains(box)) { clearInterval(restTick); return; } if (left <= 0) { box.innerHTML = '<b>Descanso acabou: próxima série!</b>'; C.beep(); vib([200, 100, 200]); clearInterval(restTick); setTimeout(() => { box.hidden = true; }, 4000); return; } box.innerHTML = `Descanso <b class="num">${C.fmtClock(left)}</b> <button class="btn sm ghost" type="button" id="restX">Pular</button>`; const x = box.querySelector('#restX'); if (x) x.onclick = () => { clearInterval(restTick); box.hidden = true; }; };
  upd(); restTick = setInterval(upd, 500);
}

function drawNatacao(v) {
  v.innerHTML = `<div class="row"><button class="btn sm ghost" type="button" id="nBack">← Semana</button></div>
    ${T().restr.sup ? '<p class="small" style="color:var(--warn)">Membros superiores pausados: confirme com o médico ou a fisioterapeuta se o crawl está liberado. Se não estiver, faça só a pernada com prancha, se for permitido, ou troque o sábado por uma caminhada longa.</p>' : ''}
    <div class="vhead"><h1>Natação</h1><p class="muted">Cerca de 2.000 m em 60 a 75 min. Este é o seu treino aeróbico mais longo da semana, sem impacto.</p></div>
    <div class="list">${NATACAO.map(([a, b]) => `<div class="li" style="border-left:4px solid #2fc4c4;align-items:flex-start"><span class="t"><b>${a}</b><br><span class="small">${b}</span></span></div>`).join('')}</div>
    <div class="card"><h2>Registrar</h2><form class="form" id="natForm"><label class="f">Distância total (m)<input type="number" inputmode="numeric" id="nM" placeholder="2000"></label><label class="f">Duração (min)<input type="number" inputmode="numeric" id="nMin" value="60"></label><label class="f">Melhor tiro de 50 m (min:seg)<input type="text" inputmode="numeric" id="n50" placeholder="0:58"></label><button class="btn primary" type="submit">Salvar</button></form></div>`;
  v.querySelector('#nBack').onclick = () => renderTreino(v);
  v.querySelector('#natForm').onsubmit = (e) => {
    e.preventDefault();
    const t = T();
    const metros = +v.querySelector('#nM').value || 0;
    const min = +v.querySelector('#nMin').value || 60;
    const t50 = parseTempo(v.querySelector('#n50').value);
    t.nat.push({ id: C.uid(), d: C.dkey(), m: metros, min, t50 });
    if (t.nat.length > 120) t.nat = t.nat.slice(-120);
    C.save('treino');
    if (t50 > 0) C.addMarca('nat', t50);
    logTaf('Natação', min, metros ? `${metros} m` : '', C.dkey());
    C.toast('Natação salva 🏊');
    renderTreino(v);
  };
}
