# Job Search App with Chatbot & AI Mock Interviews

A full-stack job search application powered by AI that helps users discover job opportunities, manage applications, and prepare for interviews. Features an intelligent chatbot for job discovery, voice-based AI mock interviews, and comprehensive user profile management.

## 📚 Documentation

- **Full Documentation**: [documentation.md](documentation.md)
- **Frontend Guide**: [frontend/README.md](frontend/README.md)
- **Backend Dependencies**: [backend/requirements.txt](backend/requirements.txt)

## ✨ Key Features

### User Authentication & Onboarding

- **Email-based Sign In**: Returning users can sign in with email to restore their profile, saved jobs, applied jobs, and chat history
- **Resume Parsing**: New users upload PDF resumes for AI-powered profile extraction via Google Gemini
- **Profile Management**: Edit and update profile details anytime

### AI-Powered Job Search

- **Intelligent Chatbot**: Natural language job discovery powered by Gemini AI with function calling
- **Real-time Job Search**: Integration with JSearch API for current job listings
- **Job Details**: View comprehensive job information including requirements, responsibilities, and salary
- **Persistent Chat History**: All conversations saved and restored on sign-in

### Job Management

- **Save Jobs**: Bookmark interesting opportunities for later
- **Track Applications**: Keep record of jobs you've applied to
- **Quick Actions**: Apply directly from job cards with one click

### AI Mock Interviews

- **Voice-based Practice**: Real-time voice interviews powered by Retell AI
- **Multiple AI Interviewers**: Choose from different interviewer personalities
- **Job-Specific Prep**: Generate tailored interview questions based on saved jobs
- **Custom Interviews**: Create practice sessions with custom objectives
- **Performance Analytics**: Receive scores and feedback on communication, technical skills, and more

### Modern UI/UX

- **Dark/Light Theme**: Toggle between themes with system preference support
- **Responsive Design**: Works seamlessly on desktop and mobile
- **Floating Chat Input**: Clean, modern chat interface with smooth animations
- **Hidden Scrollbars**: Minimal UI with scrollable content

## 🛠️ Tech Stack

### Frontend

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS v4
- **UI Components**: Custom component library (shadcn/ui style)
- **Routing**: React Router DOM
- **Notifications**: Sonner toast library

### Backend

- **Framework**: FastAPI (Python)
- **AI/ML**: Google Gemini API (chat, function calling, structured outputs)
- **Job Data**: JSearch API (RapidAPI)
- **Voice AI**: Retell AI SDK
- **Database**: MongoDB with Motor (async driver)
- **Validation**: Pydantic models

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- MongoDB (local or cloud - MongoDB Atlas recommended)
- API Keys for Gemini, JSearch, and Retell AI

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

# Create .env file with required keys
# See Environment Variables section below

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

### Environment Variables

Create `backend/.env` with:

```env
# Required
GEMINI_API_KEY=<your_gemini_api_key>
MONGODB_URI=<your_mongodb_connection_string>
JSEARCH_API_KEY=<your_jsearch_api_key>

# For AI Mock Interviews
RETELL_API_KEY=<your_retell_api_key>
RETELL_AGENT_ID_1=<agent_id_for_interviewer_1>
RETELL_AGENT_ID_2=<agent_id_for_interviewer_2>
RETELL_AGENT_ID_3=<agent_id_for_interviewer_3>
```

## 📱 Application Routes

| Route                     | Description                                                |
| ------------------------- | ---------------------------------------------------------- |
| `/`                       | Sign in or onboarding (resume upload for new users)        |
| `/home`                   | Dashboard with saved jobs, recent chats, and quick actions |
| `/chat/:chatId`           | AI chatbot for job search and discovery                    |
| `/profile`                | View and edit user profile                                 |
| `/interview-prep`         | Interview preparation dashboard                            |
| `/interview/:interviewId` | Voice interview room with AI interviewer                   |

## 🔍 API Endpoints Overview

### Authentication & User

- `POST /api/signIn` - Email-based sign in for returning users
- `POST /api/onboardFileUpload` - Upload resume for parsing
- `POST /api/confirmOnboardingDetails` - Confirm and save user profile
- `POST /api/updateUserProfile` - Update profile details

### Chat

- `GET /api/chatHistoryRequest` - Get user's chat history
- `POST /api/createChat` - Create new chat session
- `POST /api/sendMessage` - Send message and get AI response
- `GET /api/getChatMessages` - Get messages for a chat

### Jobs

- `GET /api/getSavedJobs` - Get saved jobs
- `GET /api/getAppliedJobs` - Get applied jobs
- `POST /api/saveJob` - Save a job
- `POST /api/unsaveJob` - Remove saved job
- `POST /api/applyJob` - Mark job as applied

### Interviews

- `GET /api/interviewers` - Get available AI interviewers
- `POST /api/createInterview` - Create custom interview
- `POST /api/createJobInterview` - Create job-specific interview
- `POST /api/registerCall` - Start voice interview session
- `POST /api/analyzeInterview` - Get interview analytics

## 🐛 Debugging

The backend includes comprehensive logging with tags for quick debugging:

- `[SIGN_IN]` - Sign-in operations
- `[ONBOARD]` - Onboarding operations
- `[CHAT_HISTORY]` - Chat history retrieval
- `[CREATE_CHAT]` - Chat creation
- `[SEND_MESSAGE]` - Message handling
- `[SAVE_JOB]` / `[UNSAVE_JOB]` / `[APPLY_JOB]` - Job operations
- `[UPDATE_PROFILE]` - Profile updates

## 🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch from `main`
3. Follow existing code style and patterns
4. Write clear commit messages
5. Update documentation for API/component changes
6. Open a PR with a clear description

See [documentation.md](documentation.md#contributing) for detailed guidelines.

## 📄 License

Proprietary - confirm licensing before redistribution.
