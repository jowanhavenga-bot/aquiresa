import re,json
from playwright.sync_api import sync_playwright
from harness import *
import fakebroker as fb
page=wrap(open('page.html',encoding='utf-8').read())
page=page.replace('<body>','<body><script>'+FAST+fb.FAKE_JS+'</script>',1)
fb.start(page.encode('utf-8'),8767)
URL='http://127.0.0.1:8767/page.html'
errors=[]
def mk(br,name,down=False):
    ctx=br.new_context(); pg=ctx.new_page()
    pg.on('pageerror',lambda e:errors.append(name+': '+str(e)))
    if down: pg.add_init_script('window.__emqxDown=true')
    pg.goto(URL); pg.wait_for_timeout(400); pg.fill('#nameInput',name); return ctx,pg
with sync_playwright() as p:
    br=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    # fallback: EMQX down for host -> code starts with H
    ca,A=mk(br,'Ann',True); A.click('#hostBtn'); A.wait_for_timeout(11000)
    code=A.inner_text('#lobbyCode'); print('fallback code',code); assert code[0]=='H'
    cb,B=mk(br,'Ben',True); B.fill('#codeInput',code); B.click('#joinBtn'); B.wait_for_timeout(2500)
    assert B.is_visible('#lobby'); 
    A.click('[data-l=addbot]'); A.wait_for_timeout(500); A.click('[data-l=start]'); A.wait_for_timeout(1500)
    # play a few moves
    for i in range(40):
        for f in (A,B):
            r=f.evaluate(DRIVER)
            if r=='dispose-set': f.evaluate(DISPOSE_OK)
        A.wait_for_timeout(40)
    rev=lambda f:f.evaluate("()=>document.querySelector('#log')?document.querySelector('#log').innerText.length:0")
    # forged messages straight to the relay
    gid=None
    st=[v for t,v in fb.RET.items() if t.endswith('/state')][0]; s=json.loads(st); gid=s['gid']; r0=s['rev']
    topic=[t for t in fb.RET if t.endswith('/state')][0].replace('/state','/in')
    def forge(m):
        import urllib.request
        urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8767/pub',json.dumps({'cid':'x','topic':topic,'payload':json.dumps(m),'retain':False}).encode()))
    bot=[p for p in s['players'] if p['bot']][0]['id']
    forge({'t':'act','id':bot,'gid':gid,'rev':s['rev'],'action':{'type':'place','tile':0}})
    forge({'t':'act','id':'nobody','gid':gid,'rev':s['rev'],'action':{'type':'declareEnd'}})
    forge({'t':'act','id':s['players'][0]['id'],'gid':gid,'rev':s['rev'],'action':{'type':'toBot'}})
    forge({'t':'act','id':s['players'][0]['id'],'gid':gid,'rev':s['rev']-1,'action':{'type':'declareEnd'}})
    A.wait_for_timeout(800)
    s2=json.loads([v for t,v in fb.RET.items() if t.endswith('/state')][0])
    print('forgeries ignored:',s2['rev']==s['rev'] or s2['rev']==s['rev']+1,'rev',s['rev'],'->',s2['rev'],'| human bots count',sum(p['bot'] for p in s2['players']))
    assert sum(p['bot'] for p in s2['players'])==1
    # host reload -> resume from retained state
    A.reload(); A.wait_for_timeout(600); print('rejoin btn',A.is_visible('#rejoinBtn'))
    A.fill('#nameInput','Ann'); A.click('#rejoinBtn'); A.wait_for_timeout(3000)
    print('host back in game:',A.is_visible('#game'),'| rev',json.loads([v for t,v in fb.RET.items() if t.endswith('/state')][0])['rev'])
    for i in range(30):
        for f in (A,B):
            r=f.evaluate(DRIVER)
            if r=='dispose-set': f.evaluate(DISPOSE_OK)
        A.wait_for_timeout(40)
    s3=json.loads([v for t,v in fb.RET.items() if t.endswith('/state')][0]); print('progress after resume:',s3['rev']>s2['rev'])
    # lobby prune: guest vanishes
    cc,C=mk(br,'Cat'); 
    br.close()
print('ERRORS:',errors or 'none')
