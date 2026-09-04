import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { NextResponse } from 'next/server';
import { authenticatorDB, userDB } from '@/lib/db';
import { createSession } from '@/lib/auth';
import { clearRegistrationChallenge, getRegistrationChallenge } from '@/lib/webauthn';

export async function POST(request: Request) {
  const { username, response } = await request.json();
  const trimmedUsername = String(username ?? '').trim();

  if (!trimmedUsername || !response) {
    return NextResponse.json({ error: 'Invalid registration payload' }, { status: 400 });
  }

  const user = userDB.findByUsername(trimmedUsername);

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const expectedChallenge = getRegistrationChallenge(user.id);

  if (!expectedChallenge) {
    return NextResponse.json({ error: 'Challenge expired' }, { status: 400 });
  }

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: expectedChallenge,
    expectedOrigin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    expectedRPID: 'localhost',
    requireUserVerification: false,
  });

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: 'Registration verification failed' }, { status: 400 });
  }

  const { credential } = verification.registrationInfo;
  authenticatorDB.create(
    user.id,
    Buffer.from(credential.id).toString('base64url'),
    Buffer.from(credential.publicKey),
    credential.counter ?? 0,
  );

  clearRegistrationChallenge(user.id);
  await createSession(user);

  return NextResponse.json({ ok: true });
}
