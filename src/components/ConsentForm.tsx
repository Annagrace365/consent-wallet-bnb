import React, { useState, useEffect } from 'react';
import { Send, User, FileText, Calendar, CheckCircle, AlertTriangle, Globe, Tag } from 'lucide-react';
import { ConsentFormData } from '../types';
import { useWallet } from '../contexts/WalletContext';
import { validateConsentForm, formatTransactionError } from '../utils/validation';
import { assessPrivacyRisk, DataCollectionRequest } from '../utils/privacyRiskAssessment';
import { PrivacyRiskIndicator } from './PrivacyRiskIndicator';

interface ConsentFormProps {
  onSubmit: (data: ConsentFormData) => Promise<void>;
  loading: boolean;
  contractError?: string | null;
  autofill?: Partial<ConsentFormData> & { returnUrl?: string };
}

export const ConsentForm: React.FC<ConsentFormProps> = ({ onSubmit, loading, contractError, autofill }) => {
  const { wallet } = useWallet();
  const [formData, setFormData] = useState<ConsentFormData>({
    recipient: autofill?.recipient || '',
    purpose: autofill?.purpose || '',
    expiryDate: autofill?.expiryDate || '',
    website: autofill?.website || '',
    dataFields: autofill?.dataFields || ''
  });

  useEffect(() => {
    setFormData({
      recipient: autofill?.recipient || '',
      purpose: autofill?.purpose || '',
      expiryDate: autofill?.expiryDate || '',
      website: autofill?.website || '',
      dataFields: autofill?.dataFields || ''
    });
  }, [autofill]);

  const [errors, setErrors] = useState<Partial<ConsentFormData>>({});
  const [success, setSuccess] = useState(false);
  const [showRiskAssessment, setShowRiskAssessment] = useState(false);

  // Generate privacy risk assessment when form data changes
  const getPrivacyRiskAssessment = () => {
    if (!formData.purpose || !formData.dataFields) return null;

    const request: DataCollectionRequest = {
      websiteName: formData.website || 'Unknown Website',
      dataRequested: formData.dataFields.split(',').map(field => field.trim()).filter(Boolean),
      purpose: formData.purpose,
      website: formData.website
    };

    return assessPrivacyRisk(request);
  };

  const riskAssessment = getPrivacyRiskAssessment();

  const validateForm = () => {
    const validation = validateConsentForm(formData);
    setErrors(validation.errors);
    return validation.isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!wallet.isConnected) {
      alert('Please connect your wallet first');
      return;
    }

    if (!wallet.isCorrectNetwork) {
      alert('Please switch to BNB Smart Chain Testnet');
      return;
    }

    if (!validateForm()) return;

    try {
      await onSubmit(formData);
      setFormData({ recipient: '', purpose: '', expiryDate: '', website: '', dataFields: '' });
      setErrors({});
      setSuccess(true);
      setShowRiskAssessment(false);
      setTimeout(() => {
        setSuccess(false);
        if (autofill?.returnUrl) {
          window.location.href = autofill.returnUrl;
        } else {
          // Navigate to my consents page after successful submission
          window.location.href = '/my-consents';
        }
      }, 2000);
    } catch (error) {
      console.error('Error submitting form:', error);
      const errorMessage = formatTransactionError(error);
      alert(`Transaction failed: ${errorMessage}`);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name as keyof ConsentFormData]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }

    // Show risk assessment when purpose and data fields are filled
    if ((name === 'purpose' || name === 'dataFields') && value.trim()) {
      setShowRiskAssessment(true);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {success && (
        <div className="mb-6 flex items-center space-x-3 p-4 bg-orange-500 bg-opacity-20 border border-orange-500 border-opacity-30 rounded-lg shadow-lg shadow-orange-500/20">
          <CheckCircle className="h-6 w-6 text-orange-400" />
          <div>
            <p className="text-orange-400 font-semibold">Consent Token Issued Successfully!</p>
            <p className="text-orange-300 text-sm">Your consent token has been minted on the blockchain.</p>
          </div>
        </div>
      )}

      {!wallet.isCorrectNetwork && wallet.isConnected && (
        <div className="mb-6 flex items-center space-x-3 p-4 bg-red-500 bg-opacity-20 border border-red-500 border-opacity-30 rounded-lg">
          <AlertTriangle className="h-6 w-6 text-red-400" />
          <div>
            <p className="text-red-400 font-semibold">Wrong Network</p>
            <p className="text-red-300 text-sm">Please switch to BNB Smart Chain Testnet to continue.</p>
          </div>
        </div>
      )}

      {contractError && (
        <div className="mb-6 flex items-center space-x-3 p-4 bg-red-500 bg-opacity-20 border border-red-500 border-opacity-30 rounded-lg">
          <AlertTriangle className="h-6 w-6 text-red-400" />
          <div>
            <p className="text-red-400 font-semibold">Contract Configuration Error</p>
            <p className="text-red-300 text-sm">{contractError}</p>
          </div>
        </div>
      )}

      {/* Privacy Risk Assessment */}
      {showRiskAssessment && riskAssessment && (
        <div className="mb-6">
          <PrivacyRiskIndicator assessment={riskAssessment} />
        </div>
      )}

      <div className="backdrop-blur-md bg-white bg-opacity-5 rounded-2xl p-8 border border-orange-500 border-opacity-20 shadow-2xl shadow-orange-500/10">
        <h2 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-orange-400 to-yellow-400 bg-clip-text text-transparent">
          Issue New Consent Token
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-orange-200 mb-2">
              <User className="h-4 w-4" />
              <span>Recipient Wallet Address</span>
            </label>
            <input
              type="text"
              name="recipient"
              value={formData.recipient}
              onChange={handleChange}
              placeholder="0x..."
              className="w-full px-4 py-3 bg-white bg-opacity-5 rounded-lg border border-orange-500 border-opacity-30 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all duration-200 shadow-inner"
            />
            {errors.recipient && (
              <p className="text-red-400 text-sm mt-1">{errors.recipient}</p>
            )}
          </div>

          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-orange-200 mb-2">
              <FileText className="h-4 w-4" />
              <span>Purpose of Consent</span>
            </label>
            <textarea
              name="purpose"
              value={formData.purpose}
              onChange={handleChange}
              placeholder="Describe the purpose of this consent..."
              rows={4}
              className="w-full px-4 py-3 bg-white bg-opacity-5 rounded-lg border border-orange-500 border-opacity-30 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all duration-200 resize-none shadow-inner"
            />
            {errors.purpose && (
              <p className="text-red-400 text-sm mt-1">{errors.purpose}</p>
            )}
          </div>

          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-orange-200 mb-2">
              <Globe className="h-4 w-4" />
              <span>Website (Optional)</span>
            </label>
            <input
              type="text"
              name="website"
              value={formData.website}
              onChange={handleChange}
              placeholder="example.com"
              className="w-full px-4 py-3 bg-white bg-opacity-5 rounded-lg border border-orange-500 border-opacity-30 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all duration-200 shadow-inner"
            />
          </div>

          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-orange-200 mb-2">
              <Tag className="h-4 w-4" />
              <span>Data Fields (Optional)</span>
            </label>
            <input
              type="text"
              name="dataFields"
              value={formData.dataFields}
              onChange={handleChange}
              placeholder="email, name, location (comma-separated)"
              className="w-full px-4 py-3 bg-white bg-opacity-5 rounded-lg border border-orange-500 border-opacity-30 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all duration-200 shadow-inner"
            />
            <p className="text-orange-300 text-xs mt-1">Separate multiple fields with commas</p>
          </div>

          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-orange-200 mb-2">
              <Calendar className="h-4 w-4" />
              <span>Expiry Date</span>
            </label>
            <input
              type="datetime-local"
              name="expiryDate"
              value={formData.expiryDate}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-white bg-opacity-5 rounded-lg border border-orange-500 border-opacity-30 text-white focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all duration-200 shadow-inner"
            />
            {errors.expiryDate && (
              <p className="text-red-400 text-sm mt-1">{errors.expiryDate}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !wallet.isConnected || !wallet.isCorrectNetwork || !!contractError}
            className={`w-full flex items-center justify-center space-x-2 px-6 py-4 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-lg font-semibold text-black transition-all duration-200 transform shadow-lg shadow-orange-500/30 ${
              loading || !wallet.isConnected || !wallet.isCorrectNetwork || !!contractError
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:from-orange-400 hover:to-yellow-400 hover:scale-105 hover:shadow-xl hover:shadow-orange-500/40'
            }`}
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
            ) : (
              <>
                <Send className="h-5 w-5" />
                <span>
                  {!wallet.isConnected 
                    ? 'Connect Wallet First' 
                    : contractError
                    ? 'Contract Error'
                    : !wallet.isCorrectNetwork 
                    ? 'Switch to BNB Testnet' 
                    : 'Issue Consent Token'
                  }
                </span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};