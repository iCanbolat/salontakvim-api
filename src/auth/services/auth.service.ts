import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UserRepository } from '../repositories/user.repository';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';
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
} from '../exceptions';

@Injectable()
export class AuthService {
  constructor(
    private userRepository: UserRepository,
    private refreshTokenRepository: RefreshTokenRepository,
    private jwtService: JwtService,
    private configService: ConfigService,
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

    // Create user (default role: admin, paymentStatus: freemium)
    const user = await this.userRepository.create({
      email: registerDto.email,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      phone: registerDto.phone,
      password: hashedPassword,
      role: 'admin', // Default
      paymentStatus: 'freemium', // Default
      authProvider: registerDto.authProvider || 'local',
      providerId: registerDto.providerId,
      avatar: registerDto.avatar,
      emailVerified: false,
    });

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

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async socialAuth(socialAuthDto: SocialAuthDto): Promise<AuthResponse> {
    // Check if user exists with this provider ID
    let user = await this.userRepository.findByProviderId(
      socialAuthDto.providerId,
      socialAuthDto.provider,
    );

    if (!user) {
      // Check if email already exists with different provider
      const existingUser = await this.userRepository.findByEmail(
        socialAuthDto.email,
      );
      if (existingUser) {
        throw new EmailAlreadyExistsException(socialAuthDto.email);
      }

      // Create new user
      user = await this.userRepository.create({
        email: socialAuthDto.email,
        firstName: socialAuthDto.firstName,
        lastName: socialAuthDto.lastName,
        authProvider: socialAuthDto.provider,
        providerId: socialAuthDto.providerId,
        avatar: socialAuthDto.avatar,
        role: 'admin',
        paymentStatus: 'freemium',
        emailVerified: true, // Social accounts are pre-verified
      });
    }

    // Update last login
    await this.userRepository.updateLastLogin(user.id);

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      user: this.sanitizeUser(user),
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

  async logoutAll(userId: number): Promise<void> {
    await this.refreshTokenRepository.deleteAllByUserId(userId);
  }

  async getProfile(userId: number): Promise<{ user: any }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundException(userId.toString());
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
        paymentStatus: user.paymentStatus,
        authProvider: user.authProvider,
        providerId: user.providerId,
        avatar: user.avatar,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
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
      paymentStatus: user.paymentStatus,
      avatar: user.avatar,
    };
  }
}
