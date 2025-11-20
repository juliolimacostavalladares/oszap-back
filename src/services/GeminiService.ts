import { GoogleGenAI } from '@google/genai';
import type {
  GeminiBalancePeriod,
  GeminiListRange,
  GeminiOSData,
  GeminiQueryResult,
  GeminiQueryType
} from '../types/index.js';

/**
 * Service para integração com Google Gemini
 * Responsável por processamento de linguagem natural e extração de dados
 */
export class GeminiService {
  private genAI: GoogleGenAI;
  private readonly modelName = 'gemini-2.5-flash';

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY não configurada no .env');
    }
    
    this.genAI = new GoogleGenAI({ apiKey });
  }

  /**
   * Processa texto e extrai informações da OS
   */
  async processOSMessage(text: string): Promise<GeminiOSData> {
    const prompt = `
Você é um analista experiente processando solicitações de ordens de serviço. Sua função é extrair informações de forma precisa e organizada.

Analise a mensagem abaixo e extraia os dados no formato JSON especificado:

{
  "client_name": "nome do cliente",
  "services": ["serviço 1", "serviço 2"],
  "total_amount": valor numérico,
  "notes": "observações adicionais"
}

Diretrizes de extração:
- Identifique o nome do cliente mencionado na mensagem. Se não houver menção, utilize "Cliente não informado"
- Liste todos os serviços mencionados de forma clara e objetiva. Se não houver serviços, retorne array vazio
- Extraia o valor total em formato numérico decimal (ex: 500.00). Se não houver valor, retorne null
- Capture qualquer observação, prazo ou detalhe adicional relevante no campo notes
- Responda exclusivamente com o JSON válido, sem marcações ou explicações

Mensagem: ${text}
`;

    try {
      const result = await this.genAI.models.generateContent({
        model: this.modelName,
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ]
      });

      const rawJson = this.extractJson(result.text || '{}');
      const parsed = JSON.parse(rawJson);

      const normalized: GeminiOSData = {
        client_name: typeof parsed.client_name === 'string' ? parsed.client_name : 'Cliente não informado',
        services: Array.isArray(parsed.services) ? parsed.services : [],
        total_amount: typeof parsed.total_amount === 'number' ? parsed.total_amount : null,
        notes: typeof parsed.notes === 'string' && parsed.notes.length > 0 ? parsed.notes : undefined
      };

      return normalized;
    } catch (error) {
      console.error('Erro ao processar mensagem com Gemini:', error);
      throw error;
    }
  }

  /**
   * Processa consulta do usuário
   */
  async processQuery(query: string): Promise<GeminiQueryResult> {
    const prompt = `
Você é um analista especializado em interpretar solicitações relacionadas a ordens de serviço. Identifique a intenção do usuário e os parâmetros necessários.

Analise a solicitação e retorne um JSON estruturado com o tipo de ação e parâmetros relevantes.

Estrutura esperada:
- "type": tipo da ação solicitada
- "params": parâmetros específicos da ação

Tipos de ação disponíveis:
- create_os: criar nova ordem de serviço
- list_os: listar ordens de serviço existentes
- status_os: consultar status de ordem específica
- balance: consultar saldos e totalizações
- help: solicitar orientações de uso

Parâmetros opcionais:
- "listRange": escopo da listagem ("day" para hoje, "month" para mês atual, "latest" para últimas)
- "osId": número da ordem de serviço específica
- "balancePeriod": período do saldo ("day", "month" ou "overall")

Se não houver parâmetros adicionais, retorne "params" como objeto vazio.
Responda apenas com o JSON válido, sem marcações de código.

Solicitação: ${query}

Exemplo:
{
  "type": "list_os",
  "params": {
    "listRange": "day"
  }
}
`;

    const defaultResult: GeminiQueryResult = {
      type: 'help',
      params: {},
      rawText: ''
    };

    try {
      const result = await this.genAI.models.generateContent({
        model: this.modelName,
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ]
      });
      const textResponse = this.extractJson(result.text || '').trim();
      defaultResult.rawText = textResponse;

      const parsed = JSON.parse(textResponse || '{}');
      const type = typeof parsed.type === 'string' ? parsed.type.toLowerCase() : 'help';
      const params = typeof parsed.params === 'object' && parsed.params !== null ? parsed.params : {};

      const validTypes: GeminiQueryType[] = ['create_os', 'list_os', 'status_os', 'balance', 'help'];
      const normalizedType = validTypes.includes(type as GeminiQueryType) ? (type as GeminiQueryType) : 'help';

      const normalizedParams = this.cleanParams({
        listRange: this.normalizeListRange(params.listRange || params.scope || params.interval),
        osId: this.parseOsId(params.osId ?? params.osNumber ?? params.id),
        balancePeriod: this.normalizeBalancePeriod(params.balancePeriod || params.period)
      });

      return {
        type: normalizedType,
        params: normalizedParams,
        rawText: textResponse
      };
    } catch (error) {
      console.error('Erro ao processar consulta:', error);
      return defaultResult;
    }
  }

  private normalizeListRange(value?: any): GeminiListRange {
    if (typeof value !== 'string') {
      return 'latest';
    }

    const normalized = value.toLowerCase();
    if (normalized.includes('day') || normalized.includes('dia')) {
      return 'day';
    }
    if (normalized.includes('month') || normalized.includes('mes')) {
      return 'month';
    }
    return 'latest';
  }

  private normalizeBalancePeriod(value?: any): GeminiBalancePeriod | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.toLowerCase();
    if (normalized.includes('day') || normalized.includes('dia') || normalized === 'daily') {
      return 'day';
    }
    if (normalized.includes('month') || normalized.includes('mes') || normalized === 'monthly') {
      return 'month';
    }
    if (normalized.includes('overall') || normalized.includes('geral') || normalized.includes('total')) {
      return 'overall';
    }
    return undefined;
  }

  private parseOsId(value?: any): number | undefined {
    if (typeof value === 'number' && !Number.isNaN(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const match = value.match(/\d+/);
      if (match) {
        const parsed = parseInt(match[0], 10);
        if (!Number.isNaN(parsed)) {
          return parsed;
        }
      }
    }

    return undefined;
  }

  private cleanParams(params: {
    listRange?: GeminiListRange;
    osId?: number;
    balancePeriod?: GeminiBalancePeriod;
  }): GeminiQueryResult['params'] {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== null)
    );

    return Object.keys(cleaned).length > 0 ? (cleaned as GeminiQueryResult['params']) : {};
  }

  private extractJson(raw: string): string {
    if (!raw) {
      return '{}';
    }

    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (match && match[1]) {
      return match[1];
    }

    return raw;
  }

  /**
   * Converte áudio para texto (usando transcrição se disponível)
   */
  async transcribeAudio(base64Audio: string, mimeType: string): Promise<string> {
    try {
      const result = await this.genAI.models.generateContent({
        model: this.modelName,
        contents: [
          {
            role: 'user',
            parts: [
              { text: 'Transcreva o áudio a seguir para texto em português brasileiro. Retorne apenas o texto transcrito.' },
              {
                inlineData: {
                  mimeType,
                  data: base64Audio
                }
              }
            ]
          }
        ]
      });

      return result.text?.trim() || '';
    } catch (error) {
      console.error('Erro ao transcrever áudio com Gemini:', error);
      throw error;
    }
  }

  /**
   * Gera resposta profissional e natural para o usuário
   */
  async generateResponse(context: string, data: any): Promise<string> {
    const prompt = `
Você responde mensagens via WhatsApp Business sobre ordens de serviço.

REGRAS IMPORTANTES:
- Seja BREVE e DIRETO. Máximo 2-3 linhas curtas
- Use linguagem natural de WhatsApp, sem formalidades excessivas
- NUNCA use markdown, asteriscos ou formatação especial
- Use apenas quebras de linha simples quando necessário
- Seja profissional mas casual, como uma pessoa real
- Evite emojis ou use no máximo 1

${context}

Dados: ${JSON.stringify(data)}

Responda de forma curta e natural.
`;

    try {
      const result = await this.genAI.models.generateContent({
        model: this.modelName,
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ]
      });
      return result.text || '';
    } catch (error) {
      console.error('Erro ao gerar resposta:', error);
      return 'Desculpe, ocorreu um erro ao processar sua solicitação.';
    }
  }
}

export default new GeminiService();

