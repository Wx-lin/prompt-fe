from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import json,time,uuid
class H(BaseHTTPRequestHandler):
 def reply(self,data,status=200):
  self.send_response(status); self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps(data).encode())
 def do_GET(self):
  if self.path=='/api/auth/me': self.reply({'id':'fixture-user','email':'fixture@example.test','display_name':'本地验收用户','avatar_url':None})
  elif self.path=='/api/categories': self.reply([{'key':'portrait','label':'人像'}])
  elif self.path=='/api/models': self.reply([{'key':'Midjourney V6.1','label':'Midjourney V6.1','group':'Midjourney'}])
  elif self.path.startswith('/api/submissions'):self.reply({'items':[],'total':0,'page':1,'page_size':20,'has_more':False})
  else:self.reply({},404)
 def do_POST(self):
  body=self.rfile.read(int(self.headers.get('Content-Length','0')))
  if self.path=='/api/submissions/upload':
   time.sleep(.7)
   if b'fail.png' in body: self.reply({},422);return
   self.reply({'id':str(uuid.uuid4()),'image_url':'https://example.test/private.png'})
  elif self.path=='/api/submissions': self.reply({'id':'fixture-submission'},201)
  else:self.reply({},404)
ThreadingHTTPServer(('127.0.0.1',8017),H).serve_forever()
