import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Toaster } from 'sonner';
import OnboardingPage from './components/OnboardingPage';
import HomePage from './components/HomePage';
import ChatPage from './components/ChatPage';
import ProfilePage from './components/ProfilePage';
import InterviewPrepPage from './components/InterviewPrepPage';
import InterviewRoomPage from './components/InterviewRoomPage';
import AuthPage from './components/AuthPage';
import { ThemeProvider } from './components/theme-provider';
import { AuthProvider, useAuth } from './context/AuthContext';

export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  location: string;
  skills: string[];
  experience: string[];
  profile_summary: string;
  resumeUploaded: boolean;
  profilePhoto?: string;
  // optional fields
  education?: string[];
  certificationsAndAchievementsAndAwards?: string[];
  projects?: string[];
  about?: string;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  role: string;
  description: string;
  location: string;
  salary: string;
  applyLink?: string;
  postedAt?: string;
  isRemote?: boolean;
  employerLogo?: string;
  highlights?: {
    Qualifications?: string[];
    Responsibilities?: string[];
  };
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  timestamp: Date;
}

export interface Message {
  id: string;
  sender: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

// Data from sign-in response
export interface SignInData {
  profile: UserProfile;
  savedJobs?: Job[];
  appliedJobs?: Job[];
  chats?: Chat[];
}

// Protected route wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

// Main App content with auth
function AppContent() {
  const { user, isAuthenticated, isLoading: authLoading, logout: authContextLogout } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [savedJobs, setSavedJobs] = useState<Job[]>([]);
  const [appliedJobs, setAppliedJobs] = useState<Job[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  // Initialize isOnboarded from localStorage synchronously to prevent redirect flash
  const [isOnboarded, setIsOnboarded] = useState(() => {
    try {
      const stored = localStorage.getItem('isOnboarded');
      return stored ? JSON.parse(stored) === true : false;
    } catch {
      return false;
    }
  });

  // Sync user profile from auth context
  useEffect(() => {
    if (user) {
      // Map auth user to UserProfile
      const profileFromAuth: UserProfile = {
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        location: user.location || '',
        skills: user.skills || [],
        experience: user.experience || [],
        profile_summary: user.profile_summary || '',
        resumeUploaded: user.is_onboarded,
        education: user.education,
      };
      setUserProfile(profileFromAuth);
      // Only mark as onboarded if user has completed onboarding (uploaded resume)
      setIsOnboarded(user.is_onboarded);
      localStorage.setItem('userProfile', JSON.stringify(profileFromAuth));
      localStorage.setItem('isOnboarded', JSON.stringify(user.is_onboarded));
    }
  }, [user]);

  useEffect(() => {
    // Load data from localStorage with safe parsing
    const safeParse = <T,>(key: string): T | null => {
      const value = localStorage.getItem(key);
      if (!value || value === 'undefined') return null;
      try {
        return JSON.parse(value);
      } catch {
        localStorage.removeItem(key);
        return null;
      }
    };

    const storedProfile = safeParse<UserProfile>('userProfile');
    const storedSavedJobs = safeParse<Job[]>('savedJobs');
    const storedAppliedJobs = safeParse<Job[]>('appliedJobs');
    const storedChats = safeParse<Chat[]>('chats');
    const storedOnboarded = safeParse<boolean>('isOnboarded');

    if (storedProfile) setUserProfile(storedProfile);
    if (storedSavedJobs) setSavedJobs(storedSavedJobs);
    if (storedAppliedJobs) setAppliedJobs(storedAppliedJobs);
    if (storedChats) {
      // Convert timestamp strings back to Date objects
      storedChats.forEach((chat: Chat) => {
        chat.timestamp = new Date(chat.timestamp);
        chat.messages.forEach((msg: Message) => {
          msg.timestamp = new Date(msg.timestamp);
        });
      });
      setChats(storedChats);
    }
    if (storedOnboarded !== null) setIsOnboarded(storedOnboarded);
  }, []);

  const completeOnboarding = (profile: UserProfile, signInData?: SignInData) => {
    setUserProfile(profile);
    setIsOnboarded(true);
    localStorage.setItem('userProfile', JSON.stringify(profile));
    localStorage.setItem('isOnboarded', JSON.stringify(true));
    
    // If we have sign-in data (returning user), populate all the data
    if (signInData) {
      if (signInData.savedJobs && signInData.savedJobs.length > 0) {
        setSavedJobs(signInData.savedJobs);
        localStorage.setItem('savedJobs', JSON.stringify(signInData.savedJobs));
      }
      if (signInData.appliedJobs && signInData.appliedJobs.length > 0) {
        setAppliedJobs(signInData.appliedJobs);
        localStorage.setItem('appliedJobs', JSON.stringify(signInData.appliedJobs));
      }
      if (signInData.chats && signInData.chats.length > 0) {
        setChats(signInData.chats);
        localStorage.setItem('chats', JSON.stringify(signInData.chats));
      }
    }
  };

  const updateProfile = (profile: UserProfile) => {
    setUserProfile(profile);
    localStorage.setItem('userProfile', JSON.stringify(profile));
  };

  const saveJob = (job: Job) => {
    const newSavedJobs = [...savedJobs, job];
    setSavedJobs(newSavedJobs);
    localStorage.setItem('savedJobs', JSON.stringify(newSavedJobs));
  };

  const unsaveJob = (job: Job) => {
    const newSavedJobs = savedJobs.filter((j) => j.id !== job.id);
    setSavedJobs(newSavedJobs);
    localStorage.setItem('savedJobs', JSON.stringify(newSavedJobs));
  };

  const applyToJob = (job: Job) => {
    const newAppliedJobs = [...appliedJobs, job];
    setAppliedJobs(newAppliedJobs);
    localStorage.setItem('appliedJobs', JSON.stringify(newAppliedJobs));
  };

  const addChat = (chat: Chat) => {
    const newChats = [chat, ...chats];
    setChats(newChats);
    localStorage.setItem('chats', JSON.stringify(newChats));
  };

  const updateChat = (chatId: string, messages: Message[], title?: string) => {
    const updatedChats = chats.map((chat) =>
      chat.id === chatId ? { ...chat, messages, ...(title && { title }) } : chat
    );
    setChats(updatedChats);
    localStorage.setItem('chats', JSON.stringify(updatedChats));
  };

  const deleteChat = (chatId: string) => {
    const filteredChats = chats.filter((chat) => chat.id !== chatId);
    setChats(filteredChats);
    localStorage.setItem('chats', JSON.stringify(filteredChats));
  };

  const signOut = async () => {
    try {
      await authContextLogout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    setUserProfile(null);
    setIsOnboarded(false);
    setSavedJobs([]);
    setAppliedJobs([]);
    setChats([]);
    localStorage.clear();
  };

  // Show loading while auth state is being determined
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Router>
      <div className='min-h-screen bg-background text-foreground'>
        <Toaster position='top-center' richColors />
        <Routes>
          {/* Auth routes */}
          <Route
            path='/auth'
            element={
              isAuthenticated ? (
                <Navigate to='/home' replace />
              ) : (
                <AuthPage />
              )
            }
          />
          <Route
            path='/'
            element={
              !isAuthenticated ? (
                <Navigate to='/auth' replace />
              ) : !isOnboarded ? (
                <OnboardingPage onComplete={completeOnboarding} />
              ) : (
                <Navigate to='/home' replace />
              )
            }
          />
          <Route
            path='/onboarding'
            element={
              <ProtectedRoute>
                {isOnboarded ? (
                  <Navigate to='/home' replace />
                ) : (
                  <OnboardingPage onComplete={completeOnboarding} />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path='/home'
            element={
              <ProtectedRoute>
                {isOnboarded ? (
                  <HomePage
                    savedJobs={savedJobs}
                    appliedJobs={appliedJobs}
                    chats={chats}
                    userProfile={userProfile}
                    unsaveJob={unsaveJob}
                    applyToJob={applyToJob}
                    deleteChat={deleteChat}
                  />
                ) : (
                  <Navigate to='/onboarding' replace />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path='/chat/:chatId?'
            element={
              <ProtectedRoute>
                {isOnboarded && userProfile ? (
                  <ChatPage
                    chats={chats}
                    addChat={addChat}
                    updateChat={updateChat}
                    savedJobs={savedJobs}
                    appliedJobs={appliedJobs}
                    saveJob={saveJob}
                    unsaveJob={unsaveJob}
                    applyToJob={applyToJob}
                    userEmail={userProfile.email}
                  />
                ) : (
                  <Navigate to='/onboarding' replace />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path='/profile'
            element={
              <ProtectedRoute>
                {isOnboarded && userProfile ? (
                  <ProfilePage
                    userProfile={userProfile}
                    updateProfile={updateProfile}
                    signOut={signOut}
                  />
                ) : (
                  <Navigate to='/onboarding' replace />
                )}
              </ProtectedRoute>
            }
          />
          {/* Interview Prep Routes */}
          <Route
            path='/interview-prep'
            element={
              <ProtectedRoute>
                {isOnboarded && userProfile ? (
                  <InterviewPrepPage
                    savedJobs={savedJobs}
                    appliedJobs={appliedJobs}
                    userProfile={userProfile}
                  />
                ) : (
                  <Navigate to='/onboarding' replace />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path='/interview/:interviewId'
            element={
              <ProtectedRoute>
                {isOnboarded && userProfile ? (
                  <InterviewRoomPage userProfile={userProfile} />
                ) : (
                  <Navigate to='/onboarding' replace />
                )}
              </ProtectedRoute>
            }
          />
          {/* Redirect /dashboard to /home for compatibility */}
          <Route path='/dashboard' element={<Navigate to='/home' replace />} />
          {/* Catch all - redirect unknown routes based on auth status */}
          <Route
            path='*'
            element={
              isAuthenticated ? (
                <Navigate to='/home' replace />
              ) : (
                <Navigate to='/auth' replace />
              )
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
