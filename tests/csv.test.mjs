import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv} from '../lib/csv.ts';
test('handles UTF8 BOM, semicolons, embedded newlines and escaped quotes',()=>{
  assert.deepEqual(parseCsv('\uFEFFname;notes\r\n"Amine";"Deux lignes\navec ""citation"""\r\n'),[{name:'Amine',notes:'Deux lignes\navec "citation"'}]);
});
test('rejects malformed or ambiguous imports instead of silently shifting data',()=>{
  for(const csv of ['a,a\n1,2','a,b\n1,2,3','a,b\n"broken,1','a,b\n"quoted"bad,1','a,b\n'])assert.throws(()=>parseCsv(csv));
});
