import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import TokenDetailsPage from './pages/TokenDetailsPage';
import SwapPage from './pages/SwapPage';
import DashboardPage from './pages/DashboardPage';
import PortfolioPage from './pages/PortfolioPage';
import InsightsPage from './pages/InsightsPage';
import LandingPage from './pages/LandingPage';
import { Web3Provider } from './contexts/Web3Context';
import LoadingProvider from './contexts/LoadingContext';
import LoadingIndicator from './components/LoadingIndicator';

const App: React.FC = () => {
  return (
    <Web3Provider>
      <LoadingProvider>
        <LoadingIndicator />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/*" element={
            <Layout>
              <Routes>
                <Route path="/home" element={<HomePage />} />
                <Route path="/token/:tokenId" element={<TokenDetailsPage />} />
                <Route path="/swap" element={<SwapPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/portfolio" element={<PortfolioPage />} />
                <Route path="/insights" element={<InsightsPage />} />
              </Routes>
            </Layout>
          } />
        </Routes>
      </LoadingProvider>
    </Web3Provider>
  );
};

export default App; 