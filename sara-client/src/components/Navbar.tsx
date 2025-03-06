import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useWeb3 } from "../contexts/Web3Context";

const Navbar: React.FC = () => {
  const { account, connectWallet, disconnectWallet } = useWeb3();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-sm mr-2 overflow-hidden">
                <img src="/Sara.jpg" alt="Sara AI" className="w-10 h-10 object-cover rounded-full" />
              </div>
              <span className="text-2xl font-bold text-coral-DEFAULT">Sara</span>
            </Link>
          </div>

          {/* Middle Section - Navigation Links */}
          <div className="hidden md:flex items-center space-x-6">
            <Link 
              to="/dashboard" 
              className={`px-3 py-2 text-sm font-medium ${isActive('/dashboard') ? 'text-coral-DEFAULT border-b-2 border-coral-DEFAULT' : 'text-gray-700 hover:text-coral-DEFAULT'}`}
            >
              Dashboard
            </Link>
            <Link 
              to="/home" 
              className={`px-3 py-2 text-sm font-medium ${isActive('/home') ? 'text-coral-DEFAULT border-b-2 border-coral-DEFAULT' : 'text-gray-700 hover:text-coral-DEFAULT'}`}
            >
              Home
            </Link>
            <Link 
              to="/swap" 
              className={`px-3 py-2 text-sm font-medium ${isActive('/swap') ? 'text-coral-DEFAULT border-b-2 border-coral-DEFAULT' : 'text-gray-700 hover:text-coral-DEFAULT'}`}
            >
              Swap
            </Link>
            <Link 
              to="/insights" 
              className={`px-3 py-2 text-sm font-medium ${isActive('/insights') ? 'text-coral-DEFAULT border-b-2 border-coral-DEFAULT' : 'text-gray-700 hover:text-coral-DEFAULT'}`}
            >
              Insights
            </Link>
          </div>

          {/* Right Section - Wallet Connection */}
          <div className="flex items-center">
            {account ? (
              <div className="flex items-center">
                <span className="bg-gray-100 text-gray-800 text-xs font-medium px-3 py-1 rounded-full mr-2">
                  {formatAddress(account)}
                </span>
                <button
                  onClick={disconnectWallet}
                  className="bg-coral-light text-white px-3 py-1 rounded-md text-sm font-medium hover:bg-coral-DEFAULT"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                className="bg-coral-DEFAULT text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-coral-dark"
              >
                Connect Wallet
              </button>
            )}

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center ml-4">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-gray-500 hover:text-coral-DEFAULT focus:outline-none"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200 py-2">
          <div className="container mx-auto px-4 space-y-1">
            <Link
              to="/dashboard"
              className={`block px-3 py-2 rounded-md text-base font-medium ${
                isActive('/dashboard') ? 'text-coral-DEFAULT bg-coral-50' : 'text-gray-700 hover:bg-gray-50 hover:text-coral-DEFAULT'
              }`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Dashboard
            </Link>
            <Link
              to="/home"
              className={`block px-3 py-2 rounded-md text-base font-medium ${
                isActive('/home') ? 'text-coral-DEFAULT bg-coral-50' : 'text-gray-700 hover:bg-gray-50 hover:text-coral-DEFAULT'
              }`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              to="/swap"
              className={`block px-3 py-2 rounded-md text-base font-medium ${
                isActive('/swap') ? 'text-coral-DEFAULT bg-coral-50' : 'text-gray-700 hover:bg-gray-50 hover:text-coral-DEFAULT'
              }`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Swap
            </Link>
            <Link
              to="/insights"
              className={`block px-3 py-2 rounded-md text-base font-medium ${
                isActive('/insights') ? 'text-coral-DEFAULT bg-coral-50' : 'text-gray-700 hover:bg-gray-50 hover:text-coral-DEFAULT'
              }`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Insights
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
