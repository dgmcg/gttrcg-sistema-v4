// ============================================================
// modais.js — Gestão de Modais e Formulários
// ============================================================

// ── Rastreio de alterações não salvas (todos os formulários) ───
// Ao abrir um modal rastreado, guardamos um "retrato" do estado dos
// seus campos. Ao fechar, comparamos com o estado atual: se mudou algo
// que ainda não foi salvo, perguntamos antes de descartar.
//
// Para incluir um novo formulário na proteção, basta registrá-lo em
// MODAIS_RASTREADOS — nenhuma outra alteração é necessária.
const MODAIS_RASTREADOS = {
  'modal-detalhe': {
    captor: () => _capturarEstadoCamposDetalhe(),
    aviso: 'Você tem alterações não salvas neste processo.\n\nDeseja realmente sair sem salvar o acompanhamento?',
  },
  'modal-processo': {
    captor: () => _capturarEstadoGenerico('modal-processo'),
    aviso: 'Você tem alterações não salvas neste processo.\n\nDeseja realmente sair sem salvar?',
  },
  'modal-etapa-fluxo': {
    captor: () => _capturarEstadoGenerico('modal-etapa-fluxo'),
    aviso: 'Você tem alterações não salvas nesta etapa.\n\nDeseja realmente sair sem salvar?',
  },
  'modal-dado-fixo': {
    captor: () => _capturarEstadoGenerico('modal-dado-fixo'),
    aviso: 'Você tem alterações não salvas neste cadastro.\n\nDeseja realmente sair sem salvar?',
  },
  'modal-usuario': {
    captor: () => _capturarEstadoGenerico('modal-usuario'),
    aviso: 'Você tem alterações não salvas neste usuário.\n\nDeseja realmente sair sem salvar?',
  },
};

// Retratos por modal: { 'modal-processo': {...}, ... }
const _snapshotsModais = {};

/**
 * Captor padrão: varre todos os campos de formulário dentro do modal.
 * Botões, arquivos e elementos marcados com data-sem-rastreio ficam fora.
 * A chave prioriza o id; na falta dele, usa a posição no DOM — o que
 * também faz com que adicionar, remover ou reordenar campos (por
 * exemplo na lista de campos de uma etapa) conte como alteração.
 */
function _capturarEstadoGenerico(modalId) {
  const estado = {};
  const modal = document.getElementById(modalId);
  if (!modal) return estado;
  const seletor = 'input:not([type=button]):not([type=submit]):not([type=reset]):not([type=file]), select, textarea';
  modal.querySelectorAll(seletor).forEach((el, i) => {
    if (el.closest('[data-sem-rastreio]')) return;
    const key = el.id || el.name || `pos_${i}`;
    estado[key] = (el.type === 'checkbox' || el.type === 'radio') ? String(el.checked) : el.value;
  });
  return estado;
}

/** Tira o retrato inicial de um modal rastreado. */
function _iniciarRastreioModal(modalId) {
  const cfg = MODAIS_RASTREADOS[modalId];
  if (!cfg) return;
  _snapshotsModais[modalId] = cfg.captor();
}

/** Descarta o retrato — o modal deixa de ter alterações pendentes. */
function _resetRastreioModal(modalId) {
  delete _snapshotsModais[modalId];
}

/** true se o modal está rastreado e algum campo mudou desde a abertura. */
function modalTemAlteracoes(modalId) {
  const cfg = MODAIS_RASTREADOS[modalId];
  const inicial = _snapshotsModais[modalId];
  if (!cfg || !inicial) return false;
  const atual = cfg.captor();
  const chaves = new Set([...Object.keys(inicial), ...Object.keys(atual)]);
  for (const k of chaves) {
    if ((inicial[k] ?? '') !== (atual[k] ?? '')) return true;
  }
  return false;
}

/**
 * Captor do modal de acompanhamento. Diferente do genérico: olha apenas
 * os campos das etapas (data-etapa) mais status/fase, ignorando de
 * propósito os checkboxes Iniciada/Concluída/N-A, que já gravam sozinhos
 * e apareceriam como alteração pendente sem serem.
 */
function _capturarEstadoCamposDetalhe() {
  const estado = {};
  document.querySelectorAll('#detalhe-body [data-etapa]').forEach(el => {
    const key = el.id || `${el.dataset.etapa}_${el.dataset.campo}`;
    estado[key] = el.type === 'checkbox' ? el.checked : el.value;
  });
  // Também rastreia status/fase do processo, editáveis no topo do modal
  const statusEl = document.getElementById('detalhe-status');
  const faseEl = document.getElementById('detalhe-fase');
  if (statusEl) estado['_status'] = statusEl.value;
  if (faseEl) estado['_fase'] = faseEl.value;
  return estado;
}

// Nomes antigos mantidos para não quebrar as chamadas já existentes
function _iniciarRastreioAlteracoes() { _iniciarRastreioModal('modal-detalhe'); }
function _resetRastreioAlteracoes()   { _resetRastreioModal('modal-detalhe'); }
function _detalheTemAlteracoes()      { return modalTemAlteracoes('modal-detalhe'); }

// ── Abrir / fechar ────────────────────────────────────────────
/**
 * openModal(id) — abre o modal e, se ele for rastreado, tira o retrato
 * inicial dos campos. O pequeno atraso garante que rotinas que populam
 * selects logo após a abertura já tenham rodado, evitando falso positivo.
 */
function openModal(id) {
  document.getElementById(id)?.classList.add('open');
  if (MODAIS_RASTREADOS[id]) {
    _resetRastreioModal(id);
    setTimeout(() => _iniciarRastreioModal(id), 80);
  }
}

/**
 * closeModal(id) — fecha o modal, exceto quando há alterações pendentes
 * em um formulário rastreado: nesse caso, pergunta antes de descartar.
 */
function closeModal(id) {
  if (modalTemAlteracoes(id)) {
    if (!confirm(MODAIS_RASTREADOS[id].aviso)) return;
  }
  closeModalForcado(id);
}

/** Força o fechamento sem perguntar — usado após salvar com sucesso. */
function closeModalForcado(id) {
  document.getElementById(id)?.classList.remove('open');
  _resetRastreioModal(id);
}

// Aviso nativo do navegador ao tentar fechar a aba/recarregar com
// alterações pendentes em qualquer formulário rastreado aberto.
window.addEventListener('beforeunload', e => {
  const pendente = Object.keys(MODAIS_RASTREADOS).some(id =>
    document.getElementById(id)?.classList.contains('open') && modalTemAlteracoes(id)
  );
  if (pendente) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// ── Fechar modal ao clicar fora / ESC ─────────────────────────
document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const aberto = document.querySelector('.modal-overlay.open');
    if (aberto) closeModal(aberto.id);
  }
});

// ── MODAL PROCESSO: Novo/Editar ───────────────────────────────
// Popula o select de subgrupos do Kanban conforme a coluna selecionada
function _popularSubgruposKanban(colunaId, valorAtual) {
  const sel = document.getElementById('proc-kanban-grupo');
  if (!sel) return;
  let grupos = {};
  try {
    let raw = ls('kanbanGrupos');
    if (raw) {
      if (typeof raw === 'string') raw = JSON.parse(raw);
      if (typeof raw === 'string') raw = JSON.parse(raw);
      grupos = raw || {};
    }
  } catch {}
  const lista = grupos[colunaId] || ['Geral'];
  sel.innerHTML = '<option value="">— Nenhum (Geral) —</option>' +
    lista.filter(g => g !== 'Geral').map(g =>
      `<option value="${g}" ${g === valorAtual ? 'selected' : ''}>${g}</option>`
    ).join('');
}

function populateModalSelects() {
  const unidades = ls('unidades') || [];
  const oss = ls('oss') || [];
  const setores = ls('setores') || [];
  const pessoas = ls('pessoas') || [];
  const statuses = ls('statusProcesso') || [];
  const fases = ls('fases') || [];
  const tiposProc = ls('tiposProcesso') || ['Regular', 'Dispensa de Seleção', 'Emergencial'];
  const scList = ls('statusContrato') || ['Vigente', 'Expirado', 'Nova Unidade'];
  const tiposUn = ls('tiposUnidade') || [];

  // Unidades (usando schema para encontrar campo nome/sigla)
  const schema = ls('schema_unidades') || [];
  const nomeField = (schema.find(f => f.key === 'nome') || schema.find(f => f.protegido) || schema[0])?.key || 'nome';
  const siglaField = schema.find(f => f.key === 'sigla')?.key || 'sigla';
  const el = document.getElementById('proc-unidade');
  if (el) el.innerHTML = '<option value="">Selecionar...</option>' +
    unidades.filter(u => u[nomeField]).map(u => {
      const label = [u[siglaField], u[nomeField]].filter(Boolean).join(' — ');
      return `<option value="${u[nomeField]}">${label}</option>`;
    }).join('');

  // Datalists
  const listTipos = document.getElementById('list-tipos');
  if (listTipos) listTipos.innerHTML = tiposUn.map(t => `<option value="${t}">`).join('');
  const listOss = document.getElementById('list-oss');
  if (listOss) listOss.innerHTML = oss.map(o => `<option value="${o.sigla || o.nome}">`).join('');
  const listSetores = document.getElementById('list-setores');
  if (listSetores) listSetores.innerHTML = setores.map(s => `<option value="${s}">`).join('');
  const listPessoas = document.getElementById('list-pessoas');
  if (listPessoas) listPessoas.innerHTML = pessoas.map(p => `<option value="${p}">`).join('');

  // Selects do formulário
  const procStatus = document.getElementById('proc-status');
  if (procStatus) procStatus.innerHTML = '<option value="">Selecionar...</option>' + statuses.map(s => `<option>${s}</option>`).join('');
  const procFase = document.getElementById('proc-fase');
  if (procFase) procFase.innerHTML = '<option value="">Selecionar...</option>' + fases.map(f => `<option>${f}</option>`).join('');
  const procTipoProc = document.getElementById('proc-tipo-processo');
  if (procTipoProc) procTipoProc.innerHTML = '<option value="">Selecionar...</option>' + tiposProc.map(t => `<option>${t}</option>`).join('');
  const procScTop = document.getElementById('proc-status-cg-top');
  if (procScTop) procScTop.innerHTML = '<option value="">Selecionar...</option>' + scList.map(s => `<option>${s}</option>`).join('');
  const procSc = document.getElementById('proc-status-cg');
  if (procSc) procSc.innerHTML = '<option value="">-</option>' + scList.map(s => `<option>${s}</option>`).join('');

  // Responsável GTTRCG → select de usuários
  const respContainer = document.getElementById('proc-responsavel-container');
  if (respContainer) {
    const usuarios = typeof getUsuariosAtribuicao === 'function' ? getUsuariosAtribuicao() : (ls('usuarios') || []).filter(u => u.login !== 'admin');
    respContainer.innerHTML = '<select id="proc-responsavel" class="w-full">' +
      '<option value="">— Selecionar responsável —</option>' +
      usuarios.map(u => `<option value="${u.login}">${u.nome || u.login}</option>`).join('') + '</select>';
  }
}

function openNovoProcesso() {
  APP.currentProcessoId = null;
  document.getElementById('modal-processo-title').textContent = 'Novo Processo';
  document.getElementById('proc-id').value = '';
  ['proc-tipo', 'proc-oss', 'proc-cg', 'proc-sei', 'proc-macro', 'proc-regiao', 'proc-municipio', 'proc-porte', 'proc-area-nt', 'proc-obs', 'proc-vig-inicio', 'proc-vig-fim', 'proc-previsao'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('proc-inicio').value = new Date().toISOString().split('T')[0];
  populateModalSelects();
  // Kanban: padrão "A Fazer", sem subgrupo
  const kanbanColEl = document.getElementById('proc-kanban-coluna');
  if (kanbanColEl) {
    kanbanColEl.value = 'afazer';
    kanbanColEl.onchange = () => _popularSubgruposKanban(kanbanColEl.value, '');
    _popularSubgruposKanban('afazer', '');
  }
  setTimeout(() => {
    const statusEl = document.getElementById('proc-status');
    if (statusEl) {
      const opts = Array.from(statusEl.options).map(o => o.value);
      const padrao = opts.find(o => o.toLowerCase().includes('aguardando início')) || opts[0] || '';
      if (padrao) statusEl.value = padrao;
    }
    const faseEl = document.getElementById('proc-fase');
    if (faseEl) {
      const fases = ls('fases') || [];
      const fp = fases.find(f => f.toLowerCase().includes('aguardando')) || fases[0] || '';
      if (fp) faseEl.value = fp;
    }
  }, 100);
  openModal('modal-processo');
}

function openEditarProcesso(id) {
  const processos = ls('processos') || [];
  const p = processos.find(x => x.id === id);
  if (!p) return;
  APP.currentProcessoId = id;
  document.getElementById('modal-processo-title').textContent = 'Editar Processo';
  document.getElementById('proc-id').value = id;
  populateModalSelects();
  setTimeout(() => {
    document.getElementById('proc-unidade').value = p.nome || '';
    document.getElementById('proc-tipo').value = p.tipo || '';
    document.getElementById('proc-oss').value = p.oss || '';
    document.getElementById('proc-cg').value = p.cg || '';
    document.getElementById('proc-sei').value = p.sei || '';
    document.getElementById('proc-macro').value = p.macro || '';
    document.getElementById('proc-regiao').value = p.regiao || '';
    document.getElementById('proc-municipio').value = p.municipio || '';
    document.getElementById('proc-porte').value = p.porte || '';
    document.getElementById('proc-area-nt').value = p.areaNT || '';
    document.getElementById('proc-inicio').value = p.inicio || '';
    document.getElementById('proc-previsao').value = p.previsao || '';
    document.getElementById('proc-status').value = p.status || '';
    document.getElementById('proc-fase').value = p.fase || '';
    document.getElementById('proc-tipo-processo').value = p.tipoProcesso || '';
    document.getElementById('proc-vig-inicio').value = p.vigInicio || '';
    document.getElementById('proc-vig-fim').value = p.vigFim || '';
    document.getElementById('proc-obs').value = p.obs || '';
    const kanbanColEditEl = document.getElementById('proc-kanban-coluna');
    if (kanbanColEditEl) {
      kanbanColEditEl.value = p.kanbanColuna || 'afazer';
      kanbanColEditEl.onchange = () => _popularSubgruposKanban(kanbanColEditEl.value, '');
      _popularSubgruposKanban(p.kanbanColuna || 'afazer', p.kanbanGrupo || '');
    }
    const scTop = document.getElementById('proc-status-cg-top');
    if (scTop) scTop.value = p.statusCG || '';
    const sc = document.getElementById('proc-status-cg');
    if (sc) sc.value = p.statusCG || '';
    setTimeout(() => {
      const respEl = document.getElementById('proc-responsavel');
      if (respEl) respEl.value = p.responsavel || '';
    }, 50);
  }, 50);
  openModal('modal-processo');
}

function autoFillUnidade() {
  const nome = document.getElementById('proc-unidade').value;
  if (!nome) return;
  const unidades = ls('unidades') || [];
  const u = unidades.find(x => x.nome === nome || x.sigla === nome);
  if (!u) return;
  const fieldMap = {
    tipo: 'proc-tipo', cg: 'proc-cg', macro: 'proc-macro', regiao: 'proc-regiao',
    cidade: 'proc-municipio', cgInicio: 'proc-vig-inicio', cgFim: 'proc-vig-fim',
    ossGestora: 'proc-oss', porte: 'proc-porte',
  };
  Object.entries(fieldMap).forEach(([uField, formId]) => {
    const el = document.getElementById(formId);
    if (el && u[uField]) el.value = u[uField];
  });
  if (u.statusCG) {
    const scTop = document.getElementById('proc-status-cg-top');
    const sc = document.getElementById('proc-status-cg');
    if (scTop) scTop.value = u.statusCG;
    if (sc) sc.value = u.statusCG;
  } else if (u.cgFim) {
    const dias = Math.ceil((new Date(u.cgFim + 'T12:00:00') - new Date()) / 86400000);
    const val = dias < 0 ? 'Expirado' : 'Vigente';
    const scTop = document.getElementById('proc-status-cg-top');
    const sc = document.getElementById('proc-status-cg');
    if (scTop) scTop.value = val;
    if (sc) sc.value = val;
  }
  showToast('Dados da unidade preenchidos automaticamente ✓');
}

function salvarProcesso() {
  const nome = document.getElementById('proc-unidade').value;
  if (!nome) { alert('Selecione uma unidade!'); return; }
  const processos = ls('processos') || [];
  const id = document.getElementById('proc-id').value || genId();
  const idx = processos.findIndex(p => p.id === id);
  const obj = {
    id, nome,
    favorito: idx >= 0 ? (processos[idx].favorito || false) : false,
    favoritoUser: idx >= 0 ? (processos[idx].favoritoUser || null) : null,
    favoritosPorUser: idx >= 0 ? (processos[idx].favoritosPorUser || {}) : {},
    tipo: document.getElementById('proc-tipo').value,
    oss: document.getElementById('proc-oss').value,
    cg: document.getElementById('proc-cg').value,
    sei: document.getElementById('proc-sei').value,
    tipoProcesso: document.getElementById('proc-tipo-processo').value,
    macro: document.getElementById('proc-macro').value,
    regiao: document.getElementById('proc-regiao').value,
    municipio: document.getElementById('proc-municipio').value,
    porte: document.getElementById('proc-porte').value,
    areaNT: document.getElementById('proc-area-nt').value,
    responsavel: document.getElementById('proc-responsavel')?.value || '',
    inicio: document.getElementById('proc-inicio').value,
    previsao: document.getElementById('proc-previsao').value,
    status: document.getElementById('proc-status').value,
    fase: document.getElementById('proc-fase').value,
    obs: document.getElementById('proc-obs').value,
    kanbanColuna: document.getElementById('proc-kanban-coluna')?.value || 'afazer',
    kanbanGrupo: document.getElementById('proc-kanban-grupo')?.value || '',
    vigInicio: document.getElementById('proc-vig-inicio').value,
    vigFim: document.getElementById('proc-vig-fim').value,
    statusCG: document.getElementById('proc-status-cg-top')?.value || document.getElementById('proc-status-cg')?.value || '',
    progresso: idx >= 0 ? (processos[idx].progresso || 0) : 0,
    acompanhamento: idx >= 0 ? (processos[idx].acompanhamento || {}) : {},
  };
  if (idx >= 0) processos[idx] = obj; else processos.push(obj);
  ls('processos', processos);
  closeModalForcado('modal-processo');
  renderMonitoramento();
  renderDashboard();
  updateSidebarCounts();
  showToast('Processo salvo!');
}

// ── MODAL ETAPA FLUXO ─────────────────────────────────────────

// Coleções de dados fixos disponíveis como "lista fonte" para campos tipo listafixo
const LISTAS_FIXAS_DISPONIVEIS = [
  { key: 'setores',        label: 'Setores / Órgãos' },
  { key: 'pessoas',        label: 'Pessoas' },
  { key: 'unidades',       label: 'Unidades de Saúde' },
  { key: 'oss',            label: 'Organizações Sociais (OSS)' },
  { key: 'statusProcesso', label: 'Status de Processo' },
  { key: 'fases',          label: 'Fases do Processo' },
  { key: 'tiposProcesso',  label: 'Tipos de Processo' },
  { key: 'statusContrato', label: 'Status do Contrato' },
  { key: 'tiposUnidade',   label: 'Tipos de Unidade' },
];

const TIPOS_CAMPO_ETAPA = [
  { value: 'text',      label: 'Texto' },
  { value: 'boolean',   label: 'Sim / Não / N/A' },
  { value: 'date',      label: 'Data' },
  { value: 'moeda',     label: 'Valor (R$)' },
  { value: 'listafixo',  label: 'Lista Fixa (dados fixos)' },
  { value: 'listamulti', label: 'Lista Fixa (múltipla escolha)' },
  { value: 'pdf',       label: 'Anexo de Documento' },
];

// Estado em memória dos campos sendo editados no modal (array de {tipo,label,listaFonte})
let _camposEtapaEdit = [];

function openAdicionarEtapa() {
  APP.editingEtapaId = null;
  document.getElementById('modal-etapa-fluxo-title').textContent = 'Nova Etapa';
  document.getElementById('etapa-id-edit').value = '';
  ['etapa-nome-edit', 'etapa-resp-edit', 'etapa-acao-edit'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('etapa-fase-edit').value = 'planejamento';
  _populateSubfaseSelect('');
  _camposEtapaEdit = [];
  renderListaCamposEtapa();
  _sugerirProximaPosicao('planejamento');
  document.getElementById('btn-excluir-etapa').style.display = 'none';
  openModal('modal-etapa-fluxo');
}

// Sugere a próxima posição livre (última + 1) da fase selecionada.
// Atualizado automaticamente quando o admin troca a fase no select.
function _sugerirProximaPosicao(faseKey) {
  const ordemEl = document.getElementById('etapa-ordem-edit');
  if (!ordemEl) return;
  const etapas = ls('etapasFluxo') || [];
  const doGrupo = etapas.filter(e => e.fase === faseKey);
  ordemEl.value = doGrupo.length + 1;
  ordemEl.max = doGrupo.length + 1;
}

function editarEtapaFluxo(id) {
  const etapas = ls('etapasFluxo') || [];
  const e = etapas.find(x => x.id === id);
  if (!e) return;
  APP.editingEtapaId = id;
  document.getElementById('modal-etapa-fluxo-title').textContent = 'Editar Etapa';
  document.getElementById('etapa-id-edit').value = id;
  document.getElementById('etapa-nome-edit').value = e.nome || '';
  document.getElementById('etapa-fase-edit').value = e.fase || 'planejamento';
  document.getElementById('etapa-resp-edit').value = e.responsavel || '';
  document.getElementById('etapa-ordem-edit').value = e.ordem || '';
  document.getElementById('etapa-acao-edit').value = e.acao || '';
  _populateSubfaseSelect(e.subfase || '');
  // Clona os campos da etapa para o estado de edição
  _camposEtapaEdit = (e.campos || []).map(c => ({ ...c }));
  renderListaCamposEtapa();
  document.getElementById('btn-excluir-etapa').style.display = 'inline-flex';
  openModal('modal-etapa-fluxo');
}

// ── Editor visual de campos ────────────────────────────────────

function renderListaCamposEtapa() {
  const container = document.getElementById('etapa-campos-lista');
  if (!container) return;

  if (_camposEtapaEdit.length === 0) {
    container.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:10px;text-align:center;background:var(--bg2);border-radius:var(--radius);border:1px dashed var(--border2)">Nenhum campo adicionado ainda. Clique em "Adicionar Campo" abaixo.</div>';
    return;
  }

  container.innerHTML = _camposEtapaEdit.map((campo, i) => {
    const isLista = campo.tipo === 'listafixo' || campo.tipo === 'listamulti';
    const listaOpts = LISTAS_FIXAS_DISPONIVEIS.map(l =>
      `<option value="${l.key}" ${campo.listaFonte === l.key ? 'selected' : ''}>${l.label}</option>`
    ).join('');
    const tipoOpts = TIPOS_CAMPO_ETAPA.map(t =>
      `<option value="${t.value}" ${campo.tipo === t.value ? 'selected' : ''}>${t.label}</option>`
    ).join('');

    return `
      <div class="schema-field-row campo-etapa-row" draggable="false" data-idx="${i}" style="flex-wrap:wrap">
        <div class="schema-drag-handle" title="Arraste para reordenar (posição ${i + 1})">⠿</div>
        <input type="text" value="${(campo.label || '').replace(/"/g, '&quot;')}"
               placeholder="Rótulo do campo (ex: Solicitado?)"
               oninput="atualizarCampoEtapa(${i}, 'label', this.value)"
               style="flex:1;min-width:160px">
        <select onchange="atualizarCampoEtapa(${i}, 'tipo', this.value)" style="width:170px">
          ${tipoOpts}
        </select>
        ${isLista ? `
          <select onchange="atualizarCampoEtapa(${i}, 'listaFonte', this.value)" style="width:190px">
            <option value="">— Selecionar lista —</option>
            ${listaOpts}
          </select>` : ''}
        <div style="display:flex;gap:2px">
          <button type="button" class="btn sm icon" title="Mover para cima" onclick="moverCampoEtapa(${i}, -1)" ${i === 0 ? 'disabled style="opacity:.3"' : ''}>
            <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M7.646 4.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1-.708.708L8 5.707l-5.646 5.647a.5.5 0 0 1-.708-.708l6-6z"/></svg>
          </button>
          <button type="button" class="btn sm icon" title="Mover para baixo" onclick="moverCampoEtapa(${i}, 1)" ${i === _camposEtapaEdit.length - 1 ? 'disabled style="opacity:.3"' : ''}>
            <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/></svg>
          </button>
          <button type="button" class="btn sm icon danger" title="Remover campo" onclick="removerCampoEtapa(${i})">
            <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/></svg>
          </button>
        </div>
      </div>`;
  }).join('');

  _ativarDragDropCamposEtapa();
}

/**
 * Move um campo da etapa da posição `de` para a posição `para`.
 * Usado pelo arrastar-e-soltar; as setas ▲▼ usam moverCampoEtapa().
 */
function reposicionarCampoEtapa(de, para) {
  if (de === para || de < 0 || para < 0) return;
  if (de >= _camposEtapaEdit.length || para >= _camposEtapaEdit.length) return;
  const [movido] = _camposEtapaEdit.splice(de, 1);
  _camposEtapaEdit.splice(para, 0, movido);
  renderListaCamposEtapa();
}

/**
 * Ativa o arrastar-e-soltar das linhas de campo da etapa.
 * O ⠿ já existia como indicação visual, mas sem comportamento —
 * aqui ele passa a funcionar de fato.
 */
function _ativarDragDropCamposEtapa() {
  let origem = null;
  document.querySelectorAll('#etapa-campos-lista .campo-etapa-row').forEach(row => {
    // A linha só se torna arrastável enquanto a alça ⠿ está pressionada.
    // Sem isso, selecionar texto dentro dos inputs iniciaria o arrasto.
    const alca = row.querySelector('.schema-drag-handle');
    if (alca) {
      alca.addEventListener('mousedown', () => { row.draggable = true; });
      alca.addEventListener('mouseup',   () => { row.draggable = false; });
    }
    row.addEventListener('dragstart', e => {
      origem = Number(row.dataset.idx);
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', String(origem)); } catch (_) {}
    });
    row.addEventListener('dragend', () => {
      row.draggable = false;
      row.classList.remove('dragging');
      document.querySelectorAll('#etapa-campos-lista .campo-etapa-row.drag-over')
        .forEach(r => r.classList.remove('drag-over'));
    });
    row.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (Number(row.dataset.idx) !== origem) row.classList.add('drag-over');
    });
    row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
    row.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      row.classList.remove('drag-over');
      const destino = Number(row.dataset.idx);
      if (origem === null || origem === destino) return;
      reposicionarCampoEtapa(origem, destino);
      origem = null;
    });
  });
}

function adicionarLinhaCampoEtapa() {
  _camposEtapaEdit.push({ tipo: 'text', label: '' });
  renderListaCamposEtapa();
  // Foca no novo input de rótulo
  setTimeout(() => {
    const inputs = document.querySelectorAll('#etapa-campos-lista input[type="text"]');
    inputs[inputs.length - 1]?.focus();
  }, 30);
}

function atualizarCampoEtapa(idx, prop, val) {
  if (!_camposEtapaEdit[idx]) return;
  _camposEtapaEdit[idx][prop] = val;
  // Ao trocar o tipo, re-renderiza para mostrar/esconder o seletor de lista fonte
  if (prop === 'tipo') {
    if (val !== 'listafixo' && val !== 'listamulti') delete _camposEtapaEdit[idx].listaFonte;
    renderListaCamposEtapa();
  }
}

function moverCampoEtapa(idx, direcao) {
  const novoIdx = idx + direcao;
  if (novoIdx < 0 || novoIdx >= _camposEtapaEdit.length) return;
  const tmp = _camposEtapaEdit[idx];
  _camposEtapaEdit[idx] = _camposEtapaEdit[novoIdx];
  _camposEtapaEdit[novoIdx] = tmp;
  renderListaCamposEtapa();
}

function removerCampoEtapa(idx) {
  _camposEtapaEdit.splice(idx, 1);
  renderListaCamposEtapa();
}

// Chamado pelo onchange do select de fase no modal de etapa.
// Em modo "Nova Etapa" (sem id), atualiza a sugestão de posição.
// Em modo edição, não altera nada — o admin decide manualmente.
function onTrocarFaseEtapaEdit(faseKey) {
  const idAtual = document.getElementById('etapa-id-edit')?.value;
  if (!idAtual) _sugerirProximaPosicao(faseKey);
  _populateSubfaseSelect(document.getElementById('etapa-subfase-edit')?.value || '');
}

function _populateSubfaseSelect(currentVal) {
  const container = document.getElementById('etapa-subfase-edit')?.parentElement;
  if (!container) return;
  const fases = ls('fases') || [];
  const existing = document.getElementById('etapa-subfase-edit');
  if (existing && existing.tagName === 'SELECT') {
    existing.value = currentVal;
    return;
  }
  if (existing) {
    const sel = document.createElement('select');
    sel.id = 'etapa-subfase-edit';
    sel.className = existing.className;
    sel.innerHTML = '<option value="">— Selecionar fase —</option>' + fases.map(f => `<option value="${f}" ${f === currentVal ? 'selected' : ''}>${f}</option>`).join('');
    container.replaceChild(sel, existing);
  }
}

// ── MODAL USUÁRIO ─────────────────────────────────────────────
async function salvarUsuario() {
  const nome = document.getElementById('user-nome').value.trim();
  const login = document.getElementById('user-login').value.trim();
  if (!nome || !login) { alert('Preencha nome e login!'); return; }
  const users = ls('usuarios') || [];
  const id = document.getElementById('user-id-edit').value || genId();
  const idx = users.findIndex(u => u.id === id);

  // Preserva todos os campos existentes do usuário (vindo do Sheets)
  // e só sobrescreve os campos editáveis pelo formulário
  const existente = idx >= 0 ? users[idx] : {};
  const senhaAtual = existente.senha || null;
  let senhaFinal = senhaAtual;
  if (!senhaAtual) {
    if (typeof hashSenha === 'function') senhaFinal = await hashSenha('123');
    else senhaFinal = '123';
  }

  const obj = {
    ...existente,          // preserva versaoNovidadesVista, cadastradoEm, etc.
    id, nome, login,
    matricula: document.getElementById('user-matricula')?.value.trim() || '',
    email: document.getElementById('user-email')?.value.trim() || '',
    perfil: document.getElementById('user-perfil').value,
    senha: senhaFinal,
    ativo: existente.ativo !== undefined ? existente.ativo : 'TRUE',
  };

  if (idx >= 0) users[idx] = obj; else users.push(obj);
  ls('usuarios', users);
  closeModalForcado('modal-usuario');
  renderUsuarios();
  showToast('Usuário salvo!');
}

async function resetarSenhaUser(id) {
  if (typeof isMasterProtected === 'function' && isMasterProtected(id)) {
    showToast('⚠ O usuário master não pode ser redefinido por outros administradores.'); return;
  }
  if (!confirm('Resetar senha deste usuário para "123"?')) return;
  const users = ls('usuarios') || [];
  const idx = users.findIndex(u => u.id === id);
  if (idx >= 0) {
    users[idx].senha = typeof hashSenha === 'function' ? await hashSenha('123') : '123';
    ls('usuarios', users);
    showToast('Senha resetada para 123');
  }
}

async function alterarSenha() {
  const atual = document.getElementById('senha-atual').value;
  const nova = document.getElementById('senha-nova').value;
  const conf = document.getElementById('senha-conf').value;
  const msg = document.getElementById('senha-msg');
  const u = APP.currentUser;
  if (!u) return;
  const users = ls('usuarios') || [];
  const dbUser = users.find(x => x.id === u.id);
  if (!dbUser) return;
  const senhaOk = typeof verificarSenha === 'function' ? await verificarSenha(atual, dbUser.senha) : (atual === dbUser.senha);
  if (!senhaOk) { msg.className = 'alert danger'; msg.textContent = 'Senha atual incorreta.'; msg.style.display = 'flex'; return; }
  if (nova !== conf) { msg.className = 'alert danger'; msg.textContent = 'As senhas não coincidem.'; msg.style.display = 'flex'; return; }
  if (nova.length < 3) { msg.className = 'alert danger'; msg.textContent = 'Senha muito curta (mínimo 3 caracteres).'; msg.style.display = 'flex'; return; }
  const hashed = typeof hashSenha === 'function' ? await hashSenha(nova) : nova;
  const idx = users.findIndex(x => x.id === u.id);
  if (idx >= 0) { users[idx].senha = hashed; ls('usuarios', users); }
  msg.className = 'alert info'; msg.textContent = '✓ Senha alterada com sucesso!'; msg.style.display = 'flex';
  ['senha-atual', 'senha-nova', 'senha-conf'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
}

// ── Proteção admin master ─────────────────────────────────────
function isMasterProtected(targetUserId) {
  const users = ls('usuarios') || [];
  const target = users.find(u => u.id === targetUserId);
  if (!target) return false;
  return target.login === 'admin' && APP.currentUser?.login !== 'admin';
}

// ── Menu de usuário (logoff) ──────────────────────────────────
function fazerLogoff() {
  if (!confirm('Deseja encerrar sua sessão?')) return;
  APP.currentUser = null;
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  document.getElementById('login-error').style.display = 'none';
  if (typeof UndoStack !== 'undefined') { UndoStack.stack = []; UndoStack.updateBtn?.(); }
}

function toggleUserMenu() {
  const menu = document.getElementById('user-menu');
  if (!menu) return;
  const isOpen = menu.style.display !== 'none';
  menu.style.display = isOpen ? 'none' : 'block';
  if (!isOpen && APP.currentUser) {
    const nameEl = document.getElementById('user-menu-name');
    const roleEl = document.getElementById('user-menu-role');
    if (nameEl) nameEl.textContent = APP.currentUser.nome;
    if (roleEl) roleEl.textContent = APP.currentUser.perfil === 'admin' ? '🔑 Administrador' : '👤 Usuário';
  }
}

// UndoStack definido em auth.js — apenas o listener de teclado aqui
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); UndoStack?.execute(); }
});

// ── Excluir processo ──────────────────────────────────────────
function excluirProcesso(id) {
  if (APP.currentUser?.perfil !== 'admin') return;
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
    }
  });
  processos = processos.filter(x => x.id !== id);
  ls('processos', processos);
  renderMonitoramento();
  if (typeof monitorView !== 'undefined' && monitorView === 'kanban') renderKanban();
  renderDashboard();
  updateSidebarCounts();
  showToast(`Processo "${p.nome}" excluído.`);
}

// ── Helpers de usuários para atribuição ──────────────────────
function getUsuariosAtribuicao() {
  return (ls('usuarios') || []).filter(u => u.login !== 'admin');
}
