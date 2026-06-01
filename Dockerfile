FROM node:18-bullseye

# Install ffmpeg
RUN apt-get update \
  && apt-get install -y ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Install dependencies first for caching
COPY package*.json ./
RUN npm install --production

# Copy app
COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
