# --- Stage 1: build the React SPA ---
FROM node:22-alpine AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
# Public URL prefix, e.g. /rr/ when served behind nginx at https://host/rr/
ARG BASE_PATH=/
RUN VITE_BASE_PATH=$BASE_PATH npm run build

# --- Stage 2: Python runtime (agent + API) ---
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_DB=/app/data/app.db
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
COPY --from=frontend /build/dist ./frontend/dist
RUN useradd --create-home --uid 10001 app \
    && mkdir -p /app/data /app/runs /app/.cache \
    && chown -R app:app /app/data /app/runs /app/.cache
USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8000/healthz')" || exit 1
CMD ["python", "-m", "uvicorn", "webapp.app:app", "--host", "0.0.0.0", "--port", "8000"]
