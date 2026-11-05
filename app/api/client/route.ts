import { getChatGPTUser } from '../../chatgpt-auth';
import { clientRentals } from '../../../server/client-access';
import { requireCondition } from '../../../server/domain';
import { apiError } from '../../../server/api';
import { privateHeaders } from '../../../server/file-access';
export const dynamic='force-dynamic';
export async function GET(){try{const user=await getChatGPTUser();requireCondition(user,'UNAUTHENTICATED','Connectez-vous pour consulter vos locations.',401);return Response.json({items:await clientRentals(user),name:user.displayName},{headers:privateHeaders});}catch(error){return apiError(error);}}
