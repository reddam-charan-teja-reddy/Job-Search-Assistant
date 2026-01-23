import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, Home, Sparkles, Loader2, X, ArrowLeft, Bot, User, Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { Job, Chat, Message } from '../App';
import JobCard from './JobCard';
import {
  createChat,
  sendMessage,
  getChatMessages,
  JobCardData,
} from '../services/api';
import { ThemeToggle } from './ThemeToggle';

interface ChatPageProps {
  chats: Chat[];
  addChat: (chat: Chat) => void;
  updateChat: (chatId: string, messages: Message[], title?: string) => void;
  savedJobs: Job[];
  appliedJobs: Job[];
  saveJob: (job: Job) => void;
  unsaveJob: (job: Job) => void;
  applyToJob: (job: Job) => void;
  userEmail: string;
}

const SUGGESTED_MESSAGES = [
  'Show frontend jobs',
  'Remote positions?',
  'Resume tips',
  'Mock interview',
];

// Convert JobCardData from API to Job type for JobCard component
const convertJobCardDataToJob = (jobData: JobCardData): Job => {
  return {
    id: jobData.job_id,
    title: jobData.job_title,
    company: jobData.employer_name,
    role: jobData.job_employment_type || 'Full-time',
    description: jobData.job_description,
    location: jobData.job_location || 'Not specified',
    salary: jobData.job_salary || 'Not disclosed',
    applyLink: jobData.job_apply_link,
    postedAt: jobData.job_posted_at,
    isRemote: jobData.job_is_remote,
    employerLogo: jobData.employer_logo,
    highlights: jobData.job_highlights,
  };
};

export default function ChatPage({
  chats,
  addChat,
  updateChat,
  savedJobs,
  appliedJobs,
  saveJob,
  unsaveJob,
  applyToJob,
  userEmail,
}: ChatPageProps) {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [message, setMessage] = useState('');
  const [displayedJobs, setDisplayedJobs] = useState<Job[]>([]);
  const [showJobs, setShowJobs] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedJobData, setSelectedJobData] = useState<JobCardData | null>(null);
  const [activeJobInContext, setActiveJobInContext] = useState<JobCardData | null>(null); // Persisted job in chat context
  const [actualChatId, setActualChatId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const jobsContainerRef = useRef<HTMLDivElement>(null);

  // Initialize chat
  useEffect(() => {
    const initializeChat = async () => {
      if (!userEmail) {
        toast.error('Please complete onboarding first');
        navigate('/');
        return;
      }

      setIsLoading(true);

      const isLocalId = chatId?.startsWith('chat-');
      const isNewChat = !chatId || chatId === 'new' || isLocalId;

      try {
        if (!isNewChat) {
          const existingChat = chats.find((chat) => chat.id === chatId);
          if (existingChat) {
            setCurrentChat(existingChat);
            setActualChatId(chatId);
            try {
              const chatData = await getChatMessages(userEmail, chatId);
              const messages: Message[] = chatData.messages.map(
                (msg, index) => ({
                  id: `msg-${index}`,
                  sender: msg.sender,
                  content: msg.message,
                  timestamp: new Date(msg.timestamp || Date.now()),
                })
              );
              const updatedChat = {
                ...existingChat,
                messages,
                title: chatData.chat_name,
              };
              setCurrentChat(updatedChat);
            } catch (err) {
              console.log('Using cached chat data');
            }
          } else {
            try {
              const chatData = await getChatMessages(userEmail, chatId);
              const messages: Message[] = chatData.messages.map(
                (msg, index) => ({
                  id: `msg-${index}`,
                  sender: msg.sender,
                  content: msg.message,
                  timestamp: new Date(msg.timestamp || Date.now()),
                })
              );
              const newChat: Chat = {
                id: chatId,
                title: chatData.chat_name,
                messages,
                timestamp: new Date(),
              };
              setCurrentChat(newChat);
              setActualChatId(chatId);
              addChat(newChat);
            } catch (err) {
              console.log('Chat not found, creating new chat');
              const result = await createChat(userEmail);
              const newChat: Chat = {
                id: result.chat_id,
                title: result.chat_name,
                messages: [
                  {
                    id: `msg-${Date.now()}`,
                    sender: 'bot',
                    content: result.initial_message,
                    timestamp: new Date(),
                  },
                ],
                timestamp: new Date(),
              };
              setCurrentChat(newChat);
              setActualChatId(result.chat_id);
              addChat(newChat);
              navigate(`/chat/${result.chat_id}`, { replace: true });
            }
          }
        } else {
          const result = await createChat(userEmail);
          const newChat: Chat = {
            id: result.chat_id,
            title: result.chat_name,
            messages: [
              {
                id: `msg-${Date.now()}`,
                sender: 'bot',
                content: result.initial_message,
                timestamp: new Date(),
              },
            ],
            timestamp: new Date(),
          };
          setCurrentChat(newChat);
          setActualChatId(result.chat_id);
          addChat(newChat);
          navigate(`/chat/${result.chat_id}`, { replace: true });
        }
      } catch (error) {
        console.error('Error initializing chat:', error);
        toast.error('Failed to initialize chat');
      } finally {
        setIsLoading(false);
      }
    };

    initializeChat();
  }, [chatId, userEmail]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentChat?.messages]);

  useEffect(() => {
    if (showJobs && displayedJobs.length > 0 && jobsContainerRef.current) {
      jobsContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [showJobs, displayedJobs]);

  const handleSendMessage = async (text?: string, jobId?: string, jobData?: JobCardData) => {
    const messageText = text || message;
    if (!messageText.trim() || !currentChat || !actualChatId || isSending)
      return;

    const finalJobId = jobId || selectedJobId || undefined;
    const finalJobData = jobData || selectedJobData || undefined;

    // Check if user wants to clear the job context
    const clearJobKeywords = ['clear job', 'remove job', 'forget job', 'different job', 'change job', 'new search', 'clear selection', 'start fresh'];
    const shouldClearJob = clearJobKeywords.some(keyword => messageText.toLowerCase().includes(keyword));

    if (shouldClearJob) {
      setActiveJobInContext(null);
    }

    // If we have an active job in context and we're not clearing it, 
    // AND we're not selecting a new one, include it in the request to ensure backend context
    let jobDataToSend = finalJobData;
    let jobIdToSend = finalJobId;

    if (!jobDataToSend && !shouldClearJob && activeJobInContext) {
      jobDataToSend = activeJobInContext;
      jobIdToSend = activeJobInContext.job_id;
    }

    setIsSending(true);
    setMessage('');

    const newUserMessage: Message = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    const updatedMessages = [...currentChat.messages, newUserMessage];
    setCurrentChat({ ...currentChat, messages: updatedMessages });

    try {
      const response = await sendMessage(
        userEmail,
        actualChatId,
        messageText,
        jobIdToSend,
        jobDataToSend
      );

      const newBotMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        sender: 'bot',
        content: response.message,
        timestamp: new Date(),
      };

      const messagesWithBot = [...updatedMessages, newBotMessage];

      let newTitle = currentChat.title;
      if (currentChat.messages.length === 1) {
        newTitle = messageText.slice(0, 50) + (messageText.length > 50 ? '...' : '');
      }

      const finalChat = {
        ...currentChat,
        messages: messagesWithBot,
        title: newTitle,
      };
      setCurrentChat(finalChat);
      updateChat(actualChatId, messagesWithBot, newTitle);

      if (response.jobs && response.jobs.length > 0) {
        const convertedJobs = response.jobs.map(convertJobCardDataToJob);
        setDisplayedJobs(convertedJobs);
        setShowJobs(true);
        toast.success(`Found ${response.jobs.length} jobs`);
      }

      // Update active job in context if a new job was selected
      if (finalJobData && !shouldClearJob) {
        setActiveJobInContext(finalJobData);
      }

      // Clear the one-time selection state (active job persists separately)
      setSelectedJobId(null);
      setSelectedJobData(null);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
      setCurrentChat({ ...currentChat, messages: currentChat.messages });
    } finally {
      setIsSending(false);
    }
  };

  const handleChooseJob = (job: Job) => {
    if (!currentChat) return;

    const jobData: JobCardData = {
      job_id: job.id,
      job_title: job.title,
      employer_name: job.company,
      job_description: job.description || '',
      job_location: job.location,
      job_salary: job.salary,
      job_employment_type: job.role,
      job_apply_link: job.applyLink,
      job_posted_at: job.postedAt,
      job_is_remote: job.isRemote,
      employer_logo: job.employerLogo,
      job_highlights: job.highlights,
    };

    const chooseMessage = `Check out ${job.title} at ${job.company}`;
    handleSendMessage(chooseMessage, job.id, jobData);
    toast.success('Job selected');
  };

  if (isLoading) {
    return (
      <div className='h-screen flex items-center justify-center bg-background'>
        <Loader2 className='w-8 h-8 animate-spin text-primary' />
      </div>
    );
  }

  return (
    <div className='h-screen flex flex-col bg-background text-foreground overflow-hidden'>
      {/* Compact Header */}
      <header className='h-14 border-b border-border bg-background flex items-center justify-between px-6 shrink-0 z-10'>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/home')}
            className="p-2 -ml-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className='text-sm font-semibold leading-tight'>{currentChat?.title || 'Job Assistant'}</h2>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-muted-foreground">Online</span>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={() => navigate('/home')}
          className='text-sm font-medium text-muted-foreground hover:text-foreground transition-colors'>
          Dashboard
        </button>
        <div className="ml-4">
          <ThemeToggle />
        </div>
      </header>

      {/* Main Layout */}
      <div className='flex-1 flex overflow-hidden'>

        {/* Chat Column */}
        <div className={`relative flex flex-col bg-card transition-all duration-300 ${showJobs && displayedJobs.length > 0 ? 'w-[45%] border-r border-border' : 'w-full max-w-3xl mx-auto border-x border-border'}`}>

          {/* Messages Area */}
          <div className='absolute inset-0 overflow-y-auto p-4 pb-32 space-y-6 scrollbar-hide'>
            {currentChat?.messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>

                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.sender === 'user' ? 'bg-secondary' : 'bg-primary'}`}>
                  {msg.sender === 'user' ? <User className="w-4 h-4 text-secondary-foreground" /> : <Bot className="w-4 h-4 text-primary-foreground" />}
                </div>

                <div className={`max-w-[85%] rounded-2xl px-5 py-3.5 shadow-sm text-sm leading-relaxed ${msg.sender === 'user'
                  ? 'bg-secondary text-secondary-foreground rounded-tr-none'
                  : 'bg-card border border-border text-foreground rounded-tl-none'
                  }`}>
                  {msg.sender === 'bot' ? (
                    <div className='prose prose-invert prose-sm max-w-none'>
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}

            {isSending && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-primary-foreground" />
                </div>
                <div className="bg-card border border-border/50 px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Thinking</span>
                  <span className="flex gap-1">
                    <span className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1 h-1 bg-primary rounded-full animate-bounce"></span>
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className='absolute bottom-0 left-0 right-0 p-4 pt-0 bg-transparent'>
            <div className="bg-gradient-to-t from-card via-card to-transparent pt-10 pb-4 px-4 -mx-4">
            {/* Suggestions */}
            {currentChat && currentChat.messages.length <= 2 && !isSending && (
              <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
                {SUGGESTED_MESSAGES.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendMessage(s)}
                    className="whitespace-nowrap px-3 py-1.5 rounded-full bg-muted/50 hover:bg-muted text-xs text-muted-foreground hover:text-foreground border border-transparent hover:border-border transition-all">
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Active Job in Context Indicator */}
            {activeJobInContext && (
              <div className='pb-2'>
                <div className='flex items-center justify-between text-sm bg-blue-50 px-3 py-2 rounded-lg border border-blue-200'>
                  <div className='flex items-center gap-2 text-blue-700'>
                    <span className='font-medium'>📌 Active Job:</span>
                    <span className='truncate max-w-[200px]'>
                      {activeJobInContext.job_title} at {activeJobInContext.employer_name}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setActiveJobInContext(null);
                      handleSendMessage('clear job selection');
                    }}
                    className='text-blue-400 hover:text-blue-600 ml-2 flex-shrink-0'
                    title='Clear job from context'>
                    <X className='w-4 h-4' />
                  </button>
                </div>
                <p className='text-xs text-gray-500 mt-1 px-1'>
                  All questions will be about this job. Say "clear job" or click × to remove.
                </p>
              </div>
            )}

            {/* Message Input */}
            <div className='pt-2'>
              <div className='relative flex items-center'>
                <input
                  type='text'
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !isSending && handleSendMessage()}
                  placeholder='Ask about jobs, skills, or interview tips...'
                  disabled={isSending}
                  className='w-full bg-secondary/50 hover:bg-secondary/70 focus:bg-background border-transparent border focus:border-primary/20 rounded-full pl-6 pr-12 py-3.5 focus:outline-none focus:ring-2 focus:ring-primary/10 disabled:opacity-50 transition-all shadow-lg hover:shadow-xl backdrop-blur-sm'
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={isSending || !message.trim()}
                  className='absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 disabled:opacity-0 disabled:scale-75 transition-all shadow-md'>
                  <Send className='w-4 h-4' />
                </button>
              </div>
            </div>
          </div>
          </div>


        </div>

        {/* Jobs Sidebar */}
        {showJobs && displayedJobs.length > 0 && (
          <div className="flex-1 bg-background flex flex-col min-w-0 animate-fadeIn">
            <div className="p-4 border-b border-border/40 flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-primary" />
                Recommended Jobs <span className="text-muted-foreground text-xs font-normal">({displayedJobs.length})</span>
              </h3>
              <button
                onClick={() => setShowJobs(false)}
                className="text-xs text-muted-foreground hover:text-foreground underline">
                Hide
              </button>
            </div>

            <div ref={jobsContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
              {displayedJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onSave={saveJob}
                  onUnsave={unsaveJob}
                  onApply={applyToJob}
                  onChoose={handleChooseJob}
                  isSaved={savedJobs.some((j) => j.id === job.id)}
                  isApplied={appliedJobs.some((j) => j.id === job.id)}
                />
              ))}

              <div className="p-8 text-center text-muted-foreground text-sm">
                <p>End of recommendations</p>
                <p className="text-xs mt-1">Refine your search for more results</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
