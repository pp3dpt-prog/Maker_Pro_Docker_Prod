FROM node:20-bullseye-slim

# Instala OpenSCAD, fontes e suporte gráfico para geometrias complexas
RUN apt-get update && apt-get install -y \
    openscad \
    fonts-liberation \
    libglu1-mesa \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

# Copia todos os ficheiros do projeto
COPY . .

# Garante que a pasta temp existe
RUN mkdir -p temp

EXPOSE 10000
CMD ["node", "server.js"]