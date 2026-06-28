import { Injectable, Inject } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { ClientProxy } from '@nestjs/microservices'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class ProductsScheduler {
  constructor(
    private prisma: PrismaService,
    @Inject('SCRAPER_CLIENT') private readonly rmqClient: ClientProxy
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handlePriceMonitoringCron() {
    console.log('[Scheduler] Запуск регламентного мониторинга цен...')
    
    const batchSize = 100
    let skip = 0
    let hasMore = true

    while (hasMore) {
      const products = await this.prisma.product.findMany({
        select: { id: true, url: true },
        take: batchSize,
        skip: skip
      })

      if (products.length === 0) {
        hasMore = false
        break
      }

      for (const product of products) {
        this.rmqClient.emit('execute_scraping', {
          productId: product.id,
          url: product.url
        })
      }

      console.log(`[Scheduler] Отправлено в очередь ${products.length} товаров (пропущено: ${skip})`)
      skip += batchSize
    }

    console.log('[Scheduler] Все задачи на мониторинг успешно распределены в RabbitMQ')
  }
}
