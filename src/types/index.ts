// =====================================================
// TIPOS PARA ORDENS DE SERVIÇO
// =====================================================

export interface Usuario {
  id: string;
  telefone: string;
  nome?: string;
  email?: string;
  avatar_url?: string;
  preferencias?: Record<string, any>;
  criado_em: string;
  atualizado_em: string;
}

export interface OrdemServico {
  id: number;
  numero_os: string;
  usuario_id: string;
  
  // Cliente
  cliente_nome: string;
  cliente_telefone?: string;
  cliente_email?: string;
  cliente_endereco?: string;
  
  // Serviço
  titulo: string;
  descricao: string;
  categoria?: string;
  prioridade: 'baixa' | 'normal' | 'alta' | 'urgente';
  
  // Status
  status: 'aberta' | 'em_andamento' | 'aguardando_pecas' | 'concluida' | 'cancelada';
  tecnico_responsavel?: string;
  
  // Valores
  valor_estimado?: number;
  valor_final?: number;
  valor_pecas?: number;
  valor_mao_obra?: number;
  
  // Datas
  data_abertura: string;
  data_previsao?: string;
  data_conclusao?: string;
  
  // Extras
  pdf_url?: string;
  observacoes?: string;
  metadata?: Record<string, any>;
  
  criado_em: string;
  atualizado_em: string;
}

export interface PecaOS {
  id: string;
  ordem_servico_id: number;
  descricao: string;
  codigo?: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  criado_em: string;
}

export interface HistoricoOS {
  id: string;
  ordem_servico_id: number;
  usuario_id?: string;
  tipo_evento: 'criacao' | 'atualizacao' | 'mudanca_status' | 'comentario';
  descricao: string;
  dados_anteriores?: Record<string, any>;
  dados_novos?: Record<string, any>;
  criado_em: string;
}

// =====================================================
// TIPOS PARA CONVERSAS WHATSAPP
// =====================================================

export interface ConversaWhatsApp {
  id: string;
  usuario_id: string;
  chat_id: string;
  remote_jid: string;
  
  // OpenAI
  openai_thread_id?: string;
  openai_assistant_id?: string;
  
  // Contexto
  contexto_atual?: Record<string, any>;
  ultima_intencao?: string;
  aguardando_resposta: boolean;
  
  // Stats
  total_mensagens: number;
  ultima_mensagem_em?: string;
  
  criado_em: string;
  atualizado_em: string;
}

export interface MensagemWhatsApp {
  id: string;
  conversa_id: string;
  message_id: string;
  from_me: boolean;
  
  // Conteúdo
  tipo_mensagem: 'text' | 'audio' | 'image' | 'document' | 'interactive' | 'video' | 'sticker';
  conteudo_texto?: string;
  conteudo_transcrito?: string;
  media_url?: string;
  
  // Metadados
  metadata?: Record<string, any>;
  processado: boolean;
  erro?: string;
  
  criado_em: string;
}

export interface TemplateMensagem {
  id: string;
  codigo: string;
  nome: string;
  categoria?: string;
  tipo: 'text' | 'buttons' | 'list' | 'template';
  conteudo: Record<string, any>;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

// =====================================================
// TIPOS PARA WHATSAPP/EVOLUTION API
// =====================================================

export interface WhatsAppMessage {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
    participant?: string;
  };
  pushName?: string;
  message: any;
  messageType: string;
  messageTimestamp: number;
  instanceId: string;
  source?: string;
}

export interface SendTextParams {
  number: string;
  text: string;
  delay?: number;
  linkPreview?: boolean;
}

export interface SendMediaParams {
  number: string;
  mediatype: 'image' | 'video' | 'audio' | 'document';
  media: string; // URL ou base64
  fileName?: string;
  caption?: string;
  delay?: number;
}

export interface SendButtonsParams {
  number: string;
  title: string;
  description?: string;
  footer?: string;
  buttons: Array<{
    id: string;
    text: string;
  }>;
}

export interface SendListParams {
  number: string;
  title: string;
  description?: string;
  buttonText: string;
  footerText?: string;
  sections: Array<{
    title: string;
    rows: Array<{
      title: string;
      description?: string;
      rowId: string;
    }>;
  }>;
}

export interface SetPresenceParams {
  number: string;
  presence: 'available' | 'unavailable' | 'composing' | 'recording' | 'paused';
  delay?: number;
}

// =====================================================
// TIPOS PARA EVOLUTION API
// =====================================================

export interface EvolutionAPIConfig {
  baseURL: string;
  apiKey: string;
  instanceName: string;
}

export interface InstanceInfo {
  instance: {
    instanceName: string;
    instanceId: string;
    status: string;
  };
  hash?: {
    apikey: string;
  };
}

export interface ConnectionState {
  instance: string;
  state: 'open' | 'connecting' | 'close';
}

// =====================================================
// TIPOS PARA OPENAI
// =====================================================

export interface OpenAIFunctionCall {
  name: string;
  arguments: string;
}

export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: OpenAIFunctionCall;
}

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

export interface OpenAICompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: OpenAIMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// =====================================================
// TIPOS LEGADOS (mantidos para compatibilidade)
// =====================================================

export interface OpenAIEvolutionConfig {
  apiKey: string;
  name: string;
  baseURL?: string;
}

export interface OpenAIBotConfig {
  enabled: boolean;
  description?: string;
  model?: string;
  systemMessage?: string;
  assistantId?: string;
  functionUrl?: string;
}

export interface OpenAISessionStatus {
  sessionId: string;
  status: string;
}

// =====================================================
// TIPOS PARA SERVIÇOS
// =====================================================

export interface AssistantResponse {
  response: string;
  mediaUrl?: string;
  mediaType?: 'document' | 'image' | 'video';
  fileName?: string;
  buttons?: any;
  list?: any;
}

export interface FunctionExecutionResult {
  toolCallId: string;
  result: any;
}

// =====================================================
// TIPOS PARA ESTATÍSTICAS
// =====================================================

export interface EstatisticasUsuario {
  id: string;
  nome?: string;
  telefone: string;
  total_os: number;
  os_abertas: number;
  os_em_andamento: number;
  os_concluidas: number;
  valor_total_servicos: number;
  ultima_os?: string;
}

// =====================================================
// TIPOS PARA FILTROS
// =====================================================

export interface FiltrosOrdemServico {
  usuario_id?: string;
  status?: OrdemServico['status'];
  periodo_dias?: number;
  limite?: number;
  categoria?: string;
  prioridade?: OrdemServico['prioridade'];
}

export interface FiltrosBusca {
  termo_busca: string;
  usuario_id?: string;
  limite?: number;
}

// =====================================================
// TIPOS PARA WEBHOOKS
// =====================================================

export interface WebhookPayload {
  event: string;
  instance: string;
  data: any;
  destination?: string;
  date_time?: string;
  sender?: string;
  server_url?: string;
  apikey?: string;
}

export interface WebhookEvent {
  type: 'messages.upsert' | 'messages.update' | 'connection.update' | 'qrcode.updated' | 
        'chats.update' | 'chats.upsert' | 'contacts.update' | 'contacts.upsert' | 
        'presence.update' | 'groups.update' | 'groups.upsert';
  data: any;
  timestamp: string;
}

// =====================================================
// TIPOS PARA ERROS
// =====================================================

export interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
  details?: any;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

// =====================================================
// TIPOS UTILITÁRIOS
// =====================================================

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type AsyncResult<T> = Promise<T>;

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}
