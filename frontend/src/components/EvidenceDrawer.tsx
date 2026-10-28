import React, { useState } from 'react';
import {
  X,
  FileText,
  ExternalLink,
  Info
} from 'lucide-react';
import { Finding, DocumentItem, DemoRole } from '../types';
import { StatusChip } from './StatusChip';
import { getDocumentFileUrl } from '../services/api';

interface EvidenceDrawerProps {
  finding: Finding | null;
  onClose: () => void;
  onReview: (findingId: string, action: string, reason: string) => Promise<void>;
  currentRole: DemoRole;
  documents?: DocumentItem[];
}

export const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({
  finding,
  onClose,
  onReview,
  currentRole,
  documents = []
}) => {
  const [reviewAction, setReviewAction] = useState<'confirm' | 'dismiss' | 'clarification_requested'>('confirm');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!finding) return null;

  const doc = documents.find((d) => d.id === finding.document_id);
  const documentUrl = doc ? getDocumentFileUrl(doc) : null;
  const canReview = currentRole === 'scrutiny_officer' || currentRole === 'senior_reviewer';

  const handleSubmitReview = async () => {
    if (!reason.trim()) {
      setSubmitError('A written reason is required to record a review action.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onReview(finding.id, reviewAction, reason);
      setReason('');
      onClose();
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-slate-900/40 backdrop-blur-xs">
      <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-start justify-between bg-slate-50">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-slate-700 bg-slate-200 px-1.5 py-0.5 rounded">
                {finding.id}
              </span>
              <StatusChip type="compliance" value={finding.outcome} />
              <StatusChip type="processing" value={finding.processing_status} />
            </div>
            <h2 className="text-base font-bold text-slate-900 leading-snug m-0">
              {finding.title}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Rule: <span className="font-mono font-semibold text-blue-700">{finding.rule_code}</span> | Cat: {finding.category}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-4 flex-1 text-xs">
          {/* Finding Rationale */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-md p-3">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-700 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-bold text-blue-900 block text-[11px] uppercase tracking-wider">
                  Finding Summary
                </span>
                <p className="text-blue-950 mt-0.5 leading-relaxed">{finding.plain_reason}</p>
              </div>
            </div>
          </div>

          {/* Expected vs Observed Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-emerald-200 bg-emerald-50/40 rounded-md p-3">
              <span className="text-[10px] font-bold uppercase text-emerald-800 tracking-wider block mb-1">
                Expected
              </span>
              <p className="text-emerald-950 font-medium">
                {finding.expected_value || 'Compliant with prescribed regulatory norm'}
              </p>
            </div>

            <div className="border border-amber-200 bg-amber-50/40 rounded-md p-3">
              <span className="text-[10px] font-bold uppercase text-amber-800 tracking-wider block mb-1">
                Observed
              </span>
              <p className="text-amber-950 font-medium font-mono">
                {finding.observed_value || 'Non-compliant or conflicting declaration'}
              </p>
            </div>
          </div>

          {/* Document & Evidence Excerpt */}
          <div className="border border-slate-200 rounded-md overflow-hidden">
            <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                <FileText className="w-3.5 h-3.5 text-slate-600" />
                <span>Documentary Evidence</span>
              </div>
              {finding.source_page && (
                <span className="font-mono text-[10px] text-slate-600 bg-white border border-slate-200 px-1.5 py-0.2 rounded">
                  Page {finding.source_page}
                </span>
              )}
            </div>

            <div className="p-3 space-y-2.5">
              {doc && (
                <div className="flex items-center justify-between text-slate-600 pb-1.5 border-b border-slate-100">
                  <span className="truncate max-w-[280px]">
                    Document: <strong className="text-slate-900">{doc.document_name}</strong>
                  </span>
                  {documentUrl && (
                    <a
                      href={documentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 font-semibold text-[11px]"
                    >
                      <span>Open PDF</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}

              {/* Text Snippet / Evidence */}
              <div className="bg-slate-900 text-slate-100 font-mono text-[11px] p-2.5 rounded leading-relaxed whitespace-pre-wrap">
                {finding.evidence_text || 'No direct text excerpt recorded.'}
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                <span>Mode: {finding.is_fixture_derived ? 'Fixture Benchmark' : 'Extracted Text'}</span>
                <span className="text-slate-600 font-medium bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                  Verified Source Record
                </span>
              </div>
            </div>
          </div>

          {/* Current Review Status / History */}
          <div className="border border-slate-200 rounded-md p-3 bg-slate-50">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-slate-700 uppercase tracking-wide text-[10px]">
                Review Status
              </span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                  finding.review_status === 'confirmed'
                    ? 'bg-red-100 text-red-800'
                    : finding.review_status === 'dismissed'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {finding.review_status}
              </span>
            </div>
            {finding.reviewer_name && (
              <div className="text-[11px] text-slate-600 space-y-0.5">
                <p>Reviewed By: <strong>{finding.reviewer_name}</strong> ({finding.reviewer_role})</p>
                <p>Reason: <em>"{finding.reviewer_reason}"</em></p>
                {finding.reviewed_at && (
                  <p className="text-[10px] text-slate-400">Timestamp: {finding.reviewed_at}</p>
                )}
              </div>
            )}
          </div>

          {/* Review Action Form */}
          {canReview ? (
            <div className="border border-blue-200 bg-white rounded-md p-3 space-y-2.5">
              <span className="font-bold text-slate-900 uppercase tracking-wide text-[10px] block">
                Record Review Action
              </span>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setReviewAction('confirm')}
                  className={`flex-1 py-1.5 px-2 rounded text-xs font-semibold border transition-colors cursor-pointer ${
                    reviewAction === 'confirm'
                      ? 'bg-red-700 text-white border-red-700'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Confirm Deficiency
                </button>
                <button
                  type="button"
                  onClick={() => setReviewAction('dismiss')}
                  className={`flex-1 py-1.5 px-2 rounded text-xs font-semibold border transition-colors cursor-pointer ${
                    reviewAction === 'dismiss'
                      ? 'bg-emerald-700 text-white border-emerald-700'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Dismiss with Reason
                </button>
                <button
                  type="button"
                  onClick={() => setReviewAction('clarification_requested')}
                  className={`flex-1 py-1.5 px-2 rounded text-xs font-semibold border transition-colors cursor-pointer ${
                    reviewAction === 'clarification_requested'
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Need Clarification
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">
                  Written Justification <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Enter reason for confirmation or dismissal..."
                  rows={2}
                  className="w-full text-xs p-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              {submitError && <p className="text-[11px] text-red-600 font-medium">{submitError}</p>}

              <button
                type="button"
                onClick={handleSubmitReview}
                disabled={submitting}
                className="w-full py-2 bg-blue-700 text-white rounded text-xs font-bold hover:bg-blue-800 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {submitting ? 'Saving...' : 'Save Review Decision'}
              </button>
            </div>
          ) : (
            <div className="p-2.5 bg-slate-100 border border-slate-200 rounded text-[11px] text-slate-600 text-center">
              System Admin role has read-only access to case findings.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 border border-slate-300 bg-white text-slate-700 rounded text-xs font-medium hover:bg-slate-100 cursor-pointer"
          >
            Close Panel
          </button>
        </div>
      </div>
    </div>
  );
};
