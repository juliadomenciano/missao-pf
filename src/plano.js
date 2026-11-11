let C;

const DEF = {
  objetivo: 'Agente de Polícia Federal',
  calendario: [],
  rotina: '',
  partida: { data: '', itens: [] },
  proximos: [],
};

export function initPlano(ctx) {
  C = ctx;
  C.registerDoc('perfil', JSON.parse(JSON.stringify(DEF)));
  C.EXT.plano = renderPlano;
}

const P = () => { const p = C.getDoc('perfil'); p.partida = p.partida || { data: '', itens: [] }; p.calendario = p.calendario || []; p.proximos = p.proximos || []; return p; };

function atual(k) {
  const t = C.getDoc('treino');
  if (k === 'corr') {
    const runs = (t.runs || []).filter((r) => r.km > 0 && r.seg > 0);
    const est = runs.reduce((a, r) => Math.max(a, Math.round(r.km * 1000 * Math.pow(720 / r.seg, 1 / 1.06))), 0);
    const b = C.bestMark('corr');
    return Math.max(est, b || 0) || null;
  }
  return C.bestMark(k);
}

let editando = false;

function renderPlano(v) {
  const p = P();
  if (editando) return editPlano(v, p);
  const t = C.getDoc('treino');
  const sem = (t.corrida && t.corrida.semana) || 1;
  const DN = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const TIP = { corrida: 'Corrida', forcaA: 'Força A', forcaB: 'Força B', natacao: 'Natação', beach: 'Beach tennis', livre: 'Livre' };
  const dias = t.dias || {};
  const hoje = C.dkey();
  const prova = C.getDoc('cfg').prova;
  const metas = C.PROVAS.map((pr) => {
    const v0 = atual(pr.id);
    const ok = v0 != null && (pr.dir > 0 ? v0 >= pr.meta : v0 <= pr.meta);
    const pct = v0 == null ? 0 : Math.min(100, Math.round((pr.dir > 0 ? v0 / pr.meta : pr.meta / v0) * 100));
    const label = pr.id === 'corr' && v0 ? `${v0.toLocaleString('pt-BR')} m${C.bestMark('corr') ? '' : ' (estimativa)'}` : C.fmtMark(pr, v0);
    return `<div class="mbar"><span class="n"><span>${pr.n}</span></span><div class="bar" style="--c:${ok ? 'var(--ok)' : 'var(--warn)'}"><i style="width:${pct}%"></i></div><span class="num small" style="text-align:right">${v0 == null ? '–' : label}</span></div>`;
  }).join('');
  v.innerHTML = `<div class="row between"><div class="vhead"><h1>Meu plano</h1><p class="muted">Objetivo, calendário, rotina e evolução, num lugar só.</p></div><button class="btn sm" type="button" id="plEdit">Editar</button></div>
    <div class="card accent" style="--c:#e2b13c"><span class="k">Objetivo</span><h2>${C.esc(p.objetivo || 'Agente de Polícia Federal')}</h2>
      <p class="small muted">Prova objetiva com 120 itens Cebraspe (corte de 6, 3 e 2 por bloco e 48 no total) + discursiva de 30 linhas + TAF com 4 testes (barra, impulsão, natação 50 m e corrida 12 min).${prova ? ` Prova marcada para ${C.fmtDate(prova)}.` : ''}</p></div>
    ${p.calendario.length ? `<div class="card"><h2>Calendário</h2><div class="timeline-v">${p.calendario.map((c) => `<div class="tl${c.quando && c.quando <= hoje ? ' on' : ''}"><span class="k">${C.esc(c.rotulo || '')}</span><b>${C.esc(c.titulo)}</b>${c.det ? `<span class="small muted">${C.esc(c.det)}</span>` : ''}</div>`).join('')}</div></div>` : ''}
    <div class="cols">
      <div class="card"><h2>Rotina de treino</h2><div class="list">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<div class="li"><span class="dname" style="font-family:var(--display);font-weight:800;width:38px">${DN[d]}</span><span class="t">${TIP[dias[d]] || '–'}</span></div>`).join('')}</div>${p.rotina ? `<p class="small muted">${C.esc(p.rotina)}</p>` : ''}<p class="small muted">Programa de corrida: semana ${sem} de 12.</p><button class="btn sm ghost" type="button" data-go="treino" style="justify-self:start">Abrir treino</button></div>
      <div class="card"><h2>Ponto de partida${p.partida.data ? ` · ${C.fmtDate(p.partida.data)}` : ''}</h2>${p.partida.itens.length ? `<div class="list">${p.partida.itens.map((i) => `<div class="li" style="align-items:flex-start"><span class="t"><b>${C.esc(i.k)}</b><br><span class="small">${C.esc(i.v)}</span></span></div>`).join('')}</div>` : '<p class="empty">Toque em Editar para registrar de onde você começou.</p>'}</div>
      <div class="card"><h2>Hoje × índices do TAF</h2><div class="mbars">${metas}</div><p class="small muted">Melhores marcas registradas. Na corrida, vale o maior entre o teste de 12 min e a estimativa pelas corridas com distância e tempo.</p></div>
      ${p.proximos.length ? `<div class="card"><h2>Próximos passos</h2><div class="list">${p.proximos.map((x) => `<div class="li"><span class="t">${C.esc(x)}</span></div>`).join('')}</div></div>` : ''}
    </div>`;
  v.querySelector('#plEdit').onclick = () => { editando = true; renderPlano(v); };
}

function editPlano(v, p) {
  const cal = p.calendario.map((c) => [c.rotulo, c.titulo, c.det, c.quando].map((x) => x || '').join(' | ')).join('\n');
  const part = p.partida.itens.map((i) => `${i.k}: ${i.v}`).join('\n');
  v.innerHTML = `<div class="vhead"><h1>Editar meu plano</h1></div>
    <div class="card"><label class="f">Objetivo<input type="text" id="eObj" value="${C.esc(p.objetivo || '')}"></label>
      <label class="f">Calendário (uma linha por etapa: rótulo | título | detalhe | data AAAA-MM-DD opcional)<textarea id="eCal" rows="5">${C.esc(cal)}</textarea></label>
      <label class="f">Observação da rotina<textarea id="eRot" rows="2">${C.esc(p.rotina || '')}</textarea></label>
      <label class="f">Data do ponto de partida<input type="date" id="ePD" value="${p.partida.data || ''}"></label>
      <label class="f">Ponto de partida (uma linha por item, no formato "Item: descrição")<textarea id="ePI" rows="5">${C.esc(part)}</textarea></label>
      <label class="f">Próximos passos (um por linha)<textarea id="ePx" rows="4">${C.esc(p.proximos.join('\n'))}</textarea></label>
      <div class="row"><button class="btn primary" type="button" id="eSave">Salvar</button><button class="btn ghost" type="button" id="eCancel">Cancelar</button></div></div>`;
  v.querySelector('#eCancel').onclick = () => { editando = false; renderPlano(v); };
  v.querySelector('#eSave').onclick = () => {
    p.objetivo = v.querySelector('#eObj').value.trim();
    p.calendario = v.querySelector('#eCal').value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const [rotulo, titulo, det, quando] = l.split('|').map((x) => (x || '').trim()); return { rotulo, titulo: titulo || rotulo, det, quando: /^\d{4}-\d{2}-\d{2}$/.test(quando || '') ? quando : '' }; });
    p.rotina = v.querySelector('#eRot').value.trim();
    p.partida = { data: v.querySelector('#ePD').value, itens: v.querySelector('#ePI').value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const i = l.indexOf(':'); return i > 0 ? { k: l.slice(0, i).trim(), v: l.slice(i + 1).trim() } : { k: l, v: '' }; }) };
    p.proximos = v.querySelector('#ePx').value.split('\n').map((l) => l.trim()).filter(Boolean);
    C.save('perfil');
    editando = false;
    C.toast('Plano salvo.');
    renderPlano(v);
  };
}
