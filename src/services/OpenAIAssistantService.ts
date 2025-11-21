import OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool
} from 'openai/resources/chat/completions';

/**
 * Serviço OpenAI com Function Calling
 * Gerencia assistente virtual inteligente para ordens de serviço
 */
export class OpenAIAssistantService {
  private client: OpenAI;
  private model: string = 'gpt-4-turbo-preview';

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY não configurada');
    }

    this.client = new OpenAI({ apiKey });
  }

  /**
   * Define as ferramentas/funções disponíveis para a IA
   */
  private getAvailableTools(): ChatCompletionTool[] {
    return [
      {
        type: 'function',
        function: {
          name: 'criar_ordem_servico',
          description: 'Cria uma nova ordem de serviço no sistema',
          parameters: {
            type: 'object',
            properties: {
              cliente_nome: {
                type: 'string',
                description: 'Nome completo do cliente'
              },
              cliente_telefone: {
                type: 'string',
                description: 'Telefone do cliente'
              },
              cliente_email: {
                type: 'string',
                description: 'Email do cliente (opcional)'
              },
              cliente_endereco: {
                type: 'string',
                description: 'Endereço completo do cliente (opcional)'
              },
              titulo: {
                type: 'string',
                description: 'Título resumido do serviço a ser realizado'
              },
              descricao: {
                type: 'string',
                description: 'Descrição detalhada do problema ou serviço solicitado'
              },
              categoria: {
                type: 'string',
                enum: ['manutencao', 'instalacao', 'reparo', 'consultoria', 'outro'],
                description: 'Categoria do serviço'
              },
              prioridade: {
                type: 'string',
                enum: ['baixa', 'normal', 'alta', 'urgente'],
                description: 'Prioridade da ordem de serviço'
              },
              valor_estimado: {
                type: 'number',
                description: 'Valor estimado do serviço (opcional)'
              },
              data_previsao: {
                type: 'string',
                description: 'Data prevista para conclusão no formato ISO 8601 (opcional)'
              }
            },
            required: ['cliente_nome', 'titulo', 'descricao']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'consultar_ordens_servico',
          description: 'Consulta ordens de serviço com filtros opcionais',
          parameters: {
            type: 'object',
            properties: {
              numero_os: {
                type: 'string',
                description: 'Número específico da OS para consulta'
              },
              status: {
                type: 'string',
                enum: ['aberta', 'em_andamento', 'aguardando_pecas', 'concluida', 'cancelada'],
                description: 'Filtrar por status'
              },
              periodo_dias: {
                type: 'number',
                description: 'Buscar OS dos últimos X dias'
              },
              limite: {
                type: 'number',
                description: 'Quantidade máxima de resultados (padrão: 10)',
                default: 10
              }
            },
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'atualizar_status_ordem_servico',
          description: 'Atualiza o status de uma ordem de serviço existente',
          parameters: {
            type: 'object',
            properties: {
              numero_os: {
                type: 'string',
                description: 'Número da ordem de serviço'
              },
              novo_status: {
                type: 'string',
                enum: ['aberta', 'em_andamento', 'aguardando_pecas', 'concluida', 'cancelada'],
                description: 'Novo status da ordem de serviço'
              },
              observacao: {
                type: 'string',
                description: 'Observação sobre a mudança de status (opcional)'
              }
            },
            required: ['numero_os', 'novo_status']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'atualizar_ordem_servico',
          description: 'Atualiza informações de uma ordem de serviço existente',
          parameters: {
            type: 'object',
            properties: {
              numero_os: {
                type: 'string',
                description: 'Número da ordem de serviço'
              },
              tecnico_responsavel: {
                type: 'string',
                description: 'Nome do técnico responsável'
              },
              valor_estimado: {
                type: 'number',
                description: 'Valor estimado do serviço'
              },
              valor_final: {
                type: 'number',
                description: 'Valor final do serviço'
              },
              data_previsao: {
                type: 'string',
                description: 'Nova data prevista para conclusão'
              },
              observacoes: {
                type: 'string',
                description: 'Observações adicionais'
              }
            },
            required: ['numero_os']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'adicionar_pecas_ordem_servico',
          description: 'Adiciona peças utilizadas em uma ordem de serviço',
          parameters: {
            type: 'object',
            properties: {
              numero_os: {
                type: 'string',
                description: 'Número da ordem de serviço'
              },
              pecas: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    descricao: {
                      type: 'string',
                      description: 'Descrição da peça'
                    },
                    codigo: {
                      type: 'string',
                      description: 'Código da peça (opcional)'
                    },
                    quantidade: {
                      type: 'number',
                      description: 'Quantidade utilizada'
                    },
                    valor_unitario: {
                      type: 'number',
                      description: 'Valor unitário da peça'
                    }
                  },
                  required: ['descricao', 'quantidade', 'valor_unitario']
                },
                description: 'Lista de peças a serem adicionadas'
              }
            },
            required: ['numero_os', 'pecas']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'gerar_pdf_ordem_servico',
          description: `Gera o PDF de uma ordem de serviço específica. 
          
          ⚠️ ATENÇÃO: Esta função APENAS GERA o PDF, NÃO ENVIA!
          
          Se o usuário pediu para "enviar" ou "mandar" a OS para alguém:
          1. Chame esta função para gerar o PDF
          2. Logo em seguida, OBRIGATORIAMENTE chame enviar_mensagem_whatsapp para enviar o PDF
          
          NÃO pare depois de gerar o PDF! Continue e envie usando enviar_mensagem_whatsapp!`,
          parameters: {
            type: 'object',
            properties: {
              numero_os: {
                type: 'string',
                description: 'Número da ordem de serviço'
              }
            },
            required: ['numero_os']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'obter_estatisticas_usuario',
          description: 'Obtém estatísticas e resumo das ordens de serviço do usuário',
          parameters: {
            type: 'object',
            properties: {
              periodo_dias: {
                type: 'number',
                description: 'Período em dias para estatísticas (padrão: 30)',
                default: 30
              }
            },
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'buscar_ordem_servico_por_criterio',
          description: 'Busca ordens de serviço por diversos critérios (cliente, descrição, etc)',
          parameters: {
            type: 'object',
            properties: {
              termo_busca: {
                type: 'string',
                description: 'Termo para buscar em nome do cliente, descrição, título, etc'
              },
              limite: {
                type: 'number',
                description: 'Quantidade máxima de resultados',
                default: 10
              }
            },
            required: ['termo_busca']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'obter_totalizadores',
          description: 'Obtém totalizadores gerais das ordens de serviço (total de OS abertas, em andamento, concluídas, valor total, etc)',
          parameters: {
            type: 'object',
            properties: {
              periodo_dias: {
                type: 'number',
                description: 'Período em dias para calcular totalizadores (padrão: todos)',
                default: null
              }
            },
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'listar_minhas_os',
          description: 'Lista TODAS as ordens de serviço do usuário atual com resumo',
          parameters: {
            type: 'object',
            properties: {
              incluir_concluidas: {
                type: 'boolean',
                description: 'Se deve incluir OS concluídas (padrão: true)',
                default: true
              },
              ordenar_por: {
                type: 'string',
                enum: ['data_criacao', 'prioridade', 'status', 'valor'],
                description: 'Como ordenar os resultados (padrão: data_criacao)',
                default: 'data_criacao'
              }
            },
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'obter_detalhes_completos_os',
          description: 'Obtém TODOS os detalhes completos de uma ordem de serviço específica (informações do cliente, histórico, peças, valores, datas, etc)',
          parameters: {
            type: 'object',
            properties: {
              numero_os: {
                type: 'string',
                description: 'Número da ordem de serviço'
              }
            },
            required: ['numero_os']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'obter_resumo_financeiro',
          description: 'Obtém resumo financeiro das ordens de serviço (valores estimados, valores finais, total faturado, etc)',
          parameters: {
            type: 'object',
            properties: {
              periodo_dias: {
                type: 'number',
                description: 'Período em dias para calcular resumo (padrão: 30)',
                default: 30
              },
              incluir_detalhes: {
                type: 'boolean',
                description: 'Se deve incluir detalhamento por OS (padrão: false)',
                default: false
              }
            },
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'agendar_notificacao',
          description: 'Agenda uma notificação para ser enviada via WhatsApp em uma data/hora futura. Útil para lembretes, avisos agendados, etc.',
          parameters: {
            type: 'object',
            properties: {
              numero_os: {
                type: 'string',
                description: 'Número da OS relacionada (opcional)'
              },
              tipo: {
                type: 'string',
                enum: ['lembrete', 'conclusao', 'atualizacao', 'pdf', 'custom'],
                description: 'Tipo de notificação'
              },
              destinatario_telefone: {
                type: 'string',
                description: 'Telefone do destinatário (pode ser do próprio usuário ou outro contato)'
              },
              destinatario_nome: {
                type: 'string',
                description: 'Nome do destinatário (opcional)'
              },
              titulo: {
                type: 'string',
                description: 'Título da notificação'
              },
              mensagem: {
                type: 'string',
                description: 'Mensagem completa da notificação'
              },
              data_hora: {
                type: 'string',
                description: 'Data e hora para enviar a notificação (ISO 8601 ou descrição natural como "amanhã às 14h")'
              },
              enviar_pdf: {
                type: 'boolean',
                description: 'Se deve enviar o PDF da OS junto (apenas se numero_os fornecido)'
              },
              recorrente: {
                type: 'boolean',
                description: 'Se a notificação deve se repetir'
              },
              intervalo_dias: {
                type: 'number',
                description: 'Intervalo em dias para recorrência (apenas se recorrente=true)'
              }
            },
            required: ['tipo', 'destinatario_telefone', 'titulo', 'mensagem', 'data_hora']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'criar_automacao',
          description: 'Cria uma automação que dispara automaticamente quando algo acontece. Ex: enviar PDF quando OS for concluída, notificar quando status mudar, etc.',
          parameters: {
            type: 'object',
            properties: {
              tipo_evento: {
                type: 'string',
                enum: ['os_concluida', 'os_atualizada', 'status_mudou', 'data_chegando'],
                description: 'Tipo de evento que dispara a automação'
              },
              condicoes: {
                type: 'object',
                description: 'Condições para o trigger disparar. Ex: {"status": "concluida"}, {"prioridade": "urgente"}'
              },
              tipo_acao: {
                type: 'string',
                enum: ['enviar_notificacao', 'enviar_pdf'],
                description: 'Ação a ser executada quando o evento ocorrer'
              },
              parametros_acao: {
                type: 'object',
                description: 'Parâmetros da ação. Para enviar_notificacao: {titulo, mensagem, destinatario_telefone}. Para enviar_pdf: {destinatario_telefone}'
              }
            },
            required: ['tipo_evento', 'condicoes', 'tipo_acao', 'parametros_acao']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'listar_notificacoes_agendadas',
          description: 'Lista as notificações que foram agendadas e estão pendentes de envio',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'cancelar_notificacao',
          description: 'Cancela uma notificação agendada que ainda não foi enviada',
          parameters: {
            type: 'object',
            properties: {
              notificacao_id: {
                type: 'string',
                description: 'ID da notificação a ser cancelada'
              }
            },
            required: ['notificacao_id']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'buscar_contato',
          description: 'Busca um contato nos contatos salvos do WhatsApp pelo nome ou número. Use quando o usuário mencionar enviar algo para alguém mas não fornecer o número.',
          parameters: {
            type: 'object',
            properties: {
              nome: {
                type: 'string',
                description: 'Nome do contato para buscar (pode ser parcial, ex: "João", "Maria")'
              }
            },
            required: ['nome']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'enviar_pdf_os_para_contato',
          description: `ENVIA o PDF de uma Ordem de Serviço para um contato do WhatsApp. 
          
          🚨 USE ESTA FUNÇÃO quando o usuário pedir:
          - "Envia a OS para [nome]"
          - "Manda o PDF da OS pro [nome]"
          - "Envia a OS-xxx para [pessoa]"
          
          ⚠️ Esta função faz TUDO automaticamente:
          1. Busca o contato por nome
          2. Gera o PDF da OS
          3. Envia o PDF pelo WhatsApp
          
          ⚠️ SEMPRE use esta função quando for "enviar OS para alguém"!
          ⚠️ NÃO use gerar_pdf_ordem_servico + enviar_mensagem_whatsapp separadamente!
          ⚠️ Esta é a função CORRETA para enviar OS!`,
          parameters: {
            type: 'object',
            properties: {
              nome_contato: {
                type: 'string',
                description: 'Nome do contato para buscar no banco de dados (ex: "Rafaela", "Bruno")'
              },
              numero_os: {
                type: 'string',
                description: 'Número da ordem de serviço a ser enviada (ex: "OS-20251121-000006")'
              },
              mensagem_adicional: {
                type: 'string',
                description: 'Mensagem de texto adicional para enviar junto com o PDF (opcional)'
              }
            },
            required: ['nome_contato', 'numero_os']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'enviar_mensagem_whatsapp',
          description: `ENVIA uma mensagem de texto ou PDF de OS para um número do WhatsApp (quando você JÁ TEM o número). 
          
          Use esta função quando:
          - O usuário fornecer o número diretamente (ex: "envia para 22999999999")
          - Você já buscou o contato e tem o telefone
          
          Se o usuário mencionar um NOME, use enviar_pdf_os_para_contato ao invés desta!`,
          parameters: {
            type: 'object',
            properties: {
              numero: {
                type: 'string',
                description: 'Número do WhatsApp no formato internacional (ex: 5522999999999) ou remoteJid completo'
              },
              mensagem: {
                type: 'string',
                description: 'Texto da mensagem a ser enviada (opcional se for enviar PDF)'
              },
              ordem_servico_id: {
                type: 'string',
                description: 'ID da ordem de serviço para gerar e enviar o PDF (opcional)'
              }
            },
            required: ['numero']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'salvar_contato',
          description: 'Salva um contato no banco de dados para facilitar envios futuros. Use quando criar OS ou quando o usuário pedir para salvar um número.',
          parameters: {
            type: 'object',
            properties: {
              nome: {
                type: 'string',
                description: 'Nome do contato'
              },
              telefone: {
                type: 'string',
                description: 'Número de telefone (formato: 5522999999999)'
              },
              email: {
                type: 'string',
                description: 'Email do contato (opcional)'
              },
              observacoes: {
                type: 'string',
                description: 'Observações sobre o contato (opcional)'
              },
              favorito: {
                type: 'boolean',
                description: 'Se o contato deve ser marcado como favorito (opcional)'
              }
            },
            required: ['nome', 'telefone']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'listar_contatos',
          description: 'Lista todos os contatos salvos. Use quando o usuário pedir para ver os contatos ou quiser saber quais contatos estão salvos.',
          parameters: {
            type: 'object',
            properties: {
              favoritos: {
                type: 'boolean',
                description: 'Se true, lista apenas contatos favoritos (opcional)'
              },
              busca: {
                type: 'string',
                description: 'Termo para buscar nos nomes ou telefones (opcional)'
              }
            },
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'buscar_contato_salvo',
          description: 'Busca um contato salvo por nome. SEMPRE use esta função ANTES de enviar mensagens, para pegar o número salvo.',
          parameters: {
            type: 'object',
            properties: {
              nome: {
                type: 'string',
                description: 'Nome ou parte do nome do contato para buscar'
              }
            },
            required: ['nome']
          }
        }
      }
    ];
  }

  /**
   * Prompt do sistema que define o comportamento do assistente
   */
  private getSystemPrompt(): string {
    return `LANGUAGE: PORTUGUESE BRAZILIAN (PT-BR)
YOU MUST RESPOND ONLY IN BRAZILIAN PORTUGUESE, NEVER IN ENGLISH.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🇧🇷 VOCÊ RESPONDE EXCLUSIVAMENTE EM PORTUGUÊS BRASILEIRO 🇧🇷
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️⚠️⚠️ REGRA MÁXIMA E INQUEBRÁVEL ⚠️⚠️⚠️

TODAS AS SUAS RESPOSTAS DEVEM SER ESCRITAS EM PORTUGUÊS BRASILEIRO.
SE VOCÊ ESCREVER EM INGLÊS, SUA RESPOSTA SERÁ REJEITADA E DESCARTADA.

VOCÊ É UM ASSISTENTE BRASILEIRO que:
• SEMPRE responde em PORTUGUÊS BRASILEIRO
• NUNCA usa inglês, espanhol ou qualquer outro idioma
• PODE receber perguntas em inglês, mas RESPONDE em português
• USA gírias e expressões brasileiras
• ESCREVE como um brasileiro conversando no WhatsApp

SE RECEBER UMA PERGUNTA EM INGLÊS: traduza mentalmente e responda em PORTUGUÊS BRASILEIRO.
SE VIR PALAVRAS EM INGLÊS: traduza e use em PORTUGUÊS BRASILEIRO.

EXEMPLOS DE COMO RESPONDER:
❌ ERRADO: "The value of your last service order..."
✅ CERTO: "O valor da sua última ordem de serviço..."

❌ ERRADO: "I found the service order for Bruno..."
✅ CERTO: "Encontrei a ordem de serviço do Bruno..."

❌ ERRADO: "Let me generate the PDF for you..."
✅ CERTO: "Vou gerar o PDF pra você..."

❌ ERRADO: "I'm sorry, but I couldn't find a contact named..."
✅ CERTO: "Desculpe, não encontrei um contato com o nome..."

❌ ERRADO: "It seems there's no contact saved under..."
✅ CERTO: "Parece que não há nenhum contato salvo com..."

❌ ERRADO: "Could there be another name..."
✅ CERTO: "Pode ser outro nome..."

🚨 SE VOCÊ ESCREVER **QUALQUER PALAVRA EM INGLÊS**, SUA RESPOSTA SERÁ REJEITADA! 🚨

Você é um assistente virtual especializado em ordens de serviço, conversando via WhatsApp! 🤖✨

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🎭 SUA PERSONALIDADE:

Você é aquele assistente que TODO MUNDO gostaria de ter:
• 😊 **Amigável e acessível** - Conversa de forma natural, como um amigo prestativo
• ⚡ **Eficiente e direto** - Vai direto ao ponto, sem enrolação
• 💙 **Empático** - Entende quando o cliente está com urgência ou preocupado
• 🎯 **Proativo** - Sugere próximos passos e antecipa necessidades
• ✨ **Positivo** - Usa linguagem encorajadora, mesmo em situações difíceis

## 🛠️ O QUE VOCÊ FAZ DE MELHOR:

1. 📝 **Criar OS** - Pega todas as informações de forma natural, como uma conversa
2. 🔍 **Consultar e Buscar** - Ajuda a encontrar qualquer OS rapidinho
3. 📊 **Mostrar Estatísticas** - Totais, resumos, valores... tudo bem explicadinho
4. 📈 **Acompanhar Status** - Mantém o cliente sempre informado
5. 💰 **Resumos Financeiros** - Valores, faturamento, tudo organizado
6. 📄 **Gerar PDFs** - Documentos prontos quando precisar
7. 📱 **Gerenciar Contatos** - Salva, lista e busca contatos no banco de dados
8. 📤 **Enviar Mensagens** - Envia mensagens de texto ou PDFs de OS para qualquer número do WhatsApp
9. 🔔 **Agendar Notificações** - Cria lembretes e avisos automáticos
10. 💾 **Auto-Save Contatos** - Salva automaticamente contatos ao criar OS

## 💬 COMO VOCÊ SE COMUNICA:

✅ **FAÇA:**
• Use emojis com MODERAÇÃO (não exagere, mas use para dar vida)
• Seja conversacional - "Vou te ajudar com isso!" em vez de "Irei auxiliá-lo"
• Quebre mensagens longas em partes menores e mais fáceis de ler
• Use formatação: *negrito* para destaque, listas para organizar
• Pergunte uma coisa de cada vez (WhatsApp é para mensagens rápidas!)
• Celebre conquistas - "Eba! OS criada com sucesso! 🎉"
• Seja empático em problemas - "Entendo sua preocupação..."

❌ **NÃO FAÇA:**
• Ser formal demais - "Prezado senhor" é muito formal para WhatsApp
• Enviar mensagens gigantes - ninguém lê
• Usar termos técnicos sem explicar
• Ser robótico ou mecânico
• Ignorar o contexto emocional do cliente

## 📝 CRIANDO UMA OS (Fluxo Natural):

Em vez de ser um interrogatório, seja assim:

"Opa! Vou te ajudar a criar essa OS! 😊

Primeiro, me diz: qual o nome do cliente?"

[espera resposta]

"Perfeito! E o telefone dele?"

[espera resposta]

"Show! Agora me conta: que tipo de serviço precisa ser feito?"

...e assim por diante, como uma conversa natural! 

Antes de criar, SEMPRE confirme:
"Deixa eu confirmar os dados:
👤 Cliente: [nome]
📞 Telefone: [telefone]
🔧 Serviço: [descrição]
⚡ Prioridade: [prioridade]

Tá tudo certo? Confirmo para criar a OS?"

## ✨ FORMATANDO SUAS RESPOSTAS:

**Para listar OS, use este modelo:**

📋 Suas Ordens de Serviço:

🟢 *OS #001* - Manutenção
   Cliente: João Silva
   Status: ✅ Concluída
   Valor: R$ 350,00

🟡 *OS #002* - Instalação  
   Cliente: Maria Santos
   Status: ⏳ Em andamento
   Valor: R$ 500,00

**Para totalizadores, use este modelo:**

📊 *Resumo Geral*

• Total de OS: 45
• Abertas: 🟢 12
• Em andamento: 🟡 8  
• Concluídas: ✅ 25

💰 *Financeiro:*
• Faturado: R$ 15.450,00
• Em aberto: R$ 3.200,00

**Emojis por Status:**
• 🟢 Aberta
• 🟡 Em andamento
• 🔵 Aguardando peças
• ✅ Concluída
• ⛔ Cancelada

**Emojis por Prioridade:**
• 🔴 Urgente
• 🟠 Alta
• 🟡 Normal
• 🟢 Baixa

## 🎯 SEJA PROATIVO:

Não só responda, SUGIRA próximos passos:

✅ "OS criada com sucesso! 🎉 Quer que eu gere o PDF para você enviar ao cliente?"

✅ "Encontrei 3 OS em aberto. Quer ver os detalhes de alguma específica?"

✅ "Notei que você tem OS urgentes pendentes. Quer que eu liste elas?"

## 🆘 QUANDO ALGO DER ERRADO:

NÃO mostre erros técnicos! Seja assim:

❌ "Error: Connection refused at line 42"
✅ "Opa! Tive um probleminha aqui. Pode tentar novamente? 😅"

❌ "Database timeout exception"  
✅ "Demorou mais que o esperado... Vamos tentar de novo?"

SEMPRE ofereça alternativa ou próximo passo!

## 💡 EXEMPLOS DE BOM ATENDIMENTO:

**Cliente:** "Quero ver minhas OS"
**Você:** "Claro! Quer ver todas ou só as que estão em aberto? 📋"

**Cliente:** "Quanto já faturei esse mês?"
**Você:** "Deixa eu buscar isso pra você! ⏳
💰 *Faturamento do Mês:*
• Total faturado: R$ 8.750,00
• 15 OS concluídas
• Ticket médio: R$ 583,33

Quer ver o detalhamento por cliente?"

**Cliente:** "Preciso criar uma OS urgente"
**Você:** "Entendido! Urgência recebida! 🚨
Vamos criar rapidinho. Me passa o nome do cliente?"

## 🎨 USANDO MENSAGENS FORMATADAS:

Quando você chamar uma ferramenta (tool), o sistema pode retornar um campo chamado "mensagem_formatada" ou "data_formatada".
Estas mensagens JÁ ESTÃO PERFEITAMENTE FORMATADAS com emojis, estrutura visual e todas as informações organizadas.

**REGRA IMPORTANTE:**
- Se houver "mensagem_formatada": Use ela DIRETAMENTE na sua resposta
- Se houver "data_formatada": Use essa data formatada, NÃO reformate você mesmo
- Você pode adicionar uma frase introdutória curta, mas USE os valores formatados
- NÃO reformate ou reescreva - eles já estão perfeitos!

**CRÍTICO - Datas:**
⚠️ NUNCA reformate datas por conta própria!
- Se o resultado tem "data_formatada", USE EXATAMENTE como está
- Se o resultado tem "mensagem" com data, USE EXATAMENTE como está
- NÃO converta datas para outros formatos
- NÃO mude o ano, mês, dia ou horário

**Exemplo correto:**
Resultado tem data_formatada: "20 de novembro de 2025 às 14:30"
Você responde: "✅ Notificação agendada para 20 de novembro de 2025 às 14:30"

**Exemplo ERRADO (não faça):**
Resultado tem data_formatada: "20 de novembro de 2025 às 14:30"
Você responde: "06/12/2023 às 21:01" - ISSO ESTÁ ERRADO! Use a data que veio do resultado!

## 📱 SISTEMA DE CONTATOS SALVOS:

⚠️ **SEMPRE use "buscar_contato_salvo" ANTES de enviar mensagens!**

### 📥 **SALVAR CONTATOS:**
- **SEMPRE** salve contatos automaticamente quando criar uma OS (já é automático)
- Se o usuário pedir "salva esse número", use a ferramenta salvar_contato
- Você pode salvar nome, telefone, email e observações

### 🔍 **BUSCAR CONTATOS:**
**FLUXO CORRETO PARA ENVIAR MENSAGENS:**
1. Usuário pede: "Envia a OS pro Rafael"
2. Você usa: buscar_contato_salvo com nome "Rafael"
3. Se encontrar: enviar_mensagem_whatsapp com o número encontrado
4. Se não encontrar: "Não encontrei o Rafael salvo. Qual o número dele?"

**Exemplo BOM:**
👤: "Envia o PDF da OS pro Rafael"
🤖: *busca contato salvo "Rafael"* → Encontra (5522992531720)
🤖: *envia mensagem com o PDF*
🤖: "✅ PDF enviado para o Rafael!"

**Exemplo RUIM:**
👤: "Envia pro Rafael"
🤖: "Qual o número do Rafael?" ❌ (deveria buscar nos contatos salvos primeiro!)

### 📋 **LISTAR CONTATOS:**
- Use listar_contatos quando o usuário perguntar "quais contatos tenho?" ou "me mostra os contatos"
- Você pode filtrar por favoritos ou buscar por termo

### 💾 **AUTO-SAVE:**
- Quando criar uma OS, o contato é AUTOMATICAMENTE salvo
- Isso significa que todos os clientes ficam salvos para envios futuros

⚠️ **NÃO use mais "buscar_contato" (do WhatsApp), use "buscar_contato_salvo" (do banco de dados)!**

## 📤 ENVIAR MENSAGENS E PDFs PARA OUTROS NÚMEROS:

🚨🚨🚨 **REGRA MAIS IMPORTANTE DE TODAS** 🚨🚨🚨

**FRASES QUE EXIGEM AÇÃO:**
- "Envia a OS para [nome]"
- "Manda o PDF da OS pro [nome]"
- "Envia a OS-xxx para [pessoa]"

**O QUE VOCÊ DEVE FAZER (SIMPLES E DIRETO):**

🎯 **USE APENAS UMA FUNÇÃO:**
   FUNÇÃO: enviar_pdf_os_para_contato(nome_contato: "...", numero_os: "...")

⚠️ **ESTA FUNÇÃO FAZ TUDO SOZINHA:**
   1. Busca o contato ✅
   2. Gera o PDF ✅
   3. Envia o PDF pelo WhatsApp ✅

**EXEMPLO PRÁTICO:**
Usuário: "Envia a OS para a Rafaela"

Você CHAMA (UMA ÚNICA FUNÇÃO):
   enviar_pdf_os_para_contato(
     nome_contato: "Rafaela",
     numero_os: "OS-20251121-000006"
   )

Você RESPONDE:
   "✅ Enviei o PDF da OS para a Rafaela!"

🚨 **NÃO FAÇA:**
- ❌ Chamar gerar_pdf_ordem_servico primeiro
- ❌ Chamar buscar_contato_salvo primeiro
- ❌ Dizer "não consigo enviar"
- ❌ Parar depois de gerar o PDF

✅ **FAÇA:**
- ✅ Chamar enviar_pdf_os_para_contato DIRETAMENTE
- ✅ Confirmar o envio com sucesso

**QUAL OS ENVIAR:**
- Se o usuário mencionar "a OS", "a última OS", "essa OS", busque no histórico da conversa qual OS foi mencionada
- Se mencionar o nome do cliente (ex: "envia a OS da Rafaela"), use a OS mais recente daquele cliente
- Se especificar um número (ex: "OS-20251121-000006"), use esse número
- Se não houver contexto, chame listar_minhas_os e use a mais recente

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️⚠️⚠️ VOCÊ **PODE E DEVE** ENVIAR MENSAGENS! ⚠️⚠️⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ VOCÊ TEM A FERRAMENTA: enviar_mensagem_whatsapp
✅ VOCÊ PODE enviar textos e PDFs para QUALQUER número
✅ QUANDO O USUÁRIO PEDIR, VOCÊ **DEVE** ENVIAR

❌ **NUNCA, EM NENHUMA CIRCUNSTÂNCIA, DIGA:**
- "não posso enviar mensagens"
- "não fui projetado para enviar"
- "você precisará enviar manualmente"
- "I don't have the capability"
- "Unfortunately I cannot send"

✅ **SEMPRE DIGA:**
- "Vou enviar agora!"
- "Enviando o PDF para..."
- "✅ Mensagem enviada!"

## 💭 MANTENDO O CONTEXTO DA CONVERSA:

⚠️ **CRUCIAL:** Você tem acesso ao histórico completo da conversa.
- SEMPRE leia as mensagens anteriores antes de responder
- Se o usuário perguntar "e as estatísticas?" ou "me mostra os detalhes", você JÁ SABE o que ele quer
- NÃO peça informações que já foram ditas na conversa
- MANTENHA a continuidade do diálogo
- Se perdeu o contexto, RELEIA o histórico antes de pedir novamente

**Exemplo de BOM contexto:**
Usuário cria uma OS, depois pede o PDF: você já sabe qual OS é e gera direto.

**Exemplo RUIM (não faça isso):**
Usuário cria uma OS, depois pede o PDF: você pergunta "de qual OS?" sendo que acabou de criar uma.

## ⚠️ TRATAMENTO DE ERROS:

🚨 **REGRA ABSOLUTA: NUNCA MOSTRE ERROS TÉCNICOS!** 🚨

❌ **FRASES TOTALMENTE PROIBIDAS:**
- "Não consegui enviar a mensagem para o número"
- "Pode haver um problema técnico temporário"
- "Recomendo tentar novamente mais tarde"
- "Recomendo verificar se o número está correto"
- "O problema pode estar relacionado a questões técnicas"
- "verificar se há alguma especificidade que precisa ser ajustada"
- "Parece que houve um problema ao tentar..."
- "Error: ..."
- "Failed to..."
- Qualquer frase com "problema técnico"
- Qualquer frase pedindo para o usuário "verificar"

✅ **SE ALGO FALHAR, DIGA APENAS:**
- "Opa! Vou tentar de novo..."
- "Deixa eu mandar novamente!"
- "Aguenta aí, já resolvo!"
- "Hmm, deixa eu fazer isso de outro jeito..."

🎯 **REGRA DE OURO:**
Se uma função retornar erro, NÃO mencione o erro. Seja BREVE, POSITIVO e TENTE RESOLVER.
- Qualquer mensagem técnica de erro

**SEJA POSITIVO E PROATIVO, MESMO COM ERROS!**
Se não conseguir gerar um PDF, ofereça alternativas.
Se não encontrar um contato, pergunte o número.
Se algo falhar, sugira outra solução.

## 🎯 LEMBRE-SE SEMPRE:

🇧🇷 Responda SEMPRE em português brasileiro
💬 Seja conversacional, não robótico
😊 Mantenha o clima positivo e prestativo
🎯 Vá direto ao ponto, mas com simpatia
✨ Faça o cliente se sentir bem atendido
🎨 USE as mensagens_formatadas quando disponíveis
📚 MANTENHA o contexto da conversa - você tem memória!
🚫 NUNCA mostre erros técnicos - seja sempre positivo!
📤 SEMPRE use as ferramentas disponíveis (especialmente enviar_mensagem_whatsapp)!

Você não é só um bot - você é um assistente que REALMENTE ajuda e LEMBRA das conversas! 🌟

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🇧🇷 LEMBRE-SE: RESPONDA **SEMPRE** EM PORTUGUÊS BRASILEIRO! 🇧🇷
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚨🚨🚨 REGRA FINAL E ABSOLUTA 🚨🚨🚨

ANTES DE ENVIAR SUA RESPOSTA, PERGUNTE-SE:
"Minha resposta está 100% em PORTUGUÊS BRASILEIRO?"

Se a resposta for NÃO → REESCREVA em português!
Se a resposta for SIM → Ótimo, pode enviar!

NÃO EXISTE EXCEÇÃO. NÃO EXISTE "MAS...". NÃO EXISTE "PORÉM...".
TODAS as suas palavras DEVEM estar em PORTUGUÊS BRASILEIRO.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🇧🇷 PORTUGUÊS BRASILEIRO SEMPRE! SEM EXCEÇÕES! 🇧🇷
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  }

  /**
   * Processa uma mensagem do usuário e retorna a resposta da IA
   */
  async processMessage(
    userMessage: string,
    _userId: string,
    conversationHistory: ChatCompletionMessageParam[] = []
  ): Promise<{
    response: string;
    toolCalls?: any[];
    requiresInteraction: boolean;
  }> {
    try {
      // Prepara o histórico de mensagens
      const messages: ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: this.getSystemPrompt()
        },
        ...conversationHistory,
        {
          role: 'user',
          content: userMessage
        }
      ];

      // Primeira chamada à API
      let response = await this.client.chat.completions.create({
        model: this.model,
        messages,
        tools: this.getAvailableTools(),
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 1000
      });

      let assistantMessage = response.choices[0].message;
      let toolCalls: any[] = [];

      // Se a IA quer chamar funções, precisamos processar
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        console.log(`[OpenAI] IA solicitou ${assistantMessage.tool_calls.length} chamada(s) de função`);
        
        // Adiciona a mensagem do assistente ao histórico
        messages.push(assistantMessage);

        // Processa cada tool call
        for (const toolCall of assistantMessage.tool_calls) {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);

          console.log(`[OpenAI] Função chamada: ${functionName}`, functionArgs);

          // Retorna as tool calls para serem processadas externamente
          toolCalls.push({
            id: toolCall.id,
            name: functionName,
            arguments: functionArgs
          });
        }

        return {
          response: this.garantirPortuguesBrasileiro(assistantMessage.content || ''),
          toolCalls,
          requiresInteraction: true
        };
      }

      // Se não há tool calls, retorna a resposta direta
      return {
        response: this.garantirPortuguesBrasileiro(assistantMessage.content || 'Desculpe, não consegui processar sua mensagem.'),
        requiresInteraction: false
      };

    } catch (error: any) {
      console.error('[OpenAI] Erro ao processar mensagem:', error);
      throw new Error(`Erro ao processar com OpenAI: ${error.message}`);
    }
  }

  /**
   * Continua a conversa após executar funções
   * O histórico JÁ DEVE conter as mensagens tool com os resultados
   */
  async continueWithFunctionResults(
    conversationHistory: ChatCompletionMessageParam[]
  ): Promise<string> {
    try {
      console.log('[OpenAI] Gerando resposta final após execução das ferramentas...');

      // Faz nova chamada à API com o histórico completo
      // (incluindo user message, assistant com tool_calls, e tool results)
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: conversationHistory,
        temperature: 0.7,
        max_tokens: 1500
      });

      const finalMessage = response.choices[0].message.content || 'Processado com sucesso!';
      console.log('[OpenAI] Resposta final gerada com sucesso');
      
      // 🇧🇷 GARANTE que a resposta final está em português
      return this.garantirPortuguesBrasileiro(finalMessage);

    } catch (error: any) {
      console.error('[OpenAI] Erro ao continuar com resultados:', error);
      throw new Error(`Erro ao continuar conversa: ${error.message}`);
    }
  }

  /**
   * 🇧🇷 Garante que a resposta está em português brasileiro
   * Detecta palavras-chave em inglês e alerta caso detecte
   */
  private garantirPortuguesBrasileiro(texto: string): string {
    if (!texto || texto.trim().length === 0) {
      return texto;
    }

    // Palavras e frases comuns em inglês que NÃO deveriam aparecer
    const palavrasIngles = [
      // Frases comuns
      "i'm sorry", "i am sorry", "i couldn't", "couldn't find", 
      "it seems", "there's no", "there is no", "could there be",
      "i found", "i didn't find", "i can't find", "cannot find",
      "let me", "please wait", "one moment", "just a moment",
      "i will", "i'll", "i would", "i should",
      "for you", "to you", "with you", 
      "thank you", "you're welcome",
      // Termos técnicos
      'service order', 'the value', 'created on', 'total number',
      'the pdf', 'not available', 'related to',
      // Outras palavras
      'however', 'but', 'also', 'maybe', 'perhaps',
      'named', 'saved under', 'contact named',
      'different name', 'another name', 'help locate',
      'correct contact', 'look for', 'should look'
    ];

    // Verifica se há palavras em inglês no texto
    const textoLower = texto.toLowerCase();
    const encontrouIngles = palavrasIngles.some(palavra => 
      textoLower.includes(palavra.toLowerCase())
    );

    if (encontrouIngles) {
      console.warn('⚠️⚠️⚠️ [VALIDAÇÃO] DETECTADO TEXTO EM INGLÊS NA RESPOSTA! ⚠️⚠️⚠️');
      console.warn('⚠️ [VALIDAÇÃO] Texto:', texto.substring(0, 300));
      console.warn('⚠️ [VALIDAÇÃO] O modelo OpenAI IGNOROU as instruções de responder em PORTUGUÊS!');
      
      // Retorna mensagem padrão em português como fallback
      return '🇧🇷 Desculpe, tive um probleminha ao processar sua mensagem. Pode reformular ou tentar novamente? Estou aqui para ajudar! 😊';
    }

    return texto;
  }

  /**
   * Transcreve áudio para texto usando Whisper
   */
  async transcribeAudio(audioBuffer: Buffer, mimeType: string = 'audio/ogg'): Promise<string> {
    const fs = await import('fs/promises');
    const path = await import('path');
    const os = await import('os');
    const ffmpeg = (await import('fluent-ffmpeg')).default;
    
    let tempInputPath: string | null = null;
    let tempOutputPath: string | null = null;
    
    try {
      const tempDir = os.tmpdir();
      const timestamp = Date.now();
      
      // Determina extensão do arquivo de entrada
      let inputExtension = 'ogg';
      if (mimeType.includes('ogg') || mimeType.includes('opus')) {
        inputExtension = 'ogg';
      } else if (mimeType.includes('mp3')) {
        inputExtension = 'mp3';
      } else if (mimeType.includes('wav')) {
        inputExtension = 'wav';
      } else if (mimeType.includes('m4a')) {
        inputExtension = 'm4a';
      } else if (mimeType.includes('webm')) {
        inputExtension = 'webm';
      }

      // Salva arquivo original
      tempInputPath = path.join(tempDir, `audio_input_${timestamp}.${inputExtension}`);
      await fs.writeFile(tempInputPath, audioBuffer);
      
      // Aguarda um momento para garantir que o arquivo foi gravado
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verifica se o arquivo existe e tem conteúdo
      const stats = await fs.stat(tempInputPath);
      console.log(`[OpenAI] 📥 Áudio recebido: ${inputExtension} (${stats.size} bytes)`);
      
      if (stats.size === 0) {
        throw new Error('Arquivo de áudio vazio');
      }

      // Se for OGG/Opus (WhatsApp), converte para MP3
      if (mimeType.includes('ogg') || mimeType.includes('opus')) {
        tempOutputPath = path.join(tempDir, `audio_output_${timestamp}.mp3`);
        console.log(`[OpenAI] 🔄 Convertendo OGG/Opus para MP3...`);
        
        await new Promise<void>((resolve, reject) => {
          ffmpeg(tempInputPath!)
            .inputFormat('ogg')
            .audioCodec('libmp3lame')
            .audioBitrate('128k')
            .audioChannels(1)
            .audioFrequency(16000)
            .format('mp3')
            .on('start', (commandLine) => {
              console.log('[OpenAI] 🎬 FFmpeg iniciado:', commandLine);
            })
            .on('progress', (progress) => {
              if (progress.percent) {
                console.log(`[OpenAI] ⏳ Progresso: ${Math.floor(progress.percent)}%`);
              }
            })
            .on('end', () => {
              console.log('[OpenAI] ✅ Conversão concluída');
              resolve();
            })
            .on('error', (err, stdout, stderr) => {
              console.error('[OpenAI] ❌ Erro na conversão:', err.message);
              console.error('[OpenAI] FFmpeg stderr:', stderr);
              reject(err);
            })
            .save(tempOutputPath!);
        });

        // Lê o arquivo convertido
        const convertedBuffer = await fs.readFile(tempOutputPath);
        const file = new File([convertedBuffer], `audio.mp3`, { type: 'audio/mp3' });

      const transcription = await this.client.audio.transcriptions.create({
        file,
        model: 'whisper-1',
        language: 'pt',
        response_format: 'text'
      });

        console.log('[OpenAI] ✅ Áudio transcrito com sucesso');
      return transcription as string;
        
      } else {
        // Outros formatos: envia direto
        const fileBuffer = await fs.readFile(tempInputPath);
        const file = new File([fileBuffer], `audio.${inputExtension}`, { type: mimeType });

        const transcription = await this.client.audio.transcriptions.create({
          file,
          model: 'whisper-1',
          language: 'pt',
          response_format: 'text'
        });

        console.log('[OpenAI] ✅ Áudio transcrito com sucesso');
        return transcription as string;
      }

    } catch (error: any) {
      console.error('[OpenAI] ❌ Erro ao transcrever áudio:', error);
      throw new Error(`Erro ao transcrever áudio: ${error.message}`);
    } finally {
      // Remove arquivos temporários
      if (tempInputPath) {
        try {
          await fs.unlink(tempInputPath);
          console.log('[OpenAI] 🗑️  Arquivo de entrada removido');
        } catch (err) {
          console.warn('[OpenAI] ⚠️  Não foi possível remover arquivo de entrada');
        }
      }
      if (tempOutputPath) {
        try {
          await fs.unlink(tempOutputPath);
          console.log('[OpenAI] 🗑️  Arquivo de saída removido');
        } catch (err) {
          console.warn('[OpenAI] ⚠️  Não foi possível remover arquivo de saída');
        }
      }
    }
  }

  /**
   * Gera áudio a partir de texto usando TTS
   */
  async textToSpeech(text: string): Promise<Buffer> {
    try {
      const response = await this.client.audio.speech.create({
        model: 'tts-1',
        voice: 'alloy',
        input: text,
        response_format: 'opus'
      });

      const buffer = Buffer.from(await response.arrayBuffer());
      console.log('[OpenAI] Áudio gerado com sucesso');
      return buffer;

    } catch (error: any) {
      console.error('[OpenAI] Erro ao gerar áudio:', error);
      throw new Error(`Erro ao gerar áudio: ${error.message}`);
    }
  }

  /**
   * Analisa uma imagem e retorna descrição
   */
  async analyzeImage(imageUrl: string, prompt: string = 'Descreva esta imagem em detalhes'): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ],
        max_tokens: 500
      });

      return response.choices[0].message.content || 'Não foi possível analisar a imagem.';

    } catch (error: any) {
      console.error('[OpenAI] Erro ao analisar imagem:', error);
      throw new Error(`Erro ao analisar imagem: ${error.message}`);
    }
  }
}

