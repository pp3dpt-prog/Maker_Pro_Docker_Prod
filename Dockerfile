FROM node:20-bullseye-slim

# Instalar OpenSCAD e configurar fontes
RUN apt-get update && apt-get install -y \
    openscad \
    fontconfig \
    fonts-liberation \
    fonts-roboto \
    && fc-cache -f -v \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

WORKDIR /app

# Copiar ficheiros de dependências e instalar
COPY package*.json ./
RUN npm install

# Copiar o resto do código (incluindo a pasta templates)
COPY . .

# Criar pastas e dar permissões totais para o OpenSCAD escrever o STL
RUN mkdir -p temp public/font_previews && chmod -R 777 temp

# Porta padrão do Render
EXPOSE 10000

CMD ["npm", "start"]