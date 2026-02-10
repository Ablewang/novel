/**
 * Midway 3 启动入口
 * dev: tsx watch src/bootstrap.ts
 * prod: node dist/bootstrap.js (after tsc)
 */
import { join } from 'path';
import { Bootstrap } from '@midwayjs/bootstrap';
import dotenv from 'dotenv';

dotenv.config({ path: join(__dirname, '..', '..', '..', '.env') });

const baseDir = __dirname;
Bootstrap.configure({ baseDir }).run();
