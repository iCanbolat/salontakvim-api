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
import { LocationService } from './services/location.service';
import {
  CreateLocationDto,
  UpdateLocationDto,
  LocationResponseDto,
} from './dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import type { JwtPayload } from '../auth/interfaces/auth.interface';

@Controller('stores/:storeId/locations')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Post()
  @Roles('admin', 'staff')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('storeId', ParseIntPipe) storeId: number,
    @CurrentUser() user: JwtPayload,
    @Body() createLocationDto: CreateLocationDto,
  ): Promise<LocationResponseDto> {
    return this.locationService.create(storeId, user.sub, createLocationDto);
  }

  @Get()
  @Roles('admin', 'staff')
  async findAll(
    @Param('storeId', ParseIntPipe) storeId: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<LocationResponseDto[]> {
    return this.locationService.findAll(storeId, user.sub);
  }

  @Get('visible')
  @Public()
  async findVisible(
    @Param('storeId', ParseIntPipe) storeId: number,
  ): Promise<LocationResponseDto[]> {
    return this.locationService.findVisible(storeId);
  }

  @Get(':id')
  @Roles('admin', 'staff')
  async findOne(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<LocationResponseDto> {
    return this.locationService.findOne(storeId, id, user.sub);
  }

  @Patch(':id')
  @Roles('admin', 'staff')
  async update(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @Body() updateLocationDto: UpdateLocationDto,
  ): Promise<LocationResponseDto> {
    return this.locationService.update(
      storeId,
      id,
      user.sub,
      updateLocationDto,
    );
  }

  @Delete(':id')
  @Roles('admin', 'staff')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.locationService.remove(storeId, id, user.sub);
  }
}
