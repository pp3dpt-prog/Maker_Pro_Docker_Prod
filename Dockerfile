FROM node:20-bullseye-slim

# Instalar OpenSCAD e fontconfig para gerir as fontes
RUN apt-get update && apt-get install -y \
    openscad \
    fontconfig \
    fonts-liberation \
    fonts-roboto \
    && rm -rf /var/lib/apt/lists/*\
    && apt-get clean

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Criar pastas necessárias para o funcionamento
RUN mkdir -p temp public/font_previews

# Porta padrão do Render
EXPOSE 10000
