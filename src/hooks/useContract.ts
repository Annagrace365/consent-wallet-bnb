import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI, validateContractConfig } from '../utils/constants';
import { normalizeAddress } from '../utils/addressUtils';
import { ConsentToken, ConsentFormData } from '../types';

declare global {
  interface Window {
    activateConsentByTokenId?: (tokenId: number) => Promise<void>;
    abandonConsentByTokenId?: (tokenId: number) => Promise<void>;
  }
}

export const useContract = (provider: ethers.BrowserProvider | null, account: string | null, isCorrectNetwork: boolean) => {
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [consents, setConsents] = useState<ConsentToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [contractError, setContractError] = useState<string | null>(null);

  useEffect(() => {
    if (provider && account && isCorrectNetwork) {
      const initializeContract = async () => {
        try {
          // Validate contract configuration
          validateContractConfig();
          
          const signer = await provider.getSigner();
          const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
          
          // Test contract connection by calling a view function
          try {
            await contractInstance.getMyConsents(account);
            console.log('✅ Successfully connected to contract at:', CONTRACT_ADDRESS);
          } catch (testError) {
            console.warn('⚠️ Contract connection test failed:', testError);
            // Don't throw here as the contract might still work for other functions
          }
          
          setContract(contractInstance);
          setContractError(null);
        } catch (error) {
          console.error('Error initializing contract:', error);
          setContractError(error instanceof Error ? error.message : 'Failed to initialize contract');
          setContract(null);
        }
      };
      
      initializeContract();
    }
  }, [provider, account, isCorrectNetwork]);

  const mintConsent = async (data: ConsentFormData) => {
    if (!contract) throw new Error('Contract not initialized. Please check your contract configuration.');
    if (contractError) throw new Error(`Contract error: ${contractError}`);
    if (!isCorrectNetwork) throw new Error('Please switch to BNB Smart Chain Testnet to perform this action.');
    
    setLoading(true);
    try {
      const expiryTimestamp = Math.floor(new Date(data.expiryDate).getTime() / 1000);
      
      console.log('🚀 Minting consent with params:', {
        recipient: data.recipient,
        purpose: data.purpose,
        expiryTimestamp,
        website: data.website || '',
        dataFields: data.dataFields || ''
      });
      
      // Consent will be created with status 'Pending' (status=0) by the contract
      const tx = await contract.mintConsent(
        data.recipient, 
        data.purpose, 
        expiryTimestamp,
        data.website || '',
        data.dataFields || ''
      );
      console.log('📝 Transaction sent:', tx.hash);
      
      const receipt = await tx.wait();
      console.log('✅ Transaction confirmed');
      
      // Find the tokenId from the event logs (if available)
      let tokenId: number | null = null;
      if (receipt && receipt.logs) {
        for (const log of receipt.logs) {
          try {
            const event = contract.interface.parseLog(log);
            if (event.name === 'ConsentMinted') {
              tokenId = Number(event.args.tokenId);
              break;
            }
          } catch (e) {
            // Not this event, skip
          }
        }
      }
      
      // Store last issued consent in localStorage for extension activation
      if (tokenId) {
        localStorage.setItem('lastIssuedConsent', JSON.stringify({
          tokenId,
          status: 'Pending',
          site: window.location.hostname,
          timestamp: Date.now()
        }));
        
        // Notify extension about consent issuance
        if (window.chrome && window.chrome.runtime) {
          try {
            window.chrome.runtime.sendMessage({
              action: 'consentIssued',
              data: {
                tokenId,
                status: 'Pending',
                siteName: data.website || window.location.hostname,
                purpose: data.purpose,
                expiryDate: data.expiryDate,
                recipient: data.recipient,
                dataFields: data.dataFields
              }
            });
          } catch (e) {
            console.log('Extension not available:', e);
          }
        }
      }
      
      await fetchConsents(); // Refresh consents after minting
    } catch (error) {
      console.error('Error minting consent:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const revokeConsent = async (tokenId: number) => {
    if (!contract) throw new Error('Contract not initialized. Please check your contract configuration.');
    if (contractError) throw new Error(`Contract error: ${contractError}`);
    if (!isCorrectNetwork) throw new Error('Please switch to BNB Smart Chain Testnet to perform this action.');
    
    setLoading(true);
    try {
      console.log('🔄 Revoking consent token:', tokenId);
      
      const tx = await contract.revokeConsent(tokenId);
      console.log('📝 Transaction sent:', tx.hash);
      
      await tx.wait();
      console.log('✅ Transaction confirmed');
      
      await fetchConsents(); // Refresh consents after revoking
    } catch (error) {
      console.error('Error revoking consent:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const activateConsent = async (tokenId: number) => {
    if (!contract) throw new Error('Contract not initialized. Please check your contract configuration.');
    if (contractError) throw new Error(`Contract error: ${contractError}`);
    if (!isCorrectNetwork) throw new Error('Please switch to BNB Smart Chain Testnet to perform this action.');
    
    setLoading(true);
    try {
      console.log('🔄 Activating consent token:', tokenId);
      const tx = await contract.activateConsent(tokenId);
      console.log('📝 Transaction sent:', tx.hash);
      await tx.wait();
      console.log('✅ Transaction confirmed');
      await fetchConsents();
    } catch (error) {
      console.error('Error activating consent:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const abandonConsent = async (tokenId: number) => {
    if (!contract) throw new Error('Contract not initialized. Please check your contract configuration.');
    if (contractError) throw new Error(`Contract error: ${contractError}`);
    if (!isCorrectNetwork) throw new Error('Please switch to BNB Smart Chain Testnet to perform this action.');
    
    setLoading(true);
    try {
      console.log('🔄 Abandoning consent token:', tokenId);
      const tx = await contract.abandonConsent(tokenId);
      console.log('📝 Transaction sent:', tx.hash);
      await tx.wait();
      console.log('✅ Transaction confirmed');
      await fetchConsents();
    } catch (error) {
      console.error('Error abandoning consent:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const fetchConsents = useCallback(async () => {
    if (!contract || !account || !isCorrectNetwork) return;
    if (contractError) {
      console.error('Cannot fetch consents due to contract error:', contractError);
      return;
    }
    
    setLoading(true);
    try {
      console.log('📊 Fetching consents for account:', account);
      
      // First check if the contract exists and has the expected function
      const code = await contract.runner?.provider?.getCode(CONTRACT_ADDRESS);
      if (!code || code === '0x') {
        throw new Error('Contract not found at the specified address. Please verify the contract is deployed on BNB Smart Chain Testnet.');
      }
      
      const normalizedAccount = normalizeAddress(account);
      
      // Try to use the new function that returns tokenIds
      let tokenIds: number[] = [];
      let consentsData: any[] = [];
      
      try {
        const [ids, data] = await contract.getMyConsentsWithIds(normalizedAccount);
        tokenIds = ids.map((id: any) => Number(id));
        consentsData = data;
        console.log('📋 Raw contract response (with IDs):', { tokenIds, consentsData });
      } catch (error) {
        // Fallback to old method if new function doesn't exist
        console.log('Using fallback method for fetching consents');
        consentsData = await contract.getMyConsents(normalizedAccount);
        // Generate sequential IDs as fallback
        tokenIds = consentsData.map((_: any, index: number) => index + 1);
        console.log('📋 Raw contract response (fallback):', consentsData);
      }
      
      const formattedConsents: ConsentToken[] = consentsData.map((consent: any, index: number) => ({
        tokenId: tokenIds[index],
        recipient: consent.recipient,
        purpose: consent.purpose,
        expiryDate: Number(consent.expiryDate),
        isRevoked: consent.isRevoked,
        website: consent.website || '',
        dataFields: consent.dataFields || '',
        status: consent.status !== undefined ? 
          (Number(consent.status) === 0 ? 'Pending' : Number(consent.status) === 1 ? 'Active' : 'Abandoned') : 
          undefined,
        issuedAt: Number(consent.issuedAt)
      }));
      
      console.log('✨ Formatted consents:', formattedConsents);
      setConsents(formattedConsents);
    } catch (error: any) {
      console.error('Error fetching consents:', error);
      
      // Handle specific RPC node synchronization errors
      if (error.data?.message?.includes('missing trie node')) {
        setContractError('Blockchain node synchronization error: The RPC provider is unable to retrieve contract data. This might be a temporary network issue. Please try again later or consider switching your MetaMask RPC URL.');
        return;
      }
      
      // Handle coalesce errors (also RPC related)
      if (error.code === 'UNKNOWN_ERROR' && error.message?.includes('could not coalesce error')) {
        setContractError('Network connectivity issue: Unable to connect to the blockchain. Please check your internet connection and try again, or switch to a different RPC endpoint in MetaMask.');
        return;
      }
      
      // Provide specific error messages based on error type
      if (error.code === 'BAD_DATA' || error.message.includes('could not decode result data')) {
        setContractError('Contract ABI mismatch or contract not properly deployed. Please check CONTRACT_SETUP_INSTRUCTIONS.md for proper configuration.');
      } else if (error.message.includes('Contract not found')) {
        setContractError(error.message);
      } else if (error.code === 'CALL_EXCEPTION') {
        setContractError('Contract function call failed. The contract may not be deployed or the function signature may be incorrect.');
      } else {
        setContractError(error.message || 'Failed to fetch consents');
      }
    } finally {
      setLoading(false);
    }
  }, [contract, account, contractError, isCorrectNetwork]);

  useEffect(() => {
    if (contract && account && isCorrectNetwork) {
      fetchConsents();
    }
  }, [contract, account, isCorrectNetwork, fetchConsents]);

  useEffect(() => {
    // Expose a global function for extension to call
    window.activateConsentByTokenId = async (tokenId) => {
      try {
        await activateConsent(tokenId);
      } catch (e) {
        console.error('Failed to activate consent from extension:', e);
      }
    };
    window.abandonConsentByTokenId = async (tokenId) => {
      try {
        await abandonConsent(tokenId);
      } catch (e) {
        console.error('Failed to abandon consent from extension:', e);
      }
    };
  }, [activateConsent, abandonConsent]);

  return {
    mintConsent,
    revokeConsent,
    fetchConsents,
    activateConsent,
    abandonConsent,
    consents,
    loading,
    contractError
  };
};