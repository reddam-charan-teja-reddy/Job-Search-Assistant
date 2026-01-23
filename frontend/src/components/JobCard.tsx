import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bookmark,
  BookmarkX,
  CheckCircle,
  MapPin,
  DollarSign,
  Briefcase,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { Job } from '../App';
import JobDetailModal from './JobDetailModal';

interface JobCardProps {
  job: Job;
  onSave: (job: Job) => void;
  onUnsave: (job: Job) => void;
  onApply: (job: Job) => void;
  onChoose: (job: Job) => void;
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
          Did you successfully apply to <span className="text-primary font-medium">{job.title}</span>?
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={onConfirm}
            className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Yes, I Applied
          </button>
          <button
            onClick={onCancel}
            className="w-full py-3 bg-muted/50 text-foreground font-medium rounded-xl hover:bg-muted transition-all">
            No, Not Yet
          </button>
        </div>
      </div>
    </div>,
    modalRoot
  );
}

export default function JobCard({
  job,
  onSave,
  onUnsave,
  onApply,
  onChoose,
  isSaved,
  isApplied,
}: JobCardProps) {
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showApplyConfirmation, setShowApplyConfirmation] = useState(false);

  const handleSaveToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSaved) {
      onUnsave(job);
      toast.success('Job removed from saved');
    } else {
      onSave(job);
      toast.success('Job saved');
    }
  };

  const handleApply = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isApplied) {
      toast.info('You already applied to this job');
      return;
    }

    if (job.applyLink) {
      window.open(job.applyLink, '_blank');
    }

    setShowApplyConfirmation(true);
  };

  const handleConfirmApply = () => {
    onApply(job);
    setShowApplyConfirmation(false);
    toast.success('Application recorded');
  };

  const handleCancelApply = () => {
    setShowApplyConfirmation(false);
  };

  const handleChoose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChoose(job);
  };

  return (
    <>
      <div
        className="group relative bg-card hover:bg-card/80 border border-border hover:border-primary/30 rounded-2xl p-5 transition-all duration-300 hover:shadow-lg cursor-pointer"
        onClick={() => setShowDetailModal(true)}>

        {/* Header Section */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1 min-w-0 pr-4">
            <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors truncate">
              {job.title}
            </h3>
            <p className="text-muted-foreground text-sm font-medium truncate">
              {job.company}
            </p>
          </div>
          <button
            onClick={handleSaveToggle}
            className={`p-2 rounded-full transition-all ${isSaved
              ? 'text-primary bg-primary/10'
              : 'text-muted-foreground/50 hover:text-foreground hover:bg-muted'
              }`}
            title={isSaved ? 'Unsave' : 'Save'}>
            {isSaved ? (
              <BookmarkX className="w-5 h-5 fill-current" />
            ) : (
              <Bookmark className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Tags Row */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/30 text-xs font-medium text-secondary-foreground border border-secondary/50">
            <Briefcase className="w-3 h-3" />
            {job.role}
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/30 text-xs font-medium text-secondary-foreground border border-secondary/50">
            <MapPin className="w-3 h-3" />
            {job.location}
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/30 text-xs font-medium text-secondary-foreground border border-secondary/50">
            <DollarSign className="w-3 h-3" />
            {job.salary}
          </div>
          {job.isRemote && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium border border-green-500/30">
              Remote
            </span>
          )}
        </div>

        {/* Action Row - Only visible/highlighted on hover/focus in some designs, but keeping always visible for usability */}
        <div className="flex items-center gap-3 pt-4 border-t border-border/50 mt-auto">
          <button
            onClick={handleChoose}
            className="flex-1 py-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors flex items-center justify-center gap-1 group/btn"
          >
            Ask Advice
            <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
          </button>

          <button
            onClick={handleApply}
            disabled={isApplied}
            className={`flex-1 py-2 px-4 rounded-xl text-sm font-semibold transition-all ${isApplied
              ? 'bg-green-500/20 text-green-400 cursor-not-allowed border border-green-500/30'
              : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-primary/20'
              }`}
          >
            {isApplied ? 'Applied' : 'Apply Now'}
          </button>
        </div>
      </div>

      <JobDetailModal
        job={job}
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        onSave={onSave}
        onUnsave={onUnsave}
        onApply={(j) => {
          onApply(j);
          toast.success('Application recorded');
        }}
        isSaved={isSaved}
        isApplied={isApplied}
      />

      <ApplyConfirmationModal
        isOpen={showApplyConfirmation}
        job={job}
        onConfirm={handleConfirmApply}
        onCancel={handleCancelApply}
      />
    </>
  );
}

