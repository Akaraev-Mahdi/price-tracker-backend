import { Module } from '@nestjs/common'
import { ClientsModule, Transport } from '@nestjs/microservices'

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'SCRAPER_CLIENT',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://localhost:5672'],
          queue: 'scrape_tasks_queue',
          queueOptions: {
            durable: true
          }
        }
      }
    ])
  ],
  exports: [ClientsModule]
})
export class RmqModule {}