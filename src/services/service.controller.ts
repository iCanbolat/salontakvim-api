import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ServiceService } from './services/service.service';
import {
  CreateServiceDto,
  UpdateServiceDto,
  ServiceResponseDto,
  CreateServiceExtraDto,
  UpdateServiceExtraDto,
  ServiceExtraResponseDto,
} from './dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import type { JwtPayload } from '../auth/interfaces/auth.interface';

@Controller('stores/:storeId/services')
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  // Services endpoints
  @Post()
  @Roles('admin', 'staff')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('storeId', ParseIntPipe) storeId: number,
    @CurrentUser() user: JwtPayload,
    @Body() createServiceDto: CreateServiceDto,
  ): Promise<ServiceResponseDto> {
    return this.serviceService.create(storeId, user.sub, createServiceDto);
  }

  @Get()
  @Roles('admin', 'staff')
  async findAll(
    @Param('storeId', ParseIntPipe) storeId: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<ServiceResponseDto[]> {
    return this.serviceService.findAll(storeId, user.sub);
  }

  @Get('visible')
  @Public()
  async findVisible(
    @Param('storeId', ParseIntPipe) storeId: number,
  ): Promise<ServiceResponseDto[]> {
    return this.serviceService.findVisible(storeId);
  }

  @Get(':id')
  @Roles('admin', 'staff')
  async findOne(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<ServiceResponseDto> {
    return this.serviceService.findOne(storeId, id, user.sub);
  }

  @Patch(':id')
  @Roles('admin', 'staff')
  async update(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @Body() updateServiceDto: UpdateServiceDto,
  ): Promise<ServiceResponseDto> {
    return this.serviceService.update(storeId, id, user.sub, updateServiceDto);
  }

  @Delete(':id')
  @Roles('admin', 'staff')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.serviceService.remove(storeId, id, user.sub);
  }

  // Service Extras endpoints
  @Post(':id/extras')
  @Roles('admin', 'staff')
  @HttpCode(HttpStatus.CREATED)
  async createExtra(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('id', ParseIntPipe) serviceId: number,
    @CurrentUser() user: JwtPayload,
    @Body() createExtraDto: CreateServiceExtraDto,
  ): Promise<ServiceExtraResponseDto> {
    return this.serviceService.createExtra(
      storeId,
      serviceId,
      user.sub,
      createExtraDto,
    );
  }

  @Get(':id/extras')
  @Roles('admin', 'staff')
  async findAllExtras(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('id', ParseIntPipe) serviceId: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<ServiceExtraResponseDto[]> {
    return this.serviceService.findAllExtras(storeId, serviceId, user.sub);
  }

  @Patch(':id/extras/:extraId')
  @Roles('admin', 'staff')
  async updateExtra(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('id', ParseIntPipe) serviceId: number,
    @Param('extraId', ParseIntPipe) extraId: number,
    @CurrentUser() user: JwtPayload,
    @Body() updateExtraDto: UpdateServiceExtraDto,
  ): Promise<ServiceExtraResponseDto> {
    return this.serviceService.updateExtra(
      storeId,
      serviceId,
      extraId,
      user.sub,
      updateExtraDto,
    );
  }

  @Delete(':id/extras/:extraId')
  @Roles('admin', 'staff')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeExtra(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('id', ParseIntPipe) serviceId: number,
    @Param('extraId', ParseIntPipe) extraId: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.serviceService.removeExtra(
      storeId,
      serviceId,
      extraId,
      user.sub,
    );
  }
}
