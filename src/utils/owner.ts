import type { User } from '@firebase/auth';

export const OWNER_EMAIL = 'kennwachukz@gmail.com';
export const OWNER_UID = 'tZf56Gj2HfRgvCINTr71hxcfOby2';

export function isOwner(user: User | null | undefined): user is User {
  return user?.uid === OWNER_UID;
}
