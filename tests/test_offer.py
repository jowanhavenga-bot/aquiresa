import re,json
from playwright.sync_api import sync_playwright
from harness import *
import fakebroker as fb
page=wrap(open('page.html',encoding='utf-8').read())
page=page.replace('<body>','<body><script>'+FAST+fb.FAKE_JS+'</script>',1)
fb.start(page.encode('utf-8'),8769)
URL='http://127.0.0.1:8769/page.html'
errors=[]
with sync_playwright() as p:
    br=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    def mk(name):
        c=br.new_context(viewport={'width':900,'height':950}); pg=c.new_page(); pg.on('pageerror',lambda e:errors.append(name+': '+str(e)))
        pg.goto(URL); pg.wait_for_timeout(500); pg.fill('#nameInput',name); return pg
    A=mk('Ann'); B=mk('Ben')
    A.click('#hideFounders'); A.click('#hideOffers')
    A.click('#hostBtn'); A.wait_for_timeout(2500); code=A.inner_text('#lobbyCode')
    B.fill('#codeInput',code); B.click('#joinBtn'); B.wait_for_timeout(1500)
    print('guest note:',B.inner_text('#lobbyMode'))
    A.click('[data-l=start]'); A.wait_for_timeout(1500)
    pages=[A,B]; done=False; sent=False; tries=0
    for i in range(3000):
        for f in pages:
            r=f.evaluate(DRIVER)
            if r=='dispose-set': f.evaluate(DISPOSE_OK)
        # try making an offer when possible
        if not sent:
            for f,o in ((A,B),(B,A)):
                if f.query_selector('#actions [data-a=oform]'):
                    # does the other hold shares? just try
                    f.click('#actions [data-a=oform]')
                    for k in range(3): f.click('#actions [data-a="oam:1000"]')
                    f.click('#actions [data-a=osend]'); f.wait_for_timeout(1200)
                    txt=o.inner_text('#actions')
                    if 'Offer from' in txt:
                        print('receiver sees:',txt.replace('\n',' | ')[:230])
                        print('sender sees:',f.inner_text('#actions').replace('\n',' | ')[:150])
                        o.click('#actions [data-a=oyes]'); o.wait_for_timeout(1200)
                        print('log:',f.inner_text('#log').split('\n')[0:2]); sent=True
                    else:
                        print('offer failed:',f.inner_text('#toast')[:80]); 
                        f.evaluate("()=>{const b=document.querySelector('#actions [data-a=oclose]');b&&b.click()}")
                    break
        if sent: break
        A.wait_for_timeout(30)
    print('sent',sent)
    # play to end, count founder bonuses in log
    for i in range(30000):
        d=0
        for f in pages:
            r=f.evaluate(DRIVER)
            if r=='dispose-set': f.evaluate(DISPOSE_OK)
            if r=='over': d+=1
        if d==2: break
        if i%3==0: A.wait_for_timeout(25)
    print('finished; founder lines:',A.inner_text('#log').count("founder's bonus"),'| offers in log:',A.inner_text('#log').count('offers'))
    br.close()
print('ERRORS',errors or 'none')
