import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaymentsService } from './payments.service';
import {
  CreateConnectOnboardingDto,
  CreateSubscriptionCheckoutDto,
} from './dto';
import type { JwtPayload } from '../auth/interfaces/auth.interface';
import type { Request } from 'express';

@Controller('billing')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

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
}
