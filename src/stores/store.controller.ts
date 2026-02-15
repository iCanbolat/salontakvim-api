import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { StoreService } from './services/store.service';
import {
  CreateStoreDto,
  UpdateStoreDto,
  StoreResponseDto,
  SendBulkSmsDto,
} from './dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { JwtPayload } from '../auth/interfaces/auth.interface';

@Controller('stores')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  @Post()
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() createStoreDto: CreateStoreDto,
  ): Promise<StoreResponseDto> {
    return this.storeService.create(user.sub, createStoreDto);
  }

  @Get('my-store')
  @Roles('admin', 'manager', 'staff')
  async getMyStore(@CurrentUser() user: JwtPayload): Promise<StoreResponseDto> {
    return this.storeService.findMyStore(user.sub);
  }

  @Get(':id')
  @Roles('admin', 'manager', 'staff')
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<StoreResponseDto> {
    return this.storeService.findById(id, user.sub);
  }

  @Get('slug/:slug')
  @Roles('admin', 'manager', 'staff')
  async findBySlug(@Param('slug') slug: string): Promise<StoreResponseDto> {
    return this.storeService.findBySlug(slug);
  }

  @Patch(':id')
  @Roles('admin')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() updateStoreDto: UpdateStoreDto,
  ): Promise<StoreResponseDto> {
    return this.storeService.update(id, user.sub, updateStoreDto);
  }

  @Delete(':id/deactivate')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.storeService.deactivate(id, user.sub);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.storeService.delete(id, user.sub);
  }

  @Get(':id/analytics')
  @Roles('admin')
  async getAnalytics(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{
    totalAppointments: number;
    totalCustomers: number;
  }> {
    return this.storeService.getAnalytics(id, user.sub);
  }

  @Get(':storeId/customers')
  @Roles('admin', 'manager', 'staff')
  async getCustomers(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @CurrentUser() user: JwtPayload,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.storeService.getCustomers(storeId, user, {
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':storeId/customers/:customerId')
  @Roles('admin', 'manager', 'staff')
  async getCustomerProfile(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.storeService.getCustomerProfile(storeId, customerId, user);
  }

  @Post(':storeId/customers/sms')
  @Roles('admin', 'manager', 'staff')
  async sendBulkSms(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: SendBulkSmsDto,
  ) {
    return this.storeService.sendBulkSms(
      storeId,
      user,
      dto.customerIds,
      dto.message,
    );
  }
}
