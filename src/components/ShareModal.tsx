import { useEffect, useState } from 'react';
import { Check, Copy, Link as LinkIcon, Loader2, Lock, MoreHorizontal, Trash2, UserPlus, X } from 'lucide-react';
import type { LinkShareRow, UnifiedItem } from '@/lib/types';
import { formatRelativeTime } from '@/lib/types';

export function ShareModal({ item, onClose, onCreateLink, onGetLinks, onRevokeLink, onInvite, onGetShares, onRevokeShare }: {
  item: UnifiedItem;
  onClose: () => void;
  onCreateLink: (password?: string, expiresInHours?: number) => Promise<string>;
  onGetLinks: () => Promise<LinkShareRow[]>;
  onRevokeLink: (id: string) => Promise<void>;
  onInvite: (email: string, role: 'viewer' | 'editor') => Promise<void>;
  onGetShares: () => Promise<{ id: string; grantee_email: string; role: string }[]>;
  onRevokeShare: (id: string) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'viewer' | 'editor'>('viewer');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [shares, setShares] = useState<{ id: string; grantee_email: string; role: string }[]>([]);
  const [links, setLinks] = useState<LinkShareRow[]>([]);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [expiry, setExpiry] = useState<number | null>(null);
  const [copiedToken, setCopiedToken] = useState('');

  useEffect(() => {
    onGetShares().then(setShares).catch(() => {});
    onGetLinks().then(setLinks).catch(() => {});
  }, [onGetShares, onGetLinks]);

  const handleInvite = async () => {
    if (!email.trim()) return;
    setInviteBusy(true);
    setInviteError('');
    try {
      await onInvite(email, role);
      setEmail('');
      const updated = await onGetShares();
      setShares(updated);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Could not share.');
    } finally {
      setInviteBusy(false);
    }
  };

  const handleCreateLink = async () => {
    setLinkBusy(true);
    setLinkError('');
    try {
      await onCreateLink(usePassword ? password : undefined, expiry ?? undefined);
      const updated = await onGetLinks();
      setLinks(updated);
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : 'Could not create link.');
    } finally {
      setLinkBusy(false);
    }
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/s/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(''), 2000);
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal modal-wide" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-title"><h2>Share "{item.name}"</h2><button onClick={onClose}><X size={18} /></button></div>
        <div className="share-panel">
          <div className="share-section">
            <h3>People with access</h3>
            <div className="invite-row">
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Add by email address" onKeyDown={(e) => { if (e.key === 'Enter') handleInvite(); }} />
              <select value={role} onChange={(e) => setRole(e.target.value as 'viewer' | 'editor')}><option value="viewer">Viewer</option><option value="editor">Editor</option></select>
              <button className="primary-button" onClick={handleInvite} disabled={inviteBusy || !email.trim()}>{inviteBusy ? <Loader2 size={15} className="spin" /> : <UserPlus size={15} />} Invite</button>
            </div>
            {inviteError && <p className="form-error">{inviteError}</p>}
            <div className="share-list">
              <div className="share-person"><span className="share-avatar">YO</span><div><strong>You</strong><span>Owner</span></div></div>
              {shares.map((s) => (
                <div className="share-person" key={s.id}><span className="share-avatar">{s.grantee_email[0]?.toUpperCase()}</span><div><strong>{s.grantee_email}</strong><span>{s.role === 'editor' ? 'Editor' : 'Viewer'}</span></div><button className="share-remove" onClick={async () => { await onRevokeShare(s.id); setShares(await onGetShares()); }}><Trash2 size={14} /></button></div>
              ))}
            </div>
          </div>
          <div className="share-divider" />
          <div className="share-section">
            <h3>Share by link</h3>
            <div className="link-options">
              <label className="check-row"><input type="checkbox" checked={usePassword} onChange={(e) => setUsePassword(e.target.checked)} /><Lock size={14} /> Password protect</label>
              {usePassword && <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Link password" className="link-pw" />}
              <label className="check-row"><span>Expires after</span><select value={expiry ?? ''} onChange={(e) => setExpiry(e.target.value ? Number(e.target.value) : null)}><option value="">Never</option><option value="24">24 hours</option><option value="168">7 days</option><option value="720">30 days</option></select></label>
            </div>
            <button className="outline-button full-button" onClick={handleCreateLink} disabled={linkBusy}>{linkBusy ? <Loader2 size={15} className="spin" /> : <LinkIcon size={15} />} Create link</button>
            {linkError && <p className="form-error">{linkError}</p>}
            <div className="link-list">
              {links.map((link) => (
                <div className="link-item" key={link.id}>
                  <div className="link-info"><LinkIcon size={15} /><span>{link.expires_at ? `Expires ${formatRelativeTime(link.expires_at)}` : 'Never expires'}</span>{link.password_hash && <Lock size={12} />}</div>
                  <div className="link-actions"><button onClick={() => copyLink(link.token)}>{copiedToken === link.token ? <Check size={14} /> : <Copy size={14} />} Copy</button><button className="link-revoke" onClick={async () => { await onRevokeLink(link.id); setLinks(await onGetLinks()); }}><MoreHorizontal size={14} /> Revoke</button></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
