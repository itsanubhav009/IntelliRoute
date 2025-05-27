import { useEffect } from 'react';

// Hook for enhanced console logging
const useConsoleLogger = (name, data, dependencies) => {
  useEffect(() => {
    // Create a collapsible group in console
    console.group(`${name} - ${new Date().toLocaleTimeString()}`);
    
    // Log the data
    if (typeof data === 'function') {
      console.log(data());
    } else {
      console.log(data);
    }
    
    console.groupEnd();
  }, dependencies);
};

export default useConsoleLogger;