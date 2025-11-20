import { Buffer } from 'buffer';
import EvolutionService from '../services/EvolutionService.js';
import GeminiService from '../services/GeminiService.js';
import { OrderServiceService } from '../services/OrderServiceService.js';
import PDFService from '../services/PDFService.js';
import type {
  EvolutionMessage,
  OrderService,
  GeminiBalancePeriod,
  GeminiListRange
} from '../types/index.js';

/**
 * Handler para processar mensagens do WhatsApp
 * Responsável por interpretar mensagens e executar ações apropriadas
 */
export class WhatsAppHandler {
  constructor(
    private evolutionService: typeof EvolutionService,
    private geminiService: typeof GeminiService,
    private orderServiceService: OrderServiceService,
    private pdfService: typeof PDFService
  ) {}

  private conversationHistory: Map<string, { lastUserMessage?: string; lastBotMessage?: string }> = new Map();

  /**
   * Processa mensagem recebida do WhatsApp
   */
  async handleMessage(message: EvolutionMessage): Promise<void> {
    try {
      console.log('Mensagem recebida:', JSON.stringify(message, null, 2));
      
      const { key, message: msgData } = message;
      const from = key.remoteJid?.replace('@s.whatsapp.net', '') || key.participant?.replace('@s.whatsapp.net', '');
      
      console.log('Remetente extraído:', from);
      console.log('Flag fromMe:', key.fromMe, 'Tipo de dados disponíveis:', msgData ? Object.keys(msgData) : 'sem mensagem');
      
      if (!from) {
        console.log('Mensagem sem remetente válido');
        return;
      }

      // // Ignorar mensagens próprias
      // if (key.fromMe) {
      //   console.log('Ignorando mensagem própria para evitar loops');
      //   return;
      // }

      let text = '';
      let detectedMessageType = 'desconhecido';

      // Processar diferentes tipos de mensagem
      if (msgData?.conversation) {
        // Mensagem de texto simples
        text = msgData.conversation;
        detectedMessageType = 'conversation';
      } else if (msgData?.extendedTextMessage?.text) {
        // Mensagem de texto estendida
        text = msgData.extendedTextMessage.text;
        detectedMessageType = 'extendedTextMessage';
      } else if (msgData?.audioMessage) {
        detectedMessageType = 'audioMessage';
        await this.handleAudioMessage(from, msgData.audioMessage, message);
        return;
      } else {
        console.log('Tipo de mensagem não suportado:', Object.keys(msgData || {}));
        return;
      }

      console.log(`Conteúdo textual detectado (${detectedMessageType}):`, text);
      this.saveUserMessage(from, text);
      if (!text || text.trim().length === 0) {
        return;
      }

      // Processar mensagem do usuário
      console.log('Encaminhando texto para processamento do agente');
      await this.processUserMessage(from, text);

    } catch (error) {
      console.error('Erro ao processar mensagem:', error);
    }
  }

  /**
   * Processa mensagem do usuário
   */
  private async processUserMessage(from: string, text: string): Promise<void> {
    try {
      // Identificar tipo de consulta com Gemini
      console.log('Consultando GeminiService.processQuery com o texto recebido...');
      const queryResult = await this.geminiService.processQuery(text);
      const queryType = queryResult.type;
      const queryParams = queryResult.params || {};
      console.log('Intenção identificada pelo Gemini:', queryType, 'Parâmetros:', queryParams);

      switch (queryType) {
        case 'create_os':
          console.log('Fluxo selecionado: criar OS');
          await this.handleCreateOS(from, text);
          break;
        
        case 'list_os':
          console.log('Fluxo selecionado: listar OS');
          await this.handleListOS(from, this.normalizeListRange(queryParams.listRange), text);
          break;
        
        case 'status_os':
          console.log('Fluxo selecionado: status de OS');
          await this.handleStatusOS(from, text, queryParams.osId);
          break;

        case 'balance':
          console.log('Fluxo selecionado: saldo');
          await this.handleBalance(from, this.normalizeBalancePeriod(queryParams.balancePeriod));
          break;
        
        case 'help':
        default:
          console.log('Fluxo selecionado: ajuda (default)');
          await this.handleHelp(from);
          break;
      }
    } catch (error) {
      console.error('Erro ao processar mensagem do usuário:', error);
      await this.sendMessage(from, 'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.');
    }
  }

  /**
   * Cria uma nova OS
   */
  private async handleCreateOS(from: string, text: string): Promise<void> {
    try {
      console.log('HandleCreateOS iniciado. Texto recebido:', text);
      await this.sendMessage(from, 'Processando sua ordem de serviço...');

      // Extrair informações com Gemini
      console.log('Chamando GeminiService.processOSMessage para extrair dados estruturados...');
      const osData = await this.geminiService.processOSMessage(text);
      console.log('Dados estruturados retornados:', osData);

      if (!osData || !osData.total_amount) {
        await this.sendMessage(
          from, 
          'Não consegui identificar todas as informações necessárias. Por favor, inclua:\n' +
          '- Nome do cliente\n' +
          '- Serviços realizados\n' +
          '- Valor total'
        );
        return;
      }

      // Criar OS e gerar PDF
      console.log('Chamando OrderServiceService.createOS com os dados interpretados');
      const { os, pdfPath } = await this.orderServiceService.createOS({
        client_name: osData.client_name,
        client_phone: from,
        services: osData.services || [],
        total_amount: osData.total_amount,
        notes: osData.notes,
        status: 'pendente'
      });
      console.log('OS criada com sucesso:', os);
      console.log('PDF gerado em:', pdfPath);

      // Enviar confirmação
      await this.respondWithAI(
        from,
        'Informe ao usuário que a ordem de serviço foi criada com sucesso e mencione cliente, serviços principais e valor.',
        {
          client: os.client_name,
          total: os.total_amount,
          status: os.status,
          servicesPreview: os.services?.slice(0, 3) || [],
          osId: os.id
        },
        `✅ Ordem de Serviço #${os.id} criada com sucesso!\nCliente: ${os.client_name}\nTotal: R$ ${parseFloat(
          os.total_amount.toString()
        )
          .toFixed(2)
          .replace('.', ',')}\nStatus: ${os.status}`
      );

      // Enviar PDF
      console.log('Enviando PDF via EvolutionService.sendFile...');
      await this.evolutionService.sendFile(
        from,
        pdfPath,
        `Ordem de Serviço #${os.id} - ${os.client_name}`
      );

      // Limpar PDF temporário após alguns segundos
      setTimeout(() => {
        console.log('Removendo PDF temporário:', pdfPath);
        this.pdfService.deletePDF(pdfPath).catch(console.error);
      }, 60000); // 1 minuto

    } catch (error) {
      console.error('Erro ao criar OS:', error);
      await this.sendMessage(from, 'Erro ao criar ordem de serviço. Tente novamente.');
    }
  }

  /**
   * Lista OSs
   */
  private async handleListOS(from: string, scope: GeminiListRange = 'latest', originalText?: string): Promise<void> {
    try {
      let osList;
      let message = '';

      console.log('HandleListOS iniciado. Escopo recebido:', scope, 'Texto original:', originalText);
      switch (scope) {
        case 'day':
          osList = await this.orderServiceService.listOSByDay();
          message = '📋 Ordens de Serviço do Dia:\n\n';
          console.log('Listando OS do dia conforme instrução da IA');
          break;
        case 'month':
          osList = await this.orderServiceService.listOSByMonth();
          message = '📋 Ordens de Serviço do Mês:\n\n';
          console.log('Listando OS do mês conforme instrução da IA');
          break;
        default:
          osList = await this.orderServiceService.listOS({ limit: 10 });
          message = '📋 Últimas Ordens de Serviço:\n\n';
          console.log('Listando últimas OS (escopo padrão)');
          break;
      }

      console.log('Quantidade de OS retornadas:', osList.length);

      if (osList.length === 0) {
        await this.sendMessage(from, 'Nenhuma ordem de serviço encontrada.');
        return;
      }

      osList.forEach((os: OrderService) => {
        const services = os.services;
        const servicesText = services.length > 0 
          ? services.slice(0, 2).join(', ') + (services.length > 2 ? '...' : '')
          : 'Nenhum serviço especificado';

        message += `#${os.id} - ${os.client_name}\n`;
        message += `Serviços: ${servicesText}\n`;
        message += `Total: R$ ${parseFloat(os.total_amount.toString()).toFixed(2).replace('.', ',')}\n`;
        message += `Status: ${os.status}\n`;
        message += `Data: ${new Date(os.created_at).toLocaleDateString('pt-BR')}\n\n`;
      });

      await this.respondWithAI(
        from,
        'Resuma de forma amigável a lista de ordens de serviço solicitada pelo usuário.',
        { scope, osList },
        message
      );

    } catch (error) {
      console.error('Erro ao listar OSs:', error);
      await this.sendMessage(from, 'Erro ao consultar ordens de serviço.');
    }
  }

  /**
   * Verifica status de uma OS específica
   */
  private async handleStatusOS(from: string, text: string, osIdFromAI?: number): Promise<void> {
    try {
      console.log('HandleStatusOS iniciado. Texto recebido:', text, 'osId sugerido pela IA:', osIdFromAI);
      let osId = osIdFromAI;

      if (!osId) {
        // Fallback: tentar extrair número da mensagem manualmente
        const osIdMatch = text.match(/#?(\d+)/);
        if (osIdMatch) {
          osId = parseInt(osIdMatch[1]);
          console.log('ID inferido por fallback:', osId);
        }
      }

      if (!osId) {
        await this.sendMessage(from, 'Não consegui identificar o número da OS. Por favor, informe algo como "Status da OS #123".');
        return;
      }

      const os = await this.orderServiceService.getOSById(osId);

      if (!os) {
        await this.sendMessage(from, `Ordem de Serviço #${osId} não encontrada.`);
        return;
      }

      const services = os.services;

      let message = `📄 Ordem de Serviço #${os.id}\n\n`;
      message += `Cliente: ${os.client_name}\n`;
      message += `Status: ${os.status}\n`;
      message += `Data: ${new Date(os.created_at).toLocaleDateString('pt-BR')}\n\n`;
      message += `Serviços:\n`;
      services.forEach((service: string, index: number) => {
        message += `${index + 1}. ${service}\n`;
      });
      message += `\nTotal: R$ ${parseFloat(os.total_amount.toString()).toFixed(2).replace('.', ',')}\n`;

      if (os.notes) {
        message += `\nObservações: ${os.notes}\n`;
      }

      await this.respondWithAI(
        from,
        'Explique ao usuário o status atual da ordem de serviço solicitada.',
        { os },
        message
      );

    } catch (error) {
      console.error('Erro ao verificar status:', error);
      await this.sendMessage(from, 'Erro ao consultar status da OS.');
    }
  }

  /**
   * Mostra saldo
   */
  private async handleBalance(from: string, period: GeminiBalancePeriod = 'overall'): Promise<void> {
    try {
      console.log('HandleBalance iniciado. Período recebido:', period);

      let title = '';
      let total = 0;
      let osCount = 0;

      switch (period) {
        case 'day': {
          const list = await this.orderServiceService.listOSByDay();
          total = await this.orderServiceService.getDayBalance();
          osCount = list.length;
          title = '💰 Saldo do Dia';
          break;
        }
        case 'month': {
          const list = await this.orderServiceService.listOSByMonth();
          total = await this.orderServiceService.getMonthBalance();
          osCount = list.length;
          title = '💰 Saldo do Mês';
          break;
        }
        default: {
          const list = await this.orderServiceService.listOS({ limit: 100 });
          total = list.reduce((acc, os) => acc + Number(os.total_amount ?? 0), 0);
          osCount = list.length;
          title = '💰 Saldo Geral';
          break;
        }
      }

      let message = `${title}\n\n`;
      message += `Total: R$ ${total.toFixed(2).replace('.', ',')}\n`;
      message += `Quantidade de OSs: ${osCount}\n`;

      await this.respondWithAI(
        from,
        'Compartilhe o saldo solicitado pelo usuário de forma amigável.',
        { period, total, osCount },
        message
      );
    } catch (error) {
      console.error('Erro ao consultar saldo:', error);
      await this.sendMessage(from, 'Erro ao consultar saldo.');
    }
  }

  /**
   * Mostra ajuda
   */
  private async handleHelp(from: string): Promise<void> {
    await this.respondWithAI(
      from,
      'Explique de forma amigável como o usuário pode interagir com o assistente para criar ou consultar ordens de serviço.',
      {},
      'Posso criar novas OS, listar as existentes, informar status e saldos. Conte-me o que precisa!'
    );
  }

  /**
   * Envia mensagem via Evolution API
   */
  private async sendMessage(to: string, message: string): Promise<void> {
    try {
      console.log(`Enviando mensagem para ${to}:`, message.substring(0, 120));
      const result = await this.evolutionService.sendTextMessage(to, message);
      console.log('Mensagem enviada com sucesso:', {
        status: result?.status,
        messageId: result?.message?.id,
        to
      });
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    }
  }
  private saveUserMessage(from: string, text: string): void {
    const history = this.conversationHistory.get(from) || {};
    history.lastUserMessage = text;
    this.conversationHistory.set(from, history);
  }

  private saveBotMessage(from: string, text: string): void {
    const history = this.conversationHistory.get(from) || {};
    history.lastBotMessage = text;
    this.conversationHistory.set(from, history);
  }

  private async respondWithAI(from: string, context: string, data: any, fallback: string): Promise<void> {
    try {
      const history = this.conversationHistory.get(from);
      const enrichedContext = history?.lastUserMessage
        ? `${context}\nÚltima mensagem do usuário: "${history.lastUserMessage}"`
        : context;
      const response = await this.geminiService.generateResponse(enrichedContext, data);
      const message = response?.trim() || fallback;
      await this.sendMessage(from, message);
      this.saveBotMessage(from, message);
    } catch (error) {
      console.error('Erro ao gerar resposta conversacional:', error);
      await this.sendMessage(from, fallback);
      this.saveBotMessage(from, fallback);
    }
  }


  private async handleAudioMessage(from: string, audioMessage: any, originalMessage: EvolutionMessage): Promise<void> {
    try {
      await this.sendMessage(from, 'Processando áudio... Por favor, aguarde.');

      const mediaResponse = await this.evolutionService.downloadMedia(audioMessage, originalMessage?.key?.id || '');
      const { base64Data, mimeType } = this.extractAudioData(mediaResponse, audioMessage?.mimetype);

      if (!base64Data) {
        await this.sendMessage(from, 'Não consegui baixar seu áudio. Por favor, envie em texto.');
        return;
      }

      const transcription = await this.geminiService.transcribeAudio(base64Data, mimeType || 'audio/ogg');

      if (!transcription || transcription.trim().length === 0) {
        await this.sendMessage(from, 'Não consegui transcrever seu áudio. Por favor, envie em texto.');
        return;
      }

      console.log('Transcrição de áudio obtida:', transcription);
      await this.processUserMessage(from, transcription);
    } catch (error) {
      console.error('Erro ao processar áudio:', error);
      await this.sendMessage(from, 'Não consegui processar seu áudio. Por favor, tente novamente em texto.');
    }
  }

  private extractAudioData(mediaResponse: any, fallbackMimeType?: string): { base64Data?: string; mimeType?: string } {
    if (!mediaResponse) {
      return {};
    }

    if (typeof mediaResponse === 'string') {
      return { base64Data: this.stripBase64Prefix(mediaResponse), mimeType: fallbackMimeType };
    }

    if (typeof mediaResponse.base64 === 'string') {
      return {
        base64Data: this.stripBase64Prefix(mediaResponse.base64),
        mimeType: mediaResponse.mimeType || fallbackMimeType
      };
    }

    if (typeof mediaResponse.data === 'string') {
      return {
        base64Data: this.stripBase64Prefix(mediaResponse.data),
        mimeType: mediaResponse.mimeType || fallbackMimeType
      };
    }

    if (mediaResponse.data && Array.isArray(mediaResponse.data)) {
      return {
        base64Data: Buffer.from(mediaResponse.data).toString('base64'),
        mimeType: mediaResponse.mimeType || fallbackMimeType
      };
    }

    if (mediaResponse.data && mediaResponse.data.type === 'Buffer' && Array.isArray(mediaResponse.data.data)) {
      return {
        base64Data: Buffer.from(mediaResponse.data.data).toString('base64'),
        mimeType: mediaResponse.mimeType || fallbackMimeType
      };
    }

    if (Buffer.isBuffer(mediaResponse)) {
      return { base64Data: mediaResponse.toString('base64'), mimeType: fallbackMimeType };
    }

    return {};
  }

  private stripBase64Prefix(data: string): string {
    const commaIndex = data.indexOf(',');
    return commaIndex >= 0 ? data.slice(commaIndex + 1) : data;
  }

  private normalizeListRange(range?: GeminiListRange | string): GeminiListRange {
    if (!range) {
      return 'latest';
    }

    switch (range) {
      case 'day':
        return 'day';
      case 'month':
        return 'month';
      default:
        return 'latest';
    }
  }

  private normalizeBalancePeriod(period?: GeminiBalancePeriod | string): GeminiBalancePeriod {
    if (!period) {
      return 'overall';
    }

    if (period === 'day') {
      return 'day';
    }

    if (period === 'month') {
      return 'month';
    }

    return 'overall';
  }
}

