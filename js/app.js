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

/**
 * lsLocal(key, val) — grava APENAS no localStorage, SEM sincronizar com Sheets.
 * Usado exclusivamente pelo initData para não sobrescrever o banco com
 * valores padrão quando o localStorage está vazio em uma nova máquina.
 */
function lsLocal(key, val) {
  if (val !== undefined) {
    localStorage.setItem('gttrcg_' + key, JSON.stringify(val));
    return val;
  }
  const v = localStorage.getItem('gttrcg_' + key);
  return v ? JSON.parse(v) : null;
}

function initData() {
  // REGRA CRÍTICA: initData usa lsLocal() — NUNCA ls() — para não disparar
  // gravarNoSheets() e sobrescrever o banco com arrays vazios em novos clientes.

  // Usuário admin master — único usuário inicial
  if (!lsLocal('usuarios')) {
    lsLocal('usuarios', [{
      id: 'u_admin_master',
      nome: 'Administrador',
      login: 'admin',
      senha: '123',
      perfil: 'admin',
      matricula: '',
      email: '',
    }]);
  }

  // Listas de referência (fallback local — serão substituídas pelos dados do Sheets)
  if (!lsLocal('statusProcesso')) {
    lsLocal('statusProcesso', [
      'Aguardando Início do Processo',
      'Dimensionamento de Pessoal, Em Elaboração de TR',
      'Em Instrução',
      'Em Confecção de TR',
      'Aguardando NT/ETP',
      'Aguardando Aprovação do TR',
      'Aguardando Precificação do Custeio',
      'Aguardando Precificação do Serviço/Produto',
      'Aguardando SOF/DDO',
      'Aguardando Autorização da CPF',
      'Em Finalização da Instrução Processual',
      'Remetido à SAD',
      'Em Processo de Habilitação',
      'Em Avaliação de Recursos',
      'Em Contratação',
      'Aguardando Assinatura do Contrato',
      'Contratação Concluída',
    ]);
  }

  if (!lsLocal('tiposProcesso')) {
    lsLocal('tiposProcesso', ['Regular', 'Dispensa de Seleção', 'Emergencial']);
  }

  if (!lsLocal('statusContrato')) {
    lsLocal('statusContrato', ['Vigente', 'Expirado', 'Nova Unidade']);
  }

  if (!lsLocal('fases')) {
    lsLocal('fases', [
      'Confecção de NT/ETP',
      'Confecção de TR',
      'Instrução Financeira',
      'Remessa à SAD',
      'Externa (SAD)',
      'Contratação',
      'Concluído',
    ]);
  }

  if (!lsLocal('tiposUnidade')) {
    lsLocal('tiposUnidade', [
      'Hospital', 'UPA', 'UPAE', 'CER', 'Maternidade',
      'Serviço Móvel', 'Serviço', 'Múltiplas', 'Hemocentro', 'Policlínica',
    ]);
  }

  if (!lsLocal('setores')) {
    lsLocal('setores', [
      'DGMCG','SEAS','GJCONV','DGAE','DGAIS','DGI','GTTRCG','DGES','DGAJ','SAD',
      'SCONT','SPAL','DGCC','DGPO','GAOCG','GGPCG','SECI','CPF','PGE','CCSAD V',
      'CCSAD IV','DGLCA','GMDP','DGPROJ','GACDE','GAJ - SES','DDGT','CJCG',
      'DGCON','GPGC','CTIR','NGC','SERS','DGMMAS','DGCI','DGPDP','CENCG','GGCCG',
    ]);
  }

  if (!lsLocal('prazoAlerta')) lsLocal('prazoAlerta', 18);

  // Processos, unidades, OSS, etapas: NÃO inicializar com dados fictícios.
  // Apenas garante que a chave existe para evitar erros de leitura.
  // Não chama lsLocal para evitar sobrescrita acidental caso o Sheets já tenha dados.

  // Schemas dinâmicos padrão
  if (!lsLocal('schema_unidades')) {
    lsLocal('schema_unidades', [
      { key:'nome',          label:'Nome da Unidade',               tipo:'text',     protegido:true  },
      { key:'sigla',         label:'Sigla',                         tipo:'text',     protegido:true  },
      { key:'tipo',          label:'Tipo (Hospital, UPA, UPAE...)', tipo:'text',     protegido:true  },
      { key:'cnpj',          label:'CNPJ da Unidade',               tipo:'text',     protegido:false },
      { key:'cg',            label:'N° do Contrato de Gestão',      tipo:'text',     protegido:false },
      { key:'cgInicio',      label:'Início do Contrato de Gestão',  tipo:'date',     protegido:false },
      { key:'cgFim',         label:'Fim do CG (10 anos)',           tipo:'date',     protegido:false },
      { key:'vigencia2anos', label:'Fim da Vigência de 2 anos',     tipo:'date',     protegido:false },
      { key:'macro',         label:'Macrorregião',                  tipo:'text',     protegido:false },
      { key:'regiao',        label:'Região de Saúde',               tipo:'text',     protegido:false },
      { key:'cidade',        label:'Cidade',                        tipo:'text',     protegido:false },
      { key:'endereco',      label:'Endereço',                      tipo:'text',     protegido:false },
      { key:'ossGestora',    label:'OSS Gestora Atual',             tipo:'text',     protegido:false },
      { key:'cnpjOss',       label:'CNPJ da OSS Gestora',          tipo:'text',     protegido:false },
      { key:'porte',         label:'Porte',                         tipo:'text',     protegido:false },
      { key:'leitos',        label:'N° de Leitos',                  tipo:'text',     protegido:false },
      { key:'statusCG',      label:'Status do C.G',                tipo:'listafixo', listaFonte:'statusContrato', protegido:false },
      { key:'repasse',       label:'Repasse Mensal (R$)',           tipo:'moeda',    protegido:false },
    ]);
  }

  if (!lsLocal('schema_oss')) {
    lsLocal('schema_oss', [
      { key:'sigla',         label:'Sigla',                    tipo:'text', protegido:true  },
      { key:'nome',          label:'Nome Completo',            tipo:'text', protegido:true  },
      { key:'cnpj',          label:'CNPJ',                     tipo:'text', protegido:false },
      { key:'endereco',      label:'Endereço',                 tipo:'text', protegido:false },
      { key:'municipio',     label:'Município',                tipo:'text', protegido:false },
      { key:'uf',            label:'UF',                       tipo:'text', protegido:false },
      { key:'telefone',      label:'Telefone',                 tipo:'text', protegido:false },
      { key:'email',         label:'E-mail',                   tipo:'text', protegido:false },
      { key:'representante', label:'Representante Legal',      tipo:'text', protegido:false },
      { key:'qualificacao',  label:'Portaria de Qualificação', tipo:'text', protegido:false },
    ]);
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

  // 1. Carrega dados do Sheets ANTES de mostrar a tela de login
  //    A tela de login fica escondida atrás do overlay de loading
  const ok = await iniciarDB();

  if (!ok) {
    // iniciarDB() já exibiu a tela de erro — não faz mais nada
    return;
  }

  // 2. Dados em memória — garante admin existe
  garantirAdminMaster();

  // 3. Exibe a tela de login
  const loginScreen = document.getElementById('login-screen');
  if (loginScreen) loginScreen.style.display = 'flex';

  console.log('[GTTRCG] Sistema pronto ✓');
}

// Esconde a tela de login durante o carregamento inicial
// (ela ficará visível só após iniciarDB() terminar)
(function() {
  const ls = document.getElementById('login-screen');
  if (ls) ls.style.display = 'none';
})();

bootSistema();

console.log('[GTTRCG] app.js carregado ✓');
