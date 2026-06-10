// ============================================================
// GTTRCG — db.js
// ÚNICA camada de acesso a dados do sistema.
// Responsabilidades:
//   - Ler/gravar no localStorage (prefixo gttrcg_)
//   - Sincronizar com Google Sheets via Apps Script
//   - Badge de status de sincronização
//   - Botão de sincronização manual
//
// REGRA: Nenhum outro módulo acessa localStorage diretamente.
//        Todo acesso passa por ls() ou as funções específicas.
// ============================================================

// ── Configuração da conexão ──────────────────────────────────
let GSHEET_URL   = localStorage.getItem('gttrcg_apps_script_url') || '';
let GSHEET_TOKEN = localStorage.getItem('gttrcg_api_token')       || '';

// Timers de debounce por chave
const _gravarTimers = {};

// ============================================================
// FUNÇÕES BASE DE localStorage
// ============================================================

/**
 * ls(key) — lê do localStorage
 * ls(key, val) — grava no localStorage E sincroniza com Sheets
 */
function ls(key, val) {
  if (val !== undefined) {
    localStorage.setItem('gttrcg_' + key, JSON.stringify(val));
    if (GSHEET_URL && GSHEET_TOKEN) {
      gravarNoSheets(key, val);
    }
    return val;
  }
  const v = localStorage.getItem('gttrcg_' + key);
  return v ? JSON.parse(v) : null;
}

/** Gera ID único */
function genId() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

// ============================================================
// COMUNICAÇÃO COM APPS SCRIPT
// ============================================================

/**
 * Chama o Apps Script com timeout e tratamento de erros.
 * Leituras: GET com parâmetros na URL
 * Gravações: POST com JSON no body + token
 */
async function chamarAppsScript(params) {
  if (!GSHEET_URL) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000); // 20s

  try {
    const isWrite = ['set', 'analisarPdf'].includes(params.action);
    let resp;

    if (isWrite) {
      const payload = {
        ...params,
        token: GSHEET_TOKEN,
        usuario: APP?.currentUser?.login || 'sistema',
      };
      resp = await fetch(GSHEET_URL, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        signal: controller.signal,
      });
    } else {
      const url = new URL(GSHEET_URL);
      Object.entries(params).forEach(([k, v]) => {
        url.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
      });
      resp = await fetch(url.toString(), { signal: controller.signal });
    }

    clearTimeout(timeout);
    const text = await resp.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      console.warn('[GTTRCG DB] Resposta não-JSON:', text.slice(0, 200));
      return null;
    }
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === 'AbortError') {
      console.warn('[GTTRCG DB] Timeout (20s) na requisição');
    } else {
      console.warn('[GTTRCG DB] Erro de rede:', e.message);
    }
    return null;
  }
}

/**
 * Grava uma coleção no Sheets com debounce de 1.2s.
 * Nunca bloqueia a UI — falha silenciosamente com retry.
 */
function gravarNoSheets(key, data) {
  if (!GSHEET_URL || !GSHEET_TOKEN) return;

  clearTimeout(_gravarTimers[key]);
  _gravarTimers[key] = setTimeout(async () => {
    try {
      const res = await chamarAppsScript({ action: 'set', sheet: key, data });
      if (res?.ok) {
        showSyncBadge('ok', 'Salvo às ' + new Date().toLocaleTimeString('pt-BR'));
        console.log(`[GTTRCG DB] ✓ ${key} gravado no Sheets`);
      } else if (res?.error === 'TOKEN_INVALIDO') {
        showSyncBadge('offline', 'Token inválido — verifique em Configurações');
      } else {
        const msg = res?.error || 'falha';
        showSyncBadge('offline', msg);
        // Retry automático após 8s
        setTimeout(() => gravarNoSheets(key, ls(key)), 8000);
      }
    } catch (e) {
      showSyncBadge('offline', 'Sem conexão');
    }
  }, 1200);
}

/**
 * Carrega todos os dados do Sheets na inicialização.
 * NUNCA sobrescreve com dados vazios.
 * NUNCA grava de volta (evita loop).
 */
async function carregarDoSheets() {
  if (!GSHEET_URL) return false;

  try {
    showSyncBadge('carregando');
    const data = await chamarAppsScript({ action: 'getAllData' });

    if (!data || data.error) {
      showSyncBadge('offline');
      return false;
    }

    let importados = 0;
    Object.entries(data).forEach(([key, val]) => {
      if (val === null || val === undefined) return;
      if (Array.isArray(val) && val.length === 0) return;
      if (typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length === 0) return;
      // Grava direto no localStorage SEM disparar sync
      localStorage.setItem('gttrcg_' + key, JSON.stringify(val));
      importados++;
    });

    showSyncBadge('ok', `${importados} coleções carregadas`);
    console.log(`[GTTRCG DB] ${importados} coleções importadas do Sheets`);
    return true;
  } catch (e) {
    console.warn('[GTTRCG DB] Erro ao carregar do Sheets:', e.message);
    showSyncBadge('offline');
    return false;
  }
}

/**
 * Testa a conexão com o Apps Script.
 * Retorna objeto com status e mensagem.
 */
async function testarConexao() {
  try {
    const url = new URL(GSHEET_URL);
    url.searchParams.set('action', 'ping');
    const resp = await fetch(url.toString());
    const text = await resp.text();
    const data = JSON.parse(text);

    if (data.error === 'TOKEN_INVALIDO') return { ok: false, msg: 'Token inválido' };
    if (data.error) return { ok: false, msg: data.error };
    if (data.ok) return { ok: true, msg: `Conectado · ${new Date(data.ts).toLocaleTimeString('pt-BR')}` };
    return { ok: false, msg: 'Resposta inesperada' };
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}

// ============================================================
// BADGE DE SINCRONIZAÇÃO
// ============================================================

function showSyncBadge(estado, detalhe) {
  let badge = document.getElementById('sync-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'sync-badge';
    badge.style.cssText = [
      'position:fixed', 'bottom:14px', 'left:14px',
      'font-size:11px', 'padding:4px 10px', 'border-radius:20px',
      'z-index:90', 'transition:all .3s', 'pointer-events:none',
    ].join(';');
    document.body.appendChild(badge);
  }

  const configs = {
    ok:         { bg: 'rgba(63,185,80,.12)',  cor: 'var(--green)',   txt: '● Sheets sincronizado' },
    offline:    { bg: 'rgba(210,153,34,.12)', cor: 'var(--yellow2)', txt: '⚠ Modo offline' },
    carregando: { bg: 'rgba(31,111,235,.1)',  cor: 'var(--accent2)', txt: '↻ Conectando...' },
  };

  const cfg = configs[estado] || configs.offline;
  badge.style.background = cfg.bg;
  badge.style.color = cfg.cor;
  badge.style.border = `1px solid ${cfg.cor}44`;
  badge.textContent = detalhe ? `${cfg.txt} · ${detalhe}` : cfg.txt;
}

// ============================================================
// BOTÃO DE SINCRONIZAÇÃO MANUAL
// ============================================================

function addSyncButton() {
  if (document.getElementById('sync-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'sync-btn';
  btn.className = 'btn';
  btn.style.cssText = 'position:fixed;bottom:14px;right:14px;z-index:90;font-size:11px;padding:4px 12px';
  btn.innerHTML = '↻ Sincronizar';
  btn.title = 'Recarregar dados do Google Sheets';
  btn.onclick = async () => {
    btn.textContent = '…';
    btn.disabled = true;
    const ok = await carregarDoSheets();
    if (ok) {
      // Recarrega a view ativa
      const activePage = document.querySelector('.page.active')?.id?.replace('page-', '');
      if (activePage && typeof showPage === 'function') showPage(activePage);
      showToast('✓ Dados sincronizados do Google Sheets!');
    } else {
      showToast('⚠ Não foi possível conectar ao Sheets');
    }
    btn.innerHTML = '↻ Sincronizar';
    btn.disabled = false;
  };
  document.body.appendChild(btn);
}

// ============================================================
// CONFIGURAÇÃO DA CONEXÃO
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
function getApiToken() { return GSHEET_TOKEN; }

// ============================================================
// INICIALIZAÇÃO DA SINCRONIZAÇÃO
// ============================================================

/**
 * Inicializa a camada de dados.
 * Chamado pelo app.js no boot do sistema.
 * Se URL e token configurados: carrega do Sheets.
 * Caso contrário: usa localStorage existente.
 */
async function iniciarDB() {
  // Aplica configuração embutida no HTML (GTTRCG_CONFIG)
  if (typeof GTTRCG_CONFIG !== 'undefined') {
    const { appsScriptUrl, apiToken } = GTTRCG_CONFIG;
    if (appsScriptUrl && !appsScriptUrl.includes('COLE_AQUI')) {
      setAppsScriptUrl(appsScriptUrl);
    }
    if (apiToken && !apiToken.includes('COLE_AQUI') && apiToken.length > 3) {
      setApiToken(apiToken);
    }
  }

  addSyncButton();

  if (!GSHEET_URL) {
    showSyncBadge('offline', 'URL não configurada');
    return false;
  }

  const ok = await carregarDoSheets();
  return ok;
}

console.log('[GTTRCG] db.js carregado ✓');
