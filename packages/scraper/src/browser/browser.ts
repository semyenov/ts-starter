import { launch } from 'puppeteer'

export const browser = await launch({
  headless: 'new',
  // devtools: true,
  // args: [
  //   '--no-sandbox',
  //   '--disable-gpu',
  //   '--disable-setuid-sandbox',
  //   '--disable-background-timer-throttling',
  //   '--disable-backgrounding-occluded-windows',
  //   '--disable-renderer-backgrounding',
  // ],
})
