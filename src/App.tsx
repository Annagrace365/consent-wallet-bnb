import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { WalletProvider } from './contexts/WalletContext';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { IssueConsent } from './pages/IssueConsent';
import { MyConsents } from './pages/MyConsents';
import AutofillConsent from './pages/AutofillConsent';
import { ConsentDetector } from './components/ConsentDetector';

function App() {
  return (
    <WalletProvider>
      <Router>
        <Layout>
          <ConsentDetector />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/issue" element={<IssueConsent />} />
            <Route path="/my-consents" element={<MyConsents />} />
            <Route path="/autofill-consent" element={<AutofillConsent />} />
          </Routes>
        </Layout>
      </Router>
    </WalletProvider>
  );
}

export default App;