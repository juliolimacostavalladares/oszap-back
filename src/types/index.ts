/**
 * Tipos e interfaces principais da aplicação
 */

export type OSStatus = 'pendente' | 'em_andamento' | 'concluida';

export interface OrderService {
  id: number;
  client_name: string;
  client_phone: string | null;
  services: string[];
  total_amount: number;
  status: OSStatus;
  created_at: string;
  updated_at: string;
  notes: string | null;
  pdf_path: string | null;
}

export interface CreateOSDTO {
  client_name: string;
  client_phone?: string;
  services: string[];
  total_amount: number;
  notes?: string;
  status?: OSStatus;
}

export interface UpdateOSStatusDTO {
  status: OSStatus;
}

export interface OSQueryParams {
  status?: OSStatus;
  limit?: number;
  offset?: number;
}

export interface BalanceQueryParams {
  period?: 'day' | 'month';
}

// Evolution API Types
export interface EvolutionMessage {
  key: {
    remoteJid?: string;
    fromMe?: boolean;
    id?: string;
    participant?: string;
  };
  message: {
    conversation?: string;
    extendedTextMessage?: {
      text: string;
    };
    audioMessage?: {
      url?: string;
      mimetype?: string;
    };
    [key: string]: any;
  };
}

export interface EvolutionWebhookPayload {
  event: string;
  data: {
    messages?: EvolutionMessage[];
    [key: string]: any;
  };
}

export interface EvolutionSendMessageResponse {
  success: boolean;
  [key: string]: any;
}

// Gemini Types
export interface GeminiOSData {
  client_name: string;
  services: string[];
  total_amount: number | null;
  notes?: string;
}

export type GeminiQueryType = 'create_os' | 'list_os' | 'status_os' | 'balance' | 'help';

export type GeminiListRange = 'day' | 'month' | 'latest';

export type GeminiBalancePeriod = 'day' | 'month' | 'overall';

export interface GeminiQueryParams {
  listRange?: GeminiListRange;
  osId?: number;
  balancePeriod?: GeminiBalancePeriod;
}

export interface GeminiQueryResult {
  type: GeminiQueryType;
  params?: GeminiQueryParams;
  rawText?: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface BalanceResponse {
  success: boolean;
  balance: number;
}

// Database Types
export interface OrderServiceRow {
  id: number;
  client_name: string;
  client_phone: string | null;
  services: string;
  total_amount: number;
  status: string;
  created_at: string;
  updated_at: string;
  notes: string | null;
  pdf_path: string | null;
}

