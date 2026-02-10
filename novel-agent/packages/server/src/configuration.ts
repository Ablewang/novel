import { Configuration, App } from '@midwayjs/core';
import * as koa from '@midwayjs/koa';
import { join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

@Configuration({
  imports: [koa],
  importConfigs: [join(__dirname, './config')],
})
export class MainConfiguration {
  @App()
  app!: koa.Application;

  async onReady() {
    // CORS and bodyParser from config
  }
}
