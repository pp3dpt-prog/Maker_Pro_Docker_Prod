FROM node:20-bullseye-slim

# Instala OpenSCAD, fontes e a biblioteca necessária para geometrias complexas
RUN apt-get update && apt-get install -y \
    openscad \
    fonts-liberation \
    libglu1-mesa \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

# Copia todos os ficheiros corretamente para o contentor
COPY . .

# Garante que a pasta temp existe para gravar os ficheiros temporários
RUN mkdir -p temp

EXPOSE 10000
CMD ["node", "server.js"]