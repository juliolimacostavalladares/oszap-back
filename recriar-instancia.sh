#!/bin/bash

# Script para recriar instância e obter QR Code

API_KEY="${EVOLUTION_API_KEY:-9538FAD36557-4FA1-8556-882F0D2AB94E}"
INSTANCE_NAME="${INSTANCE_NAME:-OSZap}"
BASE_URL="${EVOLUTION_API_URL:-http://localhost:8080}"

echo "🗑️  Deletando instância existente..."
DELETE_RESPONSE=$(curl -s -X DELETE "$BASE_URL/instance/delete/$INSTANCE_NAME" \
  -H "apikey: $API_KEY")

echo "   Resposta: $DELETE_RESPONSE"
echo ""
echo "⏳ Aguardando 3 segundos..."
sleep 3

echo ""
echo "📱 Criando nova instância com QR Code..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/instance/create" \
  -H "apikey: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"instanceName\": \"$INSTANCE_NAME\",
    \"token\": \"$API_KEY\",
    \"qrcode\": true,
    \"integration\": \"WHATSAPP-BAILEYS\"
  }")

echo "$CREATE_RESPONSE" | jq '.' 2>/dev/null || echo "$CREATE_RESPONSE"

QRCODE=$(echo "$CREATE_RESPONSE" | jq -r '.qrcode.base64' 2>/dev/null)

if [ -n "$QRCODE" ] && [ "$QRCODE" != "null" ]; then
  echo ""
  echo "✅ QR Code obtido!"
  echo ""
  echo "💡 Para visualizar:"
  echo "   1. Acesse: https://base64.guru/converter/decode/image"
  echo "   2. Cole o valor abaixo:"
  echo ""
  echo "$QRCODE"
  echo ""
  echo "📸 Ou salve como imagem:"
  echo "   echo '$QRCODE' | base64 -d > qrcode.png"
else
  echo ""
  echo "⚠️  QR Code não encontrado na resposta."
  echo "   Tente acessar: http://localhost:8080/manager"
  echo "   E conectar a instância pela interface web."
fi

