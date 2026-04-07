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

# 3. Copiar todo o projeto (incluindo pastas templates e fonts)
COPY . .
RUN mkdir -p templates && chmod -R 755 templates
RUN ls -l /app/templates
# 4. Criar pastas e configurar permissões
# temp e previews: Escrita total (777)
# templates e fonts: Leitura (755)
RUN mkdir -p temp public/font_previews && \
    chmod -R 777 temp public/font_previews && \
    chmod -R 755 templates fonts
RUN mkdir -p /usr/share/fonts/truetype/custom
COPY fonts/*.ttf /usr/share/fonts/truetype/custom/
COPY fonts/*.otf /usr/share/fonts/truetype/custom/
# 5. Atualizar a cache de fontes para o OpenSCAD ver os teus .ttf
RUN fc-cache -f -v
RUN echo "--- LISTA DE FONTES INSTALADAS ---" && fc-list : family

EXPOSE 10000
CMD ["npm", "start"]