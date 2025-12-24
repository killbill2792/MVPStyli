import React, { createContext, useContext } from 'react';

// App Context for routing and app state
const AppContext = createContext();

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export const AppProvider = AppContext.Provider;




