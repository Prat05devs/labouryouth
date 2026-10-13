import {router as admin} from './modules/admin.ts';
import {router as auth} from './modules/auth.ts';
import {router as marketplace} from './modules/marketplace.ts';
import {router as profiles} from './modules/profiles.ts';
import {router as publicBrowse} from './modules/public.ts';
import {router as workflows} from './modules/workflows.ts';

// Every module of apps/api is ported; the order matches apps/api/app/main.py.
export const routers = [auth, profiles, workflows, marketplace, publicBrowse, admin];
