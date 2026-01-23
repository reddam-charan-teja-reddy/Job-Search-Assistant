# Job Search App — Frontend

React + TypeScript frontend for the Job Search App with AI Chatbot and Mock Interviews.

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development and builds
- **Tailwind CSS v4** with `@tailwindcss/vite` plugin
- **React Router DOM** for routing
- **Sonner** for toast notifications
- **Lucide React** for icons

## Getting Started

### Prerequisites

- Node.js 18+
- Backend server running on `http://localhost:8000`

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app runs on `http://localhost:5173` by default.

### Build for Production

```bash
npm run build
```

Output is in `build/` directory.

## Project Structure

```
frontend/
├── src/
│   ├── App.tsx              # Main app with routing and state
│   ├── main.tsx             # Entry point
│   ├── index.css            # Tailwind imports
│   ├── components/
│   │   ├── OnboardingPage.tsx    # Sign in / resume upload
│   │   ├── HomePage.tsx          # Dashboard
│   │   ├── ChatPage.tsx          # AI chat interface
│   │   ├── ProfilePage.tsx       # User profile
│   │   ├── InterviewPrepPage.tsx # Interview dashboard
│   │   ├── InterviewRoomPage.tsx # Voice interview room
│   │   ├── JobCard.tsx           # Job listing card
│   │   ├── JobDetailModal.tsx    # Job details modal
│   │   ├── ThemeToggle.tsx       # Dark/light theme toggle
│   │   ├── theme-provider.tsx    # Theme context provider
│   │   └── ui/                   # Reusable UI components
│   ├── services/
│   │   └── api.ts           # API client functions
│   └── styles/
│       └── globals.css      # Global styles and utilities
├── package.json
├── vite.config.ts
└── index.html
```

## Key Features

### Authentication

- **Sign In**: Returning users enter email to restore all data
- **Onboarding**: New users upload PDF resume for AI parsing

### Chat Interface

- Modern floating input design with shadow effects
- Hidden scrollbars for clean UI
- Job cards displayed inline
- Persistent chat history

### Job Management

- Save/unsave jobs
- Track applications
- Quick apply links

### Interview Prep

- Custom or job-specific interviews
- AI interviewer selection
- Voice-based practice (Retell AI)
- Performance analytics

### Theming

- Dark/Light mode toggle
- System preference support
- Consistent design tokens

## Configuration

### API Base URL

Edit `src/services/api.ts` to change the backend URL:

```typescript
const API_BASE_URL = "http://localhost:8000";
```

### Tailwind Configuration

Using Tailwind CSS v4 with the Vite plugin. Theme configuration is in `src/styles/globals.css`.

## Available Scripts

| Command           | Description              |
| ----------------- | ------------------------ |
| `npm run dev`     | Start development server |
| `npm run build`   | Build for production     |
| `npm run preview` | Preview production build |

## Component Library

The `src/components/ui/` directory contains reusable UI components following shadcn/ui patterns:

- Buttons, inputs, forms
- Cards, dialogs, modals
- Navigation, tabs, menus
- And more...

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
