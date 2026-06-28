import { NestFactory } from '@nestjs/core'
import { MicroserviceOptions, Transport } from '@nestjs/microservices'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.RMQ,
    options: {
      urls: ['amqp://localhost:5672'],
      queue: 'scrape_tasks_queue',
      queueOptions: {
        durable: true
      },
      noAck: false
    }
  })

  await app.listen()
  console.log('Scraper Microservice is running and listening to RabbitMQ...')
}
bootstrap()
