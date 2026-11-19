"""No network: prove a closed policy gate cannot cause a publication or credential send."""
import contextlib
import importlib.util
import io
import json
import os
import sys
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('kiosk_probe',Path(__file__).parents[1]/'tools/probe_kiosk_output.py')
probe=importlib.util.module_from_spec(spec);spec.loader.exec_module(probe)

class ProbeSafety(unittest.TestCase):
    def run_probe(self,opener,*args):
        with patch.object(sys,'argv',['probe','--execute-live-test',*args]),patch.dict(os.environ,{'EDUVIZE_TEST_SESSION':'synthetic-session','EDUVIZE_TEST_PROFILE_ID':'a'*32}),patch.object(probe.urllib.request,'build_opener',return_value=opener):
            return probe.main()
    def test_default_does_not_read_credentials_or_construct_transport(self):
        with patch.object(sys,'argv',['probe']),patch.dict(os.environ,{},clear=True),patch.object(probe.urllib.request,'build_opener') as transport,contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit) as error:probe.main()
            self.assertEqual(error.exception.code,2);transport.assert_not_called()
    def test_gate_redirect_is_not_followed_and_no_mutation_or_token_is_sent(self):
        for status in (301,302,303,307,308):
            calls=[]
            class Opener:
                def open(self,request,timeout):
                    calls.append(request)
                    raise urllib.error.HTTPError(request.full_url,status,'Gate',{'Location':'https://test.skola.eduvize.cz/login'},io.BytesIO(b'login'))
            with self.subTest(status=status),self.assertRaises(probe.AccessGateBlocked):self.run_probe(Opener())
            self.assertEqual(len(calls),1);self.assertEqual(calls[0].method,'GET')
            self.assertEqual(calls[0].full_url,probe.ORIGIN+'/api/v1/outputs/schema')
            self.assertNotIn('Authorization',calls[0].headers)
    def test_login_html_and_wrong_schema_cannot_create_an_output(self):
        for raw in (b'<html>Login</html>',b'{"schemaVersion":true,"schemas":{"Snapshot":{},"Create":{}}}',b'{"schemaVersion":1,"schemas":{}}'):
            calls=[]
            class Response:
                status=200
                def read(self):return raw
                def __enter__(self):return self
                def __exit__(self,*args):pass
            class Opener:
                def open(self,request,timeout):calls.append(request);return Response()
            with self.subTest(raw=raw),self.assertRaises((ValueError,RuntimeError)):self.run_probe(Opener())
            self.assertEqual([r.method for r in calls],['GET'])
    def test_no_redirect_handler_never_grants_an_alternative_path(self):
        self.assertIsNone(probe.NoRedirect().redirect_request(None,None,303,'gate',{},'https://other.test'))

if __name__=='__main__':unittest.main()
