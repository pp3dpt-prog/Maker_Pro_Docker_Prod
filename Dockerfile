FROM node:20-bullseye-slim

# 1. Instalar OpenSCAD e utilitários de fontes (Essencial para o comando fc-list)
RUN apt-get update && apt-get install -y \
    openscad \
    fontconfig \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 2. Instalar dependências primeiro (Otimiza a cache do Docker)
COPY package*.json ./
RUN npm install

# 3. Copiar o resto dos ficheiros
COPY . .

# 4. Configurar pastas e permissões (Tudo num único passo para evitar erros)
RUN mkdir -p temp templates fonts public/font_previews && \
    chmod -R 777 temp public/font_previews && \
    chmod -R 755 templates fonts

# 5. Instalar fontes no sistema
# Criamos a pasta, copiamos os ficheiros e atualizamos a cache
RUN mkdir -p /usr/share/fonts/truetype/custom && \
    cp /app/fonts/*.ttf /usr/share/fonts/truetype/custom/ 2>/dev/null || true && \
    cp /app/fonts/*.otf /usr/share/fonts/truetype/custom/ 2>/dev/null || true && \
    fc-cache -f -v

# 6. LOG CRÍTICO: Isto TEM de aparecer no log de Build do Render
RUN echo "--- VERIFICACAO DE FONTES NO SISTEMA ---" && \
    fc-list : family | grep -E "Bebas|Open|Playfair" || echo "AVISO: Nenhuma fonte detectada!"

EXPOSE 10000

# Usar node diretamente evita o overhead do npm e ajuda com o SIGTERM no Render
CMD ["node", "server.js"]