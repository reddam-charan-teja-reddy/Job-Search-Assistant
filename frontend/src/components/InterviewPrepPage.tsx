import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  Mic,
  Play,
  History,
  Target,
  Clock,
  Building2,
  Plus,
  ChevronRight,
  Star,
  TrendingUp,
  Award,
  Briefcase,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { Job, UserProfile } from '../App';
import {
  Interview,
  InterviewResponse,
  Interviewer,
  getInterviewers,
  getUserInterviews,
  getInterviewHistory,
  createJobInterview,
  createInterview,
} from '../services/api';
import { ThemeToggle } from './ThemeToggle';

interface InterviewPrepPageProps {
  savedJobs: Job[];
  appliedJobs: Job[];
  userProfile: UserProfile | null;
}

export default function InterviewPrepPage({
  savedJobs,
  appliedJobs,
  userProfile,
}: InterviewPrepPageProps) {
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [interviewHistory, setInterviewHistory] = useState<InterviewResponse[]>([]);
  const [interviewers, setInterviewers] = useState<Interviewer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [activeTab, setActiveTab] = useState<'jobs' | 'custom' | 'history'>('jobs');

  // Custom interview form state
  const [customName, setCustomName] = useState('');
  const [customObjective, setCustomObjective] = useState('');
  const [selectedInterviewer, setSelectedInterviewer] = useState<number | undefined>(undefined);
  const [questionCount, setQuestionCount] = useState(5);
  const [duration, setDuration] = useState('10');
  const [isGeneratingObjective, setIsGeneratingObjective] = useState(false);

  useEffect(() => {
    if (userProfile?.email) {
      loadData();
    }
  }, [userProfile?.email]);

  const loadData = async () => {
    if (!userProfile?.email) return;

    setIsLoading(true);
    try {
      const [interviewersRes, interviewsRes, historyRes] = await Promise.all([
        getInterviewers(),
        getUserInterviews(),
        getInterviewHistory(),
      ]);

      setInterviewers(interviewersRes.interviewers);
      // Set the first interviewer as selected if available
      if (interviewersRes.interviewers.length > 0) {
        setSelectedInterviewer(interviewersRes.interviewers[0].id);
      }
      setInterviews(interviewsRes.interviews);
      setInterviewHistory(historyRes.responses);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load interview data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateJobInterview = async (job: Job) => {
    if (!userProfile?.email) return;

    setIsCreating(true);
    try {
      const interview = await createJobInterview({
        job_id: job.id,
        job_title: job.title,
        company_name: job.company,
        job_description: job.description,
        interviewer_id: selectedInterviewer,
        question_count: questionCount,
        time_duration: duration,
      });

      toast.success('Interview created!', {
        description: `Practice interview for ${job.title} is ready`,
      });

      // Navigate to interview page
      navigate(`/interview/${interview.id}`);
    } catch (error) {
      console.error('Error creating interview:', error);
      toast.error('Failed to create interview');
    } finally {
      setIsCreating(false);
    }
  };

  // Pre-fill the modal with job details (objective will be generated on backend when Start Interview is clicked)
  const handlePrepareJobInterview = (job: Job) => {
    setSelectedJob(job);
    setCustomName(`${job.title} at ${job.company}`);

    // Clear objective - it will be auto-generated on backend for job-based interviews
    setCustomObjective('');

    // Open the modal
    setShowCreateModal(true);
  };

  // Handle starting interview from modal (works for both job-based and custom)
  const handleStartInterviewFromModal = async () => {
    // For job-based interviews, we don't need customObjective as it's generated on backend
    if (!userProfile?.email || !customName) {
      toast.error('Please fill in the interview name');
      return;
    }

    // For custom interviews, objective is required
    if (!selectedJob && !customObjective) {
      toast.error('Please fill in the objective');
      return;
    }

    setIsCreating(true);
    try {
      let interview;

      if (selectedJob) {
        // Create job-specific interview
        interview = await createJobInterview({
          job_id: selectedJob.id,
          job_title: selectedJob.title,
          company_name: selectedJob.company,
          job_description: selectedJob.description,
          interviewer_id: selectedInterviewer,
          question_count: questionCount,
          time_duration: duration,
        });

        toast.success('Interview created!', {
          description: `Practice interview for ${selectedJob.title} is ready`,
        });
      } else {
        // Create custom interview
        interview = await createInterview({
          name: customName,
          objective: customObjective,
          interviewer_id: selectedInterviewer,
          question_count: questionCount,
          time_duration: duration,
        });

        toast.success('Interview created!');
      }

      setShowCreateModal(false);
      setSelectedJob(null);
      setCustomName('');
      setCustomObjective('');

      // Navigate to interview page
      navigate(`/interview/${interview.id}`);
    } catch (error) {
      console.error('Error creating interview:', error);
      toast.error('Failed to create interview');
    } finally {
      setIsCreating(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const allJobs = [...savedJobs, ...appliedJobs].filter(
    (job, index, self) => self.findIndex((j) => j.id === job.id) === index
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/home')}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              title="Go back to home"
              aria-label="Go back to home"
            >
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/20 text-primary rounded-lg flex items-center justify-center">
                <Mic className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-semibold text-foreground">Interview Prep</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Custom Interview
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-card rounded-xl p-6 border border-border">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Target className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{interviews.length}</p>
                <p className="text-muted-foreground">Interviews Created</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl p-6 border border-border">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
                <History className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{interviewHistory.length}</p>
                <p className="text-muted-foreground">Practice Sessions</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl p-6 border border-border">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {interviewHistory.filter((h) => h.analytics).length > 0
                    ? Math.round(
                      interviewHistory
                        .filter((h) => h.analytics)
                        .reduce((acc, h) => acc + (h.analytics?.overall_score || 0), 0) /
                      interviewHistory.filter((h) => h.analytics).length
                    )
                    : '-'}
                </p>
                <p className="text-muted-foreground">Avg. Score</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('jobs')}
            className={`pb-3 px-2 font-medium transition-colors ${activeTab === 'jobs'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              Practice for Jobs ({allJobs.length})
            </div>
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`pb-3 px-2 font-medium transition-colors ${activeTab === 'custom'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              My Interviews ({interviews.length})
            </div>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 px-2 font-medium transition-colors ${activeTab === 'history'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Practice History ({interviewHistory.length})
            </div>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'jobs' && (
          <div className="space-y-4">
            {allJobs.length === 0 ? (
              <div className="bg-card rounded-xl p-12 border border-border text-center">
                <Briefcase className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No Saved Jobs</h3>
                <p className="text-muted-foreground mb-4">
                  Save or apply to jobs to practice interviews for them
                </p>
                <button
                  onClick={() => navigate('/chat/new')}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Search for Jobs
                </button>
              </div>
            ) : (
              allJobs.map((job) => (
                <div
                  key={job.id}
                  className="bg-card rounded-xl p-6 border border-border hover:border-primary transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        {job.employerLogo ? (
                          <img
                            src={job.employerLogo}
                            alt={job.company}
                            className="w-10 h-10 rounded-lg object-contain bg-gray-50 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <h3 className="font-medium text-gray-900 truncate">{job.title}</h3>
                          <p className="text-sm text-gray-600 truncate">{job.company}</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                        {job.description}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {job.location && (
                          <span className="flex items-center gap-1">
                            📍 {job.location}
                          </span>
                        )}
                        {job.isRemote && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">
                            Remote
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handlePrepareJobInterview(job)}
                      disabled={isCreating}
                      className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-all shadow-md hover:shadow-lg disabled:opacity-50 w-full sm:w-auto"
                    >
                      <Mic className="w-4 h-4" />
                      {isCreating ? 'Creating...' : 'Prepare Interview'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'custom' && (
          <div className="space-y-4">
            {interviews.length === 0 ? (
              <div className="bg-card rounded-xl p-12 border border-border text-center">
                <Target className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No Interviews Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create a custom interview to practice
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Create Interview
                </button>
              </div>
            ) : (
              interviews.map((interview) => (
                <div
                  key={interview.id}
                  onClick={() => navigate(`/interview/${interview.id}`)}
                  className="bg-card rounded-xl p-6 border border-border hover:border-primary transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-foreground mb-1">{interview.name}</h3>
                      <p className="text-sm text-muted-foreground mb-3">{interview.description}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {interview.time_duration} min
                        </span>
                        <span className="flex items-center gap-1">
                          <Target className="w-4 h-4" />
                          {interview.question_count} questions
                        </span>
                        {interview.job_title && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                            {interview.job_title}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {interview.response_count} sessions
                      </span>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            {interviewHistory.length === 0 ? (
              <div className="bg-card rounded-xl p-12 border border-border text-center">
                <History className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No Practice History</h3>
                <p className="text-muted-foreground">
                  Complete an interview practice session to see your history
                </p>
              </div>
            ) : (
              interviewHistory.map((response) => (
                <div
                  key={response.id}
                  className="bg-card rounded-xl p-6 border border-border"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-foreground mb-1">
                        {response.interview_name || 'Practice Session'}
                      </h3>
                      {response.job_title && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {response.job_title} at {response.company_name}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{formatDate(response.created_at)}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {Math.round(response.duration / 60)} min
                        </span>
                        {response.is_analysed ? (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">
                            Analyzed
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs">
                            Pending Analysis
                          </span>
                        )}
                      </div>
                    </div>
                    {response.analytics && (
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                            <span className="text-xl font-bold text-foreground">
                              {response.analytics.overall_score}
                            </span>
                            <span className="text-muted-foreground">/10</span>
                          </div>
                          <p className="text-xs text-muted-foreground">Overall</p>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center gap-1">
                            <Award className="w-4 h-4 text-blue-500" />
                            <span className="text-xl font-bold text-foreground">
                              {response.analytics.communication_score}
                            </span>
                            <span className="text-muted-foreground">/10</span>
                          </div>
                          <p className="text-xs text-muted-foreground">Communication</p>
                        </div>
                      </div>
                    )}
                  </div>
                  {response.analytics && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-foreground mb-2">Strengths</p>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            {response.analytics.strengths.slice(0, 2).map((s, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-green-500">✓</span>
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground mb-2">Improvements</p>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            {response.analytics.improvements.slice(0, 2).map((s, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-orange-500">→</span>
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Create Custom Interview Modal */}
      {showCreateModal && createPortal(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[10000]"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCreateModal(false);
              setSelectedJob(null);
              setCustomName('');
              setCustomObjective('');
            }
          }}
        >
          <div className="bg-card rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-foreground mb-4">
              {selectedJob ? 'Prepare Job Interview' : 'Create Custom Interview'}
            </h2>

            {/* Show selected job info */}
            {/* Show selected job info */}
            {selectedJob && (
              <div className="mb-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
                <div className="flex items-center gap-3">
                  {selectedJob.employerLogo ? (
                    <img
                      src={selectedJob.employerLogo}
                      alt={selectedJob.company}
                      className="w-10 h-10 rounded-lg object-contain bg-background"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-background rounded-lg flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-foreground">{selectedJob.title}</p>
                    <p className="text-sm text-muted-foreground">{selectedJob.company}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Interview Name *
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g., Frontend Developer Interview"
                  className="w-full px-4 py-3 border-2 border-border rounded-xl focus:ring-2 focus:ring-ring focus:border-border text-foreground bg-background placeholder-muted-foreground text-base"
                  readOnly={!!selectedJob}
                />
              </div>

              {/* Only show objective field for custom interviews, hide for job-based */}
              {!selectedJob && (
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Objective * {isGeneratingObjective && (
                      <span className="ml-2 text-xs text-blue-600 animate-pulse font-normal">
                        ✨ AI generating suggestion...
                      </span>
                    )}
                  </label>
                  <textarea
                    value={customObjective}
                    onChange={(e) => setCustomObjective(e.target.value)}
                    placeholder="e.g., Assess technical skills in React and TypeScript"
                    rows={3}
                    className="w-full px-4 py-3 border-2 border-border rounded-xl focus:ring-2 focus:ring-ring focus:border-border text-foreground bg-background placeholder-muted-foreground text-base resize-none"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="question-count" className="block text-sm font-semibold text-foreground mb-2">
                    Questions
                  </label>
                  <select
                    id="question-count"
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Number(e.target.value))}
                    className="w-full px-4 py-3 border-2 border-border rounded-xl focus:ring-2 focus:ring-ring focus:border-border text-foreground bg-background text-base cursor-pointer"
                  >
                    <option value={3}>3 questions</option>
                    <option value={5}>5 questions</option>
                    <option value={7}>7 questions</option>
                    <option value={10}>10 questions</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="duration-select" className="block text-sm font-semibold text-foreground mb-2">
                    Duration
                  </label>
                  <select
                    id="duration-select"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-border rounded-xl focus:ring-2 focus:ring-ring focus:border-border text-foreground bg-background text-base cursor-pointer"
                  >
                    <option value="5">5 minutes</option>
                    <option value="10">10 minutes</option>
                    <option value="15">15 minutes</option>
                    <option value="20">20 minutes</option>
                    <option value="30">30 minutes</option>
                  </select>
                </div>
              </div>

              {/* Interviewer Selection */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-3">
                  Choose Your Interviewer
                </label>
                {interviewers.length > 0 ? (
                  <div style={{ display: 'flex', gap: '12px' }}>
                    {interviewers.map((interviewer) => {
                      const isSelected = selectedInterviewer === interviewer.id;
                      return (
                        <div
                          key={interviewer.id}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedInterviewer(interviewer.id);
                          }}
                          style={{
                            flex: 1,
                            padding: '12px',
                            borderRadius: '12px',
                            border: isSelected ? '2px solid #ffd369' : '2px solid #393e46',
                            backgroundColor: isSelected ? '#393e46' : '#222831',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            textAlign: 'center',
                          }}
                        >
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            color: 'white',
                            background: interviewer.name.includes('Lisa')
                              ? 'linear-gradient(135deg, #ec4899, #9333ea)'
                              : 'linear-gradient(135deg, #3b82f6, #6366f1)',
                            margin: '0 auto 8px',
                          }}>
                            {interviewer.name.charAt(0)}
                          </div>
                          <p style={{ fontWeight: 600, color: 'white', margin: 0, fontSize: '14px' }}>{interviewer.name}</p>
                          {isSelected && (
                            <span style={{ fontSize: '11px', color: '#ffc300', marginTop: '4px', display: 'block' }}>✓ Selected</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 bg-muted rounded-lg text-center text-muted-foreground text-sm">
                    Loading interviewers...
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setSelectedJob(null);
                  setCustomName('');
                  setCustomObjective('');
                }}
                className="px-6 py-3 text-foreground bg-muted hover:bg-muted/80 rounded-xl transition-colors font-medium text-base border border-border"
              >
                Cancel
              </button>
              <button
                onClick={handleStartInterviewFromModal}
                disabled={isCreating || !customName || (!selectedJob && !customObjective)}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold text-base shadow-lg"
              >
                {isCreating ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Start Interview
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
