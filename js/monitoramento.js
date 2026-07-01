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

// renderKanban → implementada no bloco Kanban v2 abaixo
// toggleKanbanCol e toggleKanbanEtapa mantidas por compatibilidade
function toggleKanbanCol(header) {
  const body = header.nextElementSibling;
  if (body) body.style.display = body.style.display === 'none' ? '' : 'none';
}
function toggleKanbanEtapa(header) {
  if (header.nextElementSibling) header.nextElementSibling.classList.toggle('open');
}
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

// ============================================================
// KANBAN v2 — 4 colunas fixas com sub-blocos personalizáveis
// ============================================================

const KANBAN_COLUNAS = [
  { id: 'afazer',      label: 'A Fazer',      cor: '#6B778C' },
  { id: 'progresso',   label: 'Em Progresso', cor: '#0052CC' },
  { id: 'concluido',   label: 'Concluído',    cor: '#36B37E' },
  { id: 'cancelado',   label: 'Cancelado',    cor: '#FF5630' },
];

// Coluna expandida no momento (id da coluna ou null)
let _kanbanExpanded = null;
// Drag state
let _kDragProcId = null;
let _kDragOrigemColuna = null;
let _kDragOrigemGrupo = null;

// ── Carregar/salvar configuração de grupos do Kanban ──────────

function kanbanGetGrupos() {
  try {
    // Tenta ler do _DB (carregado do Sheets via getAllData → kanbanGrupos)
    const raw = ls('kanbanGrupos');
    if (!raw) return _kanbanGruposPadrao();
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    // Garante que todas as colunas existem
    const grupos = parsed || {};
    KANBAN_COLUNAS.forEach(c => { if (!grupos[c.id]) grupos[c.id] = ['Geral']; });
    return grupos;
  } catch { return _kanbanGruposPadrao(); }
}

function _kanbanGruposPadrao() {
  const cfg = {};
  KANBAN_COLUNAS.forEach(c => { cfg[c.id] = ['Geral']; });
  return cfg;
}

function kanbanSalvarGrupos(cfg) {
  // Salva como string JSON — o Apps Script grava via gravarConfig('kanbanGrupos', ...)
  ls('kanbanGrupos', JSON.stringify(cfg));
}

// ── Ler/gravar coluna e grupo do processo ─────────────────────

function kanbanGetColuna(p) {
  return p.kanbanColuna || 'afazer';
}

function kanbanGetGrupo(p, colunaId) {
  return p.kanbanGrupo || 'Geral';
}

function kanbanMoverProcesso(procId, novaColuna, novoGrupo) {
  const processos = ls('processos') || [];
  const idx = processos.findIndex(p => p.id === procId);
  if (idx < 0) return;
  processos[idx].kanbanColuna = novaColuna;
  processos[idx].kanbanGrupo  = novoGrupo || 'Geral';
  ls('processos', processos);
  renderKanban();
}

// ── RENDERIZAÇÃO PRINCIPAL ────────────────────────────────────

function renderKanban() {
  const wrap = document.getElementById('kanban-view');
  if (!wrap) return;

  const processos = filtrarProcessos();
  const grupos    = kanbanGetGrupos();
  const isAdmin   = APP.currentUser?.perfil === 'admin';

  // Se há uma coluna expandida, ela ocupa metade; as outras ficam compactas
  const expanded = _kanbanExpanded;

  let html = `<div class="kanban-v2-board" style="display:flex;gap:12px;align-items:flex-start;min-height:500px">`;

  KANBAN_COLUNAS.forEach(col => {
    const isExp = expanded === col.id;
    const isHidden = expanded && !isExp;
    const colProcessos = processos.filter(p => kanbanGetColuna(p) === col.id);
    const colGrupos = grupos[col.id] || ['Geral'];

    const width = isExp ? '48%' : expanded ? '17%' : '24%';

    html += `
    <div class="kanban-v2-col" id="kv2col-${col.id}"
         data-coluna="${col.id}"
         style="width:${width};min-width:${isHidden?'120px':'200px'};
                flex-shrink:0;transition:width .3s;
                background:var(--bg2);border-radius:var(--radius2);
                border:1px solid var(--border);overflow:hidden">

      <!-- Cabeçalho da coluna -->
      <div style="background:${col.cor}18;border-bottom:3px solid ${col.cor};
                  padding:10px 12px;display:flex;align-items:center;gap:8px">
        <div style="width:8px;height:8px;border-radius:50%;background:${col.cor};flex-shrink:0"></div>
        <span style="font-weight:700;font-size:13px;color:var(--text);flex:1">${col.label}</span>
        <span style="font-size:11px;background:${col.cor}33;color:${col.cor};
                     padding:2px 7px;border-radius:10px;font-weight:600">${colProcessos.length}</span>
        <button onclick="kanbanToggleExpand('${col.id}')" title="${isExp?'Recolher':'Expandir'}"
                style="background:none;border:none;cursor:pointer;color:${col.cor};padding:2px;line-height:1">
          ${isExp
            ? `<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M5.5 0a.5.5 0 0 1 .5.5v4A1.5 1.5 0 0 1 4.5 6h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5zm5 0a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 10 4.5v-4a.5.5 0 0 1 .5-.5zM0 10.5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 6 11.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5zm10 1a1.5 1.5 0 0 1 1.5-1.5h4a.5.5 0 0 1 0 1h-4a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4z"/></svg>`
            : `<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M1.5 1h4a.5.5 0 0 1 0 1h-4a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4A1.5 1.5 0 0 1 1.5 1zm9 0a.5.5 0 0 1 0-1h4A1.5 1.5 0 0 1 16 1.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4zm-9 14a.5.5 0 0 1-.5-.5v-4a.5.5 0 0 1 1 0v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 1.5 15zm9.5-.5v-4a.5.5 0 0 1 1 0v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4a1.5 1.5 0 0 1-1.5-1.5z"/></svg>`}
        </button>
      </div>

      <!-- Corpo da coluna -->
      <div style="padding:${isHidden?'8px 4px':'10px'};display:flex;flex-direction:column;gap:8px;
                  max-height:calc(100vh - 200px);overflow-y:auto">`;

    if (isHidden) {
      // Coluna compacta: só conta
      html += `<div style="writing-mode:vertical-rl;text-align:center;color:var(--text3);
                            font-size:11px;padding:8px 0;cursor:pointer"
                    onclick="kanbanToggleExpand('${col.id}')">
                 ${colProcessos.length} processo${colProcessos.length!==1?'s':''}
               </div>`;
    } else {
      // Sub-blocos
      colGrupos.forEach(grupoNome => {
        const grupoProcs = colProcessos.filter(p => kanbanGetGrupo(p, col.id) === grupoNome);

        html += `
        <div class="kv2-grupo" data-coluna="${col.id}" data-grupo="${grupoNome}"
             style="background:var(--bg);border:1px solid var(--border);
                    border-radius:var(--radius);overflow:hidden">
          <!-- Cabeçalho do sub-bloco -->
          <div style="padding:6px 10px;display:flex;align-items:center;gap:6px;
                      background:var(--bg2);border-bottom:1px solid var(--border)">
            <span style="font-size:11px;font-weight:600;color:var(--text2);flex:1">${grupoNome}</span>
            <span style="font-size:10px;color:var(--text3)">${grupoProcs.length}</span>
            ${isAdmin ? `
              <button onclick="kanbanRenomearGrupo('${col.id}','${grupoNome.replace(/'/g,"\\'")}')"
                      title="Renomear" style="background:none;border:none;cursor:pointer;
                             color:var(--text3);padding:1px;line-height:1">✏️</button>
              <button onclick="kanbanExcluirGrupo('${col.id}','${grupoNome.replace(/'/g,"\\'")}')"
                      title="Excluir grupo" style="background:none;border:none;cursor:pointer;
                             color:var(--text3);padding:1px;line-height:1">🗑</button>` : ''}
          </div>
          <!-- Zona de drop do sub-bloco -->
          <div class="kv2-dropzone" data-coluna="${col.id}" data-grupo="${grupoNome}"
               style="padding:6px;min-height:48px;display:flex;flex-direction:column;gap:6px">`;

        grupoProcs.forEach(p => {
          const isMeuFav = euFavoritei(p);
          html += `
            <div class="kv2-card" draggable="true"
                 data-proc-id="${p.id}"
                 data-coluna="${col.id}"
                 data-grupo="${grupoNome}"
                 onclick="openDetalhe('${p.id}')"
                 style="background:var(--bg2);border:1px solid var(--border);
                        border-radius:var(--radius);padding:8px 10px;cursor:grab;
                        border-left:3px solid ${col.cor}">
              <div style="font-size:12px;font-weight:500;color:var(--text);margin-bottom:4px">
                ${p.nome}${isMeuFav?' ⭐':''}
              </div>
              <div style="display:flex;gap:4px;flex-wrap:wrap">
                <span class="badge ${tipoBadge(p.tipo)}" style="font-size:10px">${p.tipo||'-'}</span>
                <span style="font-size:10px;color:var(--text3)">${p.oss||''}</span>
              </div>
              ${p.kanbanGrupo && p.kanbanGrupo !== 'Geral'
                ? `<div style="font-size:10px;color:${col.cor};margin-top:3px">📌 ${p.kanbanGrupo}</div>`
                : ''}
            </div>`;
        });

        html += `</div></div>`; // fecha dropzone e grupo
      });

      // Botão adicionar grupo (só admin, só na coluna expandida ou sempre)
      if (isAdmin) {
        html += `
        <button onclick="kanbanAdicionarGrupo('${col.id}')"
                style="background:none;border:1px dashed var(--border2);border-radius:var(--radius);
                       padding:8px;font-size:11px;color:var(--text3);cursor:pointer;
                       width:100%;text-align:center;transition:all .2s"
                onmouseover="this.style.borderColor='${col.cor}';this.style.color='${col.cor}'"
                onmouseout="this.style.borderColor='var(--border2)';this.style.color='var(--text3)'">
          + Adicionar grupo
        </button>`;
      }

      // Zona de drop da coluna (para processos sem grupo ou ao soltar fora de um grupo)
      html += `<div class="kv2-col-dropzone" data-coluna="${col.id}" data-grupo="Geral"
                    style="min-height:20px"></div>`;
    }

    html += `</div></div>`; // fecha body e coluna
  });

  html += `</div>`;
  wrap.innerHTML = html;

  // Ativa drag & drop
  _ativarKanbanDragDrop();
}

// ── Expandir/recolher coluna ──────────────────────────────────

function kanbanToggleExpand(colunaId) {
  _kanbanExpanded = _kanbanExpanded === colunaId ? null : colunaId;
  renderKanban();
}

// ── Drag & Drop ───────────────────────────────────────────────

function _ativarKanbanDragDrop() {
  // Cards arrastáveis
  document.querySelectorAll('.kv2-card').forEach(card => {
    card.addEventListener('dragstart', e => {
      _kDragProcId       = card.dataset.procId;
      _kDragOrigemColuna = card.dataset.coluna;
      _kDragOrigemGrupo  = card.dataset.grupo;
      card.style.opacity = '.4';
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => {
      card.style.opacity = '';
      document.querySelectorAll('.kv2-dropzone.drag-over, .kv2-col-dropzone.drag-over')
        .forEach(z => z.classList.remove('drag-over'));
    });
  });

  // Zonas de soltura (sub-blocos e coluna)
  document.querySelectorAll('.kv2-dropzone, .kv2-col-dropzone').forEach(zone => {
    zone.addEventListener('dragover', e => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      if (!_kDragProcId) return;
      const destColuna = zone.dataset.coluna;
      const destGrupo  = zone.dataset.grupo || 'Geral';
      if (destColuna === _kDragOrigemColuna && destGrupo === _kDragOrigemGrupo) return;
      kanbanMoverProcesso(_kDragProcId, destColuna, destGrupo);
      _kDragProcId = null;
    });
  });
}

// ── Gerenciar grupos (sub-blocos) ─────────────────────────────

function kanbanAdicionarGrupo(colunaId) {
  const nome = prompt('Nome do novo grupo:');
  if (!nome?.trim()) return;
  const grupos = kanbanGetGrupos();
  if (!grupos[colunaId]) grupos[colunaId] = ['Geral'];
  if (grupos[colunaId].includes(nome.trim())) {
    showToast('Já existe um grupo com esse nome.'); return;
  }
  grupos[colunaId].push(nome.trim());
  kanbanSalvarGrupos(grupos);
  renderKanban();
  showToast(`Grupo "${nome.trim()}" criado!`);
}

function kanbanRenomearGrupo(colunaId, nomeAtual) {
  const novoNome = prompt('Novo nome para o grupo:', nomeAtual);
  if (!novoNome?.trim() || novoNome.trim() === nomeAtual) return;
  const grupos = kanbanGetGrupos();
  const idx = grupos[colunaId]?.indexOf(nomeAtual);
  if (idx < 0) return;
  grupos[colunaId][idx] = novoNome.trim();
  kanbanSalvarGrupos(grupos);
  // Atualiza processos que estavam nesse grupo
  const processos = ls('processos') || [];
  let mudou = false;
  processos.forEach(p => {
    if (p.kanbanColuna === colunaId && p.kanbanGrupo === nomeAtual) {
      p.kanbanGrupo = novoNome.trim();
      mudou = true;
    }
  });
  if (mudou) ls('processos', processos);
  renderKanban();
  showToast(`Grupo renomeado para "${novoNome.trim()}"`);
}

function kanbanExcluirGrupo(colunaId, nomeGrupo) {
  if (nomeGrupo === 'Geral') { showToast('O grupo "Geral" não pode ser excluído.'); return; }
  if (!confirm(`Excluir o grupo "${nomeGrupo}"?\n\nOs processos dentro dele serão movidos para "Geral".`)) return;
  const grupos = kanbanGetGrupos();
  grupos[colunaId] = grupos[colunaId].filter(g => g !== nomeGrupo);
  if (!grupos[colunaId].length) grupos[colunaId] = ['Geral'];
  kanbanSalvarGrupos(grupos);
  // Move processos órfãos para Geral
  const processos = ls('processos') || [];
  let mudou = false;
  processos.forEach(p => {
    if (p.kanbanColuna === colunaId && p.kanbanGrupo === nomeGrupo) {
      p.kanbanGrupo = 'Geral';
      mudou = true;
    }
  });
  if (mudou) ls('processos', processos);
  renderKanban();
  showToast(`Grupo "${nomeGrupo}" excluído. Processos movidos para "Geral".`);
}
