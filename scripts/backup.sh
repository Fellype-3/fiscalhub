#!/bin/sh
# Backup do FiscalHub: banco + arquivos enviados. Agende diariamente (cron) e copie para fora do servidor.
# Uso (docker compose):  sh scripts/backup.sh /caminho/dos/backups
# Restauração: teste pelo menos 1x por mês (veja README › Backup).
set -e
DESTINO=${1:-./backups}
DATA=$(date +%Y-%m-%d_%H%M)
mkdir -p "$DESTINO"
docker compose exec -T db pg_dump -U fiscalhub -Fc fiscalhub > "$DESTINO/banco_$DATA.dump"
docker compose run --rm -T --no-deps -v "$(cd "$DESTINO" && pwd)":/saida app sh -c "tar czf /saida/arquivos_$DATA.tar.gz -C /dados arquivos"
# Mantém 30 dias
find "$DESTINO" -name 'banco_*' -mtime +30 -delete
find "$DESTINO" -name 'arquivos_*' -mtime +30 -delete
echo "Backup concluído em $DESTINO ($DATA)"
