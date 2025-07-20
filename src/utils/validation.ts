import { ConsentFormData } from '../types';

export const validateEthereumAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

export const validateConsentForm = (data: ConsentFormData): { isValid: boolean; errors: Partial<ConsentFormData> } => {
  const errors: Partial<ConsentFormData> = {};

  // Validate recipient address
  if (!data.recipient) {
    errors.recipient = 'Recipient address is required';
  } else if (!validateEthereumAddress(data.recipient)) {
    errors.recipient = 'Please enter a valid Ethereum address';
  }

  // Validate purpose
  if (!data.purpose) {
    errors.purpose = 'Purpose is required';
  } else if (data.purpose.length < 10) {
    errors.purpose = 'Purpose must be at least 10 characters';
  } else if (data.purpose.length > 500) {
    errors.purpose = 'Purpose must be less than 500 characters';
  }

  // Validate expiry date
  if (!data.expiryDate) {
    errors.expiryDate = 'Expiry date is required';
  } else {
    const expiryDate = new Date(data.expiryDate);
    const now = new Date();
    const minDate = new Date(now.getTime() + 10 * 60 * 1000); // At least 10 minutes from now
    const maxDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // Max 1 year from now

    if (expiryDate <= now) {
      errors.expiryDate = 'Expiry date must be in the future';
    } else if (expiryDate < minDate) {
      errors.expiryDate = 'Expiry date must be at least 10 minutes from now';
    } else if (expiryDate > maxDate) {
      errors.expiryDate = 'Expiry date cannot be more than 1 year from now';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export const formatTransactionError = (error: any): string => {
  if (error?.reason) {
    return error.reason;
  }
  
  if (error?.message) {
    if (error.message.includes('user rejected')) {
      return 'Transaction was rejected by user';
    }
    if (error.message.includes('insufficient funds')) {
      return 'Insufficient BNB for gas fees';
    }
    if (error.message.includes('execution reverted')) {
      return 'Transaction failed - contract execution reverted';
    }
    return error.message;
  }
  
  return 'An unknown error occurred';
};