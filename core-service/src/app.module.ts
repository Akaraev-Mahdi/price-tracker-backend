import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { RmqModule } from './rmq/rmq.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AlertsModule } from './alerts/alerts.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule, 
    ProductsModule,
    RmqModule,
    AlertsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
