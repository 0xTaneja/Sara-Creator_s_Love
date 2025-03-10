import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useLoading } from '../contexts/LoadingContext';
import LoadingSpinner from './LoadingSpinner';

const LoadingIndicator: React.FC = () => {
  const { isLoading, setIsLoading } = useLoading();
  const location = useLocation();
  const [showSpinner, setShowSpinner] = useState(false);

  // Set loading state when route changes
  useEffect(() => {
    setIsLoading(true);
    
    // Show spinner after a short delay to avoid flashing for quick loads
    const showTimer = setTimeout(() => {
      if (isLoading) {
        setShowSpinner(true);
      }
    }, 200);
    
    // Simulate a minimum loading time to ensure smooth transitions
    const hideTimer = setTimeout(() => {
      setIsLoading(false);
      setShowSpinner(false);
    }, 800);
    
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [location.pathname, setIsLoading]);

  // Hide spinner when loading is complete
  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => {
        setShowSpinner(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  if (!showSpinner) return null;

  return <LoadingSpinner fullScreen />;
};

export default LoadingIndicator; 