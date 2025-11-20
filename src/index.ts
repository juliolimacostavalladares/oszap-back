// IMPORTANTE: Carregar variáveis de ambiente ANTES de qualquer import
import './config/env.js';

import express, { Express } from 'express';
import cors from 'cors';
import { createRoutes } from './routes/index.js';
import { WhatsAppHandler } from './handlers/WhatsAppHandler.js';
import EvolutionService from './services/EvolutionService.js';
import GeminiService from './services/GeminiService.js';
import { OrderServiceService } from './services/OrderServiceService.js';
import PDFService from './services/PDFService.js';
import OrderServiceRepository from './repositories/OrderServiceRepository.js';

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Inicializar serviços
const evolutionService = EvolutionService;
const geminiService = GeminiService;
const pdfService = PDFService;
const orderServiceRepository = OrderServiceRepository;
const orderServiceService = new OrderServiceService(orderServiceRepository, pdfService);

// Verificar se Evolution API está configurada antes de inicializar handler
let whatsappHandler: WhatsAppHandler | null = null;
try {
  whatsappHandler = new WhatsAppHandler(evolutionService, geminiService, orderServiceService, pdfService);
  console.log('✅ WhatsApp Handler inicializado');
} catch (error: any) {
  console.warn('⚠️  WhatsApp Handler não inicializado:', error.message);
  console.warn('   A aplicação funcionará, mas sem integração WhatsApp');
}

// Configurar rotas
if (!whatsappHandler) {
  console.warn('⚠️  Rotas de WhatsApp desabilitadas - Evolution API não disponível');
}
const routes = createRoutes(orderServiceService, whatsappHandler!);
app.use(routes);

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor OSZap rodando na porta ${PORT}`);
  console.log(`📱 Webhook: http://localhost:${PORT}/webhook`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
  console.log('\n⚠️  Certifique-se de configurar o webhook na Evolution API!');
});

