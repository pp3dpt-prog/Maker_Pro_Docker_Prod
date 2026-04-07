FROM node:20-bullseye-slim

# 1. Instalar OpenSCAD e utilitários de fontes
RUN apt-get update && apt-get install -y \
    openscad \
    fontconfig \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 2. Instalar dependências do Node
COPY package*.json ./
RUN npm install

# 3. Copiar projeto e configurar pastas
COPY . .
RUN mkdir -p temp templates fonts public/font_previews && \
    chmod -R 777 temp public/font_previews && \
    chmod -R 755 templates fonts

# 4. Instalar fontes no sistema (Crítico para o OpenSCAD)
RUN mkdir -p /usr/share/fonts/truetype/custom && \
    cp fonts/*.ttf /usr/share/fonts/truetype/custom/ 2>/dev/null || true && \
    cp fonts/*.otf /usr/share/fonts/truetype/custom/ 2>/dev/null || true && \
    fc-cache -f -v

# Log de verificação no build
RUN echo "--- FONTES INSTALADAS ---" && fc-list : family | grep -E "Bebas|Open|Playfair" || echo "Aviso: Fontes não encontradas"

EXPOSE 10000
CMD ["npm", "start"]