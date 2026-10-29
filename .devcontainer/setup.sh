#!/usr/bin/env bash
# Roda uma vez, quando o Codespace é criado: instala dependências,
# gera o .env e semeia os dados de demonstração.
set -e

npm install

if [ ! -f .env ]; then
  cp .env.example .env
  KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  sed -i "s#^ENCRYPTION_KEY=.*#ENCRYPTION_KEY=$KEY#" .env
  sed -i "s#^ADMIN_EMAIL=.*#ADMIN_EMAIL=admin@fiscalhub.local#" .env
  sed -i "s#^ADMIN_PASSWORD=.*#ADMIN_PASSWORD=Admin-local-2026#" .env
  npm run seed:demo
fi
