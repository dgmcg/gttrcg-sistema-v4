// ============================================================
// GTTRCG — monitoramento.js
// Responsabilidades:
//   - Renderização da tabela lista de processos
//   - Renderização do Kanban (por fase e etapa atual)
//   - Toggle de visualização Lista/Kanban
//   - Filtros: busca, tipo, status, fase, usuário responsável
//   - Ordenação de colunas
//   - Botão de excluir processo (admin only)
//   - Live recálculo de progresso ao preencher campos
// ============================================================

// ── Estado da visualização ────────────────────────────────────
let monitorView = 'lista';
let currentSort = { field: 'nome', dir: 'asc' };

// ============================================================
// POPULAR FILTROS
// ============================================================

function populateFilters() {
  const processos = ls('processos') || [];
  const tipos     = [...new Set(processos.map(p => p.tipo).filter(Boolean))];
  const statuses  = ls('statusProcesso') || [];
  const fases     = ls('fases') || [];
  const usuarios  = ls('usuarios') || [];

  const sel = (id, opts) => {
    const el = document.getElementById(id);
    if (!el) return;
    const cur = el.value;
    el.innerHTML = el.options[0].outerHTML + opts.map(o => `<option value="${o}">${o}</option>`).join('');
    el.value = cur;
  };

  sel('monitor-tipo',   tipos);
  sel('monitor-status', statuses);
  sel('monitor-fase',   fases);

  // Filtro de usuário responsável
  const monUser = document.getElementById('monitor-usuario');
  if (monUser) {
    const cur = monUser.value;
    monUser.innerHTML = '<option value="">Todos os usuários</option>' +
      usuarios.filter(u => u.login !== 'admin')
              .map(u => `<option value="${u.login}">${u.nome || u.login}</option>`).join('');
    monUser.value = cur;
  }
}

// ============================================================
// FILTRAR PROCESSOS (função centralizada)
// ============================================================

function filtrarProcessos() {
  let processos = ls('processos') || [];

  const q        = document.getElementById('monitor-search')?.value.toLowerCase()  || '';
  const tipoF    = document.getElementById('monitor-tipo')?.value                  || '';
  const statusF  = document.getElementById('monitor-status')?.value                || '';
  const faseF    = document.getElementById('monitor-fase')?.value                  || '';
  const userF    = document.getElementById('monitor-usuario')?.value               || '';

  if (q)      processos = processos.filter(p =>
    [p.nome, p.sei, p.oss, p.municipio, p.status, p.fase].join(' ').toLowerCase().includes(q));
  if (tipoF)  processos = processos.filter(p => p.tipo   === tipoF);
  if (statusF) processos = processos.filter(p => p.status === statusF);
  if (faseF)  processos = processos.filter(p => p.fase   === faseF);

  // Filtro da sidebar
  const sf = APP.sidebarFilter;
  if (sf) {
    if (sf.type === 'tipo') {
      processos = processos.filter(p => p.tipo?.toLowerCase().includes(sf.value.toLowerCase()));
    } else if (sf.type === 'favorito_mapa') {
      processos = processos.filter(p => euFavoritei(p));
    } else if (sf.type === 'status') {
      const sv = sf.value;
      if (sv === 'em_andamento')
        processos = processos.filter(p => !['Aguardando Início do Processo','Contratação Concluída'].includes(p.status));
      else if (sv === 'remetido')
        processos = processos.filter(p => p.status?.toLowerCase().includes('remetido'));
      else if (sv === 'aguardando')
        processos = processos.filter(p => p.status?.toLowerCase().includes('aguardando'));
      else if (sv === 'assinatura')
        processos = processos.filter(p => p.status?.toLowerCase().includes('assinatura'));
    }
  }

  // Filtro por usuário responsável
  if (userF) {
    const etapas = ls('etapasFluxo') || [];
    processos = processos.filter(p =>
      etapas.some(e =>
        p.acompanhamento?.[e.id]?._responsavel === userF &&
        !p.acompanhamento?.[e.id]?._concluido
      )
    );
  }

  return processos;
}

// ============================================================
// VISUALIZAÇÃO LISTA
// ============================================================

function sortTable(field) {
  if (currentSort.field === field) currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
  else { currentSort.field = field; currentSort.dir = 'asc'; }
  renderMonitoramento();
}

function renderMonitoramento() {
  populateFilters();

  let processos = filtrarProcessos();

  // Ordena
  processos.sort((a, b) => {
    const va = (a[currentSort.field] || '').toString().toLowerCase();
    const vb = (b[currentSort.field] || '').toString().toLowerCase();
    return currentSort.dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  const tbody = document.getElementById('monitor-tbody');
  const empty = document.getElementById('monitor-empty');
  if (!tbody) return;

  if (!processos.length) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  const isAdmin = APP.currentUser?.perfil === 'admin';
  const login   = APP.currentUser?.login;

  tbody.innerHTML = processos.map(p => {
    const isMeuFav = euFavoritei(p);
    const excluirBtn = isAdmin
      ? `<button class="btn sm icon danger" title="Excluir processo"
           onclick="event.stopPropagation();excluirProcesso('${p.id}')">
           <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13">
             <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
             <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
           </svg>
         </button>`
      : '';

    return `
      <tr onclick="openDetalhe('${p.id}')">
        <td onclick="event.stopPropagation()" style="padding:4px 8px">
          <button class="btn icon sm btn-fav-star" title="${isMeuFav?'Remover favorito':'Marcar favorito'}"
                  onclick="toggleFavorito('${p.id}')"
                  style="color:${isMeuFav?'var(--yellow2)':'var(--text3)'}">
            <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13">
              <path d="M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.314-.158-.888.283-.95l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.184 4.327 4.898.696c.441.062.612.636.282.95l-3.522 3.356.83 4.73c.078.443-.36.79-.746.592L8 13.187l-4.389 2.256z"/>
            </svg>
          </button>
        </td>
        <td>
          <div class="td-name">${p.nome}</div>
          <div class="td-sub">${p.municipio||''}</div>
        </td>
        <td><span class="badge ${tipoBadge(p.tipo)}">${p.tipo||'-'}</span></td>
        <td style="color:var(--text3);font-size:12px">${p.oss||'-'}</td>
        <td style="font-family:var(--mono);font-size:11px;color:var(--text3)">${p.sei?p.sei.slice(0,18)+'…':'-'}</td>
        <td><span class="badge ${statusBadge(p.status)}"
              style="max-width:180px;overflow:hidden;text-overflow:ellipsis;display:inline-block;font-size:11px">
              ${p.status||'-'}</span></td>
        <td style="font-size:12px;color:var(--text2)">${p.fase||'-'}</td>
        <td>${progressBar(p.progresso||0)}</td>
        <td style="color:var(--text3);font-size:12px">${fmtDate(p.inicio)}</td>
        <td onclick="event.stopPropagation()">
          <div style="display:flex;gap:4px">
            <button class="btn sm icon" title="Acompanhar" onclick="openDetalhe('${p.id}')">
              <svg viewBox="0 0 16 16" fill="currentColor">
                <path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/>
                <path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>
              </svg>
            </button>
            <button class="btn sm icon" title="Editar" onclick="openEditarProcesso('${p.id}')">
              <svg viewBox="0 0 16 16" fill="currentColor">
                <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10z"/>
              </svg>
            </button>
            ${excluirBtn}
          </div>
        </td>
      </tr>`;
  }).join('');
}

// ============================================================
// EXCLUIR PROCESSO
// ============================================================

function excluirProcesso(id) {
  let processos = ls('processos') || [];
  const p = processos.find(x => x.id === id);
  if (!p) return;
  if (!confirm(`Excluir permanentemente:\n\n"${p.nome}"\n\nEsta ação não pode ser desfeita.`)) return;

  const snapshot = JSON.parse(JSON.stringify(p));
  UndoStack.push({
    label: `Excluir processo "${p.nome}"`,
    undo() {
      const procs = ls('processos') || [];
      procs.push(snapshot);
      ls('processos', procs);
      renderMonitoramento();
      renderDashboard();
      updateSidebarCounts();
    },
  });

  processos = processos.filter(x => x.id !== id);
  ls('processos', processos);
  renderMonitoramento();
  if (monitorView === 'kanban') renderKanban();
  renderDashboard();
  updateSidebarCounts();
  showToast(`Processo "${p.nome}" excluído.`);
}

// ============================================================
// VISUALIZAÇÃO KANBAN
// ============================================================

function setMonitorView(view) {
  monitorView = view;
  const tableWrap  = document.querySelector('#page-monitoramento .table-wrap');
  const kanbanWrap = document.getElementById('kanban-view');
  const btnLista   = document.getElementById('view-lista-btn');
  const btnKanban  = document.getElementById('view-kanban-btn');

  if (view === 'lista') {
    if (tableWrap)  tableWrap.style.display  = '';
    if (kanbanWrap) kanbanWrap.style.display  = 'none';
    if (btnLista)  { btnLista.style.background  = 'var(--bg3)'; btnLista.style.borderColor  = 'var(--border2)'; }
    if (btnKanban) { btnKanban.style.background = '';            btnKanban.style.borderColor = ''; }
    renderMonitoramento();
  } else {
    if (tableWrap)  tableWrap.style.display  = 'none';
    if (kanbanWrap) kanbanWrap.style.display  = '';
    if (btnKanban) { btnKanban.style.background = 'var(--bg3)'; btnKanban.style.borderColor = 'var(--border2)'; }
    if (btnLista)  { btnLista.style.background  = '';           btnLista.style.borderColor  = ''; }
    populateFilters();
    renderKanban();
  }
  updateSidebarCounts();
}

function renderKanban() {
  const processos = filtrarProcessos();
  const etapas    = ls('etapasFluxo') || [];
  const fases     = ls('fases')       || [];
  const wrap      = document.getElementById('kanban-view');
  if (!wrap) return;

  // Agrupa por fase → etapa atual
  const faseGroups = {};
  fases.forEach(f => { faseGroups[f] = {}; });

  processos.forEach(p => {
    const f = p.fase || 'Sem Fase';
    if (!faseGroups[f]) faseGroups[f] = {};
    const etapaAtual = inferEtapaAtual(p, etapas);
    const etNome = etapaAtual ? etapaAtual.nome : 'Sem Etapa Definida';
    if (!faseGroups[f][etNome]) faseGroups[f][etNome] = [];
    faseGroups[f][etNome].push(p);
  });

  // Remove fases vazias
  Object.keys(faseGroups).forEach(f => {
    if (!Object.keys(faseGroups[f]).length) delete faseGroups[f];
  });

  if (!Object.keys(faseGroups).length) {
    wrap.innerHTML = '<div class="empty-state" style="padding:48px 20px"><p>Nenhum processo encontrado com os filtros aplicados</p></div>';
    return;
  }

  const faseColors = ['var(--accent2)','var(--green)','var(--yellow2)','var(--purple)','var(--red2)','var(--teal)'];
  let html = '<div class="kanban-wrap"><div class="kanban-board">';
  let fi = 0;

  Object.entries(faseGroups).forEach(([fase, etapasObj]) => {
    const totalProc = Object.values(etapasObj).reduce((a, b) => a + b.length, 0);
    const color = faseColors[fi % faseColors.length];

    html += `<div class="kanban-col">
      <div class="kanban-col-header" style="border-top:3px solid ${color}" onclick="toggleKanbanCol(this)">
        <div class="kanban-col-title">${fase}</div>
        <span class="kanban-col-count">${totalProc}</span>
      </div>
      <div class="kanban-col-body">`;

    Object.entries(etapasObj).forEach(([etNome, procs]) => {
      html += `<div class="kanban-etapa">
        <div class="kanban-etapa-header" onclick="toggleKanbanEtapa(this)">
          <svg viewBox="0 0 16 16" fill="currentColor" width="10" height="10" style="color:${color};flex-shrink:0"><circle cx="8" cy="8" r="5"/></svg>
          <span class="kanban-etapa-title">${etNome}</span>
          <span class="kanban-etapa-count">${procs.length}</span>
        </div>
        <div class="kanban-etapa-body open">`;

      procs.forEach(p => {
        const etapasAll = ls('etapasFluxo') || [];
        const dur = getDuracaoProcesso(p, etapasAll);
        const durHtml = dur ? `<span style="font-size:10px;color:var(--text3);margin-left:4px">${dur.concluido?'✓':'⏱'} ${fmtDuracao(dur.dias)}</span>` : '';
        const isMeuFav = euFavoritei(p);

        html += `<div class="kanban-card" onclick="openDetalhe('${p.id}')">
          <div class="kanban-card-name">${p.nome}${isMeuFav?' ⭐':''}${durHtml}</div>
          <div class="kanban-card-meta">
            <span class="badge ${tipoBadge(p.tipo)}" style="font-size:10px">${p.tipo||'-'}</span>
            <span class="badge ${statusBadge(p.status)}" style="font-size:10px;max-width:130px;overflow:hidden;text-overflow:ellipsis">
              ${(p.status||'-').length>20?(p.status||'-').slice(0,18)+'…':(p.status||'-')}
            </span>
          </div>
        </div>`;
      });

      html += `</div></div>`;
    });

    html += `</div></div>`;
    fi++;
  });

  html += '</div></div>';
  wrap.innerHTML = html;
}

// ── Inferir etapa atual de um processo ────────────────────────
function inferEtapaAtual(p, etapas) {
  if (!p.acompanhamento) return null;
  const sorted = etapasOrdenadas(etapas);
  const iniciada = sorted.find(e => {
    const ac = p.acompanhamento[e.id] || {};
    return ac._iniciado && !ac._concluido;
  });
  if (iniciada) return iniciada;
  return sorted.find(e => !(p.acompanhamento[e.id]||{})._concluido) || null;
}

// ── Toggle de colunas/etapas no Kanban ────────────────────────
function toggleKanbanCol(header) {
  const body = header.nextElementSibling;
  body.style.display = body.style.display === 'none' ? '' : 'none';
}

function toggleKanbanEtapa(header) {
  header.nextElementSibling.classList.toggle('open');
}

// ============================================================
// LIVE RECÁLCULO DE PROGRESSO NO MODAL DE DETALHE
// ============================================================

let liveCalcTimer;
document.addEventListener('change', e => {
  if (!e.target.dataset?.etapa) return;
  const procId = APP.currentProcessoId;
  if (!procId) return;

  clearTimeout(liveCalcTimer);
  liveCalcTimer = setTimeout(() => {
    const processos = ls('processos') || [];
    const etapas    = ls('etapasFluxo') || [];
    const idx = processos.findIndex(p => p.id === procId);
    if (idx < 0) return;

    // Snapshot temporário com valores atuais do DOM
    const snapshot = JSON.parse(JSON.stringify(processos[idx].acompanhamento || {}));
    document.querySelectorAll('[data-etapa]').forEach(el => {
      const eid   = el.dataset.etapa;
      const campo = el.dataset.campo;
      if (!campo) return;
      if (!snapshot[eid]) snapshot[eid] = {};
      snapshot[eid][campo] = el.type === 'checkbox' ? el.checked : el.value;
    });

    const tempProc = { ...processos[idx], acompanhamento: snapshot };
    const pct = calcProgressoProcesso(tempProc, etapas);

    const pdEl = document.getElementById('detalhe-progresso-display');
    if (pdEl) {
      pdEl.textContent = pct + '%';
      pdEl.style.color = pct >= 80 ? 'var(--green)' : pct >= 40 ? 'var(--accent2)' : 'var(--yellow2)';
    }
  }, 300);
});

// ============================================================
// EVENTOS DOS FILTROS (bindados aqui para não duplicar)
// ============================================================

(function bindFilterEvents() {
  const ids = ['monitor-search','monitor-tipo','monitor-status','monitor-fase','monitor-usuario'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input',  () => { if (monitorView === 'lista') renderMonitoramento(); else renderKanban(); });
    el.addEventListener('change', () => { if (monitorView === 'lista') renderMonitoramento(); else renderKanban(); });
  });
})();

console.log('[GTTRCG] monitoramento.js carregado ✓');
