import { Controller } from '@nestjs/common'
import { MessagePattern, Payload, Ctx, RmqContext } from '@nestjs/microservices'
import { ScraperResolver } from './scraper.resolver'
import axios from 'axios'

interface ScrapeTaskPayload {
  productId: string
  url: string
}

@Controller()
export class ScraperController {
  constructor(private readonly scraperResolver: ScraperResolver) {}

  @MessagePattern('execute_scraping')
  async handleScrapingTask(
    @Payload() data: ScrapeTaskPayload,
    @Ctx() context: RmqContext
  ) {
    const channel = context.getChannelRef()
    const originalMessage = context.getMessage()

    try {
      console.log(`[Scraper] Starting task for product: ${data.productId}`)
      
      const strategy = this.scraperResolver.resolve(data.url)
      
      const scrapedData = await strategy.scrape(data.url)
      
      console.log(`[Scraper] Successfully scraped data: ${scrapedData.title} - ${scrapedData.price}`)

      await axios.post('http://localhost:3000/products/webhook/scrape-result', {
        productId: data.productId,
        title: scrapedData.title,
        price: scrapedData.price,
        currency: scrapedData.currency
      })

      channel.ack(originalMessage)

    } catch (error: any) {
      console.error(`[Scraper Error] Failed to process task: ${error.message}`)

      channel.ack(originalMessage)
      
      await axios.post('http://localhost:3000/products/webhook/scrape-result', {
        productId: data.productId,
        error: error.message
      }).catch(() => console.error('Core service is unreachable for error reporting'))
    }
  }
}
