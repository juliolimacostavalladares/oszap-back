import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import type { OrderService } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Service para geração de PDFs
 * Responsável por criar documentos PDF das Ordens de Serviço
 */
export class PDFService {
  private tempDir: string;

  constructor() {
    this.tempDir = path.join(__dirname, '../../temp');
    // Garantir que o diretório temp existe
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Gera PDF da Ordem de Serviço
   */
  async generateOS(osData: OrderService): Promise<string> {
    const fileName = `OS_${osData.id}_${Date.now()}.pdf`;
    const filePath = path.join(this.tempDir, fileName);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50
      });

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Cabeçalho
      doc.fontSize(20)
         .font('Helvetica-Bold')
         .text('ORDEM DE SERVIÇO', { align: 'center' });

      doc.moveDown();
      doc.fontSize(12)
         .font('Helvetica')
         .text(`Nº: ${osData.id}`, { align: 'right' });

      doc.moveDown(2);

      // Informações do Cliente
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('DADOS DO CLIENTE');
      
      doc.fontSize(12)
         .font('Helvetica')
         .text(`Nome: ${osData.client_name || 'Não informado'}`);
      
      if (osData.client_phone) {
        doc.text(`Telefone: ${osData.client_phone}`);
      }

      doc.moveDown();

      // Data
      const createdDate = new Date(osData.created_at).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      doc.text(`Data: ${createdDate}`);

      doc.moveDown(2);

      // Serviços
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('SERVIÇOS REALIZADOS');

      doc.fontSize(12)
         .font('Helvetica');

      const services = osData.services;

      if (Array.isArray(services) && services.length > 0) {
        services.forEach((service, index) => {
          doc.text(`${index + 1}. ${service}`);
        });
      } else {
        doc.text('Nenhum serviço especificado');
      }

      doc.moveDown(2);

      // Total
      doc.fontSize(16)
         .font('Helvetica-Bold')
         .text(`TOTAL: R$ ${parseFloat(osData.total_amount.toString()).toFixed(2).replace('.', ',')}`, {
           align: 'right'
         });

      doc.moveDown(2);

      // Status
      doc.fontSize(12)
         .font('Helvetica')
         .text(`Status: ${osData.status.toUpperCase()}`);

      // Observações
      if (osData.notes) {
        doc.moveDown(2);
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text('OBSERVAÇÕES:');
        doc.font('Helvetica')
           .text(osData.notes);
      }

      // Rodapé
      doc.moveDown(4);
      doc.fontSize(10)
         .font('Helvetica')
         .text('Este documento foi gerado automaticamente pelo sistema OSZap.', {
           align: 'center'
         });

      doc.end();

      stream.on('finish', () => {
        resolve(filePath);
      });

      stream.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Remove arquivo PDF temporário
   */
  async deletePDF(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error('Erro ao deletar PDF:', error);
    }
  }
}

export default new PDFService();

