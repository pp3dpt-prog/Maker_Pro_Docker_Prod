FROM node:20-bullseye-slim

# Instalar OpenSCAD e dependências de fontes
RUN apt-get update && apt-get install -y \
    openscad \
    fontconfig \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar ficheiros do projeto
COPY package*.json ./
RUN npm install
COPY . .

# --- CONFIGURAÇÃO DE FONTES PERSONALIZADAS ---
# 1. Criar pasta de fontes do sistema
# 2. Copiar as tuas fontes .ttf para lá
# 3. Atualizar a cache de fontes do Linux
RUN mkdir -p /usr/share/fonts/truetype/custom && \
    cp fonts/*.ttf /usr/share/fonts/truetype/custom/ 2>/dev/null || true && \
    fc-cache -f -v

# Criar pastas de trabalho e dar permissões
RUN mkdir -p temp public/font_previews && chmod -R 777 temp public/font_previews

EXPOSE 10000
CMD ["npm", "start"]