import copy
import unittest
from pydantic import ValidationError
from eduvize_kiosk.output_adapter import validate

class PayloadValidation(unittest.TestCase):
    def setUp(self):
        self.payload={'title':'Škola','pages':[{'id':'home','title':'Nabídka','buttons':[]}]}
    def test_defaults_are_explicit_and_input_is_not_changed(self):
        original=copy.deepcopy(self.payload);v=validate(self.payload,{})
        self.assertEqual(v['startPage'],'home');self.assertEqual(v['idleSeconds'],60)
        self.assertEqual(self.payload,original)
    def test_unknown_fields_credentials_and_urls_are_rejected(self):
        for value in [dict(self.payload,profileId='private'),dict(self.payload,token='private'),dict(self.payload,idleSeconds=True),dict(self.payload,idleSeconds=-1)]:
            with self.subTest(value=value),self.assertRaises((ValidationError,ValueError)):validate(value,{})
        for button in [dict(id='web',type='url',label='Web',target='https://example.onrender.com'),dict(id='child',type='output',label='Dítě',outputId='a'*32)]:
            p=copy.deepcopy(self.payload);p['pages'][0]['buttons']=[button]
            with self.assertRaises((ValidationError,ValueError)):validate(p,{})
    def test_graph_and_resource_limits(self):
        for mutate in [lambda p:p['pages'].append(copy.deepcopy(p['pages'][0])),lambda p:p.update(startPage='missing'),lambda p:p['pages'][0]['buttons'].append(dict(id='missing',type='page',label='Chybí',pageId='missing')),lambda p:p['pages'][0].update(sections=[{'text':'x'*4001}])]:
            p=copy.deepcopy(self.payload);mutate(p)
            with self.assertRaises((ValidationError,ValueError)):validate(p,{})

if __name__=='__main__':unittest.main()
