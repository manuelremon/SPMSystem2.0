# syntax=docker/dockerfile:1

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app \
    SPM_ENV=development \
    SPM_DEBUG=1 \
    SPM_SECRET_KEY=dev-key-12345

WORKDIR /app

# System dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY requirements.txt ./requirements.txt
RUN python -m pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Application code
COPY . ./

# Create database directory
RUN mkdir -p /var/spm && chmod 777 /var/spm

EXPOSE 5000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

CMD ["gunicorn", \
     "--bind", "0.0.0.0:5000", \
     "--workers", "2", \
     "--threads", "2", \
     "--timeout", "120", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "wsgi:app"]
