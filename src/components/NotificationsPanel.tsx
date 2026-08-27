import { useEffect, useState } from 'react';
import { Loader2, X, Trash2, Clock3, FileText, Folder, Share2 } from 'lucide-react';
import type { ActivityRow } from '@/lib/types';
import { formatRelativeTime } from '@/lib/types';
import { supabase } from '@/lib/supabase';

export function NotificationsPanel({
  userId,
  onClose,
}: {
  userId: string | undefined;
  onClose: () => void;
}) {
  const [notifications, setNotifications] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId) return;
    loadNotifications();

    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  const loadNotifications = async () => {
    if (!userId) return;
    try {
      const { data, error: queryError } = await supabase
        .from('activities')
        .select('*')
        .eq('actor_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (queryError) throw queryError;
      const { data: shares, error: sharesError } = await supabase.from('shares').select('*').eq('grantee_user_id', userId).order('created_at', { ascending: false }).limit(20);
      if (sharesError) throw sharesError;
      const shareNotifications = (shares ?? []).map((share) => ({ id: `share-${share.id}`, actor_id: share.created_by, action: `share_${share.resource_type}`, resource_type: share.resource_type, resource_id: share.resource_id, context: { name: `Resource shared with you (${share.role})` }, created_at: share.created_at } as ActivityRow));
      setNotifications([...(data ?? []), ...shareNotifications].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 20));
      setError('');
    } catch {
      setError('Could not load notifications');
    } finally {
      setLoading(false);
    }
  };

  const clearNotifications = async () => {
    if (!userId || notifications.length === 0) return;
    try {
      await Promise.all(
        notifications.filter((n) => !n.id.startsWith('share-')).map(n => supabase.from('activities').delete().eq('id', n.id))
      );
      setNotifications([]);
    } catch {
      setError('Could not clear notifications');
    }
  };

  const getActionLabel = (action: string): string => {
    const labels: { [key: string]: string } = {
      'create_file': 'Uploaded',
      'create_folder': 'Created folder',
      'delete_file': 'Deleted file',
      'delete_folder': 'Deleted folder',
      'share_file': 'Shared file',
      'share_folder': 'Shared folder',
      'rename_file': 'Renamed file',
      'rename_folder': 'Renamed folder',
      'move_file': 'Moved file',
      'move_folder': 'Moved folder',
    };
    return labels[action] || action.replace('_', ' ');
  };

  const getIcon = (resourceType: string, action: string) => {
    if (action.includes('share')) return <Share2 size={16} />;
    if (resourceType === 'folder') return <Folder size={16} />;
    return <FileText size={16} />;
  };

  return (
    <div className="notifications-panel">
      <div className="notifications-header">
        <h3>Notifications</h3>
        <button onClick={onClose} title="Close"><X size={18} /></button>
      </div>

      <div className="notifications-content">
        {loading ? (
          <div className="notifications-loading">
            <Loader2 size={24} className="spin" />
            <p>Loading notifications...</p>
          </div>
        ) : error ? (
          <div className="notifications-error">
            <p>{error}</p>
            <button onClick={loadNotifications} className="outline-button">Retry</button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="notifications-empty">
            <Clock3 size={40} />
            <p>No notifications yet</p>
            <span>Check back later for activity updates</span>
          </div>
        ) : (
          <div className="notifications-list">
            {notifications.map((notif) => (
              <div key={notif.id} className="notification-item">
                <div className="notification-icon">
                  {getIcon(notif.resource_type, notif.action)}
                </div>
                <div className="notification-content">
                  <p>
                    <strong>{getActionLabel(notif.action)}</strong>
                    {typeof notif.context?.name === 'string' && (
                      <>: <span className="notification-name">{String(notif.context.name)}</span></>
                    )}
                  </p>
                  <span className="notification-time">{formatRelativeTime(notif.created_at)}</span>
                </div>
                <button
                  className="notification-remove"
                  onClick={async () => {
                    if (!notif.id.startsWith('share-')) await supabase.from('activities').delete().eq('id', notif.id);
                    setNotifications(notifications.filter(n => n.id !== notif.id));
                  }}
                  title="Dismiss"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            {notifications.length > 0 && (
              <button className="clear-all-button" onClick={clearNotifications}>
                Clear all notifications
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
