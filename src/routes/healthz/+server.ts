import { getDb } from '#lib/server/database.js';
import { health } from '#lib/server/health.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => health(getDb);
