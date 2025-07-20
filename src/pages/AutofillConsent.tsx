import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Shield, Globe, User, FileText, Calendar, CheckCircle, AlertTriangle, ExternalLink, Send } from 'lucide-react';
import { normalizeAddress } from '../utils/addressUtils';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../hooks/useContract';
import { assessPrivacyRisk, DataCollectionRequest } from '../utils/privacyRiskAssessment';
import { PrivacyRiskIndicator } from '../components/PrivacyRiskIndicator';
import { ConsentFormData } from '../types';

export default function ShareData() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { wallet, provider } = useWallet();
  const { mintConsent, loading, contractError } = useContract(provider, wallet.account, wallet.isCorrectNetwork);
  
  const [formData, setFormData] = useState({
    recipient: '',
    purpose: '',
    fields: [] as string[],
    expiryDate: '',
    privacyUrl: '',
    sourceUrl: '',
    siteName: '',
    returnUrl: '',
    websiteUrl: ''
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Generate privacy risk assessment
  const getPrivacyRiskAssessment = () => {
    if (!formData.purpose || formData.fields.length === 0) return null;

    const request: DataCollectionRequest = {
      websiteName: formData.siteName || 'Unknown Website',
      dataRequested: formData.fields,
      purpose: formData.purpose,
      website: formData.sourceUrl
    };

    return assessPrivacyRisk(request);
  };

  const riskAssessment = getPrivacyRiskAssessment();

  useEffect(() => {
    // Parse URL parameters
    const to = searchParams.get('to');
    const site = searchParams.get('site');
    const serviceName = searchParams.get('serviceName');
    const siteName = searchParams.get('siteName');
    const purpose = searchParams.get('purpose');
    const fields = searchParams.get('fields');
    const privacyUrl = searchParams.get('privacyUrl');
    const sourceUrl = searchParams.get('sourceUrl');
    const websiteUrl = searchParams.get('websiteUrl');
    const returnUrl = searchParams.get('returnUrl');
    const expiryDate = searchParams.get('expiryDate');

    const parsedFields = fields
      ? fields.split(',').map(field => field.trim()).filter(Boolean)
      : [];

    setFormData(prev => ({
      ...prev,
      recipient: to ? normalizeAddress(to) : '',
      purpose: purpose || '',
      fields: parsedFields,
      privacyUrl: privacyUrl || '',
      sourceUrl: sourceUrl || '',
      siteName: siteName || site || serviceName || '',
      expiryDate: expiryDate || '',
      returnUrl: returnUrl || '',
      websiteUrl: websiteUrl || sourceUrl || ''
    }));
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!wallet.isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    if (!wallet.isCorrectNetwork) {
      setError('Please switch to BNB Smart Chain Testnet');
      return;
    }

    if (!formData.recipient || !formData.purpose || formData.fields.length === 0) {
      setError('Please fill in all required fields');
      return;
    }

    if (!formData.expiryDate) {
      setError('Please select an expiry date');
      return;
    }

    setError('');

    try {
      const consentFormData: ConsentFormData = {
        recipient: formData.recipient,
        purpose: formData.purpose,
        expiryDate: formData.expiryDate,
        website: formData.websiteUrl || formData.sourceUrl || formData.siteName,
        dataFields: formData.fields.join(', ')
      };

      await mintConsent(consentFormData);
      setSuccess(true);
      
      // Redirect after success
      setTimeout(() => {
        if (formData.returnUrl) {
          console.log('Redirecting back to:', formData.returnUrl);
          window.location.href = formData.returnUrl;
        } else {
          navigate('/my-consents');
        }
      }, 1500); // Reduced delay for better UX
      
    } catch (err) {
      setError('Failed to issue consent token. Please try again.');
      console.error('Consent issuance error:', err);
    }
  };

  const availableFields = [
    { id: 'name', label: 'Full Name', icon: User },
    { id: 'email', label: 'Email Address', icon: FileText },
    { id: 'phone', label: 'Phone Number', icon: FileText },
    { id: 'address', label: 'Physical Address', icon: Globe },
    { id: 'birthdate', label: 'Date of Birth', icon: Calendar },
    { id: 'occupation', label: 'Occupation', icon: FileText },
    { id: 'location', label: 'Location', icon: Globe },
    { id: 'cookies', label: 'Cookies', icon: FileText },
    { id: 'ip address', label: 'IP Address', icon: Globe },
    { id: 'analytics', label: 'Analytics Data', icon: FileText },
    { id: 'advertising', label: 'Advertising Data', icon: FileText },
    { id: 'personal information', label: 'Personal Information', icon: FileText },
  ];

  const toggleField = (fieldId: string) => {
    setFormData(prev => ({
      ...prev,
      fields: prev.fields.includes(fieldId)
        ? prev.fields.filter(id => id !== fieldId)
        : [...prev.fields, fieldId]
    }));
  };

  const isFormValid = formData.recipient && formData.purpose && formData.fields.length > 0;

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

      <div className="backdrop-blur-md bg-white bg-opacity-5 rounded-2xl border border-orange-500 border-opacity-20 shadow-2xl shadow-orange-500/10">
        <div className="px-6 py-4 border-b border-orange-500 border-opacity-20">
            <div className="flex items-center space-x-3">
              <Shield className="h-6 w-6 text-orange-400" />
              <h1 className="text-xl font-semibold text-orange-200">Issue Consent Token</h1>
            </div>
            <p className="mt-2 text-sm text-orange-300">
              Create a blockchain-based consent token for this data sharing request
            </p>
          </div>

          {/* Privacy Risk Assessment */}
          {riskAssessment && (
            <div className="p-6 border-b border-orange-500 border-opacity-20">
              <PrivacyRiskIndicator assessment={riskAssessment} />
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {error && (
              <div className="flex items-center space-x-2 p-3 bg-red-500 bg-opacity-20 border border-red-500 border-opacity-30 rounded-md">
                <AlertTriangle className="h-5 w-5 text-red-400" />
                <span className="text-sm text-red-300">{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="recipient" className="block text-sm font-medium text-orange-200 mb-2">
                Recipient Address *
              </label>
              <input
                type="text"
                id="recipient"
                value={formData.recipient}
                onChange={(e) => setFormData(prev => ({ ...prev, recipient: e.target.value }))}
                className="w-full px-4 py-3 bg-white bg-opacity-5 rounded-lg border border-orange-500 border-opacity-30 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all duration-200 shadow-inner"
                placeholder="0x..."
                required
              />
            </div>

            <div>
              <label htmlFor="purpose" className="block text-sm font-medium text-orange-200 mb-2">
                Purpose of Data Sharing *
              </label>
              <textarea
                id="purpose"
                value={formData.purpose}
                onChange={(e) => setFormData(prev => ({ ...prev, purpose: e.target.value }))}
                rows={3}
                className="w-full px-4 py-3 bg-white bg-opacity-5 rounded-lg border border-orange-500 border-opacity-30 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all duration-200 resize-none shadow-inner"
                placeholder="Describe why you're sharing this data..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-orange-200 mb-3">
                Data Fields to Share *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {availableFields.map((field) => {
                  const Icon = field.icon;
                  const isSelected = formData.fields.includes(field.id);
                  
                  return (
                    <button
                      key={field.id}
                      type="button"
                      onClick={() => toggleField(field.id)}
                      className={`flex items-center space-x-3 p-3 border rounded-md transition-colors ${
                        isSelected
                          ? 'border-orange-500 bg-orange-500 bg-opacity-20 text-orange-300'
                          : 'border-orange-500 border-opacity-30 hover:border-orange-400 text-orange-200'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-sm font-medium">{field.label}</span>
                      {isSelected && <CheckCircle className="h-4 w-4 ml-auto" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label htmlFor="expiryDate" className="block text-sm font-medium text-orange-200 mb-2">
                Access Expiry Date *
              </label>
              <input
                type="datetime-local"
                id="expiryDate"
                value={formData.expiryDate}
                onChange={(e) => setFormData(prev => ({ ...prev, expiryDate: e.target.value }))}
                className="w-full px-4 py-3 bg-white bg-opacity-5 rounded-lg border border-orange-500 border-opacity-30 text-white focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all duration-200 shadow-inner"
                min={new Date().toISOString().split('T')[0]}
                required
              />
            </div>

            {formData.privacyUrl && (
              <div className="p-4 bg-orange-500 bg-opacity-10 border border-orange-500 border-opacity-30 rounded-md">
                <div className="flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-orange-400" />
                  <span className="text-sm font-medium text-orange-200">Privacy Policy</span>
                </div>
                <a
                  href={formData.privacyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center space-x-1 text-sm text-orange-300 hover:text-orange-200"
                >
                  <span>Review privacy policy</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            )}

            {formData.siteName && (
              <div className="p-4 bg-orange-500 bg-opacity-10 border border-orange-500 border-opacity-30 rounded-md">
                <div className="flex items-center space-x-2">
                  <Shield className="h-5 w-5 text-orange-400" />
                  <span className="text-sm font-medium text-orange-200">Consent Detection</span>
                </div>
                <p className="mt-2 text-sm text-orange-300">
                  This consent was detected from your interaction on <strong>{formData.siteName}</strong>. 
                  After issuing the consent token, you'll be redirected back to continue browsing.
                </p>
              </div>
            )}

            {formData.websiteUrl && (
              <div className="p-4 bg-white bg-opacity-5 border border-orange-500 border-opacity-20 rounded-md">
                <div className="flex items-center space-x-2">
                  <Globe className="h-5 w-5 text-orange-400" />
                  <span className="text-sm font-medium text-orange-200">Detected From</span>
                </div>
                <a
                  href={formData.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center space-x-1 text-sm text-orange-300 hover:text-orange-200"
                >
                  <span>{formData.websiteUrl}</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            )}

            <div className="flex space-x-4 pt-4">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="flex-1 px-4 py-3 border border-orange-500 border-opacity-30 rounded-lg text-orange-200 hover:bg-white hover:bg-opacity-5 focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all duration-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !isFormValid || !wallet.isConnected || !wallet.isCorrectNetwork}
                className={`flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-lg font-semibold text-black transition-all duration-200 transform shadow-lg shadow-orange-500/30 ${
                  loading || !isFormValid || !wallet.isConnected || !wallet.isCorrectNetwork
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:from-orange-400 hover:to-yellow-400 hover:scale-105 hover:shadow-xl hover:shadow-orange-500/40'
                }`}
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    <span>Issue Consent Token</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
    </div>
  );
}