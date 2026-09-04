import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { NextResponse } from 'next/server';
import { createSession } from '@/lib/auth';
import { authenticatorDB, userDB } from '@/lib/db';
import { clearLoginChallenge, getLoginChallenge } from '@/lib/webauthn';

export async function POST(request: Request) {
  const { username, response } = await request.json();
  const trimmedUsername = String(username ?? '').trim();

  if (!trimmedUsername || !response) {
    return NextResponse.json({ error: 'Invalid login payload' }, { status: 400 });
  }

  const user = userDB.findByUsername(trimmedUsername);

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const expectedChallenge = getLoginChallenge(user.id);

  if (!expectedChallenge) {
    return NextResponse.json({ error: 'Challenge expired' }, { status: 400 });
  }

  const authenticators = authenticatorDB.listByUser(user.id);
  const authenticator = authenticators[0];

  if (!authenticator) {
    return NextResponse.json({ error: 'No passkey registered for this user' }, { status: 400 });
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: expectedChallenge,
    expectedOrigin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    expectedRPID: 'localhost',
    requireUserVerification: false,
    credential: {
      id: authenticator.credential_id,
      publicKey: Uint8Array.from(authenticator.credential_public_key),
      counter: authenticator.counter ?? 0,
      transports: ['internal'],
    },
  });

  if (!verification.verified) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 400 });
  }

  authenticatorDB.updateCounter(user.id, authenticator.credential_id, verification.authenticationInfo.newCounter ?? authenticator.counter ?? 0);
  clearLoginChallenge(user.id);
  await createSession(user);

  return NextResponse.json({ ok: true });
}
