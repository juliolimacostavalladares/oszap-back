/**
 * Script de exemplo para testar a API
 * Execute: node examples/test-api.js
 */

import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3000';

async function testAPI() {
  console.log('🧪 Testando API OSZap\n');

  try {
    // 1. Health Check
    console.log('1. Health Check...');
    const health = await axios.get(`${API_URL}/health`);
    console.log('✅', health.data);
    console.log('');

    // 2. Criar OS
    console.log('2. Criando OS...');
    const newOS = await axios.post(`${API_URL}/api/os`, {
      client_name: 'João Silva',
      client_phone: '5511999999999',
      services: ['Instalação elétrica', 'Pintura', 'Encanamento'],
      total_amount: 750.50,
      notes: 'Serviço realizado com sucesso',
      status: 'concluida'
    });
    console.log('✅ OS criada:', newOS.data);
    console.log('');

    // 3. Listar OSs
    console.log('3. Listando OSs...');
    const osList = await axios.get(`${API_URL}/api/os`);
    console.log('✅ Total de OSs:', osList.data.data.length);
    console.log('');

    // 4. Buscar OS por ID
    if (newOS.data.data.id) {
      console.log('4. Buscando OS por ID...');
      const os = await axios.get(`${API_URL}/api/os/${newOS.data.data.id}`);
      console.log('✅ OS encontrada:', os.data.data);
      console.log('');
    }

    // 5. Consultar Saldo do Dia
    console.log('5. Consultando saldo do dia...');
    const balanceDay = await axios.get(`${API_URL}/api/balance?period=day`);
    console.log('✅ Saldo do dia: R$', balanceDay.data.balance);
    console.log('');

    // 6. Consultar Saldo do Mês
    console.log('6. Consultando saldo do mês...');
    const balanceMonth = await axios.get(`${API_URL}/api/balance?period=month`);
    console.log('✅ Saldo do mês: R$', balanceMonth.data.balance);
    console.log('');

    console.log('✅ Todos os testes passaram!');

  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message);
  }
}

testAPI();

