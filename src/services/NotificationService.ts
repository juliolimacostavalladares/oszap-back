import { supabase } from '../config/supabase.js';
import { EvolutionService } from './EvolutionService.js';
import { PDFService } from './PDFService.js';

/**
 * Serviço de Notificações e Automações
 * Gerencia notificações agendadas e triggers automáticos
 */
export class NotificationService {
  private evolutionService: EvolutionService;
  private pdfService: PDFService;

  constructor() {
    this.evolutionService = new EvolutionService();
    this.pdfService = new PDFService();
  }

  /**
   * Cria uma notificação agendada
   */
  async criarNotificacao(params: {
    usuarioId: string;
    ordemServicoId?: string;
    tipo: 'lembrete' | 'conclusao' | 'atualizacao' | 'pdf' | 'custom';
    destinatarioTelefone: string;
    destinatarioNome?: string;
    titulo: string;
    mensagem: string;
    dataAgendada: Date;
    enviarPdf?: boolean;
    anexoUrl?: string;
    recorrente?: boolean;
    intervaloDias?: number;
  }): Promise<any> {
    try {
      console.log('[NotificationService] 📅 Criando notificação agendada...');

      const { data, error } = await supabase
        .from('notificacoes_agendadas')
        .insert({
          usuario_id: params.usuarioId,
          ordem_servico_id: params.ordemServicoId,
          tipo: params.tipo,
          destinatario_telefone: params.destinatarioTelefone,
          destinatario_nome: params.destinatarioNome,
          titulo: params.titulo,
          mensagem: params.mensagem,
          data_agendada: params.dataAgendada.toISOString(),
          enviar_em: params.dataAgendada.toISOString(),
          enviar_pdf: params.enviarPdf || false,
          anexo_url: params.anexoUrl,
          recorrente: params.recorrente || false,
          intervalo_dias: params.intervaloDias,
          proxima_execucao: params.recorrente && params.intervaloDias 
            ? new Date(params.dataAgendada.getTime() + params.intervaloDias * 24 * 60 * 60 * 1000).toISOString()
            : null,
          status: 'pendente'
        })
        .select()
        .single();

      if (error) throw error;

      console.log('[NotificationService] ✅ Notificação criada:', data.id);
      return data;
    } catch (error: any) {
      console.error('[NotificationService] ❌ Erro ao criar notificação:', error);
      throw error;
    }
  }

  /**
   * Cria um trigger automático
   */
  async criarTrigger(params: {
    usuarioId: string;
    tipoEvento: 'os_concluida' | 'os_atualizada' | 'status_mudou' | 'data_chegando';
    condicoes: any;
    tipoAcao: 'enviar_notificacao' | 'enviar_pdf' | 'criar_os' | 'atualizar_campo';
    parametrosAcao: any;
  }): Promise<any> {
    try {
      console.log('[NotificationService] 🔧 Criando trigger automático...');

      const { data, error } = await supabase
        .from('triggers_automaticos')
        .insert({
          usuario_id: params.usuarioId,
          tipo_evento: params.tipoEvento,
          condicoes: params.condicoes,
          tipo_acao: params.tipoAcao,
          parametros_acao: params.parametrosAcao,
          ativo: true
        })
        .select()
        .single();

      if (error) throw error;

      console.log('[NotificationService] ✅ Trigger criado:', data.id);
      return data;
    } catch (error: any) {
      console.error('[NotificationService] ❌ Erro ao criar trigger:', error);
      throw error;
    }
  }

  /**
   * Processa notificações pendentes prontas para envio
   */
  async processarNotificacoesPendentes(): Promise<number> {
    try {
      console.log('[NotificationService] 🔄 Processando notificações pendentes...');

      // Busca notificações prontas
      const { data: notificacoes, error } = await supabase
        .from('notificacoes_prontas_envio')
        .select('*')
        .limit(50);

      if (error) throw error;

      if (!notificacoes || notificacoes.length === 0) {
        console.log('[NotificationService] ℹ️ Nenhuma notificação pendente');
        return 0;
      }

      console.log(`[NotificationService] 📬 ${notificacoes.length} notificações para processar`);

      let processadas = 0;
      for (const notif of notificacoes) {
        try {
          await this.enviarNotificacao(notif);
          processadas++;
        } catch (error) {
          console.error(`[NotificationService] ❌ Erro ao enviar notificação ${notif.id}:`, error);
        }
      }

      console.log(`[NotificationService] ✅ ${processadas}/${notificacoes.length} notificações enviadas`);
      return processadas;
    } catch (error: any) {
      console.error('[NotificationService] ❌ Erro ao processar notificações:', error);
      return 0;
    }
  }

  /**
   * Envia uma notificação específica
   */
  private async enviarNotificacao(notificacao: any): Promise<void> {
    try {
      console.log(`[NotificationService] 📤 Enviando notificação ${notificacao.id}...`);

      // Formata número de telefone
      const telefone = notificacao.destinatario_telefone.includes('@')
        ? notificacao.destinatario_telefone
        : `${notificacao.destinatario_telefone}@s.whatsapp.net`;

      // Monta mensagem formatada
      let mensagemCompleta = `📬 *${notificacao.titulo}*\n`;
      mensagemCompleta += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      mensagemCompleta += `${notificacao.mensagem}\n`;

      if (notificacao.numero_os) {
        mensagemCompleta += `\n📋 *OS:* #${notificacao.numero_os}`;
        if (notificacao.os_titulo) {
          mensagemCompleta += ` - ${notificacao.os_titulo}`;
        }
      }

      mensagemCompleta += `\n\n_Notificação automática_`;

      // Envia mensagem
      await this.evolutionService.sendTextMessage(telefone, mensagemCompleta);

      // Se deve enviar PDF
      if (notificacao.enviar_pdf && notificacao.ordem_servico_id) {
        await this.enviarPdfNotificacao(telefone, notificacao.ordem_servico_id);
      }

      // Se tem anexo URL
      if (notificacao.anexo_url) {
        await this.evolutionService.sendMedia({
          number: telefone,
          mediatype: 'document',
          media: notificacao.anexo_url,
          caption: notificacao.titulo
        });
      }

      // Atualiza status
      await this.marcarNotificacaoEnviada(notificacao.id, notificacao.recorrente, notificacao.intervalo_dias);

      console.log(`[NotificationService] ✅ Notificação ${notificacao.id} enviada com sucesso`);
    } catch (error: any) {
      console.error(`[NotificationService] ❌ Erro ao enviar notificação ${notificacao.id}:`, error);
      await this.marcarNotificacaoErro(notificacao.id, error.message);
      throw error;
    }
  }

  /**
   * Envia PDF de uma OS
   */
  private async enviarPdfNotificacao(telefone: string, ordemServicoId: string): Promise<void> {
    try {
      // Busca dados da OS
      const { data: os, error } = await supabase
        .from('ordens_servico')
        .select('*')
        .eq('id', ordemServicoId)
        .single();

      if (error || !os) {
        console.warn('[NotificationService] ⚠️ OS não encontrada para PDF');
        return;
      }

      // Gera PDF
      const pdfPath = await this.pdfService.generateOS(os);

      // Envia PDF
      await this.evolutionService.sendMedia({
        number: telefone,
        mediatype: 'document',
        media: pdfPath,
        fileName: `OS_${os.numero_os}.pdf`,
        caption: `📄 OS #${os.numero_os} - ${os.titulo}`
      });

      console.log('[NotificationService] 📄 PDF enviado com sucesso');
    } catch (error) {
      console.error('[NotificationService] ❌ Erro ao enviar PDF:', error);
    }
  }

  /**
   * Marca notificação como enviada
   */
  private async marcarNotificacaoEnviada(
    notificacaoId: string, 
    recorrente: boolean, 
    intervaloDias?: number
  ): Promise<void> {
    try {
      if (recorrente && intervaloDias) {
        // Se é recorrente, agenda próxima execução
        const proximaData = new Date();
        proximaData.setDate(proximaData.getDate() + intervaloDias);

        await supabase
          .from('notificacoes_agendadas')
          .update({
            status: 'pendente',
            enviada_em: new Date().toISOString(),
            enviar_em: proximaData.toISOString(),
            proxima_execucao: proximaData.toISOString(),
            tentativas: 0
          })
          .eq('id', notificacaoId);

        console.log(`[NotificationService] 🔄 Notificação recorrente reagendada para ${proximaData}`);
      } else {
        // Marca como enviada
        await supabase
          .from('notificacoes_agendadas')
          .update({
            status: 'enviada',
            enviada_em: new Date().toISOString()
          })
          .eq('id', notificacaoId);
      }
    } catch (error) {
      console.error('[NotificationService] ❌ Erro ao atualizar status:', error);
    }
  }

  /**
   * Marca notificação com erro
   */
  private async marcarNotificacaoErro(notificacaoId: string, erro: string): Promise<void> {
    try {
      // Incrementa tentativas
      const { data: notif } = await supabase
        .from('notificacoes_agendadas')
        .select('tentativas')
        .eq('id', notificacaoId)
        .single();

      const tentativas = (notif?.tentativas || 0) + 1;
      const maxTentativas = 3;

      await supabase
        .from('notificacoes_agendadas')
        .update({
          tentativas,
          erro_mensagem: erro,
          status: tentativas >= maxTentativas ? 'erro' : 'pendente',
          // Se ainda pode tentar, agenda para daqui 5 minutos
          enviar_em: tentativas < maxTentativas 
            ? new Date(Date.now() + 5 * 60 * 1000).toISOString()
            : undefined
        })
        .eq('id', notificacaoId);

      console.log(`[NotificationService] ⚠️ Notificação marcada com erro (tentativa ${tentativas}/${maxTentativas})`);
    } catch (error) {
      console.error('[NotificationService] ❌ Erro ao marcar erro:', error);
    }
  }

  /**
   * Dispara triggers automáticos para um evento
   */
  async dispararTriggers(
    usuarioId: string,
    tipoEvento: string,
    dadosEvento: any
  ): Promise<void> {
    try {
      console.log(`[NotificationService] 🎯 Disparando triggers para evento: ${tipoEvento}`);

      // Busca triggers ativos para este evento
      const { data: triggers, error } = await supabase
        .from('triggers_automaticos')
        .select('*')
        .eq('usuario_id', usuarioId)
        .eq('tipo_evento', tipoEvento)
        .eq('ativo', true);

      if (error) throw error;

      if (!triggers || triggers.length === 0) {
        console.log('[NotificationService] ℹ️ Nenhum trigger ativo para este evento');
        return;
      }

      console.log(`[NotificationService] 🔧 ${triggers.length} triggers encontrados`);

      for (const trigger of triggers) {
        try {
          // Verifica se as condições são atendidas
          if (this.verificarCondicoes(trigger.condicoes, dadosEvento)) {
            await this.executarAcaoTrigger(trigger, dadosEvento);
          }
        } catch (error) {
          console.error(`[NotificationService] ❌ Erro ao executar trigger ${trigger.id}:`, error);
        }
      }
    } catch (error: any) {
      console.error('[NotificationService] ❌ Erro ao disparar triggers:', error);
    }
  }

  /**
   * Verifica se as condições do trigger são atendidas
   */
  private verificarCondicoes(condicoes: any, dados: any): boolean {
    try {
      for (const [chave, valor] of Object.entries(condicoes)) {
        if (dados[chave] !== valor) {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Executa a ação de um trigger
   */
  private async executarAcaoTrigger(trigger: any, dadosEvento: any): Promise<void> {
    try {
      console.log(`[NotificationService] ⚡ Executando ação: ${trigger.tipo_acao}`);

      switch (trigger.tipo_acao) {
        case 'enviar_notificacao':
          await this.executarAcaoNotificacao(trigger, dadosEvento);
          break;

        case 'enviar_pdf':
          await this.executarAcaoPdf(trigger, dadosEvento);
          break;

        default:
          console.warn(`[NotificationService] ⚠️ Tipo de ação não implementada: ${trigger.tipo_acao}`);
      }

      // Atualiza estatísticas do trigger
      await supabase
        .from('triggers_automaticos')
        .update({
          execucoes: trigger.execucoes + 1,
          ultima_execucao: new Date().toISOString()
        })
        .eq('id', trigger.id);

      console.log(`[NotificationService] ✅ Trigger ${trigger.id} executado com sucesso`);
    } catch (error) {
      console.error(`[NotificationService] ❌ Erro ao executar ação do trigger:`, error);
      throw error;
    }
  }

  /**
   * Executa ação de enviar notificação
   */
  private async executarAcaoNotificacao(trigger: any, dadosEvento: any): Promise<void> {
    const params = trigger.parametros_acao;

    await this.criarNotificacao({
      usuarioId: trigger.usuario_id,
      ordemServicoId: dadosEvento.id,
      tipo: params.tipo || 'custom',
      destinatarioTelefone: params.destinatario_telefone || dadosEvento.usuario_telefone,
      destinatarioNome: params.destinatario_nome,
      titulo: params.titulo || 'Notificação Automática',
      mensagem: this.substituirVariaveis(params.mensagem, dadosEvento),
      dataAgendada: new Date(), // Envia imediatamente
      enviarPdf: params.enviar_pdf
    });
  }

  /**
   * Executa ação de enviar PDF
   */
  private async executarAcaoPdf(trigger: any, dadosEvento: any): Promise<void> {
    const params = trigger.parametros_acao;
    const telefone = (params.destinatario_telefone || dadosEvento.usuario_telefone);
    const telefoneFormatado = telefone.includes('@') 
      ? telefone 
      : `${telefone}@s.whatsapp.net`;

    await this.enviarPdfNotificacao(telefoneFormatado, dadosEvento.id);
  }

  /**
   * Substitui variáveis na mensagem
   */
  private substituirVariaveis(template: string, dados: any): string {
    let mensagem = template;

    // Substitui variáveis como {{numero_os}}, {{cliente_nome}}, etc
    for (const [chave, valor] of Object.entries(dados)) {
      const regex = new RegExp(`{{${chave}}}`, 'g');
      mensagem = mensagem.replace(regex, String(valor || ''));
    }

    return mensagem;
  }

  /**
   * Lista notificações pendentes de um usuário
   */
  async listarNotificacoesPendentes(usuarioId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('notificacoes_agendadas')
        .select('*')
        .eq('usuario_id', usuarioId)
        .eq('status', 'pendente')
        .order('enviar_em', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[NotificationService] ❌ Erro ao listar notificações:', error);
      return [];
    }
  }

  /**
   * Cancela uma notificação
   */
  async cancelarNotificacao(notificacaoId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notificacoes_agendadas')
        .update({ status: 'cancelada' })
        .eq('id', notificacaoId);

      if (error) throw error;

      console.log(`[NotificationService] ✅ Notificação ${notificacaoId} cancelada`);
      return true;
    } catch (error) {
      console.error('[NotificationService] ❌ Erro ao cancelar notificação:', error);
      return false;
    }
  }
}

