FROM node:20-bullseye-slim

RUN apt-get update && apt-get install -y \
    openscad \
    fonts-liberation \
    libglu1-mesa \ 
    && rm -rf /var/lib/apt/lists/* [cite: 1]

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN mkdir -p temp
EXPOSE 10000
CMD ["node", "server.js"]