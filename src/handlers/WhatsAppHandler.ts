import { AssistantOrchestrator } from '../services/AssistantOrchestrator.js';
import { EvolutionService } from '../services/EvolutionService.js';
import axios from 'axios';

/**
 * Handler Principal do WhatsApp
 * Processa mensagens e interage com o assistente IA
 */
export class WhatsAppHandler {
  private orchestrator: AssistantOrchestrator;
  private evolutionService: EvolutionService;

  constructor() {
    this.orchestrator = new AssistantOrchestrator();
    this.evolutionService = new EvolutionService();
  }

  /**
   * Processa mensagem recebida do WhatsApp
   */
  async handleMessage(data: any): Promise<void> {
    try {
      const { key, pushName, message, messageType } = data;
      
      // TEMPORÁRIO: Comentado para testes - descomentar em produção!
      // Em produção, deve ignorar mensagens próprias para evitar loops
      // if (key.fromMe) {
      //   console.log('[WhatsAppHandler] Mensagem própria ignorada');
      //   return;
      // }

      // Extrai informações
      const remoteJid = key.remoteJid;
      const messageId = key.id;
      const userName = pushName;
      const userPhone = this.extractPhoneNumber(remoteJid);

      // 📱 WHATSAPP BUSINESS: Aceita mensagens de QUALQUER cliente
      // Todos os clientes podem conversar com o assistente automaticamente
      console.log(`[WhatsAppHandler] 📨 Nova mensagem de ${userName} (${userPhone})`);
      console.log(`[WhatsAppHandler] Tipo: ${messageType}`);

      // Envia indicador de "digitando..."
      await this.sendTypingIndicator(remoteJid, true);

      let response: any;

      try {
        // Processa baseado no tipo de mensagem
        switch (messageType) {
          case 'conversation':
          case 'extendedTextMessage':
            response = await this.handleTextMessage(
              message.conversation || message.extendedTextMessage?.text || '',
              userPhone,
              remoteJid,
              userName
            );
            break;

          case 'audioMessage':
            response = await this.handleAudioMessage(
              message,
              userPhone,
              remoteJid,
              userName
            );
            break;

          case 'imageMessage':
            response = await this.handleImageMessage(
              message.imageMessage,
              userPhone,
              remoteJid,
              userName
            );
            break;

          case 'documentMessage':
            response = await this.handleDocumentMessage(
              message.documentMessage,
              userPhone,
              remoteJid,
              userName
            );
            break;

          case 'buttonsResponseMessage':
          case 'listResponseMessage':
            response = await this.handleInteractiveResponse(
              message,
              messageType,
              userPhone,
              remoteJid,
              userName
            );
            break;

          default:
            console.log(`[WhatsAppHandler] Tipo de mensagem não suportado: ${messageType}`);
            response = {
              response: '😔 Desculpe, não consigo processar este tipo de mensagem ainda.\n\nPor favor, envie uma mensagem de texto ou áudio.'
            };
        }

        // Para de "digitar"
        await this.sendTypingIndicator(remoteJid, false);

        // Envia resposta
        await this.sendResponse(remoteJid, response);

      } catch (error) {
        // Para de "digitar" em caso de erro
        await this.sendTypingIndicator(remoteJid, false);
        throw error;
      }

    } catch (error: any) {
      console.error('[WhatsAppHandler] Erro ao processar mensagem:', error);
    }
  }

  /**
   * Processa mensagem de texto
   */
  private async handleTextMessage(
    text: string,
    userPhone: string,
    remoteJid: string,
    userName?: string
  ): Promise<any> {
    return await this.orchestrator.processUserMessage(
      text,
      userPhone,
      remoteJid,
      userName
    );
  }

  /**
   * Processa mensagem de áudio
   */
  private async handleAudioMessage(
    message: any,
    userPhone: string,
    remoteJid: string,
    userName?: string
  ): Promise<any> {
    try {
      console.log('[WhatsAppHandler] Processando áudio...');

      // Verifica se o WhatsApp já enviou a transcrição
      // A transcrição vem em message.speechToText, não em message.audioMessage.speechToText
      const speechToText = message.speechToText || message.text;
      
      if (speechToText) {
        console.log('[WhatsAppHandler] ✅ Usando transcrição do WhatsApp:', speechToText);
        
        // Processa a transcrição direto como texto
        return await this.orchestrator.processUserMessage(
          speechToText,
          userPhone,
          remoteJid,
          userName
        );
      }

      // Se não tem transcrição, processa o áudio
      const audioMessage = message.audioMessage;
      const mimeType = audioMessage.mimetype || 'audio/ogg; codecs=opus';
      let audioBuffer: Buffer;

      // Prioriza usar o base64 se estiver disponível (mais eficiente)
      if (audioMessage.base64) {
        console.log('[WhatsAppHandler] 📦 Usando áudio em base64 da mensagem');
        audioBuffer = Buffer.from(audioMessage.base64, 'base64');
      } else if (message.message?.audioMessage?.base64) {
        console.log('[WhatsAppHandler] 📦 Usando áudio em base64 de message.message');
        audioBuffer = Buffer.from(message.message.audioMessage.base64, 'base64');
      } else if (audioMessage.url) {
        // Fallback: baixa da URL se não tiver base64
        console.log('[WhatsAppHandler] 🌐 Baixando áudio da URL...');
        const audioResponse = await axios.get(audioMessage.url, { responseType: 'arraybuffer' });
        audioBuffer = Buffer.from(audioResponse.data);
      } else {
        throw new Error('Áudio não encontrado (sem base64 nem URL)');
      }

      console.log(`[WhatsAppHandler] 🎤 Áudio carregado: ${audioBuffer.length} bytes`);

      // Processa o áudio (será convertido de OGG/Opus para MP3)
      return await this.orchestrator.processAudio(
        audioBuffer,
        mimeType,
        userPhone,
        remoteJid,
        userName
      );

    } catch (error: any) {
      console.error('[WhatsAppHandler] Erro ao processar áudio:', error);
      return {
        response: '😔 Não consegui processar o áudio. Por favor, tente novamente ou envie uma mensagem de texto.'
      };
    }
  }

  /**
   * Processa mensagem de imagem
   */
  private async handleImageMessage(
    imageMessage: any,
    userPhone: string,
    remoteJid: string,
    userName?: string
  ): Promise<any> {
    try {
      const caption = imageMessage.caption || 'Analise esta imagem';
      
      // TODO: Implementar análise de imagem com Vision API
      // Por enquanto, responde que está em desenvolvimento

      return {
        response: '📸 Recebi sua imagem!\n\nPor enquanto, só consigo processar mensagens de texto e áudio. A análise de imagens será implementada em breve.'
      };

    } catch (error: any) {
      console.error('[WhatsAppHandler] Erro ao processar imagem:', error);
      return {
        response: '😔 Não consegui processar a imagem. Por favor, tente descrever em texto o que precisa.'
      };
    }
  }

  /**
   * Processa mensagem de documento
   */
  private async handleDocumentMessage(
    documentMessage: any,
    userPhone: string,
    remoteJid: string,
    userName?: string
  ): Promise<any> {
    return {
      response: '📄 Recebi seu documento!\n\nPor enquanto, só consigo processar mensagens de texto e áudio. O processamento de documentos será implementado em breve.'
    };
  }

  /**
   * Processa respostas interativas (botões e listas)
   */
  private async handleInteractiveResponse(
    message: any,
    messageType: string,
    userPhone: string,
    remoteJid: string,
    userName?: string
  ): Promise<any> {
    try {
      let selectedId: string;
      let selectedTitle: string;

      if (messageType === 'buttonsResponseMessage') {
        selectedId = message.buttonsResponseMessage.selectedButtonId;
        selectedTitle = message.buttonsResponseMessage.selectedDisplayText;
      } else if (messageType === 'listResponseMessage') {
        selectedId = message.listResponseMessage.singleSelectReply.selectedRowId;
        selectedTitle = message.listResponseMessage.title;
      } else {
        throw new Error('Tipo de resposta interativa não suportado');
      }

      console.log(`[WhatsAppHandler] Resposta interativa: ${selectedId} (${selectedTitle})`);

      // Processa a seleção como texto
      const text = selectedTitle || selectedId;
      return await this.handleTextMessage(text, userPhone, remoteJid, userName);

    } catch (error: any) {
      console.error('[WhatsAppHandler] Erro ao processar resposta interativa:', error);
      return {
        response: '😔 Não consegui processar sua seleção. Por favor, tente novamente.'
      };
    }
  }

  /**
   * Envia resposta para o usuário
   */
  private async sendResponse(remoteJid: string, response: any): Promise<void> {
    try {
      // Se tem mídia (PDF, imagem, etc)
      if (response.mediaUrl) {
        await this.sendMediaMessage(remoteJid, response);
      }

      // Se tem botões
      if (response.buttons) {
        await this.sendButtonMessage(remoteJid, response);
        return;
      }

      // Se tem lista
      if (response.list) {
        await this.sendListMessage(remoteJid, response);
        return;
      }

      // Mensagem de texto simples
      if (response.response) {
        await this.sendTextMessage(remoteJid, response.response);
      }

    } catch (error: any) {
      console.error('[WhatsAppHandler] Erro ao enviar resposta:', error);
      
      // Tenta enviar mensagem de erro simples
      try {
        await this.sendTextMessage(
          remoteJid,
          '😔 Desculpe, ocorreu um erro ao enviar a resposta. Por favor, tente novamente.'
        );
      } catch (fallbackError) {
        console.error('[WhatsAppHandler] Erro ao enviar mensagem de fallback:', fallbackError);
      }
    }
  }

  /**
   * Envia mensagem de texto simples
   */
  private async sendTextMessage(remoteJid: string, text: string): Promise<void> {
    // ✅ Permite envio para qualquer número (quando solicitado pelo usuário autorizado)
    await this.evolutionService.sendTextMessage(remoteJid, text);
    console.log('[WhatsAppHandler] Mensagem de texto enviada');
  }

  /**
   * Envia mensagem com botões
   */
  private async sendButtonMessage(remoteJid: string, data: any): Promise<void> {
    // ✅ Permite envio para qualquer número (quando solicitado pelo usuário autorizado)
    // TODO: Implementar envio de botões quando Evolution API suportar
    // Por enquanto, envia como texto
    await this.sendTextMessage(remoteJid, data.response);
    console.log('[WhatsAppHandler] Botões ainda não suportados, enviado como texto');
  }

  /**
   * Envia mensagem com lista
   */
  private async sendListMessage(remoteJid: string, data: any): Promise<void> {
    // ✅ Permite envio para qualquer número (quando solicitado pelo usuário autorizado)
    // TODO: Implementar envio de listas quando Evolution API suportar
    // Por enquanto, envia como texto
    await this.sendTextMessage(remoteJid, data.response);
    console.log('[WhatsAppHandler] Listas ainda não suportadas, enviado como texto');
  }

  /**
   * Envia mensagem com mídia (PDF, imagem, etc)
   */
  private async sendMediaMessage(remoteJid: string, data: any): Promise<void> {
    // ✅ Permite envio para qualquer número (quando solicitado pelo usuário autorizado)
    try {
      if (data.mediaType === 'document') {
        // Envia documento/PDF
        await this.evolutionService.sendMedia({
          number: remoteJid,
          mediatype: 'document',
          media: data.mediaUrl,
          fileName: data.fileName || 'documento.pdf',
          caption: data.response || ''
        });
        console.log('[WhatsAppHandler] Documento enviado');
      } else if (data.mediaType === 'image') {
        // Envia imagem
        await this.evolutionService.sendMedia({
          number: remoteJid,
          mediatype: 'image',
          media: data.mediaUrl,
          caption: data.response || ''
        });
        console.log('[WhatsAppHandler] Imagem enviada');
      }
    } catch (error: any) {
      console.error('[WhatsAppHandler] Erro ao enviar mídia:', error);
      // Fallback: envia só o texto
      if (data.response) {
        await this.sendTextMessage(remoteJid, data.response);
      }
    }
  }

  /**
   * Envia indicador de digitação
   */
  private async sendTypingIndicator(_remoteJid: string, _isTyping: boolean): Promise<void> {
    // ⚠️ Funcionalidade desabilitada: endpoint setPresence não disponível na Evolution API
    // O indicador "digitando..." não é crítico para o funcionamento
    return;
    
    // 🔒 SEGURANÇA: Valida número antes de enviar presença
    // const phoneNumber = this.extractPhoneNumber(remoteJid);
    // const NUMERO_AUTORIZADO = '5522992531720';
    // 
    // if (phoneNumber !== NUMERO_AUTORIZADO) {
    //   return; // Silenciosamente ignora
    // }
    // 
    // try {
    //   await this.evolutionService.setPresence({
    //     number: remoteJid,
    //     presence: isTyping ? 'composing' : 'available'
    //   });
    // } catch (error) {
    //   // Ignora erros de presença
    //   console.log('[WhatsAppHandler] Erro ao definir presença (ignorado)');
    // }
  }

  /**
   * Extrai número de telefone do JID
   */
  private extractPhoneNumber(remoteJid: string): string {
    return remoteJid.split('@')[0];
  }

  /**
   * Processa atualização de status de conexão
   */
  async handleConnectionUpdate(data: any): Promise<void> {
    console.log('[WhatsAppHandler] Atualização de conexão:', data);
  }

  /**
   * Limpa histórico de conversa de um usuário
   */
  clearUserHistory(userPhone: string, chatId: string): void {
    this.orchestrator.clearConversationHistory(userPhone, chatId);
  }
}

