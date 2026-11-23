import type { AuthUser, Role } from '../middleware/auth';
import { toPublicUser, type PublicUserAccount, type UserAccount, type UserStatus } from '../models/user';
import type { UserRepository } from '../repositories/types';
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from '../utils/errors';
import { makeId, nowIso } from '../utils/ids';
import type { Logger } from '../utils/logger';
import type { Page, PageRequest } from '../utils/pagination';
import { constantTimeEqualsSecret, hashPassword, signSessionToken, verifyPassword } from '../utils/token';
import type { AuditService } from './auditService';

function initialsFor(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || 'KR'
  );
}

export interface AuthSessionResponse {
  token: string;
  user: PublicUserAccount;
}

export class AuthService {
  constructor(
    private users: UserRepository,
    private audit: AuditService,
  ) {}

  async getBootstrapStatus(): Promise<{ adminSetupRequired: boolean; adminEmailHint: string }> {
    const envPasscode = process.env.ADMIN_PASSCODE?.trim();
    const envEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() || 'admin@krishi360.in';
    if (envPasscode) {
      return { adminSetupRequired: false, adminEmailHint: envEmail };
    }
    const admins = await this.users.list({ limit: 20 }, 'admin');
    const hasConfiguredAdmin = admins.items.some((a) => Boolean(a.passwordHash) && a.status === 'active');
    return { adminSetupRequired: !hasConfiguredAdmin, adminEmailHint: envEmail };
  }

  async setupInitialAdmin(
    input: { name: string; email: string; password: string },
    logger: Logger,
  ): Promise<AuthSessionResponse> {
    const status = await this.getBootstrapStatus();
    if (!status.adminSetupRequired) {
      throw new ConflictError('Administrator account is already configured. Sign in using the staff panel.');
    }

    const email = input.email.trim().toLowerCase();
    const existing = await this.users.getByEmail(email);
    if (existing && existing.role !== 'admin') {
      throw new ConflictError('An account with this email already exists under another role.');
    }

    const now = nowIso();
    const adminUser: UserAccount = existing
      ? {
          ...existing,
          name: input.name.trim(),
          status: 'active',
          avatar: initialsFor(input.name),
          passwordHash: hashPassword(input.password),
          updatedAt: now,
          version: existing.version + 1,
        }
      : {
          id: 'admin-001',
          email,
          name: input.name.trim(),
          role: 'admin',
          location: 'Platform Operations',
          phone: 'Not provided',
          status: 'active',
          avatar: initialsFor(input.name),
          organisation: 'KRISHI360 AI Operations',
          specialisation: 'Platform administration',
          joinedAt: now.slice(0, 10),
          passwordHash: hashPassword(input.password),
          createdAt: now,
          updatedAt: now,
          version: 1,
        };

    if (existing) {
      await this.users.update(adminUser, existing.version);
    } else {
      await this.users.create(adminUser);
    }

    await this.audit.record(
      logger,
      { id: adminUser.id, role: 'admin', name: adminUser.name, email: adminUser.email, groups: ['admin'] },
      'auth.admin_bootstrapped',
      adminUser.id,
    );

    const token = signSessionToken({
      sub: adminUser.id,
      role: 'admin',
      name: adminUser.name,
      email: adminUser.email,
    });
    return { token, user: toPublicUser(adminUser) };
  }

  async registerFarmer(
    input: { name: string; email: string; password: string; location: string; phone?: string },
    logger: Logger,
  ): Promise<AuthSessionResponse> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.users.getByEmail(email);
    if (existing) {
      throw new ConflictError('An account with this email is already registered.');
    }

    const now = nowIso();
    const user: UserAccount = {
      id: makeId('farmer'),
      email,
      name: input.name.trim(),
      role: 'farmer',
      location: input.location.trim() || 'India',
      phone: input.phone?.trim() || 'Not provided',
      status: 'active',
      avatar: initialsFor(input.name),
      joinedAt: now.slice(0, 10),
      passwordHash: hashPassword(input.password),
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
    await this.users.create(user);

    await this.audit.record(
      logger,
      { id: user.id, role: 'farmer', name: user.name, email: user.email, groups: ['farmer'] },
      'auth.farmer_registered',
      user.id,
    );

    const token = signSessionToken({
      sub: user.id,
      role: 'farmer',
      name: user.name,
      email: user.email,
    });
    return { token, user: toPublicUser(user) };
  }

  async loginFarmer(input: { email: string; password: string }, logger: Logger): Promise<AuthSessionResponse> {
    const email = input.email.trim().toLowerCase();
    const user = await this.users.getByEmail(email);
    if (!user || user.role !== 'farmer' || !verifyPassword(input.password, user.passwordHash)) {
      throw new UnauthorizedError('Invalid farmer email or password.');
    }
    if (user.status === 'suspended') {
      throw new ForbiddenError('This farmer account is currently suspended.');
    }

    await this.audit.record(
      logger,
      { id: user.id, role: 'farmer', name: user.name, email: user.email, groups: ['farmer'] },
      'auth.farmer_logged_in',
      user.id,
    );

    const token = signSessionToken({
      sub: user.id,
      role: 'farmer',
      name: user.name,
      email: user.email,
    });
    return { token, user: toPublicUser(user) };
  }

  async loginStaff(
    input: { email: string; password: string; role: 'expert' | 'admin' },
    logger: Logger,
  ): Promise<AuthSessionResponse> {
    const email = input.email.trim().toLowerCase();

    if (input.role === 'admin') {
      const envPasscode = process.env.ADMIN_PASSCODE?.trim();
      const envAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() || 'admin@krishi360.in';
      const existing = await this.users.getByEmail(email);

      if (envPasscode) {
        const emailMatches = email === envAdminEmail || existing?.role === 'admin';
        if (!emailMatches || !constantTimeEqualsSecret(input.password, envPasscode)) {
          throw new UnauthorizedError('Invalid administrator email or passcode.');
        }
        const now = nowIso();
        const adminAccount: UserAccount = existing && existing.role === 'admin'
          ? existing
          : {
              id: 'admin-001',
              email,
              name: 'Administrator',
              role: 'admin',
              location: 'Platform Operations',
              phone: 'Not provided',
              status: 'active',
              avatar: 'AD',
              organisation: 'KRISHI360 AI Operations',
              specialisation: 'Platform administration',
              joinedAt: now.slice(0, 10),
              createdAt: now,
              updatedAt: now,
              version: 1,
            };
        if (!existing) await this.users.create(adminAccount);
        const token = signSessionToken({
          sub: adminAccount.id,
          role: 'admin',
          name: adminAccount.name,
          email: adminAccount.email,
        });
        await this.audit.record(
          logger,
          { id: adminAccount.id, role: 'admin', name: adminAccount.name, email: adminAccount.email, groups: ['admin'] },
          'auth.admin_logged_in',
          adminAccount.id,
        );
        return { token, user: toPublicUser(adminAccount) };
      }

      if (!existing || existing.role !== 'admin' || !verifyPassword(input.password, existing.passwordHash)) {
        throw new UnauthorizedError('Invalid administrator email or password.');
      }
      if (existing.status === 'suspended') {
        throw new ForbiddenError('This administrator account is suspended.');
      }
      const token = signSessionToken({
        sub: existing.id,
        role: 'admin',
        name: existing.name,
        email: existing.email,
      });
      await this.audit.record(
        logger,
        { id: existing.id, role: 'admin', name: existing.name, email: existing.email, groups: ['admin'] },
        'auth.admin_logged_in',
        existing.id,
      );
      return { token, user: toPublicUser(existing) };
    }

    // Crop Expert direct login
    const expert = await this.users.getByEmail(email);
    if (!expert || expert.role !== 'expert' || !verifyPassword(input.password, expert.passwordHash)) {
      throw new UnauthorizedError('Invalid crop expert email or password.');
    }
    if (expert.status === 'suspended') {
      throw new ForbiddenError('This crop expert account is currently suspended.');
    }

    await this.audit.record(
      logger,
      { id: expert.id, role: 'expert', name: expert.name, email: expert.email, groups: ['expert'] },
      'auth.expert_logged_in',
      expert.id,
    );

    const token = signSessionToken({
      sub: expert.id,
      role: 'expert',
      name: expert.name,
      email: expert.email,
    });
    return { token, user: toPublicUser(expert) };
  }

  async getUserProfile(userId: string): Promise<PublicUserAccount | null> {
    const found = await this.users.get(userId);
    return found ? toPublicUser(found) : null;
  }

  async updateOwnProfile(
    actor: AuthUser,
    patch: {
      name?: string;
      location?: string;
      phone?: string;
      specialisation?: string;
      organisation?: string;
    },
    logger: Logger,
  ): Promise<PublicUserAccount> {
    const existing = await this.users.get(actor.id);
    if (!existing) throw new NotFoundError('User profile not found.');
    const nextName = patch.name?.trim() || existing.name;
    const updated: UserAccount = {
      ...existing,
      name: nextName,
      avatar: initialsFor(nextName),
      ...(patch.location !== undefined ? { location: patch.location.trim() } : {}),
      ...(patch.phone !== undefined ? { phone: patch.phone.trim() } : {}),
      ...(patch.specialisation !== undefined ? { specialisation: patch.specialisation.trim() } : {}),
      ...(patch.organisation !== undefined ? { organisation: patch.organisation.trim() } : {}),
      updatedAt: nowIso(),
      version: existing.version + 1,
    };
    await this.users.update(updated, existing.version);
    await this.audit.record(logger, actor, 'auth.profile_updated', actor.id);
    return toPublicUser(updated);
  }

  async listUsers(page: PageRequest, role?: Role): Promise<Page<PublicUserAccount>> {
    const res = await this.users.list(page, role);
    return {
      items: res.items.map(toPublicUser),
      nextToken: res.nextToken,
    };
  }

  async createUserByAdmin(
    actor: AuthUser,
    input: {
      name: string;
      email: string;
      password: string;
      role: Role;
      location: string;
      phone: string;
      specialisation?: string;
      organisation?: string;
    },
    logger: Logger,
  ): Promise<PublicUserAccount> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.users.getByEmail(email);
    if (existing) {
      throw new ConflictError('An account with this email already exists.');
    }

    const now = nowIso();
    const user: UserAccount = {
      id: makeId(input.role),
      email,
      name: input.name.trim(),
      role: input.role,
      location: input.location.trim(),
      phone: input.phone.trim(),
      status: 'active',
      avatar: initialsFor(input.name),
      specialisation: input.specialisation?.trim() || undefined,
      organisation: input.organisation?.trim() || (input.role === 'expert' ? 'KRISHI360 Expert Advisory' : undefined),
      joinedAt: now.slice(0, 10),
      passwordHash: hashPassword(input.password),
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    await this.users.create(user);
    await this.audit.record(logger, actor, 'admin.user_created', user.id, {
      role: user.role,
      email: user.email,
    });
    return toPublicUser(user);
  }

  async updateUserStatus(
    actor: AuthUser,
    userId: string,
    status: UserStatus,
    logger: Logger,
  ): Promise<PublicUserAccount> {
    const existing = await this.users.get(userId);
    if (!existing) throw new NotFoundError('User account not found.');
    const updated: UserAccount = {
      ...existing,
      status,
      updatedAt: nowIso(),
      version: existing.version + 1,
    };
    await this.users.update(updated, existing.version);
    await this.audit.record(logger, actor, 'admin.user_status_updated', userId, { status });
    return toPublicUser(updated);
  }
}
