import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DrizzleModule } from './db/drizzle.module';
import { AuthModule } from './auth/auth.module';
import { StoreModule } from './stores/store.module';
import { CategoryModule } from './categories/category.module';
import { LocationModule } from './locations/location.module';
import { ServiceModule } from './services/service.module';
import { StaffModule } from './staff/staff.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { WidgetModule } from './widget/widget.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DrizzleModule,
    AuthModule,
    StoreModule,
    CategoryModule,
    LocationModule,
    ServiceModule,
    StaffModule,
    AppointmentsModule,
    WidgetModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
