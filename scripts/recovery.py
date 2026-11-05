"""Local/offline SQLite + object-store backup and verified restore. Never calls production APIs."""
import argparse
import hashlib
import json
import shutil
import sqlite3
from contextlib import closing
from pathlib import Path

def sha(path):
    result=hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda:stream.read(1024*1024),b''): result.update(block)
    return result.hexdigest()

def child(root,relative):
    candidate=(root/relative).resolve()
    if not candidate.is_relative_to(root.resolve()) or candidate==root.resolve(): raise ValueError('Unsafe manifest path')
    return candidate

def check_db(path):
    with closing(sqlite3.connect(f'{path.as_uri()}?mode=ro',uri=True)) as db:
        if db.execute('PRAGMA integrity_check').fetchone()[0]!='ok': raise ValueError('Database integrity check failed')
        if db.execute('PRAGMA foreign_key_check').fetchone(): raise ValueError('Foreign-key check failed')

def backup(database,objects,destination,quiesced=False):
    database,objects,destination=map(lambda p:Path(p).resolve(),(database,objects,destination))
    if not quiesced: raise ValueError('Stop writes to both database and object store, then pass --quiesced')
    if destination.exists(): raise ValueError('Destination must not already exist')
    if not database.is_file() or not objects.is_dir(): raise ValueError('Database and object-store export are required')
    if destination.is_relative_to(objects): raise ValueError('Backup cannot be inside the object store')
    destination.mkdir(parents=True)
    with closing(sqlite3.connect(f'{database.as_uri()}?mode=ro',uri=True)) as source,closing(sqlite3.connect(destination/'database.sqlite')) as target: source.backup(target)
    check_db(destination/'database.sqlite')
    records=[]
    for source in sorted(objects.rglob('*')):
        if source.is_symlink(): raise ValueError('Object store must not contain symlinks')
        if not source.is_file(): continue
        relative='objects/'+source.relative_to(objects).as_posix()
        target=child(destination,relative);target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
        records.append({'path':relative,'size':target.stat().st_size,'sha256':sha(target)})
    records.insert(0,{'path':'database.sqlite','size':(destination/'database.sqlite').stat().st_size,'sha256':sha(destination/'database.sqlite')})
    manifest={'format':'zenlo-recovery-v1','writesStopped':True,'files':records}
    (destination/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    return {'databaseChecked':True,'objects':len(records)-1,'destination':str(destination)}

def verify(source):
    source=Path(source).resolve();manifest=json.loads((source/'manifest.json').read_text(encoding='utf-8'))
    if manifest.get('format')!='zenlo-recovery-v1': raise ValueError('Unsupported backup format')
    files=manifest['files'];names=[f['path'] for f in files]
    if len(set(names))!=len(names) or 'database.sqlite' not in names: raise ValueError('Invalid file inventory')
    for entry in files:
        if entry['path']!='database.sqlite' and not entry['path'].startswith('objects/'): raise ValueError('Unexpected backup path')
        path=child(source,entry['path'])
        if path.is_symlink() or not path.is_file() or path.stat().st_size!=entry['size'] or sha(path)!=entry['sha256']: raise ValueError('Backup file missing or corrupted: '+entry['path'])
    check_db(source/'database.sqlite')
    return manifest

def restore(source,destination):
    source,destination=Path(source).resolve(),Path(destination).resolve();manifest=verify(source)
    if destination.exists(): raise ValueError('Restore destination must not already exist; existing data is never overwritten')
    destination.mkdir(parents=True)
    for entry in manifest['files']:
        target=child(destination,entry['path']);target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(child(source,entry['path']),target)
    shutil.copyfile(source/'manifest.json',destination/'manifest.json');verify(destination)
    return {'restored':True,'objects':len(manifest['files'])-1,'destination':str(destination)}

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);sub=parser.add_subparsers(dest='action',required=True)
    b=sub.add_parser('backup');b.add_argument('--database',required=True);b.add_argument('--objects',required=True);b.add_argument('--destination',required=True);b.add_argument('--quiesced',action='store_true')
    v=sub.add_parser('verify');v.add_argument('--source',required=True)
    t=sub.add_parser('restore');t.add_argument('--source',required=True);t.add_argument('--destination',required=True)
    args=parser.parse_args()
    if args.action=='backup': result=backup(args.database,args.objects,args.destination,args.quiesced)
    elif args.action=='restore': result=restore(args.source,args.destination)
    else: result={'verified':True,'files':len(verify(args.source)['files'])}
    print(json.dumps(result))
