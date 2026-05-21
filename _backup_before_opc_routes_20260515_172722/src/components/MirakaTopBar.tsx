import { UserProfile } from '../lib/supabase';

interface TopBarProps {
  title: string;
  user?: UserProfile;
}

export default function MirakaTopBar({ title, user }: TopBarProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="miraka-topbar">
      <div className="miraka-topbar-title">
        <h1>{title}</h1>
      </div>

      {user && (
        <div className="miraka-topbar-actions">
          <div className="miraka-user-menu">
            <div className="miraka-user-avatar">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.full_name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                getInitials(user.full_name || user.email)
              )}
            </div>
            <div className="miraka-user-info">
              <div className="miraka-user-name">{user.full_name || user.email}</div>
              <div className="miraka-user-role">{user.role}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
