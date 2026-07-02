# The Bridge — portable container for any host (Fly.io, Railway, a VPS, Cloud Run).
# Build from the REPO ROOT so the HQ engine is in context:
#   docker build -f apps/mcp/Dockerfile -t circle-hq-bridge .
#   docker run -p 8787:8787 -e BRIDGE_TOKEN=your-secret circle-hq-bridge
# Your link is:  https://<host>/mcp
FROM node:22-slim
WORKDIR /app/apps/mcp

# install deps first (layer cache)
COPY apps/mcp/package*.json ./
RUN npm install

# the Bridge itself
COPY apps/mcp/ ./

# the HQ engine it reuses (relative import ../../hq/src/data/graph) — self-contained
COPY apps/hq/src/data/graph /app/apps/hq/src/data/graph

ENV MCP_TRANSPORT=http
ENV PORT=8787
EXPOSE 8787
CMD ["npm", "run", "http"]
