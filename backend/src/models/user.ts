import type { Role } from '../middleware/auth';

export type UserStatus = 'active' | 'invited' | 'suspended';

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  role: Role;
  location: string;
  phone: string;
  status: UserStatus;
  avatar: string;
  specialisation?: string;
  organisation?: string;
  joinedAt: string;
  passwordHash?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export type PublicUserAccount = Omit<UserAccount, 'passwordHash'>;

export function toPublicUser(user: UserAccount): PublicUserAccount {
  const { passwordHash: _omit, ...safe } = user;
  return safe;
}
