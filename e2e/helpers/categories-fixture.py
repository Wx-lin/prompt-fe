"""Local-only twelve-category backend fixture for categories E2E; no database or credentials."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from urllib.parse import urlsplit
from pathlib import Path

def item(number):
 return {'id':f'aaaaaaaa-aaaa-4aaa-8aaa-{number:012d}','title':f'真实推荐作品 {number}','category':'portrait','models':['Midjourney V6.1'],'thumbnail_url':'/demo/portrait.jpg','like_count':number,'view_count':number,'author_name':'本地作者','created_at':'2026-10-13T00:00:00Z'}
def feed(items):
 return {'items':items,'total':len(items),'page':1,'page_size':20,'has_more':False}
class Handler(BaseHTTPRequestHandler):
 def reply(self,data,status=200):
  self.send_response(status);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps(data).encode())
 def do_GET(self):
  path=urlsplit(self.path).path
  if path=='/api/categories':self.reply([{**c, 'count': 0 if c['key']=='product' else 6} for c in json.loads((Path(__file__).parent.parent / 'fixtures/categories.json').read_text())]);return
  if path=='/api/models':self.reply([]);return
  if path in ('/api/prompts', '/api/prompts/search'):self.reply(feed([item(1)]));return
  if path.startswith('/api/prompts/'):
   parts=path.split('/');key=parts[3];number=int(key[-12:])
   if len(parts)>4 and parts[4]=='similar':
    if number==5:self.reply([]);return
    if number==6:self.reply({},500);return
    self.reply([item(number),item(2),item(2),{'id':'broken','title':'坏数据'},item(3),item(4)]);return
   data=item(number);data.update({'author_avatar_url':None,'prompt_text':'A fixture portrait for recommendations','description':'本地接口验收','source_url':None,'collect_count':0,'images':[],'is_liked':False,'is_collected':False});self.reply(data);return
  self.reply({},404)
ThreadingHTTPServer(('127.0.0.1',8027),Handler).serve_forever()
