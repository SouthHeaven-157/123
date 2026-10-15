FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --chown=node:node . .
RUN mkdir -p /app/data && chown node:node /app/data
ENV NODE_ENV=production HOST=0.0.0.0 PORT=10000 PYTHON_EXE=/usr/bin/python3 DATA_DIR=/app/data
USER node
EXPOSE 10000
CMD ["node", "server.cjs"]
