// ============================================================
// GTTRCG — db.js  (v6 — memória pura, carregamento no boot)
//
// FLUXO:
//   1. Página abre → carregarDados() imediato (spinner)
//   2. Sheets responde → _DB populado
//   3. Tela de login aparece
//   4. Login valida contra _DB (já tem os dados reais)
//   5. Gravações: ls(key, val) → _DB + agenda sync Sheets
//
// localStorage: APENAS url e token de conexão
// Dados de negócio: APENAS em _DB (RAM) + Sheets
// ============================================================

// ── Estado em memória ────────────────────────────────────────
const _DB = {};

// ── Credenciais (única coisa no localStorage) ────────────────
let GSHEET_URL   = '';
let GSHEET_TOKEN = '';

const _gravarTimers = {};

// ============================================================
// API DE DADOS — ls()
// ============================================================

function ls(key, val) {
  if (val !== undefined) {
    _DB[key] = val;
    _agendarGravacao(key, val);
    return val;
  }
  return _DB[key] !== undefined ? _DB[key] : null;
}

function genId() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

// ============================================================
// CARREGAMENTO INICIAL — chamado ao abrir a página
// ============================================================

async function carregarDados() {
  _mostrarLoading(true, 'Conectando ao Google Sheets...');

  try {
    const data = await chamarAppsScript({ action: 'getAllData' });

    if (!data || data.error) {
      _mostrarErroOffline(data?.error || 'Sem resposta do servidor');
      return false;
    }

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
    _mostrarErroOffline('Falha de rede — verifique sua conexão');
    return false;
  }
}

// ── Indicador de carregamento ─────────────────────────────────

function _mostrarLoading(visivel, msg) {
  let overlay = document.getElementById('db-loading-overlay');

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'db-loading-overlay';
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'background:var(--bg)',
      'z-index:500', 'display:flex', 'flex-direction:column',
      'align-items:center', 'justify-content:center', 'gap:16px',
      'transition:opacity .3s',
    ].join(';');
    overlay.innerHTML = `
      <svg width="32" height="32" viewBox="0 0 32 32" fill="var(--accent2)">
        <rect x="2" y="2" width="12" height="12" rx="3" opacity=".9"/>
        <rect x="18" y="2" width="12" height="12" rx="3" opacity=".6"/>
        <rect x="2" y="18" width="12" height="12" rx="3" opacity=".6"/>
        <rect x="18" y="18" width="12" height="12" rx="3" opacity=".3"/>
      </svg>
      <div id="db-loading-spinner" style="
        width:32px;height:32px;border-radius:50%;
        border:3px solid var(--border2);
        border-top-color:var(--accent2);
        animation:gttrcg-spin 1s linear infinite">
      </div>
      <div id="db-loading-msg" style="font-size:13px;color:var(--text2);font-weight:500">
        Carregando...
      </div>
      <div style="font-size:11px;color:var(--text3)">GTTRCG · SES-PE · DGMCG</div>`;

    if (!document.getElementById('gttrcg-spin-style')) {
      const style = document.createElement('style');
      style.id = 'gttrcg-spin-style';
      style.textContent = '@keyframes gttrcg-spin{to{transform:rotate(360deg)}}';
      document.head.appendChild(style);
    }

    document.body.appendChild(overlay);
  }

  if (visivel) {
    const msgEl = overlay.querySelector('#db-loading-msg');
    if (msgEl && msg) msgEl.textContent = msg;
    overlay.style.display = 'flex';
    // Força reflow antes de animar
    overlay.offsetHeight;
    overlay.style.opacity = '1';
  } else {
    overlay.style.opacity = '0';
    setTimeout(() => { overlay.style.display = 'none'; }, 300);
  }
}

// ── Tela de erro offline ──────────────────────────────────────

function _mostrarErroOffline(motivo) {
  const overlay = document.getElementById('db-loading-overlay');
  if (!overlay) return;

  overlay.style.display = 'flex';
  overlay.style.opacity = '1';
  overlay.innerHTML = `
    <div style="text-align:center;max-width:360px;padding:0 24px">
      <div style="font-size:40px;margin-bottom:16px">⚠️</div>
      <div style="font-size:16px;font-weight:600;color:var(--text);margin-bottom:8px">
        Não foi possível carregar os dados
      </div>
      <div style="font-size:13px;color:var(--text3);margin-bottom:12px">${motivo}</div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:24px;
           background:var(--bg2);padding:12px;border-radius:var(--radius);
           border:1px solid var(--border);line-height:1.6">
        O sistema requer conexão com o Google Sheets.<br>
        Verifique sua internet e tente novamente.
      </div>
      <button onclick="location.reload()" class="btn primary"
              style="width:100%;justify-content:center;padding:10px">
        ↻ Tentar novamente
      </button>
    </div>`;
}

// ============================================================
// GRAVAÇÃO NO SHEETS — debounced, assíncrona
// ============================================================

function _agendarGravacao(key, data) {
  if (!GSHEET_URL || !GSHEET_TOKEN) return;

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
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const isWrite = ['set', 'analisarPdf', 'uploadArquivo'].includes(params.action);
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
    const data = JSON.parse(await (await fetch(url.toString())).text());
    if (data.ok) return { ok: true, msg: `Conectado · ${new Date(data.ts).toLocaleTimeString('pt-BR')}` };
    return { ok: false, msg: data.error || 'Resposta inesperada' };
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}

// ============================================================
// BADGE E BOTÃO DE SINCRONIZAÇÃO
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
    _mostrarLoading(true, 'Recarregando dados...');
    const ok = await carregarDados();
    if (ok) {
      const activePage = document.querySelector('.page.active')?.id?.replace('page-', '');
      if (activePage && typeof showPage === 'function') showPage(activePage);
      if (typeof updateSidebarCounts === 'function') updateSidebarCounts();
      showToast('✓ Dados sincronizados!');
    }
    btn.innerHTML = '↻ Sincronizar';
    btn.disabled = false;
  };
  document.body.appendChild(btn);
}

// ============================================================
// CREDENCIAIS DE CONEXÃO
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

// ── Aplica configuração ao carregar ──────────────────────────
(function _inicializarCredenciais() {
  // 1. Lê do localStorage (sessões anteriores)
  GSHEET_URL   = localStorage.getItem('gttrcg_apps_script_url') || '';
  GSHEET_TOKEN = localStorage.getItem('gttrcg_api_token')       || '';

  // 2. GTTRCG_CONFIG embutido no HTML tem prioridade
  if (typeof GTTRCG_CONFIG !== 'undefined') {
    const { appsScriptUrl, apiToken } = GTTRCG_CONFIG;
    if (appsScriptUrl && !appsScriptUrl.includes('COLE_AQUI') && appsScriptUrl.includes('script.google.com')) {
      setAppsScriptUrl(appsScriptUrl);
    }
    if (apiToken && !apiToken.includes('COLE_AQUI') && apiToken.length > 3) {
      setApiToken(apiToken);
    }
  }
})();

// ============================================================
// BOOT — chamado pelo app.js assim que o DOM está pronto
// ============================================================

/**
 * iniciarDB():
 *   1. Configura botão de sync
 *   2. Carrega dados do Sheets IMEDIATAMENTE (antes do login)
 *   3. Ao terminar, exibe a tela de login
 */
async function iniciarDB() {
  addSyncButton();

  if (!GSHEET_URL || !GSHEET_TOKEN) {
    _mostrarErroOffline('URL ou token do Apps Script não configurados.<br>Verifique o arquivo index.html.');
    return false;
  }

  const ok = await carregarDados();
  return ok;
}

console.log('[GTTRCG] db.js carregado ✓');
