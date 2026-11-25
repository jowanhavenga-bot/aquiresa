import re,json,time
from playwright.sync_api import sync_playwright
from harness import *
import fakebroker as fb
page=wrap(open('page.html',encoding='utf-8').read())
page=page.replace('<body>','<body><script>'+fb.FAKE_JS+'</script>',1)
fb.start(page.encode('utf-8'),8772)
URL='http://127.0.0.1:8772/page.html'
errors=[]
with sync_playwright() as p:
    br=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    def mk(name):
        c=br.new_context(viewport={'width':420,'height':900}); pg=c.new_page(); pg.on('pageerror',lambda e:errors.append(name+': '+str(e)))
        pg.goto(URL); pg.wait_for_timeout(500); pg.fill('#nameInput',name); return pg
    A=mk('Ann'); B=mk('Ben')
    # tour
    A.click('#tourBtn'); n=1
    while A.inner_text('#tourNext')!='Done': A.click('#tourNext'); n+=1
    print('tour slides',n,'| last title:',A.inner_text('#tourBody h2')); A.click('#tourNext'); print('tour closed:',not A.is_visible('#tour'))
    # host with timer 30 + founders
    A.click('#hideFounders'); A.click('#timerSeg [data-v="30"]'); A.click('#hostBtn'); A.wait_for_timeout(2500)
    code=A.inner_text('#lobbyCode'); B.fill('#codeInput',code); B.click('#joinBtn'); B.wait_for_timeout(1500)
    print('guest lobby note:',B.inner_text('#lobbyMode')[-110:])
    A.click('[data-l=start]'); A.wait_for_timeout(1500)
    print('clock A:',A.inner_text('#clock'),'| clock B:',B.inner_text('#clock'))
    # who is acting?
    actor=A.evaluate("()=>document.querySelector('#stT1').innerText"); print('status:',actor)
    waiting=B if 'Your turn' in actor else A; acting=A if 'Your turn' in actor else B
    nm=lambda f:'Ann' if f is A else 'Ben'
    # nudge
    waiting.click('#actions [data-a=nudge]'); acting.wait_for_timeout(1200); print('nudge toast on actor:',acting.inner_text('#toast'))
    # let the timer expire
    t0=time.time(); acting.wait_for_timeout(33000)
    log=A.evaluate("()=>document.querySelector('#log').textContent"); print('auto-play logged:','ran out of time' in log, round(time.time()-t0))
    # play on and look for merger explainer
    seen=False; fl=False
    for i in range(6000):
        for f in (A,B):
            r=f.evaluate(DRIVER)
            if r=='dispose-set': f.evaluate(DISPOSE_OK)
        if not seen and A.is_visible('#mnote'): seen=True; print('MNOTE:',A.inner_text('#mnote')[:300])
        if i%3==0: A.wait_for_timeout(25)
        if seen: break
    print('merger note shown:',seen)
    log=A.evaluate("()=>document.querySelector('#log').textContent"); print('founder line:',re.findall(r'[A-Za-z]+ gets R[^.]*as the founder[^.]*',log)[:1])
    br.close()
print('ERRORS',errors or 'none')
