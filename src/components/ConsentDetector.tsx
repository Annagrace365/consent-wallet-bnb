import React, { useEffect, useState } from 'react';
import { Shield, Globe, User, FileText, Calendar, CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react';

interface ConsentData {
  siteName: string;
  privacyPolicyUrl?: string;
  dataTypes: string[];
  purpose: string;
  recipientAddress: string;
  detectedElement?: string;
}

interface ConsentDetectorProps {
  onConsentDetected?: (data: ConsentData) => void;
}

export const ConsentDetector: React.FC<ConsentDetectorProps> = ({ onConsentDetected }) => {
  const [detectedConsent, setDetectedConsent] = useState<ConsentData | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Listen for consent detection from extension
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'ConsentDetected') {
        const consentData: ConsentData = {
          siteName: event.data.siteName || window.location.hostname,
          privacyPolicyUrl: event.data.privacyPolicyUrl,
          dataTypes: event.data.dataTypes || ['general usage data'],
          purpose: event.data.purpose || `General usage consent for ${window.location.hostname}`,
          recipientAddress: event.data.recipientAddress || '0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5e'
        };
        
        setDetectedConsent(consentData);
        setShowModal(true);
        
        if (onConsentDetected) {
          onConsentDetected(consentData);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onConsentDetected]);

  const handleApprove = () => {
    if (detectedConsent) {
      openConsentWallet(detectedConsent);
    }
    setShowModal(false);
  };

  const handleDismiss = () => {
    setShowModal(false);
    setDetectedConsent(null);
  };

  const openConsentWallet = (consentData: ConsentData) => {
    // Create URL parameters for autofill
    const params = new URLSearchParams({
      to: consentData.recipientAddress,
      website: window.location.href,
      purpose: consentData.purpose,
      fields: consentData.dataTypes.join(','),
      privacyUrl: consentData.privacyPolicyUrl || window.location.href,
      sourceUrl: window.location.href,
      returnUrl: window.location.href
    });
    
    // Navigate to autofill consent page
    const consentWalletUrl = `/issue?${params.toString()}`;
    window.location.href = consentWalletUrl;
  };

  if (!showModal || !detectedConsent) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="text-center mb-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Consent Detected</h2>
          <p className="text-gray-600 mt-2">Web3 Privacy Manager</p>
        </div>

        <div className="space-y-3 mb-6">
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="text-sm">
              <strong className="text-blue-900">Website:</strong> {detectedConsent.siteName}
            </div>
            <div className="text-sm mt-1">
              <strong className="text-blue-900">Purpose:</strong> {detectedConsent.purpose}
            </div>
            <div className="text-sm mt-1">
              <strong className="text-blue-900">Data Types:</strong> {detectedConsent.dataTypes.join(', ')}
            </div>
          </div>
          
          <p className="text-sm text-gray-600">
            This consent was detected from your interaction on this website. 
            Review and issue a blockchain-based consent token for transparency and control.
          </p>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={handleApprove}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Review & Approve
          </button>
          <button
            onClick={handleDismiss}
            className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};