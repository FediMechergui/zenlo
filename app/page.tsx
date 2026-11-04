import { requireChatGPTUser } from './chatgpt-auth';
import ZenloApp from './components/zenlo-app';
export const dynamic = 'force-dynamic';
export default async function Home() { await requireChatGPTUser('/'); return <ZenloApp />; }
