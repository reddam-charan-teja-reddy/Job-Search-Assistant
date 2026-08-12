# Job Search Assistant with AI Chatbot & Mock Interviews

Production Link: https://job-search-assistant-frontend.vercel.app/

A full-stack job search application powered by AI that helps users discover job opportunities, manage applications, and prepare for interviews. Features an intelligent chatbot for job discovery, voice-based AI mock interviews, and comprehensive user profile management.

## 📚 Documentation

- **Full Documentation**: [documentation.md](documentation.md)
- **Frontend Guide**: [frontend/README.md](frontend/README.md)
- **Backend Dependencies**: [backend/requirements.txt](backend/requirements.txt)

## ✨ Key Features

### 🔐 Secure Authentication

- **JWT-based Authentication**: Industry-standard security with access & refresh tokens
- **Password Security**: bcrypt hashing with cost factor 12, OWASP-compliant password validation
- **Protected Routes**: All API endpoints secured with token validation
- **Session Management**: Automatic token refresh and secure logout

### 👤 User Onboarding & Profile

- **Resume Parsing**: Upload PDF resumes for AI-powered profile extraction via Google Gemini
- **Profile Management**: Edit and update profile details anytime
- **Onboarding Flow**: Smart tracking of onboarding completion status

### 💬 AI-Powered Job Search

- **Intelligent Chatbot**: Natural language job discovery powered by Gemini AI with function calling
- **Real-time Job Search**: Integration with JSearch API for current job listings
- **Smart Query Handling**: AI infers job types from user skills and preferences
- **Job Details**: View comprehensive job information including requirements, responsibilities, and salary
- **Persistent Chat History**: All conversations saved and restored on sign-in

### 📋 Job Management

- **Save Jobs**: Bookmark interesting opportunities for later
- **Track Applications**: Keep record of jobs you've applied to
- **Quick Actions**: Apply directly from job cards with one click

### 🎤 AI Mock Interviews

- **Voice-based Practice**: Real-time voice interviews powered by Retell AI
- **Multiple AI Interviewers**: Choose from different interviewer personalities
- **Job-Specific Prep**: Generate tailored interview questions based on saved jobs
- **Custom Interviews**: Create practice sessions with custom objectives
- **Performance Analytics**: Receive scores and feedback on communication, technical skills, and more

### 🎨 Modern UI/UX

- **Dark/Light Theme**: Toggle between themes with system preference support
- **Responsive Design**: Works seamlessly on desktop and mobile
- **Floating Chat Input**: Clean, modern chat interface with smooth animations
- **Hidden Scrollbars**: Minimal UI with scrollable content

---

## 🛠️ Tech Stack

### Frontend

| Technology       | Purpose                 |
| ---------------- | ----------------------- |
| React 18         | UI Framework            |
| TypeScript       | Type Safety             |
| Vite             | Build Tool & Dev Server |
| Tailwind CSS v4  | Styling                 |
| React Router DOM | Client-side Routing     |
| Sonner           | Toast Notifications     |
| shadcn/ui style  | Component Library       |

### Backend

| Technology        | Purpose                   |
| ----------------- | ------------------------- |
| FastAPI           | Web Framework             |
| Python 3.11+      | Runtime                   |
| MongoDB + Motor   | Database (async driver)   |
| Google Gemini API | AI Chat & Resume Parsing  |
| JSearch API       | Job Listings (RapidAPI)   |
| Retell AI         | Voice Interview           |
| JWT + bcrypt      | Authentication & Security |
| Pydantic          | Data Validation           |

---

## 📁 Project Structure

```
Job-Search-Assistant/
├── frontend/
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── ui/            # Reusable UI components (shadcn/ui style)
│   │   │   ├── AuthPage.tsx
│   │   │   ├── ChatPage.tsx
│   │   │   ├── HomePage.tsx
│   │   │   ├── OnboardingPage.tsx
│   │   │   ├── ProfilePage.tsx
│   │   │   ├── InterviewPrepPage.tsx
│   │   │   └── InterviewRoomPage.tsx
│   │   ├── context/
│   │   │   └── AuthContext.tsx  # Authentication state management
│   │   ├── services/
│   │   │   ├── api.ts           # API client functions
│   │   │   └── auth.ts          # Auth utilities & token management
│   │   ├── App.tsx              # Main app with routing
│   │   └── main.tsx             # Entry point
│   ├── package.json
│   └── vite.config.ts
│
├── backend/
│   ├── core/                    # Core modules
│   │   ├── auth.py              # JWT & password security
│   │   ├── db.py                # MongoDB connection
│   │   └── models.py            # Pydantic data models
│   ├── services/                # Business logic layer
│   │   ├── chat_service.py      # Gemini chat with function calling
│   │   └── interview_service.py # Retell AI & interview logic
│   ├── clients/                 # External API clients
│   │   ├── jsearch_client.py    # JSearch API client
│   │   └── gemini_client.py     # Gemini API utilities
│   ├── routes/                  # API route handlers (modular)
│   │   ├── auth_routes.py       # Login, register, token refresh
│   │   ├── user_routes.py       # Profile, onboarding
│   │   ├── chat_routes.py       # Chat sessions, messages
│   │   ├── jobs_routes.py       # Save, unsave, apply jobs
│   │   └── interview_routes.py  # Interview management
│   ├── main.py                  # FastAPI app entry
│   └── requirements.txt
│
├── README.md
└── documentation.md
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- MongoDB (local or MongoDB Atlas)
- API Keys: Gemini, JSearch (RapidAPI), Retell AI

### Backend Setup

```powershell
# Navigate to backend
cd backend

# Create virtual environment
python -m venv venv

# Activate (Windows PowerShell)
./venv/Scripts/Activate.ps1

# Or on Unix/macOS
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file (see Environment Variables below)

# Run the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` and backend on `http://localhost:8000`.

---

## 🔑 Environment Variables

Create `backend/.env`:

```env
# Database
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/jobsearch

# AI Services
GEMINI_API_KEY=your_gemini_api_key
JSEARCH_API_KEY=your_jsearch_api_key

# Authentication (generate secure random keys for production)
JWT_SECRET_KEY=your_jwt_secret_key_min_32_chars
JWT_REFRESH_SECRET_KEY=your_refresh_secret_key

# Voice Interviews (Retell AI)
RETELL_API_KEY=your_retell_api_key
RETELL_AGENT_ID_1=agent_id_interviewer_1
RETELL_AGENT_ID_2=agent_id_interviewer_2
RETELL_AGENT_ID_3=agent_id_interviewer_3
```

---

## 📱 Application Routes

| Route                     | Description                                     |
| ------------------------- | ----------------------------------------------- |
| `/auth`                   | Login & Register page                           |
| `/`                       | Redirects based on auth/onboarding status       |
| `/onboarding`             | Resume upload for new users                     |
| `/home`                   | Dashboard with saved jobs, chats, quick actions |
| `/chat/:chatId`           | AI chatbot for job search                       |
| `/profile`                | View and edit user profile                      |
| `/interview-prep`         | Interview preparation dashboard                 |
| `/interview/:interviewId` | Voice interview room with AI                    |

---

## 🔌 API Endpoints

### Authentication

| Method | Endpoint             | Description          | Auth Required |
| ------ | -------------------- | -------------------- | ------------- |
| POST   | `/api/auth/register` | Create new account   | No            |
| POST   | `/api/auth/login`    | Login & get tokens   | No            |
| POST   | `/api/auth/refresh`  | Refresh access token | Refresh Token |
| POST   | `/api/auth/logout`   | Invalidate tokens    | Yes           |
| GET    | `/api/auth/me`       | Get current user     | Yes           |

### User & Profile

| Method | Endpoint                        | Description             |
| ------ | ------------------------------- | ----------------------- |
| POST   | `/api/onboardFileUpload`        | Parse resume PDF        |
| POST   | `/api/confirmOnboardingDetails` | Save onboarding profile |
| POST   | `/api/updateUserProfile`        | Update profile fields   |

### Chat

| Method | Endpoint               | Description                    |
| ------ | ---------------------- | ------------------------------ |
| GET    | `/api/chatHistory`     | Get user's chat sessions       |
| POST   | `/api/createChat`      | Create new chat session        |
| POST   | `/api/sendMessage`     | Send message & get AI response |
| GET    | `/api/getChatMessages` | Get messages for a chat        |
| DELETE | `/api/chat/{chatId}`   | Delete a chat session          |

### Jobs

| Method | Endpoint                | Description         |
| ------ | ----------------------- | ------------------- |
| GET    | `/api/getSavedJobs`     | Get saved jobs      |
| GET    | `/api/getAppliedJobs`   | Get applied jobs    |
| POST   | `/api/saveJob`          | Save a job          |
| DELETE | `/api/savedJob/{jobId}` | Unsave a job        |
| POST   | `/api/applyJob`         | Mark job as applied |

### Interviews

| Method | Endpoint                  | Description                   |
| ------ | ------------------------- | ----------------------------- |
| GET    | `/api/interviewers`       | Get AI interviewer profiles   |
| POST   | `/api/createInterview`    | Create custom interview       |
| POST   | `/api/createJobInterview` | Create job-specific interview |
| POST   | `/api/registerCall`       | Start voice call session      |
| POST   | `/api/analyzeInterview`   | Get performance analytics     |

---

## 🔒 Security Features

- **Password Hashing**: bcrypt with cost factor 12 (~250ms per hash)
- **JWT Tokens**: HS256 algorithm with configurable expiry
- **Token Refresh**: Automatic refresh mechanism with refresh tokens
- **Password Validation**: OWASP-compliant (min 8 chars, uppercase, lowercase, number, special char)
- **Protected Routes**: All endpoints require valid JWT except auth routes
- **Email Masking**: Logs mask sensitive email data

---

## 🐛 Debugging

Backend includes comprehensive logging with tags:

| Tag              | Description               |
| ---------------- | ------------------------- |
| `[AUTH]`         | Authentication operations |
| `[REGISTER]`     | User registration         |
| `[LOGIN]`        | Login attempts            |
| `[ONBOARD]`      | Onboarding flow           |
| `[CREATE_CHAT]`  | Chat creation             |
| `[SEND_MESSAGE]` | Message handling          |
| `[CHAT_SERVICE]` | AI chat processing        |
| `[JSEARCH]`      | Job search API calls      |
| `[SAVE_JOB]`     | Job save operations       |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch from `main`
3. Follow existing code style and patterns
4. Write clear commit messages
5. Update documentation for API/component changes
6. Open a PR with a clear description

See [documentation.md](documentation.md) for detailed guidelines.

---

## Project Made By:

1. Reddam Charan Teja Reddy
2. Damerla Anand
3. Javvaji Jagannadh Naga Sai Kumar
4. Shaik Riyaaz Ali
5. Tautik Venkata Siva Sai Penumudi

---

## 📄 License

Proprietary - confirm licensing before redistribution.
