import { Injectable, HttpException, HttpStatus, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { IScraperStrategy, ScrapeResult } from './scraper-strategy.interface';
import puppeteer, { Browser, Page } from 'puppeteer';

@Injectable()
export class WildberriesScraperStrategy implements IScraperStrategy, OnModuleInit, OnModuleDestroy {
  private browser: Browser | null = null;
  
  supports(url: string): boolean {
    return /wildberries\.ru/i.test(url);
  }

  async onModuleInit() {
    console.log('[Scraper WB Singleton] Инициализация глобального процесса Puppeteer...');
    try {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--window-size=1280,800',
          '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        ]
      });
      console.log('[Scraper WB Singleton] Процесс Chromium успешно запущен в фоне.');
    } catch (error: any) {
      console.error('[Scraper WB Singleton] Критическая ошибка запуска Chromium:', error.message);
    }
  }

  async onModuleDestroy() {
    if (this.browser) {
      console.log('[Scraper WB Singleton] Закрытие глобального процесса Puppeteer...');
      await this.browser.close();
    }
  }

  async scrape(url: string): Promise<ScrapeResult> {
    if (!this.browser) {
      await this.onModuleInit();
      if (!this.browser) {
        throw new HttpException('Движок Puppeteer недоступен', HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }

    let page: Page | null = null;

    try {
      const parts = url.split('/');
      const idMatch = parts.find(part => /^\d+$/.test(part));
      
      if (!idMatch) {
        throw new Error('Не удалось извлечь артикул товара из предоставленной ссылки WB');
      }

      const productId: string = idMatch;
      console.log(`[Scraper WB API v4] Задача из RabbitMQ. Обработка товара: ${productId}`);

      const productPageUrl = `https://wildberries.ru/catalog/${productId}/detail.aspx`;
      const targetApiUrl = `https://www.wildberries.ru/__internal/u-card/cards/v4/detail?appType=1&curr=rub&dest=-1257786&spp=30&hide_vflags=4294967296&hide_dtype=15&mtype=257&lang=ru&ab_testing=false&nm=${productId}`;

      page = await this.browser.newPage();
      
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      });

      console.log(`[Scraper WB API v4] Загрузка HTML-страницы товара...`);
      await page.goto(productPageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 2000));

      let jsonText = '';
      let isTokenExpired = false;

      console.log(`[Scraper WB API v4] Выполнение первой попытки AJAX инжекта...`);
      jsonText = await this.executeInternalFetch(page, targetApiUrl);

      if (jsonText.includes('"HTTP статус ошибки: 498"')) {
        console.warn('[Scraper WB API v4] Поймана ошибка 498 (Token Expired). Пересоздаем сессию...');
        isTokenExpired = true;
      }

      if (isTokenExpired) {
        const client = await page.target().createCDPSession();
        await client.send('Network.clearBrowserCookies');
        await client.send('Network.clearBrowserCache');

        console.log(`[Scraper WB API v4] Перезагрузка страницы с полной очисткой кук...`);
        await page.goto(productPageUrl, { waitUntil: 'networkidle2', timeout: 35000 });

        await page.evaluate(() => window.scrollBy(0, 300));
        await new Promise(resolve => setTimeout(resolve, 3500));

        console.log(`[Scraper WB API v4] Выполнение повторной (Retry) попытки AJAX инжекта...`);
        jsonText = await this.executeInternalFetch(page, targetApiUrl);
      }

      if (!jsonText || jsonText.trim() === '') {
        throw new Error('Получен пустой ответ от внутреннего AJAX-запроса');
      }

      if (jsonText.startsWith('{"error":')) {
        throw new Error(`Внутренний fetch окончательно завершился неудачей: ${jsonText}`);
      }

      if (jsonText.trim().startsWith('<')) {
        throw new Error('Внутренний AJAX запрос был перехвачен защитой WB и вернул HTML код вместо JSON');
      }

      const json = JSON.parse(jsonText.trim());
      const productData = json?.products?.[0]; 

      if (!productData) {
        console.error('[Scraper WB API v4] В ответе API нет массива товаров:', jsonText);
        throw new Error(`Товар ${productId} отсутствует в массиве products ответа API v4`);
      }

      const sizeInfo = productData?.sizes?.[0];
      const priceInfo = sizeInfo?.price;

      if (!priceInfo) {
        throw new Error('В ответе API отсутствует объект цен "price" внутри блока размеров товара');
      }

      const rawPrice = priceInfo.product ? priceInfo.product / 100 : priceInfo.basic / 100;
      console.log(`[Scraper WB API v4] Успех! Товар: "${productData.name}", Цена: ${rawPrice} руб. Задача RabbitMQ успешно выполнена.`);

      return {
        title: `${productData.brand || ''} ${productData.name}`.trim() || 'Товар Wildberries',
        price: rawPrice,
        currency: 'RUB'
      };

    } catch (error: any) {
      throw new HttpException(
        `Ошибка парсинга Wildberries: ${error.message}`, 
        HttpStatus.BAD_REQUEST
      );
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  private async executeInternalFetch(page: Page, apiUrl: string): Promise<string> {
    return await page.evaluate(async (url: string): Promise<string> => {
      try {
        const response = await window.fetch(url);
        if (!response.ok) {
          return JSON.stringify({ error: `HTTP статус ошибки: ${response.status}` });
        }
        return await response.text();
      } catch (e: any) {
        return JSON.stringify({ error: e.message });
      }
    }, apiUrl);
  }
}