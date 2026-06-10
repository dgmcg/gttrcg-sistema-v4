// ============================================================
// modais.js — Gestão de Modais e Formulários
// ============================================================

// ── Helpers gerais ────────────────────────────────────────────
function openModal(id) { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

// ── Fechar modal ao clicar fora / ESC ─────────────────────────
document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id));
});

// ── MODAL PROCESSO: Novo/Editar ───────────────────────────────
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
    vigInicio: document.getElementById('proc-vig-inicio').value,
    vigFim: document.getElementById('proc-vig-fim').value,
    statusCG: document.getElementById('proc-status-cg-top')?.value || document.getElementById('proc-status-cg')?.value || '',
    progresso: idx >= 0 ? (processos[idx].progresso || 0) : 0,
    acompanhamento: idx >= 0 ? (processos[idx].acompanhamento || {}) : {},
  };
  if (idx >= 0) processos[idx] = obj; else processos.push(obj);
  ls('processos', processos);
  closeModal('modal-processo');
  renderMonitoramento();
  renderDashboard();
  updateSidebarCounts();
  showToast('Processo salvo!');
}

// ── MODAL ETAPA FLUXO ─────────────────────────────────────────
function openAdicionarEtapa() {
  APP.editingEtapaId = null;
  document.getElementById('modal-etapa-fluxo-title').textContent = 'Nova Etapa';
  document.getElementById('etapa-id-edit').value = '';
  ['etapa-nome-edit', 'etapa-resp-edit', 'etapa-acao-edit', 'etapa-campos-edit'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('etapa-ordem-edit').value = '';
  document.getElementById('etapa-fase-edit').value = 'planejamento';
  // subfase como select de fases
  _populateSubfaseSelect('');
  document.getElementById('btn-excluir-etapa').style.display = 'none';
  openModal('modal-etapa-fluxo');
}

function openEditarFluxo() { openAdicionarEtapa(); }

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
  document.getElementById('etapa-campos-edit').value = (e.campos || []).map(c => `${c.tipo}|${c.label}`).join('\n');
  _populateSubfaseSelect(e.subfase || '');
  document.getElementById('btn-excluir-etapa').style.display = 'inline-flex';
  openModal('modal-etapa-fluxo');
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
  const senhaAtual = idx >= 0 ? users[idx].senha : null;
  let senhaFinal = senhaAtual;
  if (!senhaAtual) {
    if (typeof hashSenha === 'function') senhaFinal = await hashSenha('123');
    else senhaFinal = '123';
  }
  const obj = {
    id, nome, login,
    matricula: document.getElementById('user-matricula')?.value.trim() || '',
    email: document.getElementById('user-email')?.value.trim() || '',
    perfil: document.getElementById('user-perfil').value,
    senha: senhaFinal,
  };
  if (idx >= 0) users[idx] = obj; else users.push(obj);
  ls('usuarios', users);
  closeModal('modal-usuario');
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

// ── UndoStack ──────────────────────────────────────────────────
const UndoStack = {
  stack: [],
  maxSize: 20,
  push(action) {
    this.stack.push({ ...action, ts: Date.now() });
    if (this.stack.length > this.maxSize) this.stack.shift();
    this.updateBtn();
  },
  pop() { return this.stack.pop() || null; },
  peek() { return this.stack[this.stack.length - 1] || null; },
  updateBtn() {
    const btn = document.getElementById('undo-btn');
    const last = this.peek();
    if (btn) { btn.disabled = !last; btn.title = last ? `Desfazer: ${last.label} (Ctrl+Z)` : 'Nada para desfazer'; btn.style.opacity = last ? '1' : '.4'; }
  },
  execute() {
    const action = this.pop();
    if (!action) { showToast('Nada para desfazer'); return; }
    try { action.undo(); this.updateBtn(); showToast(`↩ Desfeito: ${action.label}`); }
    catch (e) { showToast('Erro ao desfazer: ' + e.message); }
  }
};

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); UndoStack.execute(); }
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
