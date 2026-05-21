import { ReactNode, useEffect, useState } from 'react';
import DashboardSidebar from './DashboardSidebar';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';

interface DashboardLayoutProps {
  children: ReactNode;
  role: 'owner' | 'admin' | 'client';
}

export default function DashboardLayout({ children, role }: DashboardLayoutProps) {
  const [currentPath, setCurrentPath] = useState('');
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setCurrentPath(window.location.pathname);
    
    // Check if mobile on mount and window resize
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      window.location.href = `${baseUrl}/miraka-co-portal`;
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = `${baseUrl}/miraka-co-portal`;
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#F7F7F9' }}>
      <DashboardSidebar 
        role={role} 
        currentPath={currentPath} 
        onLogout={handleLogout}
      />
      
      <main
        style={{
          flex: 1,
          marginLeft: isMobile ? '0' : sidebarWidth + 'px', // No margin on mobile
          paddingTop: isMobile ? '64px' : '24px', // Account for hamburger button on mobile
          paddingLeft: isMobile ? '16px' : '24px',
          paddingRight: isMobile ? '16px' : '24px',
          paddingBottom: isMobile ? '16px' : '24px',
          transition: 'margin-left 0.3s ease',
          minHeight: '100vh',
          width: isMobile ? '100%' : 'auto' // Full width on mobile
        }}
      >
        {children}
      </main>
    </div>
  );
}


