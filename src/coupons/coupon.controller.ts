import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CouponService } from './services/coupon.service';
import { CreateCouponDto, UpdateCouponDto, BulkAssignCouponDto } from './dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { JwtPayload } from '../auth/interfaces/auth.interface';

@Controller('stores/:storeId/coupons')
export class CouponController {
  constructor(private readonly couponService: CouponService) {}

  @Post()
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateCouponDto,
  ) {
    return this.couponService.create(storeId, user.sub, dto);
  }

  @Get()
  @Roles('admin', 'manager')
  async findAll(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @CurrentUser() user: JwtPayload,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
    @Query('includeExpired') includeExpired?: string,
  ) {
    return this.couponService.findAll(storeId, user.sub, {
      search,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      includeExpired: includeExpired === 'true',
    });
  }

  @Get(':couponId')
  @Roles('admin', 'manager')
  async findById(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('couponId', ParseUUIDPipe) couponId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.couponService.findById(storeId, couponId, user.sub);
  }

  @Patch(':couponId')
  @Roles('admin', 'manager')
  async update(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('couponId', ParseUUIDPipe) couponId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateCouponDto,
  ) {
    return this.couponService.update(storeId, couponId, user.sub, dto);
  }

  @Delete(':couponId')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('couponId', ParseUUIDPipe) couponId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.couponService.delete(storeId, couponId, user.sub);
  }

  // Assign coupon to customers
  @Post(':couponId/assign')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.CREATED)
  async assignToCustomers(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('couponId', ParseUUIDPipe) couponId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: BulkAssignCouponDto,
  ) {
    return this.couponService.assignToCustomers(
      storeId,
      couponId,
      dto.customerIds,
      user.sub,
      dto.notifyCustomers,
    );
  }

  // Get coupon assignments
  @Get(':couponId/assignments')
  @Roles('admin', 'manager')
  async getCouponAssignments(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('couponId', ParseUUIDPipe) couponId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.couponService.getCouponAssignments(storeId, couponId, user.sub);
  }

  // Remove customer from coupon
  @Delete(':couponId/assignments/:customerId')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeCustomerCoupon(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('couponId', ParseUUIDPipe) couponId: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.couponService.removeCustomerCoupon(
      storeId,
      couponId,
      customerId,
      user.sub,
    );
  }

  // Get customer's coupons
  @Get('customer/:customerId')
  @Roles('admin', 'manager')
  async getCustomerCoupons(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.couponService.getCustomerCoupons(storeId, customerId, user.sub);
  }

  // Validate coupon (for widget/booking)
  // @Post('validate')
  // @Roles('admin', 'staff', 'customer')
  // async validateCoupon(
  //   @Param('storeId', ParseUUIDPipe) storeId: string,
  //   @Body()
  //   body: {
  //     code: string;
  //     customerId?: string;
  //     serviceId?: string;
  //     amount?: number;
  //   },
  // ) {
  //   return this.couponService.validateCoupon(
  //     storeId,
  //     body.code,
  //     body.customerId,
  //     body.serviceId,
  //     body.amount,
  //   );
  // }
}
