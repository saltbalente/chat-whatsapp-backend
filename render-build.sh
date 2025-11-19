#!/bin/bash

# Script de build para Render.com

echo "📦 Installing Node.js dependencies..."
npm install

echo "🐍 Installing Python dependencies..."
pip3 install -r requirements.txt

echo "✅ Build complete!"
