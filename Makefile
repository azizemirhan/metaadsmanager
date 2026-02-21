# Meta Ads Dashboard - Makefile
.PHONY: help test test-backend test-frontend test-docker test-watch coverage lint format

help:
	@echo "Kullanılabilir komutlar:"
	@echo "  make test          - Tüm testleri çalıştır (Docker ile)"
	@echo "  make test-backend  - Sadece backend testleri"
	@echo "  make test-frontend - Sadece frontend testleri"
	@echo "  make test-local    - Yerel ortamda test çalıştır"
	@echo "  make coverage      - Coverage raporu oluştur"
	@echo "  make lint          - Kod kalite kontrolü"
	@echo "  make format        - Kod formatlama"

# Docker ile test çalıştırma
test:
	docker compose -f docker-compose.test.yml up --build --abort-on-container-exit

test-backend:
	docker compose -f docker-compose.test.yml up --build backend_test --abort-on-container-exit

test-frontend:
	docker compose -f docker-compose.test.yml up --build frontend_test --abort-on-container-exit

# Yerel test çalıştırma (mevcut Docker altyapısını kullanarak)
test-local:
	@echo "Backend testleri çalıştırılıyor..."
	cd backend && DATABASE_URL=postgresql+asyncpg://metaads:metaads@localhost:5432/metaads pytest --cov=app -v

test-local-unit:
	@echo "Unit testleri çalıştırılıyor..."
	cd backend && pytest -m unit -v

test-local-integration:
	@echo "Integration testleri çalıştırılıyor..."
	cd backend && pytest -m integration -v

# Coverage
coverage:
	cd backend && pytest --cov=app --cov-report=html --cov-report=term-missing
	@echo "HTML raporu: backend/htmlcov/index.html"

# Linting
lint-backend:
	cd backend && flake8 app --count --select=E9,F63,F7,F82 --show-source --statistics
	cd backend && black --check app

lint-frontend:
	cd frontend && npx tsc --noEmit

lint: lint-backend lint-frontend

# Format
format-backend:
	cd backend && black app
	cd backend && isort app

format: format-backend

# Test veritabanını oluştur
test-db-setup:
	@echo "Test veritabanı oluşturuluyor..."
	docker exec metaadsmanager-postgres-1 psql -U metaads -d metaads -c "CREATE DATABASE metaads_test;" || echo "Veritabanı zaten var"

# Backend container'ında test çalıştır
test-in-container:
	docker exec metaadsmanager-backend-1 pip install -r requirements-dev.txt
	docker exec metaadsmanager-backend-1 pytest --cov=app -v
