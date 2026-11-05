import importlib.util
import json
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
spec=importlib.util.spec_from_file_location('recovery',Path(__file__).resolve().parents[1]/'scripts/recovery.py')
recovery=importlib.util.module_from_spec(spec);spec.loader.exec_module(recovery)

class RecoveryTests(unittest.TestCase):
    def test_restore_database_and_photo_bytes(self):
        with tempfile.TemporaryDirectory(prefix='zenlo-recovery-qa-') as tmp:
            root=Path(tmp);db=root/'source.sqlite';objects=root/'objects';(objects/'tenant').mkdir(parents=True)
            with closing(sqlite3.connect(db)) as c:
                c.executescript("CREATE TABLE photos(id TEXT PRIMARY KEY,object_key TEXT); INSERT INTO photos VALUES('qa-photo','tenant/photo.png');")
            photo=b'fictional QA photo bytes';(objects/'tenant/photo.png').write_bytes(photo)
            backup=root/'backup';recovery.backup(db,objects,backup,quiesced=True);restored=root/'restored';recovery.restore(backup,restored)
            with closing(sqlite3.connect(restored/'database.sqlite')) as c: key=c.execute('SELECT object_key FROM photos').fetchone()[0]
            self.assertEqual((restored/'objects'/key).read_bytes(),photo)
            with self.assertRaises(ValueError): recovery.restore(backup,restored)
    def test_corruption_and_traversal_are_rejected_before_restore(self):
        with tempfile.TemporaryDirectory(prefix='zenlo-recovery-qa-') as tmp:
            root=Path(tmp);db=root/'source.sqlite';objects=root/'objects';objects.mkdir()
            with closing(sqlite3.connect(db)) as c: c.execute('CREATE TABLE qa(id INTEGER)')
            (objects/'photo').write_bytes(b'QA');backup=root/'backup'
            with self.assertRaises(ValueError): recovery.backup(db,objects,backup)
            recovery.backup(db,objects,backup,quiesced=True);(backup/'objects/photo').write_bytes(b'corrupt')
            with self.assertRaises(ValueError): recovery.restore(backup,root/'restore')
            self.assertFalse((root/'restore').exists())
            manifest=json.loads((backup/'manifest.json').read_text());manifest['files'][1]['path']='objects/../../outside';(backup/'manifest.json').write_text(json.dumps(manifest))
            with self.assertRaises(ValueError): recovery.verify(backup)

if __name__=='__main__': unittest.main()
