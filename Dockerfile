FROM node:20-bullseye-slim

# 1. Instalar dependências do sistema
RUN apt-get update && apt-get install -y \
    openscad \
    fontconfig \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 2. Instalar Node dependencies
COPY package*.json ./
RUN npm install

# 3. Copiar ficheiros do projeto
COPY . .

# 4. Criar pastas e dar permissões
RUN mkdir -p temp templates fonts && \
    chmod -R 777 temp && \
    chmod -R 755 templates fonts

# 5. Instalar Fontes (Método Limpo)
RUN mkdir -p /usr/share/fonts/truetype/custom && \
    find /app/fonts -name "*.[to]tf" -exec cp {} /usr/share/fonts/truetype/custom/ \; && \
    fc-cache -f -v

# 6. VERIFICAÇÃO (Este é o log que eu preciso de ver)
RUN echo "--- VERIFICACAO DE FONTES ---" && \
    fc-list : family | grep -iE "Bebas|Open|Playfair" || echo "ERRO: Fontes nao encontradas na pasta /app/fonts"

EXPOSE 10000

# Usar node diretamente é mais leve que npm start
CMD ["node", "server.js"]