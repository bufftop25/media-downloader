# Comandos Git para Configurar o Repositório

## Opção 1: Script Automatizado (Recomendado)

Execute o script que já está preparado:

```bash
cd /root/workzapcrm/media-downloader
chmod +x setup-git.sh
./setup-git.sh
```

## Opção 2: Comandos Manuais

Execute os seguintes comandos no diretório `/root/workzapcrm/media-downloader`:

```bash
cd /root/workzapcrm/media-downloader

# Remover remote de origem se existir
git remote remove origin 2>/dev/null || true

# Inicializar git se não estiver inicializado
git init

# Adicionar todos os arquivos
git add .

# Fazer commit inicial
git commit -m "first commit: Enhanced media-downloader with automatic image detection"

# Renomear branch para main
git branch -M main

# Remover e adicionar novo remote (garantir que está correto)
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/bufftop25/media-downloader.git

# Verificar remote
git remote -v

# Push para o repositório
git push -u origin main
```

## Verificação

Após executar, verifique se tudo está correto:

```bash
git remote -v
# Deve mostrar: origin  https://github.com/bufftop25/media-downloader.git

git status
# Deve mostrar que está na branch main e sincronizado
```

