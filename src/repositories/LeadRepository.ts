import { supabase } from '../config/supabase.js';

/**
 * Repository para gerenciar leads da Landing Page
 */
export class LeadRepository {
  /**
   * Registra um novo lead ou atualiza se já existir
   */
  async registrarLead(data: {
    nome: string;
    email: string;
    telefone?: string;
    feedback?: string;
    origem?: string;
  }): Promise<any> {
    try {
      console.log('[LeadRepo] Registrando lead:', data.email);

      // Usa a função do banco de dados
      const { data: result, error } = await supabase
        .rpc('registrar_lead', {
          p_nome: data.nome,
          p_email: data.email,
          p_telefone: data.telefone || null,
          p_feedback: data.feedback || null,
          p_origem: data.origem || 'landing_page'
        });

      if (error) throw error;

      console.log('[LeadRepo] ✅ Lead registrado:', result);
      return result;
    } catch (error: any) {
      console.error('[LeadRepo] Erro ao registrar lead:', error);
      throw error;
    }
  }

  /**
   * Busca um lead por email
   */
  async buscarPorEmail(email: string): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('email', email)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Não encontrado
        }
        throw error;
      }
      return data;
    } catch (error: any) {
      console.error('[LeadRepo] Erro ao buscar lead:', error);
      throw error;
    }
  }

  /**
   * Busca um lead por telefone
   */
  async buscarPorTelefone(telefone: string): Promise<any | null> {
    try {
      const telefoneLimpo = telefone.replace(/\D/g, '');
      
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('telefone', telefoneLimpo)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }
      return data;
    } catch (error: any) {
      console.error('[LeadRepo] Erro ao buscar lead por telefone:', error);
      throw error;
    }
  }

  /**
   * Marca que a primeira mensagem foi enviada
   */
  async marcarMensagemEnviada(leadId: number): Promise<void> {
    try {
      const { error } = await supabase
        .from('leads')
        .update({
          primeira_mensagem_enviada: true,
          data_primeira_mensagem: new Date().toISOString(),
          status: 'contatado'
        })
        .eq('id', leadId);

      if (error) throw error;
      console.log(`[LeadRepo] ✅ Mensagem marcada como enviada para lead ${leadId}`);
    } catch (error: any) {
      console.error('[LeadRepo] Erro ao marcar mensagem enviada:', error);
      throw error;
    }
  }

  /**
   * Atualiza o status do lead
   */
  async atualizarStatus(leadId: number, novoStatus: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ status: novoStatus })
        .eq('id', leadId);

      if (error) throw error;
      console.log(`[LeadRepo] ✅ Status do lead ${leadId} atualizado para: ${novoStatus}`);
    } catch (error: any) {
      console.error('[LeadRepo] Erro ao atualizar status:', error);
      throw error;
    }
  }

  /**
   * Converte lead em usuário
   */
  async converterEmUsuario(leadId: number, usuarioId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('leads')
        .update({
          convertido_em_usuario: true,
          usuario_id: usuarioId,
          status: 'convertido'
        })
        .eq('id', leadId);

      if (error) throw error;
      console.log(`[LeadRepo] ✅ Lead ${leadId} convertido em usuário ${usuarioId}`);
    } catch (error: any) {
      console.error('[LeadRepo] Erro ao converter lead:', error);
      throw error;
    }
  }

  /**
   * Lista todos os leads (para admin)
   */
  async listarLeads(filtros?: {
    status?: string;
    limite?: number;
    offset?: number;
  }): Promise<any[]> {
    try {
      let query = supabase
        .from('leads')
        .select('*')
        .order('criado_em', { ascending: false });

      if (filtros?.status) {
        query = query.eq('status', filtros.status);
      }

      if (filtros?.limite) {
        query = query.limit(filtros.limite);
      }

      if (filtros?.offset) {
        query = query.range(filtros.offset, filtros.offset + (filtros.limite || 50) - 1);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('[LeadRepo] Erro ao listar leads:', error);
      throw error;
    }
  }

  /**
   * Obtém estatísticas dos leads
   */
  async obterEstatisticas(): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('view_estatisticas_leads')
        .select('*')
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('[LeadRepo] Erro ao obter estatísticas:', error);
      throw error;
    }
  }
}

