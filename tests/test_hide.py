import re,json
from playwright.sync_api import sync_playwright
from harness import *
import fakebroker as fb
page=wrap(open('page.html',encoding='utf-8').read())
page=page.replace('<body>','<body><script>'+FAST+fb.FAKE_JS+'</script>',1)
fb.start(page.encode('utf-8'),8768)
URL='http://127.0.0.1:8768/page.html'
errors=[]
with sync_playwright() as p:
    br=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    ctx=br.new_context(); A=ctx.new_page(); A.on('pageerror',lambda e:errors.append(str(e)))
    A.goto(URL); A.wait_for_timeout(500); A.fill('#nameInput','Thabo')
    A.click('#hideShares'); A.click('#hideWorth'); print(A.inner_text('#hideNote'))
    A.click('#botSeg button[data-n="2"]'); A.click('#soloBtn'); A.wait_for_timeout(500)
    leak=0;sawhid=0;oth=0
    for i in range(1500):
        r=A.evaluate(DRIVER)
        if r=='dispose-set': A.evaluate(DISPOSE_OK)
        if i%4==0:
            t=A.inner_text('#players')
            if 'if ended now' in t: leak+=1
            if t.count('shares hidden')==2: sawhid+=1
            if re.search(r'\b(buys|sells|keeps|trades)\b.*(Takealot|Woolworths|Vodacom|MTN|Capitec|Checkers|Naspers|Shoprite|Pick|Discovery)',A.inner_text('#log')) : oth+=1
        if r=='over': break
    print('leak frames',leak,'hidden frames',sawhid,'log leaks',oth)
    print('over:',A.is_visible('#endPanel'),'| final players:',A.inner_text('#players').replace('\n',' ')[:160])
    assert 'shares hidden' not in A.inner_text('#players')
    # host lobby toggle over relay, guest sees it
    cb=br.new_context(); B=cb.new_page(); B.on('pageerror',lambda e:errors.append(str(e)))
    B.goto(URL); B.wait_for_timeout(500); B.fill('#nameInput','Ben')
    A.goto(URL); A.wait_for_timeout(500); A.fill('#nameInput','Ann'); A.click('#hostBtn'); A.wait_for_timeout(2500)
    code=A.inner_text('#lobbyCode'); B.fill('#codeInput',code); B.click('#joinBtn'); B.wait_for_timeout(1500)
    assert not B.is_visible('#lobbyHide'),'guest sees toggles'
    A.click('#lobbyHide [data-h=shares]'); A.wait_for_timeout(1200)
    print('guest lobby note:',B.inner_text('#lobbyMode'))
    A.click('[data-l=start]'); A.wait_for_timeout(1500)
    print('A players:',A.inner_text('#players').replace('\n',' | ')[:140]); print('B players:',B.inner_text('#players').replace('\n',' | ')[:140])
    br.close()
print('ERRORS:',errors or 'none')
