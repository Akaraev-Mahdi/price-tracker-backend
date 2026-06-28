import { Injectable, Inject, NotFoundException } from '@nestjs/common'
import { ClientProxy } from '@nestjs/microservices'
import { PrismaService } from '../prisma/prisma.service'
import { AlertsService } from '../alerts/alerts.service'

interface ScrapeResultDto {
  productId: string
  title?: string
  price?: number
  currency?: string
  error?: string
}

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    @Inject('SCRAPER_CLIENT') private readonly rmqClient: ClientProxy,
    private alertsService: AlertsService
  ) {}

  async createProduct(url: string) {
    let product = await this.prisma.product.findUnique({
      where: { url }
    })

    if (!product) {
      product = await this.prisma.product.create({
        data: { url }
      })

      this.rmqClient.emit('execute_scraping', {
        productId: product.id,
        url: product.url
      })
    }

    return product
  }

  async getProductWithHistory(id: string) {
    return this.prisma.product.findUnique({
      where: { id },
      include: {
        prices: {
          orderBy: { createdAt: 'asc' }
        }
      }
    })
  }

  async handleScrapeResult(dto: ScrapeResultDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId }
    })

    if (!product) {
      throw new NotFoundException(`Product with ID ${dto.productId} not found`)
    }

    if (dto.error) {
      console.error(`[Core] Ошибка парсинга для товара ${dto.productId}: ${dto.error}`)
      return { success: false, error: dto.error }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: dto.productId },
        data: {
          title: dto.title,
          currentPrice: dto.price,
          currency: dto.currency || 'RUB'
        }
      })

      await tx.priceHistory.create({
        data: {
          productId: dto.productId,
          price: dto.price!
        }
      })
    })

    console.log(`[Core] Цена товара "${dto.title}" обновлена: ${dto.price} RUB`)

    this.alertsService.checkAndTriggerAlerts(dto.productId, dto.price!)

    return { success: true }
  }
}
