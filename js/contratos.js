// ============================================================
// contratos.js — Dashboard de Contratos de Gestão
// ============================================================

// ── Chart.js (carrega se necessário) ─────────────────────────
(function loadChartJs() {
  if (window.Chart) return;
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
  document.head.appendChild(s);
})();

let _ctCharts = {};

function destroyChart(id) {
  if (_ctCharts[id]) { _ctCharts[id].destroy(); delete _ctCharts[id]; }
}

// ── Formata BRL ───────────────────────────────────────────────
function fmtBRL(val) {
  if (!val && val !== 0) return '-';
  return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
}

// ── Badge de status do contrato ───────────────────────────────
function statusBadgeHtml(status) {
  const map = {
    'Vigente':  'background:rgba(29,107,59,.15);color:#1D6B3B;border:1px solid rgba(29,107,59,.3)',
    'Alerta':   'background:rgba(243,156,18,.15);color:#c07d00;border:1px solid rgba(243,156,18,.3)',
    'Expirado': 'background:rgba(218,54,51,.15);color:#C0392B;border:1px solid rgba(218,54,51,.3)',
    'Sem CG':   'background:rgba(150,150,150,.1);color:#888;border:1px solid rgba(150,150,150,.3)',
  };
  const st = map[status] || map['Sem CG'];
  return `<span style="padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap;${st}">${status || 'Sem CG'}</span>`;
}

// ── Cálculo dos dados de contratos ────────────────────────────
function calcContratosData() {
  const unidades = ls('unidades') || [];
  const oss = ls('oss') || [];
  const prazo = parseInt(ls('prazoAlerta') || 18);
  const hoje = new Date();

  const ossMap = {};
  oss.forEach(o => { if (o.sigla) ossMap[o.sigla] = o; });

  return unidades.map(u => {
    const cgFimDate = u.cgFim ? new Date(u.cgFim + 'T12:00:00') : null;
    const vig2Date = u.vigencia2anos ? new Date(u.vigencia2anos + 'T12:00:00') : null;

    const diasFim = cgFimDate ? Math.ceil((cgFimDate - hoje) / 86400000) : null;
    const mesesFim = diasFim !== null ? Math.floor(Math.abs(diasFim) / 30) * (diasFim < 0 ? -1 : 1) : null;
    const anosFim = diasFim !== null ? (Math.abs(diasFim) / 365).toFixed(1) : null;
    const diasVig2 = vig2Date ? Math.ceil((vig2Date - hoje) / 86400000) : null;
    const mesesVig2 = diasVig2 !== null ? Math.floor(Math.abs(diasVig2) / 30) * (diasVig2 < 0 ? -1 : 1) : null;

    let previsaoDate = null, diasParaPrevisao = null;
    if (cgFimDate) {
      previsaoDate = new Date(cgFimDate);
      previsaoDate.setMonth(previsaoDate.getMonth() - prazo);
      diasParaPrevisao = Math.ceil((previsaoDate - hoje) / 86400000);
    }

    let statusGeral = 'Sem CG';
    if (cgFimDate) {
      if (diasFim < 0) statusGeral = 'Expirado';
      else if (diasParaPrevisao !== null && diasParaPrevisao <= 0) statusGeral = 'Alerta';
      else statusGeral = 'Vigente';
    }

    const ossGestora = u.ossGestora || '';
    const ossObj = ossMap[ossGestora] || null;
    const ossSigla = ossObj ? ossObj.sigla : ossGestora;

    return { ...u, diasFim, mesesFim, anosFim, diasVig2, mesesVig2, previsaoDate, diasParaPrevisao, statusGeral, ossSigla };
  });
}

function applyCtFilters(data) {
  const q = (document.getElementById('ct-search')?.value || '').toLowerCase();
  const ossF = document.getElementById('ct-oss')?.value || '';
  const tipoF = document.getElementById('ct-tipo')?.value || '';
  const statF = (document.getElementById('ct-status')?.value || '').toLowerCase();

  return data.filter(u => {
    if (q && !u.nome?.toLowerCase().includes(q) && !u.cidade?.toLowerCase().includes(q)) return false;
    if (ossF && u.ossSigla !== ossF && u.ossGestora !== ossF) return false;
    if (tipoF && u.tipo !== tipoF) return false;
    if (statF && u.statusGeral?.toLowerCase() !== statF) return false;
    return true;
  });
}

// ── Build linha da tabela ─────────────────────────────────────
function buildCtRow(u) {
  const prazo = parseInt(ls('prazoAlerta') || 18);
  const diasLabel = u.diasFim === null ? '-'
    : u.diasFim < 0 ? `<span style="color:var(--red2)">${u.diasFim}d / ${Math.abs(u.mesesFim)}m</span>`
    : `${u.diasFim}d / ${u.mesesFim}m / ${u.anosFim}a`;

  const vig2Label = u.diasVig2 === null ? '-'
    : `${fmtDate(u.vigencia2anos)} <small style="color:${u.diasVig2 < 0 ? 'var(--red2)' : 'var(--text3)'}">(${u.diasVig2 < 0 ? 'Venc. há ' : '+'}${Math.abs(u.diasVig2)}d)</small>`;

  const prevCor = u.diasParaPrevisao === null ? '' : u.diasParaPrevisao < 0 ? 'var(--red2)' : u.diasParaPrevisao < 60 ? 'var(--yellow2)' : '';
  const prevLabel = u.previsaoDate
    ? `<span style="color:${prevCor}">${fmtDate(u.previsaoDate.toISOString().slice(0, 10))}${u.diasParaPrevisao < 0 ? ' ⚠' : ''}</span>`
    : '-';

  // ── Início do Novo Processo ─────────────────────────────────
  // Busca o processo mais recente (maior data de início) cujo nome
  // de unidade coincide com o desta linha na tabela de contratos.
  const processos = ls('processos') || [];
  const procsDaUnidade = processos.filter(p =>
    p.nome && u.nome &&
    p.nome.trim().toLowerCase() === u.nome.trim().toLowerCase()
  );
  let inicioNovoProc = null;
  if (procsDaUnidade.length > 0) {
    const maisRecente = procsDaUnidade.reduce((a, b) => {
      const da = a.inicio ? new Date(a.inicio) : new Date(0);
      const db = b.inicio ? new Date(b.inicio) : new Date(0);
      return da >= db ? a : b;
    });
    inicioNovoProc = maisRecente.inicio || null;
  }
  const inicioLabel = inicioNovoProc
    ? `<span style="color:var(--green);font-weight:500">${fmtDate(inicioNovoProc)}</span>`
    : `<span style="color:var(--text3)">—</span>`;

  const repasseLabel = u.repasse ? `<span style="font-family:var(--mono);font-size:11px">${fmtBRL(u.repasse)}</span>` : '-';

  return `<tr style="cursor:pointer" onclick="openEditarDadoFixo('unidades','${u.id}')" title="Clique para editar">
    <td>
      <div style="font-weight:500;font-size:13px">${u.nome}</div>
      <div style="font-size:11px;color:var(--text3)">${u.cidade || ''}</div>
      <div style="margin-top:3px">${statusBadgeHtml(u.statusCG || '-')}</div>
    </td>
    <td><span class="badge ${tipoBadge(u.tipo)}">${u.tipo || '-'}</span></td>
    <td style="font-weight:600;font-size:12px">${u.ossSigla || u.ossGestora || '-'}</td>
    <td style="font-family:var(--mono);font-size:12px">${u.cg || '-'}</td>
    <td style="font-family:var(--mono);font-size:12px">${fmtDate(u.cgFim)}</td>
    <td style="font-size:12px">${vig2Label}</td>
    <td style="font-size:12px">${prevLabel}</td>
    <td style="font-size:12px">${inicioLabel}</td>
    <td style="font-family:var(--mono);font-size:12px">${diasLabel}</td>
    <td>${statusBadgeHtml(u.statusGeral)}</td>
    <td style="font-size:11px;text-align:right">${repasseLabel}</td>
  </tr>`;
}

// ── Render principal ──────────────────────────────────────────
function renderContratos() {
  const all = calcContratosData();
  const data = applyCtFilters(all).sort((a, b) => (a.diasFim ?? 99999) - (b.diasFim ?? 99999));

  // Popula filtros
  const ossSet = [...new Set(all.map(u => u.ossSigla).filter(Boolean))].sort();
  const tipoSet = [...new Set(all.map(u => u.tipo).filter(Boolean))].sort();
  const ossEl = document.getElementById('ct-oss');
  const tipoEl = document.getElementById('ct-tipo');
  if (ossEl && ossEl.options.length <= 1) ossSet.forEach(o => ossEl.add(new Option(o, o)));
  if (tipoEl && tipoEl.options.length <= 1) tipoSet.forEach(t => tipoEl.add(new Option(t, t)));

  // KPIs
  const vigentes = data.filter(u => u.statusGeral === 'Vigente').length;
  const alertas = data.filter(u => u.statusGeral === 'Alerta').length;
  const expirados = data.filter(u => u.statusGeral === 'Expirado').length;
  const semCG = data.filter(u => u.statusGeral === 'Sem CG').length;
  const prevVenc = data.filter(u => u.diasParaPrevisao !== null && u.diasParaPrevisao < 0 && u.statusGeral !== 'Expirado').length;
  const comCG = data.filter(u => u.cgFim).length;
  const atencao1a = data.filter(u => u.diasFim !== null && u.diasFim > 0 && u.diasFim < 365).length;
  const totalRepasse = data.reduce((s, u) => s + (Number(u.repasse) || 0), 0);

  const kpis = [
    { label: 'Vigentes', val: vigentes, cor: '#1D6B3B', bg: 'rgba(29,107,59,.1)' },
    { label: 'Atenção (<1 ano)', val: atencao1a, cor: '#2980b9', bg: 'rgba(41,128,185,.1)' },
    { label: `Alerta (<${ls('prazoAlerta') || 18}m)`, val: alertas, cor: '#c07d00', bg: 'rgba(243,156,18,.1)' },
    { label: 'Expirados', val: expirados, cor: '#C0392B', bg: 'rgba(218,54,51,.1)' },
    { label: 'Prev. Vencida', val: prevVenc, cor: '#8e44ad', bg: 'rgba(142,68,173,.1)' },
    { label: 'Total com CG', val: comCG, cor: '#555', bg: 'rgba(0,0,0,.05)' },
  ];
  const kpisEl = document.getElementById('ct-kpis');
  if (kpisEl) {
    kpisEl.innerHTML = kpis.map(k =>
      `<div style="background:${k.bg};border:1px solid ${k.cor}33;border-radius:var(--radius2);padding:12px;text-align:center">
        <div style="font-size:28px;font-weight:700;color:${k.cor}">${k.val}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">${k.label}</div>
      </div>`
    ).join('') + (totalRepasse > 0 ? `<div style="background:rgba(29,107,59,.1);border:1px solid rgba(29,107,59,.3);border-radius:var(--radius2);padding:12px;text-align:center;grid-column:1/-1">
      <div style="font-size:16px;font-weight:700;color:var(--green)">${fmtBRL(totalRepasse)}/mês</div>
      <div style="font-size:11px;color:var(--text3);margin-top:2px">Repasse Mensal Total do Portfólio</div>
    </div>` : '');
  }

  // Top 10 críticos
  const criticos = [...data].filter(u => u.diasFim !== null).sort((a, b) => a.diasFim - b.diasFim).slice(0, 10);
  const criticosEl = document.getElementById('ct-criticos');
  if (criticosEl) {
    criticosEl.innerHTML = criticos.length ? criticos.map((u, i) => {
      const cor = u.diasFim < 0 ? 'var(--red2)' : u.diasFim < 180 ? 'var(--yellow2)' : 'var(--green)';
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px">
        <div><span style="color:var(--text3);margin-right:6px">${i + 1}.</span>${u.nome}<div style="font-size:10px;color:var(--text3)">${u.cidade || ''} · ${u.ossSigla || 'Sem OSS'}</div></div>
        <span style="font-weight:600;color:${cor};font-family:var(--mono)">${u.diasFim < 0 ? 'Exp.' : u.diasFim + 'd'}</span>
      </div>`;
    }).join('') : '<div style="color:var(--text3);font-size:12px">Nenhum dado</div>';
  }

  // Distribuição de status
  const distData = [
    { label: 'Vigente', val: vigentes, cor: '#1D6B3B' },
    { label: 'Alerta', val: alertas, cor: '#c07d00' },
    { label: 'Expirado', val: expirados, cor: '#C0392B' },
    { label: 'Sem CG', val: semCG, cor: '#999' },
  ];
  const distEl = document.getElementById('ct-status-dist');
  if (distEl) {
    distEl.innerHTML = distData.map(d => {
      const pct = all.length > 0 ? Math.round((d.val / all.length) * 100) : 0;
      return `<div style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
          <span>${d.label}</span><span style="font-weight:600;color:${d.cor}">${d.val} (${pct}%)</span>
        </div>
        <div style="height:6px;background:var(--border);border-radius:3px">
          <div style="height:100%;width:${pct}%;background:${d.cor};border-radius:3px;transition:width .4s"></div>
        </div>
      </div>`;
    }).join('');
  }

  // Tabela lista
  const tbody = document.getElementById('ct-tbody');
  const empty = document.getElementById('ct-empty');
  if (tbody) {
    tbody.innerHTML = data.map(buildCtRow).join('');
    if (empty) empty.style.display = data.length ? 'none' : 'block';
  }

  // Sub-abas
  renderCtPorOss(data, ossSet);
  if (document.getElementById('tab-ct-graficos')?.classList.contains('active')) {
    renderCtGraficos(data);
  }
}

// ── Sub-aba Por OSS ───────────────────────────────────────────
function renderCtPorOss(data, ossSet) {
  const container = document.getElementById('ct-por-oss');
  if (!container) return;
  const semOss = data.filter(u => !u.ossSigla);
  const grupos = [...(ossSet || [...new Set(data.map(u => u.ossSigla).filter(Boolean))].sort()), ...(semOss.length ? ['Sem OSS'] : [])];

  container.innerHTML = grupos.map(ossKey => {
    const unids = ossKey === 'Sem OSS'
      ? data.filter(u => !u.ossSigla)
      : data.filter(u => u.ossSigla === ossKey);
    if (!unids.length) return '';
    const totalRepasse = unids.reduce((s, u) => s + (Number(u.repasse) || 0), 0);

    return `<div class="config-section" style="margin-bottom:14px">
      <div class="config-section-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
        <div class="config-section-title">🏥 ${ossKey} <small style="font-weight:400;color:var(--text3)">${unids.length} unidade${unids.length !== 1 ? 's' : ''}</small></div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          ${totalRepasse > 0 ? `<span style="font-size:11px;font-weight:600;color:var(--green)">${fmtBRL(totalRepasse)}/mês</span>` : ''}
        </div>
      </div>
      <div class="config-section-body" style="padding:0;overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="background:var(--bg2)">
            <th style="padding:8px 10px;text-align:left;font-size:11px;color:var(--text2)">UNIDADE</th>
            <th style="padding:8px 10px;text-align:left;font-size:11px;color:var(--text2)">TIPO</th>
            <th style="padding:8px 10px;text-align:left;font-size:11px;color:var(--text2)">OSS</th>
            <th style="padding:8px 10px;text-align:left;font-size:11px;color:var(--text2)">Nº CG</th>
            <th style="padding:8px 10px;text-align:left;font-size:11px;color:var(--text2)">Fim CG</th>
            <th style="padding:8px 10px;text-align:left;font-size:11px;color:var(--text2)">Fim Vig. 2A</th>
            <th style="padding:8px 10px;text-align:left;font-size:11px;color:var(--text2)">Previsão Novo</th>
            <th style="padding:8px 10px;text-align:left;font-size:11px;color:var(--text2)">Início Novo Proc.</th>
            <th style="padding:8px 10px;text-align:left;font-size:11px;color:var(--text2)">Dias p/ Fim</th>
            <th style="padding:8px 10px;text-align:left;font-size:11px;color:var(--text2)">Status</th>
            <th style="padding:8px 10px;text-align:right;font-size:11px;color:var(--text2)">Repasse</th>
          </tr></thead>
          <tbody>${unids.sort((a, b) => (a.diasFim ?? 99999) - (b.diasFim ?? 99999)).map(buildCtRow).join('')}</tbody>
          <tfoot><tr>
            <td colspan="10" style="text-align:right;font-size:11px;color:var(--text3);padding:6px 10px">Total:</td>
            <td style="text-align:right;font-weight:700;font-size:12px;color:var(--green);font-family:var(--mono);padding:6px 10px">${fmtBRL(totalRepasse)}/mês</td>
          </tr></tfoot>
        </table>
      </div>
    </div>`;
  }).join('');
}

// ── Gráficos Chart.js ─────────────────────────────────────────
function renderCtGraficos(data) {
  if (!window.Chart) { setTimeout(() => renderCtGraficos(data), 500); return; }

  const paleta = ['#1B3A6B', '#1D6B3B', '#c07d00', '#C0392B', '#8e44ad', '#2980b9', '#16a085', '#d35400', '#2c3e50', '#7f8c8d'];

  // 1. Barras: total por OSS
  {
    const ossSet = {};
    data.forEach(u => { const k = u.ossSigla || 'Sem OSS'; ossSet[k] = (ossSet[k] || 0) + 1; });
    const labels = Object.keys(ossSet).sort((a, b) => ossSet[b] - ossSet[a]);
    const vals = labels.map(k => ossSet[k]);
    destroyChart('chart-oss');
    const canvas = document.getElementById('chart-oss');
    if (canvas) _ctCharts['chart-oss'] = new Chart(canvas, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Unidades', data: vals, backgroundColor: labels.map((_, i) => paleta[i % paleta.length] + 'CC'), borderRadius: 6, borderWidth: 0 }] },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });
  }

  // 2. Doughnut: distribuição por tipo
  {
    const tipoSet = {};
    data.forEach(u => { const k = u.tipo || 'N/D'; tipoSet[k] = (tipoSet[k] || 0) + 1; });
    const labels = Object.keys(tipoSet).sort((a, b) => tipoSet[b] - tipoSet[a]);
    const vals = labels.map(k => tipoSet[k]);
    destroyChart('chart-tipo');
    const canvas = document.getElementById('chart-tipo');
    if (canvas) _ctCharts['chart-tipo'] = new Chart(canvas, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: vals, backgroundColor: labels.map((_, i) => paleta[i % paleta.length] + 'DD'), borderWidth: 2, borderColor: 'var(--bg1)' }] },
      options: { responsive: true, cutout: '55%', plugins: { legend: { position: 'right', labels: { font: { size: 11 }, padding: 10 } } } }
    });
  }

  // 3. Barras empilhadas: status por OSS
  {
    const ossKeys = [...new Set(data.map(u => u.ossSigla || 'Sem OSS'))].sort();
    const statusKeys = ['Vigente', 'Alerta', 'Expirado', 'Sem CG'];
    const statusCores = { Vigente: '#1D6B3BCC', Alerta: '#c07d00CC', Expirado: '#C0392BCC', 'Sem CG': '#99999988' };
    const datasets = statusKeys.map(s => ({
      label: s,
      data: ossKeys.map(o => data.filter(u => (u.ossSigla || 'Sem OSS') === o && u.statusGeral === s).length),
      backgroundColor: statusCores[s], borderRadius: 3, borderWidth: 0,
    }));
    destroyChart('chart-status-oss');
    const canvas = document.getElementById('chart-status-oss');
    if (canvas) _ctCharts['chart-status-oss'] = new Chart(canvas, {
      type: 'bar',
      data: { labels: ossKeys, datasets },
      options: { responsive: true, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } } }, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } }, tooltip: { mode: 'index', intersect: false } } }
    });
  }

  // 4. Barras: vencimentos por trimestre
  {
    const trimMap = {};
    data.forEach(u => {
      if (!u.cgFim) return;
      const d = new Date(u.cgFim + 'T12:00:00');
      const yr = d.getFullYear();
      const q = Math.ceil((d.getMonth() + 1) / 3);
      const k = `${yr} Q${q}`;
      trimMap[k] = (trimMap[k] || 0) + 1;
    });
    const labels = Object.keys(trimMap).sort();
    const vals = labels.map(k => trimMap[k]);
    const hoje = new Date();
    const bgColors = labels.map(k => {
      const [yr, q] = k.split(' Q').map(Number);
      const fim = new Date(yr, q * 3, 0);
      return fim < hoje ? '#C0392BCC' : fim < new Date(hoje.getFullYear() + 1, hoje.getMonth(), 1) ? '#c07d00CC' : '#1B3A6BCC';
    });
    destroyChart('chart-trimestre');
    const canvas = document.getElementById('chart-trimestre');
    if (canvas) _ctCharts['chart-trimestre'] = new Chart(canvas, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Contratos', data: vals, backgroundColor: bgColors, borderRadius: 5, borderWidth: 0 }] },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } }, x: { ticks: { font: { size: 10 }, maxRotation: 45 } } } }
    });
  }

  // 5. Repasse por OSS
  {
    const ossRepasse = {};
    data.forEach(u => {
      const k = u.ossSigla || 'Sem OSS';
      ossRepasse[k] = (ossRepasse[k] || 0) + (Number(u.repasse) || 0);
    });
    const sorted = Object.entries(ossRepasse).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a);
    const labels = sorted.map(([k]) => k);
    const vals = sorted.map(([, v]) => v);
    destroyChart('chart-repasse');
    const canvas = document.getElementById('chart-repasse');
    if (canvas && labels.length) _ctCharts['chart-repasse'] = new Chart(canvas, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Repasse Mensal (R$)', data: vals, backgroundColor: labels.map((_, i) => paleta[i % paleta.length] + 'CC'), borderRadius: 6, borderWidth: 0 }] },
      options: {
        responsive: true,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => fmtBRL(c.parsed.y) + '/mês' } } },
        scales: { y: { beginAtZero: true, ticks: { callback: v => 'R$ ' + (v / 1000000).toFixed(1) + 'M' } }, x: { ticks: { font: { size: 11 } } } }
      }
    });
  }
}

// ── Switch de sub-abas ────────────────────────────────────────
function switchCtTab(tabId, el) {
  document.querySelectorAll('#ct-tabs .tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#page-contratos .tab-content').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  const panel = document.getElementById('tab-' + tabId);
  if (panel) panel.classList.add('active');
  if (tabId === 'ct-graficos') {
    const data = applyCtFilters(calcContratosData()).sort((a, b) => (a.diasFim ?? 99999) - (b.diasFim ?? 99999));
    setTimeout(() => renderCtGraficos(data), 50);
  }
}
