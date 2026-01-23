import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquarePlus,
  User,
  Sparkles,
  BookOpen,
  History,
  Trash2,
  ChevronRight,
  Briefcase,
} from 'lucide-react';
import { toast } from 'sonner';
import { Job, Chat, UserProfile } from '../App';
import JobDetailModal from './JobDetailModal';
import { formatDistanceToNow } from 'date-fns';
import { ThemeToggle } from './ThemeToggle';
// You might need to install this or keep custom logic if prefer not to add deps

// Helper for date formatting if date-fns not available, or use the one below
const formatTimeAgo = (date: Date) => {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
};

interface HomePageProps {
  savedJobs: Job[];
  appliedJobs: Job[];
  chats: Chat[];
  userProfile: UserProfile | null;
  unsaveJob: (job: Job) => void;
  applyToJob: (job: Job) => void;
  deleteChat: (chatId: string) => void;
}

export default function HomePage({
  savedJobs,
  appliedJobs,
  chats,
  userProfile,
  unsaveJob,
  applyToJob,
  deleteChat,
}: HomePageProps) {
  const navigate = useNavigate();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showModal, setShowModal] = useState(false);

  const handleNewChat = () => {
    navigate('/chat/new');
  };

  const handleJobClick = (job: Job) => {
    setSelectedJob(job);
    setShowModal(true);
  };

  const handleSaveJob = () => {
    toast.info('Job is already saved');
  };

  const handleApply = (job: Job) => {
    if (!appliedJobs.some((j) => j.id === job.id)) {
      applyToJob(job);
      toast.success('Application recorded!', {
        description: `You've applied to ${job.title} at ${job.company}`,
      });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
              <Briefcase className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">HireJet</h1>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={() => navigate('/profile')}
              className="group flex items-center gap-3 px-2 py-1.5 rounded-full hover:bg-muted/50 transition-all">
              <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors hidden sm:block">
                {userProfile?.name || 'Profile'}
              </span>
              {userProfile?.profilePhoto ? (
                <img
                  src={userProfile.profilePhoto}
                  alt="Profile"
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-border group-hover:ring-primary/50 transition-all"
                />
              ) : (
                <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center ring-2 ring-border group-hover:ring-primary/50 transition-all">
                  <User className="w-4 h-4 text-secondary-foreground" />
                </div>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        {/* Welcome Hero */}
        <section className="mb-10 animate-fadeIn">
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-muted-foreground mb-4">
            Hello, {userProfile?.name?.split(' ')[0]}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Quick Action: New Chat */}
            <button
              onClick={handleNewChat}
              className="group relative overflow-hidden bg-primary p-6 rounded-2xl shadow-xl shadow-primary/10 transition-all hover:shadow-primary/20 hover:-translate-y-1 text-left">
              <div className="relative z-10 flex flex-col items-start gap-4">
                <div className="w-10 h-10 bg-primary-foreground/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <MessageSquarePlus className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-primary-foreground">Start New Search</h3>
                  <p className="text-primary-foreground/80 text-sm mt-1">Chat to find your next opportunity</p>
                </div>
              </div>
            </button>

            {/* Quick Action: Interview Prep */}
            <button
              onClick={() => navigate('/interview-prep')}
              className="group relative overflow-hidden bg-card border border-border p-6 rounded-2xl transition-all hover:border-primary/50 hover:-translate-y-1 hover:shadow-lg text-left">
              <div className="relative z-10 flex flex-col items-start gap-4">
                <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Sparkles className="w-6 h-6 text-secondary-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Interview Prep</h3>
                  <p className="text-muted-foreground text-sm mt-1">Practice with AI mock interviews</p>
                </div>
              </div>
            </button>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Column: Stats & Jobs (8 cols) */}
          <div className="lg:col-span-8 space-y-8">
            {/* Job Lists Tabs/Sections */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  Your Activity
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Saved Column */}
                <div className="bg-card rounded-2xl border border-border p-5 flex flex-col h-[500px]">
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-border/50">
                    <span className="font-medium">Saved Jobs</span>
                    <span className="bg-secondary/50 text-secondary-foreground px-2 py-0.5 rounded-full text-xs font-mono">
                      {savedJobs.length}
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
                    {savedJobs.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                        <BookmarkCheck className="w-10 h-10 mb-3" />
                        <p className="text-sm">No saved jobs yet</p>
                      </div>
                    ) : (
                      savedJobs.slice().reverse().map((job) => (
                        <div
                          key={job.id}
                          onClick={() => handleJobClick(job)}
                          className="bg-background/50 hover:bg-muted p-4 rounded-xl border border-border/50 cursor-pointer transition-colors group">
                          <h4 className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">{job.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">{job.company}</p>
                          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                            <MapPin className="w-3 h-3" /> {job.location}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Applied Column */}
                <div className="bg-card rounded-2xl border border-border p-5 flex flex-col h-[500px]">
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-border/50">
                    <span className="font-medium">Applied</span>
                    <span className="bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full text-xs font-mono">
                      {appliedJobs.length}
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
                    {appliedJobs.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                        <Briefcase className="w-10 h-10 mb-3" />
                        <p className="text-sm">No applications yet</p>
                      </div>
                    ) : (
                      appliedJobs.slice().reverse().map((job) => (
                        <div
                          key={job.id}
                          onClick={() => handleJobClick(job)}
                          className="bg-background/50 hover:bg-muted p-4 rounded-xl border border-border/50 cursor-pointer transition-colors group">
                          <h4 className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">{job.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">{job.company}</p>
                          <div className="mt-3 flex items-center gap-2 text-xs text-green-500">
                            <CheckCircle className="w-3 h-3" /> Applied
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar: History (4 cols) */}
          <aside className="lg:col-span-4 space-y-6">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Recent Chats
            </h3>
            <div className="bg-card rounded-2xl border border-border p-2">
              <div className="space-y-1 max-h-[600px] overflow-y-auto">
                {chats.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    No chat history yet.
                  </div>
                ) : (
                  chats.map((chat) => (
                    <div
                      key={chat.id}
                      onClick={() => navigate(`/chat/${chat.id}`)}
                      className="group flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 cursor-pointer transition-colors">
                      <div className="w-10 h-10 rounded-lg bg-secondary/30 flex items-center justify-center shrink-0">
                        <MessageSquare className="w-5 h-5 text-secondary-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                          {chat.title}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatTimeAgo(chat.timestamp)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteChat(chat.id);
                          toast.success('Chat deleted');
                        }}
                        className="p-2 opacity-0 group-hover:opacity-100 hover:text-destructive transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Helper Icons for the layout (re-importing needed icons to be safe) */}
      {selectedJob && (
        <JobDetailModal
          job={selectedJob}
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setSelectedJob(null);
          }}
          onSave={handleSaveJob}
          onUnsave={unsaveJob}
          onApply={handleApply}
          isSaved={savedJobs.some((j) => j.id === selectedJob.id)}
          isApplied={appliedJobs.some((j) => j.id === selectedJob.id)}
        />
      )}
    </div>
  );
}

// Importing icons that weren't in the top import but used in the code
import {
  BookmarkCheck,
  CheckCircle,
  MapPin,
  MessageSquare,
} from 'lucide-react';

