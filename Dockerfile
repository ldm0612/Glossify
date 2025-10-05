###########
# Stage 1: Build Next.js frontend to static assets
###########
FROM node:18-alpine AS frontend-build

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend ./
# When serving behind Flask in the same origin, default to relative API base.
ENV NEXT_PUBLIC_API_URL=""
RUN npm run build && npx next export

###########
# Stage 2: Python backend runtime
###########
FROM python:3.11-slim AS backend

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY backend/requirements.txt backend/requirements.txt
RUN pip install -r backend/requirements.txt

COPY backend backend
# Copy exported static frontend into Flask's static directory
COPY --from=frontend-build /app/frontend/out backend/app/static

EXPOSE 7860

# Run Flask app with Gunicorn, binding to the platform-provided PORT
CMD ["bash","-lc","gunicorn -w 2 -k gthread -b 0.0.0.0:$PORT main:app --chdir backend/app"]

