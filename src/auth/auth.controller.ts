import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Get,
  Req,
  Res,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './services/auth.service';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  SocialAuthDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('social-auth')
  @HttpCode(HttpStatus.OK)
  async socialAuth(@Body() socialAuthDto: SocialAuthDto) {
    return this.authService.socialAuth(socialAuthDto);
  }

  // Google OAuth - Initiate
  @Public()
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth() {
    // Guard redirects to Google
  }

  // Google OAuth - Callback
  @Public()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    const googleUser = req.user as {
      providerId: string;
      email: string;
      firstName: string;
      lastName?: string;
      avatar?: string;
    };

    const authResponse = await this.authService.socialAuth({
      providerId: googleUser.providerId,
      email: googleUser.email,
      firstName: googleUser.firstName,
      lastName: googleUser.lastName,
      avatar: googleUser.avatar,
      provider: 'google',
    });

    // Redirect to frontend with tokens
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const params = new URLSearchParams({
      accessToken: authResponse.accessToken,
      refreshToken: authResponse.refreshToken,
      needsOnboarding: authResponse.needsOnboarding ? 'true' : 'false',
      requiresSubscription: authResponse.requiresSubscription
        ? 'true'
        : 'false',
    });

    if (authResponse.trialEndsAt) {
      params.set('trialEndsAt', authResponse.trialEndsAt);
    }

    return res.redirect(`${frontendUrl}/auth/callback?${params.toString()}`);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshTokens(refreshTokenDto.refreshToken);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.requestPasswordReset(dto.email);
    return {
      message: 'If the account exists, a reset link will be sent shortly.',
    };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.password);
    return { message: 'Password updated successfully' };
  }

  @Public()
  @Get('reset-password/verify')
  async verifyResetToken(@Query('token') token?: string) {
    const status = await this.authService.verifyPasswordResetToken(token || '');
    return status;
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() refreshTokenDto: RefreshTokenDto) {
    await this.authService.logout(refreshTokenDto.refreshToken);
    return { message: 'Logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(@CurrentUser('sub') userId: string) {
    await this.authService.logoutAll(userId);
    return { message: 'Logged out from all devices successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@CurrentUser('sub') userId: string) {
    // Fetch full user from database
    return this.authService.getProfile(userId);
  }
}
