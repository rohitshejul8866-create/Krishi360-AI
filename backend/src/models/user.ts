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

export interface UserLoginRecord {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
  passwordHash?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface UserProfileRecord {
  id: string;
  name: string;
  location: string;
  phone: string;
  avatar: string;
  specialisation?: string;
  organisation?: string;
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export type PublicUserAccount = Omit<UserAccount, 'passwordHash'>;

export function toPublicUser(user: UserAccount): PublicUserAccount {
  const { passwordHash: _omit, ...safe } = user;
  return safe;
}

export function splitUserAccount(user: UserAccount): {
  login: UserLoginRecord;
  profile: UserProfileRecord;
} {
  return {
    login: {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      ...(user.passwordHash ? { passwordHash: user.passwordHash } : {}),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      version: user.version,
    },
    profile: {
      id: user.id,
      name: user.name,
      location: user.location,
      phone: user.phone,
      avatar: user.avatar,
      ...(user.specialisation ? { specialisation: user.specialisation } : {}),
      ...(user.organisation ? { organisation: user.organisation } : {}),
      joinedAt: user.joinedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      version: user.version,
    },
  };
}

export function mergeUserAccount(
  login: UserLoginRecord,
  profile?: UserProfileRecord | null,
): UserAccount {
  const fallbackName = login.email.split('@')[0] || 'User';
  return {
    id: login.id,
    email: login.email,
    role: login.role,
    status: login.status,
    ...(login.passwordHash ? { passwordHash: login.passwordHash } : {}),
    name: profile?.name ?? fallbackName,
    location: profile?.location ?? 'India',
    phone: profile?.phone ?? 'Not provided',
    avatar: profile?.avatar ?? fallbackName.slice(0, 2).toUpperCase(),
    ...(profile?.specialisation ? { specialisation: profile.specialisation } : {}),
    ...(profile?.organisation ? { organisation: profile.organisation } : {}),
    joinedAt: profile?.joinedAt ?? login.createdAt.slice(0, 10),
    createdAt: login.createdAt,
    updatedAt: login.updatedAt,
    version: login.version,
  };
}
