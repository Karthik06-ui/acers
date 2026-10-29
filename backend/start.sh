#!/usr/bin/env bash
set -e

echo "==> Running database migrations..."
python manage.py migrate --no-input

if [ -n "$HOD_EMAIL" ] && [ -n "$HOD_PASSWORD" ]; then
  echo "==> Ensuring HOD account exists ($HOD_EMAIL)..."
  python manage.py create_hod "$HOD_EMAIL" "$HOD_PASSWORD" "${HOD_NAME:-Department Head}" "${HOD_DEPT:-CSE}"
fi

if [ "$SEED_DEMO" = "true" ]; then
  echo "==> Seeding demo dataset..."
  python manage.py seed_demo --force
fi

echo "==> Starting Gunicorn on port $PORT..."
exec gunicorn config.wsgi:application --bind 0.0.0.0:$PORT
