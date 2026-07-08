'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon, type IconName } from '@/components/Icons';
import {
  electionInfo,
  formatNumber,
  getActivity,
  getDemoCandidates,
  getDemoUsers,
  saveDemoCandidates,
  saveDemoUsers,
  totalVotes,
  type ActivityEntry,
  type DemoCandidate,
  type DemoUser,
} from '@/lib/demo-state';

type Section =
  | 'Dashboard'
  | 'Voters'
  | 'Elections'
  | 'Candidates'
  | 'Results'
  | 'Reports'
  | 'Audit Logs'
  | 'System Settings'
  | 'Users & Roles'
  | 'Notifications';

const NAV: { key: Section; icon: IconName }[] = [
  { key: 'Dashboard', icon: 'grid' },
  { key: 'Voters', icon: 'users' },
  { key: 'Elections', icon: 'calendar' },
  { key: 'Candidates', icon: 'candidate' },
  { key: 'Results', icon: 'chart' },
  { key: 'Reports', icon: 'report' },
  { key: 'Audit Logs', icon: 'audit' },
  { key: 'System Settings', icon: 'settings' },
  { key: 'Users & Roles', icon: 'roles' },
  { key: 'Notifications', icon: 'bell' },
];

/* Simple inline SVG line chart for "Votes cast over time". */
function LineChart({ points }: { points: number[] }) {
  const w = 600;
  const h = 200;
  const pad = 12;
  const max = Math.max(...points, 1);
  const step = (w - pad * 2) / (points.length - 1);
  const coords = points.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - (v / max) * (h - pad * 2);
    return [x, y] as const;
  });
  const line = coords.map(([x, y]) => `${x},${y}`).join(' ');
  const firstX = coords[0]![0];
  const lastX = coords[coords.length - 1]![0];
  const area = `M ${firstX},${h - pad} L ${line.replace(/ /g, ' L ')} L ${lastX},${h - pad} Z`;
  const labels = ['12 AM', '4 AM', '8 AM', '12 PM', '4 PM', '8 PM', '12 AM'];
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${w} ${h + 22}`} style={{ width: '100%', minWidth: 460, height: 'auto' }} role="img" aria-label="Votes cast over time">
        <defs>
          <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(193,255,95,0.28)" />
            <stop offset="100%" stopColor="rgba(193,255,95,0)" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={pad} x2={w - pad} y1={h - pad - f * (h - pad * 2)} y2={h - pad - f * (h - pad * 2)} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
        ))}
        <path d={area} fill="url(#area)" />
        <polyline points={line} fill="none" stroke="#c1ff5f" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        {coords.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={3.5} fill="#c1ff5f" />
        ))}
        {labels.map((l, i) => (
          <text key={l} x={pad + (i * (w - pad * 2)) / (labels.length - 1)} y={h + 14} fill="#7e9078" fontSize="12" textAnchor="middle">
            {l}
          </text>
        ))}
      </svg>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card" style={{ padding: 22 }}>
      <h3 style={{ marginBottom: 16 }}>{title}</h3>
      {children}
    </section>
  );
}

export default function ConsolePage() {
  const [section, setSection] = useState<Section>('Dashboard');
  const [candidates, setCandidates] = useState<DemoCandidate[]>([]);
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [name, setName] = useState('');
  const [party, setParty] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    setCandidates(getDemoCandidates());
    setUsers(getDemoUsers());
    setActivity(getActivity());
  }, []);

  const votesCast = totalVotes(candidates);
  const turnout = electionInfo.registeredVoters
    ? (votesCast / electionInfo.registeredVoters) * 100
    : 0;
  const remaining = Math.max(0, electionInfo.registeredVoters - votesCast);

  const chartData = useMemo(
    () => [...candidates].sort((a, b) => b.votes - a.votes),
    [candidates],
  );

  function addCandidate() {
    if (!name.trim() || !party.trim()) return;
    const next = [
      ...candidates,
      {
        id: crypto.randomUUID(),
        name: name.trim(),
        party: party.trim(),
        description: description.trim() || 'New candidate',
        votes: 0,
      },
    ];
    setCandidates(next);
    saveDemoCandidates(next);
    setName('');
    setParty('');
    setDescription('');
  }

  function updateUserStatus(userId: string, status: DemoUser['status']) {
    const next = users.map((u) => (u.id === userId ? { ...u, status } : u));
    setUsers(next);
    saveDemoUsers(next);
  }

  const stats = [
    { label: 'Total Registered Voters', value: formatNumber(electionInfo.registeredVoters), trend: '+4.2% from last cycle', icon: 'users' as IconName },
    { label: 'Total Votes Cast', value: formatNumber(votesCast), trend: `${turnout.toFixed(2)}% Turnout`, icon: 'ballot' as IconName },
    { label: 'Ongoing Elections', value: '1', trend: 'View Ongoing', icon: 'calendar' as IconName },
    { label: 'Completed Elections', value: '5', trend: 'View All', icon: 'check' as IconName },
  ];

  return (
    <div className="admin">
      {/* Sidebar */}
      <aside className="admin-side">
        <div className="admin-brand">
          <span className="dot">
            <Icon name="check" size={16} strokeWidth={3} />
          </span>
          National Digital Voting
        </div>
        <nav className="admin-nav">
          {NAV.map((item) => (
            <button
              key={item.key}
              className={section === item.key ? 'active' : ''}
              onClick={() => setSection(item.key)}
            >
              <Icon name={item.icon} size={18} />
              {item.key}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="admin-main">
        <div className="admin-topbar">
          <div>
            <h1 style={{ fontSize: '1.5rem' }}>{section === 'Dashboard' ? 'Dashboard Overview' : section}</h1>
          </div>
          <input className="input admin-search" placeholder="Search anything…" aria-label="Search" />
          <div className="admin-user">
            <Link href="/dashboard" className="icon-btn" aria-label="Voter view">
              <Icon name="home" size={18} />
            </Link>
            <span className="avatar">AU</span>
            <div style={{ lineHeight: 1.2 }}>
              <strong style={{ fontSize: 14 }}>Admin User</strong>
              <div className="faint" style={{ fontSize: 12 }}>Super Admin</div>
            </div>
          </div>
        </div>

        {section === 'Dashboard' && (
          <>
            <div className="stat-grid">
              {stats.map((s) => (
                <div key={s.label} className="stat-card">
                  <div>
                    <div className="label">{s.label}</div>
                    <div className="value">{s.value}</div>
                    <div className="trend">{s.trend}</div>
                  </div>
                  <span className="stat-ic">
                    <Icon name={s.icon} size={20} />
                  </span>
                </div>
              ))}
            </div>

            <div className="admin-grid-2">
              <Panel title={`Voter Turnout (${electionInfo.title})`}>
                <div style={{ display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <div
                    className="donut"
                    style={{ background: `conic-gradient(var(--brand) 0 ${turnout}%, rgba(255,255,255,0.08) 0)` }}
                  >
                    <div className="donut-center">
                      <div>
                        <strong>{turnout.toFixed(2)}%</strong>
                        <br />
                        <span>Turnout</span>
                      </div>
                    </div>
                  </div>
                  <div className="legend">
                    <div className="legend-row">
                      <i style={{ background: 'var(--brand)' }} /> Votes Cast — {formatNumber(votesCast)}
                    </div>
                    <div className="legend-row">
                      <i style={{ background: 'rgba(255,255,255,0.14)' }} /> Votes Remaining — {formatNumber(remaining)}
                    </div>
                  </div>
                </div>
              </Panel>

              <Panel title="Votes Cast Over Time">
                <LineChart points={[1.2, 3.1, 5.4, 8.2, 11.6, 14.3, 16.1, votesCast / 1_000_000]} />
              </Panel>
            </div>

            <div className="admin-grid-2">
              <Panel title="Recent Activity">
                <div className="feed">
                  {[
                    ['New voter registered', 'Voter ID: 9876 5432 1098', '2 mins ago'],
                    ['Vote cast successfully', 'Voter ID: 1234 5678 9012', '5 mins ago'],
                    ['Election settings updated', 'By Admin User', '15 mins ago'],
                    ['Results recalculated', electionInfo.title, '20 mins ago'],
                  ].map(([label, detail, time]) => (
                    <div key={label} className="feed-row">
                      <span className="feed-ic">
                        <Icon name="activity" size={16} />
                      </span>
                      <div className="feed-body">
                        <strong>{label}</strong>
                        <span>{detail}</span>
                      </div>
                      <span className="feed-time">{time}</span>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="System Status">
                {['Server Status', 'Database', 'Security', 'Blockchain Node', 'Backup'].map((row) => (
                  <div key={row} className="sys-row">
                    <span className="muted">{row}</span>
                    <span className="dot-ok">
                      <i /> Operational
                    </span>
                  </div>
                ))}
              </Panel>
            </div>
          </>
        )}

        {(section === 'Voters' || section === 'Users & Roles') && (
          <div className="stack">
            {section === 'Users & Roles' && (
              <Panel title="Roles">
                <div className="stack">
                  {[
                    ['Super Admin', 'Full access to all modules and settings'],
                    ['Returning Officer', 'Manage elections, candidates and results'],
                    ['Auditor', 'Read-only access to audit logs and reports'],
                  ].map(([role, desc]) => (
                    <div key={role} className="sys-row">
                      <div>
                        <strong>{role}</strong>
                        <div className="faint" style={{ fontSize: 13 }}>{desc}</div>
                      </div>
                      <span className="pill-verified">Active</span>
                    </div>
                  ))}
                </div>
              </Panel>
            )}
            <Panel title="Registered Voters">
              <div className="stack">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="sys-row"
                    style={{ alignItems: 'center', flexWrap: 'wrap', gap: 12 }}
                  >
                    <div>
                      <strong>{user.name}</strong>
                      <div className="faint" style={{ fontSize: 13 }}>{user.email}</div>
                      <div className="muted" style={{ fontSize: 12, textTransform: 'capitalize' }}>
                        Status: {user.status}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="btn btn-ghost" onClick={() => updateUserStatus(user.id, 'active')}>Activate</button>
                      <button className="btn btn-ghost" onClick={() => updateUserStatus(user.id, 'suspended')}>Suspend</button>
                      <button className="btn btn-ghost" onClick={() => updateUserStatus(user.id, 'blocked')}>Block</button>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}

        {section === 'Candidates' && (
          <div className="stack">
            <Panel title="Add candidate">
              <div style={{ display: 'grid', gap: 12, maxWidth: 560 }}>
                <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
                <input className="input" placeholder="Party" value={party} onChange={(e) => setParty(e.target.value)} />
                <input className="input" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
                <button className="btn btn-primary" style={{ width: 180 }} onClick={addCandidate}>
                  Add candidate
                </button>
              </div>
            </Panel>
            <Panel title="Candidates">
              <div className="stack">
                {candidates.map((c) => (
                  <div key={c.id} className="sys-row">
                    <div>
                      <strong>{c.name}</strong>
                      <div className="faint" style={{ fontSize: 13 }}>{c.party} · {c.description}</div>
                    </div>
                    <span className="muted">{formatNumber(c.votes)} votes</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}

        {section === 'Results' && (
          <Panel title="Presidential — live tally">
            <div className="stack">
              {chartData.map((c) => {
                const pct = votesCast ? (c.votes / votesCast) * 100 : 0;
                return (
                  <div key={c.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span>{c.name} <span className="faint">· {c.party}</span></span>
                      <span className="pct" style={{ color: 'var(--brand)', fontWeight: 700 }}>{pct.toFixed(2)}%</span>
                    </div>
                    <div className="result-track">
                      <div className="result-fill" style={{ width: `${Math.max(2, pct)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <Link href="/results" className="btn btn-ghost" style={{ marginTop: 18 }}>
              Open public results page
            </Link>
          </Panel>
        )}

        {section === 'Elections' && (
          <Panel title="Elections">
            <div className="stack">
              {[
                ['2024 General Election', 'Presidential · Senate · House of Rep.', 'Ongoing'],
                ['2023 Governorship Election', '36 states · FCT', 'Completed'],
                ['2023 Presidential Election', 'National', 'Completed'],
              ].map(([title, meta, status]) => (
                <div key={title} className="sys-row">
                  <div>
                    <strong>{title}</strong>
                    <div className="faint" style={{ fontSize: 13 }}>{meta}</div>
                  </div>
                  <span className={status === 'Ongoing' ? 'pill-verified' : 'muted'}>{status}</span>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {section === 'Reports' && (
          <div className="stack">
            {[
              ['Voter Turnout Report', `Turnout ${turnout.toFixed(2)}% · ${formatNumber(votesCast)} votes cast`],
              ['Results Summary', `${electionInfo.title} · Presidential contest`],
              ['Audit Export', 'Signed, tamper-evident tally export'],
            ].map(([title, meta]) => (
              <div key={title} className="card sys-row" style={{ padding: 18 }}>
                <div>
                  <strong>{title}</strong>
                  <div className="faint" style={{ fontSize: 13 }}>{meta}</div>
                </div>
                <span className="btn btn-ghost"><Icon name="download" size={16} /> Download</span>
              </div>
            ))}
          </div>
        )}

        {section === 'Audit Logs' && (
          <Panel title="Audit Logs">
            <div className="feed">
              {[
                ['CHECKPOINT', 'Merkle root anchored', 'root 0x9f3a…c21e'],
                ['VOTE', 'Ballot recorded', 'receipt VOTE-2024-****'],
                ['ADMIN', 'Settings changed', 'voting window updated'],
                ['EXPORT', 'Signed export built', 'presidential-tally.json'],
              ].map(([tag, label, detail]) => (
                <div key={label} className="feed-row">
                  <span className="feed-ic"><Icon name="audit" size={16} /></span>
                  <div className="feed-body">
                    <strong>{tag} · {label}</strong>
                    <span>{detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {section === 'System Settings' && (
          <Panel title="System Settings">
            <div className="stack">
              {[
                ['Voting window', 'Open until 25 May 2024, 6:00 PM'],
                ['Identity verification', 'NIN/BVN required (Dojah · Smile ID)'],
                ['Multi-factor for admins', 'Enabled'],
                ['Result freeze', 'Automatic at poll close'],
              ].map(([k, v]) => (
                <div key={k} className="sys-row">
                  <span className="muted">{k}</span>
                  <span>{v}</span>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {section === 'Notifications' && (
          <Panel title="Notifications">
            <div className="feed">
              {(activity.length ? activity : []).map((a) => (
                <div key={a.id} className="feed-row">
                  <span className="feed-ic"><Icon name="bell" size={16} /></span>
                  <div className="feed-body">
                    <strong>{a.label}</strong>
                    <span>{a.detail}</span>
                  </div>
                  <span className="feed-time">{new Date(a.at).toLocaleDateString()}</span>
                </div>
              ))}
              {!activity.length && <p className="muted">No notifications yet.</p>}
            </div>
          </Panel>
        )}

        <footer className="muted" style={{ marginTop: 30, fontSize: 13, borderTop: '1px solid var(--line)', paddingTop: 16 }}>
          © 2024 National Digital Voting System. Secure · Transparent · Trusted.
        </footer>
      </div>
    </div>
  );
}
