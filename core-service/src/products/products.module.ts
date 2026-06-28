import { Module } from '@nestjs/common'
import { ProductsService } from './products.service'
import { ProductsController } from './products.controller'
import { RmqModule } from '../rmq/rmq.module'
import { PrismaService } from '../prisma/prisma.service'
import { ProductsScheduler } from './products.scheduler'
import { AlertsModule } from '../alerts/alerts.module'

@Module({
  imports: [RmqModule, AlertsModule],
  controllers: [ProductsController],
  providers: [ProductsService, PrismaService, ProductsScheduler]
})
export class ProductsModule {}
