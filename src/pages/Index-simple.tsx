import React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { user, loading, signOut } = useAuth();

  // Show loading screen while authentication is being checked
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Simple test render
  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Allotment Buddy</h1>
        <p className="text-muted-foreground mb-4">App is working!</p>
        {user ? (
          <div>
            <p className="text-green-600 mb-2">User authenticated: {user.email}</p>
            <button
              onClick={signOut}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <p className="text-red-600">No user authenticated</p>
        )}
      </div>
    </div>
  );
};

export default Index;