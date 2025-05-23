import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FiAlertCircle, FiFlag, FiX, FiSend, FiInfo, FiCheckCircle, FiAlertTriangle } from 'react-icons/fi';
import logger from '../../utils/logger';

interface ReportFormProps {
  onClose: () => void;
  contentId?: string;
  contentType?: 'fact_check' | 'claim' | 'source' | 'website';
  contentPreview?: string;
  fullData?: {
    claim?: string;
    verdict?: string;
    explanation?: string;
    sources?: string;
    timestamp?: string;
  };
}

type ReportType = 'misinformation' | 'bias' | 'offensive' | 'technical' | 'other';

const reportTypeOptions: { value: ReportType; label: string; icon: React.ReactNode }[] = [
  { value: 'misinformation', label: 'Contains misinformation', icon: <FiFlag className="text-red-500" /> },
  { value: 'bias', label: 'Shows political bias', icon: <FiInfo className="text-amber-500" /> },
  { value: 'offensive', label: 'Contains offensive content', icon: <FiAlertCircle className="text-orange-500" /> },
  { value: 'technical', label: 'Technical issue', icon: <FiAlertCircle className="text-blue-500" /> },
  { value: 'other', label: 'Other issue', icon: <FiFlag className="text-gray-500" /> }
];

interface SubmissionResult {
  success: boolean;
  message: string;
  partial?: boolean;
  reportId?: string;
  emailSent?: boolean;
}

const ReportForm: React.FC<ReportFormProps> = ({ 
  onClose, 
  contentId = 'unknown',
  contentType = 'fact_check',
  contentPreview = '',
  fullData = {}
}) => {
  const [reportType, setReportType] = useState<ReportType | ''>('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reportType) {
      setError('Please select a report type');
      return;
    }
    
    try {
      setIsSubmitting(true);
      setError('');
      setSubmissionResult(null);
      
      // Log the report with our enhanced logging system
      const reportData = {
        reportType,
        description,
        contentId,
        contentType,
        contentPreview: contentPreview.substring(0, 200),
        userEmail: email || 'anonymous',
        timestamp: new Date().toISOString(),
        // Include full data if available
        claimData: fullData.claim || '',
        verdict: fullData.verdict || '',
        explanation: fullData.explanation || '',
        sources: fullData.sources || ''
      };
      
      // Add detailed debugging
      console.log("[ReportForm Debug] API request path: /api/send-report");
      console.log("[ReportForm Debug] Report data being sent:", reportData);
      
      // Use our logger for the reporting
      logger.info('User submitted content report', reportData);
      
      // Track this as a special report event
      const timing = logger.timing('report_submission');
      
      // UPDATED: Using fetch directly (like our test-email.html) instead of axios
      console.log("[ReportForm Debug] Sending API request using fetch");
      
      try {
        // Use the same approach that worked in our test-email.html
        const response = await fetch('/api/send-report', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ reportData }) // Match exact structure from test
        });
        
        // Parse response
        const responseData = await response.json();
        
        console.log("[ReportForm Debug] API response received:", {
          status: response.status,
          statusText: response.statusText,
          data: responseData
        });
        
        // End timing measurement
        timing.end({ reportType, contentType });
        
        // Process response
        if (responseData.success && responseData.fallbackSaved && !responseData.emailSent) {
          console.log("[ReportForm Debug] Partial success scenario - report saved but email not sent");
          setSubmissionResult({
            success: true,
            partial: true,
            message: 'Your report was saved, but the notification email could not be sent. Our team will still review your feedback.',
            reportId: responseData.reportId,
            emailSent: false
          });
        } else if (responseData.success) {
          // Full success
          console.log("[ReportForm Debug] Full success scenario");
          setSubmissionResult({
            success: true,
            partial: false,
            message: 'Thank you for your feedback! Your report has been submitted successfully.',
            reportId: responseData.reportId,
            emailSent: responseData.emailSent
          });
        } else {
          // Something went wrong on the server side
          console.error("[ReportForm Debug] Server reported error in response:", responseData);
          throw new Error(responseData.message || 'Failed to submit report');
        }
      } catch (fetchError) {
        console.error("[ReportForm Debug] Fetch request failed:", fetchError);
        throw fetchError;
      }
      
      // Report as an error for better tracking (but with type: 'user_report')
      await logger.reportError(
        new Error(`User reported ${contentType}: ${reportType}`),
        'ReportForm',
        { 
          ...reportData,
          type: 'user_report',
          reportId: submissionResult?.reportId
        }
      );
      
      // Show success state
      setIsSuccess(true);
      
      // Close after delay
      setTimeout(() => {
        onClose();
      }, 3000);
      
    } catch (err) {
      // Error handling for fetch errors
      let errorMessage = 'Failed to submit report. Please try again later.';
      
      console.error("[ReportForm Debug] Error details:", err);
      
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      logger.error('Report submission failed', { 
        error: err instanceof Error ? err.message : String(err)
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div 
        className="bg-white rounded-xl shadow-lg max-w-md w-full overflow-hidden"
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
        onClick={(e) => e.stopPropagation()}
      >
        {isSuccess ? (
          <div className="p-6 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              {submissionResult?.partial ? (
                <div className="bg-yellow-100 rounded-full p-4">
                  <FiAlertTriangle className="w-8 h-8 text-yellow-500" />
                </div>
              ) : (
                <div className="bg-green-100 rounded-full p-4">
                  <FiCheckCircle className="w-8 h-8 text-green-500" />
                </div>
              )}
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {submissionResult?.partial ? 'Report Partially Submitted' : 'Report Submitted'}
            </h3>
            <p className="text-gray-600 mb-2">
              {submissionResult?.message || 'Thank you for your feedback. We will review this content as soon as possible.'}
            </p>
            {submissionResult?.reportId && (
              <p className="text-xs text-gray-500 mt-2">
                Report ID: {submissionResult.reportId}
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center p-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <FiFlag className="mr-2 text-primary-500" />
                Report Content
              </h3>
              <button 
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 transition-colors"
                aria-label="Close"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What's the issue with this content?
                </label>
                <div className="space-y-2">
                  {reportTypeOptions.map((option) => (
                    <div 
                      key={option.value}
                      className={`p-3 border rounded-lg flex items-center cursor-pointer transition-all ${
                        reportType === option.value 
                          ? 'border-primary-500 bg-primary-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setReportType(option.value)}
                    >
                      <div className="mr-3">
                        {option.icon}
                      </div>
                      <span className="text-sm font-medium text-gray-800">{option.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="mb-4">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Additional details (optional)
                </label>
                <textarea
                  id="description"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Please provide any additional information that could help us understand the issue."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              
              <div className="mb-4">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Your email (optional)
                </label>
                <input
                  id="email"
                  type="email"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="We'll contact you if we need more information"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-800 rounded-lg text-sm">
                  {error}
                </div>
              )}
              
              <div className="flex justify-end">
                <button
                  type="button"
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg mr-2 hover:bg-gray-50"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center ${
                    isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <FiSend className="mr-2" />
                      Submit Report
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </motion.div>
    </motion.div>
  );
};

export default ReportForm; 