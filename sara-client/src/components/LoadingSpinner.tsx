import React from 'react';

interface LoadingSpinnerProps {
  fullScreen?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ fullScreen = false }) => {
  const spinnerClasses = fullScreen 
    ? "fixed inset-0 flex items-center justify-center bg-white bg-opacity-90 z-50" 
    : "flex justify-center items-center py-8";

  return (
    <div className={spinnerClasses}>
      <div className="flex flex-col items-center">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200"></div>
          <div className="absolute top-0 left-0 animate-spin rounded-full h-16 w-16 border-t-4 border-coral-DEFAULT"></div>
        </div>
        {fullScreen && (
          <p className="mt-4 text-gray-700 font-medium">Loading...</p>
        )}
      </div>
    </div>
  );
};

export default LoadingSpinner; 