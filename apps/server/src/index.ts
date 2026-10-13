import pg from 'pg';
import {settings} from './config.ts';
import {poolConfig} from './db.ts';
import {createApp} from './http.ts';
import {routers} from './routes.ts';

const pool = new pg.Pool(poolConfig());
// The pooler can drop idle connections; pg reports that here, and an unhandled 'error' event would exit the process.
pool.on('error', error => console.error(`Database pool error type=${error.name}`));
const port = settings().port;
createApp(pool, routers).listen(port, () => console.log(`Labour Youth API listening on ${port}`));
