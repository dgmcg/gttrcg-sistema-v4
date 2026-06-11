// ============================================================
// GTTRCG — db.js  (v5 — memória pura, sem localStorage)
//
// ARQUITETURA:
//   - Estado vive em RAM: objeto _DB (chave → valor)
//   - Google Sheets é a única fonte de verdade
//   - localStorage NÃO É USADO para dados de negócio
//   - localStorage é usado APENAS para url/token de conexão
//     (credenciais de configuração, não dados de negócio)
//
// API pública:
//   ls(key)        → lê de _DB
//   ls(key, val)   → grava em _DB e agenda escrita no Sheets
//   genId()        → ID único
//   carregarDados()→ busca tudo do Sheets, popula _DB, renderiza
//   chamarAppsScript(params) → fetch com timeout/token
// ============================================================

// ── Estado em memória ────────────────────────────────────────
const _DB = {};

// ── Credenciais de conexão (únicas coisas no localStorage) ──
let GSHEET_URL   = '';
let GSHEET_TOKEN = '';

// Timers de debounce por chave (para gravações)
const _gravarTimers = {};

// ============================================================
// API DE DADOS — ls()
// Todos os módulos lêem e gravam exclusivamente por aqui.
// ============================================================

/**
 * ls(key)       → lê _DB[key], retorna null se não existe
 * ls(key, val)  → grava _DB[key] = val e agenda sync no Sheets
 */
function ls(key, val) {
  if (val !== undefined) {
    _DB[key] = val;
    _agendarGravacao(key, val);
    return val;
  }
  return _DB[key] !== undefined ? _DB[key] : null;
}

/** Gera ID único */
function genId() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

// ============================================================
// CARREGAMENTO INICIAL — carregarDados()
// Exibe loading, busca Sheets, popula _DB, renderiza.
// ============================================================

/**
 * Chamado logo após o login.
 * Bloqueia a UI com indicador de carregamento,
 * busca todos os dados do Sheets, popula _DB
 * e renderiza a interface.
 */
async function carregarDados() {
  _mostrarLoading(true);

  try {
    const data = await chamarAppsScript({ action: 'getAllData' });

    if (!data || data.error) {
      _mostrarLoading(false);
      _mostrarErroOffline(data?.error || 'Sem resposta do servidor');
      return false;
    }

    // Popula _DB com os dados recebidos
    // Ignora chaves com valor vazio para não apagar dados existentes em RAM
    let importados = 0;
    Object.entries(data).forEach(([key, val]) => {
      if (val === null || val === undefined) return;
      if (Array.isArray(val) && val.length === 0) return;
      _DB[key] = val;
      importados++;
    });

    console.log(`[GTTRCG DB] ${importados} coleções carregadas do Sheets`);
    _mostrarLoading(false);
    showSyncBadge('ok');
    return true;

  } catch (e) {
    console.warn('[GTTRCG DB] Erro ao carregar:', e.message);
    _mostrarLoading(false);
    _mostrarErroOffline('Falha de rede — verifique sua conexão');
    return false;
  }
}

// ── Indicador de carregamento ─────────────────────────────────

function _mostrarLoading(visivel) {
  let overlay = document.getElementById('db-loading-overlay');

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'db-loading-overlay';
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'background:var(--bg)',
      'z-index:300', 'display:flex', 'flex-direction:column',
      'align-items:center', 'justify-content:center', 'gap:16px',
      'transition:opacity .3s',
    ].join(';');
    overlay.innerHTML = `
      <div style="
        width:40px;height:40px;border-radius:50%;
        border:3px solid var(--border2);
        border-top-color:var(--accent2);
        animation:gttrcg-spin 1s linear infinite">
      </div>
      <div style="font-size:14px;color:var(--text2);font-weight:500">
        Carregando dados...
      </div>
      <div style="font-size:12px;color:var(--text3)">
        Conectando ao Google Sheets
      </div>`;

    // CSS da animação (injeta uma vez)
    if (!document.getElementById('gttrcg-spin-style')) {
      const style = document.createElement('style');
      style.id = 'gttrcg-spin-style';
      style.textContent = '@keyframes gttrcg-spin{to{transform:rotate(360deg)}}';
      document.head.appendChild(style);
    }

    document.body.appendChild(overlay);
  }

  if (visivel) {
    overlay.style.display = 'flex';
    overlay.style.opacity = '1';
  } else {
    overlay.style.opacity = '0';
    setTimeout(() => { overlay.style.display = 'none'; }, 300);
  }
}

// ── Tela de erro offline ──────────────────────────────────────

function _mostrarErroOffline(motivo) {
  let overlay = document.getElementById('db-loading-overlay');
  if (!overlay) return;

  overlay.style.display = 'flex';
  overlay.style.opacity = '1';
  overlay.innerHTML = `
    <div style="text-align:center;max-width:360px;padding:0 24px">
      <div style="font-size:32px;margin-bottom:12px">⚠️</div>
      <div style="font-size:16px;font-weight:600;color:var(--text);margin-bottom:8px">
        Não foi possível carregar os dados
      </div>
      <div style="font-size:13px;color:var(--text3);margin-bottom:6px">
        ${motivo}
      </div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:24px;
           background:var(--bg2);padding:10px;border-radius:var(--radius);
           border:1px solid var(--border)">
        O sistema requer conexão com o Google Sheets para funcionar.<br>
        Nenhum dado é armazenado localmente neste dispositivo.
      </div>
      <button onclick="location.reload()" class="btn primary" style="width:100%;justify-content:center">
        ↻ Tentar novamente
      </button>
    </div>`;
}

// ============================================================
// GRAVAÇÃO NO SHEETS — agendada e debounced
// ============================================================

function _agendarGravacao(key, data) {
  if (!GSHEET_URL || !GSHEET_TOKEN) return;

  // Não sincronizar chaves internas
  const naoSincronizar = ['_sessao', '_cache'];
  if (naoSincronizar.includes(key)) return;

  clearTimeout(_gravarTimers[key]);
  _gravarTimers[key] = setTimeout(async () => {
    try {
      const res = await chamarAppsScript({ action: 'set', sheet: key, data });
      if (res?.ok) {
        showSyncBadge('ok', 'Salvo às ' + new Date().toLocaleTimeString('pt-BR'));
      } else if (res?.error === 'TOKEN_INVALIDO') {
        showSyncBadge('offline', 'Token inválido');
      } else {
        showSyncBadge('offline', res?.error || 'Falha ao gravar');
        // Retry em 8s
        setTimeout(() => _agendarGravacao(key, _DB[key]), 8000);
      }
    } catch (e) {
      showSyncBadge('offline', 'Sem conexão');
    }
  }, 1200);
}

// ============================================================
// COMUNICAÇÃO COM APPS SCRIPT
// ============================================================

async function chamarAppsScript(params) {
  if (!GSHEET_URL) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const isWrite = ['set', 'analisarPdf'].includes(params.action);
    let resp;

    if (isWrite) {
      resp = await fetch(GSHEET_URL, {
        method: 'POST',
        body: JSON.stringify({
          ...params,
          token: GSHEET_TOKEN,
          usuario: APP?.currentUser?.login || 'sistema',
        }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        signal: controller.signal,
      });
    } else {
      const url = new URL(GSHEET_URL);
      Object.entries(params).forEach(([k, v]) =>
        url.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v))
      );
      resp = await fetch(url.toString(), { signal: controller.signal });
    }

    clearTimeout(timeout);
    const text = await resp.text();
    try { return JSON.parse(text); }
    catch { console.warn('[GTTRCG DB] Resposta não-JSON:', text.slice(0, 200)); return null; }

  } catch (e) {
    clearTimeout(timeout);
    if (e.name !== 'AbortError') console.warn('[GTTRCG DB] Erro de rede:', e.message);
    return null;
  }
}

async function testarConexao() {
  try {
    const url = new URL(GSHEET_URL);
    url.searchParams.set('action', 'ping');
    const resp = await fetch(url.toString());
    const data = JSON.parse(await resp.text());
    if (data.ok) return { ok: true, msg: `Conectado · ${new Date(data.ts).toLocaleTimeString('pt-BR')}` };
    return { ok: false, msg: data.error || 'Resposta inesperada' };
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}

// ============================================================
// BADGE DE STATUS E BOTÃO DE SINCRONIZAÇÃO
// ============================================================

function showSyncBadge(estado, detalhe) {
  let badge = document.getElementById('sync-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'sync-badge';
    badge.style.cssText = 'position:fixed;bottom:14px;left:14px;font-size:11px;padding:4px 10px;border-radius:20px;z-index:90;transition:all .3s;pointer-events:none';
    document.body.appendChild(badge);
  }
  const cfg = {
    ok:         { bg:'rgba(63,185,80,.12)',  cor:'var(--green)',   txt:'● Sheets sincronizado' },
    offline:    { bg:'rgba(210,153,34,.12)', cor:'var(--yellow2)', txt:'⚠ Sem sincronização' },
    carregando: { bg:'rgba(31,111,235,.1)',  cor:'var(--accent2)', txt:'↻ Carregando...' },
  }[estado] || { bg:'rgba(210,153,34,.12)', cor:'var(--yellow2)', txt:'⚠' };

  badge.style.background = cfg.bg;
  badge.style.color = cfg.cor;
  badge.style.border = `1px solid ${cfg.cor}44`;
  badge.textContent = detalhe ? `${cfg.txt} · ${detalhe}` : cfg.txt;
}

function addSyncButton() {
  if (document.getElementById('sync-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'sync-btn';
  btn.className = 'btn';
  btn.style.cssText = 'position:fixed;bottom:14px;right:14px;z-index:90;font-size:11px;padding:4px 12px';
  btn.innerHTML = '↻ Sincronizar';
  btn.title = 'Recarregar todos os dados do Google Sheets';
  btn.onclick = async () => {
    btn.textContent = '…';
    btn.disabled = true;
    const ok = await carregarDados();
    if (ok) {
      const activePage = document.querySelector('.page.active')?.id?.replace('page-', '');
      if (activePage && typeof showPage === 'function') showPage(activePage);
      showToast('✓ Dados sincronizados!');
    }
    btn.innerHTML = '↻ Sincronizar';
    btn.disabled = false;
  };
  document.body.appendChild(btn);
}

// ============================================================
// CONFIGURAÇÃO DE CONEXÃO
// Credenciais ficam em localStorage (não são dados de negócio)
// ============================================================

function setAppsScriptUrl(url) {
  GSHEET_URL = url;
  localStorage.setItem('gttrcg_apps_script_url', url);
}

function setApiToken(token) {
  GSHEET_TOKEN = token;
  localStorage.setItem('gttrcg_api_token', token);
}

function getAppsScriptUrl() { return GSHEET_URL; }
function getApiToken()      { return GSHEET_TOKEN; }

// ── Lê credenciais do localStorage (única leitura de LS) ─────
(function _carregarCredenciais() {
  GSHEET_URL   = localStorage.getItem('gttrcg_apps_script_url') || '';
  GSHEET_TOKEN = localStorage.getItem('gttrcg_api_token')       || '';
})();

// ── Aplica GTTRCG_CONFIG se já disponível ───────────────────
// (normalmente já está, pois o bloco inline vem antes dos scripts)
(function _aplicarConfig() {
  if (typeof GTTRCG_CONFIG === 'undefined') return;
  const { appsScriptUrl, apiToken } = GTTRCG_CONFIG;
  if (appsScriptUrl && !appsScriptUrl.includes('COLE_AQUI') && appsScriptUrl.includes('script.google.com')) {
    setAppsScriptUrl(appsScriptUrl);
  }
  if (apiToken && !apiToken.includes('COLE_AQUI') && apiToken.length > 3) {
    setApiToken(apiToken);
  }
})();

// ============================================================
// INICIALIZAÇÃO
// ============================================================

/**
 * iniciarDB() — chamado pelo bootSistema() no app.js
 * Configura a conexão e retorna true se URL/token presentes.
 * O carregamento real dos dados é feito por carregarDados(),
 * chamado pelo doLogin() após autenticação.
 */
function iniciarDB() {
  addSyncButton();

  if (!GSHEET_URL || !GSHEET_TOKEN) {
    showSyncBadge('offline', 'URL ou token não configurados');
    return false;
  }

  showSyncBadge('ok', 'Pronto');
  return true;
}

console.log('[GTTRCG] db.js carregado ✓');
