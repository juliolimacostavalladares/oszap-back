/**
 * Templates de Mensagens para WhatsApp
 * Fornece formatação consistente e bonita para todas as respostas
 */

export class WhatsAppMessageTemplates {
  
  /**
   * 📋 Template para listar ordens de serviço
   */
  static formatarListaOS(ordens: any[]): string {
    if (!ordens || ordens.length === 0) {
      return '📋 *Sem Ordens de Serviço*\n\nVocê ainda não tem nenhuma OS cadastrada.';
    }

    const total = ordens.length;
    let mensagem = `📋 *Suas Ordens de Serviço* (${total})\n`;
    mensagem += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    ordens.slice(0, 10).forEach((os, index) => {
      const statusEmoji = this.getStatusEmoji(os.status);
      const prioridadeEmoji = this.getPrioridadeEmoji(os.prioridade);
      const valor = os.valor_final || os.valor_estimado || os.valor;
      
      mensagem += `${statusEmoji} *OS #${os.numero || os.numero_os}*\n`;
      mensagem += `   📝 ${os.titulo}\n`;
      if (os.cliente || os.cliente_nome) {
        mensagem += `   👤 ${os.cliente || os.cliente_nome}\n`;
      }
      mensagem += `   📊 ${this.formatarStatus(os.status)}\n`;
      if (prioridadeEmoji) {
        mensagem += `   ${prioridadeEmoji} ${this.formatarPrioridade(os.prioridade)}\n`;
      }
      if (valor) {
        mensagem += `   💰 ${this.formatarValor(valor)}\n`;
      }
      if (index < ordens.length - 1) {
        mensagem += `\n`;
      }
    });

    if (ordens.length > 10) {
      mensagem += `\n... e mais ${ordens.length - 10} OS`;
    }

    return mensagem;
  }

  /**
   * 📊 Template para totalizadores
   */
  static formatarTotalizadores(totalizadores: any): string {
    let mensagem = `📊 *Resumo Geral*\n`;
    mensagem += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    mensagem += `📈 *Ordens de Serviço:*\n`;
    mensagem += `   • Total: *${totalizadores.total_geral || 0}*\n`;
    if (totalizadores.abertas > 0) {
      mensagem += `   • 🟢 Abertas: ${totalizadores.abertas}\n`;
    }
    if (totalizadores.em_andamento > 0) {
      mensagem += `   • 🟡 Em andamento: ${totalizadores.em_andamento}\n`;
    }
    if (totalizadores.aguardando_pecas > 0) {
      mensagem += `   • 🔵 Aguardando peças: ${totalizadores.aguardando_pecas}\n`;
    }
    if (totalizadores.concluidas > 0) {
      mensagem += `   • ✅ Concluídas: ${totalizadores.concluidas}\n`;
    }
    if (totalizadores.canceladas > 0) {
      mensagem += `   • ⛔ Canceladas: ${totalizadores.canceladas}\n`;
    }

    if (totalizadores.valor_total_estimado || totalizadores.valor_total_final) {
      mensagem += `\n💰 *Valores:*\n`;
      if (totalizadores.valor_total_estimado > 0) {
        mensagem += `   • Estimado: ${this.formatarValor(totalizadores.valor_total_estimado)}\n`;
      }
      if (totalizadores.valor_total_final > 0) {
        mensagem += `   • Final: ${this.formatarValor(totalizadores.valor_total_final)}\n`;
      }
    }

    if (totalizadores.periodo_analisado) {
      mensagem += `\n📅 _${totalizadores.periodo_analisado}_`;
    }

    return mensagem;
  }

  /**
   * 💰 Template para resumo financeiro
   */
  static formatarResumoFinanceiro(resumo: any): string {
    let mensagem = `💰 *Resumo Financeiro*\n`;
    mensagem += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (resumo.periodo) {
      mensagem += `📅 *Período:* ${resumo.periodo}\n`;
      mensagem += `📋 *Total de OS:* ${resumo.total_os}\n\n`;
    }

    if (resumo.valores) {
      mensagem += `💵 *Valores Gerais:*\n`;
      if (resumo.valores.total_estimado > 0) {
        mensagem += `   • Estimado: ${this.formatarValor(resumo.valores.total_estimado)}\n`;
      }
      if (resumo.valores.total_final > 0) {
        mensagem += `   • Final: ${this.formatarValor(resumo.valores.total_final)}\n`;
      }
      if (resumo.valores.total_faturado > 0) {
        mensagem += `   • ✅ Faturado: *${this.formatarValor(resumo.valores.total_faturado)}*\n`;
      }
      if (resumo.valores.em_aberto > 0) {
        mensagem += `   • ⏳ Em aberto: ${this.formatarValor(resumo.valores.em_aberto)}\n`;
      }
    }

    if (resumo.por_status) {
      mensagem += `\n📊 *Por Status:*\n`;
      
      if (resumo.por_status.concluidas) {
        mensagem += `   ✅ Concluídas: ${resumo.por_status.concluidas.quantidade} OS\n`;
        mensagem += `      💰 ${this.formatarValor(resumo.por_status.concluidas.valor_total)}\n`;
      }
      
      if (resumo.por_status.em_andamento) {
        mensagem += `   🟡 Em andamento: ${resumo.por_status.em_andamento.quantidade} OS\n`;
        mensagem += `      💰 ${this.formatarValor(resumo.por_status.em_andamento.valor_total)}\n`;
      }
      
      if (resumo.por_status.abertas) {
        mensagem += `   🟢 Abertas: ${resumo.por_status.abertas.quantidade} OS\n`;
        mensagem += `      💰 ${this.formatarValor(resumo.por_status.abertas.valor_total)}\n`;
      }
    }

    return mensagem;
  }

  /**
   * 🔍 Template para detalhes completos de uma OS
   */
  static formatarDetalhesOS(os: any): string {
    let mensagem = `📄 *Detalhes da OS #${os.numero}*\n`;
    mensagem += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Status e Prioridade
    const statusEmoji = this.getStatusEmoji(os.status);
    const prioridadeEmoji = this.getPrioridadeEmoji(os.prioridade);
    mensagem += `${statusEmoji} *Status:* ${this.formatarStatus(os.status)}\n`;
    mensagem += `${prioridadeEmoji} *Prioridade:* ${this.formatarPrioridade(os.prioridade)}\n`;
    if (os.categoria) {
      mensagem += `🏷️ *Categoria:* ${this.formatarCategoria(os.categoria)}\n`;
    }

    // Serviço
    mensagem += `\n📝 *Serviço:*\n`;
    mensagem += `   ${os.titulo}\n`;
    if (os.descricao) {
      mensagem += `\n💬 *Descrição:*\n`;
      mensagem += `   _${os.descricao}_\n`;
    }

    // Cliente
    if (os.cliente) {
      mensagem += `\n👤 *Cliente:*\n`;
      mensagem += `   • Nome: ${os.cliente.nome}\n`;
      if (os.cliente.telefone) {
        mensagem += `   • 📞 ${os.cliente.telefone}\n`;
      }
      if (os.cliente.email) {
        mensagem += `   • 📧 ${os.cliente.email}\n`;
      }
      if (os.cliente.endereco) {
        mensagem += `   • 📍 ${os.cliente.endereco}\n`;
      }
    }

    // Valores
    if (os.valores) {
      mensagem += `\n💰 *Valores:*\n`;
      if (os.valores.estimado) {
        mensagem += `   • Estimado: ${this.formatarValor(os.valores.estimado)}\n`;
      }
      if (os.valores.final) {
        mensagem += `   • Final: *${this.formatarValor(os.valores.final)}*\n`;
      }
    }

    // Datas
    if (os.datas) {
      mensagem += `\n📅 *Datas:*\n`;
      if (os.datas.criacao) {
        mensagem += `   • Criação: ${this.formatarData(os.datas.criacao)}\n`;
      }
      if (os.datas.previsao) {
        mensagem += `   • Previsão: ${this.formatarData(os.datas.previsao)}\n`;
      }
      if (os.datas.conclusao) {
        mensagem += `   • Conclusão: ${this.formatarData(os.datas.conclusao)}\n`;
      }
    }

    // Técnico
    if (os.tecnico) {
      mensagem += `\n🔧 *Técnico:* ${os.tecnico}\n`;
    }

    // Peças
    if (os.pecas && os.pecas.length > 0) {
      mensagem += `\n🔩 *Peças Utilizadas:*\n`;
      os.pecas.forEach((peca: any) => {
        mensagem += `   • ${peca.descricao} (${peca.quantidade}x)\n`;
        mensagem += `     ${this.formatarValor(peca.valor_unitario)} cada\n`;
      });
    }

    // Observações
    if (os.observacoes) {
      mensagem += `\n📝 *Observações:*\n`;
      mensagem += `   _${os.observacoes}_\n`;
    }

    return mensagem;
  }

  /**
   * ✅ Template para confirmação de criação de OS
   */
  static formatarConfirmacaoCriacaoOS(os: any): string {
    let mensagem = `✅ *OS Criada com Sucesso!* 🎉\n`;
    mensagem += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    mensagem += `📄 *Número:* #${os.numero_os}\n`;
    mensagem += `📝 *Título:* ${os.titulo}\n`;
    mensagem += `👤 *Cliente:* ${os.cliente_nome}\n`;
    
    const statusEmoji = this.getStatusEmoji(os.status);
    mensagem += `${statusEmoji} *Status:* ${this.formatarStatus(os.status)}\n`;
    
    if (os.prioridade) {
      const prioridadeEmoji = this.getPrioridadeEmoji(os.prioridade);
      mensagem += `${prioridadeEmoji} *Prioridade:* ${this.formatarPrioridade(os.prioridade)}\n`;
    }

    if (os.valor_estimado) {
      mensagem += `💰 *Valor estimado:* ${this.formatarValor(os.valor_estimado)}\n`;
    }

    mensagem += `\n💡 Quer que eu gere o PDF dessa OS?`;

    return mensagem;
  }

  /**
   * 📊 Template para estatísticas
   */
  static formatarEstatisticas(stats: any): string {
    let mensagem = `📊 *Estatísticas*\n`;
    mensagem += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (stats.total_os !== undefined) {
      mensagem += `📋 *Total de OS:* ${stats.total_os}\n\n`;
    }

    if (stats.por_status) {
      mensagem += `📈 *Por Status:*\n`;
      Object.keys(stats.por_status).forEach(status => {
        const count = stats.por_status[status];
        if (count > 0) {
          const emoji = this.getStatusEmoji(status);
          mensagem += `   ${emoji} ${this.formatarStatus(status)}: ${count}\n`;
        }
      });
      mensagem += `\n`;
    }

    if (stats.por_prioridade) {
      mensagem += `⚡ *Por Prioridade:*\n`;
      Object.keys(stats.por_prioridade).forEach(prioridade => {
        const count = stats.por_prioridade[prioridade];
        if (count > 0) {
          const emoji = this.getPrioridadeEmoji(prioridade);
          mensagem += `   ${emoji} ${this.formatarPrioridade(prioridade)}: ${count}\n`;
        }
      });
    }

    return mensagem;
  }

  /**
   * 🔧 Template genérico para sucesso
   */
  static formatarSucesso(mensagem: string, detalhes?: string): string {
    let texto = `✅ *Sucesso!*\n`;
    texto += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    texto += `${mensagem}\n`;
    if (detalhes) {
      texto += `\n_${detalhes}_`;
    }
    return texto;
  }

  /**
   * ⚠️ Template genérico para aviso
   */
  static formatarAviso(mensagem: string, sugestao?: string): string {
    let texto = `⚠️ *Atenção*\n`;
    texto += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    texto += `${mensagem}\n`;
    if (sugestao) {
      texto += `\n💡 *Sugestão:* ${sugestao}`;
    }
    return texto;
  }

  /**
   * ❌ Template genérico para erro
   */
  static formatarErro(mensagem: string, ajuda?: string): string {
    let texto = `❌ *Ops!*\n`;
    texto += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    texto += `${mensagem}\n`;
    if (ajuda) {
      texto += `\n💡 ${ajuda}`;
    }
    return texto;
  }

  // ============ MÉTODOS AUXILIARES ============

  private static getStatusEmoji(status: string): string {
    const emojis: Record<string, string> = {
      'aberta': '🟢',
      'em_andamento': '🟡',
      'aguardando_pecas': '🔵',
      'concluida': '✅',
      'cancelada': '⛔'
    };
    return emojis[status] || '⚪';
  }

  private static getPrioridadeEmoji(prioridade: string): string {
    const emojis: Record<string, string> = {
      'urgente': '🔴',
      'alta': '🟠',
      'normal': '🟡',
      'baixa': '🟢'
    };
    return emojis[prioridade] || '⚪';
  }

  private static formatarStatus(status: string): string {
    const nomes: Record<string, string> = {
      'aberta': 'Aberta',
      'em_andamento': 'Em Andamento',
      'aguardando_pecas': 'Aguardando Peças',
      'concluida': 'Concluída',
      'cancelada': 'Cancelada'
    };
    return nomes[status] || status;
  }

  private static formatarPrioridade(prioridade: string): string {
    const nomes: Record<string, string> = {
      'urgente': 'Urgente',
      'alta': 'Alta',
      'normal': 'Normal',
      'baixa': 'Baixa'
    };
    return nomes[prioridade] || prioridade;
  }

  private static formatarCategoria(categoria: string): string {
    const nomes: Record<string, string> = {
      'manutencao': 'Manutenção',
      'instalacao': 'Instalação',
      'reparo': 'Reparo',
      'consultoria': 'Consultoria',
      'outro': 'Outro'
    };
    return nomes[categoria] || categoria;
  }

  private static formatarValor(valor: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  }

  private static formatarData(data: string): string {
    try {
      const date = new Date(data);
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch {
      return data;
    }
  }
}

