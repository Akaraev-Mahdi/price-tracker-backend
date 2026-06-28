export interface ScrapeResult {
  title: string
  price: number
  currency: string
}

export interface IScraperStrategy {
  supports(url: string): boolean
  scrape(url: string): Promise<ScrapeResult>
}
