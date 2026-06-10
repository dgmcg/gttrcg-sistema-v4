// ============================================================
// alertas.js — Geração e exibição de alertas do sistema
// ============================================================

function gerarAlertas() {
  const processos = ls('processos') || [];
  const etapas = ls('etapasFluxo') || [];
  const unidades = ls('unidades') || [];
  const hoje = new Date();
  const prazo = parseInt(ls('prazoAlerta') || 18);
  const alertas = [];

  // ── 1. Contratos de Gestão (vencimento) ──────────────────
  unidades.filter(u => u.cgFim).forEach(u => {
    const fim = new Date(u.cgFim + 'T12:00:00');
    const previsao = new Date(fim);
    previsao.setMonth(previsao.getMonth() - prazo);
    const diasParaPrevisao = Math.ceil((previsao - hoje) / 86400000);
    const diasFim = Math.ceil((fim - hoje) / 86400000);

    if (diasFim < 0) {
      alertas.push({
        nivel: 'urgente',
        titulo: `CG Expirado: ${u.nome}`,
        desc: `Contrato venceu há ${Math.abs(diasFim)} dias (fim: ${fmtDate(u.cgFim)})`,
      });
    } else if (diasParaPrevisao < 0) {
      alertas.push({
        nivel: 'urgente',
        titulo: `Novo processo ATRASADO: ${u.nome}`,
        desc: `Deveria ter iniciado há ${Math.abs(diasParaPrevisao)} dias. Fim CG: ${fmtDate(u.cgFim)}`,
      });
    } else if (diasParaPrevisao < 60) {
      alertas.push({
        nivel: 'atencao',
        titulo: `Iniciar processo em ${diasParaPrevisao}d: ${u.nome}`,
        desc: `Previsão de início: ${fmtDate(previsao.toISOString().split('T')[0])}`,
      });
    }
  });

  // ── 2. Processos sem início ──────────────────────────────
  processos.forEach(p => {
    if (p.status && p.status.toLowerCase().includes('aguardando início') && !p.inicio) {
      alertas.push({ nivel: 'info', titulo: `Sem início definido: ${p.nome}`, desc: 'Processo sem data de início registrada', pid: p.id });
    }
    if (p.vigFim) {
      const fim = new Date(p.vigFim);
      const diasRestantes = Math.ceil((fim - hoje) / 86400000);
      if (diasRestantes < 0) {
        alertas.push({ nivel: 'urgente', titulo: `Vigência expirada: ${p.nome}`, desc: `Vigência encerrada em ${fmtDate(p.vigFim)}`, pid: p.id });
      } else if (diasRestantes < 365 * 2) {
        alertas.push({ nivel: 'atencao', titulo: `Contrato a vencer: ${p.nome}`, desc: `Vence em ${fmtDate(p.vigFim)} (${diasRestantes} dias)`, pid: p.id });
      }
    }
  });

  // ── 3. Etapas com prazo vencido ou próximo ───────────────
  processos.forEach(p => {
    etapas.forEach(e => {
      const ac = (p.acompanhamento || {})[e.id] || {};
      if (ac._concluido || !ac._prazo) return;
      const diasParaVencer = Math.ceil((new Date(ac._prazo + 'T23:59:59') - hoje) / 86400000);
      if (diasParaVencer < 0) {
        alertas.push({
          nivel: 'urgente',
          titulo: `Prazo vencido: ${e.nome}`,
          desc: `"${p.nome}" — prazo era ${fmtDate(ac._prazo)} (venceu há ${Math.abs(diasParaVencer)}d). Resp.: ${ac._responsavel || 'não definido'}`,
          pid: p.id,
          etapaId: e.id,
        });
      } else if (diasParaVencer <= 3) {
        alertas.push({
          nivel: 'atencao',
          titulo: `Prazo em ${diasParaVencer}d: ${e.nome}`,
          desc: `"${p.nome}" — vence ${fmtDate(ac._prazo)}. Resp.: ${ac._responsavel || '-'}`,
          pid: p.id,
          etapaId: e.id,
        });
      }
    });
  });

  // ── 4. Etapas sem responsável após conclusão da anterior ─
  const pendentes = ls('alertas_pendentes') || [];
  pendentes.forEach(a => {
    const p = processos.find(x => x.id === a.procId);
    if (!p) return;
    const ac = (p.acompanhamento || {})[a.etapaId] || {};
    if (ac._concluido || ac._responsavel) return;
    alertas.push({
      nivel: 'urgente',
      titulo: `Etapa sem responsável: ${a.etapaNome}`,
      desc: `Processo "${a.procNome}" — etapa pendente de início e responsável.`,
      pid: a.procId,
      etapaId: a.etapaId,
    });
  });

  // ── 5. Alertas de atribuição ao usuário logado ──────────
  const curUser = APP.currentUser;
  if (curUser && curUser.login !== 'admin') {
    processos.forEach(p => {
      etapas.forEach(e => {
        const ac = (p.acompanhamento || {})[e.id] || {};
        if (ac._responsavel !== curUser.login || ac._concluido) return;
        const jaExiste = alertas.some(a => a._atribuicao && a.pid === p.id && a.etapaId === e.id);
        if (jaExiste) return;
        const diasP = ac._prazo ? Math.ceil((new Date(ac._prazo + 'T23:59:59') - hoje) / 86400000) : null;
        const prazoStr = ac._prazo ? ` — prazo: ${fmtDate(ac._prazo)}` : '';
        const nivel = diasP !== null && diasP < 0 ? 'urgente' : diasP !== null && diasP <= 7 ? 'atencao' : 'info';
        alertas.push({
          nivel,
          titulo: `Sua atividade: ${e.nome}`,
          desc: `Processo "${p.nome}"${prazoStr}`,
          pid: p.id,
          etapaId: e.id,
          _atribuicao: true,
        });
      });
    });
  }

  return alertas;
}

function renderAlertas() {
  const alertas = gerarAlertas();
  const hoje = new Date();

  ['urgente', 'atencao', 'info'].forEach(nivel => {
    const list = document.getElementById('alerts-' + nivel);
    if (!list) return;
    const items = alertas.filter(a => a.nivel === nivel);
    if (!items.length) {
      list.innerHTML = '<div class="empty-state" style="padding:30px"><p>Nenhum alerta neste nível</p></div>';
      return;
    }
    list.innerHTML = items.map((a) => {
      const clickable = a.pid || a.etapaId;
      const onclick = a.etapaId
        ? `openDetalheEtapa('${a.pid}','${a.etapaId}')`
        : a.pid ? `openDetalhe('${a.pid}')` : '';
      const cor = a.nivel === 'urgente' ? 'rgba(218,54,51,.15)' : a.nivel === 'atencao' ? 'rgba(210,153,34,.15)' : 'rgba(31,111,235,.1)';
      const iconCor = a.nivel === 'urgente' ? 'var(--red2)' : a.nivel === 'atencao' ? 'var(--yellow2)' : 'var(--accent2)';
      const atribTag = a._atribuicao ? `<span class="badge blue" style="font-size:10px;margin-left:6px">📌 Sua atribuição</span>` : '';
      return `<div class="alert-item ${a.nivel === 'urgente' ? 'urgent' : a.nivel === 'atencao' ? 'warning' : ''}"
        ${clickable ? `onclick="${onclick}" style="cursor:pointer"` : ''}>
        <div class="alert-icon" style="background:${cor}">
          <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14" style="color:${iconCor}">
            <path d="M7.938 2.016A.13.13 0 0 1 8.002 2a.13.13 0 0 1 .063.016.146.146 0 0 1 .054.057l6.857 11.667c.036.06.035.124.002.183a.163.163 0 0 1-.054.06.116.116 0 0 1-.066.017H1.146a.115.115 0 0 1-.066-.017.163.163 0 0 1-.054-.06.176.176 0 0 1 .002-.183L7.884 2.073a.147.147 0 0 1 .054-.057z"/>
          </svg>
        </div>
        <div class="alert-body">
          <div class="alert-title">${a.titulo}${atribTag}</div>
          <div class="alert-desc">${a.desc}${clickable ? ' <span style="color:var(--accent2);font-size:11px">→ Ver</span>' : ''}</div>
        </div>
      </div>`;
    }).join('');
  });
}

function switchAlertsTab(tab, el) {
  document.querySelectorAll('#page-alertas .tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#page-alertas .tab-content').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  const panel = document.getElementById('tab-' + tab);
  if (panel) panel.classList.add('active');
}
