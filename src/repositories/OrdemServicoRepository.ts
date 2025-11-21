import { supabase } from '../config/supabase.js';

/**
 * Repositório para gerenciar Ordens de Serviço no Supabase
 */
export class OrdemServicoRepository {

  /**
   * Cria ou obtém usuário pelo telefone
   */
  async getOrCreateUser(telefone: string, nome?: string): Promise<any> {
    try {
      // Busca usuário existente
      const { data: existingUser, error: searchError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('telefone', telefone)
        .single();

      if (existingUser && !searchError) {
        // Atualiza nome se fornecido e diferente
        if (nome && existingUser.nome !== nome) {
          const { data: updated } = await supabase
            .from('usuarios')
            .update({ nome, atualizado_em: new Date().toISOString() })
            .eq('id', existingUser.id)
            .select()
            .single();
          
          return updated || existingUser;
        }
        return existingUser;
      }

      // Cria novo usuário
      const { data: newUser, error: createError } = await supabase
        .from('usuarios')
        .insert({
          telefone,
          nome: nome || telefone
        })
        .select()
        .single();

      if (createError) throw createError;
      return newUser;

    } catch (error) {
      console.error('[OrdemServicoRepo] Erro ao obter/criar usuário:', error);
      throw error;
    }
  }

  /**
   * Cria uma nova ordem de serviço
   */
  async createOrdemServico(data: {
    usuario_id: string;
    cliente_nome: string;
    cliente_telefone?: string;
    cliente_email?: string;
    cliente_endereco?: string;
    titulo: string;
    descricao: string;
    categoria?: string;
    prioridade?: 'baixa' | 'normal' | 'alta' | 'urgente';
    valor_estimado?: number;
    data_previsao?: string;
  }): Promise<any> {
    try {
      const { data: os, error } = await supabase
        .from('ordens_servico')
        .insert({
          ...data,
          status: 'aberta',
          data_abertura: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      console.log('[OrdemServicoRepo] OS criada:', os.numero_os);
      return os;

    } catch (error) {
      console.error('[OrdemServicoRepo] Erro ao criar OS:', error);
      throw error;
    }
  }

  /**
   * Busca ordem de serviço por ID
   */
  async getOrdemServicoById(id: number): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('ordens_servico')
        .select(`
          *,
          usuario:usuarios(id, nome, telefone),
          pecas:pecas_os(*),
          historico:historico_os(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;

    } catch (error: any) {
      if (error.code === 'PGRST116') {
        return null; // Não encontrado
      }
      console.error('[OrdemServicoRepo] Erro ao buscar OS por ID:', error);
      throw error;
    }
  }

  /**
   * Busca ordem de serviço por número
   */
  async getOrdemServicoByNumero(numeroOS: string): Promise<any> {
    try {
      const { data, error} = await supabase
        .from('ordens_servico')
        .select(`
          *,
          usuario:usuarios(id, nome, telefone),
          pecas:pecas_os(*),
          historico:historico_os(*)
        `)
        .eq('numero_os', numeroOS)
        .single();

      if (error) throw error;
      return data;

    } catch (error: any) {
      if (error.code === 'PGRST116') {
        return null; // Não encontrado
      }
      console.error('[OrdemServicoRepo] Erro ao buscar OS:', error);
      throw error;
    }
  }

  /**
   * Busca ordens de serviço com filtros
   */
  async getOrdensServico(filters: {
    usuario_id?: string;
    status?: string;
    periodo_dias?: number;
    limite?: number;
  }): Promise<any[]> {
    try {
      let query = supabase
        .from('ordens_servico')
        .select('*')
        .order('data_abertura', { ascending: false });

      if (filters.usuario_id) {
        query = query.eq('usuario_id', filters.usuario_id);
      }

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.periodo_dias) {
        const dataLimite = new Date();
        dataLimite.setDate(dataLimite.getDate() - filters.periodo_dias);
        query = query.gte('data_abertura', dataLimite.toISOString());
      }

      if (filters.limite) {
        query = query.limit(filters.limite);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];

    } catch (error) {
      console.error('[OrdemServicoRepo] Erro ao buscar OS:', error);
      throw error;
    }
  }

  /**
   * Atualiza status da ordem de serviço
   */
  async updateStatus(
    numeroOS: string,
    novoStatus: string,
    observacao?: string
  ): Promise<any> {
    try {
      // Busca OS atual
      const osAtual = await this.getOrdemServicoByNumero(numeroOS);
      if (!osAtual) {
        throw new Error('Ordem de serviço não encontrada');
      }

      // Prepara atualização
      const updateData: any = {
        status: novoStatus,
        atualizado_em: new Date().toISOString()
      };

      // Se concluindo, adiciona data de conclusão
      if (novoStatus === 'concluida') {
        updateData.data_conclusao = new Date().toISOString();
      }

      // Se tem observação, adiciona
      if (observacao) {
        updateData.observacoes = observacao;
      }

      const { data, error } = await supabase
        .from('ordens_servico')
        .update(updateData)
        .eq('numero_os', numeroOS)
        .select()
        .single();

      if (error) throw error;

      // Registra no histórico
      await this.addHistorico(osAtual.id, {
        tipo_evento: 'mudanca_status',
        descricao: `Status alterado de ${osAtual.status} para ${novoStatus}`,
        dados_anteriores: { status: osAtual.status },
        dados_novos: { status: novoStatus }
      });

      return data;

    } catch (error) {
      console.error('[OrdemServicoRepo] Erro ao atualizar status:', error);
      throw error;
    }
  }

  /**
   * Atualiza dados da ordem de serviço
   */
  async updateOrdemServico(
    numeroOS: string,
    updates: {
      tecnico_responsavel?: string;
      valor_estimado?: number;
      valor_final?: number;
      valor_pecas?: number;
      valor_mao_obra?: number;
      data_previsao?: string;
      observacoes?: string;
    }
  ): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('ordens_servico')
        .update({
          ...updates,
          atualizado_em: new Date().toISOString()
        })
        .eq('numero_os', numeroOS)
        .select()
        .single();

      if (error) throw error;
      return data;

    } catch (error) {
      console.error('[OrdemServicoRepo] Erro ao atualizar OS:', error);
      throw error;
    }
  }

  /**
   * Adiciona peças à ordem de serviço
   */
  async addPecas(
    numeroOS: string,
    pecas: Array<{
      descricao: string;
      codigo?: string;
      quantidade: number;
      valor_unitario: number;
    }>
  ): Promise<any[]> {
    try {
      // Busca OS
      const os = await this.getOrdemServicoByNumero(numeroOS);
      if (!os) {
        throw new Error('Ordem de serviço não encontrada');
      }

      // Insere peças
      const pecasComOS = pecas.map(peca => ({
        ...peca,
        ordem_servico_id: os.id
      }));

      const { data, error } = await supabase
        .from('pecas_os')
        .insert(pecasComOS)
        .select();

      if (error) throw error;

      // Atualiza valor total de peças na OS
      const totalPecas = pecas.reduce(
        (sum, peca) => sum + (peca.quantidade * peca.valor_unitario),
        0
      );

      await this.updateOrdemServico(numeroOS, {
        valor_pecas: (os.valor_pecas || 0) + totalPecas
      });

      return data || [];

    } catch (error) {
      console.error('[OrdemServicoRepo] Erro ao adicionar peças:', error);
      throw error;
    }
  }

  /**
   * Busca ordens de serviço por termo de busca
   */
  async searchOrdensServico(
    termo: string,
    usuarioId?: string,
    limite: number = 10
  ): Promise<any[]> {
    try {
      let query = supabase
        .from('ordens_servico')
        .select('*')
        .or(`cliente_nome.ilike.%${termo}%,titulo.ilike.%${termo}%,descricao.ilike.%${termo}%,numero_os.ilike.%${termo}%`)
        .order('data_abertura', { ascending: false })
        .limit(limite);

      if (usuarioId) {
        query = query.eq('usuario_id', usuarioId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];

    } catch (error) {
      console.error('[OrdemServicoRepo] Erro ao buscar OS:', error);
      throw error;
    }
  }

  /**
   * Obtém estatísticas do usuário
   */
  async getStatistics(usuarioId: string, _periodoDias: number = 30): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('view_estatisticas_usuario')
        .select('*')
        .eq('id', usuarioId)
        .single();

      if (error) throw error;
      return data;

    } catch (error) {
      console.error('[OrdemServicoRepo] Erro ao buscar estatísticas:', error);
      throw error;
    }
  }

  /**
   * Adiciona entrada no histórico
   */
  private async addHistorico(
    ordemServicoId: number,
    data: {
      tipo_evento: string;
      descricao: string;
      dados_anteriores?: any;
      dados_novos?: any;
      usuario_id?: string;
    }
  ): Promise<void> {
    try {
      await supabase
        .from('historico_os')
        .insert({
          ordem_servico_id: ordemServicoId,
          ...data
        });
    } catch (error) {
      console.error('[OrdemServicoRepo] Erro ao adicionar histórico:', error);
    }
  }

  /**
   * Obtém ou cria conversa do WhatsApp
   */
  async getOrCreateConversation(
    usuarioId: string,
    chatId: string,
    remoteJid: string
  ): Promise<any> {
    try {
      // Busca conversa existente
      const { data: existing, error: searchError } = await supabase
        .from('conversas_whatsapp')
        .select('*')
        .eq('usuario_id', usuarioId)
        .eq('chat_id', chatId)
        .single();

      if (existing && !searchError) {
        return existing;
      }

      // Cria nova conversa
      const { data: newConv, error: createError } = await supabase
        .from('conversas_whatsapp')
        .insert({
          usuario_id: usuarioId,
          chat_id: chatId,
          remote_jid: remoteJid
        })
        .select()
        .single();

      if (createError) throw createError;
      return newConv;

    } catch (error) {
      console.error('[OrdemServicoRepo] Erro ao obter/criar conversa:', error);
      throw error;
    }
  }

  /**
   * Atualiza contexto da conversa
   */
  async updateConversationContext(
    conversaId: string,
    contexto: any,
    ultimaIntencao?: string
  ): Promise<void> {
    try {
      await supabase
        .from('conversas_whatsapp')
        .update({
          contexto_atual: contexto,
          ultima_intencao: ultimaIntencao,
          ultima_mensagem_em: new Date().toISOString(),
          atualizado_em: new Date().toISOString()
        })
        .eq('id', conversaId);
    } catch (error) {
      console.error('[OrdemServicoRepo] Erro ao atualizar contexto:', error);
    }
  }

  /**
   * Salva mensagem no histórico
   */
  async saveMessage(
    conversaId: string,
    messageId: string,
    tipo: string,
    conteudo: string,
    fromMe: boolean,
    metadata?: any
  ): Promise<void> {
    try {
      await supabase
        .from('mensagens_whatsapp')
        .insert({
          conversa_id: conversaId,
          message_id: messageId,
          tipo_mensagem: tipo,
          conteudo_texto: conteudo,
          from_me: fromMe,
          metadata: metadata || {}
        });

      // Incrementa contador de mensagens
      await supabase.rpc('increment_message_count', { conversation_id: conversaId });
    } catch (error) {
      console.error('[OrdemServicoRepo] Erro ao salvar mensagem:', error);
    }
  }

  /**
   * Recupera mensagens recentes de uma conversa
   */
  async getRecentMessages(conversaId: string, limit: number = 10): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('mensagens_whatsapp')
        .select('*')
        .eq('conversa_id', conversaId)
        .order('criado_em', { ascending: false })
        .limit(limit);

      if (error) throw error;
      
      // Retorna em ordem cronológica (mais antiga primeiro)
      return (data || []).reverse().map(msg => ({
        content: msg.conteudo_texto,
        is_from_bot: msg.from_me,
        timestamp: msg.criado_em
      }));
    } catch (error) {
      console.error('[OrdemServicoRepo] Erro ao buscar mensagens recentes:', error);
      return [];
    }
  }
}

