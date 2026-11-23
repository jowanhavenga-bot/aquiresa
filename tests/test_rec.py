import re,json,os
from playwright.sync_api import sync_playwright
from harness import *
import fakebroker as fb
page=wrap(open('page.html',encoding='utf-8').read())
page=page.replace('<body>','<body><script>'+FAST+fb.FAKE_JS+'</script>',1)
fb.start(page.encode('utf-8'),8770)
URL='http://127.0.0.1:8770/page.html'
errors=[]
def solo(pg,name,bots=2):
    pg.goto(URL); pg.wait_for_timeout(400); pg.fill('#nameInput',name)
    pg.click('#botSeg button[data-n="%d"]'%bots); pg.click('#soloBtn'); pg.wait_for_timeout(300)
    for i in range(3000):
        r=pg.evaluate(DRIVER)
        if r=='dispose-set': pg.evaluate(DISPOSE_OK)
        if r=='over': break
    pg.wait_for_timeout(4500)   # record sync (2.2s collect + publish)
with sync_playwright() as p:
    br=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    def mk(): c=br.new_context(viewport={'width':420,'height':900}); pg=c.new_page(); pg.on('pageerror',lambda e:errors.append(str(e))); return pg
    A=mk(); solo(A,'Ann'); 
    B=mk(); solo(B,'Ben')
    print('retained record topics on relay:',len([t for t in fb.RET if '/records/' in t]))
    # a third device that never played sees both
    C=mk(); C.goto(URL); C.wait_for_timeout(400); C.click('#recordsBtn'); C.wait_for_timeout(4000)
    t=C.inner_text('#recBody'); print('C status:',C.inner_text('#recStatus')); print('C sees Ann & Ben:','Ann' in t,'Ben' in t)
    assert 'Ann' in t and 'Ben' in t
    print('no clear button:',C.query_selector('#recClear') is None)
    # wipe the relay (rage quit) then Ann opens records -> restores
    for k in [k for k in fb.RET if '/records/' in k]: fb.RET.pop(k)
    A.goto(URL); A.wait_for_timeout(400); A.click('#recordsBtn'); A.wait_for_timeout(5000)
    print('after wipe + Ann opens records, relay topics:',len([t for t in fb.RET if '/records/' in t]))
    # worse result does not overwrite: tamper test, publish a worse Ann entry
    ann=[json.loads(v) for k,v in fb.RET.items() if '/records/' in k and json.loads(v)['n']=='Ann'][0]
    best=ann['t']['v']; ann['t']['v']=1
    import urllib.request
    topic=[k for k in fb.RET if '/records/' in k and json.loads(fb.RET[k])['n']=='Ann'][0]
    urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8770/pub',json.dumps({'cid':'x','topic':topic,'payload':json.dumps(ann),'retain':True}).encode()))
    D=mk(); D.goto(URL); D.wait_for_timeout(400); D.click('#recordsBtn'); D.wait_for_timeout(4000)
    print('D shows Ann best total (should be >1):',re.findall(r'Ann[^\n]*\n[^\n]*\n?(R[\s\d ]+)',D.inner_text('#recBody'))[:1], 'orig',best)
    A.goto(URL); A.wait_for_timeout(400); A.click('#recordsBtn'); A.wait_for_timeout(5000)
    a2=json.loads(fb.RET[topic]); print('after Ann reopens, relay Ann best restored:',a2['t']['v']==best)
    br.close()
print('ERRORS',[e for e in errors] or 'none')
