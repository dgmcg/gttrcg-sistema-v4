// ============================================================
// relatorios.js — Geração de documentos institucionais GTTRCG
//
// Estrutura em três camadas, propositalmente separadas:
//
//   1. CATÁLOGO   — o que pode entrar no documento. Montado em tempo
//                   de execução a partir dos schemas e das etapas, para
//                   que um campo novo criado em Configurações apareça
//                   aqui sozinho, sem alteração de código.
//   2. RECEITA    — o que o usuário escolheu (blocos, campos, ordem).
//                   É o que os modelos salvam.
//   3. RENDER     — transforma catálogo + receita + dados em documento.
//
// Os formatos de saída (impressão/PDF e Word) leem do MESMO render,
// para que nunca divirjam entre si.
// ============================================================

// ── Identidade visual ─────────────────────────────────────────
// Cores da Bandeira de Pernambuco — Lei Estadual nº 17.139/2020.
// Os tons "escuro" são derivados para garantir contraste mínimo de
// 4,5:1 em texto: as cores puras amarelo e verde não são legíveis
// em corpo de texto nem sobrevivem a uma fotocópia em preto e branco.
const REL_CORES = {
  azul:        '#3155A4',
  azulEscuro:  '#24407D',
  vermelho:    '#C34342',
  amarelo:     '#FFB511',
  verde:       '#00AD4A',
  verdeTxt:    '#008137',
  amareloTxt:  '#996C0A',
  vermelhoTxt: '#C34342',
};

// Definido em brasao.js, carregado antes deste arquivo.
const REL_BRASAO = (typeof REL_BRASAO_DATA !== 'undefined') ? REL_BRASAO_DATA : '';

// ── Cabeçalho institucional ───────────────────────────────────
const REL_ORGAO = {
  esfera: 'Governo do Estado de Pernambuco',
  secretaria: 'Secretaria Estadual de Saúde',
  linhas: [
    'Secretaria Executiva de Coordenação Interinstitucional — SECI',
    'Diretoria Geral de Monitoramento dos Contratos de Gestão — DGMCG',
    'Gerência Técnica de Termos de Referência dos Contratos de Gestão — GTTRCG',
  ],
};

// ============================================================
// 1. CATÁLOGO — o que pode entrar no documento
// ============================================================

/**
 * Blocos do relatório de processo, na ordem padrão.
 *
 * `campos` é a lista fixa; blocos cujo conteúdo varia conforme os
 * dados (as etapas, por exemplo) declaram `dinamico: true` e montam
 * a própria lista em catalogoRelatorioProcesso().
 */
const BLOCOS_PROCESSO = [
  {
    key: 'identificacao',
    titulo: 'Identificação',
    descricao: 'Dados cadastrais do processo e da unidade',
    campos: [
      { key: 'nome',         label: 'Unidade de Saúde',      largo: true },
      { key: 'tipoProcesso', label: 'Tipo de Processo' },
      { key: 'sei',          label: 'Processo SEI' },
      { key: 'cg',           label: 'Contrato de Gestão' },
      { key: 'oss',          label: 'Organização Social' },
      { key: 'tipo',         label: 'Tipo de Unidade' },
      { key: 'macro',        label: 'Macrorregião' },
      { key: 'regiao',       label: 'Região de Saúde' },
      { key: 'municipio',    label: 'Município' },
      { key: 'porte',        label: 'Porte' },
      { key: 'inicio',       label: 'Início do Processo', data: true },
      { key: 'previsao',     label: 'Previsão de Conclusão', data: true },
      { key: 'areaNT',       label: 'Área / NT Responsável' },
      { key: 'responsavel',  label: 'Responsável GTTRCG', usuario: true },
      { key: 'vigInicio',    label: 'Início da Vigência', data: true },
      { key: 'vigFim',       label: 'Fim da Vigência', data: true },
      { key: 'statusCG',     label: 'Status do Contrato' },
    ],
  },
  {
    key: 'situacao',
    titulo: 'Situação Atual',
    descricao: 'Status, fase, progresso e tempo de tramitação',
    campos: [
      { key: 'status',    label: 'Status' },
      { key: 'fase',      label: 'Fase atual' },
      { key: 'progresso', label: 'Progresso (%)' },
      { key: 'etapasN',   label: 'Etapas concluídas' },
      { key: 'duracao',   label: 'Tempo de tramitação' },
    ],
  },
  {
    key: 'etapas',
    titulo: 'Detalhamento das Etapas',
    descricao: 'Cada etapa do fluxo com status, datas, responsável e campos preenchidos',
    dinamico: true,
    opcoes: [
      { key: 'mostrarNaoIniciadas', label: 'Incluir etapas ainda não iniciadas', padrao: true },
      { key: 'mostrarNaoAplica',    label: 'Incluir etapas marcadas como “Não se Aplica”', padrao: true },
      { key: 'mostrarAcao',         label: 'Incluir a ação/protocolo de cada etapa', padrao: false },
      { key: 'mostrarObs',          label: 'Incluir as observações de cada etapa', padrao: true },
    ],
  },
  {
    key: 'tempos',
    titulo: 'Tempos e Cumprimento de Prazos',
    descricao: 'Tabela com início, conclusão, duração e situação do prazo por etapa',
    campos: [
      { key: 'col_inicio',    label: 'Coluna: Início' },
      { key: 'col_conclusao', label: 'Coluna: Conclusão' },
      { key: 'col_duracao',   label: 'Coluna: Duração' },
      { key: 'col_prazo',     label: 'Coluna: Prazo' },
      { key: 'col_situacao',  label: 'Coluna: Situação do prazo' },
      { key: 'col_resp',      label: 'Coluna: Responsável' },
    ],
  },
  {
    key: 'pendencias',
    titulo: 'Pendências e Pontos de Atenção',
    descricao: 'Prazos vencidos, campos sem preenchimento e etapas sem responsável',
    campos: [
      { key: 'pend_prazo',  label: 'Prazos vencidos' },
      { key: 'pend_campos', label: 'Campos sem preenchimento' },
      { key: 'pend_resp',   label: 'Etapas sem responsável ou sem prazo' },
    ],
  },
  {
    key: 'observacoes',
    titulo: 'Observações Gerais',
    descricao: 'Campo de observações do processo',
    campos: [ { key: 'obs', label: 'Observações do processo', largo: true } ],
  },
  {
    key: 'assinatura',
    titulo: 'Assinatura',
    descricao: 'Linha de assinatura ao final do documento',
    campos: [
      { key: 'ass_nome',  label: 'Nome de quem assina' },
      { key: 'ass_cargo', label: 'Cargo / unidade' },
    ],
  },
];

/**
 * Monta o catálogo completo para um processo.
 *
 * O bloco de etapas é montado aqui, a partir das etapas do TIPO deste
 * processo — por isso o catálogo de um Emergencial não oferece campos
 * de etapas que só existem no Ordinário.
 */
function catalogoRelatorioProcesso(proc) {
  const etapas = etapasOrdenadas(etapasDoProcesso(proc));
  const blocos = BLOCOS_PROCESSO.map(b => ({ ...b, campos: (b.campos || []).map(c => ({ ...c })) }));

  const blocoEtapas = blocos.find(b => b.key === 'etapas');
  if (blocoEtapas) {
    // Cada etapa vira um item selecionável; seus campos personalizados
    // entram como subitens, lidos do próprio cadastro da etapa.
    blocoEtapas.campos = etapas.map(e => ({
      key: 'etapa_' + e.id,
      label: e.nome,
      fase: e.fase,
      subcampos: (e.campos || []).map(c => ({
        key: `campo_${e.id}_${c.label}`,
        label: c.label,
        tipo: c.tipo,
      })),
    }));
  }
  return blocos;
}

/** Receita padrão: tudo ligado, exceto o que é opcional por natureza. */
function receitaPadraoProcesso(proc) {
  const catalogo = catalogoRelatorioProcesso(proc);
  const receita = { blocos: {}, opcoes: {}, titulo: 'Relatório de Acompanhamento de Processo' };
  catalogo.forEach(b => {
    receita.blocos[b.key] = { ativo: true, campos: {} };
    (b.campos || []).forEach(c => {
      receita.blocos[b.key].campos[c.key] = true;
      (c.subcampos || []).forEach(sc => { receita.blocos[b.key].campos[sc.key] = true; });
    });
    (b.opcoes || []).forEach(o => { receita.opcoes[o.key] = o.padrao !== false; });
  });
  return receita;
}

// ============================================================
// HELPERS DE APRESENTAÇÃO
// ============================================================

/** Valor de campo pronto para o documento; vazio vira "não informado". */
function relValor(v, ehData) {
  if (v === undefined || v === null || v === '' || v === false) {
    return '<span class="rel-vazio">não informado</span>';
  }
  if (ehData) {
    const d = fmtDate(v);
    return d ? escHtml(d) : '<span class="rel-vazio">não informado</span>';
  }
  return escHtml(String(v));
}

/** Converte login em nome de usuário, quando houver cadastro. */
function relNomeUsuario(login) {
  if (!login) return '';
  const u = (ls('usuarios') || []).find(x => x.login === login);
  return u ? u.nome : login;
}

/** Diferença em dias entre duas datas (a segunda vazia = hoje). */
function relDias(de, ate) {
  if (!de) return null;
  const d1 = new Date(de + 'T12:00:00');
  const d2 = ate ? new Date(ate + 'T12:00:00') : new Date();
  if (isNaN(d1) || isNaN(d2)) return null;
  return Math.max(0, Math.round((d2 - d1) / 86400000));
}

/**
 * Situação do prazo de uma etapa.
 * Devolve { classe, texto } ou null quando não há prazo definido —
 * caso em que o documento diz isso explicitamente, em vez de omitir.
 */
function relSituacaoPrazo(ac) {
  const prazo = ac._prazo;
  if (!prazo) return null;
  const fim = ac._concluido ? (ac._concluido_em || null) : null;
  const ref = fim ? new Date(fim + 'T12:00:00') : new Date();
  const lim = new Date(prazo + 'T23:59:59');
  if (isNaN(lim)) return null;
  const dias = Math.round((ref - lim) / 86400000);
  if (dias <= 0) return { classe: 'ok', texto: 'no prazo' };
  if (ac._concluido) return { classe: 'atraso', texto: `${dias} dia${dias === 1 ? '' : 's'} além` };
  return { classe: 'atraso', texto: `${dias} dia${dias === 1 ? '' : 's'} em atraso` };
}

/** Estado de uma etapa no acompanhamento deste processo. */
function relEstadoEtapa(ac) {
  if (ac._naoAplica === true) return { classe: 'na',        rotulo: 'Não se aplica', num: 'N/A' };
  if (ac._concluido  === true) return { classe: 'concluida', rotulo: 'Concluída',    num: null };
  if (ac._iniciado   === true) return { classe: 'andamento', rotulo: 'Em andamento', num: null };
  return { classe: 'pendente', rotulo: 'Não iniciada', num: null };
}


// ============================================================
// LAYOUT — o Word não entende grid nem flex
//
// O Word renderiza HTML antigo: CSS grid e flexbox são ignorados e
// tudo empilha numa coluna só. Onde o layout depende de colunas, o
// modo 'word' gera <table>, que o Word respeita desde sempre.
// O conteúdo continua vindo de um lugar só — muda a caixa, não o texto.
// ============================================================

/** Distribui itens em colunas: grade CSS na tela, tabela no Word. */
function _relGrade(itens, nColunas, modo, classe) {
  if (!itens.length) return '';
  if (modo !== 'word') {
    return `<div class="${classe}">${itens.map(i =>
      `<div${i.largo ? ' class="rel-largo"' : ''}>${i.html}</div>`).join('')}</div>`;
  }
  // Word: uma linha de tabela a cada n itens; item largo ocupa a linha toda
  const larg = Math.floor(100 / nColunas);
  let html = `<table class="${classe}" width="100%" cellspacing="0" cellpadding="0"><tr>`;
  let naLinha = 0;
  itens.forEach(i => {
    if (i.largo) {
      if (naLinha) { html += _relPreenche(nColunas - naLinha, larg) + '</tr><tr>'; naLinha = 0; }
      html += `<td colspan="${nColunas}" class="rel-td">${i.html}</td></tr><tr>`;
      return;
    }
    if (naLinha === nColunas) { html += '</tr><tr>'; naLinha = 0; }
    html += `<td width="${larg}%" class="rel-td" valign="top">${i.html}</td>`;
    naLinha++;
  });
  if (naLinha && naLinha < nColunas) html += _relPreenche(nColunas - naLinha, larg);
  return html + '</tr></table>';
}

/** Células vazias para fechar a última linha da tabela. */
function _relPreenche(quantas, larg) {
  let t = '';
  for (let i = 0; i < quantas; i++) t += `<td width="${larg}%"></td>`;
  return t;
}

/** Faixa com as cores do estado. */
function _relFaixaCores(modo) {
  if (modo !== 'word') return '<div class="rel-faixa"><i></i><i></i><i></i><i></i></div>';
  const c = REL_CORES;
  return `<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:16px">
    <tr>
      <td width="67%" bgcolor="${c.azul}" style="font-size:2pt;line-height:2pt">&nbsp;</td>
      <td width="11%" bgcolor="${c.amarelo}" style="font-size:2pt;line-height:2pt">&nbsp;</td>
      <td width="11%" bgcolor="${c.vermelho}" style="font-size:2pt;line-height:2pt">&nbsp;</td>
      <td width="11%" bgcolor="${c.verde}" style="font-size:2pt;line-height:2pt">&nbsp;</td>
    </tr></table>`;
}

/** Linha de blocos lado a lado (painel de situação). */
function _relColunas(blocos, modo) {
  if (!blocos.length) return '';
  if (modo !== 'word') return `<div class="rel-situacao">${blocos.join('')}</div>`;
  const larg = Math.floor(100 / blocos.length);
  return `<table class="rel-situacao" width="100%" cellspacing="0" cellpadding="8"
    style="border:1px solid #C9D0DC;border-left:4px solid ${REL_CORES.azul}"><tr>` +
    blocos.map(b => `<td width="${larg}%" valign="top">${b}</td>`).join('') +
    '</tr></table>';
}

// ============================================================
// 3. RENDER — documento a partir de catálogo + receita + dados
// ============================================================

/**
 * Monta o corpo do relatório de um processo.
 * Devolve apenas o conteúdo; a moldura (cabeçalho, estilos, rodapé)
 * é aplicada por relDocumentoCompleto(), que serve tanto à prévia
 * quanto à impressão e ao Word.
 */
function relMontarProcesso(proc, receita, modo) {
  const cat     = catalogoRelatorioProcesso(proc);
  const etapas  = etapasOrdenadas(etapasDoProcesso(proc));
  const acomp   = proc.acompanhamento || {};
  const ligado  = (b, c) => receita.blocos?.[b]?.ativo && receita.blocos[b].campos?.[c];
  const blocoOn = b => !!receita.blocos?.[b]?.ativo;
  const opc     = k => !!receita.opcoes?.[k];

  let html = '';
  let nSecao = 0;
  const tituloSecao = t => {
    nSecao++;
    const txt = `${nSecao}. ${escHtml(t)}`;
    return modo === 'word'
      ? `<div style="font-size:9.5pt;font-weight:bold;color:${REL_CORES.azul};` +
        `border-bottom:1.5pt solid ${REL_CORES.azul};padding-bottom:3px;` +
        `margin:14px 0 9px;text-align:left">${txt.toUpperCase()}</div>`
      : `<h2 class="rel-h2">${txt}</h2>`;
  };

  // ── Identificação ────────────────────────────────────────
  if (blocoOn('identificacao')) {
    const campos = cat.find(b => b.key === 'identificacao').campos
      .filter(c => ligado('identificacao', c.key));
    if (campos.length) {
      const itens = campos.map(c => {
        let v = proc[c.key];
        if (c.usuario) v = relNomeUsuario(v);
        return {
          largo: !!c.largo,
          html: modo === 'word'
            ? `<div class="rel-rot">${escHtml(c.label)}</div>
               <div class="rel-val">${relValor(v, c.data)}</div>`
            : `<span class="rel-rot">${escHtml(c.label)}</span>
               <span class="rel-val">${relValor(v, c.data)}</span>`,
        };
      });
      html += `<section class="rel-secao">${tituloSecao('Identificação')}` +
              _relGrade(itens, 3, modo, 'rel-dados') + '</section>';
    }
  }

  // ── Situação atual ───────────────────────────────────────
  if (blocoOn('situacao')) {
    const pct  = calcProgressoProcesso(proc, etapas);
    const conc = etapas.filter(e => (acomp[e.id] || {})._concluido).length;
    const dur  = getDuracaoProcesso(proc, etapas);
    const blocos = [];

    if (ligado('situacao', 'status') || ligado('situacao', 'fase')) {
      blocos.push(`<div class="rel-bloco">
        <span class="rel-rot">Status</span>
        <div class="rel-txt">${ligado('situacao','status') ? relValor(proc.status) : ''}</div>
        ${ligado('situacao','fase') ? `<div class="rel-sub">${relValor(proc.fase)}</div>` : ''}
      </div>`);
    }
    if (ligado('situacao', 'progresso')) {
      const barra = (modo === 'word')
        ? `<table width="100%" cellspacing="0" cellpadding="0" style="margin-top:6px;height:7px">
             <tr>
               <td width="${pct}%" bgcolor="${REL_CORES.azul}" style="font-size:4pt;line-height:4pt">&nbsp;</td>
               <td width="${100 - pct}%" bgcolor="#E6EAF1" style="font-size:4pt;line-height:4pt">&nbsp;</td>
             </tr></table>`
        : `<div class="rel-barra"><i style="width:${pct}%"></i></div>`;
      blocos.push(`<div class="rel-bloco">
        <span class="rel-rot">Progresso</span>
        <div class="rel-num">${pct}%</div>
        ${barra}
      </div>`);
    }
    if (ligado('situacao', 'etapasN')) {
      blocos.push(`<div class="rel-bloco">
        <span class="rel-rot">Etapas</span>
        <div class="rel-num">${conc}<span class="rel-num-sub"> de ${etapas.length}</span></div>
        <div class="rel-sub">concluídas</div>
      </div>`);
    }
    if (ligado('situacao', 'duracao') && dur) {
      blocos.push(`<div class="rel-bloco">
        <span class="rel-rot">${dur.concluido ? 'Tramitou por' : 'Em tramitação há'}</span>
        <div class="rel-num">${dur.dias}<span class="rel-num-sub"> dias</span></div>
        <div class="rel-sub">desde ${escHtml(fmtDate(proc.inicio) || '—')}</div>
      </div>`);
    }
    if (blocos.length) {
      html += `<section class="rel-secao">${tituloSecao('Situação Atual')}` +
              _relColunas(blocos, modo) + '</section>';
    }
  }

  // ── Detalhamento das etapas ──────────────────────────────
  if (blocoOn('etapas')) {
    const fases = {
      planejamento: 'Fase de Planejamento, Instrução e Correção',
      externa:      'Fase Externa — Publicação (SAD)',
      contratacao:  'Fase de Contratação',
    };
    let corpo = '';
    let ordem = 0;

    Object.entries(fases).forEach(([faseKey, faseLabel]) => {
      const daFase = etapas.filter(e => e.fase === faseKey)
        .filter(e => ligado('etapas', 'etapa_' + e.id))
        .filter(e => {
          const ac = acomp[e.id] || {};
          if (ac._naoAplica && !opc('mostrarNaoAplica')) return false;
          if (!ac._naoAplica && !ac._iniciado && !ac._concluido && !opc('mostrarNaoIniciadas')) return false;
          return true;
        });
      if (!daFase.length) return;

      corpo += `<div class="rel-fase">${escHtml(faseLabel)}</div>`;
      daFase.forEach(e => {
        const ac  = acomp[e.id] || {};
        const est = relEstadoEtapa(ac);
        if (est.classe !== 'na') ordem++;
        const numero = est.num || ordem;

        const tarjaCls = est.classe === 'concluida' ? 'ok'
          : est.classe === 'andamento' ? 'andando' : 'neutra';
        const corTarja = tarjaCls === 'ok' ? REL_CORES.verdeTxt
          : tarjaCls === 'andando' ? REL_CORES.azul : '#5A6472';

        corpo += `<div class="rel-etapa rel-${est.classe}">`;
        // No Word o círculo numerado e a tarja arredondada não sobrevivem:
        // viram número, nome e situação em texto, com o mesmo significado.
        corpo += (modo === 'word')
          ? `<div style="text-align:left;margin-bottom:4px">
               <span style="font-weight:bold;font-size:10.5pt">${escHtml(String(numero))}. ${escHtml(e.nome)}</span>
               <span style="font-size:8pt;font-weight:bold;color:${corTarja}">&nbsp;&nbsp;— ${escHtml(est.rotulo.toUpperCase())}</span>
             </div>`
          : `<div class="rel-etapa-topo">
               <span class="rel-etapa-n">${escHtml(String(numero))}</span>
               <span class="rel-etapa-nome">${escHtml(e.nome)}</span>
               <span class="rel-tarja rel-t-${tarjaCls}">${escHtml(est.rotulo)}</span>
             </div>`;

        if (est.classe === 'na') {
          corpo += `<div class="rel-etapa-meta"><span>Marcada como não aplicável` +
            (ac._naoAplica_em ? ` em <b>${escHtml(fmtDate(ac._naoAplica_em))}</b>` : '') +
            (ac._naoAplica_por ? ` por <b>${escHtml(relNomeUsuario(ac._naoAplica_por))}</b>` : '') + `.</span></div></div>`;
          return;
        }

        // Linha de metadados: responsável, datas, prazo
        const sit = relSituacaoPrazo(ac);
        const meta = [];
        meta.push(`Responsável: ${ac._responsavel
          ? '<b>' + escHtml(relNomeUsuario(ac._responsavel)) + '</b>'
          : '<span class="rel-vazio">não informado</span>'}`);
        if (ac._iniciado_em)  meta.push(`Início: <b>${escHtml(fmtDate(ac._iniciado_em))}</b>`);
        meta.push(`Conclusão: ${ac._concluido_em
          ? '<b>' + escHtml(fmtDate(ac._concluido_em)) + '</b>'
          : (ac._iniciado ? '<span class="rel-vazio">em aberto</span>'
                          : '<span class="rel-vazio">não iniciada</span>')}`);
        meta.push(`Prazo: ${ac._prazo
          ? '<b>' + escHtml(fmtDate(ac._prazo)) + '</b>'
          : '<span class="rel-vazio">não informado</span>'}`);
        const sep = (modo === 'word') ? ' &nbsp;·&nbsp; ' : '';
        corpo += `<div class="rel-etapa-meta">${meta.map(m => `<span>${m}</span>`).join(sep)}`;
        if (sit) {
          corpo += (modo === 'word')
            ? ` &nbsp;·&nbsp; <span style="font-weight:bold;color:${
                sit.classe === 'ok' ? REL_CORES.verdeTxt : REL_CORES.vermelhoTxt
              }">${escHtml(sit.texto)}</span>`
            : `<span class="rel-tarja rel-t-${sit.classe}">${escHtml(sit.texto)}</span>`;
        }
        corpo += '</div>';

        if (opc('mostrarAcao') && e.acao) {
          corpo += `<div class="rel-acao">${escHtml(e.acao)}</div>`;
        }

        // Campos personalizados da etapa, conforme selecionados
        const campos = (e.campos || []).filter(c =>
          c.tipo !== 'pdf' && ligado('etapas', `campo_${e.id}_${c.label}`));
        if (campos.length) {
          const itens = campos.map(c => {
            const v = ac[c.label];
            return {
              largo: String(v || '').length > 60,
              html: `<div class="rel-crot">${escHtml(c.label)}</div>
                     <div>${relValor(v, c.tipo === 'date')}</div>`,
            };
          });
          corpo += _relGrade(itens, 2, modo, 'rel-etapa-campos');
        }

        if (opc('mostrarObs') && ac._obs) {
          corpo += `<div class="rel-etapa-obs">
            <span class="rel-crot">Observações da etapa</span>
            <div>${escHtml(ac._obs)}</div></div>`;
        }

        if (!ac._iniciado && !ac._concluido) {
          corpo += `<div class="rel-nota">Etapa ainda não iniciada — os campos de acompanhamento não foram preenchidos.</div>`;
        }
        corpo += '</div>';
      });
    });

    if (corpo) {
      html += `<section class="rel-secao">${tituloSecao('Detalhamento das Etapas')}${corpo}</section>`;
    }
  }

  // ── Tempos e prazos ──────────────────────────────────────
  if (blocoOn('tempos')) {
    const linhas = etapas.filter(e => {
      const ac = acomp[e.id] || {};
      return !ac._naoAplica && (ac._iniciado || ac._concluido);
    });
    if (linhas.length) {
      const col = k => ligado('tempos', k);
      let tab = `<table class="rel-tabela"><thead><tr><th>Etapa</th>`;
      if (col('col_resp'))      tab += '<th>Responsável</th>';
      if (col('col_inicio'))    tab += '<th class="rel-dir">Início</th>';
      if (col('col_conclusao')) tab += '<th class="rel-dir">Conclusão</th>';
      if (col('col_duracao'))   tab += '<th class="rel-dir">Duração</th>';
      if (col('col_prazo'))     tab += '<th class="rel-dir">Prazo</th>';
      if (col('col_situacao'))  tab += '<th>Situação</th>';
      tab += '</tr></thead><tbody>';

      let n = 0;
      linhas.forEach(e => {
        n++;
        const ac  = acomp[e.id] || {};
        const sit = relSituacaoPrazo(ac);
        const d   = relDias(ac._iniciado_em, ac._concluido_em);
        tab += `<tr><td>${n}. ${escHtml(e.nome)}</td>`;
        if (col('col_resp'))      tab += `<td>${ac._responsavel ? escHtml(relNomeUsuario(ac._responsavel)) : '<span class="rel-vazio">—</span>'}</td>`;
        if (col('col_inicio'))    tab += `<td class="rel-dir">${ac._iniciado_em ? escHtml(fmtDate(ac._iniciado_em)) : '<span class="rel-vazio">—</span>'}</td>`;
        if (col('col_conclusao')) tab += `<td class="rel-dir">${ac._concluido_em ? escHtml(fmtDate(ac._concluido_em)) : '<span class="rel-vazio">—</span>'}</td>`;
        if (col('col_duracao'))   tab += `<td class="rel-dir">${d === null ? '<span class="rel-vazio">—</span>' : d + ' dias'}</td>`;
        if (col('col_prazo'))     tab += `<td class="rel-dir">${ac._prazo ? escHtml(fmtDate(ac._prazo)) : '<span class="rel-vazio">—</span>'}</td>`;
        if (col('col_situacao'))  tab += `<td>${sit
          ? `<span class="rel-tarja rel-t-${sit.classe}">${escHtml(sit.texto)}</span>`
          : '<span class="rel-tarja rel-t-neutra">sem prazo definido</span>'}</td>`;
        tab += '</tr>';
      });
      tab += '</tbody></table>';
      tab += `<div class="rel-nota-tabela">Duração calculada em dias corridos entre o início e a
        conclusão da etapa; para etapas em aberto, entre o início e a data de emissão deste
        relatório. Etapas não iniciadas e as marcadas como não aplicáveis não constam desta tabela.</div>`;
      html += `<section class="rel-secao">${tituloSecao('Tempos e Cumprimento de Prazos')}${tab}</section>`;
    }
  }

  // ── Pendências ───────────────────────────────────────────
  // Percorre TODAS as etapas aplicáveis, mesmo as que o usuário optou
  // por não detalhar acima: uma pendência não deixa de existir porque a
  // etapa não foi listada. Quem não quiser vê-las desliga o item
  // correspondente neste bloco.
  if (blocoOn('pendencias')) {
    const itens = [];

    etapas.forEach(e => {
      const ac = acomp[e.id] || {};
      if (ac._naoAplica || ac._concluido) return;

      if (ligado('pendencias', 'pend_prazo')) {
        const sit = relSituacaoPrazo(ac);
        if (sit && sit.classe === 'atraso') {
          itens.push({ grave: true,
            titulo: `${escHtml(e.nome)}: prazo vencido`,
            texto: `Prazo previsto para ${escHtml(fmtDate(ac._prazo))}, etapa ainda em aberto (${escHtml(sit.texto)}).` +
                   (ac._responsavel ? ` Responsável: ${escHtml(relNomeUsuario(ac._responsavel))}.` : '') });
        }
      }
      if (ligado('pendencias', 'pend_campos') && ac._iniciado) {
        const faltando = (e.campos || [])
          .filter(c => c.tipo !== 'pdf')
          .filter(c => { const v = ac[c.label]; return v === undefined || v === null || v === '' || v === false; })
          .map(c => c.label);
        if (faltando.length) {
          itens.push({ grave: false,
            titulo: `${escHtml(e.nome)}: ${faltando.length} campo${faltando.length === 1 ? '' : 's'} sem preenchimento`,
            texto: `Sem informação em: ${escHtml(faltando.join(', '))}.` });
        }
      }
      if (ligado('pendencias', 'pend_resp')) {
        const falta = [];
        if (!ac._responsavel) falta.push('responsável');
        if (!ac._prazo) falta.push('prazo');
        if (falta.length === 2) {
          itens.push({ grave: false,
            titulo: `${escHtml(e.nome)}: sem responsável e sem prazo`,
            texto: 'Sem essa designação, não há como apurar cumprimento de prazo nesta etapa.' });
        }
      }
    });

    if (itens.length) {
      const corpo = itens.map(i => `<div class="rel-pend${i.grave ? '' : ' rel-aviso'}">
        <div class="rel-pend-tit">${i.titulo}</div>
        <div class="rel-pend-txt">${i.texto}</div></div>`).join('');
      html += `<section class="rel-secao">${tituloSecao('Pendências e Pontos de Atenção')}${corpo}</section>`;
    } else {
      html += `<section class="rel-secao">${tituloSecao('Pendências e Pontos de Atenção')}
        <div class="rel-pend rel-ok"><div class="rel-pend-txt">Nenhuma pendência identificada
        nas etapas em andamento deste processo na data de emissão.</div></div></section>`;
    }
  }

  // ── Observações gerais ───────────────────────────────────
  if (blocoOn('observacoes') && ligado('observacoes', 'obs')) {
    html += `<section class="rel-secao">${tituloSecao('Observações Gerais')}
      <div class="rel-obs-geral">${proc.obs ? escHtml(proc.obs)
        : '<span class="rel-vazio">nenhuma observação registrada</span>'}</div></section>`;
  }

  // ── Assinatura ───────────────────────────────────────────
  if (blocoOn('assinatura')) {
    const nome  = receita.assNome  || '';
    const cargo = receita.assCargo || REL_ORGAO.linhas[2];
    html += `<div class="rel-assinatura">
      <div class="rel-linha-ass"></div>
      <div class="rel-ass-nome">${nome ? escHtml(nome) : '&nbsp;'}</div>
      <div class="rel-ass-cargo">${escHtml(cargo)}</div>
    </div>`;
  }

  return html;
}

// ============================================================
// MOLDURA — cabeçalho institucional, estilos e procedência
// ============================================================

/** Quando a base foi lida pela última vez, em texto; null se não houve. */
function relUltimaSincronizacao() {
  const d = (typeof _ultimaLeituraDaBase !== 'undefined') ? _ultimaLeituraDaBase : null;
  if (!d) return null;
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} às ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Data e hora atuais no formato brasileiro. */
function relAgora() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return {
    data: `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`,
    hora: `${p(d.getHours())}:${p(d.getMinutes())}`,
  };
}

/**
 * Rodapé de procedência: sem ele o documento não pode ser reconciliado
 * por quem o recebe — nem se sabe a que recorte dos dados ele se refere.
 */
function relProcedencia(proc, receita) {
  const ag    = relAgora();
  const user  = APP.currentUser;
  const todas = (ls('etapasFluxo') || []).length;
  const doTipo = etapasDoProcesso(proc).length;
  const sinc  = relUltimaSincronizacao();

  let txt = `<span class="rel-forte">Documento gerado pelo Sistema GTTRCG</span> em ${ag.data} às ${ag.hora}`;
  if (user?.nome) txt += `, por ${escHtml(user.nome)}`;
  txt += '.<br>';
  if (sinc) txt += `Dados sincronizados com a base em ${escHtml(sinc)}. `;
  txt += `Recorte: processo individual — ${doTipo} etapa${doTipo === 1 ? '' : 's'} do tipo ` +
         `“${escHtml(proc.tipoProcesso || 'sem tipo definido')}”, de um total de ${todas} ` +
         `cadastrada${todas === 1 ? '' : 's'} no fluxo.<br>`;
  txt += 'Campos sem preenchimento são apresentados como <i>não informado</i>; nenhum dado é omitido.';
  return `<div class="rel-rodape">${txt}</div>`;
}

/** Cabeçalho institucional com o brasão e a faixa de cores do estado. */
function relCabecalho(brasaoSrc, modo) {
  const src = brasaoSrc || REL_BRASAO;
  const brasao = `<img src="${src}" alt="Brasão do Estado de Pernambuco" width="76">`;
  const orgao = `<div class="rel-esfera">${escHtml(REL_ORGAO.esfera)}</div>
    <div class="rel-secretaria">${escHtml(REL_ORGAO.secretaria)}</div>
    <div class="rel-unidade">${REL_ORGAO.linhas.map(escHtml).join('<br>')}</div>`;

  const topo = (modo === 'word')
    ? `<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:12px"><tr>
         <td width="90" valign="middle">${brasao}</td>
         <td valign="middle" style="padding-left:12px">${orgao}</td>
       </tr></table>`
    : `<div class="rel-cabecalho">
         <div class="rel-brasao">${brasao}</div>
         <div class="rel-orgao">${orgao}</div>
       </div>`;

  return topo + _relFaixaCores(modo);
}

/**
 * Documento completo e autossuficiente.
 * `modo` define o destino: 'previa' (dentro do modal), 'impressao'
 * (janela própria) ou 'word' (arquivo para download).
 */
function relDocumentoCompleto(proc, receita, modo, brasaoSrc) {
  const titulo = receita.titulo || 'Relatório de Acompanhamento de Processo';
  const ag = relAgora();
  const ref = [
    proc.sei ? `Processo SEI nº ${escHtml(proc.sei)}` : null,
    `Emitido em ${ag.data}`,
  ].filter(Boolean).join(' · ');

  const corpo = `
    ${relCabecalho(brasaoSrc, modo)}
    <div class="rel-titulo-doc">
      ${modo === 'word'
        ? `<div style="font-size:14pt;font-weight:bold;color:${REL_CORES.azulEscuro};` +
          `text-align:center;margin:0 0 3px">${escHtml(titulo)}</div>`
        : `<h1>${escHtml(titulo)}</h1>`}
      <div class="rel-ref">${ref}</div>
    </div>
    ${relMontarProcesso(proc, receita, modo)}
    ${relProcedencia(proc, receita)}`;

  const base = modo === 'previa'
    ? `<base href="${location.href.replace(/[^/]*$/, '')}">` : '';

  const cabecalhoWord = modo === 'word'
    ? `<html xmlns:o="urn:schemas-microsoft-com:office:office"
             xmlns:w="urn:schemas-microsoft-com:office:word"
             xmlns="http://www.w3.org/TR/REC-html40"><head>
       <meta charset="UTF-8">
       <meta name="ProgId" content="Word.Document">
       <meta name="Generator" content="Microsoft Word">`
    : '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">';

  if (modo === 'previa') {
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
      <title>${escHtml(titulo)}</title>${base}
      <style>${relEstilosDocumento('previa')}
        body { padding: 0; }
        .rel-folha { padding: 14mm 12mm; }
      </style></head><body><div class="rel-folha">${corpo}</div></body></html>`;
  }

  return `${cabecalhoWord}
    <title>${escHtml(titulo)}</title>
    ${base}
    <style>${relEstilosDocumento(modo)}
    ${modo === 'previa' ? '.rel-folha { padding: 14mm 12mm; }' : ''}</style>
    </head><body>
      <div class="rel-folha">${corpo}</div>
      ${modo === 'impressao' ? '<script>window.onload=function(){window.print();};<\/script>' : ''}
    </body></html>`;
}

/**
 * Estilos do documento — os mesmos do modelo aprovado.
 *
 * Ficam em JavaScript, e não no style.css, porque a impressão e o
 * arquivo do Word abrem fora desta página e precisam levar o estilo
 * junto. Uma única fonte para os três destinos evita que divirjam.
 */
function relEstilosDocumento(modo) {
  const paraWord = modo === 'word';
  return `
  :root {
    --pe-azul: ${REL_CORES.azul};
    --pe-azul-escuro: ${REL_CORES.azulEscuro};
    --pe-vermelho: ${REL_CORES.vermelho};
    --pe-amarelo: ${REL_CORES.amarelo};
    --pe-verde: ${REL_CORES.verde};
    --verde-txt: ${REL_CORES.verdeTxt};
    --amarelo-txt: ${REL_CORES.amareloTxt};
    --vermelho-txt: ${REL_CORES.vermelhoTxt};
    --verde-bg: #DDF4E7;  --amarelo-bg: #FFF5E0;
    --vermelho-bg: #F7E6E6; --azul-bg: #E4E8F3;
    --tinta: #1A1F29; --tinta-fraca: #5A6472;
    --linha: #C9D0DC; --linha-leve: #E6EAF1;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: #fff;
    font-family: "Segoe UI", Calibri, Arial, Helvetica, sans-serif;
    font-size: 10.5pt; line-height: 1.5; color: var(--tinta);
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .rel-folha { ${paraWord ? '' : 'padding: 0;'} }

  /* Cabeçalho institucional */
  .rel-cabecalho { display: ${paraWord ? 'block' : 'flex'}; align-items: center; gap: 14px; padding-bottom: 12px; }
  .rel-brasao { width: 20mm; flex-shrink: 0; ${paraWord ? 'float: left; margin-right: 12px;' : ''} }
  .rel-brasao img { width: 100%; display: block; }
  .rel-orgao { flex: 1; }
  .rel-esfera { font-size: 9pt; font-weight: 700; color: var(--pe-azul); letter-spacing: .04em; text-transform: uppercase; }
  .rel-secretaria { font-size: 8.5pt; }
  .rel-unidade { font-size: 7.5pt; color: var(--tinta-fraca); margin-top: 2px; }
  .rel-faixa { height: 3px; display: flex; margin-bottom: 16px; clear: both; }
  .rel-faixa i { flex: 1; }
  .rel-faixa i:nth-child(1) { background: var(--pe-azul); flex: 6; }
  .rel-faixa i:nth-child(2) { background: var(--pe-amarelo); }
  .rel-faixa i:nth-child(3) { background: var(--pe-vermelho); }
  .rel-faixa i:nth-child(4) { background: var(--pe-verde); }

  /* Título */
  .rel-titulo-doc { text-align: center; margin-bottom: 18px; }
  .rel-titulo-doc h1 { font-size: 14pt; font-weight: 700; color: var(--pe-azul-escuro); margin: 0 0 3px; }
  .rel-ref { font-size: 8.5pt; color: var(--tinta-fraca); }

  /* Seções */
  .rel-secao { margin-bottom: 16px; }
  .rel-h2 {
    font-size: 9.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: .06em;
    color: var(--pe-azul); border-bottom: 1.5px solid var(--pe-azul);
    padding-bottom: 3px; margin: 0 0 10px; page-break-after: avoid;
  }

  /* Identificação */
  .rel-dados { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px 18px; }
  .rel-largo { grid-column: 1 / -1; }
  .rel-rot { font-size: 7.5pt; text-transform: uppercase; letter-spacing: .05em; color: var(--tinta-fraca); display: block; margin-bottom: 1px; }
  .rel-val { font-size: 10pt; }
  .rel-vazio { color: var(--tinta-fraca); font-style: italic; }

  /* Situação */
  .rel-situacao { display: flex; gap: 10px; border: 1px solid var(--linha); border-left: 4px solid var(--pe-azul); padding: 11px 14px; background: #FAFBFD; }
  .rel-bloco { flex: 1; }
  .rel-bloco + .rel-bloco { border-left: 1px solid var(--linha-leve); padding-left: 14px; }
  .rel-num { font-size: 15pt; font-weight: 700; color: var(--pe-azul-escuro); line-height: 1.2; }
  .rel-num-sub { font-size: 10pt; font-weight: 400; color: var(--tinta-fraca); }
  .rel-txt { font-size: 10pt; font-weight: 600; }
  .rel-sub { font-size: 8.5pt; color: var(--tinta-fraca); margin-top: 2px; }
  .rel-barra { height: 7px; background: var(--linha-leve); border-radius: 4px; overflow: hidden; margin-top: 6px; border: 1px solid var(--linha); }
  .rel-barra i { display: block; height: 100%; background: var(--pe-azul); }

  /* Tarjas de status */
  .rel-tarja { display: inline-block; font-size: 7.5pt; font-weight: 700; padding: 1px 7px; border-radius: 9px; border: 1px solid; text-transform: uppercase; letter-spacing: .04em; white-space: nowrap; }
  .rel-t-ok { background: var(--verde-bg); color: var(--verde-txt); border-color: var(--pe-verde); }
  .rel-t-andando { background: var(--azul-bg); color: var(--pe-azul); border-color: var(--pe-azul); }
  .rel-t-atraso { background: var(--vermelho-bg); color: var(--vermelho-txt); border-color: var(--pe-vermelho); }
  .rel-t-neutra { background: #F0F2F6; color: var(--tinta-fraca); border-color: var(--linha); }

  /* Etapas */
  .rel-fase { font-size: 8.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--tinta-fraca); background: #F4F6FA; border-left: 3px solid var(--pe-azul); padding: 4px 9px; margin: 14px 0 8px; page-break-after: avoid; }
  .rel-etapa { border: 1px solid var(--linha-leve); border-radius: 3px; padding: 8px 12px; margin-bottom: 6px; page-break-inside: avoid; }
  .rel-etapa-topo { display: flex; align-items: center; gap: 9px; margin-bottom: 5px; }
  .rel-etapa-n { width: 19px; height: 19px; flex-shrink: 0; border-radius: 50%; background: var(--pe-azul); color: #fff; font-size: 8pt; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; }
  .rel-concluida .rel-etapa-n { background: var(--verde-txt); }
  .rel-pendente .rel-etapa-n, .rel-na .rel-etapa-n { background: #9BA4B4; }
  .rel-na .rel-etapa-n { font-size: 6.5pt; }
  .rel-etapa-nome { font-weight: 600; font-size: 10.5pt; flex: 1; }
  .rel-na .rel-etapa-nome { text-decoration: line-through; color: var(--tinta-fraca); }
  .rel-etapa-meta { font-size: 8pt; color: var(--tinta-fraca); display: flex; flex-wrap: wrap; gap: 3px 14px; margin-bottom: 6px; align-items: center; }
  .rel-etapa-meta b { color: var(--tinta); font-weight: 600; }
  .rel-acao { font-size: 8.5pt; color: var(--tinta-fraca); background: #F7F9FC; padding: 5px 8px; border-radius: 3px; margin-bottom: 6px; }
  .rel-etapa-campos { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px 16px; border-top: 1px dotted var(--linha); padding-top: 6px; font-size: 9.5pt; }
  .rel-crot { font-size: 7.5pt; color: var(--tinta-fraca); text-transform: uppercase; letter-spacing: .04em; }
  .rel-etapa-obs { border-top: 1px dotted var(--linha); margin-top: 6px; padding-top: 5px; font-size: 9.5pt; }
  .rel-nota { font-size: 8.5pt; color: var(--tinta-fraca); font-style: italic; border-top: 1px dotted var(--linha); margin-top: 6px; padding-top: 5px; }

  /* Tabelas */
  .rel-tabela { width: 100%; border-collapse: collapse; font-size: 9pt; }
  .rel-tabela thead th { background: var(--pe-azul); color: #fff; font-weight: 600; text-align: left; padding: 5px 8px; font-size: 8pt; text-transform: uppercase; letter-spacing: .04em; }
  .rel-tabela tbody td { padding: 5px 8px; border-bottom: 1px solid var(--linha-leve); }
  .rel-tabela tbody tr:nth-child(even) td { background: #FAFBFD; }
  .rel-dir { text-align: right; white-space: nowrap; }
  .rel-tabela thead { display: table-header-group; }
  .rel-tabela tr { page-break-inside: avoid; }
  .rel-nota-tabela { font-size: 8pt; color: var(--tinta-fraca); margin-top: 6px; }

  /* Pendências */
  .rel-pend { border-left: 3px solid var(--pe-vermelho); background: var(--vermelho-bg); padding: 7px 11px; margin-bottom: 6px; font-size: 9.5pt; page-break-inside: avoid; }
  .rel-pend.rel-aviso { border-left-color: var(--pe-amarelo); background: var(--amarelo-bg); }
  .rel-pend.rel-ok { border-left-color: var(--pe-verde); background: var(--verde-bg); }
  .rel-pend-tit { font-weight: 600; }
  .rel-pend-txt { font-size: 9pt; }
  .rel-obs-geral { font-size: 10pt; white-space: pre-wrap; }

  /* Assinatura */
  .rel-assinatura { margin-top: 26px; text-align: center; page-break-inside: avoid; }
  .rel-linha-ass { border-top: 1px solid var(--tinta); width: 74mm; margin: 0 auto 4px; }
  .rel-ass-nome { font-weight: 600; font-size: 10pt; }
  .rel-ass-cargo { font-size: 8.5pt; color: var(--tinta-fraca); }

  /* Procedência */
  .rel-rodape { margin-top: 22px; border-top: 1px solid var(--linha); padding-top: 7px; font-size: 7.5pt; color: var(--tinta-fraca); line-height: 1.45; }
  .rel-forte { color: var(--tinta); font-weight: 600; }

  @page { size: A4; margin: 15mm 16mm 16mm 16mm; }
  ${paraWord ? '@page WordSection1 { size: 21cm 29.7cm; margin: 2cm; } div.WordSection1 { page: WordSection1; }' : ''}

  @media print {
    html, body { margin: 0; padding: 0; }
  }

  ${paraWord ? `
  /* O Word ignora grid e flex: aqui tudo vira bloco ou linha de tabela,
     e o espaçamento passa a ser feito com margem e padding. */
  .rel-dados, .rel-etapa-campos, .rel-situacao,
  .rel-cabecalho, .rel-etapa-topo, .rel-etapa-meta { display: block; }
  .rel-td { padding: 0 10px 9px 0; vertical-align: top; }
  .rel-bloco { display: block; }
  .rel-etapa-topo { margin-bottom: 5px; }
  .rel-etapa-n {
    display: inline-block; width: 18px; text-align: center;
    background: ${REL_CORES.azul}; color: #fff; font-size: 8pt;
    font-weight: 700; margin-right: 6px; padding: 1px 0;
  }
  .rel-concluida .rel-etapa-n { background: ${REL_CORES.verdeTxt}; }
  .rel-pendente .rel-etapa-n, .rel-na .rel-etapa-n { background: #9BA4B4; }
  .rel-etapa-nome { display: inline; font-weight: 600; font-size: 10.5pt; }
  .rel-etapa-meta span { margin-right: 14px; }
  .rel-tarja { display: inline; padding: 1px 6px; }
  .rel-secao { margin-bottom: 14px; text-align: left; }
  .rel-etapa { margin-bottom: 8px; padding: 6px 9px; text-align: left; }
  .rel-etapa div, .rel-dados div, .rel-td { text-align: left; }

  /* Títulos: como <div>, escapam do estilo que o Word impõe a h1/h2 */
  .rel-h1w {
    font-size: 14pt; font-weight: 700; color: ${REL_CORES.azulEscuro};
    text-align: center; margin: 0 0 3px;
  }
  .rel-h2w {
    font-size: 9.5pt; font-weight: 700; color: ${REL_CORES.azul};
    text-transform: uppercase; letter-spacing: .06em;
    border-bottom: 1.5pt solid ${REL_CORES.azul};
    padding-bottom: 3px; margin: 0 0 9px;
  }
  /* Rótulo em cima, valor embaixo — o Word ignora display:block em span */
  .rel-rot, .rel-crot { display: block; margin-bottom: 1px; }
  .rel-val { display: block; }
  ` : ''}`;
}

// ============================================================
// 2. TELA DE MONTAGEM — blocos à esquerda, documento à direita
// ============================================================

let _relProc = null;      // processo sendo relatado
let _relReceita = null;   // escolhas atuais

/** Abre o gerador para um processo. */
function abrirGeradorRelatorio(procId) {
  const proc = (ls('processos') || []).find(p => p.id === procId);
  if (!proc) { alert('Processo não encontrado.'); return; }

  _relProc = proc;
  _relReceita = _relModeloPadrao() || receitaPadraoProcesso(proc);

  // Quem gera assina por padrão — pode ser trocado ou deixado em branco
  if (_relReceita.assNome === undefined) _relReceita.assNome = APP.currentUser?.nome || '';

  document.getElementById('rel-processo-nome').textContent = proc.nome || '(sem nome)';
  document.getElementById('rel-processo-sub').textContent =
    [proc.tipoProcesso, proc.sei ? 'SEI ' + proc.sei : null].filter(Boolean).join(' · ');

  _relRenderPainel();
  _relRenderPrevia();
  _relPopularModelos();
  openModal('modal-relatorio');
}

/** Coluna esquerda: blocos, campos e opções. */
function _relRenderPainel() {
  const alvo = document.getElementById('rel-painel');
  if (!alvo || !_relProc) return;
  const cat = catalogoRelatorioProcesso(_relProc);

  let html = '';
  cat.forEach(b => {
    const cfg   = _relReceita.blocos[b.key] || { ativo: false, campos: {} };
    const campos = b.campos || [];
    const nSel  = campos.filter(c => cfg.campos[c.key]).length;

    html += `<div class="rel-bloco-item ${cfg.ativo ? '' : 'desligado'}">
      <label class="rel-bloco-topo">
        <input type="checkbox" ${cfg.ativo ? 'checked' : ''}
               onchange="_relToggleBloco('${b.key}', this.checked)">
        <span class="rel-bloco-nome">${escHtml(b.titulo)}</span>
        <span class="rel-bloco-cont">${nSel}/${campos.length}</span>
      </label>
      <div class="rel-bloco-desc">${escHtml(b.descricao)}</div>`;

    if (cfg.ativo) {
      // Opções do bloco (só as etapas têm, por ora)
      if (b.opcoes?.length) {
        html += '<div class="rel-opcoes">';
        b.opcoes.forEach(o => {
          html += `<label class="rel-opcao">
            <input type="checkbox" ${_relReceita.opcoes[o.key] ? 'checked' : ''}
                   onchange="_relToggleOpcao('${o.key}', this.checked)">
            <span>${escHtml(o.label)}</span></label>`;
        });
        html += '</div>';
      }

      if (campos.length) {
        html += `<details class="rel-campos-box"${nSel < campos.length ? ' open' : ''}>
          <summary>Campos deste bloco
            <button type="button" class="rel-mini" onclick="event.preventDefault();_relTodosCampos('${b.key}',true)">todos</button>
            <button type="button" class="rel-mini" onclick="event.preventDefault();_relTodosCampos('${b.key}',false)">nenhum</button>
          </summary><div class="rel-campos-lista">`;
        campos.forEach(c => {
          html += `<label class="rel-campo-item">
            <input type="checkbox" ${cfg.campos[c.key] ? 'checked' : ''}
                   onchange="_relToggleCampo('${b.key}','${c.key}', this.checked)">
            <span>${escHtml(c.label)}</span></label>`;
          // Campos personalizados de cada etapa, um nível abaixo
          if (c.subcampos?.length && cfg.campos[c.key]) {
            html += '<div class="rel-subcampos">';
            c.subcampos.forEach(sc => {
              html += `<label class="rel-campo-item rel-sub-item">
                <input type="checkbox" ${cfg.campos[sc.key] ? 'checked' : ''}
                       onchange="_relToggleCampo('${b.key}','${sc.key}', this.checked)">
                <span>${escHtml(sc.label)}</span></label>`;
            });
            html += '</div>';
          }
        });
        html += '</div></details>';
      }

      if (b.key === 'assinatura') {
        html += `<div class="rel-ass-edit">
          <label>Nome de quem assina</label>
          <input type="text" id="rel-ass-nome" value="${escHtml(_relReceita.assNome || '')}"
                 placeholder="deixe em branco para assinar à mão" oninput="_relSetAss('assNome', this.value)">
          <label>Cargo / unidade</label>
          <input type="text" id="rel-ass-cargo" value="${escHtml(_relReceita.assCargo || REL_ORGAO.linhas[2])}"
                 oninput="_relSetAss('assCargo', this.value)">
        </div>`;
      }
    }
    html += '</div>';
  });
  alvo.innerHTML = html;
}

/**
 * Coluna direita: o documento, com os dados reais, a cada clique.
 *
 * Vai num iframe de propósito. O documento tem estilos próprios — inclusive
 * para body e :root — que vazariam sobre o sistema inteiro se fossem
 * injetados na mesma página. Isolado, a prévia mostra exatamente o que sai
 * na impressão, sem sofrer influência do tema claro/escuro da interface.
 */
function _relRenderPrevia() {
  const alvo = document.getElementById('rel-previa');
  if (!alvo || !_relProc) return;

  let frame = document.getElementById('rel-previa-frame');
  if (!frame) {
    frame = document.createElement('iframe');
    frame.id = 'rel-previa-frame';
    frame.title = 'Prévia do documento';
    alvo.innerHTML = '';
    alvo.appendChild(frame);
  }

  const html = relDocumentoCompleto(_relProc, _relReceita, 'previa', REL_BRASAO);
  const doc = frame.contentDocument;
  doc.open();
  doc.write(html);
  doc.close();
  _relAjustarAlturaPrevia(frame);
}

/** A folha cresce conforme o conteúdo, e a coluna rola por fora. */
function _relAjustarAlturaPrevia(frame) {
  try {
    const h = frame.contentDocument.body.scrollHeight;
    frame.style.height = (h + 24) + 'px';
  } catch (e) { /* ignora */ }
}

function _relAtualizar() { _relRenderPainel(); _relRenderPrevia(); }

function _relToggleBloco(bloco, ativo) {
  if (!_relReceita.blocos[bloco]) _relReceita.blocos[bloco] = { ativo, campos: {} };
  _relReceita.blocos[bloco].ativo = ativo;
  _relAtualizar();
}

function _relToggleCampo(bloco, campo, ativo) {
  _relReceita.blocos[bloco].campos[campo] = ativo;
  _relAtualizar();
}

function _relToggleOpcao(opcao, ativo) {
  _relReceita.opcoes[opcao] = ativo;
  _relAtualizar();
}

function _relTodosCampos(bloco, ativo) {
  const b = catalogoRelatorioProcesso(_relProc).find(x => x.key === bloco);
  (b?.campos || []).forEach(c => {
    _relReceita.blocos[bloco].campos[c.key] = ativo;
    (c.subcampos || []).forEach(sc => { _relReceita.blocos[bloco].campos[sc.key] = ativo; });
  });
  _relAtualizar();
}

function _relSetAss(chave, valor) {
  _relReceita[chave] = valor;
  _relRenderPrevia();   // não redesenha o painel, para não perder o foco do campo
}

// ============================================================
// SAÍDAS — impressão/PDF e Word
//
// As duas leem do MESMO relDocumentoCompleto(): o conteúdo vive num
// lugar só, e o formato é apenas a casca. É o que impede o PDF e o
// Word de divergirem com o tempo.
// ============================================================

/** Nome de arquivo seguro, a partir do processo e da data. */
function _relNomeArquivo(proc, ext) {
  const base = [
    'Relatorio',
    (proc.sei || proc.nome || 'processo').replace(/[^\w.-]+/g, '-'),
    relAgora().data.replace(/\//g, '-'),
  ].join('_');
  return base.slice(0, 120) + '.' + ext;
}

/** Manda o documento para a impressão do navegador. */
function relImprimir() {
  if (!_relProc) return;
  // O brasão precisa ir embutido: a janela de impressão não compartilha
  // o caminho relativo desta página.
  const html = relDocumentoCompleto(_relProc, _relReceita, 'impressao', REL_BRASAO);

  // Imprime por um quadro oculto, e não por uma janela nova: não esbarra
  // no bloqueio de pop-up e o rodapé do navegador mostra o endereço do
  // sistema em vez de "about:blank".
  let frame = document.getElementById('rel-frame-impressao');
  if (frame) frame.remove();
  frame = document.createElement('iframe');
  frame.id = 'rel-frame-impressao';
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  doc.open(); doc.write(html); doc.close();

  const imprimir = () => {
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch (e) {
      alert('Não foi possível abrir a impressão. Tente novamente.');
    }
  };
  // Espera as imagens carregarem, senão o brasão sai em branco
  if (doc.readyState === 'complete') setTimeout(imprimir, 120);
  else frame.onload = () => setTimeout(imprimir, 120);
}

/** Baixa o documento em formato que o Word abre e edita. */
function relBaixarWord() {
  if (!_relProc) return;
  const html = relDocumentoCompleto(_relProc, _relReceita, 'word', REL_BRASAO);
  const blob = new Blob(['﻿', html], { type: 'application/msword;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = _relNomeArquivo(_relProc, 'doc');
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  showToast('Documento baixado — abra no Word para editar.');
}

// ============================================================
// MODELOS SALVOS
//
// Guardam apenas a receita — blocos, campos e ordem — nunca o recorte
// de dados: o mesmo modelo serve a qualquer processo.
// Ficam na planilha, compartilhados pela equipe.
// ============================================================

/** Modelo marcado como padrão pelo administrador, se houver. */
function _relModeloPadrao() {
  const mods = ls('relatorioModelos') || [];
  const pad = mods.find(m => m.padrao === true || m.padrao === 'TRUE');
  if (!pad) return null;
  try { return JSON.parse(pad.receitaJson); } catch (e) { return null; }
}

/** Modelos que este usuário pode usar: os do próprio e os compartilhados. */
function _relModelosVisiveis() {
  const login = APP.currentUser?.login;
  return (ls('relatorioModelos') || []).filter(m =>
    m.compartilhado === true || m.compartilhado === 'TRUE' || m.autor === login);
}

function _relPopularModelos() {
  const sel = document.getElementById('rel-modelo-sel');
  if (!sel) return;
  const mods = _relModelosVisiveis();
  sel.innerHTML = '<option value="">— escolher um modelo salvo —</option>' +
    mods.map(m => {
      const marcas = [];
      if (m.padrao === true || m.padrao === 'TRUE') marcas.push('padrão');
      if (m.autor && m.autor !== APP.currentUser?.login) marcas.push('de ' + escHtml(relNomeUsuario(m.autor)));
      return `<option value="${escHtml(m.id)}">${escHtml(m.nome)}${marcas.length ? ' (' + marcas.join(', ') + ')' : ''}</option>`;
    }).join('');
}

function relCarregarModelo(id) {
  if (!id) return;
  const m = (ls('relatorioModelos') || []).find(x => x.id === id);
  if (!m) return;
  try {
    const r = JSON.parse(m.receitaJson);
    // Campos criados depois que o modelo foi salvo entram ligados, para
    // que um modelo antigo não esconda informação nova sem avisar.
    const base = receitaPadraoProcesso(_relProc);
    Object.keys(base.blocos).forEach(bk => {
      if (!r.blocos[bk]) r.blocos[bk] = base.blocos[bk];
      else Object.keys(base.blocos[bk].campos).forEach(ck => {
        if (r.blocos[bk].campos[ck] === undefined) r.blocos[bk].campos[ck] = true;
      });
    });
    Object.keys(base.opcoes).forEach(ok => {
      if (r.opcoes[ok] === undefined) r.opcoes[ok] = base.opcoes[ok];
    });
    if (r.assNome === undefined) r.assNome = APP.currentUser?.nome || '';
    _relReceita = r;
    _relAtualizar();
    showToast('Modelo “' + m.nome + '” carregado.');
  } catch (e) {
    alert('Não foi possível ler este modelo.');
  }
}

function relSalvarModelo() {
  const nome = prompt('Nome do modelo:', 'Relatório Padrão GTTRCG');
  if (!nome || !nome.trim()) return;

  const ehAdmin = APP.currentUser?.perfil === 'admin';
  let compartilhado = false, padrao = false;
  if (ehAdmin) {
    compartilhado = confirm('Deixar este modelo disponível para toda a equipe?\n\n' +
      'OK = compartilhado com todos\nCancelar = somente para você');
    if (compartilhado) {
      padrao = confirm('Usar este modelo como padrão da GTTRCG?\n\n' +
        'Ele passa a ser o que abre por default para todos.');
    }
  }

  const mods = ls('relatorioModelos') || [];
  if (padrao) mods.forEach(m => { m.padrao = false; });   // só um padrão por vez

  mods.push({
    id: genId(),
    nome: nome.trim(),
    tipo: 'processo',
    autor: APP.currentUser?.login || '',
    compartilhado, padrao,
    receitaJson: JSON.stringify(_relReceita),
    criadoEm: new Date().toISOString().split('T')[0],
  });
  ls('relatorioModelos', mods);
  _relPopularModelos();
  showToast('Modelo salvo!');
}

function relExcluirModelo() {
  const sel = document.getElementById('rel-modelo-sel');
  const id = sel?.value;
  if (!id) { alert('Escolha primeiro um modelo na lista.'); return; }
  const mods = ls('relatorioModelos') || [];
  const m = mods.find(x => x.id === id);
  if (!m) return;

  const ehAdmin = APP.currentUser?.perfil === 'admin';
  const meu = m.autor === APP.currentUser?.login;
  if (!meu && !ehAdmin) {
    alert('Este modelo foi criado por outra pessoa.\n\nSomente o autor ou um administrador pode excluí-lo.');
    return;
  }
  if (!confirm(`Excluir o modelo “${m.nome}”?`)) return;
  ls('relatorioModelos', mods.filter(x => x.id !== id));
  _relPopularModelos();
  showToast('Modelo excluído.');
}

/**
 * Abre o gerador a partir do acompanhamento aberto.
 * Se houver alterações não salvas, avisa antes — o relatório é montado
 * com os dados gravados, não com o que está na tela.
 */
function relDoDetalhe() {
  const id = APP.currentProcessoId;
  if (!id) return;
  if (typeof modalTemAlteracoes === 'function' && modalTemAlteracoes('modal-detalhe')) {
    if (!confirm('Você tem alterações não salvas neste acompanhamento.\n\n' +
                 'O relatório é gerado a partir dos dados já salvos, então essas alterações ' +
                 'não apareceriam nele.\n\nDeseja gerar mesmo assim?')) return;
  }
  abrirGeradorRelatorio(id);
}
