#!/bin/bash

# Script para subir el proyecto a GitHub
# Uso: ./push-to-github.sh "mensaje del commit"

echo "🚀 Preparando subida a GitHub..."

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo "❌ Error: Ejecuta este script desde el directorio whatsapp-monitor-server"
    exit 1
fi

# Mensaje de commit
COMMIT_MSG="${1:-Update WhatsApp Monitor API}"

echo "📦 Agregando archivos..."
git add .

echo "💾 Haciendo commit..."
git commit -m "$COMMIT_MSG"

echo "🌐 Subiendo a GitHub..."
git push origin main

echo "✅ ¡Listo! Código subido a https://github.com/saltbalente/chat-whatsapp-backend"
