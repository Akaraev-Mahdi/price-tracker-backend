import { Controller, Post, Get, Param, Body, HttpCode, HttpStatus } from '@nestjs/common'
import { ProductsService } from './products.service'

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  async addProduct(@Body('url') url: string) {
    return this.productsService.createProduct(url)
  }

  @Get(':id')
  async getProduct(@Param('id') id: string) {
    return this.productsService.getProductWithHistory(id)
  }

  @Post('webhook/scrape-result')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() body: any) {
    return this.productsService.handleScrapeResult(body)
  }
}
