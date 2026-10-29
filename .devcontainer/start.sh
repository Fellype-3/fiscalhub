#!/usr/bin/env bash
# Roda toda vez que o Codespace inicia: sobe o servidor de desenvolvimento
# (API + front-end com recarga automática) em segundo plano.
nohup npm run dev > /tmp/fiscalhub-dev.log 2>&1 &
