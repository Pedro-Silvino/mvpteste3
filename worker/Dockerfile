# Worker do Sentinela: API de ingestão do coletor, fila de jobs, scans e geração de PDF (Chromium).
# A imagem oficial do Playwright já traz o Chromium e as bibliotecas do sistema. A versão da tag
# precisa ser a mesma do playwright no pyproject.toml (1.49.1).
FROM mcr.microsoft.com/playwright/python:v1.49.1-noble

ENV PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

RUN pip install --no-cache-dir uv==0.5.11

WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY app ./app
COPY templates ./templates

# Roda sem privilégios de root.
RUN useradd --create-home --uid 10001 worker && chown -R worker /app
USER worker

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4)"

# SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY vêm das variáveis de ambiente do serviço (nunca da imagem).
CMD ["uv", "run", "--no-sync", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
