import { useState, useEffect } from 'react';
import ChatPopup from './ChatPopup';

interface ChatButtonProps {
  baseUrl: string;
}

export default function ChatButton({ baseUrl }: ChatButtonProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isReady, setIsReady] = useState(false); // New: Controls visibility and animation
  const [userData, setUserData] = useState<{
    id: string;
    role: 'client' | 'admin' | 'owner';
    name: string;
    avatar?: string;
  } | null>(null);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('mco_auth_token');
    const userRole = localStorage.getItem('mco_user_role');
    const userDataStr = localStorage.getItem('mco_user_data');

    console.log('🔍 ChatButton - Auth Check:', {
      hasToken: !!token,
      userRole,
      hasUserData: !!userDataStr
    });

    if (token && userRole && userDataStr) {
      try {
        const parsedUserData = JSON.parse(userDataStr);
        setUserData({
          id: parsedUserData.id || parsedUserData.username || 'user',
          role: userRole as 'client' | 'admin' | 'owner',
          name: parsedUserData.name || parsedUserData.username || 'User',
          avatar: parsedUserData.avatar
        });
        setIsAuthenticated(true);
        
        // Wait 3 seconds before showing the chat button with animation
        setTimeout(() => {
          setIsReady(true);
          console.log('✅ ChatButton - Ready to show with animation');
        }, 3000);
        
        console.log('✅ ChatButton - User authenticated:', {
          id: parsedUserData.id,
          role: userRole,
          name: parsedUserData.name
        });
      } catch (error) {
        console.error('❌ ChatButton - Error parsing user data:', error);
        setIsAuthenticated(false);
      }
    } else {
      console.log('❌ ChatButton - Not authenticated. Missing:', {
        token: !token,
        userRole: !userRole,
        userData: !userDataStr
      });
      setIsAuthenticated(false);
    }

    // Listen for auth changes
    const handleStorageChange = () => {
      const token = localStorage.getItem('mco_auth_token');
      const newUserRole = localStorage.getItem('mco_user_role');
      const newUserDataStr = localStorage.getItem('mco_user_data');
      
      console.log('🔄 ChatButton - Storage changed');
      
      if (token && newUserRole && newUserDataStr) {
        try {
          const parsedUserData = JSON.parse(newUserDataStr);
          setUserData({
            id: parsedUserData.id || parsedUserData.username || 'user',
            role: newUserRole as 'client' | 'admin' | 'owner',
            name: parsedUserData.name || parsedUserData.username || 'User',
            avatar: parsedUserData.avatar
          });
          setIsAuthenticated(true);
          
          // Show immediately on auth change
          setTimeout(() => setIsReady(true), 500);
        } catch (error) {
          setIsAuthenticated(false);
          setIsReady(false);
        }
      } else {
        setIsAuthenticated(false);
        setIsReady(false);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  console.log('🎨 ChatButton - State:', {
    isAuthenticated,
    isReady,
    hasUserData: !!userData
  });

  // Don't render anything if not authenticated or not ready
  if (!isAuthenticated || !userData || !isReady) {
    return null;
  }

  console.log('✅ ChatButton - Showing chat popup with animation');

  return (
    <ChatPopup
      userId={userData.id}
      userRole={userData.role}
      userName={userData.name}
      userAvatar={userData.avatar}
      baseUrl={baseUrl}
      isReady={isReady}
    />
  );
}
