import { useState } from 'react';
import { Eye, EyeOff, Loader2, Save, X, Upload } from 'lucide-react';
import type { Profile } from '@/lib/types';

export function ProfileSettingsModal({
  profile,
  onClose,
  onUpdateProfile,
  onChangePassword,
  onUpdateAvatar,
  busy,
}: {
  profile: Profile | null;
  onClose: () => void;
  onUpdateProfile: (fullName: string) => Promise<void>;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  onUpdateAvatar: (file: File) => Promise<void>;
  busy: boolean;
}) {
  const [activeTab, setActiveTab] = useState<'basic' | 'password' | 'avatar'>('basic');
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const handleUpdateProfile = async () => {
    setError('');
    setSuccess('');
    if (!fullName.trim()) {
      setError('Name cannot be empty.');
      return;
    }
    try {
      await onUpdateProfile(fullName);
      setSuccess('Profile updated successfully.');
      setTimeout(() => {
        setSuccess('');
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update profile.');
    }
  };

  const handleChangePassword = async () => {
    setError('');
    setSuccess('');
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All password fields are required.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    try {
      await onChangePassword(currentPassword, newPassword);
      setSuccess('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setSuccess('');
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change password.');
    }
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Avatar must be smaller than 5 MB.');
      return;
    }
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setAvatarPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateAvatar = async () => {
    if (!avatarFile) return;
    setError('');
    setSuccess('');
    try {
      await onUpdateAvatar(avatarFile);
      setSuccess('Avatar updated successfully.');
      setAvatarFile(null);
      setAvatarPreview(null);
      setTimeout(() => {
        setSuccess('');
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update avatar.');
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal modal-settings" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-title">
          <h2>Profile Settings</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        <div className="settings-tabs">
          <button
            className={`settings-tab ${activeTab === 'basic' ? 'active' : ''}`}
            onClick={() => { setActiveTab('basic'); setError(''); setSuccess(''); }}
          >
            Basic Information
          </button>
          <button
            className={`settings-tab ${activeTab === 'password' ? 'active' : ''}`}
            onClick={() => { setActiveTab('password'); setError(''); setSuccess(''); }}
          >
            Change Password
          </button>
          <button
            className={`settings-tab ${activeTab === 'avatar' ? 'active' : ''}`}
            onClick={() => { setActiveTab('avatar'); setError(''); setSuccess(''); }}
          >
            Profile Picture
          </button>
        </div>

        <div className="settings-content">
          {activeTab === 'basic' && (
            <div className="settings-form">
              <label className="form-field">
                <span>Full Name</span>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                />
              </label>
              <label className="form-field">
                <span>Email Address</span>
                <input
                  type="email"
                  value={profile?.email || ''}
                  disabled
                  className="disabled"
                  title="Email cannot be changed"
                />
              </label>
              {error && <p className="form-error">{error}</p>}
              {success && <p className="form-success">{success}</p>}
              <div className="modal-actions">
                <button type="button" className="outline-button" onClick={onClose}>Cancel</button>
                <button
                  className="primary-button"
                  onClick={handleUpdateProfile}
                  disabled={busy || !fullName.trim() || fullName === profile?.full_name}
                >
                  {busy ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
                  Save Changes
                </button>
              </div>
            </div>
          )}

          {activeTab === 'password' && (
            <div className="settings-form">
              <label className="form-field">
                <span>Current Password</span>
                <div className="pw-wrap">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                  />
                  <button type="button" onClick={() => setShowCurrent(!showCurrent)}>
                    {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
              <label className="form-field">
                <span>New Password</span>
                <div className="pw-wrap">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 6 characters)"
                  />
                  <button type="button" onClick={() => setShowNew(!showNew)}>
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
              <label className="form-field">
                <span>Confirm New Password</span>
                <div className="pw-wrap">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)}>
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
              {error && <p className="form-error">{error}</p>}
              {success && <p className="form-success">{success}</p>}
              <div className="modal-actions">
                <button type="button" className="outline-button" onClick={onClose}>Cancel</button>
                <button
                  className="primary-button"
                  onClick={handleChangePassword}
                  disabled={busy || !currentPassword || !newPassword || !confirmPassword}
                >
                  {busy ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
                  Change Password
                </button>
              </div>
            </div>
          )}

          {activeTab === 'avatar' && (
            <div className="settings-form">
              <div className="avatar-preview-box">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar preview" className="avatar-preview-img" />
                ) : profile?.avatar_color?.startsWith('http') ? (
                  <img src={profile.avatar_color} alt="Current avatar" className="avatar-preview-img" />
                ) : (
                  <div className="avatar-preview-empty">
                    <span className="avatar avatar-large">{(profile?.full_name || profile?.email || 'U').slice(0, 2).toUpperCase()}</span>
                    <p>Current avatar</p>
                  </div>
                )}
              </div>
              <label className="file-input-label">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarSelect}
                  className="hidden"
                />
                <div className="file-input-button">
                  <Upload size={18} />
                  <span>{avatarFile ? 'Change image' : 'Choose image'}</span>
                </div>
              </label>
              <p className="form-hint">Upload a JPG, PNG, or GIF image. Maximum size: 5 MB.</p>
              {error && <p className="form-error">{error}</p>}
              {success && <p className="form-success">{success}</p>}
              <div className="modal-actions">
                <button type="button" className="outline-button" onClick={() => { setAvatarFile(null); setAvatarPreview(null); onClose(); }}>Cancel</button>
                <button
                  className="primary-button"
                  onClick={handleUpdateAvatar}
                  disabled={busy || !avatarFile}
                >
                  {busy ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
                  Update Avatar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
