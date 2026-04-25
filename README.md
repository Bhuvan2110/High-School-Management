# 🏫 High School Management System

> Classes 8–10 | Node.js + Express + MySQL | JWT Auth | Role-Based Access | E2EE (Phase 4)

---

## 📁 Project Structure

```
highschool-mgmt/
├── backend/
│   ├── config/
│   │   └── db.js              ← MySQL connection pool
│   ├── controllers/
│   │   └── authController.js  ← register, login, logout, refresh, getMe
│   ├── middleware/
│   │   ├── auth.js            ← verifyToken, requireRole, adminOnly...
│   │   └── errorHandler.js    ← global error + 404 handlers
│   ├── models/
│   │   ├── User.js            ← all users table queries
│   │   └── RefreshToken.js    ← token rotation & revocation
│   ├── routes/
│   │   ├── auth.js            ← POST /register /login /refresh /logout GET /me
│   │   └── health.js          ← GET /api/health
│   ├── utils/
│   │   ├── auditLogger.js     ← append-only audit log writer
│   │   ├── jwt.js             ← generate + verify access/refresh tokens
│   │   ├── response.js        ← standardized API response helpers
│   │   └── validators.js      ← input validation functions
│   ├── app.js                 ← Express app (middlewares + routes)
│   ├── server.js              ← entry point — DB check then listen
│   ├── .env                   ← your environment variables (never commit!)
│   └── .env.example           ← template for .env
│
├── frontend/
│   ├── css/
│   │   └── style.css          ← complete design system (CSS variables, components)
│   ├── js/
│   │   └── api.js             ← fetch wrapper, Auth helper, UI helpers
│   └── pages/
│       ├── login.html         ← login + register page
│       ├── admin.html         ← admin dashboard
│       ├── teacher.html       ← teacher dashboard
│       └── student.html       ← student dashboard
│
└── database/
    └── schema.sql             ← complete DB schema + seed data (run once)
```

---

## 🚀 Setup Instructions

### Step 1 — Prerequisites
- Node.js v18+ installed
- MySQL 8.0+ running locally
- A MySQL client (MySQL Workbench, DBeaver, or CLI)

### 🌐 Production Deployment

The system is designed to be cloud-ready. To deploy:

1.  **Backend**: Host the `backend` folder on platforms like **Render**, **Railway**, or **Google Cloud Run**. Ensure the `PORT` and `CORS_ORIGIN` environment variables are set.
2.  **Database**: Use a managed MySQL service (e.g., Aiven, PlanetScale, or Google Cloud SQL) and update the `DB_*` variables in the production environment.
3.  **Frontend**: The frontend is static and can be hosted on **Vercel**, **Netlify**, or **Firebase Hosting**.

#### Environment Variables for Production:
```env
NODE_ENV=production
PORT=5000
DB_HOST=your-prod-db-host
DB_USER=your-prod-db-user
DB_PASSWORD=your-prod-db-password
DB_NAME=highschool_db
JWT_SECRET=your-long-secure-secret
CORS_ORIGIN=https://your-frontend-domain.com
```
#### 🚀 Deploy to Vercel (Frontend)

1.  Connect your repository to **[Vercel](https://vercel.com)**.
2.  Vercel will detect `vercel.json` and deploy your static frontend automatically.
3.  Your app will be live at `https://highschool-mgmt-frontend.vercel.app`.

#### 🚀 Deploy to Koyeb (Backend)

1.  Create a new Web Service on **[Koyeb](https://www.koyeb.com)**.
2.  Select your repository and the `backend` folder.
3.  Koyeb will use the `Dockerfile` to build and deploy your Node.js API.
4.  Your API will be live at `https://your-service-name.koyeb.app`.

### Step 2 — Database Setup
```sql
-- Open your MySQL client and run:
source /path/to/highschool-mgmt/database/schema.sql
```
This creates the database, all 12 tables, and seeds:
- Default admin account: `sbhuvan847@gmail.com` / `Admin@1234`
- Classes 8, 9, 10 with sections A, B, C
- 7 default subjects

### Step 3 — Backend Setup
```bash
cd backend

# Install dependencies (already done if you followed along)
npm install

# Edit .env with your MySQL password:
# DB_PASSWORD=your_actual_mysql_password

# Start development server
npm run dev
```
Server runs at: **http://localhost:5000**

### Step 4 — Frontend
Open any HTML page directly in your browser:
```
frontend/pages/login.html
```
Or serve with a simple HTTP server:
```bash
# From the highschool-mgmt root:
npx serve . -p 3000
# Then open: http://localhost:3000/frontend/pages/login.html
```

### Step 5 — Test the API
```bash
# Health check
curl http://localhost:5000/api/health

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sbhuvan847@gmail.com","password":"Admin@1234"}'

# Register a new student
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Student","email":"student@test.com","password":"Student@1234","role":"student"}'
```

---

## 🔑 Default Credentials

| Role    | Email                  | Password       |
|---------|------------------------|----------------|
| Admin   | sbhuvan847@gmail.com   | Admin@1234     |
| Teacher | *(register one)*       | Teacher@1234   |
| Student | *(register one)*       | Student@1234   |

> ⚠️ Change the admin password immediately after first login in production!

---

## 🔐 API Endpoints — Phase 1

| Method | Endpoint             | Auth Required | Description              |
|--------|----------------------|---------------|--------------------------|
| GET    | /api/health          | No            | Server + DB status       |
| POST   | /api/auth/register   | No            | Create new account       |
| POST   | /api/auth/login      | No            | Login, receive JWT       |
| POST   | /api/auth/refresh    | No (cookie)   | Rotate refresh token     |
| POST   | /api/auth/logout     | Yes           | Revoke refresh token     |
| GET    | /api/auth/me         | Yes           | Get current user profile |

---

## 🗺️ Phase Roadmap

| Phase | Status      | What's Built                                              |
|-------|-------------|-----------------------------------------------------------|
| 1     | ✅ Done      | Project setup, DB schema, auth system, all 4 UI pages    |
| 2     | ⏳ Next      | Admin CRUD APIs (classes, sections, subjects, users)      |
| 3     | 🔜 Planned  | Student/Teacher modules, attendance, marks, materials     |
| 4     | 🔜 Planned  | End-to-End Encryption (AES-256-GCM + RSA key wrapping)   |
| 5     | 🔜 Planned  | Testing, security audit, Docker, CI/CD deployment        |
| 6     | 🔜 Planned  | Parent dashboard, analytics, dark mode                    |

---

## 🛡️ Security Implemented (Phase 1)

- ✅ bcrypt password hashing (12 salt rounds)
- ✅ JWT access tokens (15 min) + refresh tokens (7 days)
- ✅ HttpOnly + Secure + SameSite=Strict cookies
- ✅ Refresh token rotation (old token revoked on each use)
- ✅ Helmet.js security headers
- ✅ CORS whitelist
- ✅ Global + auth-specific rate limiting
- ✅ Audit logging (every action recorded)
- ✅ RBAC middleware (adminOnly, teacherOnly, etc.)
- ✅ Role enforced at API level — not just frontend
- ✅ Parameterized SQL queries (no injection possible)
- ✅ Input validation + sanitization on all inputs
- ✅ Graceful error handling (no stack traces exposed)
