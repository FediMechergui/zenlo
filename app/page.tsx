import { requireChatGPTUser } from './chatgpt-auth';
import ZenloApp from './components/zenlo-app';
import { redirect } from 'next/navigation';
import { context,first } from '../server/db';
export const dynamic = 'force-dynamic';
export default async function Home() { const user=await requireChatGPTUser('/');if(!await context(user)&&await first('SELECT id FROM client_access WHERE email=? AND revoked_at IS NULL AND expires_at>? LIMIT 1',user.email.toLowerCase(),new Date().toISOString()))redirect('/client');return <ZenloApp />; }
