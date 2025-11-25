# Use Node.js 18 LTS as base image
FROM node:18-alpine

# Install dependencies required for Electron
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && rm -rf /var/cache/apk/*

# Set environment variables for Electron
ENV ELECTRON_ENABLE_LOGGING=1
ENV ELECTRON_ENABLE_STACK_DUMPING=1
ENV DISPLAY=:99

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY forge.config.ts ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port for any web interface (if needed)
EXPOSE 3000

# Create a script to start the application
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'echo "Starting AI Interview Assistant..."' >> /app/start.sh && \
    echo 'npm start' >> /app/start.sh && \
    chmod +x /app/start.sh

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["/app/start.sh"]