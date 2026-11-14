# Production Dockerfile for Railway / Cloud Deployment
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy application files
COPY package.json ./
COPY src/ ./src/
COPY .env.example ./

# Ensure data directory exists for SQLite database storage
RUN mkdir -p /app/data

# Default production environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Expose server port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:${PORT:-3000}/api/health || exit 1

# Start application
CMD ["node", "src/index.js"]
