import { useEffect, useState } from 'react';
import { userApi } from '../api/client';

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    userApi.getMe().then(setProfile);
  }, []);

  if (!profile) return <p className="status">Loading profile...</p>;

  return (
    <section className="panel">
      <h2>Profile</h2>
      <div className="profile-box">
        <div className="avatar">{profile.name?.[0] ?? 'U'}</div>
        <div>
          <h3>{profile.name}</h3>
          <p>{profile.email}</p>
          <p>{profile.bio}</p>
        </div>
      </div>
    </section>
  );
}
