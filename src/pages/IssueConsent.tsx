import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { ConsentForm } from '../components/ConsentForm';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../hooks/useContract';

export const IssueConsent: React.FC = () => {
  const { wallet, provider } = useWallet();
  const { mintConsent, loading, contractError } = useContract(provider, wallet.account, wallet.isCorrectNetwork);
  const [searchParams] = useSearchParams();

  if (!wallet.isConnected) {
    return <Navigate to="/" replace />;
  }

  // Parse autofill values from URL params
  const recipient = searchParams.get('to') || '';
  const purpose = searchParams.get('purpose') || '';
  const website = searchParams.get('website') || '';
  const dataFields = searchParams.get('fields') || '';
  const expiryDate = searchParams.get('expiryDate') || '';
  const returnUrl = searchParams.get('returnUrl') || '';
  
  // Set default expiry date to 1 year from now if not provided
  const defaultExpiryDate = expiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-400 to-yellow-400 bg-clip-text text-transparent">
          Issue New Consent Token
        </h1>
        <p className="text-xl text-orange-100 max-w-2xl mx-auto">
          Create a new consent token on the blockchain with your specified terms and conditions
        </p>
      </div>

      <ConsentForm
        onSubmit={mintConsent}
        loading={loading}
        contractError={contractError}
        autofill={{ recipient, purpose, website, dataFields, expiryDate: defaultExpiryDate, returnUrl }}
      />

      <div className="backdrop-blur-md bg-white bg-opacity-5 rounded-2xl p-8 border border-orange-500 border-opacity-10 shadow-lg shadow-orange-500/10">
        <h3 className="text-2xl font-semibold mb-4 text-orange-400">Important Notes</h3>
        <ul className="space-y-3 text-orange-100">
          <li className="flex items-start space-x-2">
            <span className="text-orange-400 mt-1">•</span>
            <span>Consent tokens are immutable once created on the blockchain</span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="text-orange-400 mt-1">•</span>
            <span>You can revoke consent at any time before expiration</span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="text-orange-400 mt-1">•</span>
            <span>All transactions require a small BNB fee for gas</span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="text-orange-400 mt-1">•</span>
            <span>Recipient addresses must be valid Ethereum addresses</span>
          </li>
        </ul>
      </div>
    </div>
  );
};