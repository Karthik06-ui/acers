set -e

echo "==> Installing dependencies..."
pip install -r requirements.txt

echo "==> Collecting static files..."
python manage.py collectstatic --no-input

echo "==> Running migrations..."
python manage.py migrate

echo "==> Ensuring HOD account exists..."
python manage.py ensure_hod

echo "==> Build complete."