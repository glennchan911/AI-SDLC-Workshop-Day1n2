import { getSession } from '@/lib/auth';
import Link from 'next/link';

export default async function CalendarPage() {
  const session = await getSession();

  if (!session) {
    return <main style={{ padding: '2rem' }}><p>Not authenticated.</p><Link href="/login">Login</Link></main>;
  }

  return (
    <main style={{ minHeight: '100vh', padding: '2rem' }}>
      <h1>Calendar</h1>
      <p>Authenticated as {session.username}.</p>
      <Link href="/">Back to home</Link>
    </main>
  );
}
