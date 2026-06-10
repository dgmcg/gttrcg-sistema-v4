// ============================================================
// configuracoes.js — Configurações do Sistema
// ============================================================

// ── Contexto global do modal de dado fixo ────────────────────
let dadoFixoContext = { key: null, id: null, isNew: true };
let schemaEditKey = null;

// ── Render principal ──────────────────────────────────────────
function renderConfiguracoes() {
  renderDadosFixos();
  renderUsuarios();
  const u = APP.currentUser;
  const isMaster = u?.login === 'admin';
  const isAdmin = u?.perfil === 'admin';
  if (u && !isAdmin) {
    const notice = document.getElementById('admin-notice');
    if (notice) notice.style.display = 'flex';
    const btn = document.getElementById('btn-add-user');
    if (btn) btn.style.display = 'none';
  }
  // Mostra/esconde seções restritas ao admin master
  setTimeout(() => {
    const urlSec = document.getElementById('apps-script-url-section');
    if (urlSec) urlSec.style.display = isMaster ? '' : 'none';
    document.querySelectorAll('.tab[data-tab="importar"]').forEach(t => t.style.display = isMaster ? '' : 'none');
    const importTab = document.getElementById('tab-importar');
    if (importTab && !isMaster) importTab.style.display = 'none';
  }, 200);
}

function switchConfigTab(tab, el) {
  document.querySelectorAll('#page-configuracoes .tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#page-configuracoes .tab-content').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  const panel = document.getElementById('tab-' + tab);
  if (panel) panel.classList.add('active');
}

// ── getCatConfig ──────────────────────────────────────────────
function getCatConfig(key) {
  if (key === 'unidades' || key === 'oss') {
    let schema = ls('schema_' + key);
    if (schema && Array.isArray(schema)) {
      let changed = false;
      if (!schema.find(f => f.key === 'statusCG')) {
        schema.push({ key: 'statusCG', label: 'Status do C.G', tipo: 'listafixo', listaFonte: 'statusContrato', protegido: false });
        changed = true;
      }
      if (!schema.find(f => f.key === 'repasse')) {
        schema.push({ key: 'repasse', label: 'Repasse Mensal (R$)', tipo: 'moeda', protegido: false });
        changed = true;
      }
      if (changed) localStorage.setItem('gttrcg_schema_' + key, JSON.stringify(schema));
    }
    if (schema) return { fields: schema.map(f => f.key), schema };
    const defaults = {
      unidades: ['nome', 'sigla', 'tipo', 'cnpj', 'cg', 'cgInicio', 'cgFim', 'vigencia2anos', 'macro', 'regiao', 'cidade', 'endereco', 'ossGestora', 'cnpjOss', 'porte', 'leitos', 'statusCG', 'repasse'],
      oss: ['sigla', 'nome', 'cnpj', 'endereco', 'municipio', 'uf', 'telefone', 'email', 'representante', 'qualificacao'],
    };
    return { fields: defaults[key] || [], schema: null };
  }
  return { fields: null, schema: null };
}

// ── getItemDisplay ────────────────────────────────────────────
function getItemDisplay(item, key) {
  if (!item) return { label: '', value: '' };
  if (typeof item === 'string') return { label: item, value: item };
  const schema = ls('schema_' + key) || [];
  const mainField = (schema.find(f => f.key === 'nome') || schema.find(f => f.key === 'sigla') || schema.find(f => f.protegido) || schema[0])?.key;
  const subField = (schema.find(f => f.key === 'sigla' && f.key !== mainField) || schema.filter(f => f.protegido)[1])?.key;
  const mainVal = mainField ? item[mainField] : (item.nome || item.sigla || item.valor || Object.values(item).find(v => typeof v === 'string'));
  const subVal = subField ? item[subField] : null;
  const label = [subVal, mainVal].filter(Boolean).join(' — ') || item.id || '?';
  const value = mainVal || item.id || '';
  return { label, value, _item: item };
}

// ── getListaItens ─────────────────────────────────────────────
function getListaItens(key) {
  const data = ls(key) || [];
  if (!data.length) return [];
  return data.map(item => {
    const d = getItemDisplay(item, key);
    return { label: d.label, value: d.value, _item: typeof item === 'object' ? item : null };
  }).filter(x => x.value);
}

// ── renderDadosFixos ──────────────────────────────────────────
function renderDadosFixos() {
  const prazo = ls('prazoAlerta') || 18;
  const isAdmin = APP.currentUser?.perfil === 'admin';
  const isMaster = APP.currentUser?.login === 'admin';

  const categorias = [
    { key: 'unidades', label: 'Unidades de Saúde', hasSchema: true },
    { key: 'oss', label: 'Organizações Sociais (OSS)', hasSchema: true },
    { key: 'setores', label: 'Setores / Órgãos', hasSchema: false },
    { key: 'pessoas', label: 'Pessoas', hasSchema: false },
    { key: 'statusProcesso', label: 'Status de Processo', hasSchema: false },
    { key: 'fases', label: 'Fases do Processo', hasSchema: false },
    { key: 'tiposProcesso', label: 'Tipos de Processo', hasSchema: false },
    { key: 'statusContrato', label: 'Status do Contrato de Gestão', hasSchema: false },
    { key: 'tiposUnidade', label: 'Tipos de Unidade', hasSchema: false },
  ];

  let html = '';
  categorias.forEach(cat => {
    const data = ls(cat.key) || [];
    const schema = cat.hasSchema ? (ls('schema_' + cat.key) || []) : null;
    const isSimple = !cat.hasSchema;

    html += `<div class="config-section" style="margin-bottom:16px">
      <div class="config-section-header">
        <div>
          <div class="config-section-title">${cat.label}
            <span style="font-size:11px;color:var(--text3);font-weight:400;margin-left:6px">${data.length} itens</span>
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          ${cat.hasSchema && isAdmin ? `<button class="btn sm" onclick="openGerenciarSchema('${cat.key}')" style="color:var(--accent2);border-color:var(--accent)">⚙ Campos</button>` : ''}
          <button class="btn sm primary" onclick="openAdicionarDadoFixo('${cat.key}')">+ Adicionar</button>
        </div>
      </div>
      <div class="config-section-body">`;

    if (isSimple) {
      html += `<div style="display:flex;flex-direction:column;gap:4px">`;
      data.forEach((item, i) => {
        html += `<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius)">
          <div style="display:flex;flex-direction:column;gap:1px;opacity:.6">
            <button onclick="moverItemConfig('${cat.key}',${i},-1)" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:10px;padding:0;line-height:1">▲</button>
            <button onclick="moverItemConfig('${cat.key}',${i},1)" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:10px;padding:0;line-height:1">▼</button>
          </div>
          <span style="flex:1;font-size:13px">${item}</span>
          <button class="btn sm" onclick="openEditarDadoFixo('${cat.key}',${i})" style="font-size:11px">✎</button>
        </div>`;
      });
      html += `</div>`;
    } else {
      if (!data.length) {
        html += `<div style="font-size:13px;color:var(--text3);padding:12px">Nenhum item cadastrado.</div>`;
      } else {
        html += `<div class="config-list" style="max-height:320px;overflow-y:auto">`;
        data.forEach(item => {
          const d = getItemDisplay(item, cat.key);
          const subFields = (schema || []).filter(f => f.key !== (schema[0]?.key)).slice(0, 2);
          const subText = subFields.map(f => item[f.key]).filter(Boolean).join(' · ');
          html += `<div class="config-item">
            <div class="config-item-text">
              <div style="font-weight:500">${d.label || '—'}</div>
              ${subText ? `<div class="config-item-sub">${subText}</div>` : ''}
            </div>
            <div class="config-item-actions">
              <button class="btn sm" onclick="openEditarDadoFixo('${cat.key}','${item.id}')">Editar</button>
            </div>
          </div>`;
        });
        html += `</div>`;
      }
    }
    html += `</div></div>`;
  });

  // Prazo de alerta
  html += `<div class="config-section" style="margin-bottom:16px">
    <div class="config-section-header"><div class="config-section-title">Prazo de Alerta para Novo Processo</div></div>
    <div class="config-section-body" style="max-width:480px">
      <p style="font-size:13px;color:var(--text2);margin-bottom:14px;line-height:1.6">Define quantos meses antes do fim do CG o sistema deve alertar. Padrão: <strong>18 meses</strong>.</p>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <input type="number" id="prazo-alerta-input" value="${prazo}" min="1" max="60" style="width:80px">
        <span style="font-size:13px;color:var(--text2)">meses antes do fim</span>
        <button class="btn primary sm" onclick="salvarPrazoAlerta()">Salvar</button>
      </div>
    </div>
  </div>`;

  // URL do Apps Script (admin master only — visibilidade controlada por renderConfiguracoes)
  const url = localStorage.getItem('gttrcg_apps_script_url') || '';
  const token = localStorage.getItem('gttrcg_api_token') || '';
  html += `<div class="config-section" id="apps-script-url-section" style="margin-bottom:16px">
    <div class="config-section-header"><div class="config-section-title">URL e Token do Google Apps Script
      <span style="font-size:10px;padding:2px 7px;border-radius:10px;margin-left:8px;${url ? 'background:rgba(63,185,80,.15);color:var(--green)' : 'background:rgba(218,54,51,.15);color:var(--red2)'}">
        ${url ? '● Configurada' : '● Não configurada'}
      </span>
    </div></div>
    <div class="config-section-body">
      <p style="font-size:12px;color:var(--text3);margin-bottom:10px;line-height:1.6">Necessária para sincronização com Google Sheets e análise de PDF com Gemini.</p>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
        <input type="text" id="apps-script-url-input" placeholder="https://script.google.com/macros/s/.../exec"
          value="${url}" style="flex:1;min-width:300px;font-size:12px;font-family:var(--mono)">
        <button class="btn primary sm" onclick="salvarAppsScriptUrl()">Salvar URL</button>
        ${url ? '<button class="btn sm" onclick="testarAppsScript()">Testar Conexão</button>' : ''}
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <input type="password" id="api-token-input" placeholder="Token de acesso (API_TOKEN do Apps Script)"
          value="${token}" style="flex:1;font-family:var(--mono);font-size:12px">
        <button class="btn primary sm" onclick="salvarApiToken()">Salvar Token</button>
      </div>
      <div id="apps-script-test-result" style="margin-top:8px;font-size:12px"></div>
    </div>
  </div>`;

  document.getElementById('dados-tabs-container').innerHTML = html;
}

function salvarPrazoAlerta() {
  const v = parseInt(document.getElementById('prazo-alerta-input').value);
  if (v > 0) { ls('prazoAlerta', v); showToast('Prazo de alerta salvo: ' + v + ' meses'); }
}

function moverItemConfig(key, idx, dir) {
  const data = ls(key) || [];
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= data.length) return;
  const tmp = data[idx]; data[idx] = data[newIdx]; data[newIdx] = tmp;
  ls(key, data);
  renderDadosFixos();
  showToast(`Item movido ${dir < 0 ? 'para cima' : 'para baixo'}`);
}

// ── buildDadoFixoForm ─────────────────────────────────────────
function buildDadoFixoForm(key, fields, item) {
  const cat = getCatConfig(key);
  const schema = cat.schema || (fields || []).map(f => ({ key: f, label: f, tipo: 'text', protegido: false }));
  let html = '<div class="form-grid">';
  schema.forEach((s, i) => {
    const val = item ? (item[s.key] !== undefined ? item[s.key] : '') : '';
    const full = ['nome', 'endereco', 'qualificacao'].includes(s.key) ? ' full' : '';
    let input;
    if (s.tipo === 'date') {
      input = `<input type="date" id="dado-field-${i}" data-fieldkey="${s.key}" class="w-full" value="${val}">`;
    } else if (s.tipo === 'number') {
      input = `<input type="number" id="dado-field-${i}" data-fieldkey="${s.key}" class="w-full" value="${val}" placeholder="${s.label}">`;
    } else if (s.tipo === 'textarea') {
      input = `<textarea id="dado-field-${i}" data-fieldkey="${s.key}" class="w-full" rows="2" placeholder="${s.label}">${val}</textarea>`;
    } else if (s.tipo === 'moeda') {
      input = `<div style="position:relative"><span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text3);font-size:13px;pointer-events:none">R$</span><input type="number" id="dado-field-${i}" data-fieldkey="${s.key}" class="w-full" step="0.01" min="0" style="padding-left:30px" value="${val}" placeholder="0,00"></div>`;
    } else if (s.tipo === 'listafixo' && s.listaFonte) {
      const listaFonte = ls(s.listaFonte) || [];
      const opts = listaFonte.map(it => {
        const label = typeof it === 'string' ? it : (it.sigla || it.nome || it.valor || String(it));
        return `<option value="${label}" ${label === val ? 'selected' : ''}>${label}</option>`;
      }).join('');
      input = `<select id="dado-field-${i}" data-fieldkey="${s.key}" class="w-full"><option value="">— Selecionar —</option>${opts}</select>`;
    } else {
      input = `<input type="text" id="dado-field-${i}" data-fieldkey="${s.key}" class="w-full" value="${val}" placeholder="${s.label}">`;
    }
    html += `<div class="field-group${full}" style="margin-bottom:10px"><label>${s.label}</label>${input}</div>`;
  });

  // Cálculo automático para unidades com cgFim
  if (key === 'unidades' && item && item.cgFim) {
    const prazo = ls('prazoAlerta') || 18;
    const hoje = new Date();
    const fim = new Date(item.cgFim + 'T12:00:00');
    const diffDias = Math.ceil((fim - hoje) / 86400000);
    const diffMeses = Math.round(diffDias / 30.44);
    const diffAnos = (diffDias / 365.25).toFixed(1);
    const previsao = item._previsaoNovoProcesso || '';
    const cor = diffDias < 0 ? 'var(--red2)' : diffDias < prazo * 30 ? 'var(--yellow2)' : 'var(--green)';
    const prevCor = previsao && new Date(previsao) < hoje ? 'var(--red2)' : 'var(--yellow2)';
    html += `<div class="field-group full" style="margin-top:6px">
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:12px">
        <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Cálculos Automáticos</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:10px">
          <div><div style="color:var(--text3);font-size:10px">Dias p/ fim CG</div><div style="font-size:20px;font-weight:600;color:${cor}">${diffDias < 0 ? 'Vencido' : diffDias + 'd'}</div></div>
          <div><div style="color:var(--text3);font-size:10px">Meses p/ fim CG</div><div style="font-size:20px;font-weight:600;color:${cor}">${diffMeses < 0 ? '-' : diffMeses + 'm'}</div></div>
          <div><div style="color:var(--text3);font-size:10px">Anos p/ fim CG</div><div style="font-size:20px;font-weight:600;color:${cor}">${diffDias < 0 ? '-' : diffAnos + 'a'}</div></div>
        </div>
        <div style="padding-top:8px;border-top:1px solid var(--border)">
          <div style="font-size:10px;color:var(--text3);margin-bottom:3px">⚠ Previsão de Início do Novo Processo (${prazo} meses antes do fim)</div>
          <div style="font-size:14px;font-weight:600;color:${prevCor}">${previsao ? new Date(previsao + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</div>
        </div>
      </div>
    </div>`;
  }
  html += '</div>';
  return html;
}

// ── salvarDadoFixo ────────────────────────────────────────────
function salvarDadoFixo() {
  const { key, id, isNew } = dadoFixoContext;
  const cat = getCatConfig(key);
  const data = ls(key) || [];

  if (!cat.fields) {
    const val = document.getElementById('dado-field-0')?.value.trim();
    if (!val) return;
    if (isNew) data.push(val);
    else {
      const idx = typeof id === 'number' ? id : parseInt(id);
      data[idx] = val;
    }
  } else {
    const obj = {};
    document.querySelectorAll('[id^="dado-field-"][data-fieldkey]').forEach(el => {
      obj[el.dataset.fieldkey] = el.value?.trim ? el.value.trim() : el.value;
    });
    if (!obj[cat.fields[0]]) { alert('Preencha o campo obrigatório: ' + cat.fields[0]); return; }
    if (key === 'unidades' && obj.cgFim) {
      const prazo = ls('prazoAlerta') || 18;
      const fim = new Date(obj.cgFim + 'T12:00:00');
      const prev = new Date(fim);
      prev.setMonth(prev.getMonth() - prazo);
      obj._previsaoNovoProcesso = prev.toISOString().split('T')[0];
    }
    if (isNew) { obj.id = genId(); data.push(obj); }
    else {
      const idx = data.findIndex(x => x.id === id);
      if (idx >= 0) { obj.id = id; data[idx] = obj; }
    }
  }
  ls(key, data);
  closeModal('modal-dado-fixo');
  renderDadosFixos();
  showToast('Item salvo!');
}

function excluirDadoFixo() {
  const { key, id } = dadoFixoContext;
  if (!confirm('Excluir este item?')) return;
  const cat = getCatConfig(key);
  let data = ls(key) || [];
  if (!cat.fields) {
    const idx = typeof id === 'number' ? id : parseInt(id);
    data.splice(idx, 1);
  } else {
    data = data.filter(x => x.id !== id);
  }
  ls(key, data);
  closeModal('modal-dado-fixo');
  renderDadosFixos();
  showToast('Item excluído!');
}

function openAdicionarDadoFixo(key) {
  dadoFixoContext = { key, id: null, isNew: true };
  const labelMap = { unidades: 'Unidade de Saúde', oss: 'Organização Social', setores: 'Setor/Órgão', pessoas: 'Pessoa', statusProcesso: 'Status', fases: 'Fase', tiposProcesso: 'Tipo de Processo', statusContrato: 'Status do Contrato', tiposUnidade: 'Tipo de Unidade' };
  document.getElementById('modal-dado-title').textContent = 'Novo: ' + (labelMap[key] || key);
  const subEl = document.getElementById('modal-dado-subtitle');
  if (subEl) { const schema = ls('schema_' + key); subEl.textContent = schema ? schema.length + ' campos' : ''; }
  document.getElementById('btn-excluir-dado').style.display = 'none';
  const cat = getCatConfig(key);
  document.getElementById('modal-dado-body').innerHTML = !cat.fields
    ? `<div class="field-group"><label>Valor</label><input type="text" id="dado-field-0" class="w-full" placeholder="Novo item"></div>`
    : buildDadoFixoForm(key, cat.fields, null);
  attachUnidadeAutoCalc(key);
  openModal('modal-dado-fixo');
}

function openEditarDadoFixo(key, id) {
  dadoFixoContext = { key, id, isNew: false };
  const labelMap = { unidades: 'Unidade de Saúde', oss: 'Organização Social', setores: 'Setor/Órgão', pessoas: 'Pessoa', statusProcesso: 'Status', fases: 'Fase', tiposProcesso: 'Tipo de Processo', statusContrato: 'Status do Contrato', tiposUnidade: 'Tipo de Unidade' };
  document.getElementById('modal-dado-title').textContent = 'Editar: ' + (labelMap[key] || key);
  const subEl = document.getElementById('modal-dado-subtitle');
  if (subEl) { const schema = ls('schema_' + key); subEl.textContent = schema ? schema.length + ' campos' : ''; }
  document.getElementById('btn-excluir-dado').style.display = 'inline-flex';
  const cat = getCatConfig(key);
  const data = ls(key) || [];
  let item;
  if (!cat.fields) {
    const idx = typeof id === 'number' ? id : parseInt(id);
    item = data[idx];
  } else {
    item = data.find(x => x.id === id) || data[parseInt(id)];
  }
  document.getElementById('modal-dado-body').innerHTML = !cat.fields
    ? `<div class="field-group"><label>Valor</label><input type="text" id="dado-field-0" class="w-full" value="${item || ''}"></div>`
    : buildDadoFixoForm(key, cat.fields, item);
  attachUnidadeAutoCalc(key);
  openModal('modal-dado-fixo');
}

function attachUnidadeAutoCalc(key) {
  if (key !== 'unidades') return;
  const el = document.querySelector('[data-fieldkey="cgFim"]');
  if (!el) return;
  el.addEventListener('change', () => {
    if (!el.value) return;
    const prazo = ls('prazoAlerta') || 18;
    const fim = new Date(el.value + 'T12:00:00');
    const prev = new Date(fim);
    prev.setMonth(prev.getMonth() - prazo);
    const prevEl = document.querySelector('[data-fieldkey="_previsaoNovoProcesso"]');
    if (prevEl) prevEl.value = prev.toISOString().split('T')[0];
  });
}

// ── Schema dinâmico ───────────────────────────────────────────
function openGerenciarSchema(key) {
  schemaEditKey = key;
  const schema = ls('schema_' + key) || [];
  const labelMap = { unidades: 'Unidades de Saúde', oss: 'Organizações Sociais' };
  renderSchemaModal(schema, labelMap[key] || key);
  openModal('modal-schema');
}

function renderSchemaModal(schema, title) {
  let el = document.getElementById('modal-schema');
  if (!el) {
    el = document.createElement('div');
    el.id = 'modal-schema';
    el.className = 'modal-overlay';
    el.innerHTML = `<div class="modal" style="max-width:680px">
      <div class="modal-header">
        <div><div class="modal-title" id="schema-modal-title">Gerenciar Campos</div><div class="modal-subtitle">Adicione, edite ou remova campos do cadastro</div></div>
        <button class="close-btn" onclick="closeModal('modal-schema')"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg></button>
      </div>
      <div class="modal-body">
        <div class="alert info" style="margin-bottom:16px"><svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14" style="flex-shrink:0"><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/></svg>
          Campos 🔒 são obrigatórios e não podem ser excluídos. Alterações de schema não afetam dados existentes.</div>
        <div id="schema-fields-list" style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px"></div>
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:14px">
          <div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:10px">Adicionar Novo Campo</div>
          <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end">
            <div class="field-group"><label>Nome do Campo</label><input type="text" id="new-field-label" placeholder="Ex: Representante Legal" class="w-full"></div>
            <div class="field-group"><label>Tipo</label>
              <select id="new-field-tipo" class="w-full">
                <option value="text">Texto</option><option value="date">Data</option><option value="number">Número</option><option value="textarea">Texto longo</option><option value="moeda">Valor (R$)</option><option value="listafixo">Lista Fixa</option>
              </select>
            </div>
            <button class="btn primary" onclick="adicionarCampoSchema()" style="align-self:end">+ Adicionar</button>
          </div>
        </div>
      </div>
      <div class="modal-footer"><button class="btn" onclick="closeModal('modal-schema')">Fechar</button></div>
    </div>`;
    el.addEventListener('click', e => { if (e.target === el) closeModal('modal-schema'); });
    document.body.appendChild(el);
  }
  document.getElementById('schema-modal-title').textContent = 'Campos: ' + title;
  const lista = document.getElementById('schema-fields-list');
  const cur = ls('schema_' + schemaEditKey) || schema;
  lista.innerHTML = cur.map((f, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--bg1);border:1px solid var(--border);border-radius:var(--radius)">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:500">${f.label} ${f.protegido ? '🔒' : ''}</div>
        <div style="font-size:10px;color:var(--text3);font-family:var(--mono)">${f.key} · ${f.tipo}</div>
      </div>
      <select onchange="editarTipoCampoSchema(${i},this.value)" style="font-size:11px;padding:3px 6px;width:100px">
        <option value="text" ${f.tipo === 'text' ? 'selected' : ''}>Texto</option>
        <option value="date" ${f.tipo === 'date' ? 'selected' : ''}>Data</option>
        <option value="number" ${f.tipo === 'number' ? 'selected' : ''}>Número</option>
        <option value="moeda" ${f.tipo === 'moeda' ? 'selected' : ''}>Moeda</option>
        <option value="listafixo" ${f.tipo === 'listafixo' ? 'selected' : ''}>Lista Fixa</option>
      </select>
      <input type="text" value="${f.label}" onchange="renomearCampoSchema(${i},this.value)" style="width:180px;font-size:12px;padding:4px 8px" ${f.protegido ? 'readonly' : ''}>
      ${f.protegido ? '<div style="width:28px"></div>' : `<button class="btn sm icon danger" onclick="excluirCampoSchema(${i})"><svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg></button>`}
    </div>`).join('');
}

function adicionarCampoSchema() {
  const label = document.getElementById('new-field-label').value.trim();
  const tipo = document.getElementById('new-field-tipo').value;
  if (!label) { alert('Informe o nome do campo!'); return; }
  const key = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const schema = ls('schema_' + schemaEditKey) || [];
  if (schema.find(f => f.key === key)) { alert('Já existe um campo com este nome!'); return; }
  schema.push({ key, label, tipo, protegido: false });
  ls('schema_' + schemaEditKey, schema);
  document.getElementById('new-field-label').value = '';
  const labelMap = { unidades: 'Unidades de Saúde', oss: 'Organizações Sociais' };
  renderSchemaModal(schema, labelMap[schemaEditKey] || schemaEditKey);
  showToast('Campo "' + label + '" adicionado!');
}

function renomearCampoSchema(idx, newLabel) {
  const schema = ls('schema_' + schemaEditKey) || [];
  if (schema[idx]) { schema[idx].label = newLabel; ls('schema_' + schemaEditKey, schema); }
}

function editarTipoCampoSchema(idx, newTipo) {
  const schema = ls('schema_' + schemaEditKey) || [];
  if (schema[idx] && !schema[idx].protegido) { schema[idx].tipo = newTipo; ls('schema_' + schemaEditKey, schema); }
}

function excluirCampoSchema(idx) {
  const schema = ls('schema_' + schemaEditKey) || [];
  if (schema[idx]?.protegido) return;
  if (!confirm('Excluir o campo "' + schema[idx].label + '"?')) return;
  schema.splice(idx, 1);
  ls('schema_' + schemaEditKey, schema);
  const labelMap = { unidades: 'Unidades de Saúde', oss: 'Organizações Sociais' };
  renderSchemaModal(schema, labelMap[schemaEditKey] || schemaEditKey);
}

// ── Usuários ──────────────────────────────────────────────────
function renderUsuarios() {
  const users = ls('usuarios') || [];
  const isAdmin = APP.currentUser?.perfil === 'admin';
  const curLogin = APP.currentUser?.login;
  const list = document.getElementById('usuarios-list');
  if (!list) return;
  if (!users.length) { list.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:12px">Nenhum usuário cadastrado.</div>'; return; }
  list.innerHTML = users.map(u => {
    const isMaster = u.login === 'admin';
    const canEdit = isAdmin && !(isMaster && curLogin !== 'admin');
    return `<div class="config-item">
      <div class="user-avatar" style="width:34px;height:34px;font-size:13px;flex-shrink:0;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600">${(u.nome || '?').charAt(0).toUpperCase()}</div>
      <div class="config-item-text" style="flex:1;min-width:0">
        <div style="font-weight:500;font-size:13px">${u.nome || '-'}</div>
        <div class="config-item-sub">@${u.login} · ${u.perfil === 'admin' ? '🔑 Administrador' : '👤 Usuário'}${u.matricula ? ' · Mat: ' + u.matricula : ''}${u.email ? ' · ' + u.email : ''}</div>
      </div>
      <div class="config-item-actions" style="display:flex;gap:6px">
        ${canEdit ? `<button class="btn sm" onclick="resetarSenhaUser('${u.id}')" title="Resetar senha para 123">🔄 Senha</button>
          <button class="btn sm" onclick="openEditarUsuario('${u.id}')">Editar</button>
          ${u.id !== APP.currentUser?.id ? `<button class="btn sm danger" onclick="excluirUsuario('${u.id}')">✕</button>` : ''}` :
          isMaster ? '<span style="font-size:11px;color:var(--text3);padding:3px 8px;background:var(--bg2);border-radius:var(--radius);border:1px solid var(--border)">🔒 Master</span>' : ''}
      </div>
    </div>`;
  }).join('');
}

function openAdicionarUsuario() {
  document.getElementById('modal-user-title').textContent = 'Novo Usuário';
  ['user-id-edit', 'user-nome', 'user-login'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const mat = document.getElementById('user-matricula'); if (mat) mat.value = '';
  const email = document.getElementById('user-email'); if (email) email.value = '';
  const perf = document.getElementById('user-perfil'); if (perf) perf.value = 'usuario';
  openModal('modal-usuario');
}

function openEditarUsuario(id) {
  if (isMasterProtected?.(id)) { showToast('⚠ O usuário master só pode ser editado por ele mesmo.'); return; }
  const users = ls('usuarios') || [];
  const u = users.find(x => x.id === id);
  if (!u) return;
  document.getElementById('modal-user-title').textContent = 'Editar Usuário';
  document.getElementById('user-id-edit').value = id;
  document.getElementById('user-nome').value = u.nome || '';
  document.getElementById('user-login').value = u.login || '';
  if (document.getElementById('user-matricula')) document.getElementById('user-matricula').value = u.matricula || '';
  if (document.getElementById('user-email')) document.getElementById('user-email').value = u.email || '';
  document.getElementById('user-perfil').value = u.perfil || 'usuario';
  openModal('modal-usuario');
}

function excluirUsuario(id) {
  if (isMasterProtected?.(id)) { showToast('⚠ O usuário master não pode ser excluído.'); return; }
  if (id === APP.currentUser?.id) { alert('Você não pode excluir seu próprio usuário.'); return; }
  if (!confirm('Excluir este usuário permanentemente?')) return;
  let users = ls('usuarios') || [];
  users = users.filter(u => u.id !== id);
  ls('usuarios', users);
  renderUsuarios();
  showToast('Usuário excluído.');
}

// ── Apps Script URL + Token ───────────────────────────────────
function salvarAppsScriptUrl() {
  const url = document.getElementById('apps-script-url-input')?.value.trim();
  if (!url || !url.includes('script.google.com')) { showToast('URL inválida'); return; }
  localStorage.setItem('gttrcg_apps_script_url', url);
  if (typeof GSHEET_URL !== 'undefined') window.GSHEET_URL = url;
  showToast('URL do Apps Script salva!');
  renderConfiguracoes();
}

function salvarApiToken() {
  const val = document.getElementById('api-token-input')?.value.trim();
  if (!val) { showToast('Informe o token!'); return; }
  localStorage.setItem('gttrcg_api_token', val);
  if (typeof GSHEET_TOKEN !== 'undefined') window.GSHEET_TOKEN = val;
  showToast('Token salvo!');
}

async function testarAppsScript() {
  const resultEl = document.getElementById('apps-script-test-result');
  if (resultEl) resultEl.innerHTML = '<span style="color:var(--text3)">Testando...</span>';
  try {
    const url = localStorage.getItem('gttrcg_apps_script_url');
    if (!url) throw new Error('URL não configurada');
    const fullUrl = new URL(url);
    fullUrl.searchParams.set('action', 'ping');
    const resp = await fetch(fullUrl.toString());
    const data = await resp.json();
    if (data.error) throw new Error(data.error);
    if (resultEl) resultEl.innerHTML = `<span style="color:var(--green)">✓ Conectado! ${data.sistema || 'GTTRCG'} · ${new Date(data.ts).toLocaleTimeString('pt-BR')}</span>`;
  } catch (e) {
    if (resultEl) resultEl.innerHTML = `<span style="color:var(--red2)">✗ Falha: ${e.message}</span>`;
  }
}

// ── Importar dados ────────────────────────────────────────────
let _importData = null;

function processarImportacao(input) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      _importData = JSON.parse(e.target.result);
      mostrarPreviewImportacao(_importData, file.name);
    } catch (err) {
      document.getElementById('import-preview').style.display = 'block';
      document.getElementById('import-preview').innerHTML = `<div class="alert danger">✗ Arquivo inválido: ${err.message}</div>`;
      document.getElementById('import-actions').style.display = 'none';
    }
  };
  reader.readAsText(file);
}

function mostrarPreviewImportacao(data, filename) {
  const labels = { unidades: 'Unidades de Saúde', oss: 'Organizações Sociais', setores: 'Setores', pessoas: 'Pessoas', statusProcesso: 'Status de Processo', fases: 'Fases', tiposProcesso: 'Tipos de Processo', statusContrato: 'Status do Contrato', tiposUnidade: 'Tipos de Unidade', schema_unidades: 'Schema Unidades', schema_oss: 'Schema OSS' };
  const rows = Object.entries(data).filter(([k]) => k !== 'processos').map(([k, v]) => {
    const count = Array.isArray(v) ? v.length : (v ? 1 : 0);
    const existente = ls(k);
    const existCount = Array.isArray(existente) ? existente.length : 0;
    const status = existCount > 0 ? `⚠ Substituirá ${existCount} itens` : '✓ Novo';
    const cor = existCount > 0 ? 'var(--yellow2)' : 'var(--green)';
    return `<tr><td style="padding:6px 10px;font-size:13px">${labels[k] || k}</td><td style="padding:6px 10px;text-align:center"><strong>${count}</strong></td><td style="padding:6px 10px;font-size:12px;color:${cor}">${status}</td></tr>`;
  }).join('');

  document.getElementById('import-preview').style.display = 'block';
  document.getElementById('import-actions').style.display = 'block';
  document.getElementById('import-preview').innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius2);overflow:hidden">
    <div style="padding:10px 14px;background:var(--bg1);border-bottom:1px solid var(--border);font-size:13px;font-weight:500">📄 ${filename}</div>
    <table style="width:100%;border-collapse:collapse"><thead><tr style="background:var(--bg2)">
      <th style="padding:6px 10px;text-align:left;font-size:11px;color:var(--text3)">Categoria</th>
      <th style="padding:6px 10px;text-align:center;font-size:11px;color:var(--text3)">Itens</th>
      <th style="padding:6px 10px;text-align:left;font-size:11px;color:var(--text3)">Situação</th>
    </tr></thead><tbody>${rows}</tbody></table>
  </div>
  <div style="font-size:12px;color:var(--text3);margin-top:8px">⚠ Processos cadastrados não serão afetados.</div>`;
}

function confirmarImportacao() {
  if (!_importData) return;
  const skip = ['processos'];
  let importados = 0;
  Object.entries(_importData).forEach(([key, val]) => {
    if (skip.includes(key) || val === null || val === undefined) return;
    ls(key, val);
    importados++;
  });
  setTimeout(() => {
    updateSidebarCounts(); renderDashboard(); renderConfiguracoes();
    showToast(`✓ ${importados} categorias importadas!`);
    document.getElementById('import-preview').style.display = 'none';
    document.getElementById('import-actions').style.display = 'none';
    _importData = null;
  }, 300);
}

function cancelarImportacao() {
  _importData = null;
  document.getElementById('import-preview').style.display = 'none';
  document.getElementById('import-actions').style.display = 'none';
}
