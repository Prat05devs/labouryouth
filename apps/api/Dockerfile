# Labour Youth API container (docs/API_HOSTING.md). Build context: apps/api.
FROM python:3.12-slim
RUN pip install --no-cache-dir "uv>=0.8,<0.9"
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PYTHONUNBUFFERED=1
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY alembic.ini ./
COPY migrations ./migrations
COPY app ./app
ENV PATH="/app/.venv/bin:$PATH"
RUN useradd --create-home api && mkdir -p /data/private-uploads && chown -R api /data /app
USER api
EXPOSE 8000
# The host's proxy sets X-Forwarded-For; trusting it keeps per-client rate limits per client, not per proxy.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
