import { OpenAIAssistantService } from './OpenAIAssistantService.js';
import { OrdemServicoRepository } from '../repositories/OrdemServicoRepository.js';
import { ContatoRepository } from '../repositories/ContatoRepository.js';
import { PDFService } from './PDFService.js';
import { WhatsAppMessageFormatter } from './WhatsAppMessageFormatter.js';
import { WhatsAppMessageTemplates } from './WhatsAppMessageTemplates.js';
import { NotificationService } from './NotificationService.js';
import { EvolutionService } from './EvolutionService.js';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

/**
 * Orquestrador do Assistente
 * Integra OpenAI, WhatsApp e banco de dados
 * Gerencia o fluxo completo de conversação e execução de funções
 */
export class AssistantOrchestrator {
  private openaiService: OpenAIAssistantService;
  private osRepository: OrdemServicoRepository;
  private contatoRepository: ContatoRepository;
  private pdfService: PDFService;
  private notificationService: NotificationService;
  private evolutionService: EvolutionService;

  // Cache de conversas em memória
  private conversationHistories: Map<string, ChatCompletionMessageParam[]> = new Map();

  constructor() {
    this.openaiService = new OpenAIAssistantService();
    this.osRepository = new OrdemServicoRepository();
    this.contatoRepository = new ContatoRepository();
    this.pdfService = new PDFService();
    this.notificationService = new NotificationService();
    this.evolutionService = new EvolutionService();
  }

  /**
   * Processa uma mensagem do usuário
   */
  async processUserMessage(
    message: string,
    userPhone: string,
    chatId: string,
    userName?: string
  ): Promise<{
    response: string;
    mediaUrl?: string;
    mediaType?: 'document' | 'image';
    buttons?: any;
    list?: any;
  }> {
    try {
      console.log(`[Orchestrator] Processando mensagem de ${userPhone}: ${message.substring(0, 50)}...`);

      // Obtém ou cria usuário
      const user = await this.osRepository.getOrCreateUser(userPhone, userName);
      
      // Obtém ou cria conversa
      const conversation = await this.osRepository.getOrCreateConversation(
        user.id,
        chatId,
        userPhone
      );

      // Recupera histórico da conversa
      const conversationKey = `${userPhone}_${chatId}`;
      let history = this.conversationHistories.get(conversationKey) || [];
      
      console.log(`[Orchestrator] 📚 Histórico em memória: ${history.length} mensagens`);
      
      // Se o histórico estiver vazio, tenta recuperar do banco
      if (history.length === 0) {
        console.log(`[Orchestrator] 🔄 Histórico vazio, recuperando últimas mensagens do banco...`);
        history = await this.recuperarHistoricoRecente(conversation.id);
        console.log(`[Orchestrator] 📥 Recuperadas ${history.length} mensagens do banco`);
      }
      
      // Limita o histórico para evitar tokens excessivos (mantém últimas 20 mensagens)
      if (history.length > 20) {
        console.log(`[Orchestrator] ✂️ Cortando histórico: ${history.length} -> 20 mensagens`);
        history = history.slice(-20);
      }

      // Salva mensagem do usuário no banco
      await this.osRepository.saveMessage(
        conversation.id,
        `user_${Date.now()}`,
        'text',
        message,
        false
      );

      // Processa com OpenAI
      const aiResponse = await this.openaiService.processMessage(
        message,
        user.id,
        history
      );

      // Se a IA quer chamar funções, executamos
      if (aiResponse.toolCalls && aiResponse.toolCalls.length > 0) {
        console.log('[Orchestrator] Executando ferramentas solicitadas pela IA...');
        const toolResults = await this.executeFunctions(aiResponse.toolCalls, user.id);

        // Monta histórico corretamente:
        // 1. Mensagem do usuário
        const updatedHistory: ChatCompletionMessageParam[] = [
          ...history,
          {
          role: 'user',
          content: message
          },
          // 2. Resposta do assistente COM tool_calls
          {
          role: 'assistant',
          content: aiResponse.response || null,
          tool_calls: aiResponse.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments)
            }
          }))
          },
          // 3. Resultados das ferramentas
          ...toolResults.map(tr => ({
            role: 'tool' as const,
            tool_call_id: tr.toolCallId,
            content: JSON.stringify(tr.result)
          }))
        ];

        // Agora pede para a IA gerar a resposta final com base nos resultados
        console.log('[Orchestrator] Gerando resposta final com base nos resultados das ferramentas...');
        
        // Adiciona contexto extra para ajudar a IA a manter o foco
        const contextMessage = this.criarMensagemContexto(message, toolResults);
        if (contextMessage) {
          updatedHistory.push({
            role: 'system' as const,
            content: contextMessage
          });
        }
        
        const finalResponse = await this.openaiService.continueWithFunctionResults(
          updatedHistory
        );

        // Atualiza histórico com a resposta final
        updatedHistory.push({
          role: 'assistant',
          content: finalResponse
        });

        this.conversationHistories.set(conversationKey, updatedHistory);

        // Salva resposta no banco
        await this.osRepository.saveMessage(
          conversation.id,
          `assistant_${Date.now()}`,
          'text',
          finalResponse,
          true
        );

        // Processa resposta para formatação especial (se aplicável)
        return this.formatResponse(finalResponse, toolResults);

      } else {
        // Resposta direta sem tool calls
        history.push({
          role: 'user',
          content: message
        });
        history.push({
          role: 'assistant',
          content: aiResponse.response
        });

        this.conversationHistories.set(conversationKey, history);

        // Salva resposta no banco
        await this.osRepository.saveMessage(
          conversation.id,
          `assistant_${Date.now()}`,
          'text',
          aiResponse.response,
          true
        );

        return { response: aiResponse.response };
      }

    } catch (error: any) {
      console.error('[Orchestrator] Erro ao processar mensagem:', error);
      // NÃO mostrar erro técnico ao usuário - sempre mensagem amigável
      return {
        response: WhatsAppMessageFormatter.formatErrorMessage(
          '😔 Ops! Algo não saiu como esperado',
          'Não consegui processar sua mensagem agora. Pode tentar novamente em alguns segundos? Se continuar com problema, me avise!'
        )
      };
    }
  }

  /**
   * Executa as funções solicitadas pela IA
   */
  private async executeFunctions(
    toolCalls: Array<{ id: string; name: string; arguments: any }>,
    userId: string
  ): Promise<Array<{ toolCallId: string; result: any }>> {
    const results: Array<{ toolCallId: string; result: any }> = [];

    for (const toolCall of toolCalls) {
      console.log(`[Orchestrator] 🔧 Executando função: ${toolCall.name}`);
      console.log(`[Orchestrator] 📥 Parâmetros:`, JSON.stringify(toolCall.arguments).substring(0, 200));

      try {
        let result: any;

        switch (toolCall.name) {
          case 'criar_ordem_servico':
            result = await this.handleCriarOS(userId, toolCall.arguments);
            break;

          case 'consultar_ordens_servico':
            result = await this.handleConsultarOS(userId, toolCall.arguments);
            break;

          case 'atualizar_status_ordem_servico':
            result = await this.handleAtualizarStatus(toolCall.arguments);
            break;

          case 'atualizar_ordem_servico':
            result = await this.handleAtualizarOS(toolCall.arguments);
            break;

          case 'adicionar_pecas_ordem_servico':
            result = await this.handleAdicionarPecas(toolCall.arguments);
            break;

          case 'gerar_pdf_ordem_servico':
            result = await this.handleGerarPDF(toolCall.arguments);
            break;

          case 'obter_estatisticas_usuario':
            result = await this.handleObterEstatisticas(userId, toolCall.arguments);
            break;

          case 'buscar_ordem_servico_por_criterio':
            result = await this.handleBuscarOS(userId, toolCall.arguments);
            break;

          case 'obter_totalizadores':
            result = await this.handleObterTotalizadores(userId, toolCall.arguments);
            break;

          case 'listar_minhas_os':
            result = await this.handleListarMinhasOS(userId, toolCall.arguments);
            break;

          case 'obter_detalhes_completos_os':
            result = await this.handleObterDetalhesCompletos(toolCall.arguments);
            break;

          case 'obter_resumo_financeiro':
            result = await this.handleObterResumoFinanceiro(userId, toolCall.arguments);
            break;

          case 'agendar_notificacao':
            result = await this.handleAgendarNotificacao(userId, toolCall.arguments);
            break;

          case 'criar_automacao':
            result = await this.handleCriarAutomacao(userId, toolCall.arguments);
            break;

          case 'listar_notificacoes_agendadas':
            result = await this.handleListarNotificacoes(userId);
            break;

          case 'cancelar_notificacao':
            result = await this.handleCancelarNotificacao(toolCall.arguments);
            break;

          case 'buscar_contato':
            result = await this.handleBuscarContato(toolCall.arguments);
            break;

          case 'enviar_pdf_os_para_contato':
            result = await this.handleEnviarPdfOsParaContato(toolCall.arguments);
            break;

          case 'enviar_mensagem_whatsapp':
            result = await this.handleEnviarMensagemWhatsApp(toolCall.arguments);
            break;

          case 'salvar_contato':
            result = await this.handleSalvarContato(userId, toolCall.arguments);
            break;

          case 'listar_contatos':
            result = await this.handleListarContatos(userId, toolCall.arguments);
            break;

          case 'buscar_contato_salvo':
            result = await this.handleBuscarContatoSalvo(userId, toolCall.arguments);
            break;

          default:
            console.log(`[Orchestrator] ⚠️ Função não implementada: ${toolCall.name}`);
            result = { 
              success: false,
              error: 'Função não implementada' 
            };
        }

        console.log(`[Orchestrator] ✅ Função ${toolCall.name} executada com sucesso`);
        console.log(`[Orchestrator] 📤 Resultado:`, JSON.stringify(result).substring(0, 200));

        // 🎨 Formata o resultado com template visual ANTES de enviar para a IA
        const resultadoFormatado = this.aplicarTemplateVisual(toolCall.name, result);

        results.push({
          toolCallId: toolCall.id,
          result: resultadoFormatado
        });

      } catch (error: any) {
        console.error(`[Orchestrator] ❌ Erro ao executar ${toolCall.name}:`, error.message);
        
        // Transforma erro técnico em mensagem amigável
        const mensagemAmigavel = this.traduzirErroParaUsuario(toolCall.name, error);
        
        // SEMPRE retorna um resultado válido, mesmo em caso de erro
        results.push({
          toolCallId: toolCall.id,
          result: { 
            success: false,
            error: mensagemAmigavel,
            detalhes: 'Ocorreu um erro ao processar sua solicitação.'
          }
        });
        
        console.log(`[Orchestrator] 📤 Erro tratado e retornado ao assistente`);
      }
    }

    console.log(`[Orchestrator] ✅ Total de ${results.length} ferramentas executadas`);
    return results;
  }

  /**
   * Handler: Criar Ordem de Serviço
   */
  private async handleCriarOS(userId: string, args: any) {
    const os = await this.osRepository.createOrdemServico({
      usuario_id: userId,
      ...args
    });

    // 💾 Salva automaticamente o contato do cliente
    if (args.cliente_nome && args.cliente_telefone) {
      try {
        await this.contatoRepository.salvarContato({
          usuario_id: userId,
          nome: args.cliente_nome,
          telefone: args.cliente_telefone,
          email: args.cliente_email,
          observacoes: `Cliente da OS ${os.numero_os}`
        });
        console.log(`[Orchestrator] ✅ Contato "${args.cliente_nome}" salvo automaticamente`);
      } catch (error) {
        console.warn('[Orchestrator] ⚠️ Erro ao salvar contato automaticamente:', error);
        // Não falha a criação da OS se der erro ao salvar contato
      }
    }

    return {
      success: true,
      numero_os: os.numero_os,
      ordem_servico: os
    };
  }

  /**
   * Handler: Consultar Ordens de Serviço
   */
  private async handleConsultarOS(userId: string, args: any) {
    if (args.numero_os) {
      // Busca uma OS específica
      const os = await this.osRepository.getOrdemServicoByNumero(args.numero_os);
      return {
        success: true,
        ordens: os ? [os] : [],
        total: os ? 1 : 0
      };
    }

    // Busca com filtros
    const ordens = await this.osRepository.getOrdensServico({
      usuario_id: userId,
      status: args.status,
      periodo_dias: args.periodo_dias,
      limite: args.limite || 10
    });

    return {
      success: true,
      ordens,
      total: ordens.length
    };
  }

  /**
   * Handler: Atualizar Status
   */
  private async handleAtualizarStatus(args: any) {
    const os = await this.osRepository.updateStatus(
      args.numero_os,
      args.novo_status,
      args.observacao
    );

    return {
      success: true,
      numero_os: os.numero_os,
      status_anterior: args.status_anterior,
      status_novo: os.status,
      ordem_servico: os
    };
  }

  /**
   * Handler: Atualizar Ordem de Serviço
   */
  private async handleAtualizarOS(args: any) {
    const { numero_os, ...updates } = args;
    const os = await this.osRepository.updateOrdemServico(numero_os, updates);

    return {
      success: true,
      numero_os: os.numero_os,
      ordem_servico: os
    };
  }

  /**
   * Handler: Adicionar Peças
   */
  private async handleAdicionarPecas(args: any) {
    const pecas = await this.osRepository.addPecas(args.numero_os, args.pecas);

    return {
      success: true,
      numero_os: args.numero_os,
      pecas_adicionadas: pecas.length,
      pecas
    };
  }

  /**
   * Handler: Gerar PDF
   */
  private async handleGerarPDF(args: any) {
    const os = await this.osRepository.getOrdemServicoByNumero(args.numero_os);
    
    if (!os) {
      return {
        success: false,
        error: 'Ordem de serviço não encontrada'
      };
    }

    // Mapeia os dados do banco para o formato esperado pelo PDFService
    const osData = {
      id: os.id,
      client_name: os.cliente_nome,
      client_phone: os.cliente_telefone,
      created_at: os.criado_em,
      services: [os.titulo || os.descricao], // ✅ Usa titulo ou descricao
      total_amount: os.valor_estimado || 0,
      status: os.status,
      notes: os.observacoes || os.descricao
    };

    const pdfPath = await this.pdfService.generateOS(osData);

    return {
      success: true,
      numero_os: os.numero_os,
      pdf_path: pdfPath,
      pdf_url: `${process.env.BASE_URL || 'http://localhost:3000'}/temp/${pdfPath.split('/').pop()}`
    };
  }

  /**
   * Handler: Obter Estatísticas
   */
  private async handleObterEstatisticas(userId: string, args: any) {
    const stats = await this.osRepository.getStatistics(
      userId,
      args.periodo_dias || 30
    );

    return {
      success: true,
      estatisticas: stats
    };
  }

  /**
   * Handler: Buscar OS por critério
   */
  private async handleBuscarOS(userId: string, args: any) {
    const ordens = await this.osRepository.searchOrdensServico(
      args.termo_busca,
      userId,
      args.limite || 10
    );

    return {
      success: true,
      ordens,
      total: ordens.length
    };
  }

  /**
   * Handler: Obter Totalizadores
   */
  private async handleObterTotalizadores(userId: string, args: any) {
    try {
      const ordens = await this.osRepository.getOrdensServico({
        usuario_id: userId,
        periodo_dias: args.periodo_dias
      });

      // Calcula totalizadores
      const totalizadores = {
        total_geral: ordens.length,
        abertas: ordens.filter(o => o.status === 'aberta').length,
        em_andamento: ordens.filter(o => o.status === 'em_andamento').length,
        aguardando_pecas: ordens.filter(o => o.status === 'aguardando_pecas').length,
        concluidas: ordens.filter(o => o.status === 'concluida').length,
        canceladas: ordens.filter(o => o.status === 'cancelada').length,
        valor_total_estimado: ordens.reduce((sum, o) => sum + (o.valor_estimado || 0), 0),
        valor_total_final: ordens.reduce((sum, o) => sum + (o.valor_final || 0), 0),
        periodo_analisado: args.periodo_dias ? `Últimos ${args.periodo_dias} dias` : 'Todas as OS'
      };

      return {
        success: true,
        totalizadores
      };
    } catch (error: any) {
      return {
        success: false,
        error: 'Não foi possível obter os totalizadores no momento'
      };
    }
  }

  /**
   * Handler: Listar Minhas OS
   */
  private async handleListarMinhasOS(userId: string, args: any) {
    try {
      let ordens = await this.osRepository.getOrdensServico({
        usuario_id: userId
      });

      // Filtra concluídas se solicitado
      if (!args.incluir_concluidas) {
        ordens = ordens.filter(o => o.status !== 'concluida');
      }

      // Ordena conforme solicitado
      const ordenarPor = args.ordenar_por || 'data_criacao';
      ordens.sort((a, b) => {
        switch (ordenarPor) {
          case 'prioridade':
            const prioridades = { 'urgente': 4, 'alta': 3, 'normal': 2, 'baixa': 1 };
            return (prioridades[b.prioridade as keyof typeof prioridades] || 0) - 
                   (prioridades[a.prioridade as keyof typeof prioridades] || 0);
          case 'status':
            return a.status.localeCompare(b.status);
          case 'valor':
            return (b.valor_final || b.valor_estimado || 0) - (a.valor_final || a.valor_estimado || 0);
          default: // data_criacao
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
      });

      return {
        success: true,
        ordens: ordens.map(o => ({
          numero: o.numero_os,
          titulo: o.titulo,
          status: o.status,
          prioridade: o.prioridade,
          cliente: o.cliente_nome,
          valor: o.valor_final || o.valor_estimado,
          data_criacao: o.created_at
        })),
        total: ordens.length
      };
    } catch (error: any) {
      return {
        success: false,
        error: 'Não foi possível listar suas ordens de serviço no momento'
      };
    }
  }

  /**
   * Handler: Obter Detalhes Completos
   */
  private async handleObterDetalhesCompletos(args: any) {
    try {
      const os = await this.osRepository.getOrdemServicoByNumero(args.numero_os);
      
      if (!os) {
        return {
          success: false,
          error: `Ordem de serviço ${args.numero_os} não encontrada`
        };
      }

      // Retorna TODOS os detalhes (exceto dados sensíveis)
      return {
        success: true,
        ordem_servico: {
          numero: os.numero_os,
          status: os.status,
          prioridade: os.prioridade,
          categoria: os.categoria,
          titulo: os.titulo,
          descricao: os.descricao,
          cliente: {
            nome: os.cliente_nome,
            telefone: os.cliente_telefone,
            email: os.cliente_email,
            endereco: os.cliente_endereco
          },
          valores: {
            estimado: os.valor_estimado,
            final: os.valor_final
          },
          datas: {
            criacao: os.created_at,
            previsao: os.data_previsao,
            conclusao: os.data_conclusao
          },
          tecnico: os.tecnico_responsavel,
          observacoes: os.observacoes,
          pecas: os.pecas || []
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: 'Não foi possível obter os detalhes completos da OS no momento'
      };
    }
  }

  /**
   * Handler: Obter Resumo Financeiro
   */
  private async handleObterResumoFinanceiro(userId: string, args: any) {
    try {
      const ordens = await this.osRepository.getOrdensServico({
        usuario_id: userId,
        periodo_dias: args.periodo_dias || 30
      });

      const resumo = {
        periodo: args.periodo_dias ? `Últimos ${args.periodo_dias} dias` : 'Últimos 30 dias',
        total_os: ordens.length,
        valores: {
          total_estimado: ordens.reduce((sum, o) => sum + (o.valor_estimado || 0), 0),
          total_final: ordens.reduce((sum, o) => sum + (o.valor_final || 0), 0),
          total_faturado: ordens
            .filter(o => o.status === 'concluida')
            .reduce((sum, o) => sum + (o.valor_final || o.valor_estimado || 0), 0),
          em_aberto: ordens
            .filter(o => o.status !== 'concluida' && o.status !== 'cancelada')
            .reduce((sum, o) => sum + (o.valor_estimado || 0), 0)
        },
        por_status: {
          concluidas: {
            quantidade: ordens.filter(o => o.status === 'concluida').length,
            valor_total: ordens
              .filter(o => o.status === 'concluida')
              .reduce((sum, o) => sum + (o.valor_final || o.valor_estimado || 0), 0)
          },
          em_andamento: {
            quantidade: ordens.filter(o => o.status === 'em_andamento').length,
            valor_total: ordens
              .filter(o => o.status === 'em_andamento')
              .reduce((sum, o) => sum + (o.valor_estimado || 0), 0)
          },
          abertas: {
            quantidade: ordens.filter(o => o.status === 'aberta').length,
            valor_total: ordens
              .filter(o => o.status === 'aberta')
              .reduce((sum, o) => sum + (o.valor_estimado || 0), 0)
          }
        }
      };

      // Adiciona detalhes se solicitado
      let resumoCompleto: any = resumo;
      if (args.incluir_detalhes) {
        resumoCompleto.detalhes_por_os = ordens.map(o => ({
          numero: o.numero_os,
          cliente: o.cliente_nome,
          status: o.status,
          valor_estimado: o.valor_estimado,
          valor_final: o.valor_final
        }));
      }

      return {
        success: true,
        resumo_financeiro: resumoCompleto
      };
    } catch (_error: any) {
      return {
        success: false,
        error: 'Não foi possível obter o resumo financeiro no momento'
      };
    }
  }

  /**
   * Handler: Agendar Notificação
   */
  private async handleAgendarNotificacao(userId: string, args: any) {
    try {
      console.log(`[Orchestrator] 📅 Agendando notificação...`);
      console.log(`[Orchestrator] 📝 Data/hora recebida: "${args.data_hora}"`);
      
      // Processa data/hora
      const dataAgendada = this.parsearDataHora(args.data_hora);
      console.log(`[Orchestrator] ✅ Data processada: ${dataAgendada.toISOString()}`);
      console.log(`[Orchestrator] 📍 Local: ${dataAgendada.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
      
      // Busca número da OS se fornecido
      let ordemServicoId = null;
      if (args.numero_os) {
        const os = await this.osRepository.getOrdemServicoByNumero(args.numero_os);
        ordemServicoId = os?.id;
      }

      const notificacao = await this.notificationService.criarNotificacao({
        usuarioId: userId,
        ordemServicoId,
        tipo: args.tipo,
        destinatarioTelefone: args.destinatario_telefone,
        destinatarioNome: args.destinatario_nome,
        titulo: args.titulo,
        mensagem: args.mensagem,
        dataAgendada,
        enviarPdf: args.enviar_pdf || false,
        recorrente: args.recorrente || false,
        intervaloDias: args.intervalo_dias
      });

      // Formata data de forma amigável para a IA mostrar ao usuário
      const dataFormatada = new Date(notificacao.enviar_em).toLocaleString('pt-BR', {
        dateStyle: 'long',
        timeStyle: 'short',
        timeZone: 'America/Sao_Paulo'
      });

      console.log(`[Orchestrator] ✅ Notificação criada! ID: ${notificacao.id}`);
      console.log(`[Orchestrator] 📅 Envio em: ${dataFormatada}`);

      return {
        success: true,
        notificacao_id: notificacao.id,
        data_envio: notificacao.enviar_em,
        data_formatada: dataFormatada,
        mensagem: `Notificação agendada com sucesso para ${dataFormatada}`
      };
    } catch (error: any) {
      console.error('[Orchestrator] ❌ Erro ao agendar notificação:', error);
      return {
        success: false,
        error: 'Não foi possível agendar a notificação'
      };
    }
  }

  /**
   * Handler: Criar Automação
   */
  private async handleCriarAutomacao(userId: string, args: any) {
    try {
      const trigger = await this.notificationService.criarTrigger({
        usuarioId: userId,
        tipoEvento: args.tipo_evento,
        condicoes: args.condicoes,
        tipoAcao: args.tipo_acao,
        parametrosAcao: args.parametros_acao
      });

      return {
        success: true,
        trigger_id: trigger.id,
        mensagem: 'Automação criada com sucesso! Ela será executada automaticamente quando o evento ocorrer.'
      };
    } catch (error: any) {
      return {
        success: false,
        error: 'Não foi possível criar a automação'
      };
    }
  }

  /**
   * Handler: Listar Notificações Agendadas
   */
  private async handleListarNotificacoes(userId: string) {
    try {
      const notificacoes = await this.notificationService.listarNotificacoesPendentes(userId);

      return {
        success: true,
        notificacoes: notificacoes.map(n => ({
          id: n.id,
          tipo: n.tipo,
          titulo: n.titulo,
          mensagem: n.mensagem.substring(0, 100),
          destinatario: n.destinatario_telefone,
          data_envio: n.enviar_em,
          recorrente: n.recorrente
        })),
        total: notificacoes.length
      };
    } catch (error: any) {
      return {
        success: false,
        error: 'Não foi possível listar as notificações'
      };
    }
  }

  /**
   * Handler: Cancelar Notificação
   */
  private async handleCancelarNotificacao(args: any) {
    try {
      const sucesso = await this.notificationService.cancelarNotificacao(args.notificacao_id);

      if (sucesso) {
        return {
          success: true,
          mensagem: 'Notificação cancelada com sucesso'
        };
      } else {
        return {
          success: false,
          error: 'Não foi possível cancelar a notificação'
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: 'Não foi possível cancelar a notificação'
      };
    }
  }

  /**
   * Busca contatos do WhatsApp
   */
  private async handleBuscarContato(args: any) {
    try {
      console.log(`[Orchestrator] 🔍 Buscando contato: ${args.nome}`);
      
      const contatos = await this.evolutionService.searchContact(args.nome);

      if (contatos.length === 0) {
        return {
          success: false,
          mensagem: `Nenhum contato encontrado com "${args.nome}"`,
          contatos: []
        };
      }

      if (contatos.length === 1) {
        return {
          success: true,
          mensagem: `Encontrei o contato "${contatos[0].nome}"!`,
          contatos: contatos,
          telefone_selecionado: contatos[0].telefone
        };
      }

      // Múltiplos contatos encontrados
      return {
        success: true,
        mensagem: `Encontrei ${contatos.length} contatos com "${args.nome}". Qual deles você quer?`,
        contatos: contatos.map((c: any) => ({
          nome: c.nome,
          telefone: c.telefone
        }))
      };
    } catch (error: any) {
      console.error('[Orchestrator] Erro ao buscar contato:', error);
      return {
        success: false,
        error: 'Não consegui buscar os contatos no momento'
      };
    }
  }

  /**
   * Envia PDF de OS para um contato (função unificada)
   */
  private async handleEnviarPdfOsParaContato(args: any) {
    try {
      console.log(`[Orchestrator] 📤 Enviando PDF da OS para contato: ${args.nome_contato}`);
      
      // 1. Busca a OS pelo número para pegar o usuario_id
      const os = await this.osRepository.getOrdemServicoByNumero(args.numero_os);
      
      if (!os) {
        return {
          success: false,
          error: `Ordem de serviço ${args.numero_os} não encontrada`
        };
      }

      console.log(`[Orchestrator] ✅ OS encontrada: ${os.numero_os}`);

      // 2. Busca o contato pelo nome
      const contatos = await this.contatoRepository.buscarContatoPorNome(
        os.usuario_id,
        args.nome_contato
      );

      if (!contatos || contatos.length === 0) {
        return {
          success: false,
          error: `Contato "${args.nome_contato}" não encontrado. Você pode salvar o contato primeiro?`
        };
      }

      const contato = contatos[0];
      console.log(`[Orchestrator] ✅ Contato encontrado: ${contato.nome} (${contato.telefone})`);

      // 3. Prepara os dados da OS para o PDF
      const osData = {
        id: os.id,
        client_name: os.cliente_nome,
        client_phone: os.cliente_telefone,
        created_at: os.criado_em,
        services: [os.titulo || os.descricao],  // ✅ Usa titulo ou descricao
        total_amount: os.valor_estimado || 0,
        status: os.status,
        notes: os.observacoes || os.descricao
      };

      // 4. Gera o PDF
      console.log(`[Orchestrator] 📄 Gerando PDF...`);
      const pdfFilePath = await this.pdfService.generateOS(osData);
      
      // 5. Lê o arquivo e converte para base64
      const fs = await import('fs');
      const pdfBuffer = fs.readFileSync(pdfFilePath);
      const pdfBase64 = pdfBuffer.toString('base64');
      
      const fileName = `OS-${os.numero_os || os.id}.pdf`;
      
      // 6. Formata o número para remoteJid
      let remoteJid = contato.telefone;
      
      // Remove caracteres não numéricos
      remoteJid = remoteJid.replace(/\D/g, '');
      
      // Adiciona código do país se não tiver
      if (!remoteJid.startsWith('55') && remoteJid.length === 11) {
        remoteJid = '55' + remoteJid;
        console.log(`[Orchestrator] 📞 Adicionado código do país: ${remoteJid}`);
      }
      
      // Adiciona @s.whatsapp.net
      if (!remoteJid.includes('@')) {
        remoteJid = `${remoteJid}@s.whatsapp.net`;
      }
      
      console.log(`[Orchestrator] 📞 Número formatado: ${remoteJid}`);

      // 7. Envia mensagem adicional (se houver)
      if (args.mensagem_adicional) {
        await this.evolutionService.sendTextMessage(remoteJid, args.mensagem_adicional);
      }

      // 8. Envia o PDF
      console.log(`[Orchestrator] 📤 Enviando PDF para ${remoteJid}...`);
      console.log(`[Orchestrator] 📄 Tamanho do PDF: ${pdfBuffer.length} bytes (${Math.round(pdfBuffer.length / 1024)}KB)`);
      console.log(`[Orchestrator] 📄 Tamanho do Base64: ${pdfBase64.length} caracteres`);
      
      try {
        const mediaResponse = await this.evolutionService.sendMedia({
          number: remoteJid,
          mediatype: 'document',
          media: pdfBase64,
          fileName: fileName,
          caption: `📋 Ordem de Serviço ${os.numero_os || os.id}`
        });
        
        console.log(`[Orchestrator] ✅ PDF enviado! Resposta:`, mediaResponse);
      } catch (mediaError: any) {
        console.error(`[Orchestrator] ❌ Erro ao enviar PDF:`, mediaError);
        throw new Error(`Falha ao enviar PDF: ${mediaError.message}`);
      }

      // 9. Remove o arquivo temporário
      fs.unlinkSync(pdfFilePath);

      console.log(`[Orchestrator] ✅ PDF enviado com sucesso!`);

      return {
        success: true,
        mensagem: `PDF da OS ${os.numero_os} enviado com sucesso para ${contato.nome} (${contato.telefone})!`,
        contato: {
          nome: contato.nome,
          telefone: contato.telefone
        },
        os: {
          numero_os: os.numero_os,
          cliente: os.cliente_nome
        }
      };

    } catch (error: any) {
      console.error('[Orchestrator] ❌ Erro ao enviar PDF da OS:', {
        message: error.message,
        stack: error.stack,
        response: error.response?.data
      });
      return {
        success: false,
        error: `Não consegui enviar o PDF: ${error.message}`
      };
    }
  }

  /**
   * Envia mensagem para um número do WhatsApp
   */
  private async handleEnviarMensagemWhatsApp(args: any) {
    try {
      console.log(`[Orchestrator] 📤 Enviando mensagem WhatsApp para: ${args.numero}`);
      
      // Formata o número para remoteJid
      let remoteJid = args.numero;
      if (!remoteJid.includes('@')) {
        remoteJid = `${remoteJid}@s.whatsapp.net`;
      }

      // Se foi pedido para enviar PDF da OS
      if (args.ordem_servico_id) {
        console.log(`[Orchestrator] 📄 Gerando PDF da OS ${args.ordem_servico_id}...`);
        
        // Busca a OS
        const os = await this.osRepository.getOrdemServicoById(parseInt(args.ordem_servico_id));
        if (!os) {
          return {
            success: false,
            error: `Ordem de serviço ${args.ordem_servico_id} não encontrada`
          };
        }

        // Prepara os dados da OS para o PDF
        const osData = {
          id: os.id,
          client_name: os.cliente_nome,
          client_phone: os.cliente_telefone,
          created_at: os.criado_em,
          services: [os.titulo || os.descricao], // ✅ Usa titulo ou descricao
          total_amount: os.valor_estimado || 0,
          status: os.status,
          notes: os.observacoes || os.descricao
        };

        // Gera o PDF (retorna o caminho do arquivo)
        const pdfFilePath = await this.pdfService.generateOS(osData);
        
        // Lê o arquivo e converte para base64
        const fs = await import('fs');
        const pdfBuffer = fs.readFileSync(pdfFilePath);
        const pdfBase64 = pdfBuffer.toString('base64');
        
        const fileName = `OS-${os.numero_os || os.id}.pdf`;
        
        // Envia mensagem de texto primeiro (se houver)
        if (args.mensagem) {
          await this.evolutionService.sendTextMessage(remoteJid, args.mensagem);
        }

        // Envia o PDF
        await this.evolutionService.sendMedia({
          number: remoteJid,
          mediatype: 'document',
          media: pdfBase64,
          fileName: fileName,
          caption: `📋 Ordem de Serviço ${os.numero_os || os.id}`
        });

        // Remove o arquivo temporário
        fs.unlinkSync(pdfFilePath);

        return {
          success: true,
          mensagem: `Mensagem e PDF da OS ${os.numero_os || os.id} enviados com sucesso para ${args.numero}!`
        };
      }

      // Se for apenas mensagem de texto
      if (args.mensagem) {
        await this.evolutionService.sendTextMessage(remoteJid, args.mensagem);
        return {
          success: true,
          mensagem: `Mensagem enviada com sucesso para ${args.numero}!`
        };
      }

      return {
        success: false,
        error: 'Nenhuma mensagem ou PDF foi especificado para enviar'
      };

    } catch (error: any) {
      console.error('[Orchestrator] Erro ao enviar mensagem WhatsApp:', error);
      return {
        success: false,
        error: 'Não consegui enviar a mensagem no momento'
      };
    }
  }

  /**
   * Salva um contato no banco de dados
   */
  private async handleSalvarContato(userId: string, args: any) {
    try {
      console.log(`[Orchestrator] 💾 Salvando contato: ${args.nome}`);
      
      const contato = await this.contatoRepository.salvarContato({
        usuario_id: userId,
        nome: args.nome,
        telefone: args.telefone,
        email: args.email,
        observacoes: args.observacoes,
        favorito: args.favorito || false
      });

      return {
        success: true,
        mensagem: `Contato "${args.nome}" salvo com sucesso!`,
        contato: {
          id: contato.id,
          nome: contato.nome,
          telefone: contato.telefone
        }
      };
    } catch (error: any) {
      console.error('[Orchestrator] Erro ao salvar contato:', error);
      return {
        success: false,
        error: 'Não consegui salvar o contato no momento'
      };
    }
  }

  /**
   * Lista contatos salvos
   */
  private async handleListarContatos(userId: string, args: any) {
    try {
      console.log(`[Orchestrator] 📋 Listando contatos...`);
      
      const contatos = await this.contatoRepository.listarContatos(userId, {
        favoritos: args.favoritos,
        busca: args.busca
      });

      if (contatos.length === 0) {
        return {
          success: true,
          mensagem: 'Você ainda não tem contatos salvos.',
          contatos: []
        };
      }

      return {
        success: true,
        mensagem: `Encontrei ${contatos.length} contato(s) salvo(s)!`,
        contatos: contatos.map((c: any) => ({
          id: c.id,
          nome: c.nome,
          telefone: c.telefone,
          favorito: c.favorito,
          total_os: c.total_os || 0
        }))
      };
    } catch (error: any) {
      console.error('[Orchestrator] Erro ao listar contatos:', error);
      return {
        success: false,
        error: 'Não consegui listar os contatos no momento'
      };
    }
  }

  /**
   * Busca contato salvo por nome
   */
  private async handleBuscarContatoSalvo(userId: string, args: any) {
    try {
      console.log(`[Orchestrator] 🔍 Buscando contato salvo: ${args.nome}`);
      
      const contatos = await this.contatoRepository.buscarContatoPorNome(userId, args.nome);

      if (contatos.length === 0) {
        return {
          success: false,
          mensagem: `Não encontrei nenhum contato salvo com "${args.nome}"`,
          contatos: []
        };
      }

      if (contatos.length === 1) {
        return {
          success: true,
          mensagem: `Encontrei o contato "${contatos[0].nome}"!`,
          contato: {
            id: contatos[0].id,
            nome: contatos[0].nome,
            telefone: contatos[0].telefone
          },
          telefone_selecionado: contatos[0].telefone
        };
      }

      // Múltiplos contatos encontrados
      return {
        success: true,
        mensagem: `Encontrei ${contatos.length} contatos com "${args.nome}". Qual deles?`,
        contatos: contatos.map((c: any) => ({
          id: c.id,
          nome: c.nome,
          telefone: c.telefone
        }))
      };
    } catch (error: any) {
      console.error('[Orchestrator] Erro ao buscar contato salvo:', error);
      return {
        success: false,
        error: 'Não consegui buscar o contato no momento'
      };
    }
  }

  /**
   * Parseia string de data/hora para Date
   * Sempre retorna uma data FUTURA (não no passado)
   */
  private parsearDataHora(dataStr: string): Date {
    try {
      console.log(`[Orchestrator] 📅 Parseando data: "${dataStr}"`);
      
      const agora = new Date(); // Data/hora ATUAL
      console.log(`[Orchestrator] 🕐 Agora: ${agora.toLocaleString('pt-BR')}`);

      // Tenta ISO 8601 primeiro
      if (dataStr.includes('T') || dataStr.includes('Z') || dataStr.match(/^\d{4}-\d{2}-\d{2}/)) {
        const isoDate = new Date(dataStr);
        if (!isNaN(isoDate.getTime())) {
          // Valida que não está no passado
          if (isoDate.getTime() > agora.getTime()) {
            console.log(`[Orchestrator] ✅ Data ISO válida: ${isoDate.toLocaleString('pt-BR')}`);
            return isoDate;
          } else {
            console.warn(`[Orchestrator] ⚠️ Data ISO no passado! Usando padrão.`);
          }
        }
      }

      // Processamento de linguagem natural
      const dataStrLower = dataStr.toLowerCase();

      // "daqui X minutos/horas/dias"
      const daquiMatch = dataStr.match(/daqui\s+(\d+)\s*(minuto|hora|dia)s?/i);
      if (daquiMatch) {
        const quantidade = parseInt(daquiMatch[1]);
        const unidade = daquiMatch[2].toLowerCase();
        const resultado = new Date(agora);
        
        if (unidade.startsWith('minuto')) {
          resultado.setMinutes(resultado.getMinutes() + quantidade);
        } else if (unidade.startsWith('hora')) {
          resultado.setHours(resultado.getHours() + quantidade);
        } else if (unidade.startsWith('dia')) {
          resultado.setDate(resultado.getDate() + quantidade);
        }
        
        console.log(`[Orchestrator] ✅ Agendado para daqui ${quantidade} ${unidade}(s): ${resultado.toLocaleString('pt-BR')}`);
        return resultado;
      }

      // "amanhã"
      if (dataStrLower.includes('amanhã') || dataStrLower.includes('amanha')) {
        const amanha = new Date(agora);
        amanha.setDate(amanha.getDate() + 1);
        
        // Procura por hora específica
        const horaMatch = dataStr.match(/(\d{1,2}):?(\d{2})?h?/);
        if (horaMatch) {
          const hora = parseInt(horaMatch[1]);
          const minuto = parseInt(horaMatch[2] || '0');
          amanha.setHours(hora, minuto, 0, 0);
        } else {
          // Se não especificou hora, usa 9h da manhã
          amanha.setHours(9, 0, 0, 0);
        }
        
        console.log(`[Orchestrator] ✅ Agendado para amanhã: ${amanha.toLocaleString('pt-BR')}`);
        return amanha;
      }

      // "hoje"
      if (dataStrLower.includes('hoje')) {
        const hoje = new Date(agora);
        
        const horaMatch = dataStr.match(/(\d{1,2}):?(\d{2})?h?/);
        if (horaMatch) {
          const hora = parseInt(horaMatch[1]);
          const minuto = parseInt(horaMatch[2] || '0');
          hoje.setHours(hora, minuto, 0, 0);
          
          // Se a hora já passou hoje, agenda para amanhã
          if (hoje.getTime() <= agora.getTime()) {
            hoje.setDate(hoje.getDate() + 1);
            console.log(`[Orchestrator] ⚠️ Hora já passou hoje, agendando para amanhã`);
          }
        } else {
          // Sem hora especificada, usa daqui 1 hora
          hoje.setTime(agora.getTime() + 60 * 60 * 1000);
        }
        
        console.log(`[Orchestrator] ✅ Agendado para hoje: ${hoje.toLocaleString('pt-BR')}`);
        return hoje;
      }

      // "próxima segunda/terça/etc"
      const diasSemana = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
      for (let i = 0; i < diasSemana.length; i++) {
        if (dataStrLower.includes(diasSemana[i])) {
          const resultado = new Date(agora);
          const diaAtual = resultado.getDay();
          const diasAte = (i - diaAtual + 7) % 7 || 7; // Próxima ocorrência
          resultado.setDate(resultado.getDate() + diasAte);
          
          // Procura hora
          const horaMatch = dataStr.match(/(\d{1,2}):?(\d{2})?h?/);
          if (horaMatch) {
            resultado.setHours(parseInt(horaMatch[1]), parseInt(horaMatch[2] || '0'), 0, 0);
          } else {
            resultado.setHours(9, 0, 0, 0);
          }
          
          console.log(`[Orchestrator] ✅ Agendado para próxima ${diasSemana[i]}: ${resultado.toLocaleString('pt-BR')}`);
          return resultado;
        }
      }

      // Se só tem números (hora), assume para hoje ou amanhã
      const apenasHoraMatch = dataStr.match(/^(\d{1,2}):?(\d{2})?h?$/);
      if (apenasHoraMatch) {
        const resultado = new Date(agora);
        const hora = parseInt(apenasHoraMatch[1]);
        const minuto = parseInt(apenasHoraMatch[2] || '0');
        resultado.setHours(hora, minuto, 0, 0);
        
        // Se já passou, agenda para amanhã
        if (resultado.getTime() <= agora.getTime()) {
          resultado.setDate(resultado.getDate() + 1);
        }
        
        console.log(`[Orchestrator] ✅ Agendado para: ${resultado.toLocaleString('pt-BR')}`);
        return resultado;
      }

      // Padrão: 1 hora a partir de agora
      const daquiUmaHora = new Date(agora.getTime() + 60 * 60 * 1000);
      console.log(`[Orchestrator] ⚠️ Não entendi a data, usando padrão (daqui 1h): ${daquiUmaHora.toLocaleString('pt-BR')}`);
      return daquiUmaHora;
      
    } catch (error) {
      console.error('[Orchestrator] ❌ Erro ao parsear data:', error);
      // Em caso de erro, agenda para daqui 1 hora
      const daquiUmaHora = new Date(Date.now() + 60 * 60 * 1000);
      console.log(`[Orchestrator] 🔄 Usando fallback (daqui 1h): ${daquiUmaHora.toLocaleString('pt-BR')}`);
      return daquiUmaHora;
    }
  }

  /**
   * 🎨 Aplica template visual ao resultado da ferramenta
   * Transforma dados brutos em mensagens formatadas e bonitas
   */
  private aplicarTemplateVisual(nomeFuncao: string, resultado: any): any {
    // Se já teve erro, não formata
    if (!resultado.success && resultado.error) {
      return resultado;
    }

    try {
      switch (nomeFuncao) {
        case 'consultar_ordens_servico':
        case 'listar_minhas_os':
        case 'buscar_ordem_servico_por_criterio':
          if (resultado.ordens && Array.isArray(resultado.ordens)) {
            return {
              ...resultado,
              mensagem_formatada: WhatsAppMessageTemplates.formatarListaOS(resultado.ordens)
            };
          }
          break;

        case 'obter_totalizadores':
          if (resultado.totalizadores) {
            return {
              ...resultado,
              mensagem_formatada: WhatsAppMessageTemplates.formatarTotalizadores(resultado.totalizadores)
            };
          }
          break;

        case 'obter_resumo_financeiro':
          if (resultado.resumo_financeiro) {
            return {
              ...resultado,
              mensagem_formatada: WhatsAppMessageTemplates.formatarResumoFinanceiro(resultado.resumo_financeiro)
            };
          }
          break;

        case 'obter_detalhes_completos_os':
          if (resultado.ordem_servico) {
            return {
              ...resultado,
              mensagem_formatada: WhatsAppMessageTemplates.formatarDetalhesOS(resultado.ordem_servico)
            };
          }
          break;

        case 'criar_ordem_servico':
          if (resultado.ordem_servico) {
            return {
              ...resultado,
              mensagem_formatada: WhatsAppMessageTemplates.formatarConfirmacaoCriacaoOS(resultado.ordem_servico)
            };
          }
          break;

        case 'obter_estatisticas_usuario':
          if (resultado.estatisticas) {
            return {
              ...resultado,
              mensagem_formatada: WhatsAppMessageTemplates.formatarEstatisticas(resultado.estatisticas)
            };
          }
          break;

        case 'atualizar_status_ordem_servico':
        case 'atualizar_ordem_servico':
          if (resultado.success) {
            return {
              ...resultado,
              mensagem_formatada: WhatsAppMessageTemplates.formatarSucesso(
                'Ordem de serviço atualizada!',
                resultado.mensagem
              )
            };
          }
          break;

        case 'adicionar_pecas_ordem_servico':
          if (resultado.success) {
            return {
              ...resultado,
              mensagem_formatada: WhatsAppMessageTemplates.formatarSucesso(
                'Peças adicionadas com sucesso!',
                `${resultado.pecas?.length || 0} peça(s) registrada(s)`
              )
            };
          }
          break;

        case 'gerar_pdf_ordem_servico':
          if (resultado.success && resultado.pdf_url) {
            return {
              ...resultado,
              mensagem_formatada: WhatsAppMessageTemplates.formatarSucesso(
                '📄 PDF gerado com sucesso!',
                'Vou enviar o documento para você agora.'
              )
            };
          }
          break;
      }
    } catch (error) {
      console.warn('[Orchestrator] Erro ao aplicar template visual:', error);
    }

    // Retorna resultado original se não houver template específico
    return resultado;
  }

  /**
   * Cria mensagem de contexto para ajudar a IA a manter o foco
   */
  private criarMensagemContexto(mensagemUsuario: string, toolResults: any[]): string | null {
    // Se tem mensagem_formatada nos resultados, reforça que deve usar
    const temFormatada = toolResults.some(r => r.result?.mensagem_formatada);
    
    if (temFormatada) {
      return `🎨 IMPORTANTE: Use as mensagens_formatadas que foram fornecidas nos resultados. Elas já estão perfeitamente formatadas. Adicione apenas uma breve introdução amigável e cole a mensagem_formatada completa.`;
    }

    // Para perguntas de contexto (que, qual, etc)
    const perguntasContexto = ['qual', 'quais', 'que', 'quando', 'quanto', 'onde', 'como'];
    const temPerguntaContexto = perguntasContexto.some(p => 
      mensagemUsuario.toLowerCase().includes(p)
    );

    if (temPerguntaContexto && mensagemUsuario.length < 50) {
      return `📚 CONTEXTO: O usuário fez uma pergunta curta. Revise o histórico da conversa para entender o contexto completo. Provavelmente ele está se referindo a algo que já foi mencionado.`;
    }

    return null;
  }

  /**
   * Traduz erros técnicos em mensagens amigáveis para o usuário
   */
  private traduzirErroParaUsuario(nomeFuncao: string, _error: any): string {
    // Mensagens padrão por tipo de erro
    const mensagensPadrao: Record<string, string> = {
      'criar_ordem_servico': 'Não consegui criar a ordem de serviço. Vamos tentar novamente?',
      'consultar_ordens_servico': 'Não consegui buscar as ordens de serviço no momento. Tente novamente em instantes.',
      'atualizar_status_ordem_servico': 'Não consegui atualizar o status. Verifique se o número da OS está correto.',
      'atualizar_ordem_servico': 'Não consegui atualizar a ordem de serviço. Tente novamente.',
      'adicionar_pecas_ordem_servico': 'Não consegui adicionar as peças. Verifique os dados e tente novamente.',
      'gerar_pdf_ordem_servico': 'Não consegui gerar o PDF. Verifique se a OS existe.',
      'obter_estatisticas_usuario': 'Não consegui obter as estatísticas no momento.',
      'buscar_ordem_servico_por_criterio': 'Não encontrei resultados para sua busca.',
      'obter_totalizadores': 'Não consegui calcular os totalizadores no momento.',
      'listar_minhas_os': 'Não consegui listar suas ordens de serviço.',
      'obter_detalhes_completos_os': 'Não consegui obter os detalhes da OS.',
      'obter_resumo_financeiro': 'Não consegui obter o resumo financeiro.'
    };

    // Retorna mensagem amigável ou padrão genérica
    return mensagensPadrao[nomeFuncao] || 'Ops! Algo não saiu como esperado. Pode tentar novamente?';
  }

  /**
   * Formata resposta com elementos especiais do WhatsApp
   */
  private formatResponse(
    text: string,
    toolResults: Array<{ toolCallId: string; result: any }>
  ): {
    response: string;
    mediaUrl?: string;
    mediaType?: 'document' | 'image';
    buttons?: any;
    list?: any;
  } {
    // Verifica se alguma função gerou PDF
    const pdfResult = toolResults.find(r => r.result.pdf_url);
    if (pdfResult) {
      return {
        response: text,
        mediaUrl: pdfResult.result.pdf_url,
        mediaType: 'document'
      };
    }

    // TODO: Adicionar lógica para detectar quando usar botões ou listas
    // baseado no contexto da resposta

    return { response: text };
  }

  /**
   * Processa áudio e retorna transcrição
   */
  async processAudio(
    audioBuffer: Buffer,
    mimeType: string,
    userPhone: string,
    chatId: string,
    userName?: string
  ): Promise<{
    response: string;
    mediaUrl?: string;
    mediaType?: 'document' | 'image';
    buttons?: any;
    list?: any;
  }> {
    try {
      console.log(`[Orchestrator] Processando áudio de ${userPhone}`);

      // Transcreve o áudio
      const transcription = await this.openaiService.transcribeAudio(audioBuffer, mimeType);
      console.log(`[Orchestrator] Áudio transcrito: ${transcription}`);

      // Processa a transcrição como mensagem de texto
      return await this.processUserMessage(transcription, userPhone, chatId, userName);

    } catch (error: any) {
      console.error('[Orchestrator] Erro ao processar áudio:', error);
      return {
        response: WhatsAppMessageFormatter.formatErrorMessage(
          'Não consegui processar o áudio.',
          'Tente enviar uma mensagem de texto ou grave o áudio novamente.'
        )
      };
    }
  }

  /**
   * Recupera histórico recente do banco de dados
   */
  private async recuperarHistoricoRecente(conversationId: string): Promise<ChatCompletionMessageParam[]> {
    try {
      const mensagens = await this.osRepository.getRecentMessages(conversationId, 10);
      
      const history: ChatCompletionMessageParam[] = [];
      
      for (const msg of mensagens) {
        const role = msg.is_from_bot ? 'assistant' : 'user';
        history.push({
          role: role as 'user' | 'assistant',
          content: msg.content
        });
      }
      
      return history;
    } catch (error) {
      console.error('[Orchestrator] Erro ao recuperar histórico:', error);
      return [];
    }
  }

  /**
   * Limpa histórico de conversa
   */
  clearConversationHistory(userPhone: string, chatId: string): void {
    const conversationKey = `${userPhone}_${chatId}`;
    this.conversationHistories.delete(conversationKey);
    console.log(`[Orchestrator] Histórico limpo para ${conversationKey}`);
  }

  /**
   * Obtém histórico de conversa (para debug)
   */
  getConversationHistory(userPhone: string, chatId: string): ChatCompletionMessageParam[] {
    const conversationKey = `${userPhone}_${chatId}`;
    return this.conversationHistories.get(conversationKey) || [];
  }
}

