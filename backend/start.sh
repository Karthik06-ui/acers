#!/usr/bin/env bash
set -e

echo "==> Running database migrations..."
python manage.py migrate --no-input

echo "==> Ensuring HOD account exists..."
python manage.py ensure_hod

if [ "$SEED_DEMO" = "true" ]; then
  echo "==> Seeding demo dataset..."
  python manage.py seed_demo --force
fi

echo "==> Starting Gunicorn on port $PORT..."
exec gunicorn config.wsgi:application --bind 0.0.0.0:$PORT

