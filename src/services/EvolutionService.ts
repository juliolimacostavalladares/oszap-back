import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import type { EvolutionSendMessageResponse, SendButtonsOptions } from '../types/index.js';

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
   * Envia mensagem com botões interativos
   */
  async sendButtonsMessage(number: string, options: SendButtonsOptions): Promise<EvolutionSendMessageResponse> {
    try {
      console.log('[EvolutionService] Enviando mensagem com botões', { number, buttons: options.buttons.length });
      
      // Formato para Evolution API v2 - mensagem interativa com botões
      const buttons = options.buttons.map((btn) => ({
        buttonId: btn.id,
        buttonText: {
          displayText: btn.displayText
        },
        type: 1 // Tipo 1 = botão de resposta rápida (REQUIRED)
      }));

      // Tentar diferentes formatos e endpoints
      const formats = [
        // Formato 1: sendButtons com estrutura completa
        {
          endpoint: `/message/sendButtons/${this.instanceName}`,
          payload: {
            number,
            text: options.text,
            buttons: buttons,
            footerText: options.footer || ''
          }
        },
        // Formato 2: sendButton (singular) com estrutura alternativa
        {
          endpoint: `/message/sendButton/${this.instanceName}`,
          payload: {
            number,
            text: options.text,
            buttons: buttons,
            footer: options.footer || ''
          }
        },
        // Formato 3: sendText com formato interativo
        {
          endpoint: `/message/sendText/${this.instanceName}`,
          payload: {
            number,
            text: options.text,
            buttons: buttons,
            footerText: options.footer || ''
          }
        }
      ];

      let lastError: any = null;
      for (const format of formats) {
        try {
          console.log(`[EvolutionService] Tentando endpoint: ${format.endpoint}`);
          const response = await this.client.post(format.endpoint, format.payload);
          console.log('[EvolutionService] Sucesso! Resposta:', response.status, response.data?.status);
          return response.data;
        } catch (error: any) {
          lastError = error;
          const errorMsg = error.response?.data?.response?.message || error.response?.data?.message;
          console.log(`[EvolutionService] Falhou: ${error.response?.status} - ${errorMsg || error.message}`);
          // Continuar para o próximo formato
        }
      }

      // Se todos falharam, lançar o último erro
      throw lastError || new Error('Todos os formatos falharam');
    } catch (error: any) {
      const errorDetails = error.response?.data;
      const errorMessages = errorDetails?.response?.message;
      console.error('Erro ao enviar mensagem com botões:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        error: errorDetails?.error,
        messages: Array.isArray(errorMessages) ? errorMessages : [errorMessages || errorDetails?.message || error.message],
        fullResponse: errorDetails
      });
      throw error;
    }
  }

  /**
   * Envia mídia (imagem, documento, etc) por URL
   */
  async sendMedia(params: { number: string; mediatype: string; media: string; fileName?: string; caption?: string }): Promise<EvolutionSendMessageResponse> {
    try {
      console.log('[EvolutionService] 📤 Enviando mídia', {
        number: params.number,
        mediatype: params.mediatype,
        fileName: params.fileName,
        caption: params.caption,
        mediaSize: params.media.length,
        instance: this.instanceName,
        baseURL: this.baseURL
      });

      const response = await this.client.post(`/message/sendMedia/${this.instanceName}`, {
        number: params.number,
        mediatype: params.mediatype,
        media: params.media,
        fileName: params.fileName,
        caption: params.caption
      });

      console.log('[EvolutionService] ✅ Mídia enviada com sucesso!', {
        status: response.status,
        data: response.data
      });

      return response.data;
    } catch (error: any) {
      console.error('[EvolutionService] ❌ Erro ao enviar mídia:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      throw error;
    }
  }

  /**
   * Define presença (digitando, online, etc)
   */
  async setPresence(params: { number: string; presence: string }): Promise<any> {
    try {
      const response = await this.client.post(`/chat/setPresence/${this.instanceName}`, {
        number: params.number,
        presence: params.presence,
        delay: 1000
      });
      return response.data;
    } catch (error: any) {
      console.error('Erro ao definir presença:', error.response?.data || error.message);
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
   * Busca contatos do WhatsApp
   */
  async fetchContacts(): Promise<any[]> {
    try {
      console.log('[EvolutionService] Buscando contatos...');
      const response = await this.client.get(`/chat/fetchContacts/${this.instanceName}`);
      console.log('[EvolutionService] Contatos obtidos:', response.data?.length || 0);
      return response.data || [];
    } catch (error: any) {
      console.error('Erro ao buscar contatos:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Busca um contato específico por nome
   */
  async searchContact(searchTerm: string): Promise<any[]> {
    try {
      console.log(`[EvolutionService] Buscando contato: "${searchTerm}"`);
      
      const contacts = await this.fetchContacts();
      
      if (!contacts || contacts.length === 0) {
        console.log('[EvolutionService] Nenhum contato encontrado');
        return [];
      }

      // Filtra contatos que correspondem ao termo de busca
      const searchLower = searchTerm.toLowerCase().trim();
      const matches = contacts.filter((contact: any) => {
        const name = (contact.name || contact.pushName || contact.verifiedName || '').toLowerCase();
        const number = (contact.id || '').replace(/\D/g, '');
        
        return name.includes(searchLower) || 
               number.includes(searchLower) ||
               searchLower.includes(name.split(' ')[0]); // Match primeiro nome
      });

      console.log(`[EvolutionService] Encontrados ${matches.length} contato(s)`);
      
      return matches.map((contact: any) => ({
        nome: contact.name || contact.pushName || contact.verifiedName || 'Sem nome',
        telefone: contact.id,
        foto: contact.profilePicUrl
      }));
    } catch (error: any) {
      console.error('Erro ao buscar contato:', error.response?.data || error.message);
      return [];
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

