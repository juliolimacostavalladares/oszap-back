import OrderServiceRepository from '../repositories/OrderServiceRepository.js';
import PDFService from './PDFService.js';
import type { CreateOSDTO, OrderService, OSStatus } from '../types/index.js';

/**
 * Service de lógica de negócio para Ordens de Serviço
 * Contém a lógica de negócio que não pertence ao repository
 */
export class OrderServiceService {
  constructor(
    private repository: typeof OrderServiceRepository,
    private pdfService: typeof PDFService
  ) {}

  /**
   * Cria uma nova OS e gera o PDF
   */
  async createOS(data: CreateOSDTO): Promise<{ os: OrderService; pdfPath: string }> {
    // Criar OS no banco
    const os = await this.repository.create(data);

    // Gerar PDF
    const pdfPath = await this.pdfService.generateOS(os);

    // Atualizar caminho do PDF na OS
    await this.repository.updatePDFPath(os.id, pdfPath);

    return { os, pdfPath };
  }

  /**
   * Busca OS por ID
   */
  async getOSById(id: number): Promise<OrderService | null> {
    return await this.repository.findById(id);
  }

  /**
   * Lista OSs com filtros
   */
  async listOS(params: { status?: OSStatus; limit?: number; offset?: number }): Promise<OrderService[]> {
    if (params.status) {
      return await this.repository.findByStatus(params.status);
    }
    return await this.repository.findAll(params.limit || 50, params.offset || 0);
  }

  /**
   * Lista OSs do dia
   */
  async listOSByDay(date?: string): Promise<OrderService[]> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    return await this.repository.findByDate(targetDate);
  }

  /**
   * Lista OSs do mês
   */
  async listOSByMonth(): Promise<OrderService[]> {
    return await this.repository.findByCurrentMonth();
  }

  /**
   * Atualiza status da OS
   */
  async updateStatus(id: number, status: OSStatus): Promise<OrderService | null> {
    return await this.repository.updateStatus(id, status);
  }

  /**
   * Calcula saldo do dia
   */
  async getDayBalance(date?: string): Promise<number> {
    return await this.repository.getDayBalance(date);
  }

  /**
   * Calcula saldo do mês
   */
  async getMonthBalance(): Promise<number> {
    return await this.repository.getMonthBalance();
  }

  /**
   * Deleta uma OS e remove o PDF associado
   */
  async deleteOS(id: number): Promise<boolean> {
    const os = await this.repository.findById(id);
    if (os && os.pdf_path) {
      await this.pdfService.deletePDF(os.pdf_path);
    }
    return await this.repository.delete(id);
  }
}

