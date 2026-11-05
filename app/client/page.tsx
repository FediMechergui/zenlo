import { requireChatGPTUser } from '../chatgpt-auth';
import { clientRentals } from '../../server/client-access';
import ClientPortal from './portal';
export const dynamic='force-dynamic';
export const metadata={title:'Mes locations · Zenlo',robots:{index:false,follow:false}};
export default async function ClientPage(){const user=await requireChatGPTUser('/client');return <ClientPortal initialItems={await clientRentals(user)} name={user.displayName}/>;}
