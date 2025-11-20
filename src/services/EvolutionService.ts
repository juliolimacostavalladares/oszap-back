import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import type { EvolutionSendMessageResponse } from '../types/index.js';

/**
 * Service para integração com Evolution API
 * Responsável por todas as comunicações com a API do WhatsApp
 */
export class EvolutionService {
  private client: AxiosInstance;
  private baseURL: string;
  private apiKey: string;
  private instanceName: string;

  constructor() {
    this.baseURL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
    this.apiKey = process.env.EVOLUTION_API_KEY || '';
    this.instanceName = process.env.INSTANCE_NAME || 'OSZap';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'apikey': this.apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 segundos de timeout
    });
  }

  /**
   * Envia mensagem de texto
   */
  async sendTextMessage(number: string, message: string): Promise<EvolutionSendMessageResponse> {
    try {
      console.log('[EvolutionService] Enviando texto', { number, instance: this.instanceName, baseURL: this.baseURL });
      const response = await this.client.post(`/message/sendText/${this.instanceName}`, {
        number,
        text: message
      });
      console.log('[EvolutionService] Resposta sendText:', response.status, response.data?.status);
      return response.data;
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Evolution API não está rodando. Verifique se está acessível em ' + this.baseURL);
      }
      console.error('Erro ao enviar mensagem:', {
        status: error.response?.status,
        data: error.response?.data || error.message
      });
      throw error;
    }
  }

  /**
   * Envia arquivo (PDF)
   */
  async sendFile(number: string, filePath: string, caption: string = ''): Promise<EvolutionSendMessageResponse> {
    try {
      console.log('[EvolutionService] Enviando arquivo', { number, filePath, caption });
      const form = new FormData();
      form.append('number', number);
      form.append('media', fs.createReadStream(filePath));
      form.append('caption', caption);

      const response = await axios.post(
        `${this.baseURL}/message/sendMedia/${this.instanceName}`,
        form,
        {
          headers: {
            ...form.getHeaders(),
            'apikey': this.apiKey
          }
        }
      );
      console.log('[EvolutionService] Resposta sendFile:', response.status, response.data?.status);
      return response.data;
    } catch (error: any) {
      console.error('Erro ao enviar arquivo:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Baixa mídia (áudio, imagem, etc)
   */
  async downloadMedia(mediaKey: any, messageId: string): Promise<any> {
    try {
      const response = await this.client.get(`/chat/fetchMedia/${this.instanceName}`, {
        params: {
          message: JSON.stringify({
            key: { id: messageId },
            message: { [mediaKey.type]: { mediaKey } }
          })
        }
      });
      return response.data;
    } catch (error: any) {
      console.error('Erro ao baixar mídia:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Verifica status da instância
   */
  async getInstanceStatus(): Promise<any> {
    try {
      const response = await this.client.get(`/instance/fetchInstances`);
      return response.data;
    } catch (error: any) {
      console.error('Erro ao verificar status:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Cria ou obtém instância
   */
  async createInstance(): Promise<any> {
    try {
      const response = await this.client.post(`/instance/create`, {
        instanceName: this.instanceName,
        token: this.apiKey,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS'
      });
      return response.data;
    } catch (error: any) {
      console.error('Erro ao criar instância:', error.response?.data || error.message);
      throw error;
    }
  }
}

export default new EvolutionService();

