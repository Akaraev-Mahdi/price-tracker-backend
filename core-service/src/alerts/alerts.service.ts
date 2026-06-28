import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaClient } from "../generated/prisma/client"
import { Telegraf } from 'telegraf'

interface CreateAlertDto {
  productId: string
  targetPrice: number
  telegramId: string
}

@Injectable()
export class AlertsService {
  private readonly bot: Telegraf

  constructor(private prisma: PrismaClient) {
    const token = process.env.TELEGRAM_BOT_TOKEN
    
    if (!token) {
      console.warn('[Alerts] КРИТИЧЕСКАЯ ОШИБКА: TELEGRAM_BOT_TOKEN не задан в .env файле')
    }

    this.bot = new Telegraf(token || '')
  }

  async createAlert(dto: CreateAlertDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId }
    })

    if (!product) {
      throw new NotFoundException('Товар не найден в базе данных')
    }

    return this.prisma.alert.create({
      data: {
        productId: dto.productId,
        targetPrice: dto.targetPrice,
        telegramId: dto.telegramId,
        isTriggered: false
      }
    })
  }

  async checkAndTriggerAlerts(productId: string, currentPrice: number) {
    const activeAlerts = await this.prisma.alert.findMany({
      where: {
        productId,
        isTriggered: false,
        targetPrice: {
          gte: currentPrice
        }
      },
      include: {
        product: true
      }
    })

    if (activeAlerts.length === 0) {
      return
    }

    console.log(`[Alerts Telegraf] Найдено ${activeAlerts.length} активных триггеров для отправки`)

    await Promise.allSettled(
      activeAlerts.map(async (alert) => {
        try {
          if (!alert.telegramId) {
            throw new Error(`У алерта ${alert.id} отсутствует telegramId`)
          }

          const message = 
            `<b>Цена снизилась!</b>\n\n` +
            `Товар: <b>${alert.product.title || 'Без названия'}</b>\n` +
            `Новая цена: <b>${currentPrice} RUB</b> (Ваша цель: ${alert.targetPrice} RUB)\n\n` +
            `<a href="${alert.product.url}"> Перейти на Wildberries</a>`

          await this.bot.telegram.sendMessage(alert.telegramId, message, {
            parse_mode: 'HTML',
            link_preview_options: {
              is_disabled: false
            }
          })

          await this.prisma.alert.update({
            where: { id: alert.id },
            data: { isTriggered: true }
          })

          console.log(`[Alerts Telegraf] Уведомление отправлено пользователю ${alert.telegramId}`)
        } catch (error: any) {
          console.error(`[Alerts Telegraf Error] Ошибка отправки для алерта ${alert.id}: ${error.message}`)
        }
      })
    )
  }
}
