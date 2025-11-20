import supabase from '../config/supabase.js';
import type { OrderService, OSStatus, CreateOSDTO } from '../types/index.js';

/**
 * Repository Pattern para acesso a dados de Ordens de Serviço
 * Utiliza Supabase como banco de dados
 */
export class OrderServiceRepository {
  /**
   * Converte row do Supabase para entidade OrderService
   */
  private mapRowToEntity(row: any): OrderService {
    return {
      id: row.id,
      client_name: row.client_name,
      client_phone: row.client_phone,
      services: Array.isArray(row.services) ? row.services : [],
      total_amount: parseFloat(row.total_amount),
      status: row.status as OSStatus,
      created_at: row.created_at,
      updated_at: row.updated_at,
      notes: row.notes,
      pdf_path: row.pdf_path,
    };
  }

  /**
   * Cria uma nova Ordem de Serviço
   */
  async create(data: CreateOSDTO): Promise<OrderService> {
    const { client_name, client_phone, services, total_amount, notes, status = 'pendente' } = data;
    
    const { data: insertedData, error } = await supabase
      .from('orders_service')
      .insert({
        client_name: client_name || 'Cliente não informado',
        client_phone: client_phone || null,
        services: services,
        total_amount: total_amount,
        status: status,
        notes: notes || null
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar OS: ${error.message}`);
    }

    return this.mapRowToEntity(insertedData);
  }

  /**
   * Busca OS por ID
   */
  async findById(id: number): Promise<OrderService | null> {
    const { data, error } = await supabase
      .from('orders_service')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Não encontrado
      }
      throw new Error(`Erro ao buscar OS: ${error.message}`);
    }

    return data ? this.mapRowToEntity(data) : null;
  }

  /**
   * Lista todas as OSs
   */
  async findAll(limit: number = 50, offset: number = 0): Promise<OrderService[]> {
    const { data, error } = await supabase
      .from('orders_service')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Erro ao listar OSs: ${error.message}`);
    }

    return (data || []).map(row => this.mapRowToEntity(row));
  }

  /**
   * Busca OSs por status
   */
  async findByStatus(status: OSStatus): Promise<OrderService[]> {
    const { data, error } = await supabase
      .from('orders_service')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar OSs por status: ${error.message}`);
    }

    return (data || []).map(row => this.mapRowToEntity(row));
  }

  /**
   * Busca OSs por data (dia específico)
   */
  async findByDate(date: string): Promise<OrderService[]> {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('orders_service')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar OSs por data: ${error.message}`);
    }

    return (data || []).map(row => this.mapRowToEntity(row));
  }

  /**
   * Busca OSs do mês atual
   */
  async findByCurrentMonth(): Promise<OrderService[]> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const { data, error } = await supabase
      .from('orders_service')
      .select('*')
      .gte('created_at', startOfMonth.toISOString())
      .lte('created_at', endOfMonth.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar OSs do mês: ${error.message}`);
    }

    return (data || []).map(row => this.mapRowToEntity(row));
  }

  /**
   * Calcula saldo total do dia
   */
  async getDayBalance(date: string = new Date().toISOString().split('T')[0]): Promise<number> {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('orders_service')
      .select('total_amount')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (error) {
      throw new Error(`Erro ao calcular saldo do dia: ${error.message}`);
    }

    return (data || []).reduce((sum, row) => sum + parseFloat(row.total_amount), 0);
  }

  /**
   * Calcula saldo total do mês
   */
  async getMonthBalance(): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const { data, error } = await supabase
      .from('orders_service')
      .select('total_amount')
      .gte('created_at', startOfMonth.toISOString())
      .lte('created_at', endOfMonth.toISOString());

    if (error) {
      throw new Error(`Erro ao calcular saldo do mês: ${error.message}`);
    }

    return (data || []).reduce((sum, row) => sum + parseFloat(row.total_amount), 0);
  }

  /**
   * Atualiza status da OS
   */
  async updateStatus(id: number, status: OSStatus): Promise<OrderService | null> {
    const validStatuses: OSStatus[] = ['pendente', 'em_andamento', 'concluida'];
    if (!validStatuses.includes(status)) {
      throw new Error('Status inválido');
    }

    const { data, error } = await supabase
      .from('orders_service')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Não encontrado
      }
      throw new Error(`Erro ao atualizar status: ${error.message}`);
    }

    return data ? this.mapRowToEntity(data) : null;
  }

  /**
   * Atualiza caminho do PDF
   */
  async updatePDFPath(id: number, pdfPath: string): Promise<OrderService | null> {
    const { data, error } = await supabase
      .from('orders_service')
      .update({ pdf_path: pdfPath })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Não encontrado
      }
      throw new Error(`Erro ao atualizar PDF path: ${error.message}`);
    }

    return data ? this.mapRowToEntity(data) : null;
  }

  /**
   * Deleta uma OS
   */
  async delete(id: number): Promise<boolean> {
    const { error } = await supabase
      .from('orders_service')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Erro ao deletar OS: ${error.message}`);
    }

    return true;
  }
}

export default new OrderServiceRepository();
