import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isDemo } from './supabase';

type User = {
  id: string;
  email?: string | null;
} | null;

type UserContextType = {
  user: User;
  setUser: (user: User) => void;
  signOut: () => void;
  isLoading: boolean;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeUser = async () => {
      try {
        if (isDemo) {
          // Demo mode - set user immediately
          console.log('Demo mode: Setting user immediately');
          setUser({ id: 'demo-user', email: null });
        } else {
          // Production mode - check for existing session
          const { data } = await supabase.auth.getUser();
          setUser(data.user);
        }
      } catch (error) {
        console.error('User initialization error:', error);
        // In case of error, set to null (will show sign-in)
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeUser();
  }, []);

  const signOut = async () => {
    try {
      if (isDemo) {
        setUser(null);
      } else {
        await supabase.auth.signOut();
        setUser(null);
      }
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <UserContext.Provider value={{ user, setUser, signOut, isLoading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
