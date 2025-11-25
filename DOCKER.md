# Docker Deployment Guide

This guide explains how to run the AI Interview Assistant using Docker containers.

## Prerequisites

- Docker Desktop installed and running
- Docker Compose installed
- Your Deepgram and Deepseek API keys

## Quick Start

### Option 1: Using Scripts (Recommended)

**Windows:**
```batch
# Build the Docker images
docker-build.bat

# Run the containers
docker-run.bat
```

**Linux/Mac:**
```bash
# Make scripts executable
chmod +x docker-build.sh docker-run.sh

# Build the Docker images
./docker-build.sh

# Run the containers
./docker-run.sh
```

### Option 2: Manual Docker Commands

```bash
# Build the main application
docker build -f Dockerfile.electron -t ai-interview-assistant:latest .

# Build the web test interface
docker build -f Dockerfile.web -t ai-interview-web-test:latest .

# Run with docker-compose
docker-compose up -d
```

## Configuration

Before running, create a `.env` file with your API keys:

```env
DEEPGRAM_API_KEY=your-deepgram-api-key-here
DEEPSEEK_API_KEY=your-deepseek-api-key-here
```

## Access Points

Once running, you can access:

- **Main Application**: http://localhost:3000
- **Web Test Interface**: http://localhost:8081
- **Real-time Test**: http://localhost:8081/realtime-test.html

## Docker Services

### ai-interview-assistant
- Main Electron application
- Real-time transcription
- LLM integration
- Audio processing

### web-test
- Web-based test interface
- Direct Deepgram WebSocket testing
- Audio level monitoring
- Connection debugging

## Management Commands

```bash
# View logs
docker-compose logs -f

# Stop containers
docker-compose down

# Restart containers
docker-compose restart

# View running containers
docker ps

# Access container shell
docker exec -it ai-interview-assistant /bin/sh
```

## Troubleshooting

### Container won't start
- Check Docker Desktop is running
- Verify API keys in .env file
- Check logs: `docker-compose logs`

### Audio issues in container
- Ensure microphone permissions in Docker Desktop
- Check audio device mapping
- Try the web test interface first

### Port conflicts
- Change ports in docker-compose.yml if needed
- Ensure ports 3000, 8080, 8081 are available

## Development Mode

For development with hot reload:

```bash
# Run in development mode
docker-compose -f docker-compose.dev.yml up
```

## Production Deployment

For production deployment:

1. Update API keys in production environment
2. Use proper SSL certificates
3. Configure reverse proxy (nginx/traefik)
4. Set up monitoring and logging
5. Use Docker Swarm or Kubernetes for scaling

## Security Notes

- Never commit API keys to version control
- Use Docker secrets for sensitive data
- Regularly update base images
- Scan images for vulnerabilities
- Use non-root users in containers