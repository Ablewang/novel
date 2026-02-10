import { Controller, Get } from '@midwayjs/core';

@Controller('/')
export class HealthController {
  @Get('/health')
  async health() {
    return { status: 'ok', service: 'novel-agent' };
  }
}
