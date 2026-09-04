import { generateRegistrationOptions } from '@simplewebauthn/server';
import { NextResponse } from 'next/server';
import { userDB } from '@/lib/db';
import { setRegistrationChallenge } from '@/lib/webauthn';

export async function POST(request: Request) {
  const { username } = await request.json();
  const trimmedUsername = String(username ?? '').trim();

  if (!trimmedUsername) {
    return NextResponse.json({ error: 'Username is required' }, { status: 400 });
  }

  const existingUser = userDB.findByUsername(trimmedUsername);
  const user = existingUser ?? userDB.create(trimmedUsername);

  if (!user) {
    return NextResponse.json({ error: 'Unable to create user' }, { status: 500 });
  }

  const options = await generateRegistrationOptions({
    rpName: 'Todo App',
    rpID: 'localhost',
    userID: Uint8Array.from(Buffer.from(String(user.id))),
    userName: user.username,
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
    timeout: 60000,
  });

  setRegistrationChallenge(user.id, options.challenge);

  return NextResponse.json(options);
}
