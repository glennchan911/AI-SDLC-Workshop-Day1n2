'use client';

import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { useState } from 'react';

export default function LoginPage() {
  const [username, setUsername] = useState('demo-user');
  const [status, setStatus] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  async function handleRegister() {
    setStatus('');
    setIsBusy(true);

    try {
      const optionsResponse = await fetch('/api/auth/register-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      if (!optionsResponse.ok) {
        throw new Error('Failed to fetch registration options');
      }

      const options = await optionsResponse.json();
      const registrationResponse = await startRegistration({ optionsJSON: options });

      const verifyResponse = await fetch('/api/auth/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, response: registrationResponse }),
      });

      if (!verifyResponse.ok) {
        throw new Error('Registration failed');
      }

      setStatus('Registration successful. Redirecting...');
      window.location.href = '/';
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Registration failed');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleLogin() {
    setStatus('');
    setIsBusy(true);

    try {
      const optionsResponse = await fetch('/api/auth/login-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      if (!optionsResponse.ok) {
        throw new Error('Failed to fetch login options');
      }

      const options = await optionsResponse.json();
      const authenticationResponse = await startAuthentication({ optionsJSON: options });

      const verifyResponse = await fetch('/api/auth/login-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, response: authenticationResponse }),
      });

      if (!verifyResponse.ok) {
        throw new Error('Login failed');
      }

      setStatus('Login successful. Redirecting...');
      window.location.href = '/';
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '2rem' }}>
      <div style={{ width: '100%', maxWidth: '32rem', background: '#fff', borderRadius: '1rem', padding: '2rem', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
        <h1 style={{ marginTop: 0 }}>Sign in to your Todo App</h1>

        <label htmlFor="username" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
          Username
        </label>
        <input
          id="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Enter your username"
          style={{ width: '100%', padding: '0.8rem 0.9rem', borderRadius: '0.75rem', border: '1px solid #d1d5db', marginBottom: '1rem' }}
        />

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={handleRegister} disabled={isBusy} style={{ background: '#111827', color: '#fff', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', cursor: 'pointer' }}>
            {isBusy ? 'Working...' : 'Register with Passkey'}
          </button>
          <button type="button" onClick={handleLogin} disabled={isBusy} style={{ background: '#dbeafe', color: '#1e3a8a', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', cursor: 'pointer' }}>
            Login with Passkey
          </button>
        </div>

        {status ? <p style={{ marginTop: '1rem', color: '#374151' }}>{status}</p> : null}
      </div>
    </main>
  );
}
