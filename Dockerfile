FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy app
COPY . .

# Expose port (Railway usa 8080)
EXPOSE 8080

# Start
CMD ["node", "server.js"]
