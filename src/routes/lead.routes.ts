import { Router, Request, Response } from 'express';
import type { Router as ExpressRouter } from 'express';
import { LeadRepository } from '../repositories/LeadRepository.js';
import { EvolutionService } from '../services/EvolutionService.js';

const router: ExpressRouter = Router();
const leadRepository = new LeadRepository();
const evolutionService = new EvolutionService();

// =====================================================
// PROTEÇÃO ANTI-SPAM
// =====================================================
const rateLimitMap = new Map<string, { count: number; timestamp: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const limit = 5; // 5 requisições
  const windowMs = 60 * 1000; // por minuto
  
  const record = rateLimitMap.get(ip);
  
  if (!record) {
    rateLimitMap.set(ip, { count: 1, timestamp: now });
    return true;
  }
  
  // Reset se passou o tempo
  if (now - record.timestamp > windowMs) {
    rateLimitMap.set(ip, { count: 1, timestamp: now });
    return true;
  }
  
  // Incrementa contador
  record.count++;
  
  if (record.count > limit) {
    return false; // Bloqueado
  }
  
  return true;
}

// Limpa registros antigos a cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now - record.timestamp > 5 * 60 * 1000) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

/**
 * OPTIONS /api/leads/cadastrar
 * Responde ao preflight request do CORS
 */
router.options('/cadastrar', (_req: Request, res: Response) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, ngrok-skip-browser-warning');
  res.header('Access-Control-Max-Age', '86400'); // 24 horas
  res.sendStatus(204);
});

/**
 * POST /api/leads/cadastrar
 * Captura lead da Landing Page e envia mensagem de boas-vindas
 * 
 * 🔓 ENDPOINT PÚBLICO - Acessível pela Landing Page
 */
router.post('/cadastrar', async (req: Request, res: Response) => {
  try {
    // 🛡️ PROTEÇÃO ANTI-SPAM
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(clientIp)) {
      console.warn(`[API] ⚠️ Rate limit excedido para IP: ${clientIp}`);
      return res.status(429).json({
        success: false,
        error: 'Muitas requisições. Aguarde um momento e tente novamente.'
      });
    }

    const { nome, email, telefone, feedback } = req.body;

    // 🛡️ VALIDAÇÕES DE SEGURANÇA
    if (!nome || !email) {
      return res.status(400).json({
        success: false,
        error: 'Nome e email são obrigatórios'
      });
    }

    // Valida tamanho dos campos (previne ataques)
    if (nome.length > 255 || email.length > 255) {
      return res.status(400).json({
        success: false,
        error: 'Nome ou email muito longo'
      });
    }

    if (feedback && feedback.length > 5000) {
      return res.status(400).json({
        success: false,
        error: 'Feedback muito longo'
      });
    }

    // Valida formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Email inválido'
      });
    }

    // Remove espaços em branco extras
    const nomeLimpo = nome.trim();
    const emailLimpo = email.trim().toLowerCase();

    console.log('[API] 📥 Novo lead:', { nome: nomeLimpo, email: emailLimpo, telefone });

    // Registra o lead no banco
    const resultado = await leadRepository.registrarLead({
      nome: nomeLimpo,
      email: emailLimpo,
      telefone,
      feedback,
      origem: 'landing_page'
    });

    // Se tem telefone, envia mensagem de boas-vindas
    let mensagemEnviada = false;
    if (telefone && telefone.trim().length > 0) {
      try {
        const telefoneFormatado = telefone.replace(/\D/g, '');
        
        // Valida se o telefone tem o formato correto
        if (telefoneFormatado.length >= 10) {
          const remoteJid = `55${telefoneFormatado}@s.whatsapp.net`;
          
          const mensagemBoasVindas = `Opa, ${nomeLimpo}! 👋

Bem-vindo(a) ao *OSZap*! 🎉

Você acabou de garantir sua vaga na lista VIP e já pode conversar comigo! Sou seu assistente inteligente e vou te ajudar com *TUDO* relacionado às suas Ordens de Serviço.

✨ *E o melhor: TUDO funciona aqui pelo WhatsApp!*

🤖 *O que eu posso fazer por você:*
• Criar Ordens de Serviço (só falar que eu anoto tudo!)
• Enviar recibo em PDF pro cliente
• Consultar seus trabalhos e ganhos
• Lembrar você de compromissos
• Buscar qualquer OS que você precisar

💬 *Como funciona?*
Simples! É só conversar comigo como se fosse seu assistente pessoal:

"Cria uma OS pro João, troca da torneira, cobrei 150"
"Qual meu faturamento esse mês?"
"Envia o recibo da última OS pro cliente"

Tudo aqui, sem sair do WhatsApp! 📱

🎁 *Seu bônus VIP:*
✅ 3 meses GRÁTIS
✅ 50% OFF para sempre (R$ 34,95/mês)
✅ Suporte prioritário comigo aqui mesmo!

Pode me testar agora! Pergunta qualquer coisa ou me pede pra criar uma OS de exemplo. Estou aqui pra facilitar sua vida! 😊

---
_OSZap - Seu assistente de bolso!_ 🚀`;

          await evolutionService.sendTextMessage(remoteJid, mensagemBoasVindas);
          
          // Marca que a mensagem foi enviada
          await leadRepository.marcarMensagemEnviada(resultado.lead_id);
          
          mensagemEnviada = true;
          console.log('[API] ✅ Mensagem de boas-vindas enviada para:', telefone);
        } else {
          console.warn('[API] ⚠️ Telefone inválido, mensagem não enviada:', telefone);
        }
      } catch (error) {
        console.error('[API] ⚠️ Erro ao enviar mensagem de boas-vindas:', error);
        // Não falha o cadastro se der erro ao enviar mensagem
      }
    }

    // Retorna sucesso
    return res.status(201).json({
      success: true,
      mensagem: resultado.mensagem,
      novo_lead: resultado.novo,
      mensagem_enviada: mensagemEnviada,
      lead: {
        id: resultado.lead_id,
        nome: nomeLimpo,
        email: emailLimpo
      }
    });

  } catch (error: any) {
    console.error('[API] Erro ao cadastrar lead:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao processar seu cadastro. Tente novamente.'
    });
  }
});

/**
 * GET /api/leads/estatisticas
 * Retorna estatísticas dos leads (para admin)
 */
router.get('/estatisticas', async (_req: Request, res: Response) => {
  try {
    const stats = await leadRepository.obterEstatisticas();
    return res.json({
      success: true,
      estatisticas: stats
    });
  } catch (error: any) {
    console.error('[API] Erro ao buscar estatísticas:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao buscar estatísticas'
    });
  }
});

/**
 * GET /api/leads/listar
 * Lista todos os leads (para admin)
 */
router.get('/listar', async (req: Request, res: Response) => {
  try {
    const { status, limite, offset } = req.query;
    
    const leads = await leadRepository.listarLeads({
      status: status as string,
      limite: limite ? parseInt(limite as string) : 50,
      offset: offset ? parseInt(offset as string) : 0
    });

    return res.json({
      success: true,
      total: leads.length,
      leads
    });
  } catch (error: any) {
    console.error('[API] Erro ao listar leads:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao listar leads'
    });
  }
});

export default router;

