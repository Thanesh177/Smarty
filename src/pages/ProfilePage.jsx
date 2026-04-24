import { useEffect, useMemo, useState } from 'react';
import { userApi } from '../api/client';
import './ProfilePage.css';

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    userApi.getMe().then(setProfile);
  }, []);

  const initials = useMemo(() => {
    if (!profile?.name) return 'U';

    const parts = profile.name.trim().split(' ');
    const first = parts[0]?.[0] || '';
    const second = parts[1]?.[0] || '';

    return `${first}${second}`.toUpperCase();
  }, [profile]);

  if (!profile) {
    return (
      <main className="profile-page">
        <p className="status">Loading profile...</p>
      </main>
    );
  }

  const stats = [
    { label: 'Saved', value: profile.savedCount ?? 0 },
    { label: 'Posts', value: profile.postCount ?? 0 },
    { label: 'Followers', value: profile.followers ?? 0 },
  ];

  return (
    <main className="profile-page">
      <section className="profile-hero">
        <div className="profile-left">
          <div className="avatar-xl">{initials}</div>

          <div>
            <span className="profile-pill">Your profile</span>
            <h1>{profile.name || 'User'}</h1>
            <p className="profile-email">{profile.email}</p>
            <p className="profile-bio">
              {profile.bio ||
                'Curious mind exploring psychology, science, technology, and practical knowledge.'}
            </p>
          </div>
        </div>

        <div className="profile-stats">
          {stats.map((item) => (
            <div key={item.label} className="stat-card">
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="profile-content">
        <div className="profile-card">
          <h3>About</h3>
          <p>
            Smarty helps users learn through scrollable educational content.
            Build your personal feed, save useful reels, and publish ideas worth sharing.
          </p>
        </div>

        <div className="profile-card">
          <h3>Account Details</h3>

          <div className="detail-row">
            <span>Name</span>
            <strong>{profile.name || 'Not set'}</strong>
          </div>

          <div className="detail-row">
            <span>Email</span>
            <strong>{profile.email || 'Not set'}</strong>
          </div>

          <div className="detail-row">
            <span>Status</span>
            <strong>Active</strong>
          </div>
        </div>

        <div className="profile-card">
          <h3>Creator Tip</h3>
          <p>
            Short, useful, and memorable content performs best. Teach one strong idea at a time.
          </p>
        </div>
      </section>
    </main>
  );
}