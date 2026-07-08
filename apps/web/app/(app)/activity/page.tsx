'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/Icons';
import { getActivity, type ActivityEntry } from '@/lib/demo-state';

export default function ActivityPage() {
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setActivity(getActivity());
    setReady(true);
  }, []);

  return (
    <main className="screen">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <Link href="/dashboard" className="icon-btn" aria-label="Back">
          <Icon name="chevronLeft" size={18} />
        </Link>
        <h1 style={{ fontSize: '1.5rem' }}>My Activity</h1>
      </div>

      <div className="card" style={{ padding: 22 }}>
        <div className="feed">
          {activity.map((a) => (
            <div key={a.id} className="feed-row">
              <span className="feed-ic">
                <Icon name="clock" size={16} />
              </span>
              <div className="feed-body">
                <strong>{a.label}</strong>
                <span>{a.detail}</span>
              </div>
              <span className="feed-time">{new Date(a.at).toLocaleString()}</span>
            </div>
          ))}
          {ready && !activity.length && <p className="muted">No activity yet.</p>}
        </div>
      </div>
    </main>
  );
}
