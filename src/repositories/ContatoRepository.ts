import { supabase } from '../config/supabase.js';

/**
 * Repository para gerenciar contatos salvos
 */
export class ContatoRepository {
  /**
   * Salva um novo contato ou atualiza se já existir
   */
  async salvarContato(data: {
    usuario_id: string;
    nome: string;
    telefone: string;
    email?: string;
    observacoes?: string;
    favorito?: boolean;
  }): Promise<any> {
    try {
      console.log('[ContatoRepo] Salvando contato:', data.nome, data.telefone);

      // Limpa o número (remove caracteres especiais)
      const telefone = data.telefone.replace(/\D/g, '');

      // Verifica se já existe
      const { data: existente } = await supabase
        .from('contatos')
        .select('*')
        .eq('usuario_id', data.usuario_id)
        .eq('telefone', telefone)
        .single();

      if (existente) {
        // Atualiza o contato existente
        console.log('[ContatoRepo] Contato já existe, atualizando...');
        const { data: updated, error } = await supabase
          .from('contatos')
          .update({
            nome: data.nome,
            email: data.email,
            observacoes: data.observacoes,
            favorito: data.favorito,
            atualizado_em: new Date().toISOString()
          })
          .eq('id', existente.id)
          .select()
          .single();

        if (error) throw error;
        console.log('[ContatoRepo] ✅ Contato atualizado:', updated.id);
        return updated;
      } else {
        // Cria novo contato
        const { data: created, error } = await supabase
          .from('contatos')
          .insert({
            usuario_id: data.usuario_id,
            nome: data.nome,
            telefone: telefone,
            email: data.email,
            observacoes: data.observacoes,
            favorito: data.favorito || false
          })
          .select()
          .single();

        if (error) throw error;
        console.log('[ContatoRepo] ✅ Contato criado:', created.id);
        return created;
      }
    } catch (error: any) {
      console.error('[ContatoRepo] Erro ao salvar contato:', error);
      throw error;
    }
  }

  /**
   * Lista todos os contatos de um usuário
   */
  async listarContatos(usuarioId: string, filtros?: {
    favoritos?: boolean;
    busca?: string;
  }): Promise<any[]> {
    try {
      let query = supabase
        .from('view_contatos_usuario')
        .select('*')
        .eq('usuario_id', usuarioId)
        .order('nome', { ascending: true });

      if (filtros?.favoritos) {
        query = query.eq('favorito', true);
      }

      if (filtros?.busca) {
        const busca = `%${filtros.busca}%`;
        query = query.or(`nome.ilike.${busca},telefone.ilike.${busca}`);
      }

      const { data, error } = await query;

      if (error) throw error;
      console.log(`[ContatoRepo] Encontrados ${data?.length || 0} contatos`);
      return data || [];
    } catch (error: any) {
      console.error('[ContatoRepo] Erro ao listar contatos:', error);
      throw error;
    }
  }

  /**
   * Busca um contato por nome (busca parcial)
   */
  async buscarContatoPorNome(usuarioId: string, nome: string): Promise<any[]> {
    try {
      console.log(`[ContatoRepo] Buscando contato: "${nome}"`);
      
      const busca = `%${nome}%`;
      const { data, error } = await supabase
        .from('contatos')
        .select('*')
        .eq('usuario_id', usuarioId)
        .ilike('nome', busca)
        .order('favorito', { ascending: false })
        .order('nome', { ascending: true });

      if (error) throw error;
      console.log(`[ContatoRepo] Encontrados ${data?.length || 0} contatos`);
      return data || [];
    } catch (error: any) {
      console.error('[ContatoRepo] Erro ao buscar contato:', error);
      throw error;
    }
  }

  /**
   * Busca um contato por telefone
   */
  async buscarContatoPorTelefone(usuarioId: string, telefone: string): Promise<any | null> {
    try {
      const telefoneLimpo = telefone.replace(/\D/g, '');
      
      const { data, error } = await supabase
        .from('contatos')
        .select('*')
        .eq('usuario_id', usuarioId)
        .eq('telefone', telefoneLimpo)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Não encontrado
        }
        throw error;
      }
      return data;
    } catch (error: any) {
      console.error('[ContatoRepo] Erro ao buscar contato por telefone:', error);
      throw error;
    }
  }

  /**
   * Busca um contato por ID
   */
  async buscarContatoPorId(id: number): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('contatos')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }
      return data;
    } catch (error: any) {
      console.error('[ContatoRepo] Erro ao buscar contato por ID:', error);
      throw error;
    }
  }

  /**
   * Marca/desmarca um contato como favorito
   */
  async marcarFavorito(id: number, favorito: boolean): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('contatos')
        .update({ favorito })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      console.log(`[ContatoRepo] Contato ${id} ${favorito ? 'marcado' : 'desmarcado'} como favorito`);
      return data;
    } catch (error: any) {
      console.error('[ContatoRepo] Erro ao marcar favorito:', error);
      throw error;
    }
  }

  /**
   * Deleta um contato
   */
  async deletarContato(id: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('contatos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      console.log(`[ContatoRepo] Contato ${id} deletado`);
      return true;
    } catch (error: any) {
      console.error('[ContatoRepo] Erro ao deletar contato:', error);
      return false;
    }
  }

  /**
   * Extrai e salva contatos únicos das ordens de serviço existentes
   * (útil para migração inicial)
   */
  async importarContatosDeOS(usuarioId: string): Promise<number> {
    try {
      console.log('[ContatoRepo] Importando contatos das OS...');
      
      // Busca todas as OS do usuário
      const { data: orders, error } = await supabase
        .from('ordens_servico')
        .select('cliente_nome, cliente_telefone')
        .eq('usuario_id', usuarioId)
        .not('cliente_nome', 'is', null)
        .not('cliente_telefone', 'is', null);

      if (error) throw error;

      if (!orders || orders.length === 0) {
        console.log('[ContatoRepo] Nenhuma OS encontrada para importar');
        return 0;
      }

      // Remove duplicados
      const contatosUnicos = new Map<string, any>();
      orders.forEach(os => {
        const telefone = os.cliente_telefone.replace(/\D/g, '');
        if (!contatosUnicos.has(telefone)) {
          contatosUnicos.set(telefone, {
            nome: os.cliente_nome,
            telefone: telefone
          });
        }
      });

      // Salva cada contato único
      let salvos = 0;
      for (const contato of contatosUnicos.values()) {
        try {
          await this.salvarContato({
            usuario_id: usuarioId,
            nome: contato.nome,
            telefone: contato.telefone,
            observacoes: 'Importado automaticamente das OS'
          });
          salvos++;
        } catch (error) {
          console.warn(`[ContatoRepo] Erro ao salvar ${contato.nome}:`, error);
        }
      }

      console.log(`[ContatoRepo] ✅ ${salvos} contatos importados`);
      return salvos;
    } catch (error: any) {
      console.error('[ContatoRepo] Erro ao importar contatos:', error);
      throw error;
    }
  }
}

