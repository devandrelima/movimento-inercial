import tempfile
import unittest
from pathlib import Path
from prepare_manifest import prepare_manifest


class SplitTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.root=Path(self.temp.name)
        self.lists=self.root/'lists';self.lists.mkdir()
        self.data=self.root/'data';self.data.mkdir()
        self.write_lists('a001_1\n','a001_2\n','a002_1\n')
    def tearDown(self): self.temp.cleanup()
    def write_lists(self,train,val,test):
        for name,content in [('list_train.txt',train),('list_val.txt',val),('list_test_unseen.txt',test)]:
            (self.lists/name).write_text(content)
    def add_sequence(self,name):
        path=self.data/name;path.mkdir();(path/'data.hdf5').touch();(path/'info.json').touch()
    def test_missing_test_is_not_ready(self):
        self.add_sequence('a001_1');self.add_sequence('a001_2')
        result=prepare_manifest([self.data],self.lists)
        self.assertFalse(result['ready_for_full_protocol'])
        self.assertEqual(result['splits']['test_unseen']['missing'],['a002_1'])
    def test_rejects_sequence_in_multiple_splits(self):
        self.write_lists('a001_1\n','a001_1\n','a002_1\n')
        with self.assertRaises(ValueError): prepare_manifest([self.data],self.lists)
    def test_rejects_test_subject_candidate_overlap(self):
        self.write_lists('a001_1\n','a003_1\n','a001_2\n')
        with self.assertRaises(ValueError): prepare_manifest([self.data],self.lists)

if __name__=='__main__':unittest.main()
