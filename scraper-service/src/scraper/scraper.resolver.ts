import { Injectable, BadRequestException } from '@nestjs/common'
import { WildberriesScraperStrategy } from './strategies/wildberries-scraper.strategy'
import { IScraperStrategy } from './strategies/scraper-strategy.interface'

@Injectable()
export class ScraperResolver {
  private strategies: IScraperStrategy[]

  constructor(
    private readonly wildberriesStrategy: WildberriesScraperStrategy
  ) {
    this.strategies = [this.wildberriesStrategy]
  }

  resolve(url: string): IScraperStrategy {
    const strategy = this.strategies.find(s => s.supports(url))
    
    if (!strategy) {
      throw new BadRequestException(`Данный домен не поддерживается системой мониторинга. Ссылка: ${url}`)
    }
    
    return strategy
  }
}
