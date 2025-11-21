/**
 * Formatador de Mensagens para WhatsApp
 * Suporta todos os elementos nativos do WhatsApp:
 * - Textos formatados
 * - Botões interativos
 * - Listas
 * - Templates
 * - Mídias
 */

export interface WhatsAppButton {
  type: 'reply';
  reply: {
    id: string;
    title: string;
  };
}

export interface WhatsAppListSection {
  title: string;
  rows: Array<{
    id: string;
    title: string;
    description?: string;
  }>;
}

export interface WhatsAppMediaOptions {
  caption?: string;
  filename?: string;
}

/**
 * Classe para formatar mensagens do WhatsApp de forma profissional
 */
export class WhatsAppMessageFormatter {
  
  /**
   * Formata texto simples com markdown do WhatsApp
   */
  static formatText(text: string): string {
    return text;
  }

  /**
   * Cria mensagem com botões interativos
   * Máximo de 3 botões por mensagem
   */
  static createButtonMessage(
    text: string,
    buttons: WhatsAppButton[]
  ): {
    text: string;
    buttonsMessage: {
      text: string;
      buttons: WhatsAppButton[];
    };
  } {
    if (buttons.length > 3) {
      throw new Error('WhatsApp permite no máximo 3 botões por mensagem');
    }

    if (buttons.length === 0) {
      throw new Error('Pelo menos 1 botão é necessário');
    }

    return {
      text,
      buttonsMessage: {
        text,
        buttons
      }
    };
  }

  /**
   * Cria mensagem com lista interativa
   * Permite até 10 seções com 10 linhas cada
   */
  static createListMessage(
    text: string,
    buttonText: string,
    sections: WhatsAppListSection[],
    title?: string,
    footer?: string
  ): {
    text: string;
    listMessage: {
      text: string;
      buttonText: string;
      sections: WhatsAppListSection[];
      title?: string;
      footer?: string;
    };
  } {
    // Validações
    if (sections.length === 0) {
      throw new Error('Pelo menos 1 seção é necessária');
    }

    if (sections.length > 10) {
      throw new Error('WhatsApp permite no máximo 10 seções');
    }

    sections.forEach((section, idx) => {
      if (section.rows.length === 0) {
        throw new Error(`Seção ${idx + 1} precisa ter pelo menos 1 linha`);
      }
      if (section.rows.length > 10) {
        throw new Error(`Seção ${idx + 1} tem mais de 10 linhas (máximo permitido)`);
      }
    });

    return {
      text,
      listMessage: {
        text,
        buttonText,
        sections,
        title,
        footer
      }
    };
  }

  /**
   * Formata informações de Ordem de Serviço de forma profissional
   */
  static formatOrdemServico(os: any): string {
    const statusEmoji = {
      'aberta': '🆕',
      'em_andamento': '⏳',
      'aguardando_pecas': '⏸️',
      'concluida': '✅',
      'cancelada': '❌'
    }[os.status] || '📋';

    const prioridadeEmoji = {
      'baixa': '🟢',
      'normal': '🟡',
      'alta': '🟠',
      'urgente': '🔴'
    }[os.prioridade] || '⚪';

    let texto = `${statusEmoji} *OS #${os.numero_os}*\n`;
    texto += `━━━━━━━━━━━━━━━━━━━\n\n`;
    
    texto += `👤 *Cliente:* ${os.cliente_nome}\n`;
    if (os.cliente_telefone) {
      texto += `📱 *Telefone:* ${os.cliente_telefone}\n`;
    }
    
    texto += `\n📝 *Serviço:* ${os.titulo}\n`;
    if (os.descricao) {
      texto += `💬 *Descrição:* ${os.descricao}\n`;
    }
    
    texto += `\n📊 *Status:* ${os.status.replace('_', ' ').toUpperCase()}\n`;
    texto += `${prioridadeEmoji} *Prioridade:* ${os.prioridade.toUpperCase()}\n`;
    
    if (os.tecnico_responsavel) {
      texto += `👨‍🔧 *Técnico:* ${os.tecnico_responsavel}\n`;
    }
    
    if (os.valor_estimado) {
      texto += `\n💰 *Valor Estimado:* R$ ${parseFloat(os.valor_estimado).toFixed(2)}\n`;
    }
    
    if (os.valor_final) {
      texto += `💵 *Valor Final:* R$ ${parseFloat(os.valor_final).toFixed(2)}\n`;
    }
    
    const dataAbertura = new Date(os.data_abertura);
    texto += `\n📅 *Abertura:* ${dataAbertura.toLocaleDateString('pt-BR')}\n`;
    
    if (os.data_previsao) {
      const dataPrevisao = new Date(os.data_previsao);
      texto += `⏰ *Previsão:* ${dataPrevisao.toLocaleDateString('pt-BR')}\n`;
    }
    
    if (os.data_conclusao) {
      const dataConclusao = new Date(os.data_conclusao);
      texto += `✅ *Conclusão:* ${dataConclusao.toLocaleDateString('pt-BR')}\n`;
    }
    
    if (os.observacoes) {
      texto += `\n📌 *Observações:*\n${os.observacoes}\n`;
    }

    return texto;
  }

  /**
   * Formata lista de ordens de serviço
   */
  static formatListaOrdens(ordens: any[]): string {
    if (ordens.length === 0) {
      return '📭 *Nenhuma ordem de serviço encontrada.*';
    }

    let texto = `📋 *Suas Ordens de Serviço (${ordens.length})*\n`;
    texto += `━━━━━━━━━━━━━━━━━━━\n\n`;

    ordens.forEach((os, index) => {
      const statusEmoji = {
        'aberta': '🆕',
        'em_andamento': '⏳',
        'aguardando_pecas': '⏸️',
        'concluida': '✅',
        'cancelada': '❌'
      }[os.status] || '📋';

      texto += `${statusEmoji} *#${os.numero_os}*\n`;
      texto += `   ${os.titulo}\n`;
      texto += `   📅 ${new Date(os.data_abertura).toLocaleDateString('pt-BR')}\n`;
      
      if (os.valor_final) {
        texto += `   💰 R$ ${parseFloat(os.valor_final).toFixed(2)}\n`;
      }
      
      if (index < ordens.length - 1) {
        texto += `\n`;
      }
    });

    return texto;
  }

  /**
   * Cria mensagem de sucesso personalizada
   */
  static formatSuccessMessage(title: string, details: Record<string, string>): string {
    let texto = `✅ *${title}*\n`;
    texto += `━━━━━━━━━━━━━━━━━━━\n\n`;

    Object.entries(details).forEach(([key, value]) => {
      texto += `${key}: ${value}\n`;
    });

    return texto;
  }

  /**
   * Cria mensagem de erro amigável
   */
  static formatErrorMessage(error: string, suggestion?: string): string {
    let texto = `❌ *Ops! Algo deu errado*\n\n`;
    texto += `${error}\n`;
    
    if (suggestion) {
      texto += `\n💡 *Sugestão:* ${suggestion}`;
    }

    return texto;
  }

  /**
   * Cria menu principal com botões
   */
  static createMainMenu(): ReturnType<typeof WhatsAppMessageFormatter.createButtonMessage> {
    return this.createButtonMessage(
      '📱 *Menu Principal*\n\nEscolha uma opção:',
      [
        {
          type: 'reply',
          reply: {
            id: 'criar_os',
            title: '➕ Nova OS'
          }
        },
        {
          type: 'reply',
          reply: {
            id: 'listar_os',
            title: '📋 Minhas OS'
          }
        },
        {
          type: 'reply',
          reply: {
            id: 'ajuda',
            title: '❓ Ajuda'
          }
        }
      ]
    );
  }

  /**
   * Cria lista de ações para uma OS específica
   */
  static createOSActionsList(numeroOS: string): ReturnType<typeof WhatsAppMessageFormatter.createListMessage> {
    return this.createListMessage(
      `🔧 *Ações Disponíveis*\n\nO que deseja fazer com a OS #${numeroOS}?`,
      'Ver Opções',
      [
        {
          title: '📊 Status',
          rows: [
            {
              id: `status_em_andamento_${numeroOS}`,
              title: '▶️ Em Andamento',
              description: 'Marcar como em andamento'
            },
            {
              id: `status_aguardando_${numeroOS}`,
              title: '⏸️ Aguardando Peças',
              description: 'Aguardando chegada de peças'
            },
            {
              id: `status_concluida_${numeroOS}`,
              title: '✅ Concluir',
              description: 'Marcar como concluída'
            }
          ]
        },
        {
          title: '📄 Documentos',
          rows: [
            {
              id: `pdf_${numeroOS}`,
              title: '📄 Gerar PDF',
              description: 'Baixar ordem de serviço em PDF'
            }
          ]
        },
        {
          title: '✏️ Edição',
          rows: [
            {
              id: `editar_${numeroOS}`,
              title: '✏️ Editar Dados',
              description: 'Editar informações da OS'
            },
            {
              id: `pecas_${numeroOS}`,
              title: '🔧 Adicionar Peças',
              description: 'Registrar peças utilizadas'
            }
          ]
        }
      ],
      'Opções da Ordem de Serviço',
      `OS #${numeroOS}`
    );
  }

  /**
   * Cria lista de filtros para consulta
   */
  static createFilterList(): ReturnType<typeof WhatsAppMessageFormatter.createListMessage> {
    return this.createListMessage(
      '🔍 *Filtrar Ordens de Serviço*\n\nComo deseja filtrar?',
      'Aplicar Filtro',
      [
        {
          title: '📊 Por Status',
          rows: [
            {
              id: 'filter_status_aberta',
              title: '🆕 Abertas',
              description: 'Ordens recém criadas'
            },
            {
              id: 'filter_status_em_andamento',
              title: '⏳ Em Andamento',
              description: 'Ordens sendo executadas'
            },
            {
              id: 'filter_status_concluida',
              title: '✅ Concluídas',
              description: 'Ordens finalizadas'
            }
          ]
        },
        {
          title: '📅 Por Período',
          rows: [
            {
              id: 'filter_periodo_hoje',
              title: '📅 Hoje',
              description: 'Ordens de hoje'
            },
            {
              id: 'filter_periodo_semana',
              title: '📆 Esta Semana',
              description: 'Últimos 7 dias'
            },
            {
              id: 'filter_periodo_mes',
              title: '📊 Este Mês',
              description: 'Últimos 30 dias'
            }
          ]
        }
      ],
      'Filtros Disponíveis'
    );
  }

  /**
   * Formata estatísticas do usuário
   */
  static formatStatistics(stats: any): string {
    let texto = `📊 *Suas Estatísticas*\n`;
    texto += `━━━━━━━━━━━━━━━━━━━\n\n`;
    
    texto += `📋 *Total de OS:* ${stats.total_os || 0}\n\n`;
    
    texto += `🆕 *Abertas:* ${stats.os_abertas || 0}\n`;
    texto += `⏳ *Em Andamento:* ${stats.os_em_andamento || 0}\n`;
    texto += `✅ *Concluídas:* ${stats.os_concluidas || 0}\n\n`;
    
    if (stats.valor_total_servicos) {
      texto += `💰 *Valor Total:* R$ ${parseFloat(stats.valor_total_servicos).toFixed(2)}\n`;
    }
    
    if (stats.ultima_os) {
      const dataUltima = new Date(stats.ultima_os);
      texto += `📅 *Última OS:* ${dataUltima.toLocaleDateString('pt-BR')}`;
    }

    return texto;
  }

  /**
   * Formata mensagem de boas-vindas
   */
  static formatWelcomeMessage(userName?: string): string {
    let texto = `👋 *Olá${userName ? ', ' + userName : ''}!*\n\n`;
    texto += `Sou seu assistente virtual para gerenciamento de *Ordens de Serviço*.\n\n`;
    texto += `*Posso ajudá-lo a:*\n`;
    texto += `✅ Criar novas ordens de serviço\n`;
    texto += `📋 Consultar suas ordens\n`;
    texto += `🔄 Atualizar status e informações\n`;
    texto += `📄 Gerar PDFs e relatórios\n`;
    texto += `📊 Ver estatísticas\n\n`;
    texto += `Como posso ajudá-lo hoje?`;

    return texto;
  }

  /**
   * Formata confirmação de ação
   */
  static createConfirmationMessage(
    action: string,
    details: string
  ): ReturnType<typeof WhatsAppMessageFormatter.createButtonMessage> {
    return this.createButtonMessage(
      `⚠️ *Confirmação Necessária*\n\n${action}\n\n${details}\n\nDeseja confirmar esta ação?`,
      [
        {
          type: 'reply',
          reply: {
            id: 'confirm_yes',
            title: '✅ Sim, confirmar'
          }
        },
        {
          type: 'reply',
          reply: {
            id: 'confirm_no',
            title: '❌ Não, cancelar'
          }
        }
      ]
    );
  }
}

