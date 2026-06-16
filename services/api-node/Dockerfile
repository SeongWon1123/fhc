# Multi-stage build for production
FROM node:20-slim as builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# Production stage
FROM node:20-slim as production

WORKDIR /app

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Copy node_modules from builder stage
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package*.json /app/

COPY --chown=appuser:appuser . .

RUN mkdir -p /app/logs && chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "start"]
