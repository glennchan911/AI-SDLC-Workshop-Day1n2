const registrationChallenges = new Map<string, string>();
const loginChallenges = new Map<string, string>();

export function getRegistrationChallenge(userId: number) {
  return registrationChallenges.get(String(userId));
}

export function setRegistrationChallenge(userId: number, challenge: string) {
  registrationChallenges.set(String(userId), challenge);
}

export function clearRegistrationChallenge(userId: number) {
  registrationChallenges.delete(String(userId));
}

export function getLoginChallenge(userId: number) {
  return loginChallenges.get(String(userId));
}

export function setLoginChallenge(userId: number, challenge: string) {
  loginChallenges.set(String(userId), challenge);
}

export function clearLoginChallenge(userId: number) {
  loginChallenges.delete(String(userId));
}
