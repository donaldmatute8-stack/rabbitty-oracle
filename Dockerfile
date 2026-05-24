FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy app
COPY . .

# Expose port
EXPOSE 3001

# Start
CMD ["node", "server.js"]
