import re,json
from playwright.sync_api import sync_playwright
from harness import *
import fakebroker as fb
page=wrap(open('page.html',encoding='utf-8').read())
page=page.replace('<body>','<body><script>'+FAST+fb.FAKE_JS+'</script>',1)
fb.start(page.encode('utf-8'),8771)
URL='http://127.0.0.1:8771/page.html'
errors=[]
# pre-seed legacy shared data on the relay (v1) and an old device with solo + multi history
fb.RET['acquire-sa/v1/records/416e6e']=json.dumps({'n':'SoloKing','t':{'v':99999,'np':4,'r':1,'w':1,'d':1}})
old={'v':1,'games':[
 {'n':'Soloist','t':88000,'r':1,'w':1,'np':3,'m':30000,'p':20000,'pc':1,'cb':None,'d':1000,'md':'solo','tc':1},
 {'n':'Mia','t':41000,'r':1,'w':1,'np':3,'m':5000,'p':9000,'pc':2,'cb':None,'d':2000,'md':'multi','tc':1},
 {'n':'Leo','t':30000,'r':2,'w':0,'np':3,'m':0,'p':4000,'pc':3,'cb':None,'d':2000,'md':'local','tc':1}],'gids':['a','b']}
def drive(pg):
    n=0
    while n<8000:
        if pg.is_visible('#pass'): pg.click('#passBtn'); pg.wait_for_timeout(20); continue
        r=pg.evaluate(DRIVER)
        if r=='dispose-set': pg.evaluate(DISPOSE_OK)
        if r=='over': break
        n+=1
with sync_playwright() as p:
    br=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    ctx=br.new_context(viewport={'width':420,'height':900}); pg=ctx.new_page(); pg.on('pageerror',lambda e:errors.append(str(e)))
    pg.add_init_script("localStorage.setItem('asa-records',%s)"%json.dumps(json.dumps(old)))
    pg.goto(URL); pg.wait_for_timeout(500)
    # 1) solo game must NOT record
    pg.fill('#nameInput','Zed'); pg.click('#botSeg button[data-n="2"]'); pg.click('#soloBtn'); pg.wait_for_timeout(300); drive(pg); pg.wait_for_timeout(4000)
    pg.goto(URL); pg.wait_for_timeout(500); pg.click('#recordsBtn'); pg.wait_for_timeout(4500)
    t=pg.inner_text('#recBody'); print('after solo + migration -> Mia:', 'Mia' in t,'Leo:','Leo' in t,'| Soloist:','Soloist' in t,'Zed:','Zed' in t,'SoloKing:','SoloKing' in t)
    assert 'Mia' in t and 'Leo' in t and 'Soloist' not in t and 'Zed' not in t and 'SoloKing' not in t
    print('legacy v1 topics left on relay:',len([k for k in fb.RET if '/v1/records/' in k]))
    # 2) pass and play with 2 humans DOES record
    pg.click('#recBack'); pg.wait_for_timeout(200)
    pg.click('#localSeg button[data-n="2"]'); pg.fill('#lname0','Ann'); pg.fill('#lname1','Ben'); pg.click('#localAiSeg button[data-n="1"]'); pg.click('#localBtn'); pg.wait_for_timeout(300)
    drive(pg); pg.wait_for_timeout(4500)
    pg.goto(URL); pg.wait_for_timeout(500); pg.click('#recordsBtn'); pg.wait_for_timeout(4500)
    t=pg.inner_text('#recBody'); print('after pass-and-play -> Ann:','Ann' in t,'Ben:','Ben' in t)
    assert 'Ann' in t and 'Ben' in t
    print('v2 topics on relay:',sorted(k.split('/')[-1] for k in fb.RET if '/v2/records/' in k))
    br.close()
print('ERRORS',errors or 'none')
