import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Bookmark,
  BookmarkX,
  ExternalLink,
  MapPin,
  DollarSign,
  Briefcase,
  Clock,
  Building2,
  CheckCircle,
} from 'lucide-react';
import { Job } from '../App';

interface JobDetailModalProps {
  job: Job;
  isOpen: boolean;
  onClose: () => void;
  onSave: (job: Job) => void;
  onUnsave: (job: Job) => void;
  onApply: (job: Job) => void;
  isSaved: boolean;
  isApplied: boolean;
}

interface ApplyConfirmationModalProps {
  isOpen: boolean;
  job: Job;
  onConfirm: () => void;
  onCancel: () => void;
}

function ApplyConfirmationModal({
  isOpen,
  job,
  onConfirm,
  onCancel,
}: ApplyConfirmationModalProps) {
  if (!isOpen) return null;

  const modalRoot = document.getElementById('modal-root') || document.body;

  return createPortal(
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[99999] p-4 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-card w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-secondary"
        onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-semibold text-foreground mb-2 text-center">
          Confirm Application
        </h3>
        <p className="text-muted-foreground mb-6 text-center">
          Confirm you applied to <span className="text-primary font-medium">{job.title}</span>?
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={onConfirm}
            className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Yes, Confirmed
          </button>
          <button
            onClick={onCancel}
            className="w-full py-3 bg-muted/50 text-foreground font-medium rounded-xl hover:bg-muted transition-all">
            Cancel
          </button>
        </div>
      </div>
    </div>,
    modalRoot
  );
}

export default function JobDetailModal({
  job,
  isOpen,
  onClose,
  onSave,
  onUnsave,
  onApply,
  isSaved,
  isApplied,
}: JobDetailModalProps) {
  const [showApplyConfirmation, setShowApplyConfirmation] = useState(false);

  if (!isOpen) return null;

  const handleApplyClick = () => {
    if (isApplied) return;
    if (job.applyLink) window.open(job.applyLink, '_blank');
    setShowApplyConfirmation(true);
  };

  const handleConfirmApply = () => {
    onApply(job);
    setShowApplyConfirmation(false);
  };

  const handleCancelApply = () => {
    setShowApplyConfirmation(false);
  };

  const handleSaveToggle = () => {
    isSaved ? onUnsave(job) : onSave(job);
  };

  const modalRoot = document.getElementById('modal-root') || document.body;

  const modalContent = (
    <>
      <div
        className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4 sm:p-6 overflow-hidden backdrop-blur-sm animate-fadeIn"
        onClick={onClose}>
        <div
          className="bg-card w-full max-w-5xl h-full max-h-[90vh] rounded-2xl shadow-2xl flex flex-col border border-border animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}>

          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-border/50 bg-background/50">
            <div className="flex gap-5">
              <div className="w-16 h-16 rounded-xl bg-background border border-border flex items-center justify-center p-3 shadow-sm">
                {job.employerLogo ? (
                  <img src={job.employerLogo} alt={job.company} className="w-full h-full object-contain" />
                ) : (
                  <Building2 className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground leading-tight mb-1">
                  {job.title}
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                  <span className="font-medium text-foreground">{job.company}</span>
                  <span>•</span>
                  <span className="text-sm">{job.location}</span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 -mr-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-all">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8">
            {/* Meta Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-secondary/30 border border-secondary/50">
                <Briefcase className="w-5 h-5 text-primary mb-2" />
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Role</p>
                <p className="font-medium text-foreground mt-0.5">{job.role}</p>
              </div>
              <div className="p-4 rounded-xl bg-secondary/30 border border-secondary/50">
                <MapPin className="w-5 h-5 text-primary mb-2" />
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Location</p>
                <p className="font-medium text-foreground mt-0.5">{job.location}</p>
              </div>
              <div className="p-4 rounded-xl bg-secondary/30 border border-secondary/50">
                <DollarSign className="w-5 h-5 text-primary mb-2" />
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Salary</p>
                <p className="font-medium text-foreground mt-0.5">{job.salary}</p>
              </div>
              <div className="p-4 rounded-xl bg-secondary/30 border border-secondary/50">
                <Clock className="w-5 h-5 text-primary mb-2" />
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Posted</p>
                <p className="font-medium text-foreground mt-0.5">{job.postedAt || 'Recently'}</p>
              </div>
            </div>

            {/* Description */}
            <div>
              <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                <div className="w-1 h-5 bg-primary rounded-full" />
                About the Role
              </h3>
              <div className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {job.description}
              </div>
            </div>

            {/* Highlights */}
            {job.highlights && (
              <div className="grid md:grid-cols-2 gap-8">
                {job.highlights.Qualifications && (
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                      <div className="w-1 h-5 bg-primary rounded-full" />
                      Qualifications
                    </h3>
                    <ul className="space-y-2">
                      {job.highlights.Qualifications.map((q, i) => (
                        <li key={i} className="flex gap-2 text-muted-foreground">
                          <span className="text-primary mt-1.5">•</span>
                          <span>{q}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {job.highlights.Responsibilities && (
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                      <div className="w-1 h-5 bg-primary rounded-full" />
                      Responsibilities
                    </h3>
                    <ul className="space-y-2">
                      {job.highlights.Responsibilities.map((r, i) => (
                        <li key={i} className="flex gap-2 text-muted-foreground">
                          <span className="text-primary mt-1.5">•</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-6 border-t border-border bg-background/50 flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleSaveToggle}
              className={`flex-1 py-3 px-6 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${isSaved
                  ? 'bg-secondary/50 text-primary border-2 border-primary/20'
                  : 'bg-card border-2 border-border hover:border-primary/50 text-muted-foreground hover:text-foreground'
                }`}>
              {isSaved ? (
                <>
                  <BookmarkX className="w-5 h-5" /> Unsave Job
                </>
              ) : (
                <>
                  <Bookmark className="w-5 h-5" /> Save for Later
                </>
              )}
            </button>
            <button
              onClick={handleApplyClick}
              disabled={isApplied}
              className={`flex-[2] py-3 px-6 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${isApplied
                  ? 'bg-green-500/20 text-green-500 cursor-not-allowed border border-green-500/50'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-primary/25'
                }`}>
              {isApplied ? (
                <>
                  <CheckCircle className="w-5 h-5" /> Application Sent
                </>
              ) : (
                <>
                  <ExternalLink className="w-5 h-5" /> Apply Now
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <ApplyConfirmationModal
        isOpen={showApplyConfirmation}
        job={job}
        onConfirm={handleConfirmApply}
        onCancel={handleCancelApply}
      />
    </>
  );

  return createPortal(modalContent, modalRoot);
}
