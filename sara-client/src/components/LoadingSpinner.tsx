import React from 'react';

interface LoadingSpinnerProps {
  fullScreen?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ fullScreen = false }) => {
  const spinnerClasses = fullScreen 
    ? "fixed inset-0 flex items-center justify-center bg-white bg-opacity-80 z-50" 
    : "flex justify-center items-center py-8";

  return (
    <div className={spinnerClasses}>
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-coral-DEFAULT"></div>
    </div>
  );
};

export default LoadingSpinner; 