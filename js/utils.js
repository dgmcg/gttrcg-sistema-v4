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
  // Passa por closeModal para respeitar o aviso de alterações não salvas
  document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id));
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

/* ── Etapas aplicáveis a um processo ──────────────────────────
 *
 * Cada etapa do fluxo declara a quais tipos de processo pertence
 * (campo "tipos", no formato "Tipo A; Tipo B"). Esta função devolve
 * apenas as etapas do tipo do processo informado — é a fonte única
 * dessa regra em todo o sistema (progresso, frentes, linha do tempo,
 * alertas, Kanban e o acompanhamento).
 *
 * Duas salvaguardas deliberadas, para nunca esconder trabalho já feito:
 *  • processo sem tipo definido → recebe todas as etapas;
 *  • etapa sem tipo definido    → vale para todos os tipos.
 */
function etapasDoProcesso(processo, etapas) {
  const todas = etapas || ls('etapasFluxo') || [];
  const tipoProc = (processo?.tipoProcesso || '').trim();
  if (!tipoProc) return todas;
  return todas.filter(e => {
    const tiposEtapa = multiParaArray(e.tipos);
    if (!tiposEtapa.length) return true;
    return tiposEtapa.includes(tipoProc);
  });
}

/** Etapas que o processo NÃO usa — para avisar antes de trocar o tipo. */
function etapasForaDoTipo(processo, tipoNovo, etapas) {
  const todas = etapas || ls('etapasFluxo') || [];
  const alvo = (tipoNovo || '').trim();
  if (!alvo) return [];
  return todas.filter(e => {
    const tiposEtapa = multiParaArray(e.tipos);
    return tiposEtapa.length && !tiposEtapa.includes(alvo);
  });
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

// ── OSS: sigla → nome completo ────────────────────────────────
/**
 * Retorna o nome completo da OSS a partir da sigla cadastrada.
 * Usado para tooltips (atributo title) nas listagens.
 * Se a OSS não existir no cadastro, devolve string vazia — não
 * inventa nome nem repete a sigla.
 */
function nomeOssPorSigla(sigla) {
  if (!sigla) return '';
  const oss = ls('oss') || [];
  const achou = oss.find(o =>
    (o.sigla || '').trim().toLowerCase() === String(sigla).trim().toLowerCase()
  );
  return achou?.nome || '';
}

/** Monta o HTML de uma sigla de OSS com tooltip do nome completo. */
function ossComTooltip(sigla, estilo) {
  if (!sigla) return '<span style="color:var(--text3)">-</span>';
  const nome = nomeOssPorSigla(sigla);
  const style = estilo || '';
  return nome
    ? `<span style="${style};border-bottom:1px dotted var(--text3);cursor:help" title="${nome.replace(/"/g,'&quot;')}">${sigla}</span>`
    : `<span style="${style}">${sigla}</span>`;
}

// ── TEMA DE VISUALIZAÇÃO (escuro / claro) ─────────────────────
/**
 * Aplica o tema e persiste a escolha.
 *
 * A preferência é de INTERFACE, não de negócio: fica no navegador
 * (localStorage), não no Google Sheets. Padrão: escuro.
 *
 * O CSS define as cores em variáveis sob :root e :root[data-tema="claro"],
 * então trocar o atributo troca o sistema inteiro de uma vez.
 */
function aplicarTema(tema) {
  const claro = tema === 'claro';
  if (claro) document.documentElement.setAttribute('data-tema', 'claro');
  else       document.documentElement.removeAttribute('data-tema');

  try { localStorage.setItem('gttrcg_tema', claro ? 'claro' : 'escuro'); } catch (e) {}

  // Marca visualmente o botão ativo
  const btnE = document.getElementById('btn-tema-escuro');
  const btnC = document.getElementById('btn-tema-claro');
  if (btnE) btnE.classList.toggle('ativo', !claro);
  if (btnC) btnC.classList.toggle('ativo', claro);

  // Redesenha os gráficos, que são pintados em canvas e não acompanham CSS
  if (typeof Chart !== 'undefined' && typeof renderCtGraficos === 'function') {
    const abaGraf = document.getElementById('tab-ct-graficos');
    if (abaGraf?.classList.contains('active') && typeof calcContratosData === 'function') {
      try { renderCtGraficos(applyCtFilters(calcContratosData())); } catch (e) {}
    }
  }
}

/** Lê o tema salvo; devolve 'escuro' quando nada foi escolhido ainda. */
function getTemaAtual() {
  try { return localStorage.getItem('gttrcg_tema') === 'claro' ? 'claro' : 'escuro'; }
  catch (e) { return 'escuro'; }
}

// Sincroniza o estado dos botões assim que o DOM estiver pronto
// (o tema em si já foi aplicado pelo script inline do <head>)
document.addEventListener('DOMContentLoaded', () => aplicarTema(getTemaAtual()));

// ── CAMPO LISTA FIXA DE MÚLTIPLA ESCOLHA ──────────────────────
// Armazenamento: texto separado por "; " (ex.: "SEAS; DGLCA").
// Escolhido em vez de JSON para permanecer legível na planilha,
// pesquisável pela busca do sistema e utilizável em fórmulas do Sheets.
const MULTI_SEP = '; ';

/** Converte o valor gravado em array de opções selecionadas. */
function multiParaArray(valor) {
  if (!valor) return [];
  if (Array.isArray(valor)) return valor.filter(Boolean);
  return String(valor).split(';').map(v => v.trim()).filter(Boolean);
}

/** Converte um array de opções no texto a ser gravado. */
function multiParaTexto(arr) {
  return (arr || []).filter(Boolean).join(MULTI_SEP);
}

/**
 * Monta o widget de múltipla escolha.
 *
 * O valor consolidado vive num <input type="hidden"> que recebe os
 * mesmos atributos de dados do campo (data-etapa/data-campo ou
 * data-fieldkey). Assim as rotinas de salvamento já existentes
 * continuam funcionando sem qualquer alteração.
 *
 * @param {string} fid       id do input oculto
 * @param {string} listaFonte  coleção de onde vêm as opções
 * @param {string} valorAtual  texto gravado ("A; B")
 * @param {string} attrsHidden atributos extras do input oculto
 * @param {boolean} desabilitado
 */
function renderCampoMultiSelect(fid, listaFonte, valorAtual, attrsHidden, desabilitado) {
  const itens = typeof getListaItens === 'function' ? getListaItens(listaFonte) : [];
  const sel = multiParaArray(valorAtual);
  const dis = desabilitado ? 'disabled' : '';

  if (!itens.length) {
    return `<input type="hidden" id="${fid}" ${attrsHidden || ''} value="${(valorAtual || '').replace(/"/g, '&quot;')}">
      <div style="font-size:11px;color:var(--text3);padding:6px 8px;background:var(--bg2);border:1px dashed var(--border2);border-radius:var(--radius)">
        Nenhum item cadastrado na lista "${listaFonte}".
      </div>`;
  }

  const opcoes = itens.map(it => {
    const v = String(it.value);
    const marcado = sel.includes(v) ? 'checked' : '';
    return `<label class="multi-opcao">
      <input type="checkbox" value="${v.replace(/"/g, '&quot;')}" data-multi-alvo="${fid}" ${marcado} ${dis}
             onchange="atualizarMultiSelect(this)">
      <span>${it.label}</span>
    </label>`;
  }).join('');

  return `<input type="hidden" id="${fid}" ${attrsHidden || ''} value="${multiParaTexto(sel).replace(/"/g, '&quot;')}">
    <details class="multi-select" id="${fid}_box">
      <summary>
        <span id="${fid}_resumo">${_multiResumoTexto(sel)}</span>
        <svg viewBox="0 0 16 16" fill="currentColor" width="10" height="10" style="flex-shrink:0;opacity:.6">
          <path d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
        </svg>
      </summary>
      <div class="multi-opcoes">${opcoes}</div>
    </details>`;
}

/** Texto-resumo exibido no cabeçalho do widget. */
function _multiResumoTexto(sel) {
  if (!sel.length) return '<span style="color:var(--text3)">Nenhum selecionado</span>';
  if (sel.length <= 2) return sel.join(', ');
  return `${sel.length} selecionados`;
}

/**
 * Chamado a cada marcação/desmarcação: consolida os valores no input
 * oculto e atualiza o resumo. É o único ponto que escreve o valor.
 */
function atualizarMultiSelect(cb) {
  const fid = cb.dataset.multiAlvo;
  if (!fid) return;
  const marcados = Array.from(
    document.querySelectorAll(`input[type="checkbox"][data-multi-alvo="${CSS.escape(fid)}"]`)
  ).filter(x => x.checked).map(x => x.value);

  const hidden = document.getElementById(fid);
  if (hidden) {
    hidden.value = multiParaTexto(marcados);
    // Notifica quem escuta 'change' (cálculo de progresso ao vivo, rastreio de alterações)
    hidden.dispatchEvent(new Event('change', { bubbles: true }));
  }
  const resumo = document.getElementById(fid + '_resumo');
  if (resumo) resumo.innerHTML = _multiResumoTexto(marcados);
}
