import type { MidwayConfig } from '@midwayjs/core';

const config: MidwayConfig = {
  keys: process.env.APP_KEYS || 'nova-default-keys-change-in-production',
  koa: {
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : 7001,
  },
  bodyParser: {
    jsonLimit: '10mb',
  },
};

export default config;
