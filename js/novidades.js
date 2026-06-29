// ============================================================
// novidades.js — Aviso de melhorias do sistema após login
//
// Exibe um modal com as novidades da versão atual para cada
// usuário, uma única vez. O controle de "já visto" é salvo no
// próprio cadastro do usuário (campo versaoNovidadesVista),
// gravado no Sheets — não em localStorage — para que o aviso
// não reapareça nem suma dependendo da máquina/navegador usado.
// ============================================================

// Identificador da versão atual de novidades.
// Atualize esta string sempre que publicar uma nova leva de
// melhorias que mereça aviso aos usuários.
const NOVIDADES_VERSAO = '2026-06-29';

const NOVIDADES_CONTEUDO = {
  titulo: 'Novidades no GTTRCG',
  itens: [
    {
      icone: '🧩',
      titulo: 'Campos personalizados nas etapas do fluxo',
      texto: 'Em Fluxo do Processo, o administrador agora pode adicionar, remover e reordenar campos de cada etapa, escolhendo o tipo: texto, sim/não, data, valor em R$, lista fixa (puxada dos dados fixos) ou anexo de documento.',
    },
    {
      icone: '↕️',
      titulo: 'Reordenação automática das etapas',
      texto: 'Ao criar, editar ou excluir uma etapa, as demais se reorganizam automaticamente — sem buracos na numeração. Também é possível arrastar e soltar as etapas para reordenar.',
    },
    {
      icone: '📎',
      titulo: 'Anexo de documentos',
      texto: 'Campos do tipo "Anexo de Documento" agora permitem enviar arquivos (qualquer formato) direto na etapa do processo. O arquivo é salvo na pasta DOCUMENTOS GTTRCG do Google Drive e fica acessível por um link.',
    },
    {
      icone: '🔒',
      titulo: 'Proteção contra preenchimento incorreto',
      texto: 'Os campos de uma etapa só ficam disponíveis para edição depois que ela é marcada como "Iniciada" — evitando preencher informações em etapas que ainda não começaram.',
    },
    {
      icone: '⚠️',
      titulo: 'Aviso ao sair sem salvar',
      texto: 'Se você fizer alterações no acompanhamento de um processo e tentar fechar a janela (ou a aba do navegador) sem salvar, o sistema agora avisa antes de descartar.',
    },
  ],
};

/**
 * Verifica se o usuário já viu a versão atual de novidades.
 * Se não, exibe o modal e marca como visto ao fechar.
 */
function verificarNovidades(user) {
  if (!user) return;
  if (user.versaoNovidadesVista === NOVIDADES_VERSAO) return;
  renderModalNovidades();
}

function renderModalNovidades() {
  let overlay = document.getElementById('modal-novidades');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'modal-novidades';
    overlay.className = 'modal-overlay';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) fecharNovidades(); });
  }

  const itensHtml = NOVIDADES_CONTEUDO.itens.map(item => `
    <div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)">
      <div style="font-size:22px;flex-shrink:0;line-height:1">${item.icone}</div>
      <div>
        <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:3px">${item.titulo}</div>
        <div style="font-size:12px;color:var(--text2);line-height:1.5">${item.texto}</div>
      </div>
    </div>`).join('');

  overlay.innerHTML = `
    <div class="modal" style="max-width:520px">
      <div class="modal-header">
        <div>
          <div class="modal-title">✨ ${NOVIDADES_CONTEUDO.titulo}</div>
          <div class="modal-subtitle">Melhorias mais recentes do sistema</div>
        </div>
        <button class="close-btn" onclick="fecharNovidades()">
          <svg viewBox="0 0 16 16" fill="currentColor"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>
        </button>
      </div>
      <div class="modal-body" style="max-height:60vh;overflow-y:auto">
        ${itensHtml}
      </div>
      <div class="modal-footer">
        <button class="btn primary" onclick="fecharNovidades()" style="width:100%;justify-content:center">Entendi, fechar</button>
      </div>
    </div>`;

  overlay.classList.add('open');
}

function fecharNovidades() {
  const overlay = document.getElementById('modal-novidades');
  if (overlay) overlay.classList.remove('open');

  // Marca a versão como vista no cadastro do usuário e persiste no Sheets
  const users = ls('usuarios') || [];
  const idx = users.findIndex(u => u.id === APP.currentUser?.id);
  if (idx >= 0) {
    users[idx].versaoNovidadesVista = NOVIDADES_VERSAO;
    ls('usuarios', users);
    APP.currentUser.versaoNovidadesVista = NOVIDADES_VERSAO;
  }
}

console.log('[GTTRCG] novidades.js carregado ✓');
