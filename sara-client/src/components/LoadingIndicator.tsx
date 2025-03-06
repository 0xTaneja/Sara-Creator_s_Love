import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useLoading } from '../contexts/LoadingContext';
import LoadingSpinner from './LoadingSpinner';

const LoadingIndicator: React.FC = () => {
  const { isLoading, setIsLoading } = useLoading();
  const location = useLocation();

  // Set loading state when route changes
  useEffect(() => {
    setIsLoading(true);
    
    // Simulate a minimum loading time to ensure spinner is visible
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [location.pathname, setIsLoading]);

  if (!isLoading) return null;

  return <LoadingSpinner fullScreen />;
};

export default LoadingIndicator; 