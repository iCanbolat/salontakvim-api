import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaymentsService } from './payments.service';
import {
  CreateConnectOnboardingDto,
  CreateSubscriptionCheckoutDto,
  UpdateConnectStatusDto,
} from './dto';
import type { JwtPayload } from '../auth/interfaces/auth.interface';
import type { Request } from 'express';

@Controller('billing')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('creem/webhook')
  @Public()
  async handleCreemWebhook(
    @Headers('creem-signature') signature: string | undefined,
    @Req() request: Request & { rawBody?: Buffer },
  ) {
    await this.paymentsService.handleCreemWebhook(signature, request.rawBody);
    return { received: true };
  }

  @Post('stripe/webhook')
  @Public()
  async handleStripeWebhook(
    @Headers('stripe-signature') signature: string | undefined,
    @Req() request: Request & { rawBody?: Buffer },
  ) {
    await this.paymentsService.handleStripeWebhook(signature, request.rawBody);
    return { received: true };
  }

  @Post('subscriptions/checkout-session')
  @Roles('admin')
  async createSubscriptionCheckoutSession(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateSubscriptionCheckoutDto,
  ) {
    return this.paymentsService.createSubscriptionCheckoutSession(
      dto.storeId,
      user.sub,
      dto.successUrl,
      dto.cancelUrl,
      dto.plan,
      dto.billingCycle,
    );
  }

  @Post('connect/onboarding-link')
  @Roles('admin')
  async createConnectOnboardingLink(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateConnectOnboardingDto,
  ) {
    return this.paymentsService.createConnectOnboardingLink(
      dto.storeId,
      user.sub,
      dto.refreshUrl,
      dto.returnUrl,
    );
  }

  @Get('connect/status/:storeId')
  @Roles('admin')
  async getConnectStatus(
    @CurrentUser() user: JwtPayload,
    @Param('storeId', ParseUUIDPipe) storeId: string,
  ) {
    return this.paymentsService.getConnectStatus(storeId, user.sub);
  }

  @Patch('connect/status/:storeId')
  @Roles('admin')
  async updateConnectStatus(
    @CurrentUser() user: JwtPayload,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: UpdateConnectStatusDto,
  ) {
    return this.paymentsService.updateConnectStatus(
      storeId,
      user.sub,
      dto.onboardingComplete,
      dto.accountId,
    );
  }

  @Get('stores/:storeId/payouts')
  @Roles('admin')
  async getStorePayouts(
    @CurrentUser() user: JwtPayload,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedPage = page ? Number.parseInt(page, 10) : undefined;
    const parsedLimit = limit ? Number.parseInt(limit, 10) : undefined;

    return this.paymentsService.getStorePayouts(storeId, user.sub, {
      status: status?.trim()
        ? (status.trim() as 'pending' | 'paid')
        : undefined,
      page:
        typeof parsedPage === 'number' && Number.isFinite(parsedPage)
          ? parsedPage
          : undefined,
      limit:
        typeof parsedLimit === 'number' && Number.isFinite(parsedLimit)
          ? parsedLimit
          : undefined,
    });
  }

  @Patch('stores/:storeId/payouts/:payoutId/mark-paid')
  @Roles('admin')
  async markStorePayoutPaid(
    @CurrentUser() user: JwtPayload,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('payoutId', ParseUUIDPipe) payoutId: string,
  ) {
    return this.paymentsService.markStorePayoutPaid(
      storeId,
      user.sub,
      payoutId,
    );
  }
}
