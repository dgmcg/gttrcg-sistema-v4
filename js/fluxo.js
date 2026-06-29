// ============================================================
// fluxo.js — Fluxo do Processo + Acompanhamento por Etapa
// ============================================================

// diasEntre, fmtDuracao → utils.js

// ── Helpers de progresso/conclusão ───────────────────────────
function processoEstaConcluido(p, etapas) {
  if (!etapas || !etapas.length) return false;
  const sorted = [...etapas].sort((a, b) => {
    const fo = { planejamento: 0, externa: 1, contratacao: 2 };
    if (fo[a.fase] !== fo[b.fase]) return fo[a.fase] - fo[b.fase];
    return (a.ordem || 0) - (b.ordem || 0);
  });
  const ultima = sorted[sorted.length - 1];
  if (!ultima) return false;
  return !!(p.acompanhamento?.[ultima.id]?._concluido);
}

function getDuracaoProcesso(p, etapas) {
  if (!p.inicio) return null;
  if (processoEstaConcluido(p, etapas)) {
    const sorted = [...etapas].sort((a, b) => {
      const fo = { planejamento: 0, externa: 1, contratacao: 2 };
      return fo[a.fase] !== fo[b.fase] ? fo[a.fase] - fo[b.fase] : (a.ordem || 0) - (b.ordem || 0);
    });
    const ultima = sorted[sorted.length - 1];
    const concData = p.acompanhamento?.[ultima?.id]?._concluido_em;
    return { dias: diasEntre(p.inicio, concData || null), concluido: true };
  }
  return { dias: diasEntre(p.inicio, null), concluido: false };
}

// ── Fase automática do processo ───────────────────────────────
function atualizarFaseProcesso(procId) {
  const processos = ls('processos') || [];
  const etapas = ls('etapasFluxo') || [];
  const idx = processos.findIndex(p => p.id === procId);
  if (idx < 0) return;
  const p = processos[idx];

  const subfaseMap = {};
  etapas.forEach(e => {
    const subfase = e.subfase || e.fase || 'Sem Fase';
    if (!subfaseMap[subfase]) subfaseMap[subfase] = { iniciadas: 0, concluidas: 0, total: 0, ordem: e.ordem || 99, faseInterna: e.fase };
    subfaseMap[subfase].total++;
    const ac = p.acompanhamento?.[e.id] || {};
    if (ac._concluido) subfaseMap[subfase].concluidas++;
    else if (ac._iniciado) subfaseMap[subfase].iniciadas++;
    if ((e.ordem || 99) < subfaseMap[subfase].ordem) subfaseMap[subfase].ordem = e.ordem || 99;
  });

  const ordemFaseInterna = { planejamento: 0, externa: 1, contratacao: 2 };
  const subfasesEmAndamento = Object.entries(subfaseMap)
    .filter(([, d]) => d.iniciadas > 0 || (d.concluidas > 0 && d.concluidas < d.total))
    .sort((a, b) => (ordemFaseInterna[a[1].faseInterna] || 0) - (ordemFaseInterna[b[1].faseInterna] || 0) || a[1].ordem - b[1].ordem);

  const subfasesConcluidas = Object.entries(subfaseMap)
    .filter(([, d]) => d.total > 0 && d.concluidas === d.total)
    .sort((a, b) => (ordemFaseInterna[b[1].faseInterna] || 0) - (ordemFaseInterna[a[1].faseInterna] || 0) || b[1].ordem - a[1].ordem);

  let novaFase = processos[idx].fase;
  if (subfasesEmAndamento.length > 1) novaFase = subfasesEmAndamento.map(([sf]) => sf).join(' + ');
  else if (subfasesEmAndamento.length === 1) novaFase = subfasesEmAndamento[0][0];
  else if (subfasesConcluidas.length > 0) novaFase = subfasesConcluidas[0][0];

  if (novaFase && novaFase !== processos[idx].fase) {
    processos[idx].fase = novaFase;
    ls('processos', processos);
    const faseEl = document.getElementById('detalhe-fase');
    if (faseEl) faseEl.value = novaFase;
  }
}

// ── RENDERIZAR FLUXO (visão geral) ────────────────────────────
function renderFluxo() {
  const etapas = ls('etapasFluxo') || [];
  const isAdmin = APP.currentUser?.perfil === 'admin';
  const fases = [
    { key: 'planejamento', label: 'Fase de Planejamento, Instrução e Correção', color: '#1f6feb' },
    { key: 'externa', label: 'Fase Externa — Publicação (SAD)', color: '#d29922' },
    { key: 'contratacao', label: 'Fase de Contratação', color: '#3fb950' },
  ];
  let html = '<div class="fluxo-visual">';
  fases.forEach(f => {
    const et = etapas.filter(e => e.fase === f.key).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    html += `<div class="fluxo-group">
      <div class="fluxo-group-title" style="color:${f.color};border-left:3px solid ${f.color};padding-left:10px">
        ${f.label}
        <span style="margin-left:auto;font-size:10px;color:var(--text3)">${et.length} etapas</span>
      </div>`;
    et.forEach((e, i) => {
      const onclick = isAdmin ? `editarEtapaFluxo('${e.id}')` : '';
      html += `<div class="fluxo-node" ${onclick ? `onclick="${onclick}"` : ''} style="${!isAdmin ? 'cursor:default' : ''}">
        <div class="fluxo-node-icon" style="background:${f.color}22;color:${f.color};font-size:11px;font-weight:700">${e.ordem}</div>
        <div class="fluxo-node-content">
          <div class="fluxo-node-title">${e.nome}</div>
          <div class="fluxo-node-data">
            <span class="fluxo-data-chip">RESP: ${e.responsavel || '-'}</span>
            <span class="fluxo-data-chip">FASE: ${e.subfase || '-'}</span>
            ${(e.campos || []).slice(0, 3).map(c => `<span class="fluxo-data-chip">${c.tipo.toUpperCase()}: ${c.label}</span>`).join('')}
            ${(e.campos || []).length > 3 ? `<span class="fluxo-data-chip">+${(e.campos || []).length - 3} campos</span>` : ''}
          </div>
        </div>
        ${isAdmin ? `<div class="fluxo-node-edit">
          <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12" style="color:var(--text3)"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10z"/></svg>
        </div>` : ''}
      </div>`;
      if (i < et.length - 1) html += '<div class="fluxo-connector"><div class="fluxo-connector-line"></div></div>';
    });
    html += '</div>';
  });
  html += '</div>';
  document.getElementById('fluxo-container').innerHTML = html;

  // Esconde botões admin para não-admin
  if (!isAdmin) {
    document.querySelectorAll('[onclick="openAdicionarEtapa()"]').forEach(b => b.style.display = 'none');
  }
}

// ── SALVAR ETAPA DO FLUXO ─────────────────────────────────────
function salvarEtapaFluxo() {
  const nome = document.getElementById('etapa-nome-edit').value.trim();
  if (!nome) { alert('Informe o nome da etapa!'); return; }
  const etapas = ls('etapasFluxo') || [];
  const id = document.getElementById('etapa-id-edit').value || genId();

  // Campos vêm do editor visual (_camposEtapaEdit, definido em modais.js)
  const campos = (_camposEtapaEdit || [])
    .filter(c => c.label && c.label.trim())
    .map(c => {
      const limpo = { tipo: c.tipo || 'text', label: c.label.trim() };
      if (c.tipo === 'listafixo' && c.listaFonte) limpo.listaFonte = c.listaFonte;
      return limpo;
    });

  const obj = {
    id, nome,
    fase: document.getElementById('etapa-fase-edit').value,
    responsavel: document.getElementById('etapa-resp-edit').value,
    subfase: document.getElementById('etapa-subfase-edit').value,
    ordem: parseInt(document.getElementById('etapa-ordem-edit').value) || 99,
    acao: document.getElementById('etapa-acao-edit').value,
    campos,
  };
  const idx = etapas.findIndex(e => e.id === id);
  if (idx >= 0) etapas[idx] = obj; else etapas.push(obj);
  ls('etapasFluxo', etapas);
  closeModal('modal-etapa-fluxo');
  renderFluxo();
  showToast('Etapa salva!');
}

function excluirEtapa() {
  const id = document.getElementById('etapa-id-edit').value;
  if (!id || !confirm('Excluir esta etapa do fluxo?')) return;
  let etapas = ls('etapasFluxo') || [];
  etapas = etapas.filter(e => e.id !== id);
  ls('etapasFluxo', etapas);
  closeModal('modal-etapa-fluxo');
  renderFluxo();
}

// ── DETALHE DO PROCESSO (acompanhamento) ──────────────────────
function openDetalhe(id) {
  const processos = ls('processos') || [];
  const p = processos.find(x => x.id === id);
  if (!p) return;
  APP.currentProcessoId = id;
  document.getElementById('detalhe-title').textContent = p.nome;
  document.getElementById('detalhe-subtitle').textContent = `${p.tipo || ''} · ${p.municipio || ''} · SEI: ${p.sei || 'N/A'}`;
  document.getElementById('detalhe-edit-btn').onclick = () => { closeModal('modal-detalhe'); openEditarProcesso(id); };

  const etapas = ls('etapasFluxo') || [];
  const dur = getDuracaoProcesso(p, etapas);
  const durChip = dur ? (() => {
    const cor = dur.concluido ? 'var(--green)' : (dur.dias > 180 ? 'var(--red2)' : dur.dias > 90 ? 'var(--yellow2)' : 'var(--accent2)');
    return `<span style="display:inline-flex;align-items:center;gap:4px;margin-left:10px;font-size:12px;font-weight:600;color:${cor};padding:2px 8px;border-radius:10px;background:${cor}18;border:1px solid ${cor}44">${dur.concluido ? '✓ Concluído em' : '⏱'} ${fmtDuracao(dur.dias)}</span>`;
  })() : '';

  const fases = { planejamento: 'Fase de Planejamento, Instrução e Correção', externa: 'Fase Externa - Publicação', contratacao: 'Fase de Contratação' };
  const usuarios = getUsuariosAtribuicao();
  const userOpts = '<option value="">Sem responsável</option>' + usuarios.map(u => `<option value="${u.login}">${u.nome}</option>`).join('');

  let html = `
    <div class="processo-detail-header">
      <div class="processo-info">
        <h2>${p.nome}${durChip}</h2>
        <div class="processo-meta">
          <span class="meta-chip"><b>OSS:</b>&nbsp;${p.oss || 'N/A'}</span>
          <span class="meta-chip"><b>CG:</b>&nbsp;${p.cg || 'N/A'}</span>
          <span class="meta-chip"><b>Tipo Processo:</b>&nbsp;${p.tipoProcesso || 'N/A'}</span>
          <span class="meta-chip"><b>Início:</b>&nbsp;${fmtDate(p.inicio)}</span>
          ${p.vigFim ? `<span class="meta-chip"><b>Fim Vigência:</b>&nbsp;${fmtDate(p.vigFim)}</span>` : ''}
        </div>
      </div>
      <div>
        <span class="badge ${statusBadge(p.status)}">${p.status || 'Sem status'}</span>
        <div style="margin-top:10px">${progressBar(p.progresso || 0, true)}</div>
      </div>
    </div>
    <div style="margin-bottom:16px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <label style="font-size:12px;color:var(--text2)">Status:</label>
      <select id="detalhe-status" style="flex:1;max-width:280px" onchange="updateProcessoStatus('${id}',this.value)">
        ${(ls('statusProcesso') || []).map(s => `<option${p.status === s ? ' selected' : ''}>${s}</option>`).join('')}
      </select>
      <label style="font-size:12px;color:var(--text2)">Fase:</label>
      <select id="detalhe-fase" onchange="updateProcessoFase('${id}',this.value)">
        ${(ls('fases') || []).map(f => `<option${p.fase === f ? ' selected' : ''}>${f}</option>`).join('')}
      </select>
      <label style="font-size:12px;color:var(--text2)">Progresso:</label>
      <span id="detalhe-progresso-display" style="font-size:13px;font-weight:600;color:var(--accent2)">${calcProgressoProcesso(p, etapas)}%</span>
      <span style="font-size:11px;color:var(--text3)">(auto)</span>
    </div>
    ${renderLinhaDoTempo(p, etapas)}
  `;

  Object.entries(fases).forEach(([faseKey, faseLabel]) => {
    const etapasFase = etapas.filter(e => e.fase === faseKey).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    if (!etapasFase.length) return;
    html += `<div style="margin-bottom:20px">
      <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);padding:8px 0;border-bottom:1px solid var(--border);margin-bottom:10px">${faseLabel}</div>
      <div class="etapas-list">`;
    etapasFase.forEach((e, idx) => {
      const acomp = (p.acompanhamento || {})[e.id] || {};
      const isDone = acomp._concluido === true;
      const isInit = acomp._iniciado === true;
      const isActive = !isDone && isInit;
      const cls = isDone ? 'done' : (isActive ? 'active-step' : 'pending');
      const numCls = isDone ? 'done' : (isActive ? 'active' : 'pending');
      const res = calcProgressoEtapa(e, acomp);
      const pCor = res.pct >= 100 ? 'var(--green)' : res.pct > 0 ? 'var(--accent2)' : 'var(--text3)';
      const respAtual = acomp._responsavel || '';
      const prazoAtual = acomp._prazo || '';

      html += `<div class="etapa-item ${cls}" id="etapa-item-${e.id}">
        <div class="etapa-header" onclick="toggleEtapa('${e.id}')">
          <div class="etapa-num ${numCls}">${isDone ? '✓' : (idx + 1)}</div>
          <div class="etapa-info">
            <div class="etapa-nome">${e.nome}</div>
            <div class="etapa-resp">${e.responsavel || ''} · ${e.subfase || ''}</div>
          </div>
          <div class="etapa-actions" style="flex-shrink:0;display:flex;align-items:center;gap:6px">
            ${isDone ? '<span class="badge green" style="font-size:10px">Concluído</span>' : (isActive ? '<span class="badge blue pulse" style="font-size:10px">Em andamento</span>' : '')}
            <div style="display:flex;align-items:center;gap:5px;min-width:80px">
              <div style="width:48px;height:4px;background:var(--bg3);border-radius:2px;overflow:hidden"><div style="width:${res.pct}%;height:100%;background:${pCor}"></div></div>
              <span style="font-size:10px;color:${pCor}">${res.pct}%</span>
            </div>
            <button class="btn sm" onclick="event.stopPropagation();toggleEtapa('${e.id}')">▾</button>
          </div>
        </div>
        <div class="etapa-body" id="etapa-body-${e.id}">
          <div style="font-size:11px;color:var(--text3);margin-bottom:10px;padding:6px 8px;background:var(--bg2);border-radius:var(--radius)">${e.acao || ''}</div>
          <div class="etapa-fields">`;

      (e.campos || []).forEach(campo => {
        if (campo.tipo === 'pdf') return; // PDF tratado à parte
        const fid = `ef_${e.id}_${campo.label.replace(/\s+/g, '_')}`;
        const val = acomp[campo.label] !== undefined ? acomp[campo.label] : '';

        if (campo.tipo === 'boolean') {
          html += `<div class="etapa-field"><label>${campo.label}</label>
            <select id="${fid}" data-etapa="${e.id}" data-campo="${campo.label}">
              <option value="">-</option>
              <option value="true"${val === 'true' ? ' selected' : ''}>Sim</option>
              <option value="false"${val === 'false' ? ' selected' : ''}>Não</option>
            </select></div>`;
        } else if (campo.tipo === 'date') {
          html += `<div class="etapa-field"><label>${campo.label}</label><input type="date" id="${fid}" data-etapa="${e.id}" data-campo="${campo.label}" value="${val}"></div>`;
        } else if (campo.tipo === 'listafixo' && campo.listaFonte) {
          const itens = getListaItens(campo.listaFonte);
          html += `<div class="etapa-field"><label>${campo.label}</label>
            <select id="${fid}" data-etapa="${e.id}" data-campo="${campo.label}">
              <option value="">—</option>
              ${itens.map(it => `<option value="${it.value}"${val === it.value ? ' selected' : ''}>${it.label}</option>`).join('')}
            </select></div>`;
        } else if (campo.tipo === 'moeda') {
          html += `<div class="etapa-field"><label>${campo.label}</label><input type="number" step="0.01" id="${fid}" data-etapa="${e.id}" data-campo="${campo.label}" value="${val}" placeholder="0,00"></div>`;
        } else {
          html += `<div class="etapa-field"><label>${campo.label}</label><input type="text" id="${fid}" data-etapa="${e.id}" data-campo="${campo.label}" value="${val}" placeholder="${campo.label}"></div>`;
        }
      });

      html += `</div>
          <!-- Responsável + Prazo -->
          <div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px;background:var(--bg2);border-radius:var(--radius);border:1px solid var(--border)">
            <div class="field-group">
              <label style="font-size:11px;color:var(--text3)">👤 Responsável pela Etapa</label>
              <select id="etapa-resp-sel-${e.id}" data-etapa="${e.id}" data-campo="_responsavel" style="font-size:12px">${userOpts}</select>
            </div>
            <div class="field-group">
              <label style="font-size:11px;color:var(--text3)">📅 Prazo para Conclusão</label>
              <input type="date" id="etapa-prazo-inp-${e.id}" data-etapa="${e.id}" data-campo="_prazo" value="${prazoAtual}" style="font-size:12px">
            </div>
          </div>
          <div class="etapa-obs">
            <label>Observações da Etapa</label>
            <textarea id="ef_${e.id}_obs" rows="2" data-etapa="${e.id}" data-campo="_obs">${acomp._obs || ''}</textarea>
          </div>
          <div style="margin-top:10px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:var(--accent2)">
              <input type="checkbox" id="ef_${e.id}_init" ${isInit ? 'checked' : ''} onchange="marcarEtapaIniciada('${id}','${e.id}',this.checked)">
              Iniciada
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:var(--green)">
              <input type="checkbox" id="ef_${e.id}_done" ${isDone ? 'checked' : ''} onchange="marcarEtapaConcluida('${id}','${e.id}',this.checked)">
              Concluída
            </label>
          </div>
        </div>
      </div>`;
    });
    html += '</div></div>';
  });

  document.getElementById('detalhe-body').innerHTML = html;

  // Seta responsável após render (select dinâmico)
  etapas.forEach(e => {
    const ac = (p.acompanhamento || {})[e.id] || {};
    const sel = document.getElementById(`etapa-resp-sel-${e.id}`);
    if (sel && ac._responsavel) sel.value = ac._responsavel;
  });

  openModal('modal-detalhe');
}

// ── Linha do tempo ────────────────────────────────────────────
function renderLinhaDoTempo(p, etapas) {
  const linhas = [];
  const hoje = new Date();
  etapas.forEach(e => {
    const ac = (p.acompanhamento || {})[e.id] || {};
    if (!ac._iniciado && !ac._concluido) return;
    const resp = ac._responsavel ? (() => {
      const u = (ls('usuarios') || []).find(x => x.login === ac._responsavel);
      return u ? u.nome : ac._responsavel;
    })() : null;
    let duracao = '';
    if (ac._iniciado_em && ac._concluido_em) {
      const dias = Math.ceil((new Date(ac._concluido_em) - new Date(ac._iniciado_em)) / 86400000);
      duracao = `${dias}d`;
    } else if (ac._iniciado_em) {
      const dias = Math.ceil((hoje - new Date(ac._iniciado_em)) / 86400000);
      duracao = `${dias}d em andamento`;
    }
    let prazoInfo = '';
    if (ac._prazo && !ac._concluido) {
      const diasP = Math.ceil((new Date(ac._prazo + 'T23:59:59') - hoje) / 86400000);
      prazoInfo = diasP < 0 ? `<span style="color:var(--red2)">⚠ Prazo vencido há ${Math.abs(diasP)}d</span>` : `<span style="color:var(--text3)">Prazo: ${fmtDate(ac._prazo)}</span>`;
    }
    linhas.push({ e, isDone: !!ac._concluido, resp, iniciadoEm: ac._iniciado_em, concluidoEm: ac._concluido_em, duracao, prazoInfo });
  });

  if (!linhas.length) return '';

  const concluidas = linhas.filter(l => l.isDone).length;
  const total = etapas.length;
  return `<div style="border:1px solid var(--border);border-radius:var(--radius2);overflow:hidden;margin-bottom:16px">
    <div style="background:var(--bg1);border-bottom:1px solid var(--border);padding:8px 14px;display:flex;gap:16px;flex-wrap:wrap;align-items:center;font-size:12px">
      <span style="font-weight:600">📋 Linha do Tempo</span>
      <span style="color:var(--text3)">${concluidas}/${total} etapas concluídas</span>
      <span style="color:var(--green);font-weight:600;margin-left:auto">${Math.round(concluidas/total*100)}%</span>
    </div>
    <div style="max-height:240px;overflow-y:auto">
      ${linhas.map((l, i) => {
        const cor = l.isDone ? 'var(--green)' : 'var(--accent2)';
        const bg = i % 2 === 0 ? 'var(--bg2)' : 'var(--bg1)';
        return `<div style="display:flex;gap:10px;align-items:flex-start;padding:7px 14px;background:${bg};border-bottom:1px solid var(--border);font-size:12px">
          <span style="font-size:13px;flex-shrink:0">${l.isDone ? '✅' : '⏳'}</span>
          <div style="flex:1;min-width:0">
            <div style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${l.e.nome}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px;display:flex;gap:8px;flex-wrap:wrap">
              ${l.e.subfase ? `<span>${l.e.subfase}</span>` : ''}
              ${l.resp ? `<span>👤 ${l.resp}</span>` : ''}
              ${l.iniciadoEm ? `<span>▶ ${fmtDate(l.iniciadoEm)}</span>` : ''}
              ${l.concluidoEm ? `<span style="color:var(--green)">✓ ${fmtDate(l.concluidoEm)}</span>` : ''}
              ${l.duracao ? `<span style="color:${cor}">⏱ ${l.duracao}</span>` : ''}
              ${l.prazoInfo}
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

// ── Helpers de etapa ─────────────────────────────────────────
function toggleEtapa(id) {
  document.getElementById('etapa-body-' + id)?.classList.toggle('open');
}

function updateProcessoStatus(id, val) {
  const processos = ls('processos') || [];
  const idx = processos.findIndex(p => p.id === id);
  if (idx >= 0) { processos[idx].status = val; ls('processos', processos); }
}

function updateProcessoFase(id, val) {
  const processos = ls('processos') || [];
  const idx = processos.findIndex(p => p.id === id);
  if (idx >= 0) { processos[idx].fase = val; ls('processos', processos); }
}

function marcarEtapaIniciada(procId, etapaId, checked) {
  const processos = ls('processos') || [];
  const idx = processos.findIndex(p => p.id === procId);
  if (idx < 0) return;
  if (!processos[idx].acompanhamento) processos[idx].acompanhamento = {};
  if (!processos[idx].acompanhamento[etapaId]) processos[idx].acompanhamento[etapaId] = {};
  processos[idx].acompanhamento[etapaId]._iniciado = checked;
  if (checked) processos[idx].acompanhamento[etapaId]._iniciado_em = new Date().toISOString().split('T')[0];
  const etapasAll = ls('etapasFluxo') || [];
  processos[idx].progresso = calcProgressoProcesso(processos[idx], etapasAll);
  ls('processos', processos);
  atualizarFaseProcesso(procId);
  const pdEl = document.getElementById('detalhe-progresso-display');
  if (pdEl) pdEl.textContent = processos[idx].progresso + '%';
  // Atualiza estilo da etapa
  const item = document.getElementById('etapa-item-' + etapaId);
  if (!item) return;
  const num = item.querySelector('.etapa-num');
  const isDone = processos[idx].acompanhamento[etapaId]._concluido;
  if (!isDone && checked) {
    item.className = item.className.replace(/done|active-step|pending/g, '') + ' active-step';
    if (num) { num.className = 'etapa-num active'; }
  } else if (!checked && !isDone) {
    item.className = item.className.replace(/done|active-step|pending/g, '') + ' pending';
    if (num) num.className = 'etapa-num pending';
  }
  UndoStack?.updateBtn?.();
}

function marcarEtapaConcluida(procId, etapaId, checked) {
  const processos = ls('processos') || [];
  const idx = processos.findIndex(p => p.id === procId);
  if (idx < 0) return;
  if (!processos[idx].acompanhamento) processos[idx].acompanhamento = {};
  if (!processos[idx].acompanhamento[etapaId]) processos[idx].acompanhamento[etapaId] = {};
  processos[idx].acompanhamento[etapaId]._concluido = checked;
  if (checked) processos[idx].acompanhamento[etapaId]._concluido_em = new Date().toISOString().split('T')[0];
  const etapasAllC = ls('etapasFluxo') || [];
  processos[idx].progresso = calcProgressoProcesso(processos[idx], etapasAllC);
  if (processoEstaConcluido(processos[idx], etapasAllC)) {
    processos[idx].status = 'Contratação Concluída';
    processos[idx].progresso = 100;
    const statusEl = document.getElementById('detalhe-status');
    if (statusEl) statusEl.value = 'Contratação Concluída';
    showToast('🎉 Processo concluído!');
  }
  ls('processos', processos);
  atualizarFaseProcesso(procId);
  const pdElC = document.getElementById('detalhe-progresso-display');
  if (pdElC) pdElC.textContent = processos[idx].progresso + '%';
  const item = document.getElementById('etapa-item-' + etapaId);
  if (!item) return;
  const num = item.querySelector('.etapa-num');
  if (checked) {
    item.className = item.className.replace(/done|active-step|pending/g, '') + ' done';
    if (num) { num.className = 'etapa-num done'; num.textContent = '✓'; }
  } else {
    item.className = item.className.replace(/done|active-step|pending/g, '') + ' pending';
    if (num) num.className = 'etapa-num pending';
  }
  UndoStack?.updateBtn?.();
}

function salvarAcompanhamento() {
  const id = APP.currentProcessoId;
  if (!id) return;
  const processos = ls('processos') || [];
  const idx = processos.findIndex(p => p.id === id);
  if (idx < 0) return;
  if (!processos[idx].acompanhamento) processos[idx].acompanhamento = {};

  document.querySelectorAll('[data-etapa]').forEach(el => {
    const etapaId = el.dataset.etapa;
    const campo = el.dataset.campo;
    if (!campo) return;
    if (!processos[idx].acompanhamento[etapaId]) processos[idx].acompanhamento[etapaId] = {};
    processos[idx].acompanhamento[etapaId][campo] = el.type === 'checkbox' ? el.checked : el.value;
  });

  processos[idx].status = document.getElementById('detalhe-status')?.value || processos[idx].status;
  processos[idx].fase = document.getElementById('detalhe-fase')?.value || processos[idx].fase;

  const etapas = ls('etapasFluxo') || [];
  processos[idx].progresso = calcProgressoProcesso(processos[idx], etapas);
  ls('processos', processos);
  closeModal('modal-detalhe');

  renderMonitoramento();
  if (typeof monitorView !== 'undefined' && monitorView === 'kanban') renderKanban();
  renderDashboard();
  updateSidebarCounts();
  showToast('Acompanhamento salvo! Progresso: ' + processos[idx].progresso + '%');
  UndoStack?.updateBtn?.();
}

// ── Live progresso ────────────────────────────────────────────
let _liveCalcTimer;
document.addEventListener('change', function (e) {
  const el = e.target;
  if (!el.dataset?.etapa) return;
  clearTimeout(_liveCalcTimer);
  _liveCalcTimer = setTimeout(() => {
    const procId = APP.currentProcessoId;
    if (!procId) return;
    const processos = ls('processos') || [];
    const etapas = ls('etapasFluxo') || [];
    const idx = processos.findIndex(p => p.id === procId);
    if (idx < 0) return;
    const snapshot = JSON.parse(JSON.stringify(processos[idx].acompanhamento || {}));
    document.querySelectorAll('[data-etapa]').forEach(domEl => {
      const eid = domEl.dataset.etapa;
      const campo = domEl.dataset.campo;
      if (!campo) return;
      if (!snapshot[eid]) snapshot[eid] = {};
      snapshot[eid][campo] = domEl.type === 'checkbox' ? domEl.checked : domEl.value;
    });
    const tempProc = { ...processos[idx], acompanhamento: snapshot };
    const pct = calcProgressoProcesso(tempProc, etapas);
    const pdEl = document.getElementById('detalhe-progresso-display');
    if (pdEl) {
      pdEl.textContent = pct + '%';
      pdEl.style.color = pct >= 80 ? 'var(--green)' : pct >= 40 ? 'var(--accent2)' : 'var(--yellow2)';
    }
  }, 300);
});

// ── openDetalheEtapa: navega direto para etapa ────────────────
function openDetalheEtapa(procId, etapaId) {
  openDetalhe(procId);
  setTimeout(() => {
    const body = document.getElementById('etapa-body-' + etapaId);
    if (body) {
      body.classList.add('open');
      body.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const item = document.getElementById('etapa-item-' + etapaId);
      if (item) {
        item.style.outline = '2px solid var(--accent2)';
        setTimeout(() => { item.style.outline = ''; }, 3000);
      }
    }
  }, 250);
}

// getListaItens → utils.js

// ── Auto-recalc na inicialização ──────────────────────────────
(function recalcAllOnLoad() {
  const processos = ls('processos') || [];
  const etapas = ls('etapasFluxo') || [];
  if (!processos.length || !etapas.length) return;
  let changed = false;
  processos.forEach(p => {
    const pct = calcProgressoProcesso(p, etapas);
    if (p.progresso !== pct) { p.progresso = pct; changed = true; }
  });
  if (changed) ls('processos', processos);
})();
