import React from 'react';

const RoadmapPage: React.FC = () => {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-12">
      {/* Header section */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 bg-gradient-to-r from-coral-DEFAULT to-purple-600 bg-clip-text text-transparent">
          Sara AI Agent – Roadmap & Future Enhancements
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Our vision for building the most advanced AI-powered creator economy platform
        </p>
      </div>

      {/* Phase 1 section */}
      <div className="bg-white rounded-xl shadow-lg p-8 space-y-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-green-400 to-green-600"></div>
        <div className="flex items-center gap-3">
          <div className="bg-green-100 text-green-800 px-4 py-1 rounded-full text-sm font-medium">
            Phase 1
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800">
            MVP Completed <span className="text-green-500">(Sonic DeFAI Hackathon)</span>
          </h2>
        </div>
        
        <ul className="space-y-4 pl-6">
          <li className="flex items-start gap-3">
            <div className="mt-1 flex-shrink-0 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <span className="font-semibold">AI-Powered Creator Token Market</span> – Tokens minted based on engagement.
            </div>
          </li>
          <li className="flex items-start gap-3">
            <div className="mt-1 flex-shrink-0 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <span className="font-semibold">Buy/Sell Creator Tokens</span> – Fully functional DEX with trading.
            </div>
          </li>
          <li className="flex items-start gap-3">
            <div className="mt-1 flex-shrink-0 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <span className="font-semibold">AI Market Insights</span> – Dynamic insights based on trends.
            </div>
          </li>
          <li className="flex items-start gap-3">
            <div className="mt-1 flex-shrink-0 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <span className="font-semibold">Liquidity Management</span> – AI-driven liquidity for stable trading.
            </div>
          </li>
          <li className="flex items-start gap-3">
            <div className="mt-1 flex-shrink-0 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <span className="font-semibold">Trade History Tracking</span> – Users can track past trades.
            </div>
          </li>
          <li className="flex items-start gap-3">
            <div className="mt-1 flex-shrink-0 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <span className="font-semibold">Dynamic Trending Leaderboard</span> – Top creator tokens ranked.
            </div>
          </li>
          <li className="flex items-start gap-3">
            <div className="mt-1 flex-shrink-0 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <span className="font-semibold">Roadmap & Future Vision UI</span> – Communicates future plans.
            </div>
          </li>
        </ul>
      </div>

      {/* Phase 2 section */}
      <div className="bg-white rounded-xl shadow-lg p-8 space-y-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-blue-400 to-blue-600"></div>
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 text-blue-800 px-4 py-1 rounded-full text-sm font-medium">
            Phase 2
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800">
            Post-Hackathon Enhancements <span className="text-blue-500">(Coming Soon)</span>
          </h2>
        </div>
        
        <div className="space-y-10">
          {/* Feature 1 */}
          <div className="relative pl-10 border-l-2 border-dashed border-blue-300 pb-10 last:pb-0">
            <div className="absolute -left-3 top-0 bg-gradient-to-r from-blue-500 to-purple-500 w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs">
              1
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-gray-900">
                  Live TradingView Chart Integration
                </h3>
                <span className="text-sm text-white bg-coral-DEFAULT px-2 py-0.5 rounded-full">
                  Next Major Update
                </span>
              </div>
              <p className="text-gray-600">
                Fetch historical & real-time price data. Display charts with candlestick & market trends.
              </p>
              <div className="flex items-center gap-2 text-blue-600 text-sm font-medium">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>ETA: Next Major Update</span>
              </div>
            </div>
          </div>
          
          {/* Feature 2 */}
          <div className="relative pl-10 border-l-2 border-dashed border-blue-300 pb-10 last:pb-0">
            <div className="absolute -left-3 top-0 bg-gradient-to-r from-blue-500 to-purple-500 w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs">
              2
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-gray-900">
                  AI-Powered Auto-Trading Bot
                </h3>
                <span className="text-sm text-white bg-purple-500 px-2 py-0.5 rounded-full">
                  Coming Soon
                </span>
              </div>
              <p className="text-gray-600">
                AI analyzes engagement & executes trades autonomously. Users set risk preferences; AI handles buy/sell strategies.
              </p>
              <div className="flex items-center gap-2 text-blue-600 text-sm font-medium">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>ETA: Q2 2025</span>
              </div>
            </div>
          </div>
          
          {/* Feature 3 */}
          <div className="relative pl-10 border-l-2 border-dashed border-blue-300 pb-10 last:pb-0">
            <div className="absolute -left-3 top-0 bg-gradient-to-r from-blue-500 to-purple-500 w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs">
              3
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-gray-900">
                  Dynamic AI Sentiment Analysis for Token Prices
                </h3>
              </div>
              <p className="text-gray-600">
                Fetch real-time YouTube/Twitter/Reddit sentiment data. Predict token price movements based on community hype.
              </p>
              <div className="flex items-center gap-2 text-blue-600 text-sm font-medium">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>ETA: Mid-2025</span>
              </div>
            </div>
          </div>
          
          {/* Feature 4 */}
          <div className="relative pl-10 border-l-2 border-dashed border-blue-300 pb-10 last:pb-0">
            <div className="absolute -left-3 top-0 bg-gradient-to-r from-blue-500 to-purple-500 w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs">
              4
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-gray-900">
                  Multi-Chain Expansion
                </h3>
              </div>
              <p className="text-gray-600">
                Deploy Sara AI Agent on Mainnet. Support more creator economies across Web3 (Aptos, Mantle, More L2s).
              </p>
              <div className="flex items-center gap-2 text-blue-600 text-sm font-medium">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>ETA: Late 2025</span>
              </div>
            </div>
          </div>
          
          {/* Feature 5 */}
          <div className="relative pl-10 border-l-2 border-dashed border-blue-300 pb-10 last:pb-0">
            <div className="absolute -left-3 top-0 bg-gradient-to-r from-blue-500 to-purple-500 w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs">
              5
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-gray-900">
                  Gamified Social Trading
                </h3>
              </div>
              <p className="text-gray-600">
                Users can predict token movements & earn rewards. AI-driven market competitions to drive engagement.
              </p>
              <div className="flex items-center gap-2 text-blue-600 text-sm font-medium">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>ETA: 2026</span>
              </div>
            </div>
          </div>
          
          {/* Feature 6 */}
          <div className="relative pl-10 border-l-2 border-dashed border-blue-300 pb-10 last:pb-0">
            <div className="absolute -left-3 top-0 bg-gradient-to-r from-blue-500 to-purple-500 w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs">
              6
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-gray-900">
                  AI Chatbot for Personalized Trading Insights
                </h3>
              </div>
              <p className="text-gray-600">
                AI chatbot that provides real-time trading suggestions. Conversational AI guides users in token investments.
              </p>
              <div className="flex items-center gap-2 text-blue-600 text-sm font-medium">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>ETA: 2026</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Call to action section */}
      <div className="bg-orange-500 rounded-xl shadow-lg p-8 text-white text-center">
        <h2 className="text-2xl md:text-3xl font-bold mb-4">Join Us on This Journey</h2>
        <p className="text-lg mb-6 max-w-2xl mx-auto">
          Sara is constantly evolving to provide the best AI-powered creator economy platform. Stay tuned for these exciting updates!
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <a href="https://discord.gg/sara" className="bg-white text-orange-500 font-medium px-6 py-2 rounded-full hover:bg-gray-100 transition-colors">
            Join Discord
          </a>
          <a href="https://twitter.com/sara_ai" className="bg-transparent border border-white text-white font-medium px-6 py-2 rounded-full hover:bg-white hover:text-orange-500 transition-colors">
            Follow on Twitter
          </a>
        </div>
      </div>
    </div>
  );
};

export default RoadmapPage; 