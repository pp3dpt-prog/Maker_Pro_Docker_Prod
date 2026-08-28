FROM node:20-bullseye-slim

# 1. Instalar OpenSCAD e utilitários de fontes
# fonts-liberation/fonts-dejavu-core/fonts-urw-base35/fonts-ubuntu: fontes de
# "sistema" referenciadas no template Letras Decorativas (Liberation Sans/Serif,
# DejaVu Serif, URW Chancery L, Ubuntu) — sem estes pacotes o OpenSCAD faz
# fallback silencioso para outra fonte quando o nome pedido não é encontrado,
# fazendo com que todas as opções de fonte saiam iguais no STL final.
RUN apt-get update && apt-get install -y \
    openscad \
    fontconfig \
    imagemagick \
    fonts-liberation \
    fonts-dejavu-core \
    fonts-urw-base35 \
    fonts-ubuntu \
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
RUN echo "--- FONTES DETECTADAS NO SISTEMA (families) ---" && \
    fc-list : family | sort -u | grep -iE "Aladin|Amarante|Benne|Baloo|Anton|Chewy|Gloria|Lobster|Luckiest|Oswald|Pacifico|Press Start|Racing|Sigmar" || \
    echo "AVISO: Algumas fontes não encontradas!" && \
    echo "--- FONTES DE SISTEMA (Letras Decorativas) ---" && \
    fc-list : family | sort -u | grep -iE "Liberation Sans|Liberation Serif|DejaVu Serif|URW Chancery|Ubuntu" || \
    echo "AVISO: Fontes de sistema (Liberation/DejaVu/URW Chancery/Ubuntu) não encontradas!"

EXPOSE 10000

# Usar node diretamente para evitar o erro de sinal do npm no Render
CMD ["node", "server.js"]