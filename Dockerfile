FROM node:20-bullseye-slim
RUN apt-get update && apt-get install -y \
    openscad \
    fontconfig \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*
COPY ./fonts /usr/share/fonts/truetype/custom
RUN fc-cache -f -v
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN mkdir -p temp
EXPOSE 10000
CMD ["node", "server.js"]