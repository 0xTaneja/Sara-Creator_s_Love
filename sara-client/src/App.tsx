import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import TokenDetailsPage from './pages/TokenDetailsPage';
import DashboardPage from './pages/DashboardPage';
import PortfolioPage from './pages/PortfolioPage';
import InsightsPage from './pages/InsightsPage';
import RoadmapPage from './pages/RoadmapPage';
import LandingPage from './pages/LandingPage';
import { Web3Provider } from './contexts/Web3Context';
import LoadingProvider from './contexts/LoadingContext';
import LoadingIndicator from './components/LoadingIndicator';
import { SwapEventProvider } from './contexts/SwapEventContext';

const App: React.FC = () => {
  return (
    <Web3Provider>
      <SwapEventProvider>
        <LoadingProvider>
          <LoadingIndicator />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/*" element={
              <Layout>
                <Routes>
                  <Route path="/home" element={<HomePage />} />
                  <Route path="/token/:tokenId" element={<TokenDetailsPage />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/portfolio" element={<PortfolioPage />} />
                  <Route path="/insights" element={<InsightsPage />} />
                  <Route path="/roadmap" element={<RoadmapPage />} />
                </Routes>
              </Layout>
            } />
          </Routes>
        </LoadingProvider>
      </SwapEventProvider>
    </Web3Provider>
  );
};

export default App; 