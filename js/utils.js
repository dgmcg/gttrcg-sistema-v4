// ============================================================
// GTTRCG v4 — utils.js
// Funções auxiliares: formatação, badges, DOM, toast, modais
// SES-PE · SECI · DGMCG
// ============================================================

/* ── Formatação de datas ── */
function fmtDate(d) {
  if (!d) return '-';
  try { return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR'); }
  catch { return d; }
}

function fmtDateISO() {
  return new Date().toISOString().split('T')[0];
}

function fmtDateTime(d) {
  if (!d) return '-';
  try { return new Date(d).toLocaleString('pt-BR'); }
  catch { return d; }
}

/* ── Formatação de duração ── */
function fmtDuracao(dias) {
  if (dias === null || dias === undefined) return '-';
  if (dias < 0) return '0d';
  if (dias < 30) return dias + 'd';
  const m = Math.floor(dias / 30);
  const d = dias % 30;
  if (m < 12) return m + 'm' + (d > 0 ? ' ' + d + 'd' : '');
  const a = Math.floor(m / 12);
  const mr = m % 12;
  return a + 'a' + (mr > 0 ? ' ' + mr + 'm' : '');
}

/* ── Formatação de moeda ── */
function fmtBRL(val) {
  if (!val && val !== 0) return '-';
  return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
}

/* ── Diferença em dias ── */
function diasEntre(d1, d2) {
  if (!d1) return null;
  const a = new Date(d1 + 'T00:00:00');
  const b = d2 ? new Date(d2 + 'T00:00:00') : new Date();
  return Math.ceil((b - a) / 86400000);
}

/* ── Gerador de ID único ── */
function genId() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

/* ── Badges de tipo de unidade ── */
function tipoBadge(t) {
  if (!t) return 'gray';
  const tl = t.toLowerCase();
  if (tl.includes('hospital') || tl.includes('maternidade')) return 'blue';
  if (tl === 'upa') return 'teal';
  if (tl === 'upae') return 'purple';
  if (tl === 'cer') return 'yellow';
  if (tl.includes('serviço') || tl.includes('servico')) return 'gray';
  return 'gray';
}

/* ── Badges de status de processo ── */
function statusBadge(s) {
  if (!s) return 'gray';
  const sl = s.toLowerCase();
  if (sl.includes('concluída') || sl.includes('assinado')) return 'green';
  if (sl.includes('remetido') || sl.includes('em processo') || sl.includes('em andamento')) return 'blue';
  if (sl.includes('aguardando') || sl.includes('finalização')) return 'yellow';
  if (sl.includes('expirado') || sl.includes('sem')) return 'red';
  return 'gray';
}

/* ── Badge HTML para status de contrato ── */
function statusContratoBadgeHtml(status) {
  const map = {
    'Vigente':  'background:rgba(29,107,59,.15);color:#1D6B3B;border:1px solid rgba(29,107,59,.3)',
    'Alerta':   'background:rgba(243,156,18,.15);color:#c07d00;border:1px solid rgba(243,156,18,.3)',
    'Expirado': 'background:rgba(218,54,51,.15);color:#C0392B;border:1px solid rgba(218,54,51,.3)',
    'Sem CG':   'background:rgba(150,150,150,.1);color:#888;border:1px solid #ccc',
    'Atenção':  'background:rgba(41,128,185,.15);color:#2980b9;border:1px solid rgba(41,128,185,.3)',
  };
  const st = map[status] || map['Sem CG'];
  return `<span style="padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap;${st}">${status || '-'}</span>`;
}

/* ── Barra de progresso ── */
function progressBar(pct, large) {
  const color = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--accent2)' : pct >= 20 ? 'var(--yellow2)' : 'var(--text3)';
  const h = large ? '8px' : '5px';
  return `<div class="progress-wrap">
    <div class="progress-bar" style="height:${h}">
      <div class="progress-bar-fill" style="width:${pct}%;background:${color}"></div>
    </div>
    <div class="progress-label">${pct}%</div>
  </div>`;
}

/* ── Toast de notificação ── */
let _toastTimer;
function showToast(msg, tipo = 'success') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  const cores = {
    success: { bg: 'var(--bg1)', border: 'var(--green2)', color: 'var(--green)' },
    error:   { bg: 'var(--bg1)', border: 'var(--red)',    color: 'var(--red2)'  },
    info:    { bg: 'var(--bg1)', border: 'var(--accent)',  color: 'var(--accent2)'},
  };
  const c = cores[tipo] || cores.success;
  toast.style.cssText = `position:fixed;bottom:24px;right:24px;background:${c.bg};border:1px solid ${c.border};color:${c.color};padding:10px 18px;border-radius:var(--radius);font-size:13px;z-index:999;box-shadow:0 4px 16px rgba(0,0,0,.4);display:block;max-width:320px`;
  toast.textContent = msg;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { toast.style.display = 'none'; }, 3000);
}

/* ── Modais ── */
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
}

/* ── Setup de eventos globais dos modais ── */
function setupModalEvents() {
  // Fechar ao clicar fora
  document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-overlay')) {
      closeModal(e.target.id);
    }
  });
  // Fechar com Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAllModals();
  });
}

/* ── Sanitizar HTML (evitar XSS básico em dados do usuário) ── */
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Truncar texto ── */
function truncate(str, max = 30) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

/* ── Slug de texto para ID ── */
function toSlug(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/* ── Verificar se usuário tem permissão de admin ── */
function isAdmin() {
  return APP?.currentUser?.perfil === 'admin';
}

function isMasterAdmin() {
  return APP?.currentUser?.login === 'admin';
}

/* ── Formatação de data para exibição relativa ── */
function fmtDataRelativa(dataStr) {
  if (!dataStr) return '-';
  const data = new Date(dataStr + 'T00:00:00');
  const hoje = new Date();
  const dias = Math.round((hoje - data) / 86400000);
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'ontem';
  if (dias < 7) return `há ${dias} dias`;
  return fmtDate(dataStr);
}

/* ── getListaItens — converte coleção do localStorage em lista label/value ── */
function getListaItens(key) {
  const data = ls(key) || [];
  if (!data.length) return [];
  if (typeof data[0] === 'string') return data.map(v => ({ label: v, value: v }));
  return data.map(item => {
    const label = [item.sigla, item.nome].filter(Boolean).join(' — ') || item.id || '';
    const value = item.sigla || item.nome || item.id || '';
    return { label, value, _item: item };
  }).filter(x => x.value);
}

/* ── Calcula cor de alerta por dias restantes ── */
function corPorDias(dias) {
  if (dias === null) return 'var(--text3)';
  if (dias < 0) return 'var(--red2)';
  if (dias < 60) return 'var(--yellow2)';
  if (dias < 180) return 'var(--accent2)';
  return 'var(--green)';
}

/* ── Debounce ── */
function debounce(fn, ms = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

console.log('[GTTRCG] utils.js carregado ✓');
