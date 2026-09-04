import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { NextResponse } from 'next/server';
import { authenticatorDB, userDB } from '@/lib/db';
import { setLoginChallenge } from '@/lib/webauthn';

export async function POST(request: Request) {
  const { username } = await request.json();
  const trimmedUsername = String(username ?? '').trim();

  if (!trimmedUsername) {
    return NextResponse.json({ error: 'Username is required' }, { status: 400 });
  }

  const user = userDB.findByUsername(trimmedUsername);

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const authenticators = authenticatorDB.listByUser(user.id);
  const options = await generateAuthenticationOptions({
    rpID: 'localhost',
    userVerification: 'preferred',
    allowCredentials: authenticators.map((authenticator) => ({
      id: authenticator.credential_id,
      transports: ['internal'],
    })),
    timeout: 60000,
  });

  setLoginChallenge(user.id, options.challenge);
  return NextResponse.json(options);
}
