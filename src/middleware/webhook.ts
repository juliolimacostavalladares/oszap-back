import { Request, Response } from 'express';
import type { EvolutionMessage } from '../types/index.js';
import type { WhatsAppHandler } from '../handlers/WhatsAppHandler.js';

interface WebhookResponse {
  received: boolean;
  message?: string;
}

interface NormalizedWebhookPayload {
  event: string;
  instance?: string | null;
  data: any;
  rawBody: Record<string, any>;
  requestPath: string;
}

/**
 * Middleware para processar webhooks do Evolution API
 * Reescrito para lidar com múltiplos formatos de eventos e validar chamadas.
 */
export class WebhookHandler {
  private readonly whatsappHandler: WhatsAppHandler;
  private readonly expectedApiKey?: string;

  constructor(whatsappHandler: WhatsAppHandler) {
    this.whatsappHandler = whatsappHandler;
    this.expectedApiKey = process.env.EVOLUTION_API_KEY || process.env.AUTHENTICATION_API_KEY;
  }

  /**
   * Ponto de entrada do webhook
   */
  handle = async (req: Request, res: Response<WebhookResponse>): Promise<void> => {
    const requestId = this.generateRequestId();
    const payload = this.normalizePayload(req);

    try {
      this.validateApiKey(req, payload);
    } catch (error: any) {
      console.warn(`[Webhook][${requestId}] Requisição rejeitada: ${error.message}`);
      res.status(401).json({ received: false, message: 'Não autorizado' });
      return;
    }

    if (!payload.event) {
      console.warn(`[Webhook][${requestId}] Evento não informado`);
      res.status(400).json({ received: false, message: 'Evento não informado' });
      return;
    }

    this.logIncomingPayload(requestId, payload, req);

    try {
      await this.dispatchEvent(payload, requestId);
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error(`[Webhook][${requestId}] Erro ao processar evento ${payload.event}:`, error);
      res.status(500).json({ received: false, message: 'Erro interno ao processar webhook' });
    }
  };

  /**
   * Encaminha evento para o handler apropriado
   */
  private async dispatchEvent(payload: NormalizedWebhookPayload, requestId: string): Promise<void> {
    const event = payload.event;

    switch (event) {
      case 'messages.upsert':
        await this.handleMessagesUpsert(payload, requestId);
        break;

      case 'messages.update':
        this.handleMessagesUpdate(payload, requestId);
        break;

      case 'chats.upsert':
        this.handleChatsUpsert(payload, requestId);
        break;

      case 'chats.update':
        this.handleChatsUpdate(payload, requestId);
        break;

      case 'connection.update':
        this.handleConnectionUpdate(payload, requestId);
        break;

      case 'remove.instance':
        this.handleInstanceRemoval(payload, requestId);
        break;

      default:
        this.handleUnknownEvent(payload, requestId);
        break;
    }
  }

  /**
   * Processa mensagens recebidas (messages.upsert)
   */
  private async handleMessagesUpsert(payload: NormalizedWebhookPayload, requestId: string): Promise<void> {
    const messages = this.extractMessages(payload.data);

    if (messages.length === 0) {
      console.log(`[Webhook][${requestId}] Nenhuma mensagem válida encontrada para processamento.`);
      return;
    }

    console.log(`[Webhook][${requestId}] Processando ${messages.length} mensagem(ns).`);

    for (const message of messages) {
      try {
        console.log(
          `[Webhook][${requestId}] Encaminhando mensagem ${message?.key?.id || 'sem-id'} para WhatsAppHandler`
        );
        await this.whatsappHandler.handleMessage(message);
      } catch (error: any) {
        console.error(`[Webhook][${requestId}] Erro ao processar mensagem ${message?.key?.id}:`, error);
      }
    }
  }

  /**
   * Registra atualizações de mensagens (status, ACK, etc)
   */
  private handleMessagesUpdate(payload: NormalizedWebhookPayload, requestId: string): void {
    const updates = Array.isArray(payload.data) ? payload.data : [payload.data];
    console.log(`[Webhook][${requestId}] Atualizações de mensagem recebidas: ${updates.length}`);
    updates.forEach((update, index) => {
      console.log(`[Webhook][${requestId}] Update #${index + 1}:`, JSON.stringify(update, null, 2));
    });
  }

  /**
   * Registra novos chats (chats.upsert)
   */
  private handleChatsUpsert(payload: NormalizedWebhookPayload, requestId: string): void {
    const chats = Array.isArray(payload.data) ? payload.data : [payload.data];
    console.log(`[Webhook][${requestId}] Chats adicionados/atualizados: ${chats.length}`);
  }

  private handleChatsUpdate(payload: NormalizedWebhookPayload, requestId: string): void {
    const chats = Array.isArray(payload.data) ? payload.data : [payload.data];
    console.log(`[Webhook][${requestId}] Atualizações de chat recebidas: ${chats.length}`);
  }

  private handleConnectionUpdate(payload: NormalizedWebhookPayload, requestId: string): void {
    console.log(`[Webhook][${requestId}] Status da conexão atualizado:`, JSON.stringify(payload.data, null, 2));
  }

  private handleInstanceRemoval(payload: NormalizedWebhookPayload, requestId: string): void {
    console.warn(`[Webhook][${requestId}] Instância removida:`, JSON.stringify(payload.data, null, 2));
  }

  private handleUnknownEvent(payload: NormalizedWebhookPayload, requestId: string): void {
    console.log(`[Webhook][${requestId}] Evento não tratado (${payload.event}). Dados:`, JSON.stringify(payload.data, null, 2));
  }

  /**
   * Extração de mensagens independente do formato do Evolution
   */
  private extractMessages(data: any): EvolutionMessage[] {
    if (!data) {
      return [];
    }

    if (Array.isArray(data.messages)) {
      return data.messages as EvolutionMessage[];
    }

    if (Array.isArray(data)) {
      return data as EvolutionMessage[];
    }

    if (data.message || data.key) {
      return [data as EvolutionMessage];
    }

    if (data.data) {
      return this.extractMessages(data.data);
    }

    return [];
  }

  /**
   * Normaliza payload recebido
   */
  private normalizePayload(req: Request): NormalizedWebhookPayload {
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
    const bodyEvent = typeof body.event === 'string' ? body.event : '';
    const pathEvent = this.extractEventFromPath(req.path);
    const event = this.normalizeEventName(bodyEvent || pathEvent || '');

    const data = this.normalizeData(body);
    const instance =
      body.instance ||
      body.instanceName ||
      data?.instance ||
      data?.instanceId ||
      data?.instanceName ||
      null;

    return {
      event,
      instance,
      data,
      rawBody: body,
      requestPath: req.path
    };
  }

  private normalizeData(body: Record<string, any>): any {
    if (body.data) {
      return body.data;
    }

    if (body.payload) {
      return body.payload;
    }

    return body;
  }

  private extractEventFromPath(pathname: string): string {
    if (!pathname || pathname === '/' || pathname === '') {
      return '';
    }

    const cleanPath = pathname.replace(/^\//, '');
    return cleanPath;
  }

  private normalizeEventName(eventRaw: string): string {
    if (!eventRaw) {
      return '';
    }

    const sanitized = eventRaw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/\.+/g, '.')
      .replace(/^\./, '')
      .replace(/\.$/, '');

    return sanitized;
  }

  /**
   * Valida a apiKey enviada pela Evolution
   */
  private validateApiKey(req: Request, payload: NormalizedWebhookPayload): void {
    if (!this.expectedApiKey) {
      return;
    }

    const headerKey =
      (req.headers['x-evolution-apikey'] as string) ||
      (req.headers['x-api-key'] as string) ||
      (req.headers['apikey'] as string) ||
      this.extractBearerToken(req.headers['authorization']);

    const payloadKey = payload.rawBody?.apikey || payload.rawBody?.apiKey;

    const providedKey = (headerKey || payloadKey || '').trim();

    if (!providedKey || providedKey !== this.expectedApiKey) {
      throw new Error('apiKey inválida ou ausente');
    }
  }

  private extractBearerToken(authorizationHeader?: string): string | undefined {
    if (!authorizationHeader) {
      return undefined;
    }

    const [scheme, token] = authorizationHeader.split(' ');
    if (!token) {
      return undefined;
    }

    return scheme.toLowerCase() === 'bearer' ? token : undefined;
  }

  private generateRequestId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
  }

  private logIncomingPayload(requestId: string, payload: NormalizedWebhookPayload, req: Request): void {
    console.log('======================== WEBHOOK ========================');
    console.log(`[Webhook][${requestId}] Evento: ${payload.event || 'desconhecido'}`);
    console.log(`[Webhook][${requestId}] Instância: ${payload.instance || 'não informada'}`);
    console.log(`[Webhook][${requestId}] Path: ${payload.requestPath}`);
    console.log(`[Webhook][${requestId}] Headers relevantes:`, {
      'x-evolution-apikey': req.headers['x-evolution-apikey'],
      apikey: req.headers['apikey']
    });
    console.log(`[Webhook][${requestId}] Body:`, JSON.stringify(payload.rawBody, null, 2));
    console.log('=========================================================');
  }
}
