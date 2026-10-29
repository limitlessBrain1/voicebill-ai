# VoiceBill AI 🛒⚡

**VoiceBill AI** is a production-ready, full-stack grocery and kirana store billing and management platform.

---

## 📌 Project Architecture

```
VoiceBill.AI/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI entry point & CORS configuration
│   │   ├── api/
│   │   │   ├── __init__.py      # API routers aggregator
│   │   │   └── health.py        # GET /api/health endpoint
│   │   ├── core/
│   │   │   ├── __init__.py
│   │   │   └── config.py        # Pydantic v2 application settings
│   │   ├── database/
│   │   │   ├── __init__.py
│   │   │   └── session.py       # SQLAlchemy 2.x session & engine setup
│   │   ├── models/              # Database models (User, Store, Product, Bill)
│   │   │   └── __init__.py
│   │   ├── schemas/             # Pydantic validation schemas
│   │   │   └── __init__.py
│   │   ├── services/            # Business logic layer
│   │   │   └── __init__.py
│   │   └── utils/               # Utility functions
│   │       └── __init__.py
│   ├── alembic/                 # Alembic migration management
│   │   ├── versions/
│   │   ├── env.py
│   │   └── script.py.mako
│   ├── alembic.ini              # Alembic config file
│   ├── requirements.txt         # Python dependencies
│   ├── .env.example             # Environment template
│   └── .env                     # Local environment settings
│
├── frontend/
│   ├── src/
│   │   ├── components/          # Reusable UI components (Header, Footer, etc.)
│   │   ├── context/             # React context providers
│   │   ├── hooks/               # Custom hooks (useHealthCheck)
│   │   ├── layouts/             # Page layouts (MainLayout)
│   │   ├── pages/               # Application pages (HomePage)
│   │   ├── services/            # Axios API client & endpoints
│   │   ├── utils/               # Formatting and utility helpers
│   │   ├── App.tsx              # Root component with React Router
│   │   ├── main.tsx             # React entry point
│   │   └── index.css            # Tailwind directives & theme styles
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   └── vite.config.ts
│
├── .gitignore
└── README.md
```

---

## 🛠️ Tech Stack

### Backend
- **Python 3.11+**
- **FastAPI**: Modern, high-performance web framework
- **SQLAlchemy 2.x**: Object-relational mapping
- **PostgreSQL**: Robust relational database
- **Alembic**: Database schema migrations
- **Pydantic v2 & pydantic-settings**: Type-safe data validation and configuration
- **JWT & Passlib/bcrypt**: Authentication & password hashing

### Frontend
- **React 18**
- **Vite**: Ultra-fast build tool and dev server
- **TypeScript**: Type safety across UI and API client
- **Tailwind CSS**: Modern utility-first styling with custom Kirana design system
- **Axios**: HTTP client configured for backend connectivity
- **React Router 6**: Client-side declarative routing
- **Lucide React**: Modern iconography

---

## 🚀 Running the Backend

### 1. Navigate to the backend directory:
```powershell
cd backend
```

### 2. Create and activate a virtual environment:
```powershell
# Windows PowerShell:
python -m venv venv
.\venv\Scripts\Activate.ps1

# Linux / macOS:
python3 -m venv venv
source venv/bin/activate
```

### 3. Install dependencies:
```powershell
pip install -r requirements.txt
```

### 4. Configure environment:
Verify or edit `.env` (copied from `.env.example`):
```ini
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/voicebill_db"
SECRET_KEY="voicebill-ai-dev-secret-key-do-not-use-in-production"
BACKEND_CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173"]
```

### 5. Start the FastAPI development server:
```powershell
uvicorn app.main:app --reload --port 8000
```

- **Health Check**: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)
- **Interactive OpenAPI Docs**: [http://127.0.0.1:8000/api/docs](http://127.0.0.1:8000/api/docs)

---

## 🎨 Running the Frontend

### 1. Navigate to the frontend directory:
```powershell
cd frontend
```

### 2. Install dependencies:
```powershell
npm install
```

### 3. Start the Vite dev server:
```powershell
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧪 Verifying the Setup

### Test Backend Health Endpoint:
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/health" -Method Get
```

**Expected Response**:
```json
{
  "status": "ok",
  "message": "VoiceBill AI backend is running"
}
```
