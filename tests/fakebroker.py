import json,threading,time,queue
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from urllib.parse import urlparse,parse_qs
LOCK=threading.Lock()
RET={}; SUBS={}; QS={}; PAGE=b''; LOG=[]
def tm(f,t):
    if f==t: return True
    if f.endswith('/+'): return t.startswith(f[:-1]) and '/' not in t[len(f)-1:]
    return False
class H(BaseHTTPRequestHandler):
    def log_message(self,*a): pass
    def _send(self,code,body,ct='application/json'):
        self.send_response(code); self.send_header('Content-Type',ct); self.send_header('Content-Length',str(len(body))); self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        u=urlparse(self.path); q=parse_qs(u.query)
        if u.path=='/page.html': return self._send(200,PAGE,'text/html; charset=utf-8')
        if u.path=='/poll':
            cid=q['cid'][0]; qu=QS.setdefault(cid,queue.Queue()); out=[]
            try:
                out.append(qu.get(timeout=0.15))
                while True: out.append(qu.get_nowait())
            except queue.Empty: pass
            return self._send(200,json.dumps(out).encode())
        self._send(404,b'')
    def do_POST(self):
        u=urlparse(self.path); n=int(self.headers.get('Content-Length',0)); d=json.loads(self.rfile.read(n) or b'{}')
        with LOCK:
            if u.path=='/sub':
                cid=d['cid']; qu=QS.setdefault(cid,queue.Queue()); s=SUBS.setdefault(cid,set())
                for t in d['topics']:
                    s.add(t)
                    for rt,rp in list(RET.items()):
                        if tm(t,rt): qu.put({'t':rt,'p':rp})
            elif u.path=='/unsub':
                for t in d['topics']: SUBS.get(d['cid'],set()).discard(t)
            elif u.path=='/pub':
                t=d['topic']; p=d['payload']; LOG.append((t,p))
                if d.get('retain'):
                    if p=='' : RET.pop(t,None)
                    else: RET[t]=p
                for cid,s in SUBS.items():
                    if any(tm(f,t) for f in s) and p!='': QS.setdefault(cid,queue.Queue()).put({'t':t,'p':p})
            elif u.path=='/drop': SUBS.pop(d['cid'],None)
        self._send(200,b'{}')
def start(page,port=8766):
    global PAGE; PAGE=page
    srv=ThreadingHTTPServer(('127.0.0.1',port),H); threading.Thread(target=srv.serve_forever,daemon=True).start(); return srv
FAKE_JS = r"""
(function(){
 window.mqtt={connect:function(url,opts){
  var cid='c'+Math.random().toString(36).slice(2),ev={},closed=false,c={};
  function fire(e,args){(ev[e]||[]).slice().forEach(function(f){f.apply(null,args||[])});var o=ev['once:'+e]||[];ev['once:'+e]=[];o.forEach(function(f){f.apply(null,args||[])})}
  c.on=function(e,f){(ev[e]=ev[e]||[]).push(f);return c};
  c.once=function(e,f){(ev['once:'+e]=ev['once:'+e]||[]).push(f);return c};
  function post(p,b){return fetch('/'+p,{method:'POST',body:JSON.stringify(Object.assign({cid:cid},b))})}
  c.subscribe=function(t,o,cb){post('sub',{topics:[].concat(t)}).then(function(){cb&&cb(null)},function(e){cb&&cb(e)});return c};
  c.unsubscribe=function(t){post('unsub',{topics:[].concat(t)});return c};
  c.publish=function(t,m,o,cb){if(closed){cb&&cb(new Error('closed'));return c}
    post('pub',{topic:t,payload:m,retain:!!(o&&o.retain)}).then(function(){cb&&cb(null)},function(e){cb&&cb(e)});return c};
  c.end=function(){closed=true;post('drop',{})};
  var dead=((url.indexOf('emqx')>=0||url.indexOf('eclipse')>=0)&&window.__emqxDown);
  window.__urls=(window.__urls||[]).concat([url]);
  if(!dead){setTimeout(function(){fire('connect')},20);
   (function poll(){if(closed)return;fetch('/poll?cid='+cid).then(function(r){return r.json()}).then(function(a){a.forEach(function(m){fire('message',[m.t,m.p])})}).catch(function(){}).then(function(){setTimeout(poll,10)})})();
  }
  return c}};
})();
"""
