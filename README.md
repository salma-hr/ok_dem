# Leoni Checklist — Guide d'installation

## Prérequis
- Java 17+
- Maven 3.8+
- Node.js 18+
- Python 3.10+
- MySQL 8+
- Docker (pour LibreTranslate)

## Étapes d'installation

### 1. Base de données
```sql
CREATE DATABASE leoni_checklist 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;
```

### 2. Variables d'environnement
```bash
cp .env.example .env
# Remplir les valeurs dans .env
```

### 3. LibreTranslate (traduction)
```bash
docker-compose up -d
# Attendre "Running on http://0.0.0.0:5000"
```

### 4. Extracteur PDF (Python)
```bash
cd pdfcritere
pip install -r requirements.txt
python pdf_extractor_service.py
# Tourne sur http://localhost:8002
```

### 5. Backend (Spring Boot)
```bash
cd back
mvn spring-boot:run
# Tourne sur http://localhost:8080
```

### 6. Frontend (React)
```bash
cd front
npm install
npm run dev
# Tourne sur http://localhost:5173
```

## Ordre de démarrage (production)
1. MySQL
2. LibreTranslate (Docker)
3. PDF Extractor (Python)
4. Backend (Spring Boot)
5. Frontend (React)