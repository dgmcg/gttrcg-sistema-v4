// ============================================================
// GTTRCG — auth.js
// Responsabilidades:
//   - Login com verificação SHA-256
//   - Sessão do usuário (APP.currentUser)
//   - Migração automática de senhas em texto puro → hash
//   - CRUD de usuários (salvar, resetar senha, excluir)
//   - Alterar senha do usuário logado
//   - Proteção do admin master
//   - Menu dropdown do usuário / logoff
//   - UndoStack (desfazer ações)
// ============================================================

// ── SHA-256 via Web Crypto API ────────────────────────────────
const HASH_PREFIX = 'sha256:';

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const buf  = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hashSenha(senha) {
  return HASH_PREFIX + (await sha256(senha));
}

function isHashed(senha) {
  return typeof senha === 'string' && senha.startsWith(HASH_PREFIX);
}

async function verificarSenha(digitada, armazenada) {
  if (!armazenada) return false;
  if (isHashed(armazenada)) {
    return (await hashSenha(digitada)) === armazenada;
  }
  // Texto puro (legado) — compara direto
  return digitada === armazenada;
}

// ============================================================
// LOGIN
// ============================================================

async function doLogin() {
  const loginVal = document.getElementById('login-user').value.trim();
  const senhaVal = document.getElementById('login-pass').value;
  const errEl    = document.getElementById('login-error');

  const users = ls('usuarios') || [];
  const user  = users.find(u => u.login === loginVal);

  if (!user) { errEl.style.display = 'flex'; return; }

  const ok = await verificarSenha(senhaVal, user.senha);
  if (!ok)  { errEl.style.display = 'flex'; return; }

  // Migra senha em texto puro para hash
  if (!isHashed(user.senha)) {
    const hashed = await hashSenha(senhaVal);
    const allUsers = ls('usuarios') || [];
    const idx = allUsers.findIndex(u => u.id === user.id);
    if (idx >= 0) {
      allUsers[idx].senha = hashed;
      // Grava direto no localStorage para não triggar sync antes da sessão iniciar
      localStorage.setItem('gttrcg_usuarios', JSON.stringify(allUsers));
    }
  }

  // Inicia sessão — NUNCA expõe a senha
  APP.currentUser = { ...user, senha: undefined };
  errEl.style.display = 'none';

  // Atualiza topbar
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('user-name-display').textContent = user.nome;
  document.getElementById('user-role-display').textContent =
    user.perfil === 'admin' ? 'Administrador' : 'Usuário';
  document.getElementById('user-avatar').textContent =
    user.nome.charAt(0).toUpperCase();

  // Inicializa sistemas pós-login
  UndoStack.reset();
  injectLogoffMenu();
  injectUndoButton();
  showPage('dashboard');
}

// Enter no campo de senha
document.getElementById('login-pass')
  .addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

// ============================================================
// MIGRAÇÃO AUTOMÁTICA DE SENHAS
// ============================================================

(async function migrarSenhas() {
  const users = ls('usuarios') || [];
  let changed = false;
  for (const u of users) {
    if (!isHashed(u.senha)) {
      u.senha = await hashSenha(u.senha || '123');
      changed = true;
    }
  }
  if (changed) {
    localStorage.setItem('gttrcg_usuarios', JSON.stringify(users));
    console.log('[GTTRCG Auth] Senhas migradas para SHA-256 ✓');
  }
})();

// ============================================================
// PROTEÇÃO DO ADMIN MASTER
// ============================================================

/** Retorna true se o targetUserId é o admin master E o usuário logado não é ele mesmo */
function isMasterProtected(targetUserId) {
  const users  = ls('usuarios') || [];
  const target = users.find(u => u.id === targetUserId);
  if (!target) return false;
  return target.login === 'admin' && APP.currentUser?.login !== 'admin';
}

/** Garante que o admin master sempre existe */
function garantirAdminMaster() {
  const users  = ls('usuarios') || [];
  const master = users.find(u => u.login === 'admin');
  if (!master) {
    users.unshift({
      id: 'u_admin_master',
      nome: 'Administrador',
      login: 'admin',
      senha: '123', // será migrado para hash na próxima execução
      perfil: 'admin',
    });
    localStorage.setItem('gttrcg_usuarios', JSON.stringify(users));
  } else if (master.perfil !== 'admin') {
    master.perfil = 'admin';
    localStorage.setItem('gttrcg_usuarios', JSON.stringify(users));
  }
}

garantirAdminMaster();

// ============================================================
// CRUD DE USUÁRIOS
// ============================================================

function getUsuariosAtribuicao() {
  return (ls('usuarios') || []).filter(u => u.login !== 'admin');
}

function renderUsuarios() {
  const users   = ls('usuarios') || [];
  const isAdmin = APP.currentUser?.perfil === 'admin';
  const list    = document.getElementById('usuarios-list');
  if (!list) return;

  if (!users.length) {
    list.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:12px">Nenhum usuário cadastrado.</div>';
    return;
  }

  list.innerHTML = users.map(u => {
    const isMaster = u.login === 'admin';
    const meSelf   = u.id === APP.currentUser?.id;

    let actionsHtml = '';
    if (isAdmin) {
      if (isMaster && APP.currentUser?.login !== 'admin') {
        actionsHtml = `<span style="font-size:11px;color:var(--text3);padding:3px 8px;background:var(--bg2);border-radius:var(--radius);border:1px solid var(--border)">🔒 Master</span>`;
      } else {
        actionsHtml = `
          <button class="btn sm" onclick="resetarSenhaUser('${u.id}')" title="Resetar senha para 123">🔄 Senha</button>
          <button class="btn sm" onclick="openEditarUsuario('${u.id}')">Editar</button>
          ${!meSelf && !isMaster ? `<button class="btn sm danger" onclick="excluirUsuario('${u.id}')">✕</button>` : ''}
        `;
      }
    }

    return `
      <div class="config-item">
        <div style="width:34px;height:34px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;font-size:13px;flex-shrink:0">
          ${(u.nome || '?').charAt(0).toUpperCase()}
        </div>
        <div class="config-item-text" style="flex:1;min-width:0">
          <div style="font-weight:500;font-size:13px">${u.nome || '-'}</div>
          <div class="config-item-sub">
            @${u.login} · ${u.perfil === 'admin' ? '🔑 Administrador' : '👤 Usuário'}
            ${u.matricula ? ' · Mat: ' + u.matricula : ''}
            ${u.email     ? ' · ' + u.email         : ''}
          </div>
        </div>
        <div class="config-item-actions" style="display:flex;gap:6px">${actionsHtml}</div>
      </div>`;
  }).join('');
}

function openAdicionarUsuario() {
  document.getElementById('modal-user-title').textContent = 'Novo Usuário';
  ['user-id-edit', 'user-nome', 'user-login', 'user-matricula', 'user-email']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const perf = document.getElementById('user-perfil');
  if (perf) perf.value = 'usuario';
  openModal('modal-usuario');
}

function openEditarUsuario(id) {
  if (isMasterProtected(id)) {
    showToast('⚠ O usuário master só pode ser editado por ele mesmo.');
    return;
  }
  const users = ls('usuarios') || [];
  const u = users.find(x => x.id === id);
  if (!u) return;

  document.getElementById('modal-user-title').textContent = 'Editar Usuário';
  document.getElementById('user-id-edit').value  = id;
  document.getElementById('user-nome').value     = u.nome  || '';
  document.getElementById('user-login').value    = u.login || '';
  if (document.getElementById('user-matricula'))
    document.getElementById('user-matricula').value = u.matricula || '';
  if (document.getElementById('user-email'))
    document.getElementById('user-email').value = u.email || '';
  document.getElementById('user-perfil').value = u.perfil || 'usuario';
  openModal('modal-usuario');
}

async function salvarUsuario() {
  const nome  = document.getElementById('user-nome').value.trim();
  const login = document.getElementById('user-login').value.trim();
  if (!nome || !login) { alert('Preencha nome e login!'); return; }

  const users = ls('usuarios') || [];
  const id    = document.getElementById('user-id-edit').value || genId();
  const idx   = users.findIndex(u => u.id === id);

  // Senha: mantém a existente ou gera hash de '123'
  const senhaFinal = idx >= 0 ? users[idx].senha : await hashSenha('123');

  const obj = {
    id, nome, login,
    matricula: document.getElementById('user-matricula')?.value.trim() || '',
    email:     document.getElementById('user-email')?.value.trim()     || '',
    perfil:    document.getElementById('user-perfil').value,
    senha:     senhaFinal,
  };

  if (idx >= 0) users[idx] = obj;
  else          users.push(obj);

  ls('usuarios', users);
  closeModal('modal-usuario');
  renderUsuarios();
  showToast('Usuário salvo!');
}

async function resetarSenhaUser(id) {
  if (isMasterProtected(id)) {
    showToast('⚠ Somente o próprio admin pode redefinir sua senha.');
    return;
  }
  if (!confirm('Resetar senha deste usuário para "123"?')) return;

  const users = ls('usuarios') || [];
  const idx   = users.findIndex(u => u.id === id);
  if (idx >= 0) {
    users[idx].senha = await hashSenha('123');
    ls('usuarios', users);
    showToast('Senha resetada para 123');
  }
}

function excluirUsuario(id) {
  if (id === APP.currentUser?.id) {
    alert('Você não pode excluir seu próprio usuário.');
    return;
  }
  if (isMasterProtected(id)) {
    showToast('⚠ O usuário master não pode ser excluído.');
    return;
  }
  if (!confirm('Excluir este usuário permanentemente?')) return;

  let users = ls('usuarios') || [];
  users = users.filter(u => u.id !== id);
  ls('usuarios', users);
  renderUsuarios();
  showToast('Usuário excluído.');
}

// ============================================================
// ALTERAR SENHA DO USUÁRIO LOGADO
// ============================================================

async function alterarSenha() {
  const atual = document.getElementById('senha-atual').value;
  const nova  = document.getElementById('senha-nova').value;
  const conf  = document.getElementById('senha-conf').value;
  const msg   = document.getElementById('senha-msg');
  const u     = APP.currentUser;
  if (!u) return;

  const users  = ls('usuarios') || [];
  const dbUser = users.find(x => x.id === u.id);
  if (!dbUser) return;

  const ok = await verificarSenha(atual, dbUser.senha);
  if (!ok) {
    msg.className = 'alert danger';
    msg.textContent = 'Senha atual incorreta.';
    msg.style.display = 'flex';
    return;
  }
  if (nova !== conf) {
    msg.className = 'alert danger';
    msg.textContent = 'As senhas não coincidem.';
    msg.style.display = 'flex';
    return;
  }
  if (nova.length < 3) {
    msg.className = 'alert danger';
    msg.textContent = 'Senha muito curta (mínimo 3 caracteres).';
    msg.style.display = 'flex';
    return;
  }

  const hashed = await hashSenha(nova);
  const idx = users.findIndex(x => x.id === u.id);
  if (idx >= 0) {
    users[idx].senha = hashed;
    ls('usuarios', users);
  }

  msg.className = 'alert info';
  msg.textContent = '✓ Senha alterada com sucesso!';
  msg.style.display = 'flex';
  ['senha-atual', 'senha-nova', 'senha-conf']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
}

// ============================================================
// LOGOFF
// ============================================================

function fazerLogoff() {
  if (!confirm('Deseja encerrar sua sessão?')) return;
  APP.currentUser = null;
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  document.getElementById('login-error').style.display = 'none';
  UndoStack.reset();
}

// ============================================================
// MENU DROPDOWN DO USUÁRIO
// ============================================================

function injectLogoffMenu() {
  if (document.getElementById('user-menu')) return;
  const avatar = document.getElementById('user-avatar');
  if (!avatar) return;

  const menu = document.createElement('div');
  menu.id = 'user-menu';
  menu.style.cssText = [
    'display:none', 'position:absolute', 'top:calc(100% + 4px)', 'right:0',
    'background:var(--bg1)', 'border:1px solid var(--border2)',
    'border-radius:var(--radius2)', 'min-width:200px',
    'box-shadow:0 8px 24px rgba(0,0,0,.5)', 'z-index:300', 'overflow:hidden',
  ].join(';');

  menu.innerHTML = `
    <div style="padding:12px 14px;border-bottom:1px solid var(--border);background:var(--bg2)">
      <div id="user-menu-name" style="font-size:13px;font-weight:600">${APP.currentUser?.nome || ''}</div>
      <div id="user-menu-role" style="font-size:11px;color:var(--text3);margin-top:2px">
        ${APP.currentUser?.perfil === 'admin' ? '🔑 Administrador' : '👤 Usuário'}
      </div>
    </div>
    <div style="padding:6px">
      <div class="sidebar-item" onclick="showPage('configuracoes');document.getElementById('user-menu').style.display='none'"
           style="border-radius:var(--radius);padding:8px 10px;cursor:pointer">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492z"/>
          <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.892 3.433-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.892-1.64-.901-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319z"/>
        </svg>
        Configurações
      </div>
      <div style="height:1px;background:var(--border);margin:4px 0"></div>
      <div class="sidebar-item" onclick="fazerLogoff()"
           style="border-radius:var(--radius);padding:8px 10px;color:var(--red2);cursor:pointer">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path fill-rule="evenodd" d="M10 12.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v2a.5.5 0 0 0 1 0v-2A1.5 1.5 0 0 0 9.5 2h-8A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h8a1.5 1.5 0 0 0 1.5-1.5v-2a.5.5 0 0 0-1 0v2z"/>
          <path fill-rule="evenodd" d="M15.854 8.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708.708L14.293 7.5H5.5a.5.5 0 0 0 0 1h8.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3z"/>
        </svg>
        Sair (Logoff)
      </div>
    </div>`;

  const wrap = avatar.parentNode;
  if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
  wrap.appendChild(menu);

  avatar.removeAttribute('onclick');
  avatar.onclick = toggleUserMenu;

  document.addEventListener('click', ev => {
    if (!wrap.contains(ev.target)) menu.style.display = 'none';
  }, true);
}

function toggleUserMenu() {
  const menu = document.getElementById('user-menu');
  if (!menu) return;
  const open = menu.style.display !== 'none';
  menu.style.display = open ? 'none' : 'block';
}

// ============================================================
// SISTEMA DE UNDO (DESFAZER)
// ============================================================

const UndoStack = {
  stack: [],
  MAX: 20,

  push(action) {
    this.stack.push({ ...action, ts: Date.now() });
    if (this.stack.length > this.MAX) this.stack.shift();
    this._updateBtn();
  },

  pop() { return this.stack.pop() || null; },
  peek() { return this.stack[this.stack.length - 1] || null; },

  reset() {
    this.stack = [];
    this._updateBtn();
  },

  execute() {
    const action = this.pop();
    if (!action) { showToast('Nada para desfazer'); return; }
    try {
      action.undo();
      this._updateBtn();
      showToast(`↩ Desfeito: ${action.label}`);
    } catch (e) {
      showToast('Erro ao desfazer: ' + e.message);
    }
  },

  _updateBtn() {
    const btn  = document.getElementById('undo-btn');
    const last = this.peek();
    if (!btn) return;
    btn.disabled = !last;
    btn.title    = last ? `Desfazer: ${last.label}` : 'Nada para desfazer (Ctrl+Z)';
    btn.style.opacity = last ? '1' : '.4';
  },
};

function injectUndoButton() {
  if (document.getElementById('undo-btn')) return;
  const nav = document.querySelector('.topbar-nav');
  if (!nav) return;

  const btn = document.createElement('button');
  btn.id        = 'undo-btn';
  btn.className = 'btn';
  btn.disabled  = true;
  btn.style.cssText = 'margin-left:auto;opacity:.4;font-size:12px;padding:4px 10px;flex-shrink:0';
  btn.innerHTML = '↩ Desfazer';
  btn.title     = 'Nada para desfazer (Ctrl+Z)';
  btn.onclick   = () => UndoStack.execute();
  nav.appendChild(btn);

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      UndoStack.execute();
    }
  });
}

console.log('[GTTRCG] auth.js carregado ✓');
