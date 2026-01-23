import React, { useState } from 'react';
import { Upload, Check, Loader2, Mail, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { UserProfile, SignInData, Job, Chat, Message } from '../App';
import { uploadResume, confirmOnboarding, signIn } from '../services/api';

interface OnboardingPageProps {
  onComplete: (profile: UserProfile, signInData?: SignInData) => void;
}

export default function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const [mode, setMode] = useState<'choice' | 'signin' | 'onboard'>('choice');
  const [signInEmail, setSignInEmail] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [resumeUploaded, setResumeUploaded] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    location: '',
    skills: [] as string[],
    experience: [] as string[],
    profile_summary: '',
    education: [] as string[],
    certificationsAndAchievementsAndAwards: [] as string[],
    projects: [] as string[],
    about: '',
  });
  const [skillInput, setSkillInput] = useState('');
  const [experienceInput, setExperienceInput] = useState('');
  const [educationInput, setEducationInput] = useState('');
  const [certificationInput, setCertificationInput] = useState('');
  const [projectInput, setProjectInput] = useState('');

  const handleSignIn = async () => {
    if (!signInEmail.trim()) {
      toast.error('Please enter your email');
      return;
    }

    setIsSigningIn(true);
    try {
      const response = await signIn(signInEmail.trim());
      if (response.exists && response.user) {
        const profileData = { ...response.user, resumeUploaded: true };
        
        // Convert saved jobs from DB format to frontend Job format
        const savedJobs: Job[] = (response.saved_jobs || []).map(job => ({
          id: job.job_id,
          title: job.job_title,
          company: job.company_name,
          role: 'Full-time',
          description: '',
          location: '',
          salary: '',
          applyLink: job.job_link,
        }));
        
        // Convert applied jobs from DB format to frontend Job format
        const appliedJobs: Job[] = (response.applied_jobs || []).map(job => ({
          id: job.job_id,
          title: job.job_title,
          company: job.company_name,
          role: 'Full-time',
          description: '',
          location: '',
          salary: '',
          applyLink: job.job_link,
        }));
        
        // Convert chat history from DB format to frontend Chat format
        const chats: Chat[] = (response.chat_history || []).map(chat => ({
          id: chat.id || chat.chat_id,
          title: chat.chat_name,
          messages: (chat.messages || []).map((msg, idx) => ({
            id: `msg-${idx}`,
            sender: msg.sender as 'user' | 'bot',
            content: msg.message,
            timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
          })),
          timestamp: chat.created_at ? new Date(chat.created_at) : new Date(),
        }));
        
        const signInData: SignInData = {
          profile: profileData,
          savedJobs,
          appliedJobs,
          chats,
        };
        
        console.log('[SIGN_IN] Loaded data:', {
          savedJobs: savedJobs.length,
          appliedJobs: appliedJobs.length,
          chats: chats.length,
        });
        
        onComplete(profileData, signInData);
        toast.success(`Welcome back, ${response.user.name}!`);
      } else {
        toast.error('No account found with this email. Please sign up.');
        setMode('onboard');
      }
    } catch (error) {
      console.error('Error signing in:', error);
      toast.error('Failed to sign in. Please try again.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        const extractedData = await uploadResume(file);
        setFormData({
          ...formData,
          ...extractedData,
          // Ensure arrays are initialized if they come back as null/undefined
          skills: extractedData.skills || [],
          experience: extractedData.experience || [],
          education: extractedData.education || [],
          certificationsAndAchievementsAndAwards: extractedData.certificationsAndAchievementsAndAwards || [],
          projects: extractedData.projects || [],
        });
        setResumeUploaded(true);
        toast.success('Resume uploaded and details extracted!');
      } catch (error) {
        console.error('Error uploading resume:', error);
        toast.error('Failed to upload resume. Please try again.');
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const addSkill = () => {
    if (skillInput.trim() && !formData.skills.includes(skillInput.trim())) {
      setFormData({
        ...formData,
        skills: [...formData.skills, skillInput.trim()],
      });
      setSkillInput('');
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setFormData({
      ...formData,
      skills: formData.skills.filter((skill) => skill !== skillToRemove),
    });
  };

  const addExperience = () => {
    if (experienceInput.trim() && !formData.experience.includes(experienceInput.trim())) {
      setFormData({
        ...formData,
        experience: [...formData.experience, experienceInput.trim()],
      });
      setExperienceInput('');
    }
  };

  const removeExperience = (experienceToRemove: string) => {
    setFormData({
      ...formData,
      experience: formData.experience.filter((experience) => experience !== experienceToRemove),
    });
  };

  const addEducation = () => {
    if (educationInput.trim() && !formData.education.includes(educationInput.trim())) {
      setFormData({
        ...formData,
        education: [...formData.education, educationInput.trim()],
      });
      setEducationInput('');
    }
  };

  const removeEducation = (educationToRemove: string) => {
    setFormData({
      ...formData,
      education: formData.education.filter((education) => education !== educationToRemove),
    });
  };

  const addCertification = () => {
    if (certificationInput.trim() && !formData.certificationsAndAchievementsAndAwards.includes(certificationInput.trim())) {
      setFormData({
        ...formData,
        certificationsAndAchievementsAndAwards: [...formData.certificationsAndAchievementsAndAwards, certificationInput.trim()],
      });
      setCertificationInput('');
    }
  };

  const removeCertification = (certificationToRemove: string) => {
    setFormData({
      ...formData,
      certificationsAndAchievementsAndAwards: formData.certificationsAndAchievementsAndAwards.filter((certification) => certification !== certificationToRemove),
    });
  };

  const addProject = () => {
    if (projectInput.trim() && !formData.projects.includes(projectInput.trim())) {
      setFormData({
        ...formData,
        projects: [...formData.projects, projectInput.trim()],
      });
      setProjectInput('');
    }
  };

  const removeProject = (projectToRemove: string) => {
    setFormData({
      ...formData,
      projects: formData.projects.filter((project) => project !== projectToRemove),
    });
  };

  const handleSubmit = async () => {
    if (!resumeUploaded) {
      toast.error('Please upload your resume first');
      return;
    }
    if (!formData.name || !formData.email) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const profileData = { ...formData, resumeUploaded: true };
      await confirmOnboarding(profileData);
      onComplete(profileData);
      toast.success('Profile created successfully!');
    } catch (error) {
      console.error('Error confirming onboarding:', error);
      toast.error('Failed to create profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-card rounded-2xl shadow-xl p-8 border border-border">
        
        {/* Choice Screen */}
        {mode === 'choice' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="text-center mb-8">
              <h1 className="text-foreground text-3xl font-bold mb-3">Welcome to JobBot</h1>
              <p className="text-muted-foreground">Your AI-powered career assistant</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Sign In Option */}
              <button
                onClick={() => setMode('signin')}
                className="group p-6 bg-background border-2 border-border rounded-xl hover:border-primary hover:bg-primary/5 transition-all text-left"
              >
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <Mail className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-foreground font-semibold text-lg mb-2">Sign In</h3>
                <p className="text-muted-foreground text-sm">Already have an account? Sign in with your email</p>
              </button>

              {/* New User Option */}
              <button
                onClick={() => setMode('onboard')}
                className="group p-6 bg-background border-2 border-border rounded-xl hover:border-primary hover:bg-primary/5 transition-all text-left"
              >
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <Upload className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-foreground font-semibold text-lg mb-2">New User</h3>
                <p className="text-muted-foreground text-sm">Create a new profile by uploading your resume</p>
              </button>
            </div>
          </div>
        )}

        {/* Sign In Screen */}
        {mode === 'signin' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="mb-8">
              <button
                onClick={() => setMode('choice')}
                className="text-muted-foreground hover:text-foreground text-sm mb-4 flex items-center gap-1"
              >
                ← Back
              </button>
              <h1 className="text-foreground text-2xl font-bold mb-2">Welcome Back</h1>
              <p className="text-muted-foreground">Sign in with your email to continue</p>
            </div>

            <div>
              <label htmlFor="signin-email" className="block text-foreground mb-2 font-medium text-sm">Email Address</label>
              <input
                id="signin-email"
                type="email"
                value={signInEmail}
                onChange={(e) => setSignInEmail(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSignIn()}
                placeholder="Enter your email"
                className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-border outline-none text-foreground"
              />
            </div>

            <button
              onClick={handleSignIn}
              disabled={isSigningIn}
              className="w-full py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
            >
              {isSigningIn ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            <p className="text-center text-muted-foreground text-sm">
              Don't have an account?{' '}
              <button onClick={() => setMode('onboard')} className="text-primary hover:underline font-medium">
                Create one
              </button>
            </p>
          </div>
        )}

        {/* Onboarding Screen */}
        {mode === 'onboard' && (
          <div className="animate-fadeIn">
            <div className="mb-8">
              <button
                onClick={() => setMode('choice')}
                className="text-muted-foreground hover:text-foreground text-sm mb-4 flex items-center gap-1"
              >
                ← Back
              </button>
              <h1 className="text-foreground text-2xl font-bold mb-2">Create Your Profile</h1>
              <p className="text-muted-foreground">Let's get started by uploading your resume</p>
            </div>

        {/* Resume Upload Section */}
        <div className="mb-8">
          <label className="block text-foreground mb-3 font-medium">Upload Resume</label>
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${resumeUploaded
              ? 'border-green-500 bg-green-500/10'
              : 'border-border hover:border-primary hover:bg-primary/5'
              }`}
          >
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleFileUpload}
              className="hidden"
              id="resume-upload"
            />
            <label htmlFor="resume-upload" className="cursor-pointer">
              {isUploading ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                  <p className="text-primary font-medium">Analyzing resume...</p>
                </div>
              ) : resumeUploaded ? (
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-4">
                    <Check className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-green-700">Resume uploaded successfully!</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Upload className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground font-medium">Click to upload or drag and drop</p>
                  <p className="text-muted-foreground/70 text-sm mt-1">PDF, DOC, DOCX (Max 10MB)</p>
                </div>
              )}
            </label>
          </div>
        </div>

        {/* Editable Fields */}
        {resumeUploaded && (
          <div className="space-y-6 animate-fadeIn">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-foreground mb-2 font-medium text-sm">Full Name *</label>
                <input
                  id="name"
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-border outline-none text-foreground"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-foreground mb-2 font-medium text-sm">Email *</label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-border outline-none text-foreground"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="phone" className="block text-foreground mb-2 font-medium text-sm">Phone</label>
                <input
                  id="phone"
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-border outline-none text-foreground"
                />
              </div>
              <div>
                <label htmlFor="location" className="block text-foreground mb-2 font-medium text-sm">Location</label>
                <input
                  id="location"
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-border outline-none text-foreground"
                />
              </div>
            </div>

            <div>
              <label className="block text-foreground mb-2 font-medium text-sm">Skills</label>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                  placeholder="Add a skill"
                  aria-label="Add a skill"
                  className="flex-1 px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-border outline-none text-foreground"
                />
                <button
                  onClick={addSkill}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.skills.map((skill) => (
                  <span
                    key={skill}
                    className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm flex items-center gap-2"
                  >
                    {skill}
                    <button
                      onClick={() => removeSkill(skill)}
                      className="hover:text-primary/70"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-foreground mb-2 font-medium text-sm">Profile Summary</label>
              <textarea
                name="profile_summary"
                value={formData.profile_summary}
                onChange={handleInputChange}
                rows={4}
                placeholder="Brief summary of your professional background"
                className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-border outline-none resize-none text-foreground"
              />
            </div>

            <div>
              <label className="block text-foreground mb-2 font-medium text-sm">Experience</label>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={experienceInput}
                  onChange={(e) => setExperienceInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addExperience())}
                  placeholder="Add experience"
                  aria-label="Add experience"
                  className="flex-1 px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-border outline-none text-foreground"
                />
                <button
                  onClick={addExperience}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.experience.map((experience) => (
                  <span
                    key={experience}
                    className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm flex items-center gap-2"
                  >
                    {experience}
                    <button
                      onClick={() => removeExperience(experience)}
                      className="hover:text-primary/70"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-foreground mb-2 font-medium text-sm">Education</label>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={educationInput}
                  onChange={(e) => setEducationInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addEducation())}
                  placeholder="Add education"
                  aria-label="Add education"
                  className="flex-1 px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-border outline-none text-foreground"
                />
                <button
                  onClick={addEducation}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.education.map((education) => (
                  <span
                    key={education}
                    className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm flex items-center gap-2"
                  >
                    {education}
                    <button
                      onClick={() => removeEducation(education)}
                      className="hover:text-primary/70"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-foreground mb-2 font-medium text-sm">Certifications and Achievements and Awards</label>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={certificationInput}
                  onChange={(e) => setCertificationInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCertification())}
                  placeholder="Add certification"
                  aria-label="Add certification"
                  className="flex-1 px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-border outline-none text-foreground"
                />
                <button
                  onClick={addCertification}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.certificationsAndAchievementsAndAwards.map((certification) => (
                  <span
                    key={certification}
                    className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm flex items-center gap-2"
                  >
                    {certification}
                    <button
                      onClick={() => removeCertification(certification)}
                      className="hover:text-primary/70"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-foreground mb-2 font-medium text-sm">Projects</label>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={projectInput}
                  onChange={(e) => setProjectInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addProject())}
                  placeholder="Add project"
                  aria-label="Add project"
                  className="flex-1 px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-border outline-none text-foreground"
                />
                <button
                  onClick={addProject}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.projects.map((project) => (
                  <span
                    key={project}
                    className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm flex items-center gap-2"
                  >
                    {project}
                    <button
                      onClick={() => removeProject(project)}
                      className="hover:text-primary/70"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="about" className="block text-foreground mb-2 font-medium text-sm">About</label>
              <textarea
                id="about"
                name="about"
                value={formData.about}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-border outline-none resize-none text-foreground"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Creating Profile...
                </>
              ) : (
                'Next'
              )}
            </button>
          </div>
        )}
          </div>
        )}
      </div>
    </div>
  );
}