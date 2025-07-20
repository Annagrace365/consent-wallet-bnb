// Content script for detecting consent prompts and privacy policies
class ConsentDetector {
  constructor() {
    this.consentPatterns = [
      // Common consent button text patterns
      /accept.*terms/i,
      /agree.*terms/i,
      /i\s*accept/i,
      /accept.*cookies/i,
      /accept.*privacy/i,
      /continue.*agree/i,
      /by\s*continuing/i,
      /accept.*all/i,
      /allow.*cookies/i,
      /consent.*processing/i,
      /agree.*policy/i
    ];
    
    this.privacyLinkPatterns = [
      /privacy.*policy/i,
      /terms.*service/i,
      /terms.*conditions/i,
      /cookie.*policy/i,
      /data.*protection/i,
      /privacy.*notice/i
    ];
    
    this.init();
  }
  
  init() {
    // Start monitoring for consent prompts
    this.observeDOM();
    this.scanExistingElements();
    
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'scanForConsent') {
        this.scanForConsentPrompts();
      }
    });

    // --- Login detection logic (option B) ---
    this.monitorLoginRequests();
  }

  monitorLoginRequests() {
    // Patch fetch
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch.apply(this, args);
      this.checkIfLoginRequest(args[0], args[1]);
      return response;
    };

    // Patch XMLHttpRequest
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      this._consentWalletUrl = url;
      return origOpen.apply(this, [method, url, ...rest]);
    };
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(...args) {
      this.addEventListener('load', function() {
        if (this._consentWalletUrl) {
          window.ConsentDetector.checkIfLoginRequest(this._consentWalletUrl);
        }
      });
      return origSend.apply(this, args);
    };
  }

  checkIfLoginRequest(url, options) {
    // Heuristic: look for 'login' or 'signin' in the URL
    if (typeof url === 'string' && /(login|signin|auth|authenticate|session)/i.test(url)) {
      // Check for a pending consent for this site
      const pendingConsent = this.getPendingConsentForSite();
      if (pendingConsent) {
        console.log('🔑 Login detected, activating pending consent:', pendingConsent);
        // Send message to background to activate consent
        chrome.runtime.sendMessage({
          action: 'activateConsent',
          tokenId: pendingConsent.tokenId,
          site: window.location.hostname,
          url: window.location.href
        });
        // Clear the pending consent from localStorage
        localStorage.removeItem('lastIssuedConsent');
      }
    }
  }

  getPendingConsentForSite() {
    // Get last issued consent from localStorage
    try {
      const consentStr = localStorage.getItem('lastIssuedConsent');
      if (!consentStr) return null;
      const consent = JSON.parse(consentStr);
      // Check if consent is pending and for current site and within 10 minutes
      const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
      if (consent && 
          consent.status === 'Pending' && 
          consent.site === window.location.hostname &&
          consent.timestamp > tenMinutesAgo) {
        return consent;
      }
    } catch (e) {}
      console.error('Error getting pending consent:', e);
    return null;
  }
  
  observeDOM() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.scanElement(node);
            }
          });
        }
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  scanExistingElements() {
    // Scan existing elements on page load
    setTimeout(() => {
      this.scanForConsentPrompts();
    }, 2000);
  }
  
  scanElement(element) {
    // Check if element contains consent-related content
    const text = element.textContent || '';
    const hasConsentPattern = this.consentPatterns.some(pattern => pattern.test(text));
    
    if (hasConsentPattern) {
      this.handleConsentDetected(element);
    }
  }
  
  scanForConsentPrompts() {
    // Scan for buttons and links that match consent patterns
    const buttons = document.querySelectorAll('button, a, input[type="button"], input[type="submit"]');
    const modals = document.querySelectorAll('[class*="modal"], [class*="popup"], [class*="overlay"], [class*="consent"], [class*="cookie"]');
    
    buttons.forEach(button => {
      const text = button.textContent || button.value || '';
      const hasConsentPattern = this.consentPatterns.some(pattern => pattern.test(text));
      
      if (hasConsentPattern) {
        this.handleConsentDetected(button);
      }
    });
    
    // Check for modal/popup containers
    modals.forEach(modal => {
      if (modal.offsetParent !== null) { // Element is visible
        const text = modal.textContent || '';
        const hasConsentPattern = this.consentPatterns.some(pattern => pattern.test(text));
        
        if (hasConsentPattern) {
          this.handleConsentDetected(modal);
        }
      }
    });
  }
  
  handleConsentDetected(element) {
    console.log('🔍 Consent prompt detected:', element);
    
    // Extract consent information
    const consentData = this.extractConsentData(element);
    
    // Send to background script
    chrome.runtime.sendMessage({
      action: 'consentDetected',
      data: consentData,
      url: window.location.href,
      timestamp: Date.now()
    });
    
    // Show consent wallet modal
    this.showConsentModal(consentData);
  }
  
  extractConsentData(element) {
    const siteName = this.extractSiteName();
    const privacyPolicyUrl = this.findPrivacyPolicyUrl();
    const dataTypes = this.extractDataTypes();
    const purpose = this.extractPurpose(element);
    
    return {
      siteName,
      privacyPolicyUrl,
      dataTypes,
      purpose,
      recipientAddress: this.extractRecipientAddress(),
      detectedElement: element.outerHTML.substring(0, 500) // Truncate for storage
    };
  }
  
  extractSiteName() {
    // Try to get site name from various sources
    const titleElement = document.querySelector('title');
    const h1Element = document.querySelector('h1');
    const logoElement = document.querySelector('[class*="logo"], [alt*="logo"]');
    
    if (titleElement) {
      return titleElement.textContent.split(' - ')[0].split(' | ')[0];
    }
    
    if (h1Element) {
      return h1Element.textContent.trim();
    }
    
    return window.location.hostname.replace('www.', '');
  }
  
  findPrivacyPolicyUrl() {
    const links = document.querySelectorAll('a[href]');
    
    for (const link of links) {
      const text = link.textContent || '';
      const href = link.href || '';
      
      if (this.privacyLinkPatterns.some(pattern => pattern.test(text)) ||
          this.privacyLinkPatterns.some(pattern => pattern.test(href))) {
        return link.href;
      }
    }
    
    return null;
  }
  
  extractDataTypes() {
    // Common data types mentioned in privacy policies
    const commonDataTypes = [
      'email', 'name', 'location', 'cookies', 'ip address', 
      'device information', 'browsing history', 'preferences',
      'analytics', 'advertising', 'personal information'
    ];
    
    const pageText = document.body.textContent.toLowerCase();
    const foundTypes = commonDataTypes.filter(type => 
      pageText.includes(type.toLowerCase())
    );
    
    return foundTypes.length > 0 ? foundTypes : ['general usage data'];
  }
  
  extractPurpose(element) {
    // Try to extract purpose from surrounding text
    const container = element.closest('[class*="modal"], [class*="popup"], [class*="consent"]') || element.parentElement;
    const text = container ? container.textContent : element.textContent;
    
    // Look for purpose indicators
    if (text.includes('cookie')) return 'Cookie usage and website functionality';
    if (text.includes('analytics')) return 'Analytics and performance tracking';
    if (text.includes('advertising')) return 'Advertising and marketing purposes';
    if (text.includes('personalization')) return 'Content personalization';
    
    return `General usage consent for ${this.extractSiteName()}`;
  }
  
  extractRecipientAddress() {
    // Look for wallet addresses in the page (if any)
    const walletPattern = /0x[a-fA-F0-9]{40}/g;
    const pageText = document.body.textContent;
    const matches = pageText.match(walletPattern);
    
    if (matches && matches.length > 0) {
      return matches[0];
    }
    
    // Default recipient address (could be the website's official address)
    return '0x0000000000000000000000000000000000000000';
  }
  
  showConsentModal(consentData) {
    // Create and inject consent modal
    const modal = this.createConsentModal(consentData);
    document.body.appendChild(modal);
    
    // Add event listeners
    this.setupModalEventListeners(modal, consentData);
  }
  
  createConsentModal(consentData) {
    const modal = document.createElement('div');
    modal.id = 'consent-wallet-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Space Grotesk', sans-serif;
    `;
    
    modal.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
        border: 2px solid #ff6b00;
        border-radius: 16px;
        padding: 32px;
        max-width: 500px;
        width: 90%;
        box-shadow: 0 20px 40px rgba(255, 107, 0, 0.3);
        color: #fefefe;
      ">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="
            width: 64px;
            height: 64px;
            background: linear-gradient(135deg, #ff6b00, #ffb347);
            border-radius: 50%;
            margin: 0 auto 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
          ">🛡️</div>
          <h2 style="margin: 0; color: #ff6b00; font-size: 24px;">Consent Detected</h2>
          <p style="margin: 8px 0 0; color: #cccccc;">Web3 Privacy Manager</p>
        </div>
        
        <div style="margin-bottom: 24px;">
          <div style="background: rgba(255, 107, 0, 0.1); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
            <strong style="color: #ff6b00;">Website:</strong> ${consentData.siteName}<br>
            <strong style="color: #ff6b00;">Purpose:</strong> ${consentData.purpose}<br>
            <strong style="color: #ff6b00;">Data Types:</strong> ${consentData.dataTypes.join(', ')}
          </div>
          
          <p style="font-size: 14px; color: #cccccc; margin: 0;">
            This consent was detected from your interaction on this website. 
            Review and issue a blockchain-based consent token for transparency and control.
          </p>
        </div>
        
        <div style="display: flex; gap: 12px;">
          <button id="consent-wallet-approve" style="
            flex: 1;
            background: linear-gradient(135deg, #ff6b00, #ffb347);
            color: #000;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
          ">Review & Approve</button>
          
          <button id="consent-wallet-dismiss" style="
            flex: 1;
            background: rgba(255, 255, 255, 0.1);
            color: #fefefe;
            border: 1px solid rgba(255, 107, 0, 0.3);
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
          ">Dismiss</button>
        </div>
      </div>
    `;
    
    return modal;
  }
  
  setupModalEventListeners(modal, consentData) {
    const approveBtn = modal.querySelector('#consent-wallet-approve');
    const dismissBtn = modal.querySelector('#consent-wallet-dismiss');
    
    approveBtn.addEventListener('click', () => {
      this.openConsentWallet(consentData);
      modal.remove();
    });
    
    dismissBtn.addEventListener('click', () => {
      modal.remove();
    });
    
    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }
  
  openConsentWallet(consentData) {
    // Create URL parameters for autofill
    const params = new URLSearchParams({
      to: consentData.recipientAddress,
      website: window.location.href, // Use the actual page URL for autofill
      purpose: consentData.purpose,
      fields: consentData.dataTypes.join(','),
      privacyUrl: consentData.privacyPolicyUrl || window.location.href,
      sourceUrl: window.location.href,
      returnUrl: window.location.href // Add returnUrl for redirect
    });
    
    // Open Consent Wallet in the current tab (not a new tab)
    const consentWalletUrl = `http://localhost:5173/issue?${params.toString()}`;
    window.location.href = consentWalletUrl;
  }
}

// Initialize the consent detector
const detector = new ConsentDetector();

// Export for testing
window.ConsentDetector = detector;