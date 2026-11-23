import re
from playwright.sync_api import sync_playwright
from harness import *
page=wrap(open('page.html',encoding='utf-8').read()); page=page.replace('<body>','<body><script>'+FAST+'</script>',1)
open('wrapped_cap.html','w',encoding='utf-8').write(page)
errors=[]
with sync_playwright() as p:
    br=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=br.new_context(viewport={'width':900,'height':950}).new_page(); pg.on('pageerror',lambda e:errors.append(str(e)))
    pg.goto('file://'+__import__('os').path.abspath('wrapped_cap.html')); pg.wait_for_timeout(500)
    pg.fill('#nameInput','Thabo'); pg.click('#hideOffers'); pg.click('#botSeg button[data-n="2"]'); pg.click('#soloBtn'); pg.wait_for_timeout(400)
    ok=False
    for i in range(2500):
        r=pg.evaluate(DRIVER)
        if r=='dispose-set': pg.evaluate(DISPOSE_OK)
        if pg.query_selector('#actions [data-a=oform]'):
            pg.click('#actions [data-a=oform]')
            held=pg.evaluate("()=>{const s=JSON.parse(localStorage.getItem('asa-solo')).state;return 0}")
            txt=pg.inner_text('#actions'); m=re.search(r'holds (\d+)',txt)
            if m and int(m.group(1))>=1:
                n=int(m.group(1))
                for k in range(30):
                    b=pg.query_selector('#actions [data-a=oqp]')
                    if b and not b.is_disabled(): b.click()
                q=int(pg.inner_text('#actions .stepper .n'))
                print('holds',n,'max qty reachable',q); assert q==n; ok=True; break
            pg.click('#actions [data-a=oclose]')
        pg.wait_for_timeout(5)
    print('verified',ok,errors or 'no errors')
    br.close()
