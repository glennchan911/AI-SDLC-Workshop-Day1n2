import Link from 'next/link';
import { getSession } from '@/lib/auth';

export default async function HomePage() {
  const session = await getSession();

  if (!session) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '2rem' }}>
        <div style={{ maxWidth: '32rem', width: '100%', background: '#fff', borderRadius: '1rem', padding: '2rem', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
          <h1 style={{ marginTop: 0 }}>Todo App</h1>
          <p>You need to sign in to manage your tasks.</p>
          <Link href="/login" style={{ display: 'inline-block', background: '#111827', color: '#fff', padding: '0.75rem 1rem', borderRadius: '0.75rem' }}>
            Go to login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '2rem' }}>
      <div style={{ maxWidth: '36rem', width: '100%', background: '#fff', borderRadius: '1rem', padding: '2rem', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
        <h1 style={{ marginTop: 0 }}>Welcome back</h1>
        <p style={{ marginBottom: '1.5rem' }}>Signed in as <strong>{session.username}</strong></p>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <a href="/calendar" style={{ background: '#dbeafe', color: '#1e3a8a', padding: '0.75rem 1rem', borderRadius: '0.75rem', fontWeight: 600 }}>
            Open calendar
          </a>

          <form action="/api/auth/logout" method="POST">
            <button type="submit" style={{ background: '#111827', color: '#fff', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', cursor: 'pointer' }}>
              Log out
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
