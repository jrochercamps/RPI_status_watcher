FROM node:22-bookworm-slim AS frontend
WORKDIR /build
COPY frontend/package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim-bookworm AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app/backend
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt \
    && groupadd --system app && useradd --system --gid app --home-dir /app app \
    && mkdir -p /data && chown app:app /data
COPY --chown=app:app backend/ ./
COPY --from=frontend --chown=app:app /build/dist /app/frontend/dist
USER app
EXPOSE 8765
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8765"]
