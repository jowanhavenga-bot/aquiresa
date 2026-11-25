import sys,re,time
from playwright.sync_api import sync_playwright
from harness import *
import fakebroker as fb
page=wrap(open('page.html',encoding='utf-8').read())
page=page.replace('<body>','<body><script>'+FAST+fb.FAKE_JS+'</script>',1)
fb.start(page.encode('utf-8'))
URL='http://127.0.0.1:8766/page.html'
errors=[]
def mk(br,name):
    ctx=br.new_context(viewport={'width':900,'height':950}); pg=ctx.new_page()
    pg.on('pageerror',lambda e:errors.append(name+' pageerror: '+str(e)))
    pg.on('console',lambda m:errors.append(name+' console: '+m.text) if m.type=='error' and 'Failed to load resource' not in m.text else None)
    pg.goto(URL); pg.wait_for_timeout(500); pg.fill('#nameInput',name); return ctx,pg
with sync_playwright() as p:
    br=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    ca,A=mk(br,'Ann'); cb,B=mk(br,'Ben'); cc,C=mk(br,'Cat')
    assert not A.evaluate("()=>document.querySelector('#hostBtn').disabled"),'host disabled'
    A.click('#hostBtn'); A.wait_for_timeout(2500)
    code=A.inner_text('#lobbyCode'); print('code',code); assert re.fullmatch(r'[PEH][A-Z2-9]{4}',code),code
    B.fill('#codeInput',code.lower()); B.click('#joinBtn'); B.wait_for_timeout(1500)
    C.fill('#codeInput',code); C.click('#joinBtn'); C.wait_for_timeout(1500)
    A.wait_for_timeout(500)
    for n,f in (('A',A),('B',B),('C',C)): print(n,f.inner_text('#plist').replace('\n',' | '))
    assert B.is_visible('#lobby') and not B.is_visible('[data-l=start]')
    assert 'Cat' in A.inner_text('#plist') and 'Ben' in C.inner_text('#plist')
    # bad code
    ca2,D=mk(br,'Dan'); D.fill('#codeInput','EZZZZ'); D.click('#joinBtn'); D.wait_for_timeout(2500); print('bad code toast:',D.inner_text('#toast')); assert D.is_visible('#home')
    # guest reload in lobby, rejoin
    C.reload(); C.wait_for_timeout(600); print('rejoin visible:',C.is_visible('#rejoinBtn'))
    A.click('[data-l=addbot]'); A.wait_for_timeout(500)
    A.click('[data-l=start]'); A.wait_for_timeout(1500)
    for n,f in (('A',A),('B',B)): assert f.is_visible('#game'),n+' not in game'
    # C reloaded: rejoin
    if C.is_visible('#rejoinBtn'): C.fill('#nameInput','Cat'); C.click('#rejoinBtn'); C.wait_for_timeout(2500); print('C in game after rejoin:',C.is_visible('#game'))
    pages=[('A',A),('B',B),('C',C)]
    steps=0;seen={}
    t0=time.time()
    while steps<60000 and time.time()-t0<420:
        done=0
        for n,f in pages:
            if not f.is_visible('#game'): continue
            r=f.evaluate(DRIVER); seen[r]=seen.get(r,0)+1
            if r=='dispose-set': f.evaluate(DISPOSE_OK)
            if r=='over': done+=1
        if done==3: break
        steps+=1
        if steps%3==0: A.wait_for_timeout(30)
    print('finished',steps,seen,round(time.time()-t0))
    A.wait_for_timeout(1500)
    norm=lambda t:re.sub(r'\\byou\\b','',t,flags=re.I).replace('\\n','|').replace('||','|').replace(' ','')
    outs=[norm(f.inner_text('#players')) for n,f in pages]
    print('agree:',outs[0]==outs[1]==outs[2]); 
    if not outs[0]==outs[1]==outs[2]: print(outs)
    print(A.inner_text('#actions').replace('\\n',' | ')[:200])
    # forged/stale guest messages must be ignored
    revbefore=A.evaluate("()=>1")
    br.close()
print('relay log topics:',len(fb.LOG))
print('ERRORS:',errors[:10] if errors else 'none')
