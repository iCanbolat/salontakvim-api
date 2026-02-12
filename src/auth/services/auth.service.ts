import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { UserRepository } from '../repositories/user.repository';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import { PasswordResetRepository } from '../repositories/password-reset.repository';
import { RegisterDto, LoginDto, SocialAuthDto } from '../dto/auth.dto';
import {
  AuthResponse,
  JwtPayload,
  RefreshTokenPayload,
} from '../interfaces/auth.interface';
import {
  InvalidCredentialsException,
  EmailAlreadyExistsException,
  UserNotFoundException,
  InvalidRefreshTokenException,
  InactiveAccountException,
  InvalidSocialAuthException,
  InvalidPasswordResetTokenException,
} from '../exceptions';
import { StoreService } from '../../stores/services/store.service';
import { StoreSlugAlreadyExistsException } from '../../stores/exceptions';
import { StaffMemberRepository } from '../../staff/repositories/staff-member.repository';
import { NotificationService } from '../../notifications/services/notification.service';

@Injectable()
export class AuthService {
  constructor(
    private userRepository: UserRepository,
    private refreshTokenRepository: RefreshTokenRepository,
    private passwordResetRepository: PasswordResetRepository,
    private jwtService: JwtService,
    private configService: ConfigService,
    private storeService: StoreService,
    private staffMemberRepository: StaffMemberRepository,
    private notificationService: NotificationService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(
      registerDto.email,
    );
    if (existingUser) {
      throw new EmailAlreadyExistsException(registerDto.email);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // Create user (default role: admin)
    const user = await this.userRepository.create({
      email: registerDto.email,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      phone: registerDto.phone,
      password: hashedPassword,
      role: 'admin', // Default
      authProvider: registerDto.authProvider || 'local',
      providerId: registerDto.providerId,
      avatar: registerDto.avatar,
      emailVerified: false,
    });

    // Create store for the new admin user
    const store = await this.createStoreForUser(user.id, {
      name: registerDto.storeName,
      slug: registerDto.storeSlug,
    });

    // Optionally create staff profile for the owner
    if (registerDto.createStaffProfile) {
      await this.staffMemberRepository.create({
        userId: user.id,
        storeId: store.id,
        title: registerDto.staffTitle || null,
        bio: registerDto.staffBio || null,
        isVisible:
          typeof registerDto.staffIsVisible === 'boolean'
            ? registerDto.staffIsVisible
            : true,
      });
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    // Find user
    const user = await this.userRepository.findByEmail(loginDto.email);
    if (!user) {
      throw new InvalidCredentialsException();
    }

    // Check if account is active
    if (!user.isActive) {
      throw new InactiveAccountException();
    }

    // Verify password
    if (!user.password) {
      throw new InvalidSocialAuthException(
        user.authProvider || 'social',
        'Bu hesap sosyal giriş kullanıyor',
      );
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new InvalidCredentialsException();
    }

    // Update last login
    await this.userRepository.updateLastLogin(user.id);

    // Check if user has a store (needs onboarding if not)
    const store = await this.storeService.findByOwnerIdSafe(user.id);
    const needsOnboarding = !store && user.role === 'admin';

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      user: this.sanitizeUser(user),
      needsOnboarding,
      ...tokens,
    };
  }

  async socialAuth(socialAuthDto: SocialAuthDto): Promise<AuthResponse> {
    // Check if user exists with this provider ID
    let user = await this.userRepository.findByProviderId(
      socialAuthDto.providerId,
      socialAuthDto.provider,
    );

    let isNewUser = false;

    if (!user) {
      // Check if email already exists with different provider
      const existingUser = await this.userRepository.findByEmail(
        socialAuthDto.email,
      );
      if (existingUser) {
        throw new EmailAlreadyExistsException(socialAuthDto.email);
      }

      isNewUser = true;

      // Create new user
      user = await this.userRepository.create({
        email: socialAuthDto.email,
        firstName: socialAuthDto.firstName,
        lastName: socialAuthDto.lastName,
        authProvider: socialAuthDto.provider,
        providerId: socialAuthDto.providerId,
        avatar: socialAuthDto.avatar,
        role: 'admin',
        emailVerified: true, // Social accounts are pre-verified
      });
    }

    // Update last login
    await this.userRepository.updateLastLogin(user.id);

    // Check if user has a store (needs onboarding if not)
    const store = await this.storeService.findByOwnerIdSafe(user.id);
    const needsOnboarding = !store;

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      user: this.sanitizeUser(user),
      needsOnboarding,
      ...tokens,
    };
  }

  async refreshTokens(refreshToken: string): Promise<AuthResponse> {
    // Find refresh token in database
    const tokenRecord =
      await this.refreshTokenRepository.findByToken(refreshToken);
    if (!tokenRecord) {
      throw new InvalidRefreshTokenException();
    }

    // Check if token is expired
    if (new Date() > tokenRecord.expiresAt) {
      await this.refreshTokenRepository.deleteByToken(refreshToken);
      throw new InvalidRefreshTokenException();
    }

    // Get user
    const user = await this.userRepository.findById(tokenRecord.userId);
    if (!user || !user.isActive) {
      throw new UserNotFoundException(tokenRecord.userId.toString());
    }

    // Delete old refresh token
    await this.refreshTokenRepository.deleteByToken(refreshToken);

    // Generate new tokens
    const tokens = await this.generateTokens(user);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.refreshTokenRepository.deleteByToken(refreshToken);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.refreshTokenRepository.deleteAllByUserId(userId);
  }

  async getProfile(userId: string): Promise<{ user: any; hasStore: boolean }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundException(userId.toString());
    }

    // Check if user has a store
    const store = await this.storeService.findByOwnerIdSafe(userId);

    // Get locationId and storeId for manager/staff roles
    let locationId: string | null = null;
    let staffStoreId: string | null = null;
    if (user.role === 'manager' || user.role === 'staff') {
      const staffMember = await this.staffMemberRepository.findByUserId(userId);
      if (staffMember) {
        locationId = staffMember.locationId;
        staffStoreId = staffMember.storeId;
      }
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
        authProvider: user.authProvider,
        providerId: user.providerId,
        avatar: user.avatar,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        locationId,
        storeId: staffStoreId,
      },
      hasStore: !!store,
    };
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.userRepository.findByEmail(email);

    if (!user || !user.isActive || !user.password) {
      return;
    }

    const latestToken = await this.passwordResetRepository.findLatestByUserId(
      user.id,
    );
    if (latestToken) {
      const cooldownSeconds = this.getPasswordResetCooldownSeconds();
      const ageSeconds = Math.floor(
        (Date.now() - latestToken.createdAt.getTime()) / 1000,
      );

      if (ageSeconds < cooldownSeconds) {
        return;
      }
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = this.getPasswordResetExpiry();

    await this.passwordResetRepository.deleteByUserId(user.id);
    await this.passwordResetRepository.create({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;
    const userName = [user.firstName, user.lastName].filter(Boolean).join(' ');
    const storeId = await this.resolveUserStoreId(user.id, user.role);

    await this.notificationService.sendPasswordReset(
      user.email,
      {
        userName: userName || user.email,
        resetLink,
      },
      storeId,
    );
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const record =
      await this.passwordResetRepository.findByTokenHash(tokenHash);

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new InvalidPasswordResetTokenException();
    }

    const user = await this.userRepository.findById(record.userId);
    if (!user || !user.isActive) {
      throw new InvalidPasswordResetTokenException();
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.userRepository.update(user.id, { password: hashedPassword });
    await this.passwordResetRepository.markUsed(record.id);
    await this.refreshTokenRepository.deleteAllByUserId(user.id);
  }

  async verifyPasswordResetToken(token: string): Promise<{
    valid: boolean;
    expiresAt?: string;
  }> {
    if (!token) {
      return { valid: false };
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const record =
      await this.passwordResetRepository.findByTokenHash(tokenHash);

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return { valid: false };
    }

    return {
      valid: true,
      expiresAt: record.expiresAt.toISOString(),
    };
  }

  private getPasswordResetExpiry() {
    const minutes = Number(
      this.configService.get<string>(
        'PASSWORD_RESET_TOKEN_EXPIRATION_MINUTES',
        '60',
      ),
    );

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + Math.max(1, minutes));
    return expiresAt;
  }

  private getPasswordResetCooldownSeconds() {
    const seconds = Number(
      this.configService.get<string>('PASSWORD_RESET_COOLDOWN_SECONDS', '60'),
    );
    return Math.max(10, seconds || 60);
  }

  private async resolveUserStoreId(userId: string, role?: string) {
    if (role === 'admin') {
      const store = await this.storeService.findByOwnerIdSafe(userId);
      return store?.id || null;
    }

    if (role === 'manager' || role === 'staff') {
      const staffMember = await this.staffMemberRepository.findByUserId(userId);
      return staffMember?.storeId || null;
    }

    return null;
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userRepository.findByEmail(email);
    if (!user || !user.password) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  private async generateTokens(user: any): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    // Generate access token
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_ACCESS_TOKEN_EXPIRATION', '15m'),
    });

    // Generate refresh token
    const refreshToken = this.jwtService.sign(
      { sub: user.id },
      {
        secret: this.configService.get('JWT_REFRESH_TOKEN_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_TOKEN_EXPIRATION', '7d'),
      },
    );

    // Save refresh token to database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
    await this.refreshTokenRepository.create(user.id, refreshToken, expiresAt);

    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      avatar: user.avatar,
    };
  }

  private slugify(input: string): string {
    const slug = input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');

    if (slug.length >= 3) return slug;

    return `store-${Math.random().toString(36).slice(2, 8)}`;
  }

  private async createStoreForUser(
    userId: string,
    store: { name: string; slug?: string },
  ) {
    const baseSlug = store.slug?.trim() || this.slugify(store.name);
    const attempts = [
      baseSlug,
      `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`,
      `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`,
    ];

    for (const slug of attempts) {
      try {
        return await this.storeService.create(userId, {
          name: store.name,
          slug,
        });
      } catch (error) {
        if (error instanceof StoreSlugAlreadyExistsException) {
          continue;
        }
        throw error;
      }
    }

    // If all attempts failed due to slug conflict, rethrow a conflict error
    throw new StoreSlugAlreadyExistsException(baseSlug);
  }
}
