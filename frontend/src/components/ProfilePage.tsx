import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  LogOut,
  Camera,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  GraduationCap,
  Award,
  FolderKanban,
  FileText,
  Plus,
  X,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { UserProfile } from '../App';
import { ThemeToggle } from './ThemeToggle';

interface ProfilePageProps {
  userProfile: UserProfile;
  updateProfile: (profile: UserProfile) => void;
  signOut: () => void;
}

export default function ProfilePage({
  userProfile,
  updateProfile,
  signOut,
}: ProfilePageProps) {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(userProfile);
  const [skillInput, setSkillInput] = useState('');
  const [experienceInput, setExperienceInput] = useState('');
  const [educationInput, setEducationInput] = useState('');
  const [certificationInput, setCertificationInput] = useState('');
  const [projectInput, setProjectInput] = useState('');

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
    if (
      experienceInput.trim() &&
      !formData.experience.includes(experienceInput.trim())
    ) {
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
      experience: formData.experience.filter(
        (experience) => experience !== experienceToRemove
      ),
    });
  };

  const addEducation = () => {
    if (
      educationInput.trim() &&
      !formData.education?.includes(educationInput.trim())
    ) {
      setFormData({
        ...formData,
        education: [...(formData.education || []), educationInput.trim()],
      });
      setEducationInput('');
    }
  };

  const removeEducation = (educationToRemove: string) => {
    setFormData({
      ...formData,
      education: formData.education?.filter(
        (education) => education !== educationToRemove
      ),
    });
  };

  const addCertification = () => {
    if (
      certificationInput.trim() &&
      !formData.certificationsAndAchievementsAndAwards?.includes(
        certificationInput.trim()
      )
    ) {
      setFormData({
        ...formData,
        certificationsAndAchievementsAndAwards: [
          ...(formData.certificationsAndAchievementsAndAwards || []),
          certificationInput.trim(),
        ],
      });
      setCertificationInput('');
    }
  };

  const removeCertification = (certificationToRemove: string) => {
    setFormData({
      ...formData,
      certificationsAndAchievementsAndAwards:
        formData.certificationsAndAchievementsAndAwards?.filter(
          (certification) => certification !== certificationToRemove
        ),
    });
  };

  const addProject = () => {
    if (
      projectInput.trim() &&
      !formData.projects?.includes(projectInput.trim())
    ) {
      setFormData({
        ...formData,
        projects: [...(formData.projects || []), projectInput.trim()],
      });
      setProjectInput('');
    }
  };

  const removeProject = (projectToRemove: string) => {
    setFormData({
      ...formData,
      projects: formData.projects?.filter(
        (project) => project !== projectToRemove
      ),
    });
  };

  const handleSave = () => {
    updateProfile(formData);
    setIsEditing(false);
    toast.success('Profile updated successfully');
  };

  const handleCancel = () => {
    setFormData(userProfile);
    setIsEditing(false);
  };

  const handleSignOut = () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      signOut();
      navigate('/');
      toast.success('Signed out successfully');
    }
  };

  return (
    <div className='flex flex-col min-h-screen bg-background text-foreground transition-colors'>
      {/* Header */}
      <header className='sticky top-0 z-50 bg-background border-b border-border'>
        <div className='max-w-5xl mx-auto px-6 h-16 flex items-center justify-between'>
          <button
            onClick={() => navigate('/home')}
            className='flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors'>
            <ArrowLeft className='w-5 h-5' />
            <span className="font-medium">Back</span>
          </button>
          <h2 className='text-lg font-semibold'>My Profile</h2>
          <div className='flex items-center gap-2'>
            <ThemeToggle />
            {!isEditing && (
              <button
                onClick={handleSignOut}
                className='p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all'
                title="Sign Out">
                <LogOut className='w-5 h-5' />
              </button>
            )}
          </div>
        </div>
      </header>

      <div className='flex-1 overflow-y-auto w-full'>
        <div className='max-w-5xl mx-auto px-4 py-8 sm:px-6'>
          {/* Profile Card */}
          <div className='bg-card rounded-2xl shadow-xl border border-border/50 overflow-hidden relative'>

            {/* Cover Gradient */}
            <div className='h-40 bg-gradient-to-r from-secondary to-primary/20 relative'>
              <div className="absolute inset-0 bg-background/10 backdrop-blur-[2px]"></div>
            </div>

            <div className='px-6 sm:px-10 pb-10'>
              {/* Header Group with Avatar and Main Actions */}
              <div className="flex flex-col sm:flex-row items-end sm:items-center justify-between gap-4 -mt-12 mb-8 relative z-10">
                <div className="relative group">
                  <div className='w-32 h-32 rounded-full border-4 border-card bg-muted flex items-center justify-center overflow-hidden shadow-2xl'>
                    {formData.profilePhoto ? (
                      <img
                        src={formData.profilePhoto}
                        alt='Profile'
                        className='w-full h-full object-cover'
                      />
                    ) : (
                      <User className='w-12 h-12 text-muted-foreground' />
                    )}
                  </div>
                </div>

                <div className="flex gap-3">
                  {isEditing ? (
                    <>
                      <button
                        onClick={handleCancel}
                        className='px-4 py-2 rounded-xl border border-border bg-background hover:bg-muted text-foreground font-medium transition-colors'>
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        className='px-6 py-2 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center gap-2'>
                        <Save className="w-4 h-4" />
                        Save Changes
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setIsEditing(true)}
                      className='px-6 py-2 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all'>
                      Edit Profile
                    </button>
                  )}
                </div>
              </div>

              {/* Form Grid */}
              <div className='grid gap-8'>

                {/* Personal Info Section */}
                <div className="grid md:grid-cols-2 gap-6 animate-fadeIn">
                  {/* Name */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" /> Full Name
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="w-full bg-background border border-border rounded-lg px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      />
                    ) : (
                      <p className="text-xl font-semibold text-foreground">{formData.name}</p>
                    )}
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" /> Email
                    </label>
                    {isEditing ? (
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="w-full bg-background border border-border rounded-lg px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      />
                    ) : (
                      <p className="text-lg text-foreground">{formData.email}</p>
                    )}
                  </div>

                  {/* Phone */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" /> Phone
                    </label>
                    {isEditing ? (
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="w-full bg-background border border-border rounded-lg px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      />
                    ) : (
                      <p className="text-lg text-foreground">{formData.location}</p>
                    )}
                  </div>

                  {/* Location */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" /> Location
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        name="location"
                        value={formData.location}
                        onChange={handleInputChange}
                        className="w-full bg-background border border-border rounded-lg px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      />
                    ) : (
                      <p className="text-lg text-foreground">{formData.location}</p>
                    )}
                  </div>
                </div>

                <div className="border-t border-border/50 my-2"></div>

                {/* About Section */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-primary flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Profile Summary & About
                  </label>
                  {isEditing ? (
                    <div className="space-y-4">
                      <textarea
                        name="profile_summary"
                        value={formData.profile_summary}
                        onChange={handleInputChange}
                        rows={3}
                        placeholder="Short professional summary..."
                        className="w-full bg-background/50 border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 resize-none"
                      />
                      <textarea
                        name="about"
                        value={formData.about || ''}
                        onChange={handleInputChange}
                        rows={4}
                        placeholder="Detailed about me..."
                        className="w-full bg-background/50 border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 resize-none"
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-secondary/20 p-5 rounded-xl border border-secondary/30">
                        <p className="text-foreground leading-relaxed whitespace-pre-line">{formData.profile_summary}</p>
                      </div>
                      {formData.about && (
                        <div className="text-muted-foreground leading-relaxed whitespace-pre-line px-1">
                          {formData.about}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Tags Sections Grid */}
                <div className="grid md:grid-cols-2 gap-8">

                  {/* Skills */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-primary flex items-center gap-2">
                        <Briefcase className="w-4 h-4" /> Skills
                      </label>
                    </div>

                    {isEditing && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={skillInput}
                          onChange={(e) => setSkillInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                          placeholder="Add a skill..."
                          className="flex-1 bg-background/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                        />
                        <button
                          onClick={addSkill}
                          className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors">
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {formData.skills.map((skill) => (
                        <span key={skill} className="px-3 py-1.5 bg-secondary/30 text-secondary-foreground border border-secondary/50 rounded-full text-sm font-medium flex items-center gap-1.5 animate-fadeIn">
                          {skill}
                          {isEditing && (
                            <button onClick={() => removeSkill(skill)} className="hover:text-destructive transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Experience (Simplified List) */}
                  <div className="space-y-4">
                    <label className="text-sm font-medium text-primary flex items-center gap-2">
                      <FolderKanban className="w-4 h-4" /> Experience
                    </label>

                    {isEditing && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={experienceInput}
                          onChange={(e) => setExperienceInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addExperience())}
                          placeholder="Add experience..."
                          className="flex-1 bg-background/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                        />
                        <button onClick={addExperience} className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors">
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                    )}

                    <div className="space-y-2">
                      {formData.experience.map((exp, i) => (
                        <div key={i} className="flex items-start justify-between p-3 rounded-lg bg-muted/30 border border-border/50 text-sm">
                          <span className="text-foreground/90">{exp}</span>
                          {isEditing && (
                            <button onClick={() => removeExperience(exp)} className="text-muted-foreground hover:text-destructive">
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Additional Sections Collapsible or stacked */}
                <div className="space-y-6 pt-4 border-t border-border/50">

                  {/* Education */}
                  <div className="space-y-4">
                    <label className="text-sm font-medium text-primary flex items-center gap-2">
                      <GraduationCap className="w-4 h-4" /> Education
                    </label>
                    {isEditing && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={educationInput}
                          onChange={(e) => setEducationInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addEducation())}
                          placeholder="Add education..."
                          className="flex-1 bg-background/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                        />
                        <button onClick={addEducation} className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors">
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                    <div className="grid gap-2">
                      {formData.education?.map((edu, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50 text-sm">
                          <span>{edu}</span>
                          {isEditing && (
                            <button onClick={() => removeEducation(edu)} className="text-muted-foreground hover:text-destructive">
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Certifications */}
                  <div className="space-y-4">
                    <label className="text-sm font-medium text-primary flex items-center gap-2">
                      <Award className="w-4 h-4" /> Certifications & Awards
                    </label>
                    {isEditing && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={certificationInput}
                          onChange={(e) => setCertificationInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCertification())}
                          placeholder="Add certification..."
                          className="flex-1 bg-background/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                        />
                        <button onClick={addCertification} className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors">
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                    <div className="grid gap-2">
                      {formData.certificationsAndAchievementsAndAwards?.map((cert, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50 text-sm">
                          <span>{cert}</span>
                          {isEditing && (
                            <button onClick={() => removeCertification(cert)} className="text-muted-foreground hover:text-destructive">
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Projects */}
                  <div className="space-y-4">
                    <label className="text-sm font-medium text-primary flex items-center gap-2">
                      <FolderKanban className="w-4 h-4" /> Projects
                    </label>
                    {isEditing && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={projectInput}
                          onChange={(e) => setProjectInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addProject())}
                          placeholder="Add project..."
                          className="flex-1 bg-background/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                        />
                        <button onClick={addProject} className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors">
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                    <div className="grid gap-2">
                      {formData.projects?.map((proj, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50 text-sm">
                          <span>{proj}</span>
                          {isEditing && (
                            <button onClick={() => removeProject(proj)} className="text-muted-foreground hover:text-destructive">
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
