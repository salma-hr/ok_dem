# LEONI OK Démarrage – Digitalisation des Checklists

## 📖 Description

Ce projet a été réalisé dans le cadre de mon **Projet de Fin d'Études (PFE)** au sein de **LEONI Wiring Systems Tunisia**.

L'objectif est de digitaliser le processus **OK Démarrage** afin de remplacer les checklists papier par une solution numérique assurant la traçabilité, le suivi des validations, la gestion des non-conformités et l'aide à la décision grâce à l'intelligence artificielle.

---

## ✨ Fonctionnalités

- Authentification sécurisée (JWT)
- Gestion des utilisateurs et des rôles
- Gestion des sites, usines, segments et processus
- Gestion des machines
- Création et remplissage des checklists
- Validation multi-niveaux
- Gestion des non-conformités
- Gestion des plans d'action
- Notifications automatiques
- Import automatique des critères depuis des fichiers PDF
- Traduction automatique des critères
- Détection des anomalies via un microservice d'IA
- Tableau de bord interactif
- Génération de rapports PDF

---

## 🛠️ Technologies utilisées

### Frontend

- React.js
- Vite
- Material UI
- Axios
- React Router
- Chart.js

### Backend

- Spring Boot
- Spring Security
- JWT
- Spring Data JPA
- Hibernate
- Maven

### Intelligence Artificielle

- Python
- FastAPI
- Scikit-learn
- Isolation Forest

### Base de données

- MySQL

### Outils

- Docker
- LibreTranslate
- Git
- GitHub
- Postman

---

## 🏗️ Architecture

```text
                React Frontend
                       │
                       ▼
            Spring Boot REST API
                       │
          ┌────────────┴────────────┐
          │                         │
          ▼                         ▼
      MySQL Database         Python FastAPI
                                     │
                                     ▼
                       Détection d'anomalies (IA)
```

---

## 🚀 Installation

### 1. Cloner le dépôt

```bash
git clone https://github.com/salma-hr/ok_dem.git
```

### 2. Configurer MySQL

```sql
CREATE DATABASE leoni_checklist
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;
```

### 3. Configurer les variables d'environnement

```bash
cp .env.example .env
```

Renseigner les paramètres nécessaires dans le fichier `.env`.

### 4. Lancer LibreTranslate

```bash
docker-compose up -d
```

### 5. Lancer le microservice Python

```bash
cd pdfcritere
pip install -r requirements.txt
python pdf_extractor_service.py
```

### 6. Lancer le backend

```bash
cd back
mvn spring-boot:run
```

### 7. Lancer le frontend

```bash
cd front
npm install
npm run dev
```

---

## 📂 Structure du projet

```text
ok_dem/
├── front/                # Application React
├── back/                 # API Spring Boot
├── pdfcritere/           # Microservice Python
├── LeoniMobile_Expo55/   # Application mobile
├── docker-compose.yml
├── README.md
└── ok_db.sql
```

---

## 📸 Captures d'écran

À compléter avec des captures de :

- Écran de connexion
- Tableau de bord
- Gestion des checklists
- Validation des checklists
- Gestion des non-conformités
- Génération des rapports PDF

---

## 👩‍💻 Auteur

**Salma Hrabi**

Projet de Fin d'Études – Licence en Technologie de l'Information

ISET Sousse – 2026
