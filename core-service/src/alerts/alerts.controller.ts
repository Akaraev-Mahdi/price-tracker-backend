import { Controller, Post, Body } from '@nestjs/common'
import { AlertsService } from './alerts.service'

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Post()
  async createAlert(
    @Body('productId') productId: string,
    @Body('targetPrice') targetPrice: number,
    @Body('telegramId') telegramId: string
  ) {
    return this.alertsService.createAlert({
      productId,
      targetPrice,
      telegramId
    })
  }
}
