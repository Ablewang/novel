import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';
import path from 'path';

const DB_PATH = path.resolve(process.cwd(), '..', '..', 'data', 'checkpoints.sqlite');
export const checkpointer = SqliteSaver.fromConnString(DB_PATH);
