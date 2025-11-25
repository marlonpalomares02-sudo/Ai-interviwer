#!/bin/bash

# Docker Build Script for AI Interview Assistant
echo "🐳 Building AI Interview Assistant Docker containers..."

# Build the main application
echo "Building main application..."
docker build -f Dockerfile.electron -t ai-interview-assistant:latest .

# Build the web test interface
echo "Building web test interface..."
docker build -f Dockerfile.web -t ai-interview-web-test:latest .

echo "✅ Docker images built successfully!"
echo ""
echo "To run the containers:"
echo "  docker-compose up -d"
echo ""
echo "To run individually:"
echo "  docker run -d -p 3000:3000 ai-interview-assistant:latest"
echo "  docker run -d -p 8081:80 ai-interview-web-test:latest"