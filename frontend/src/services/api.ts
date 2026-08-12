import { UserProfile } from '../App';
import { authFetch, getAccessToken, API_BASE_URL, getErrorMessage } from './auth';

const getUrl = (path: string): string => {
  return path.startsWith('http://') || path.startsWith('https://')
    ? path
    : `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
};

// Types for chat API
export interface JobCardData {
  job_id: string;
  job_title: string;
  employer_name: string;
  job_description: string;
  job_location?: string;
  job_salary?: string;
  job_employment_type?: string;
  job_apply_link?: string;
  job_posted_at?: string;
  job_is_remote?: boolean;
  employer_logo?: string;
  job_highlights?: {
    Qualifications?: string[];
    Responsibilities?: string[];
  };
}

export interface SignInResponse {
  exists: boolean;
  user: UserProfile | null;
  saved_jobs?: Array<{
    job_id: string;
    job_title: string;
    company_name: string;
    job_link: string;
  }>;
  applied_jobs?: Array<{
    job_id: string;
    job_title: string;
    company_name: string;
    job_link: string;
  }>;
  chat_history?: Array<{
    id: string;
    chat_id: string;
    chat_name: string;
    messages: Array<{
      sender: string;
      message: string;
      timestamp?: string;
    }>;
    created_at?: string;
  }>;
}

export interface CreateChatResponse {
  chat_id: string;
  chat_name: string;
  initial_message: string;
}

export interface ChatMessageResponse {
  message: string;
  jobs?: JobCardData[];
  selected_job_details?: JobCardData;
}

export interface ChatMessage {
  sender: 'user' | 'bot';
  message: string;
  timestamp?: string;
  selected_job_id?: string;
}

export interface GetChatMessagesResponse {
  messages: ChatMessage[];
  chat_name: string;
}

// ==================== HELPER FUNCTIONS ====================

const getAuthHeaders = (): Record<string, string> => {
  const token = getAccessToken();
  if (token) {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }
  return {
    'Content-Type': 'application/json',
  };
};

// ==================== ONBOARDING API FUNCTIONS ====================

export const uploadResume = async (file: File): Promise<UserProfile> => {
  const token = getAccessToken();
  const headers: Record<string, string> = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(getUrl('/api/onboardFileUpload'), {
    method: 'POST',
    body: file,
    headers,
  });

  if (!response.ok) {
    const message = await getErrorMessage(response, 'Failed to upload resume');
    throw new Error(message);
  }

  return response.json();
};

/**
 * @deprecated Use auth service login instead
 */
export const signIn = async (email: string): Promise<SignInResponse> => {
  const response = await fetch(getUrl('/api/signIn'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const message = await getErrorMessage(response, 'Failed to sign in');
    throw new Error(message);
  }

  return response.json();
};

export const confirmOnboarding = async (
  data: UserProfile
): Promise<{ message: string; id?: string }> => {
  const response = await authFetch('/api/confirmOnboardingDetails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to confirm onboarding details');
  }

  return response.json();
};

// ==================== CHAT API FUNCTIONS ====================

export const createChat = async (): Promise<CreateChatResponse> => {
  const response = await authFetch('/api/createChat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to create chat');
  }

  return response.json();
};

export const sendMessage = async (
  chatId: string,
  message: string,
  selectedJobId?: string,
  selectedJobData?: JobCardData
): Promise<ChatMessageResponse> => {
  const response = await authFetch('/api/sendMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      message,
      selected_job_id: selectedJobId,
      selected_job_data: selectedJobData,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to send message');
  }

  return response.json();
};

export const getChatMessages = async (
  chatId: string
): Promise<GetChatMessagesResponse> => {
  const response = await authFetch(
    `/api/getChatMessages?chat_id=${encodeURIComponent(chatId)}`
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to get chat messages');
  }

  return response.json();
};

export const getChatHistory = async (): Promise<{
  chats: Array<{ id: string; chat_name: string; chat_id: string }>;
}> => {
  const response = await authFetch('/api/chatHistory');

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to get chat history');
  }

  return response.json();
};

export const deleteChatSession = async (
  chatId: string
): Promise<{ message: string }> => {
  const response = await authFetch(
    `/api/chat/${encodeURIComponent(chatId)}`,
    {
      method: 'DELETE',
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to delete chat session');
  }

  return response.json();
};

// ==================== JOB API FUNCTIONS ====================

export const saveJob = async (jobData: {
  job_id: string;
  job_title: string;
  company_name: string;
  job_link: string;
}): Promise<{ message: string }> => {
  const response = await authFetch('/api/saveJob', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(jobData),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to save job');
  }

  return response.json();
};

export const unsaveJob = async (jobId: string): Promise<{ message: string }> => {
  const response = await authFetch(`/api/savedJob/${jobId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to unsave job');
  }

  return response.json();
};

export const getSavedJobs = async (): Promise<{
  saved_jobs: Array<{
    job_id: string;
    job_title: string;
    company_name: string;
    job_link: string;
  }>;
}> => {
  const response = await authFetch('/api/savedJobs');

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to get saved jobs');
  }

  return response.json();
};

export const applyJob = async (jobData: {
  job_id: string;
  job_title: string;
  company_name: string;
  job_link: string;
}): Promise<{ message: string }> => {
  const response = await authFetch('/api/applyJob', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(jobData),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to apply to job');
  }

  return response.json();
};

export const getAppliedJobs = async (): Promise<{
  applied_jobs: Array<{
    job_id: string;
    job_title: string;
    company_name: string;
    job_link: string;
  }>;
}> => {
  const response = await authFetch('/api/appliedJobs');

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to get applied jobs');
  }

  return response.json();
};

// ==================== USER PROFILE API FUNCTIONS ====================

export const getUserProfile = async (): Promise<UserProfile> => {
  const response = await authFetch('/api/profile');

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to get user profile');
  }

  return response.json();
};

export const updateUserProfile = async (
  profileData: Partial<UserProfile>
): Promise<{ message: string }> => {
  const response = await authFetch('/api/updateUserProfile', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(profileData),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to update profile');
  }

  return response.json();
};

// ==================== INTERVIEW API TYPES ====================

export interface InterviewQuestion {
  id: string;
  question: string;
  follow_up_count: number;
}

export interface Interviewer {
  id: number;
  agent_id?: string;
  name: string;
  description: string;
  image: string;
  audio?: string;
  empathy: number;
  exploration: number;
  rapport: number;
  speed: number;
}

export interface Interview {
  id: string;
  name: string;
  description: string;
  objective: string;
  interviewer_id: number;
  questions: InterviewQuestion[];
  question_count: number;
  time_duration: string;
  is_active: boolean;
  response_count: number;
  job_id?: string;
  job_title?: string;
  company_name?: string;
  created_at: string;
  url: string;
}

export interface InterviewResponse {
  id: string;
  interview_id: string;
  name: string;
  email: string;
  call_id: string;
  candidate_status: string;
  duration: number;
  is_analysed: boolean;
  is_ended: boolean;
  created_at: string;
  analytics?: InterviewAnalytics;
  interview_name?: string;
  job_title?: string;
  company_name?: string;
}

export interface InterviewAnalytics {
  overall_score: number;
  communication_score: number;
  technical_score: number;
  strengths: string[];
  improvements: string[];
  notable_quotes: string[];
}

export interface RegisterCallResponse {
  call_id: string;
  access_token: string;
}

// ==================== INTERVIEW API FUNCTIONS ====================

export const getInterviewers = async (): Promise<{ interviewers: Interviewer[] }> => {
  const response = await authFetch('/api/interviewers');
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to get interviewers');
  }
  return response.json();
};

export const createInterview = async (data: {
  name: string;
  objective: string;
  interviewer_id?: number;
  question_count?: number;
  time_duration?: string;
  job_id?: string;
  job_title?: string;
  company_name?: string;
  job_description?: string;
}): Promise<Interview> => {
  const response = await authFetch('/api/createInterview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to create interview');
  }
  return response.json();
};

export const createJobInterview = async (data: {
  job_id: string;
  job_title: string;
  company_name: string;
  job_description: string;
  interviewer_id?: number;
  question_count?: number;
  time_duration?: string;
}): Promise<Interview> => {
  const response = await authFetch('/api/createJobInterview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to create job interview');
  }
  return response.json();
};

export const getUserInterviews = async (): Promise<{ interviews: Interview[] }> => {
  const response = await authFetch('/api/interviews');
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to get interviews');
  }
  return response.json();
};

export const getInterview = async (interviewId: string): Promise<Interview> => {
  const response = await authFetch(`/api/interview/${interviewId}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to get interview');
  }
  return response.json();
};

export const deleteInterview = async (interviewId: string): Promise<{ message: string }> => {
  const response = await authFetch(`/api/interview/${interviewId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to delete interview');
  }
  return response.json();
};

export const registerCall = async (data: {
  interview_id: string;
  interviewer_id: number;
  user_name: string;
}): Promise<RegisterCallResponse> => {
  const response = await authFetch('/api/registerCall', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to register call');
  }
  return response.json();
};

export const updateInterviewResponse = async (data: {
  call_id: string;
  is_ended?: boolean;
  duration?: number;
  tab_switch_count?: number;
}): Promise<{ message: string }> => {
  const response = await authFetch('/api/updateInterviewResponse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to update response');
  }
  return response.json();
};

export const getInterviewHistory = async (): Promise<{ responses: InterviewResponse[] }> => {
  const response = await authFetch('/api/interviewHistory');
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to get interview history');
  }
  return response.json();
};

export const analyzeInterview = async (
  callId: string
): Promise<InterviewAnalytics> => {
  const response = await authFetch('/api/analyzeInterview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ call_id: callId }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to analyze interview');
  }
  return response.json();
};

export const submitInterviewFeedback = async (data: {
  interview_id: string;
  feedback: string;
  satisfaction: number;
}): Promise<{ message: string; feedback_id: string }> => {
  const response = await authFetch('/api/submitInterviewFeedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to submit feedback');
  }
  return response.json();
};
