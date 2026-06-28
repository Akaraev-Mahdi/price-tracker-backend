import { Module } from '@nestjs/common'
import { ScraperController } from './scraper.controller'
import { ScraperResolver } from './scraper.resolver'
import { WildberriesScraperStrategy } from './strategies/wildberries-scraper.strategy'

@Module({
  controllers: [ScraperController],
  providers: [
    ScraperResolver, 
    WildberriesScraperStrategy
  ]
})
export class ScraperModule {}
