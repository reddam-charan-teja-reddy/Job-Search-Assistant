# Job Search Assistant — Full Technical Documentation

This document describes the architecture, authentication system, backend API routes, frontend components, data models, and how both parts work together.

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication System](#authentication-system)
3. [Backend Architecture](#backend-architecture)
4. [API Routes Reference](#api-routes-reference)
5. [Database Schema](#database-schema)
6. [Frontend Architecture](#frontend-architecture)
7. [Data Flow](#data-flow)
8. [Security](#security)
9. [Debugging](#debugging)
10. [Deployment](#deployment)
11. [Contributing](#contributing)

---

## Overview

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                 │
│   React 18 + TypeScript + Vite + Tailwind CSS v4                │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│   │ AuthPage │ │ ChatPage │ │ HomePage │ │Interview │          │
│   └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│         │            │            │            │                 │
│   ┌─────────────────────────────────────────────────┐           │
│   │        AuthContext + Services Layer             │           │
│   │   (auth.ts, api.ts, token management)          │           │
│   └─────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
                              │ JWT Auth
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Backend                                  │
│   FastAPI + Python 3.11+                                        │
│   ┌──────────────────────────────────────────────────┐          │
│   │              Routes Layer (Modular)              │          │
│   │  auth_routes │ user_routes │ chat_routes │ ...  │          │
│   └──────────────────────────────────────────────────┘          │
│         │               │              │                         │
│   ┌─────────────────────────────────────────────────┐           │
│   │            Services & Clients                    │           │
│   │  chat_service │ interview_service │ jsearch     │           │
│   └─────────────────────────────────────────────────┘           │
│         │               │              │                         │
│   ┌─────────────────────────────────────────────────┐           │
│   │     Core: auth.py │ db.py │ models.py           │           │
│   └─────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
    ┌─────────┐        ┌───────────┐        ┌──────────┐
    │ MongoDB │        │ Gemini AI │        │ JSearch  │
    │  Atlas  │        │    API    │        │   API    │
    └─────────┘        └───────────┘        └──────────┘
```

### Key Technologies

| Layer    | Technology                                          |
| -------- | --------------------------------------------------- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS v4         |
| Backend  | FastAPI, Python 3.11+, Pydantic                     |
| Database | MongoDB Atlas with Motor (async driver)             |
| Auth     | JWT (HS256) + bcrypt password hashing               |
| AI       | Google Gemini API (chat, parsing, function calling) |
| Jobs     | JSearch API (RapidAPI)                              |
| Voice    | Retell AI (mock interviews)                         |

---

## Authentication System

### Overview

The application uses industry-standard JWT-based authentication with:

- **Access Tokens**: Short-lived (30 min) for API requests
- **Refresh Tokens**: Longer-lived (7 days) for obtaining new access tokens
- **Password Hashing**: bcrypt with cost factor 12

### Backend Auth Module (`backend/core/auth.py`)

```python
# Key configurations
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7
BCRYPT_COST_FACTOR = 12
```

#### Password Security

- **Hashing**: bcrypt with cost factor 12 (~250ms per hash)
- **Validation**: OWASP-compliant password requirements:
  - Minimum 8 characters
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one digit
  - At least one special character

#### Token Structure

```python
# Access Token Payload
{
    "sub": "user_id",
    "email": "user@example.com",
    "type": "access",
    "exp": datetime,
    "iat": datetime
}

# Refresh Token Payload
{
    "sub": "user_id",
    "type": "refresh",
    "exp": datetime,
    "iat": datetime
}
```

#### Key Functions

| Function                         | Purpose                      |
| -------------------------------- | ---------------------------- |
| `hash_password(password)`        | Hash password with bcrypt    |
| `verify_password(plain, hashed)` | Verify password against hash |
| `create_access_token(data)`      | Generate JWT access token    |
| `create_refresh_token(data)`     | Generate JWT refresh token   |
| `verify_token(token, type)`      | Validate and decode token    |
| `get_current_user(token)`        | FastAPI dependency for auth  |

### Frontend Auth (`frontend/src/services/auth.ts`)

#### Token Management

```typescript
// Token storage (localStorage)
const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const USER_KEY = "auth_user";

// Auto-refresh before expiry
// Tokens are automatically refreshed when API returns 401
```

#### AuthContext (`frontend/src/context/AuthContext.tsx`)

Provides authentication state to the entire app:

```typescript
interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email, password) => Promise<LoginResponse>;
  register: (
    email,
    password,
    confirmPassword,
    name,
  ) => Promise<RegisterResponse>;
  logout: () => Promise<void>;
  updateUser: (userData) => void;
  refreshUser: () => Promise<void>;
}
```

### Auth Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                     REGISTRATION                              │
├──────────────────────────────────────────────────────────────┤
│  User → /auth/register → Validate → Hash Password → Store   │
│       ← { access_token, refresh_token, user }                │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                        LOGIN                                  │
├──────────────────────────────────────────────────────────────┤
│  User → /auth/login → Verify Password → Generate Tokens     │
│       ← { access_token, refresh_token, user }                │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                   API REQUEST                                 │
├──────────────────────────────────────────────────────────────┤
│  Request + Bearer Token → Validate Token → Process Request  │
│  If 401 → Try Refresh → Retry Request                        │
│  If Refresh Fails → Logout User                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Backend Architecture

### File Structure

```
backend/
├── main.py                    # FastAPI app entry point
│
├── core/                      # Core modules
│   ├── __init__.py
│   ├── auth.py                # JWT & password security
│   ├── db.py                  # MongoDB connection
│   └── models.py              # Pydantic data models
│
├── services/                  # Business logic layer
│   ├── __init__.py
│   ├── chat_service.py        # Gemini chat with function calling
│   └── interview_service.py   # Retell AI & interview logic
│
├── clients/                   # External API clients
│   ├── __init__.py
│   ├── jsearch_client.py      # JSearch API client
│   └── gemini_client.py       # Gemini API utilities
│
├── routes/                    # API route handlers (modular)
│   ├── __init__.py
│   ├── auth_routes.py         # /api/auth/* endpoints
│   ├── user_routes.py         # Profile, onboarding
│   ├── chat_routes.py         # Chat sessions, messages
│   ├── jobs_routes.py         # Save, unsave, apply jobs
│   └── interview_routes.py    # Interview management
│
├── requirements.txt           # Python dependencies
└── .env                       # Environment variables
```

### Environment Variables

```env
# Database
MONGODB_URI=mongodb+srv://...

# AI Services
GEMINI_API_KEY=...
JSEARCH_API_KEY=...

# Authentication
JWT_SECRET_KEY=...              # Min 32 chars, secure random
JWT_REFRESH_SECRET_KEY=...      # Min 32 chars, secure random

# Voice Interviews
RETELL_API_KEY=...
RETELL_AGENT_ID_1=...
RETELL_AGENT_ID_2=...
RETELL_AGENT_ID_3=...
```

### Main Entry (`main.py`)

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import routers
from routes.auth_routes import router as auth_router
from routes.user_routes import router as user_router
from routes.chat_routes import router as chat_router
from routes.jobs_routes import router as jobs_router
from routes.interview_routes import router as interview_router

app = FastAPI(title="Job Search Assistant API")

# CORS configuration
app.add_middleware(CORSMiddleware, ...)

# Register routers
app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(user_router, prefix="/api", tags=["User"])
app.include_router(chat_router, prefix="/api", tags=["Chat"])
app.include_router(jobs_router, prefix="/api", tags=["Jobs"])
app.include_router(interview_router, prefix="/api", tags=["Interviews"])
```

---

## API Routes Reference

### Authentication Routes (`/api/auth/*`)

| Method | Endpoint    | Description              | Auth Required |
| ------ | ----------- | ------------------------ | ------------- |
| POST   | `/register` | Create new account       | No            |
| POST   | `/login`    | Login & get tokens       | No            |
| POST   | `/refresh`  | Refresh access token     | Refresh Token |
| POST   | `/logout`   | Invalidate tokens        | Yes           |
| GET    | `/me`       | Get current user profile | Yes           |

#### POST `/api/auth/register`

**Request:**

```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "confirm_password": "SecurePass123!",
  "name": "John Doe"
}
```

**Response:**

```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe",
    "is_onboarded": false,
    "skills": [],
    "experience": []
  }
}
```

#### POST `/api/auth/login`

**Request:**

```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:** Same as register

---

### User Routes (`/api/*`)

| Method | Endpoint                    | Description           |
| ------ | --------------------------- | --------------------- |
| POST   | `/onboardFileUpload`        | Parse resume PDF      |
| POST   | `/confirmOnboardingDetails` | Complete onboarding   |
| POST   | `/updateUserProfile`        | Update profile fields |

#### POST `/api/onboardFileUpload`

- **Content-Type**: `application/pdf`
- **Body**: Raw PDF file bytes
- **Process**: Extracts text → Gemini parses structured data
- **Response**: `UserOnboardingResponse` with extracted profile fields

#### POST `/api/confirmOnboardingDetails`

**Request:**

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "location": "New York, NY",
  "skills": ["Python", "React", "FastAPI"],
  "experience": ["Software Engineer at Company X (2020-2023)"],
  "education": ["BS Computer Science, MIT"],
  "profile_summary": "Full-stack developer..."
}
```

---

### Chat Routes (`/api/*`)

| Method | Endpoint           | Description                    |
| ------ | ------------------ | ------------------------------ |
| GET    | `/chatHistory`     | Get user's chat sessions       |
| POST   | `/createChat`      | Create new chat session        |
| POST   | `/sendMessage`     | Send message & get AI response |
| GET    | `/getChatMessages` | Get messages for a chat        |
| DELETE | `/chat/{chatId}`   | Delete a chat session          |

#### POST `/api/sendMessage`

**Request:**

```json
{
  "chat_id": "507f1f77bcf86cd799439011",
  "message": "Find me backend developer jobs",
  "selected_job_id": null,
  "selected_job_data": null
}
```

**Response:**

```json
{
  "message": "I found several backend developer positions...",
  "jobs": [
    {
      "job_id": "abc123",
      "job_title": "Senior Backend Developer",
      "employer_name": "Tech Corp",
      "job_location": "Remote",
      "job_salary": "$120k - $150k"
    }
  ],
  "selected_job_details": null
}
```

---

### Jobs Routes (`/api/*`)

| Method | Endpoint            | Description         |
| ------ | ------------------- | ------------------- |
| GET    | `/getSavedJobs`     | Get saved jobs      |
| GET    | `/getAppliedJobs`   | Get applied jobs    |
| POST   | `/saveJob`          | Save a job          |
| DELETE | `/savedJob/{jobId}` | Unsave a job        |
| POST   | `/applyJob`         | Mark job as applied |

---

### Interview Routes (`/api/*`)

| Method | Endpoint              | Description                   |
| ------ | --------------------- | ----------------------------- |
| GET    | `/interviewers`       | Get AI interviewer profiles   |
| POST   | `/createInterview`    | Create custom interview       |
| POST   | `/createJobInterview` | Create job-specific interview |
| GET    | `/interviews`         | Get user's interviews         |
| GET    | `/interview/{id}`     | Get interview details         |
| POST   | `/registerCall`       | Start voice call session      |
| POST   | `/analyzeInterview`   | Get performance analytics     |

---

## Database Schema

### Users Collection

```javascript
{
  "_id": ObjectId,
  "email": "user@example.com",
  "password_hash": "$2b$12$...",        // bcrypt hash
  "name": "John Doe",
  "phone": "+1234567890",
  "location": "New York, NY",
  "skills": ["Python", "React", "FastAPI"],
  "experience": ["Software Engineer at Company X (2020-2023)"],
  "education": ["BS Computer Science, MIT"],
  "projects": ["E-commerce Platform", "Chat Application"],
  "certifications": ["AWS Certified Developer"],
  "profile_summary": "Full-stack developer with 5 years experience...",
  "is_onboarded": true,
  "created_at": ISODate,
  "updated_at": ISODate,

  // Embedded arrays
  "saved_jobs": [
    {
      "job_id": "abc123",
      "job_title": "Backend Developer",
      "company_name": "Tech Corp",
      "job_link": "https://..."
    }
  ],
  "applied_jobs": [...],

  "chat_history": [
    {
      "_id": ObjectId,
      "chat_name": "Job Search - Backend",
      "messages": [
        {
          "sender": "bot",
          "message": "Hello! How can I help?",
          "timestamp": ISODate
        }
      ],
      "context": {
        "permanent_context": {...},
        "conversation_summary": "...",
        "recent_messages": [...],
        "selected_job": null
      },
      "created_at": ISODate
    }
  ]
}
```

### Interviews Collection

```javascript
{
  "_id": ObjectId,
  "user_id": ObjectId,
  "name": "Backend Interview Practice",
  "objective": "Practice for backend developer role",
  "interviewer_id": "interviewer_1",
  "questions": [
    {
      "question": "Tell me about yourself",
      "follow_up_count": 2
    }
  ],
  "job_context": {
    "job_title": "Backend Developer",
    "company_name": "Tech Corp"
  },
  "created_at": ISODate
}
```

---

## Frontend Architecture

### File Structure

```
frontend/src/
├── main.tsx                   # Entry point
├── App.tsx                    # Main app with routing
├── index.css                  # Global styles
│
├── context/
│   └── AuthContext.tsx        # Authentication state
│
├── services/
│   ├── api.ts                 # API client functions
│   └── auth.ts                # Auth utilities
│
├── components/
│   ├── AuthPage.tsx           # Login/Register
│   ├── OnboardingPage.tsx     # Resume upload
│   ├── HomePage.tsx           # Dashboard
│   ├── ChatPage.tsx           # AI chat
│   ├── ProfilePage.tsx        # User profile
│   ├── InterviewPrepPage.tsx  # Interview dashboard
│   ├── InterviewRoomPage.tsx  # Voice interview
│   ├── JobCard.tsx            # Job card component
│   ├── JobDetailModal.tsx     # Job details
│   ├── theme-provider.tsx     # Theme context
│   ├── ThemeToggle.tsx        # Dark/light toggle
│   └── ui/                    # Reusable UI components
│
└── styles/
    └── globals.css            # Tailwind theme config
```

### Application Routes

| Route                     | Component         | Auth Required | Onboarded Required |
| ------------------------- | ----------------- | ------------- | ------------------ |
| `/auth`                   | AuthPage          | No            | No                 |
| `/`                       | Redirect          | -             | -                  |
| `/onboarding`             | OnboardingPage    | Yes           | No                 |
| `/home`                   | HomePage          | Yes           | Yes                |
| `/chat/:chatId`           | ChatPage          | Yes           | Yes                |
| `/profile`                | ProfilePage       | Yes           | Yes                |
| `/interview-prep`         | InterviewPrepPage | Yes           | Yes                |
| `/interview/:interviewId` | InterviewRoomPage | Yes           | Yes                |

### State Management

The app uses a combination of:

1. **AuthContext**: Global authentication state
2. **App.tsx State**: User profile, jobs, chats
3. **localStorage**: Persistence across sessions

```typescript
// App.tsx state
const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
const [savedJobs, setSavedJobs] = useState<Job[]>([]);
const [appliedJobs, setAppliedJobs] = useState<Job[]>([]);
const [chats, setChats] = useState<Chat[]>([]);
const [isOnboarded, setIsOnboarded] = useState(() => {
  // Initialize from localStorage synchronously
  const stored = localStorage.getItem("isOnboarded");
  return stored ? JSON.parse(stored) === true : false;
});
```

---

## Data Flow

### 1. Authentication Flow

```
┌─────────┐     ┌──────────┐     ┌─────────┐     ┌──────────┐
│ AuthPage│ ──► │ auth.ts  │ ──► │ Backend │ ──► │ MongoDB  │
│         │ ◄── │ (tokens) │ ◄── │ /auth/* │ ◄── │          │
└─────────┘     └──────────┘     └─────────┘     └──────────┘
                     │
                     ▼
              ┌──────────────┐
              │ AuthContext  │ ──► App State
              │ (user state) │
              └──────────────┘
```

### 2. Chat with AI Flow

```
User Message
     │
     ▼
┌──────────────┐     ┌─────────────────────────────────┐
│ ChatPage.tsx │ ──► │ POST /api/sendMessage           │
└──────────────┘     └─────────────────────────────────┘
                                  │
                                  ▼
                     ┌─────────────────────────────────┐
                     │ chat_service.py                 │
                     │ - Build context (profile, jobs) │
                     │ - Send to Gemini AI             │
                     │ - Handle function calls         │
                     └─────────────────────────────────┘
                                  │
           ┌──────────────────────┼──────────────────────┐
           ▼                      ▼                      ▼
    ┌─────────────┐       ┌─────────────┐       ┌─────────────┐
    │ Text Reply  │       │ search_jobs │       │ get_details │
    └─────────────┘       │ → JSearch   │       │ → JSearch   │
                          └─────────────┘       └─────────────┘
                                  │
                                  ▼
                     ┌─────────────────────────────────┐
                     │ Response: message + job cards   │
                     └─────────────────────────────────┘
                                  │
                                  ▼
                     ┌─────────────────────────────────┐
                     │ ChatPage displays jobs inline   │
                     └─────────────────────────────────┘
```

### 3. Interview Flow

```
User Creates Interview
     │
     ▼
┌────────────────────┐     ┌──────────────────────────┐
│ InterviewPrepPage  │ ──► │ POST /api/createInterview│
└────────────────────┘     └──────────────────────────┘
                                      │
                                      ▼
                           ┌──────────────────────────┐
                           │ interview_service.py     │
                           │ - Generate questions     │
                           │ - Create interview doc   │
                           └──────────────────────────┘
                                      │
                                      ▼
                           ┌──────────────────────────┐
                           │ InterviewRoomPage        │
                           │ - Register Retell call   │
                           │ - Voice conversation     │
                           │ - Get analytics          │
                           └──────────────────────────┘
```

---

## Security

### Password Requirements (OWASP)

- Minimum 8 characters
- Maximum 128 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one digit (0-9)
- At least one special character (!@#$%^&\*...)

### Token Security

- Access tokens expire in 30 minutes
- Refresh tokens expire in 7 days
- Tokens are validated on every request
- Invalid tokens result in 401 Unauthorized

### API Security

- All endpoints (except auth) require valid JWT
- User ID extracted from token, not request body
- Rate limiting ready (configure in production)
- CORS configured for allowed origins

### Data Protection

- Passwords never stored in plain text
- Email addresses masked in logs
- Sensitive data not logged
- MongoDB connection uses TLS

---

## Debugging

### Backend Logging Tags

| Tag              | Description               |
| ---------------- | ------------------------- |
| `[AUTH]`         | Authentication operations |
| `[REGISTER]`     | User registration         |
| `[LOGIN]`        | Login attempts            |
| `[TOKEN]`        | Token operations          |
| `[ONBOARD]`      | Onboarding flow           |
| `[CREATE_CHAT]`  | Chat creation             |
| `[SEND_MESSAGE]` | Message handling          |
| `[CHAT_SERVICE]` | AI chat processing        |
| `[JSEARCH]`      | Job search API calls      |
| `[SAVE_JOB]`     | Job operations            |
| `[INTERVIEW]`    | Interview operations      |
| `[RETELL]`       | Retell AI calls           |

### Common Issues

| Issue                    | Solution                            |
| ------------------------ | ----------------------------------- |
| 401 Unauthorized         | Token expired, refresh or re-login  |
| 422 Validation Error     | Check request body matches schema   |
| Empty job results        | Broaden search query, check filters |
| Onboarding redirect loop | Check `is_onboarded` in user doc    |

---

## Deployment

### Backend

```bash
# Install production dependencies
pip install -r requirements.txt

# Run with Uvicorn
uvicorn main:app --host 0.0.0.0 --port 8000

# Or with Gunicorn (production)
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker
```

### Frontend

```bash
# Build for production
npm run build

# Output in frontend/build/
# Serve with any static file server
```

### Production Checklist

- [ ] Set secure JWT secret keys (min 32 chars)
- [ ] Enable HTTPS
- [ ] Configure CORS for production domains
- [ ] Set up MongoDB Atlas with proper security
- [ ] Configure Retell AI webhook URL
- [ ] Set up monitoring and error tracking
- [ ] Enable rate limiting
- [ ] Configure backup strategy

---

## Contributing

### Guidelines

1. **Branching**: Create feature branches from `main`
2. **Code Style**: Follow existing patterns (TypeScript/Python)
3. **Commits**: Clear, imperative style ("Add feature", not "Added")
4. **PRs**: Include description, test steps, screenshots if UI changes

### Adding Features

1. **Backend**: Update models.py → Add route → Add logging → Document
2. **Frontend**: Add component → Wire in api.ts → Update App.tsx routes
3. **Both**: Update this documentation

### Code Review Checklist

- [ ] No secrets or credentials in code
- [ ] All endpoints have proper auth
- [ ] Error handling implemented
- [ ] Logging added with appropriate tags
- [ ] Documentation updated
