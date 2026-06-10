// ============================================================
// GTTRCG — app.js
// Responsabilidades:
//   - Estado global APP{}
//   - Inicialização do sistema (boot)
//   - Roteamento de páginas (showPage)
//   - initData: dados padrão quando não há Sheets
//   - Configuração embutida GTTRCG_CONFIG
// ============================================================

// ============================================================
// ESTADO GLOBAL
// ============================================================

const APP = {
  currentUser:      null,   // objeto do usuário logado (sem senha)
  currentProcessoId: null,  // ID do processo aberto no modal de detalhe
  editingEtapaId:   null,   // ID da etapa sendo editada
  sidebarFilter:    null,   // { type, value } — filtro da sidebar
  sortField:        'nome',
  sortDir:          'asc',
};

// ============================================================
// CONFIGURAÇÃO EMBUTIDA NO HTML
// Definida pelo admin no próprio index.html como:
//   const GTTRCG_CONFIG = { appsScriptUrl: '...', apiToken: '...' };
// ============================================================

const GTTRCG_CONFIG_DEFAULTS = {
  appsScriptUrl: 'COLE_AQUI_A_URL_DO_APPS_SCRIPT',
  apiToken:      'COLE_AQUI_O_TOKEN',
};

// ============================================================
// DADOS INICIAIS (apenas quando não há Sheets configurado)
// NENHUM dado de unidade, processo ou usuário aqui.
// Apenas listas de referência e configurações.
// ============================================================

function initData() {
  // Usuário admin master — único usuário inicial, protegido
  // A senha será migrada para SHA-256 pelo auth.js
  if (!ls('usuarios')) {
    ls('usuarios', [{
      id: 'u_admin_master',
      nome: 'Administrador',
      login: 'admin',
      senha: '123',
      perfil: 'admin',
      matricula: '',
      email: '',
    }]);
  }

  // Listas de referência
  if (!ls('statusProcesso')) {
    ls('statusProcesso', [
      'Aguardando Início do Processo',
      'Dimensionamento de Pessoal, Em Elaboração de TR',
      'Em Instrução',
      'Em Confecção de TR',
      'Aguardando NT/ETP',
      'Aguardando Aprovação do TR',
      'Aguardando Precificação do Custeio',
      'Aguardando Precificação do Serviço/Produto',
      'Aguardando SOF/DDO',
      'Em Finalização da Instrução Processual',
      'Remetido à SAD',
      'Em Processo de Habilitação',
      'Em Avaliação de Recursos',
      'Em Contratação',
      'Contratação Concluída',
      'Aguardando Assinatura do Contrato',
    ]);
  }

  if (!ls('tiposProcesso')) {
    ls('tiposProcesso', ['Regular', 'Dispensa de Seleção', 'Emergencial']);
  }

  if (!ls('statusContrato')) {
    ls('statusContrato', ['Vigente', 'Expirado', 'Nova Unidade']);
  }

  if (!ls('fases')) {
    ls('fases', [
      'Confecção de NT/ETP',
      'Confecção de TR',
      'Aprovação',
      'Instrução Financeira',
      'Remessa à SAD',
      'Externa (SAD)',
      'Contratação',
      'Concluído',
    ]);
  }

  if (!ls('tiposUnidade')) {
    ls('tiposUnidade', [
      'Hospital', 'UPA', 'UPAE', 'CER', 'Maternidade',
      'Serviço Móvel', 'Serviço', 'Múltiplas', 'Hemocentro', 'Policlínica',
    ]);
  }

  if (!ls('setores')) {
    ls('setores', [
      'DGMCG','SEAS','GJCONV','DGAE','DGAIS','DGI','GTTRCG','DGES','DGAJ','SAD',
      'SCONT','SPAL','DGCC','DGPO','GAOCG','GGPCG','SECI','CPF','PGE','CCSAD V',
      'CCSAD IV','DGLCA','GMDP','DGPROJ','GACDE','GAJ - SES','DDGT','CJCG',
      'DGCON','GPGC','CTIR','NGC','SERS','DGMMAS','DGCI','DGPDP','CENCG','GGCCG',
    ]);
  }

  if (!ls('prazoAlerta')) ls('prazoAlerta', 18);

  // Processos, unidades, OSS e etapas: vêm EXCLUSIVAMENTE do Sheets ou da importação
  // NÃO inicializar aqui para não criar dados fictícios
  if (!ls('processos'))  ls('processos', []);
  if (!ls('unidades'))   ls('unidades', []);
  if (!ls('oss'))        ls('oss', []);

  // Schemas dinâmicos padrão (se não existirem)
  if (!ls('schema_unidades')) {
    ls('schema_unidades', [
      { key:'nome',          label:'Nome da Unidade',              tipo:'text',     protegido:true  },
      { key:'sigla',         label:'Sigla',                        tipo:'text',     protegido:true  },
      { key:'tipo',          label:'Tipo (Hospital, UPA, UPAE...)', tipo:'text',    protegido:true  },
      { key:'cnpj',          label:'CNPJ da Unidade',              tipo:'text',     protegido:false },
      { key:'cg',            label:'N° do Contrato de Gestão',     tipo:'text',     protegido:false },
      { key:'cgInicio',      label:'Início do Contrato de Gestão', tipo:'date',     protegido:false },
      { key:'cgFim',         label:'Fim do CG (10 anos)',          tipo:'date',     protegido:false },
      { key:'vigencia2anos', label:'Fim da Vigência de 2 anos',    tipo:'date',     protegido:false },
      { key:'macro',         label:'Macrorregião',                 tipo:'text',     protegido:false },
      { key:'regiao',        label:'Região de Saúde',              tipo:'text',     protegido:false },
      { key:'cidade',        label:'Cidade',                       tipo:'text',     protegido:false },
      { key:'endereco',      label:'Endereço',                     tipo:'text',     protegido:false },
      { key:'ossGestora',    label:'OSS Gestora Atual',            tipo:'text',     protegido:false },
      { key:'cnpjOss',       label:'CNPJ da OSS Gestora',         tipo:'text',     protegido:false },
      { key:'porte',         label:'Porte',                        tipo:'text',     protegido:false },
      { key:'leitos',        label:'N° de Leitos',                 tipo:'text',     protegido:false },
      { key:'statusCG',      label:'Status do C.G',               tipo:'listafixo', listaFonte:'statusContrato', protegido:false },
      { key:'repasse',       label:'Repasse Mensal (R$)',          tipo:'moeda',    protegido:false },
    ]);
  }

  if (!ls('schema_oss')) {
    ls('schema_oss', [
      { key:'sigla',         label:'Sigla',                  tipo:'text', protegido:true  },
      { key:'nome',          label:'Nome Completo',          tipo:'text', protegido:true  },
      { key:'cnpj',          label:'CNPJ',                   tipo:'text', protegido:false },
      { key:'endereco',      label:'Endereço',               tipo:'text', protegido:false },
      { key:'municipio',     label:'Município',              tipo:'text', protegido:false },
      { key:'uf',            label:'UF',                     tipo:'text', protegido:false },
      { key:'telefone',      label:'Telefone',               tipo:'text', protegido:false },
      { key:'email',         label:'E-mail',                 tipo:'text', protegido:false },
      { key:'representante', label:'Representante Legal',    tipo:'text', protegido:false },
      { key:'qualificacao',  label:'Portaria de Qualificação', tipo:'text', protegido:false },
    ]);
  }

  // Etapas do fluxo: inicializa com as 39 etapas padrão GTTRCG
  if (!ls('etapasFluxo')) {
    // As etapas são carregadas pelo fluxo.js se existir o arquivo GTTRCG_fluxo_processos.json
    // Aqui inicializamos com array vazio — serão importadas via Configurações → Importar
    ls('etapasFluxo', []);
  }
}

// ============================================================
// ROTEAMENTO DE PÁGINAS
// ============================================================

function showPage(id) {
  // Esconde todas as páginas e limpa seleções
  document.querySelectorAll('.page')
    .forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item')
    .forEach(n => n.classList.remove('active'));

  // Ativa a página e o item do nav
  const page  = document.getElementById('page-' + id);
  const navEl = document.getElementById('nav-' + id);
  if (page)  page.classList.add('active');
  if (navEl) navEl.classList.add('active');

  // Atualiza title do browser
  const titles = {
    dashboard:     'Painel de Controle',
    monitoramento: 'Monitoramento',
    fluxo:         'Fluxo do Processo',
    alertas:       'Alertas',
    contratos:     'Contratos de Gestão',
    configuracoes: 'Configurações',
  };
  document.title = `GTTRCG · ${titles[id] || id}`;

  // Renderiza o conteúdo da página
  if (id === 'dashboard')     renderDashboard();
  if (id === 'monitoramento') { renderMonitoramento(); populateFilters(); }
  if (id === 'fluxo')         renderFluxo();
  if (id === 'alertas')       renderAlertas();
  if (id === 'contratos')     renderContratos();
  if (id === 'configuracoes') renderConfiguracoes();

  // Limpa filtro da sidebar (exceto quando chamado internamente com filtro ativo)
  // Os filtros da sidebar atualizam APP.sidebarFilter ANTES de chamar showPage
}

// ============================================================
// FILTROS DA SIDEBAR
// ============================================================

function filterSidebarStatus(status) {
  APP.sidebarFilter = { type: 'status', value: status };
  showPage('monitoramento');
}

function filterSidebarTipo(tipo) {
  APP.sidebarFilter = { type: 'tipo', value: tipo };
  showPage('monitoramento');
}

function filterSidebarFavoritos() {
  APP.sidebarFilter = { type: 'favorito_mapa' };
  showPage('monitoramento');
}

// ============================================================
// BOOT DO SISTEMA
// ============================================================

async function bootSistema() {
  console.log('[GTTRCG] Iniciando sistema...');

  // 1. Aplica GTTRCG_CONFIG embutido no HTML
  if (typeof GTTRCG_CONFIG !== 'undefined') {
    const { appsScriptUrl, apiToken } = GTTRCG_CONFIG;
    if (appsScriptUrl && !appsScriptUrl.includes('COLE_AQUI')) {
      setAppsScriptUrl(appsScriptUrl);
    }
    if (apiToken && !apiToken.includes('COLE_AQUI') && apiToken.length > 3) {
      setApiToken(apiToken);
    }
  }

  // 2. Verifica se há Sheets configurado
  const sheetsUrl   = getAppsScriptUrl();
  const sheetsToken = getApiToken();
  const temSheets   = sheetsUrl && sheetsToken;

  if (!temSheets) {
    // Sem Sheets: inicializa dados padrão (primeiro uso)
    console.log('[GTTRCG] Sem Sheets configurado — modo offline');
    initData();
    garantirAdminMaster();
    updateSidebarCounts();
    showSyncBadge('offline', 'URL não configurada');
  } else {
    // Com Sheets: garante admin master existe localmente
    garantirAdminMaster();
    // Carrega dados do Sheets
    const ok = await iniciarDB();
    if (ok) {
      console.log('[GTTRCG] Dados carregados do Sheets ✓');
      updateSidebarCounts();
    } else {
      console.warn('[GTTRCG] Falha ao carregar do Sheets — usando localStorage');
      initData();
    }
  }

  console.log('[GTTRCG] Sistema pronto ✓');
}

// Inicia o sistema quando o DOM estiver pronto
bootSistema();

console.log('[GTTRCG] app.js carregado ✓');
