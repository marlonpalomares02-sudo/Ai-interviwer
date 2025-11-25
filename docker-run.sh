#!/bin/bash

# Docker Run Script for AI Interview Assistant
echo "🚀 Starting AI Interview Assistant Docker containers..."

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file..."
    echo "DEEPGRAM_API_KEY=your-deepgram-api-key-here" > .env
    echo "DEEPSEEK_API_KEY=your-deepseek-api-key-here" >> .env
    echo "⚠️  Please update the .env file with your actual API keys"
fi

# Run with docker-compose
echo "Starting containers with docker-compose..."
docker-compose up -d

echo "✅ Containers started successfully!"
echo ""
echo "Access points:"
echo "  Main Application: http://localhost:3000"
echo "  Web Test Interface: http://localhost:8081"
echo ""
echo "To view logs:"
echo "  docker-compose logs -f"
echo ""
echo "To stop:"
echo "  docker-compose down"