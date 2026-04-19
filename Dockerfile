FROM node:20-bullseye-slim

# 1. Instalar OpenSCAD e utilitários de fontes
RUN apt-get update && apt-get install -y \
    openscad \
    fontconfig \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 2. Instalar dependências
COPY package*.json ./
RUN npm install

# 3. Copiar projeto (Garante que a pasta fonts e templates vão para /app)
COPY . .

# 4. Configurar pastas e permissões
RUN mkdir -p temp templates fonts public/font_previews && \
    chmod -R 777 temp public/font_previews && \
    chmod -R 755 templates fonts

# 5. Instalação de Fontes no Sistema (Ajustado à tua estrutura de pastas)
RUN mkdir -p /usr/share/fonts/truetype/custom && \
    cp /app/fonts/*.ttf /usr/share/fonts/truetype/custom/ 2>/dev/null || true && \
    cp /app/fonts/*.otf /usr/share/fonts/truetype/custom/ 2>/dev/null || true && \
    fc-cache -f -v

# 6. LOG DE VERIFICAÇÃO (Para veres no Build Log do Render)
# 6. LOG DE VERIFICAÇÃO (build log)
RUN echo "--- FONTES DETECTADAS NO SISTEMA (families) ---" && \
    fc-list : family | sort -u | grep -iE "Aladin|Amarante|Benne|Baloo" || \
    (echo "ERRO: Fontes Aladin/Amarante/Benne/Baloo não encontradas!" && exit 1)

EXPOSE 10000

# Usar node diretamente para evitar o erro de sinal do npm no Render
CMD ["node", "server.js"]