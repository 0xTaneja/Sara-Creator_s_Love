import React from 'react';
import { Link } from 'react-router-dom';
import { useWeb3 } from '../contexts/Web3Context';

const HeroSection: React.FC = () => {
  const { isConnected, connectWallet } = useWeb3();

  return (
    <div className="bg-gradient-coral text-white py-16 px-4 sm:px-6 lg:px-8 rounded-2xl mb-12">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              🤖
            </div>
            <h2 className="text-xl font-medium">Meet Sara</h2>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-6">
            Your AI Trading Companion for Creator Tokens
          </h1>
          <p className="text-xl mb-8 opacity-90">
            Hi, I'm Sara! I analyze creator engagement, market trends, and social sentiment to help you make smarter trades on creator tokens. Let's explore the future of social trading together.
          </p>
          
          <div className="flex flex-wrap gap-4">
            {isConnected ? (
              <Link to="/swap" className="btn bg-white text-coral-DEFAULT hover:bg-gray-100 font-medium px-6 py-3 rounded-lg">
                Start Trading
              </Link>
            ) : (
              <button 
                onClick={connectWallet}
                className="btn bg-white text-coral-DEFAULT hover:bg-gray-100 font-medium px-6 py-3 rounded-lg"
              >
                Connect Wallet
              </button>
            )}
            <Link to="/insights" className="btn border border-white text-white hover:bg-white/10 font-medium px-6 py-3 rounded-lg">
              View My Insights
            </Link>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-12">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <p className="text-2xl font-bold">99%</p>
              <p className="text-sm opacity-80">Prediction Accuracy</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <p className="text-2xl font-bold">24/7</p>
              <p className="text-sm opacity-80">Market Analysis</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <p className="text-2xl font-bold">100+</p>
              <p className="text-sm opacity-80">Creators Tracked</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <p className="text-2xl font-bold">$2.5M</p>
              <p className="text-sm opacity-80">Trading Volume</p>
            </div>
          </div>
        </div>
        
        <div className="relative hidden lg:block">
          <div className="absolute inset-0 bg-gradient-to-br from-coral-light to-coral-dark rounded-2xl opacity-20 blur-3xl"></div>
          <div className="relative bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-coral-DEFAULT flex items-center justify-center">
                🔮
              </div>
              <div>
                <h3 className="font-medium">Latest Insight</h3>
                <p className="text-sm opacity-80">2 minutes ago</p>
              </div>
            </div>
            <p className="text-lg mb-4">
              MrBeast's latest video is trending! His token $BEAST shows strong buy signals with a 85% confidence score.
            </p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">Confidence Score</p>
                <div className="w-32 h-2 bg-white/20 rounded-full mt-1">
                  <div className="w-[85%] h-2 bg-white rounded-full"></div>
                </div>
              </div>
              <Link to="/insights" className="text-sm hover:underline">
                View Analysis →
              </Link>
            </div>
          </div>
          
          <div className="absolute top-1/2 right-4 transform translate-x-1/2 -translate-y-1/2">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 w-48">
              <div className="flex items-center gap-2 mb-2">
                <img 
                  src="https://yt3.googleusercontent.com/ytc/APkrFKY455xp16s2AIHalRjK60zas-DitxAHmRjQsXPE2A=s176-c-k-c0x00ffffff-no-rj"
                  alt="MrBeast"
                  className="w-8 h-8 rounded-full"
                />
                <div>
                  <p className="font-medium">$BEAST</p>
                  <p className="text-sm opacity-80">+12.5%</p>
                </div>
              </div>
              <div className="w-full h-24">
                <div className="w-full h-full bg-white/5 rounded-lg"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroSection; 