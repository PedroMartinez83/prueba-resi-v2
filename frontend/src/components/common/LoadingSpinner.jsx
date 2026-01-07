// frontend/src/components/common/LoadingSpinner.jsx
import React from 'react';

const LoadingSpinner = ({ size = 'medium', message = 'Cargando...' }) => {
  const sizeClasses = {
    small: 'h-8 w-8',
    medium: 'h-12 w-12',
    large: 'h-16 w-16'
  };

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div className="relative">
        {/* Anillo exterior */}
        <div className={`${sizeClasses[size]} rounded-full border-4 border-white/20`}></div>
        
        {/* Anillo giratorio */}
        <div className={`absolute top-0 ${sizeClasses[size]} animate-spin rounded-full border-4 border-transparent border-t-primary border-r-primary`}></div>
      </div>
      
      {message && (
        <p className="mt-4 text-gray-300 text-sm animate-pulse">{message}</p>
      )}
    </div>
  );
};

export default LoadingSpinner;