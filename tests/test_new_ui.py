import re
from playwright.sync_api import sync_playwright
from harness import *
page=wrap(open('page.html',encoding='utf-8').read()); page=page.replace('<body>','<body><script>'+FAST+'</script>',1)
open('wrapped_new.html','w',encoding='utf-8').write(page)
errors=[]
with sync_playwright() as p:
    br=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    ctx=br.new_context(viewport={'width':420,'height':900}); pg=ctx.new_page(); pg.on('pageerror',lambda e:errors.append(str(e)))
    pg.on('console',lambda m:errors.append('console '+m.text) if m.type=='error' else None)
    import os; pg.goto('file://'+os.path.abspath('wrapped_new.html')); pg.wait_for_timeout(500)
    pg.fill('#nameInput','Thabo')
    pg.click('#lvlSeg [data-v=hard]'); pg.click('#persSeg [data-v=ruthless]'); pg.click('#prefPreview')
    print('ai note:',pg.inner_text('#aiNote'))
    pg.click('#botSeg button[data-n="2"]'); pg.click('#soloBtn'); pg.wait_for_timeout(400)
    print('players:',pg.inner_text('#players').replace('\n',' | ')[:200])
    shown=None
    for i in range(4000):
        r=pg.evaluate(DRIVER)
        if r=='dispose-set': pg.evaluate(DISPOSE_OK)
        if shown is None and i%3==0:
            t=pg.evaluate("""()=>{var hs=document.querySelectorAll('#hand [data-tile], #hand button');for(var k=0;k<hs.length;k++){hs[k].click();var a=document.querySelector('#actions').innerText;if(a.indexOf('Payout preview')>=0)return a}return null}""")
            if t: shown=t; print('PREVIEW:',t.replace('\n',' | ')[:420])
        if r=='over': break
    print('over',pg.is_visible('#endPanel'))
    # records
    pg.click('[data-a=home]') if pg.query_selector('[data-a=home]') else None
    pg.wait_for_timeout(300); pg.click('#recordsBtn'); pg.wait_for_timeout(300)
    print('RECORDS:',pg.inner_text('#recBody').replace('\n',' | ')[:500])
    print('visible home/records:',pg.is_visible('#home'),pg.is_visible('#records'))
    pg.click('#recBack'); pg.wait_for_timeout(200); print('home again',pg.is_visible('#home'))
    # sound toggle plays without error
    pg.click('#prefSound'); pg.click('#prefSound'); pg.wait_for_timeout(300)
    # local pass and play with AI count 1 keeps pers/lvl
    br.close()
print('ERRORS',errors or 'none')
