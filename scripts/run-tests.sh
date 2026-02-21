#!/bin/bash
# Test çalıştırma scripti - Docker kullanarak

set -e

echo "🧪 Meta Ads Dashboard Test Suite"
echo "================================"

# Renkler
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonksiyonlar
run_backend_tests() {
    echo -e "${YELLOW}📦 Backend testleri çalıştırılıyor...${NC}"
    
    # Container'da pytest çalıştır
    docker exec metaadsmanager-backend-1 pip install -q -r requirements-dev.txt
    docker exec metaadsmanager-backend-1 pytest app/tests/unit -v --tb=short
    
    echo -e "${GREEN}✅ Backend unit testleri tamamlandı${NC}"
}

run_backend_tests_with_coverage() {
    echo -e "${YELLOW}📊 Backend testleri coverage ile çalıştırılıyor...${NC}"
    
    docker exec metaadsmanager-backend-1 pip install -q -r requirements-dev.txt
    docker exec metaadsmanager-backend-1 pytest --cov=app --cov-report=term-missing --cov-report=html -v
    
    # Coverage raporunu host'a kopyala
    docker cp metaadsmanager-backend-1:/app/htmlcov ./backend/htmlcov || true
    
    echo -e "${GREEN}✅ Backend coverage raporu hazır: backend/htmlcov/index.html${NC}"
}

run_integration_tests() {
    echo -e "${YELLOW}🔗 Integration testleri çalıştırılıyor...${NC}"
    
    docker exec metaadsmanager-backend-1 pytest app/tests/integration -v --tb=short
    
    echo -e "${GREEN}✅ Integration testleri tamamlandı${NC}"
}

run_frontend_tests() {
    echo -e "${YELLOW}⚛️ Frontend testleri çalıştırılıyor...${NC}"
    
    docker exec metaadsmanager-frontend-1 npm test
    
    echo -e "${GREEN}✅ Frontend testleri tamamlandı${NC}"
}

run_all_tests() {
    echo -e "${YELLOW}🚀 Tüm testler çalıştırılıyor...${NC}"
    run_backend_tests
    run_integration_tests
    run_frontend_tests
    echo -e "${GREEN}✅ Tüm testler tamamlandı!${NC}"
}

# Ana menü
case "${1:-all}" in
    backend|b)
        run_backend_tests
        ;;
    coverage|c)
        run_backend_tests_with_coverage
        ;;
    integration|i)
        run_integration_tests
        ;;
    frontend|f)
        run_frontend_tests
        ;;
    all|a)
        run_all_tests
        ;;
    *)
        echo "Kullanım: $0 [backend|coverage|integration|frontend|all]"
        echo ""
        echo "Seçenekler:"
        echo "  backend, b     - Sadece backend unit testleri"
        echo "  coverage, c    - Backend testleri coverage raporu ile"
        echo "  integration, i - Sadece integration testleri"
        echo "  frontend, f    - Sadece frontend testleri"
        echo "  all, a         - Tüm testler (varsayılan)"
        exit 1
        ;;
esac
