# Job Search App with Chatbot & AI Mock Interviews — Full Documentation

This document describes the architecture, backend API routes, frontend components, data models, and how both parts work together. It also includes environment, setup, and contribution guidelines.

## Overview

- **Frontend**: Vite + React (TypeScript) with Tailwind CSS v4. Provides sign-in/onboarding, chat, job browsing, interview preparation, and profile management UI. Lives under `frontend/`.
- **Backend**: FastAPI with Google Gemini for AI, JSearch API for job listings, and Retell AI for voice interviews; MongoDB for persistence. Lives under `backend/`.
- **Key Flows**:
  - **Sign In**: Returning users sign in with email to restore all their data (profile, saved jobs, applied jobs, chat history).
  - **Resume Onboarding**: New users upload PDF → Gemini extracts profile → user confirms → stored in MongoDB.
  - **Chat**: AI assistant helps find jobs, refine searches, and provide guidance. Function calling integrates job search/details.
  - **Jobs**: Save/Unsave, Apply tracking, and retrieval with persistence.
  - **Interviews**: Create custom or job-specific mock interviews, conduct voice practice sessions, receive analytics.

---

## Backend

Location: `backend/`

### Environment

Create `backend/.env` with:

```env
GEMINI_API_KEY=<your_key>
MONGODB_URI=<connection_string>
JSEARCH_API_KEY=<your_key>
RETELL_API_KEY=<your_key>
RETELL_AGENT_ID_1=<agent_id>
RETELL_AGENT_ID_2=<agent_id>
RETELL_AGENT_ID_3=<agent_id>
```

### Dependencies

See `backend/requirements.txt`. Core libs:

- FastAPI, Uvicorn
- PyPDF2
- pydantic
- google-generativeai
- motor / pymongo (via `db.py`)
- retell-sdk (for voice interviews)

### Data Models (Pydantic)

Defined in `backend/models.py`:

#### User & Authentication Models

- `UserOnboardingResponse`: Structured profile data (name, email, skills, experience, education, etc.)
- `SignInRequest`: Email-based sign in request
- `SignInResponse`: Returns `exists`, `user`, `saved_jobs`, `applied_jobs`, `chat_history`
- `UserProfileUpdateRequest`: Partial profile updates

#### Chat Models

- `ChatMessage`: Message with sender, message, timestamp
- `Chat`: Chat session with messages, chat_name, id
- `ChatContext`: Permanent context, conversation summary, recent messages
- `ChatHistoryResponseItem`, `ChatHistoryResponse`: Chat list responses
- `CreateChatRequest/Response`: New chat creation
- `ChatMessageRequest/Response`: Message send/receive
- `GetChatMessagesRequest/Response`: Fetch messages for a chat

#### Job Models

- `JobCardData`: Full job card with all details
- `GetAppliedJobsResponseItem`, `GetAppliedJobsResponse`
- `GetSavedJobsResponseItem`, `GetSavedJobsResponse`
- `SaveJobRequest`, `ApplyJobRequest`

#### Interview Models

- `Interviewer`: AI interviewer profile (id, name, personality, traits)
- `InterviewQuestion`: Question with follow-up count
- `Interview`: Full interview document (name, objective, questions, job context)
- `CreateInterviewRequest/Response`: Custom interview creation
- `CreateJobInterviewRequest/Response`: Job-specific interview creation
- `InterviewResponse`: Voice interview session data
- `InterviewAnalytics`: Performance scores and feedback
- `RegisterCallRequest/Response`: Retell voice call registration

---

### API Routes

Implemented in `backend/main.py`. All routes include logging tags for debugging.

#### Authentication & User Routes

**`POST /api/signIn`** _(NEW)_

- Input: `SignInRequest { email }`
- Process: Finds user by email, returns full profile with saved_jobs, applied_jobs, and chat_history
- Output: `SignInResponse { exists, user?, saved_jobs?, applied_jobs?, chat_history? }`
- Logging: `[SIGN_IN]`

**`POST /api/onboardFileUpload`**

- Input: Raw PDF file body
- Process: Parses resume text → prompts Gemini with JSON schema → returns validated profile
- Output: `UserOnboardingResponse`
- Errors: 400 for non-PDF; 500 on processing issues

**`POST /api/confirmOnboardingDetails`**

- Input: `UserOnboardingResponse` (confirmed by user)
- Process: Upserts user doc in `users` collection; initializes `chat_history`, `saved_jobs`, `applied_jobs`
- Output: `{ message, id | email }`
- Logging: `[ONBOARD]`

**`POST /api/updateUserProfile`**

- Input: `UserProfileUpdateRequest` (partial updates supported)
- Process: `$set` fields for the user
- Logging: `[UPDATE_PROFILE]`

#### Chat Routes

**`GET /api/chatHistoryRequest?email=<email>`**

- Output: `ChatHistoryResponse` containing `{ id, chat_name, chat_id }` per chat
- Logging: `[CHAT_HISTORY]`

**`POST /api/createChat`**

- Input: `CreateChatRequest { email }`
- Process: Creates permanent context via Gemini from user profile, initializes chat with greeting
- Output: `CreateChatResponse { chat_id, chat_name, initial_message }`
- Logging: `[CREATE_CHAT]`

**`POST /api/sendMessage`**

- Input: `ChatMessageRequest { email, chat_id, message, selected_job_id?, selected_job_data? }`
- Process: Builds context prompt (permanent profile, conversation summary, recent messages). Uses Gemini with function calling:
  - `search_jobs(query, ...)` → returns job cards for UI
  - `get_job_details(job_id, ...)` → returns selected job details
- Output: `ChatMessageResponse { message, jobs?, selected_job_details? }`
- Logging: `[SEND_MESSAGE]`

**`GET /api/getChatMessages?email=<email>&chat_id=<id>`**

- Output: `{ messages, chat_name }` for the chat
- Logging: `[GET_CHAT_MESSAGES]`

**`POST /api/deleteChat`**

- Input: `{ email, chat_id }`
- Process: Removes chat from user's chat_history array
- Logging: `[DELETE_CHAT]`

#### Job Routes

**`GET /api/getSavedJobs?email=<email>`**

- Output: `GetSavedJobsResponse` (list of saved jobs)
- Logging: `[GET_SAVED_JOBS]`

**`GET /api/getAppliedJobs?email=<email>`**

- Output: `GetAppliedJobsResponse` (list of applied jobs)
- Logging: `[GET_APPLIED_JOBS]`

**`POST /api/saveJob`**

- Input: `SaveJobRequest { email, job_id, job_title, company_name, job_link }`
- Process: `$addToSet` to `saved_jobs`
- Logging: `[SAVE_JOB]`

**`POST /api/unsaveJob`**

- Input: `SaveJobRequest` (same as above)
- Process: `$pull` from `saved_jobs`
- Logging: `[UNSAVE_JOB]`

**`POST /api/applyJob`**

- Input: `ApplyJobRequest`
- Process: Tracks applied jobs after user confirms in UI
- Logging: `[APPLY_JOB]`

#### Interview Routes

**`GET /api/interviewers`**

- Output: List of available AI interviewer profiles
- Returns: `[{ id, name, personality, description, voice, empathy, exploration, rapport_building, professionalism }]`

**`POST /api/createInterview`**

- Input: `CreateInterviewRequest { email, name, objective, interviewer_id, question_count, time_duration }`
- Process: Generates interview questions via Gemini AI based on objective
- Output: `CreateInterviewResponse { interview_id, name, questions, interviewer }`

**`POST /api/createJobInterview`**

- Input: `CreateJobInterviewRequest { email, job_id, job_title, company_name, interviewer_id, question_count, time_duration }`
- Process: Generates job-specific interview questions using job details
- Output: `CreateJobInterviewResponse { interview_id, name, questions, interviewer, job_context }`

**`GET /api/interviews?email=<email>`**

- Output: List of user's interview sessions with metadata

**`GET /api/interview/{interview_id}?email=<email>`**

- Output: Full interview details including questions, interviewer info, and job context

**`POST /api/registerCall`**

- Input: `RegisterCallRequest { interview_id, email }`
- Process: Creates Retell AI voice call session, returns call credentials
- Output: `RegisterCallResponse { call_id, access_token, sample_rate }`

**`POST /api/updateInterviewResponse`**

- Input: `{ interview_id, call_id, transcript?, duration?, is_ended? }`
- Process: Updates interview response with call data

**`GET /api/interviewHistory?email=<email>`**

- Output: User's practice session history with analytics

**`POST /api/analyzeInterview`**

- Input: `{ interview_id, response_id }`
- Process: Analyzes transcript via Gemini, generates scores and feedback
- Output: `InterviewAnalytics { overall_score, communication_score, technical_score, strengths, improvements }`

**`POST /api/submitInterviewFeedback`**

- Input: `{ interview_id, email, feedback, satisfaction }`
- Process: Stores user feedback about interview experience

**`POST /api/retellWebhook`**

- Input: Retell callback payload
- Process: Handles call status updates, transcript completion

**`POST /api/generateInterviewObjective`**

- Input: `{ job_title, company_name, job_description? }`
- Process: Uses Gemini to generate suggested interview objectives
- Output: `{ objective }`

---

### Backend Services

#### Interview Service (`backend/interview_service.py`)

- Retell AI client initialization and configuration
- Interview question generation via Gemini AI
- Voice call session management
- Interview analytics generation
- Interviewer profile management

#### Retell AI Agent Configuration

**CRITICAL**: The Retell agents must be configured with specific dynamic variable placeholders. The backend sends these exact variable names via `retell_llm_dynamic_variables`:

| Variable        | Description                                | Example Value                         |
| --------------- | ------------------------------------------ | ------------------------------------- |
| `{{mins}}`      | Interview duration in minutes              | `"10"`                                |
| `{{name}}`      | Candidate's name                           | `"John Doe"`                          |
| `{{objective}}` | Interview objective with context and rules | Full objective text with instructions |
| `{{questions}}` | Numbered list of questions                 | `"1. Tell me about yourself\n2. ..."` |

**Example Retell Agent Prompt Template:**

```
You are an interviewer who is an expert in asking follow-up questions to uncover deeper insights. You have to keep the interview for {{mins}} or shorter.

The name of the person you are interviewing is {{name}}.

The interview objective is {{objective}}.

These are some of the questions you can ask.
{{questions}}

Once you ask a question, make sure you ask a follow-up question on it.

Follow the guidelines below when conversing.
- Follow a professional yet friendly tone.
- Ask precise and open-ended questions
- The question word count should be 30 words or fewer.
- Make sure you do not repeat any of the questions.
- Do not talk about anything not related to the objective and the given questions.
- If the name is given, use it in the conversation
```

**Note**: The `{{objective}}` variable sent by the backend includes enhanced context:

- Job title and company name (if job-specific interview)
- Interview rules (max 2 follow-ups per question, ask all questions in order)
- Candidate's resume/background summary

#### Chat Service (`backend/chat_service.py`)

- Gemini configuration and system prompt
- Function declarations for `search_jobs` and `get_job_details`
- Context management: permanent profile context, conversation summary, recent messages
- Database updates of chat messages and context

#### Job Search Client (`backend/jsearch_client.py`)

- `search_jobs` and `get_job_details` wrappers to JSearch API
- `extract_job_cards_from_response(result)` returns compact cards for frontend
- `extract_job_card_data(job)` returns detailed card for a single job

---

### Database

`backend/db.py` defines database connection and collections:

#### `users` Collection

User document structure:

```json
{
  "_id": "ObjectId",
  "email": "user@example.com",
  "name": "John Doe",
  "phone": "+1234567890",
  "location": "New York, NY",
  "skills": ["Python", "React", "..."],
  "experience": ["Software Engineer at Company X", "..."],
  "profile_summary": "Experienced developer...",
  "education": ["BS Computer Science", "..."],
  "certificationsAndAchievementsAndAwards": ["AWS Certified", "..."],
  "projects": ["E-commerce Platform", "..."],
  "about": "Passionate about...",
  "saved_jobs": [
    {
      "job_id": "...",
      "job_title": "...",
      "company_name": "...",
      "job_link": "..."
    }
  ],
  "applied_jobs": [
    {
      "job_id": "...",
      "job_title": "...",
      "company_name": "...",
      "job_link": "..."
    }
  ],
  "chat_history": [
    {
      "chat_id": "uuid",
      "chat_name": "Job Search - Software Engineer",
      "messages": [
        { "sender": "bot", "message": "Hello!", "timestamp": "ISO8601" }
      ],
      "context": {
        "permanent_context": "User profile summary...",
        "conversation_summary": "...",
        "recent_messages": []
      },
      "created_at": "ISO8601"
    }
  ]
}
```

#### `interviews` Collection

Interview documents with questions, interviewer settings, job context.

#### `interview_responses` Collection

Voice call session data with transcripts and analytics.

#### `interview_feedback` Collection

User feedback on interview experiences.

---

## Frontend

Location: `frontend/`

### Tech Stack

- **Vite** + **React 18** + **TypeScript**
- **Tailwind CSS v4** with `@tailwindcss/vite` plugin
- Component library under `frontend/src/components/ui/*` (shadcn/ui style)
- **React Router DOM** for routing
- **Sonner** for toast notifications
- ES Modules (`"type": "module"` in package.json)

### Application Routes

| Route                     | Component           | Description                                            |
| ------------------------- | ------------------- | ------------------------------------------------------ |
| `/`                       | `OnboardingPage`    | Sign in (returning users) or resume upload (new users) |
| `/home`                   | `HomePage`          | Dashboard with quick actions, saved jobs, recent chats |
| `/chat/:chatId`           | `ChatPage`          | AI chat for job search with floating input             |
| `/profile`                | `ProfilePage`       | User profile view and edit                             |
| `/interview-prep`         | `InterviewPrepPage` | Interview preparation dashboard                        |
| `/interview/:interviewId` | `InterviewRoomPage` | Voice interview room                                   |

---

### Key Components

#### App (`src/App.tsx`)

- Main application component with global state management
- Manages: `userProfile`, `savedJobs`, `appliedJobs`, `chats`, `isOnboarded`
- Key interfaces: `UserProfile`, `Job`, `Chat`, `Message`, `SignInData`
- Functions: `completeOnboarding`, `saveJob`, `unsaveJob`, `applyToJob`, `addChat`, `updateChat`, `deleteChat`, `signOut`
- `completeOnboarding` accepts optional `SignInData` to populate all state on sign-in

#### OnboardingPage (`src/components/OnboardingPage.tsx`)

- **Three modes**: `'choice'` (sign in vs new user), `'signin'` (email entry), `'onboard'` (resume upload)
- Sign-in flow: Calls `/api/signIn` → converts DB format to frontend format → passes `SignInData` to `onComplete`
- Onboarding flow: Upload PDF → calls `/api/onboardFileUpload` → edit fields → calls `/api/confirmOnboardingDetails`
- Data conversion maps DB job/chat format to frontend `Job` and `Chat` interfaces

#### ChatPage (`src/components/ChatPage.tsx`)

- Modern chat UI with floating input design
- Messages area with absolute positioning and gradient fade
- Input has shadow effect (`shadow-lg hover:shadow-xl`) for floating appearance
- Hidden scrollbars via `scrollbar-hide` CSS class
- Handles: `createChat`, `getChatMessages`, `sendMessage`
- Displays job cards inline when returned by AI

#### HomePage (`src/components/HomePage.tsx`)

- Dashboard showing: recent chats, saved jobs, quick action buttons
- Entry points to chat, interview prep, and profile

#### ProfilePage (`src/components/ProfilePage.tsx`)

- View and edit user profile
- Calls `/api/updateUserProfile` for changes

#### InterviewPrepPage (`src/components/InterviewPrepPage.tsx`)

- Interview preparation dashboard
- Lists saved/applied jobs with "Prepare Interview" option
- Create custom interview modal
- AI-generated interview objectives
- Interview history and analytics
- Interviewer selection with personality traits

#### InterviewRoomPage (`src/components/InterviewRoomPage.tsx`)

- Voice interview room
- Pre-interview screen with questions preview and instructions
- Real-time voice conversation with AI interviewer (Retell AI)
- Live transcript display
- Timer and progress tracking
- Tab switch detection and warning
- Post-interview summary and analytics

#### JobCard (`src/components/JobCard.tsx`)

- Visual card for job listings
- Actions: Save/Unsave, Apply, Prepare Interview

#### JobDetailModal (`src/components/JobDetailModal.tsx`)

- Detailed job information modal

---

### Services

`src/services/api.ts` centralizes all API calls:

#### User & Auth

- `uploadResume(file)`: Upload PDF for parsing
- `confirmOnboarding(profile)`: Confirm and save profile
- `signIn(email)`: Email-based sign in (returns full user data)
- `updateUserProfile(profile)`: Update profile

#### Chat

- `getChatHistory(email)`: Get user's chats
- `createChat(email)`: Create new chat
- `sendMessage(email, chatId, message, selectedJobId?, selectedJobData?)`: Send message
- `getChatMessages(email, chatId)`: Get messages for chat
- `deleteChat(email, chatId)`: Delete a chat

#### Jobs

- `getSavedJobs(email)`: Get saved jobs
- `getAppliedJobs(email)`: Get applied jobs
- `saveJob(request)`: Save a job
- `unsaveJob(request)`: Remove saved job
- `applyJob(request)`: Mark as applied

#### Interviews

- `getInterviewers()`: Get available AI interviewers
- `createInterview(request)`: Create custom interview
- `createJobInterview(request)`: Create job-specific interview
- `registerCall(interviewId, email)`: Start voice session
- `analyzeInterview(interviewId, responseId)`: Get analytics
- Plus: `getInterviews`, `getInterview`, `updateInterviewResponse`, etc.

---

### Styles

#### Global Styles (`src/styles/globals.css`)

- Tailwind CSS v4 theme configuration
- Custom utility classes:

```css
@layer utilities {
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
}
```

#### Theme Support

- Dark/Light theme via `ThemeProvider` component
- Toggle with `ThemeToggle` component
- Respects system preference

---

## How Frontend and Backend Work Together

### 1. Sign In (Returning Users)

```
User enters email → POST /api/signIn
                 → Backend finds user, returns full data
                 → Frontend converts DB format to state format
                 → Populates: profile, savedJobs, appliedJobs, chats
                 → Navigates to /home
```

### 2. Onboarding (New Users)

```
User uploads PDF → POST /api/onboardFileUpload
               → Backend parses with Gemini
               → Frontend shows extracted data for editing
User confirms  → POST /api/confirmOnboardingDetails
               → Backend stores user document
               → Frontend sets profile, navigates to /home
```

### 3. Chat Session

```
User clicks New Chat → POST /api/createChat
                    → Backend creates context, generates greeting
                    → Frontend displays chat with initial message

User sends message → POST /api/sendMessage
                  → Backend builds context, calls Gemini
                  → Gemini may call search_jobs or get_job_details
                  → Backend returns response with optional job cards
                  → Frontend displays message and job cards
```

### 4. Job Management

```
User clicks Save    → POST /api/saveJob → Backend $addToSet
User clicks Unsave  → POST /api/unsaveJob → Backend $pull
User clicks Apply   → POST /api/applyJob → Backend adds to applied_jobs
```

### 5. Interview Prep

```
User clicks "Prepare Interview" on job card
  → POST /api/generateInterviewObjective (optional)
  → Frontend shows interview config modal

User configures and starts
  → POST /api/createJobInterview or /api/createInterview
  → Backend generates questions via Gemini
  → Frontend navigates to interview room

In interview room
  → POST /api/registerCall → Backend creates Retell session
  → User conducts voice interview
  → POST /api/analyzeInterview → Backend analyzes with Gemini
  → Frontend displays scores and feedback
```

### 6. Data Persistence

- All user data stored in MongoDB `users` collection
- Chat history embedded in user document
- Saved/applied jobs embedded in user document
- Interviews in separate `interviews` collection
- Full data restored on sign-in

---

## Running Locally

### Backend (PowerShell)

```powershell
cd backend
python -m venv venv
./venv/Scripts/Activate.ps1
pip install -r requirements.txt
# Ensure .env has all required keys
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Build for Production

```bash
cd frontend
npm run build
# Output in frontend/build/
```

---

## Debugging

### Backend Logging Tags

All database operations include logging tags for quick debugging:

| Tag                   | Operation                    |
| --------------------- | ---------------------------- |
| `[SIGN_IN]`           | Email-based sign in          |
| `[ONBOARD]`           | User onboarding confirmation |
| `[CHAT_HISTORY]`      | Fetch chat history           |
| `[CREATE_CHAT]`       | Create new chat              |
| `[DELETE_CHAT]`       | Delete chat                  |
| `[SEND_MESSAGE]`      | Send/receive messages        |
| `[GET_CHAT_MESSAGES]` | Fetch chat messages          |
| `[GET_SAVED_JOBS]`    | Fetch saved jobs             |
| `[GET_APPLIED_JOBS]`  | Fetch applied jobs           |
| `[SAVE_JOB]`          | Save a job                   |
| `[UNSAVE_JOB]`        | Unsave a job                 |
| `[APPLY_JOB]`         | Apply to job                 |
| `[UPDATE_PROFILE]`    | Update user profile          |
| `[REGISTER_CALL]`     | Register Retell voice call   |
| `[RETELL_CALL]`       | Retell API call details      |

### Frontend Console Logging

- Sign-in data logging: `[SIGN_IN] Loaded data: { savedJobs, appliedJobs, chats }`

---

## Testing

- Backend includes `test_chatbot_simulation.py` and `test_simulation.py` for basic flows
- Run with your Python test runner once env is configured

---

## Contributing

### Guidelines

- **Branching**: Create feature branches from `main`
- **Coding style**: Follow existing TypeScript/React patterns and Python FastAPI conventions
- **Commit messages**: Clear, imperative style (e.g., "Add email sign-in feature")
- **PRs**: Include description, steps to test, and screenshots if UI changes

### When Adding Features

- **Backend**: Update `models.py`, add route in `main.py`, add logging tags, document here
- **Frontend**: Add/update components, wire APIs in `api.ts`
- **Interview features**: Update both `interview_service.py` and corresponding frontend
- **Docs**: Update this `documentation.md` and `README.md`

---

## Security & Privacy

- Do not commit secrets. Use `.env`
- Treat resume data and profile fields as sensitive; avoid logging PII
- Validate inputs server-side and sanitize any external API output
- Interview transcripts contain user voice data; handle with appropriate privacy measures

---

## Deployment Notes

### Backend

- Containerize with Uvicorn/Gunicorn
- Set environment variables
- Connect managed MongoDB (MongoDB Atlas recommended)
- Configure Retell AI webhook URL for production domain

### Frontend

- Build with `npm run build`
- Serve via static host or CDN
- Configure backend URL in `api.ts`

### Production Checklist

- Enable HTTPS
- Tighten CORS for production domains
- Ensure Retell AI agents are configured
- Set up monitoring and error tracking
- Configure rate limiting for API endpoints
