#!/bin/bash

# Railway Deployment Script for Rabbitty Oracle

set -e

echo "🚀 Desplegando Rabbitty Oracle a Railway..."

# Check if railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI no encontrado"
    echo ""
    echo "Instálalo con:"
    echo "  npm install -g @railway/cli"
    echo "  railway login"
    echo ""
    echo "O usa el dashboard web: https://railway.app"
    exit 1
fi

# Check if logged in
if ! railway whoami &> /dev/null; then
    echo "❌ No estás logueado en Railway"
    echo "Ejecuta: railway login"
    exit 1
fi

# Navigate to backend directory
cd "$(dirname "$0")"

echo "📦 Preparando despliegue..."

# Create/link project if not exists
if [ ! -f ".railway/project.json" ]; then
    echo "🔗 Vinculando proyecto..."
    railway link --project rabbitty-oracle
fi

# Set environment variables
echo "🔐 Configurando variables..."
railway variables --set "PORT=3001"
railway variables --set "BUNZ_CONTRACT=0x8d0CC6dcD796e9B14bd25BA2A21291aa3Af39fcB"
railway variables --set "SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com"

echo "⚠️  IMPORTANTE: Configura SEPOLIA_PRIVATE_KEY manualmente en Railway Dashboard"
echo "   (No se sube por seguridad)"

# Deploy
echo "🚀 Deployando..."
railway up --detach

echo ""
echo "✅ Despliegue iniciado!"
echo ""
echo "📊 Monitorea en: https://railway.app/dashboard"
echo ""

# Show URL
railway domain
