// ============================================================
// GTTRCG — sidebar.js
// Responsabilidades:
//   - Atualizar contagens do painel lateral
//   - Favoritos independentes por usuário (favoritosPorUser)
//   - Filtros de status, tipo, favoritos
//   - Item "Ag. Assinatura" dinâmico
// ============================================================

// ============================================================
// HELPER DE FAVORITOS
// ============================================================

/**
 * Verifica se o usuário ATUAL favoritou o processo p.
 * Suporta estrutura nova (favoritosPorUser) e legada (favorito+favoritoUser).
 */
function euFavoritei(p) {
  const login = APP.currentUser?.login;
  if (!login) return false;
  if (p.favoritosPorUser) return !!p.favoritosPorUser[login];
  return p.favorito && p.favoritoUser === login;
}

/**
 * Alterna favorito do processo para o usuário atual.
 * Mantém campo legado sincronizado para compatibilidade.
 */
function toggleFavorito(id) {
  const processos = ls('processos') || [];
  const idx = processos.findIndex(p => p.id === id);
  if (idx < 0) return;

  const login = APP.currentUser?.login;
  if (!login) return;

  // Garante estrutura nova
  if (!processos[idx].favoritosPorUser) {
    processos[idx].favoritosPorUser = {};
    // Migra estrutura legada
    if (processos[idx].favorito && processos[idx].favoritoUser) {
      processos[idx].favoritosPorUser[processos[idx].favoritoUser] = true;
    }
  }

  const era = !!processos[idx].favoritosPorUser[login];
  processos[idx].favoritosPorUser[login] = !era;

  // Atualiza campos legados
  processos[idx].favorito     = !era;
  processos[idx].favoritoUser = login;

  // Registra no undo
  const snapshot = JSON.parse(JSON.stringify(processos[idx]));
  UndoStack.push({
    label: `${era ? 'Remover' : 'Adicionar'} favorito "${processos[idx].nome}"`,
    undo() {
      const procs = ls('processos') || [];
      const i = procs.findIndex(x => x.id === id);
      if (i >= 0) { procs[i] = snapshot; ls('processos', procs); }
      renderMonitoramento();
      updateSidebarCounts();
    },
  });

  ls('processos', processos);
  renderMonitoramento();
  if (typeof monitorView !== 'undefined' && monitorView === 'kanban') renderKanban();
  updateSidebarCounts();
}

// ============================================================
// CONTAGENS DO PAINEL LATERAL
// ============================================================

function updateSidebarCounts() {
  const processos = ls('processos') || [];
  const login = APP.currentUser?.login;

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  // Contagens de processos
  set('sidebar-total',     processos.length);
  set('sidebar-andamento', processos.filter(p =>
    p.status && !['Aguardando Início do Processo','Contratação Concluída'].includes(p.status)
  ).length);
  set('sidebar-remetido', processos.filter(p =>
    p.status?.toLowerCase().includes('remetido')
  ).length);
  set('sidebar-aguardando', processos.filter(p =>
    p.status?.toLowerCase().includes('aguardando')
  ).length);
  set('sidebar-assinatura', processos.filter(p =>
    p.status?.toLowerCase().includes('assinatura')
  ).length);

  // Favoritos apenas do usuário atual
  set('sidebar-favoritos', processos.filter(p => euFavoritei(p)).length);

  // Alertas
  const alertas = typeof gerarAlertas === 'function' ? gerarAlertas() : [];
  set('sidebar-alertas', alertas.length);

  // Badge do nav "Alertas"
  const badge   = document.getElementById('alertas-count');
  const urgentes = alertas.filter(a => a.nivel === 'urgente').length;
  if (badge) {
    if (urgentes > 0) {
      badge.style.display = 'inline-flex';
      badge.textContent = urgentes;
    } else {
      badge.style.display = 'none';
    }
  }
}

// ============================================================
// FILTROS DA SIDEBAR
// ============================================================

function filterSidebarFavoritos() {
  APP.sidebarFilter = { type: 'favorito_mapa' };
  highlightSidebarItem('filterSidebarFavoritos');
  showPage('monitoramento');
}

function filterSidebarStatus(status) {
  APP.sidebarFilter = { type: 'status', value: status };
  highlightSidebarItem(`filterSidebarStatus('${status}')`);
  showPage('monitoramento');
}

function filterSidebarTipo(tipo) {
  APP.sidebarFilter = { type: 'tipo', value: tipo };
  highlightSidebarItem(`filterSidebarTipo('${tipo}')`);
  showPage('monitoramento');
}

function limparFiltrosSidebar() {
  APP.sidebarFilter = null;
  document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
}

function highlightSidebarItem(onclickFragment) {
  document.querySelectorAll('.sidebar-item').forEach(el => {
    el.classList.remove('active');
    if ((el.getAttribute('onclick') || '').includes(onclickFragment)) {
      el.classList.add('active');
    }
  });
}

// ============================================================
// INICIALIZAÇÃO DA SIDEBAR
// ============================================================

/**
 * Lê a lista de tipos que o admin marcou para aparecer na sidebar.
 * Guardada na chave de config `tiposNaSidebar` (array de strings).
 * Se nunca foi configurada, devolve null — indicando "todos".
 */
function getTiposNaSidebar() {
  let raw = ls('tiposNaSidebar');
  if (raw === null || raw === undefined || raw === '') return null;
  try {
    if (typeof raw === 'string') raw = JSON.parse(raw);
    if (typeof raw === 'string') raw = JSON.parse(raw);
  } catch { return null; }
  return Array.isArray(raw) ? raw : null;
}

/**
 * Injeta os itens de tipo de unidade na sidebar.
 * - Exibe apenas os tipos marcados pelo admin em Configurações
 * - Usa a grafia EXATA cadastrada em Tipos de Unidade
 * - Respeita a ordem em que estão cadastrados
 */
function initSidebarUnidades() {
  const container = document.getElementById('sidebar-tipos-list');
  const section   = document.getElementById('sidebar-unidades-section');
  if (!container || !section) return;

  const todosTipos = ls('tiposUnidade') || [];
  const marcados   = getTiposNaSidebar();

  // Mantém a ordem do cadastro; se nada foi configurado ainda, mostra todos
  const tipos = marcados === null
    ? todosTipos
    : todosTipos.filter(t => marcados.includes(t));

  // Esconde o cabeçalho "Unidades" quando não há nenhum tipo para mostrar
  section.style.display = tipos.length ? '' : 'none';

  const icon = `<svg width="14" height="14" viewBox="0 0 100 100" fill="currentColor">
    <rect x="43" y="5" width="14" height="90" rx="7"/>
    <rect x="43" y="5" width="14" height="90" rx="7" transform="rotate(60 50 50)"/>
    <rect x="43" y="5" width="14" height="90" rx="7" transform="rotate(120 50 50)"/>
    <circle cx="50" cy="50" r="10"/>
  </svg>`;

  container.innerHTML = tipos.map(tipo => {
    const esc = String(tipo).replace(/'/g, "\\'");
    return `<div class="sidebar-item" onclick="filterSidebarTipo('${esc}')">${icon} ${tipo}</div>`;
  }).join('');
}

// Inicia após DOM pronto — chamado pelo app.js após boot
setTimeout(initSidebarUnidades, 200);

console.log('[GTTRCG] sidebar.js carregado ✓');
