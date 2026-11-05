import { notFound } from 'next/navigation';
import { requireChatGPTUser } from '../../../chatgpt-auth';
import { DOCUMENT_KINDS,printableDocument,type DocumentKind } from '../../../../server/document-data';
import DocumentView from '../../document-view';
import ReportView from '../../report-view';
import '../../documents.css';
export const dynamic='force-dynamic';
export const metadata={title:'Document · Zenlo',robots:{index:false,follow:false}};
export default async function DocumentPage({params,searchParams}:{params:Promise<{kind:string;id:string}>;searchParams:Promise<{version?:string;from?:string;to?:string}>}){
  const {kind,id}=await params,query=await searchParams;if(kind!=='report'&&!DOCUMENT_KINDS.includes(kind as DocumentKind))notFound();
  const user=await requireChatGPTUser(`/documents/${kind}/${id}`);if(kind==='report')return <ReportView user={user} type={id} from={query.from} to={query.to}/>;
  const version=query.version?Number(query.version):undefined;if(version!==undefined&&(!Number.isSafeInteger(version)||version<1))notFound();
  const document=await printableDocument(user,kind as DocumentKind,id,version);if(!document)notFound();return <DocumentView kind={kind as DocumentKind} document={document}/>;
}
