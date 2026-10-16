FROM python:3.12-slim

# Unbuffered output so logs (e.g. "[recommendations] Saved ...") appear in the
# host's log viewer immediately; no .pyc files written inside the container.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# No apt packages needed: every dependency, including psycopg2-binary, installs
# as a prebuilt wheel, so no compiler or Postgres headers are required.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Hosting platforms usually assign a port via $PORT; default to 8000 locally.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
