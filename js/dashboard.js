// ============================================================
// GTTRCG — dashboard.js
// Responsabilidades:
//   - Painel de controle (3 abas)
//   - Aba "Visão Geral": KPIs, gráficos de barras, tabela recente
//   - Aba "Equipe & Atribuições": KPIs, barras por usuário, Gantt SVG
//   - Aba "Tempos de Conclusão": duração por processo, médias por fase
// ============================================================

// ============================================================
// CÁLCULO DE PROGRESSO
// ============================================================

function calcProgressoEtapa(etapa, acomp) {
  const ac     = acomp || {};
  const campos = (etapa.campos || []).filter(c => c.tipo !== 'pdf');
  const total  = 1 + campos.length + 1;
  let preenchidos = 0;
  if (ac._iniciado) preenchidos++;
  campos.forEach(c => {
    const val = ac[c.label];
    if (val !== undefined && val !== null && val !== '' && val !== false) preenchidos++;
  });
  if (ac._concluido) preenchidos++;
  return { pct: Math.round((preenchidos / total) * 100), preenchidos, total };
}

function calcProgressoProcesso(processo, etapas) {
  if (!etapas || !etapas.length) return 0;
  const ac = processo.acompanhamento || {};
  let totalCriterios = 0, preenchidosTotal = 0;
  etapas.forEach(e => {
    const res = calcProgressoEtapa(e, ac[e.id] || {});
    totalCriterios   += res.total;
    preenchidosTotal += res.preenchidos;
  });
  return totalCriterios === 0 ? 0 : Math.round((preenchidosTotal / totalCriterios) * 100);
}

// ============================================================
// HELPERS DE TEMPO
// ============================================================

// diasEntre, fmtDuracao → utils.js

function processoEstaConcluido(p, etapas) {
  const sorted = etapasOrdenadas(etapas);
  const ultima = sorted[sorted.length - 1];
  if (!ultima) return false;
  return !!(p.acompanhamento?.[ultima.id]?._concluido);
}

function getDuracaoProcesso(p, etapas) {
  if (!p.inicio) return null;
  if (processoEstaConcluido(p, etapas)) {
    const sorted   = etapasOrdenadas(etapas);
    const ultima   = sorted[sorted.length - 1];
    const concData = p.acompanhamento?.[ultima?.id]?._concluido_em;
    return { dias: diasEntre(p.inicio, concData || null), concluido: true };
  }
  return { dias: diasEntre(p.inicio, null), concluido: false };
}

function etapasOrdenadas(etapas) {
  const fo = { planejamento: 0, externa: 1, contratacao: 2 };
  return [...etapas].sort((a, b) => {
    if (fo[a.fase] !== fo[b.fase]) return fo[a.fase] - fo[b.fase];
    return (a.ordem || 0) - (b.ordem || 0);
  });
}

// ============================================================
// ABA: VISÃO GERAL
// ============================================================

function renderDashboard() {
  const today    = new Date();
  const el       = document.getElementById('dashboard-date');
  if (el) el.textContent = today.toLocaleDateString('pt-BR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const processos = ls('processos') || [];
  const etapas    = ls('etapasFluxo') || [];
  const andamento = processos.filter(p =>
    !['Aguardando Início do Processo','Contratação Concluída'].includes(p.status)
  );
  const remetidos  = processos.filter(p => p.status?.toLowerCase().includes('remetido'));
  const concluidos = processos.filter(p => p.status?.toLowerCase().includes('concluída'));
  const alertas    = typeof gerarAlertas === 'function' ? gerarAlertas() : [];

  // KPI cards
  const statsGrid = document.getElementById('stats-grid');
  if (statsGrid) {
    statsGrid.innerHTML = `
      <div class="stat-card blue">
        <div class="label">Total de Processos</div>
        <div class="value">${processos.length}</div>
        <div class="sub">Em acompanhamento</div>
      </div>
      <div class="stat-card yellow">
        <div class="label">Em Andamento</div>
        <div class="value">${andamento.length}</div>
        <div class="sub">Processos ativos</div>
      </div>
      <div class="stat-card blue">
        <div class="label">Remetidos à SAD</div>
        <div class="value">${remetidos.length}</div>
        <div class="sub">Fase externa</div>
      </div>
      <div class="stat-card green">
        <div class="label">Concluídos</div>
        <div class="value">${concluidos.length}</div>
        <div class="sub">Contratos assinados</div>
      </div>
      <div class="stat-card red">
        <div class="label">Alertas</div>
        <div class="value">${alertas.length}</div>
        <div class="sub">Requerem atenção</div>
      </div>`;
  }

  updateSidebarCounts();
  renderChartsGeral(processos);
  renderDashboardTabela(processos, etapas);
}

function renderChartsGeral(processos) {
  const chartsRow = document.getElementById('charts-row');
  if (!chartsRow) return;

  const statusCount = {};
  processos.forEach(p => {
    const s = p.status || 'Sem status';
    statusCount[s] = (statusCount[s] || 0) + 1;
  });

  const tipoCount = {};
  processos.forEach(p => {
    const t = p.tipo || 'Outro';
    tipoCount[t] = (tipoCount[t] || 0) + 1;
  });

  const topStatus = Object.entries(statusCount).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxS = Math.max(...topStatus.map(x => x[1]), 1);
  const barColors = ['var(--accent2)','var(--green)','var(--yellow2)','var(--purple)','var(--red2)','var(--teal)'];

  const barsStatus = topStatus.map(([s, n], i) => `
    <div class="bar-row">
      <div class="bar-label" title="${s}">${s.length > 28 ? s.slice(0,26)+'…' : s}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(n/maxS)*100}%;background:${barColors[i%6]}"></div></div>
      <div class="bar-value">${n}</div>
    </div>`).join('');

  const tipoEntries = Object.entries(tipoCount).sort((a, b) => b[1] - a[1]);
  const maxT = Math.max(...tipoEntries.map(x => x[1]), 1);
  const barsTipo = tipoEntries.map(([t, n], i) => `
    <div class="bar-row">
      <div class="bar-label">${t}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(n/maxT)*100}%;background:${barColors[i%6]}"></div></div>
      <div class="bar-value">${n}</div>
    </div>`).join('');

  chartsRow.innerHTML = `
    <div class="chart-wrap">
      <div class="chart-title">Processos por Status</div>
      <div class="bar-chart">${barsStatus || '<div style="color:var(--text3);font-size:12px">Sem processos</div>'}</div>
    </div>
    <div class="chart-wrap">
      <div class="chart-title">Processos por Tipo de Unidade</div>
      <div class="bar-chart">${barsTipo || '<div style="color:var(--text3);font-size:12px">Sem processos</div>'}</div>
    </div>`;
}

function renderDashboardTabela(processos, etapas) {
  const tbody = document.getElementById('dashboard-tbody');
  if (!tbody) return;

  if (!processos.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text3)">Nenhum processo cadastrado</td></tr>`;
    return;
  }

  tbody.innerHTML = processos.slice(0, 10).map(p => {
    const dur = getDuracaoProcesso(p, etapas);
    const durHtml = dur
      ? `<span style="font-size:12px;color:${dur.concluido?'var(--green)':dur.dias>180?'var(--red2)':'var(--text3)'};font-family:var(--mono)">${dur.concluido?'✓ ':'⏱ '}${fmtDuracao(dur.dias)}</span>`
      : '-';

    return `
      <tr onclick="openDetalhe('${p.id}')">
        <td><div class="td-name">${p.nome}</div><div class="td-sub">${p.municipio||''}</div></td>
        <td><span class="badge ${tipoBadge(p.tipo)}">${p.tipo||'-'}</span></td>
        <td><span class="badge ${statusBadge(p.status)}" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;display:inline-block">${p.status||'-'}</span></td>
        <td>${progressBar(p.progresso||0)}</td>
        <td style="color:var(--text3)">${fmtDate(p.inicio)}</td>
        <td>${durHtml}</td>
      </tr>`;
  }).join('');

  // Adiciona coluna "Duração" no thead se ainda não existir
  const thead = document.querySelector('#dashboard-table thead tr');
  if (thead && !thead.querySelector('.timer-th')) {
    const th = document.createElement('th');
    th.className = 'timer-th';
    th.textContent = 'Duração';
    thead.appendChild(th);
  }
}

// ============================================================
// SWITCH DE ABA DO DASHBOARD
// ============================================================

function switchDashTab(tab, el) {
  ['geral','equipe','tempos'].forEach(t => {
    const p = document.getElementById('dash-panel-' + t);
    if (p) p.style.display = 'none';
    const tb = document.getElementById('dash-tab-' + t);
    if (tb) tb.classList.remove('active');
  });

  const panel = document.getElementById('dash-panel-' + tab);
  if (panel) panel.style.display = '';
  if (el) el.classList.add('active');

  if (tab === 'equipe') renderDashEquipe();
  if (tab === 'tempos') renderDashTempos();
}

// ============================================================
// ABA: EQUIPE & ATRIBUIÇÕES
// ============================================================

function renderDashEquipe() {
  const panel = document.getElementById('dash-panel-equipe');
  if (!panel) return;

  const processos = ls('processos')    || [];
  const etapas    = ls('etapasFluxo') || [];
  const usuarios  = getUsuariosAtribuicao();
  const hoje      = new Date();

  // Constrói estatísticas por usuário
  const userStats = {};
  usuarios.forEach(u => {
    userStats[u.login] = {
      nome: u.nome, total: 0, concluidas: 0, noprazo: 0, atividades: [],
    };
  });

  processos.forEach(p => {
    etapas.forEach(e => {
      const ac = p.acompanhamento?.[e.id] || {};
      if (!ac._responsavel || !userStats[ac._responsavel]) return;
      const us    = userStats[ac._responsavel];
      const prazo = ac._prazo ? new Date(ac._prazo + 'T23:59:59') : null;
      const concD = ac._concluido_em ? new Date(ac._concluido_em) : null;
      us.total++;
      if (ac._concluido) {
        us.concluidas++;
        if (prazo && concD && concD <= prazo) us.noprazo++;
      }
      us.atividades.push({
        procId: p.id, procNome: p.nome, etapaNome: e.nome,
        inicio: ac._iniciado_em || p.inicio || null,
        prazo: ac._prazo || null,
        concluida: !!ac._concluido,
        concData: ac._concluido_em || null,
        atrasada: prazo && !ac._concluido && hoje > prazo,
      });
    });
  });

  const totalAtrib = Object.values(userStats).reduce((s, u) => s + u.total, 0);
  const totalConc  = Object.values(userStats).reduce((s, u) => s + u.concluidas, 0);

  const kpiHtml = `
    <div class="stats-grid" style="margin-bottom:20px">
      <div class="stat-card blue"><div class="label">Total Atribuições</div><div class="value">${totalAtrib}</div></div>
      <div class="stat-card green"><div class="label">Concluídas</div><div class="value">${totalConc}</div></div>
      <div class="stat-card yellow"><div class="label">Em Andamento</div><div class="value">${totalAtrib-totalConc}</div></div>
      <div class="stat-card blue"><div class="label">Membros da Equipe</div><div class="value">${usuarios.length}</div></div>
    </div>`;

  // Barras de atribuição
  const maxAtrib = Math.max(...Object.values(userStats).map(u => u.total), 1);
  const barsAtrib = Object.entries(userStats).filter(([, u]) => u.total > 0).map(([login, us]) => {
    const pct = us.total > 0 ? Math.round((us.concluidas / us.total) * 100) : 0;
    return `
      <div class="bar-row" style="cursor:pointer" onclick="filterByUser('${login}')">
        <div class="bar-label" title="${us.nome}">${us.nome}</div>
        <div class="bar-track" style="height:20px;position:relative">
          <div class="bar-fill" style="width:${(us.total/maxAtrib)*100}%;background:var(--bg3);height:100%"></div>
          <div style="position:absolute;top:0;left:0;width:${(us.concluidas/maxAtrib)*100}%;background:var(--green);height:100%;border-radius:4px"></div>
        </div>
        <div class="bar-value" style="min-width:70px;font-size:11px">${us.concluidas}/${us.total} (${pct}%)</div>
      </div>`;
  }).join('');

  // Barras de cumprimento no prazo
  const barsPrazo = Object.entries(userStats).filter(([, u]) => u.total > 0).map(([, us]) => {
    const pct = us.concluidas > 0 ? Math.round((us.noprazo / us.concluidas) * 100) : 0;
    const cor = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--yellow2)' : 'var(--red2)';
    return `
      <div class="bar-row">
        <div class="bar-label">${us.nome}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${cor}"></div></div>
        <div class="bar-value" style="color:${cor}">${pct}%</div>
      </div>`;
  }).join('');

  panel.innerHTML = kpiHtml + `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
      <div class="chart-wrap">
        <div class="chart-title">Atividades Atribuídas por Usuário
          <span style="font-size:11px;color:var(--text3)">(clique para filtrar)</span>
        </div>
        <div class="bar-chart">${barsAtrib || '<div style="color:var(--text3);font-size:12px;padding:10px">Nenhuma atividade atribuída ainda.</div>'}</div>
      </div>
      <div class="chart-wrap">
        <div class="chart-title">Percentual de Cumprimento no Prazo</div>
        <div class="bar-chart">${barsPrazo || '<div style="color:var(--text3);font-size:12px;padding:10px">Sem dados de prazo.</div>'}</div>
      </div>
    </div>
    ${renderGantt(userStats)}`;
}

// ── GANTT SVG ────────────────────────────────────────────────
function renderGantt(userStats) {
  const hoje  = new Date();
  const allAct = [];
  Object.entries(userStats).forEach(([login, us]) => {
    us.atividades.filter(a => a.inicio || a.prazo).forEach(a => {
      allAct.push({ ...a, login, nomeUser: us.nome });
    });
  });

  if (!allAct.length) {
    return `<div class="chart-wrap"><div class="chart-title">Gantt de Atividades</div>
      <div style="color:var(--text3);font-size:13px;padding:20px">Nenhuma atividade com datas registradas.</div></div>`;
  }

  const datas  = allAct.flatMap(a => [a.inicio, a.prazo, a.concData].filter(Boolean).map(d => new Date(d)));
  const minD   = new Date(Math.min(...datas));
  const maxD   = new Date(Math.max(...datas, hoje));
  const totDias = Math.ceil((maxD - minD) / 86400000) + 7;

  const ROW_H = 26, LABEL_W = 130, CHART_W = 580, H = allAct.length * ROW_H + 40;

  let svg = `<svg viewBox="0 0 ${LABEL_W+CHART_W+10} ${H}" style="width:100%;font-family:var(--font);overflow:visible">`;

  // Grid mensal
  let mD = new Date(minD); mD.setDate(1);
  while (mD <= maxD) {
    const x = LABEL_W + ((mD - minD) / 86400000 / totDias) * CHART_W;
    const label = mD.toLocaleDateString('pt-BR', { month:'short', year:'2-digit' });
    svg += `<line x1="${x}" y1="20" x2="${x}" y2="${H}" stroke="var(--border)" stroke-width="1" opacity=".5"/>
            <text x="${x+2}" y="14" font-size="9" fill="var(--text3)">${label}</text>`;
    mD.setMonth(mD.getMonth() + 1);
  }

  // Linha de hoje
  const todayX = LABEL_W + ((hoje - minD) / 86400000 / totDias) * CHART_W;
  svg += `<line x1="${todayX}" y1="20" x2="${todayX}" y2="${H}" stroke="var(--red2)" stroke-width="1.5" stroke-dasharray="4,3" opacity=".8"/>
          <text x="${todayX+2}" y="${H-4}" font-size="9" fill="var(--red2)">hoje</text>`;

  // Barras
  allAct.forEach((a, i) => {
    const y  = 24 + i * ROW_H;
    const sD = a.inicio ? new Date(a.inicio) : new Date(a.prazo);
    const eD = a.prazo  ? new Date(a.prazo)  : new Date(a.inicio);
    const x1 = LABEL_W + ((sD - minD) / 86400000 / totDias) * CHART_W;
    const x2 = LABEL_W + ((eD - minD) / 86400000 / totDias) * CHART_W;
    const bw  = Math.max(x2 - x1, 8);
    const cor = a.concluida ? '#3fb950' : a.atrasada ? '#f85149' : '#388bfd';
    const shortName = (a.etapaNome || '').slice(0, 20) + (a.etapaNome?.length > 20 ? '…' : '');

    svg += `<text x="${LABEL_W-4}" y="${y+13}" font-size="9" fill="var(--text2)" text-anchor="end"
              cursor="pointer" onclick="filterByUser('${a.login}')">${a.nomeUser.split(' ')[0]}</text>`;
    svg += `<rect x="${x1}" y="${y+2}" width="${bw}" height="${ROW_H-6}" rx="3" fill="${cor}" opacity=".85"
              cursor="pointer" onclick="openDetalhe('${a.procId}')">
              <title>${a.nomeUser}: ${a.etapaNome}\n${a.procNome}\nInício: ${a.inicio||'?'} → Prazo: ${a.prazo||'?'}${a.concluida?' ✓':a.atrasada?' ⚠':''}</title>
            </rect>`;
    if (bw > 30) svg += `<text x="${x1+4}" y="${y+13}" font-size="8" fill="white" pointer-events="none">${shortName}</text>`;
  });

  svg += '</svg>';

  return `<div class="chart-wrap" style="overflow-x:auto">
    <div class="chart-title">Gantt — Atividades por Usuário
      <span style="font-size:10px;color:var(--text3);margin-left:8px">
        <span style="color:var(--green)">■</span> Concluída
        <span style="color:var(--accent2);margin-left:6px">■</span> Em andamento
        <span style="color:var(--red2);margin-left:6px">■</span> Atrasada
      </span>
    </div>
    ${svg}
  </div>`;
}

// ============================================================
// ABA: TEMPOS DE CONCLUSÃO
// ============================================================

function renderDashTempos() {
  const panel = document.getElementById('dash-panel-tempos');
  if (!panel) return;

  const processos = ls('processos')    || [];
  const etapas    = ls('etapasFluxo') || [];

  const procTempos = processos
    .filter(p => p.inicio)
    .map(p => {
      const dur = getDuracaoProcesso(p, etapas);
      return { nome: p.nome, tipo: p.tipo, dias: dur?.dias || 0, concluido: dur?.concluido || false };
    })
    .sort((a, b) => b.dias - a.dias)
    .slice(0, 12);

  const maxDias = Math.max(...procTempos.map(p => p.dias), 1);

  const faseTempos = {};
  processos.forEach(p => {
    etapas.forEach(e => {
      const ac = p.acompanhamento?.[e.id] || {};
      if (!ac._iniciado_em || !ac._concluido_em) return;
      const dias = diasEntre(ac._iniciado_em, ac._concluido_em);
      if (dias < 0) return;
      const fase = e.fase || 'outro';
      if (!faseTempos[fase]) faseTempos[fase] = { total: 0, count: 0 };
      faseTempos[fase].total += dias;
      faseTempos[fase].count++;
    });
  });

  const faseLabels = { planejamento: 'Planejamento', externa: 'Externa (SAD)', contratacao: 'Contratação' };

  const barsDuracao = procTempos.map(p => {
    const cor = p.concluido ? 'var(--green)' : p.dias > 365 ? 'var(--red2)' : p.dias > 180 ? 'var(--yellow2)' : 'var(--accent2)';
    return `
      <div class="bar-row">
        <div class="bar-label" title="${p.nome}">${(p.nome||'').split(' ').slice(0,3).join(' ')}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${(p.dias/maxDias)*100}%;background:${cor}"></div></div>
        <div class="bar-value" style="color:${cor}">${fmtDuracao(p.dias)}${p.concluido?' ✓':''}</div>
      </div>`;
  }).join('');

  const maxFase = Math.max(...Object.values(faseTempos).map(f => f.total/f.count||0), 1);
  const barsFase = Object.entries(faseTempos).map(([fase, data]) => {
    const media = Math.round(data.total / data.count);
    return `
      <div class="bar-row">
        <div class="bar-label">${faseLabels[fase] || fase}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${(media/maxFase)*100}%;background:var(--accent2)"></div></div>
        <div class="bar-value">${fmtDuracao(media)}</div>
      </div>`;
  }).join('');

  panel.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="chart-wrap">
        <div class="chart-title">Duração dos Processos</div>
        <div class="bar-chart">${barsDuracao || '<div style="color:var(--text3);font-size:12px;padding:10px">Nenhum processo com data de início.</div>'}</div>
      </div>
      <div class="chart-wrap">
        <div class="chart-title">Tempo Médio por Fase</div>
        <div class="bar-chart">${barsFase || '<div style="color:var(--text3);font-size:12px;padding:10px">Nenhum dado de tempo disponível ainda.</div>'}</div>
      </div>
    </div>`;
}

// ============================================================
// FILTRO POR USUÁRIO (chamado do Gantt)
// ============================================================

function filterByUser(login) {
  showPage('monitoramento');
  setTimeout(() => {
    const sel = document.getElementById('monitor-usuario');
    if (sel) { sel.value = login; renderMonitoramento(); }
  }, 100);
}

// ============================================================
// RECALCULA PROGRESSO DE TODOS OS PROCESSOS
// ============================================================

function recalcAllProgressos() {
  const processos = ls('processos')    || [];
  const etapas    = ls('etapasFluxo') || [];
  if (!processos.length || !etapas.length) return;
  let changed = false;
  processos.forEach(p => {
    const pct = calcProgressoProcesso(p, etapas);
    if (p.progresso !== pct) { p.progresso = pct; changed = true; }
  });
  if (changed) {
    // Salva direto no localStorage sem trigggar sync (evita loop)
    localStorage.setItem('gttrcg_processos', JSON.stringify(processos));
  }
}

// Roda uma vez na carga para garantir consistência
setTimeout(recalcAllProgressos, 500);

console.log('[GTTRCG] dashboard.js carregado ✓');
