import os,re
from playwright.sync_api import sync_playwright
from harness import *
open('wrapped.html','w',encoding='utf-8').write(wrap(open('page.html',encoding='utf-8').read()))
errors=[]
url='file://'+os.path.abspath('wrapped.html')
with sync_playwright() as p:
    br=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    ctx=br.new_context(viewport={'width':390,'height':844},device_scale_factor=1)
    pg=ctx.new_page()
    pg.on('pageerror',lambda e:errors.append('pageerror: '+str(e)))
    pg.on('console',lambda m:errors.append('console: '+m.text) if m.type=='error' and 'Failed to load' not in m.text else None)
    pg.add_init_script(FAST+"window.claude={use:async n=>null};")
    pg.goto(url); pg.wait_for_timeout(200)
    # setup: 3 humans, 1 AI, own names
    pg.click('#localSeg button[data-n="3"]')
    assert pg.locator('#localNames input[type=text]').count()==3
    pg.fill('#lname0','Ann'); pg.fill('#lname1','Ben'); pg.fill('#lname2','Cara')
    pg.click('#localSeg button[data-n="5"]')               # grow to 5: names kept
    assert pg.input_value('#lname1')=='Ben', 'names should survive count change'
    assert pg.locator('#localAiSeg button[data-n="2"]').is_disabled(), 'AI seats must respect the 6 cap'
    pg.click('#localSeg button[data-n="3"]')
    pg.click('#localAiSeg button[data-n="1"]')
    pg.locator('#localPanel').scroll_into_view_if_needed(); pg.locator('#localPanel').screenshot(path='local_setup.png')
    pg.click('#localBtn'); pg.wait_for_timeout(300)
    seen=[];hands={};overlays=0;n=0;shot=False;resumed=False;hand_leak=0
    while n<8000:
        if pg.is_visible('#pass'):
            name=pg.inner_text('#passName'); overlays+=1
            if not pg.is_hidden('#handPanel'): hand_leak+=1
            if not shot: pg.screenshot(path='local_pass.png'); shot=True
            seen.append(name)
            # mid-game reload + resume once, must land on the cover screen again
            if overlays==7 and not resumed:
                resumed=True
                pg.reload(); pg.wait_for_timeout(300)
                assert pg.is_visible('#resumeLocalBtn'),'resume button missing'
                pg.click('#resumeLocalBtn'); pg.wait_for_timeout(200)
                assert pg.is_visible('#pass') and pg.inner_text('#passName')==name,'resume should show the cover for '+name
            pg.click('#passBtn'); pg.wait_for_timeout(30)
            hands.setdefault(name,set()).add(tuple(sorted(pg.locator('#hand [data-t]').evaluate_all('els=>els.map(e=>e.dataset.t)'))))
            assert not pg.is_visible('#pass')
            continue
        r=pg.evaluate(DRIVER)
        if r=='dispose-set': pg.evaluate(DISPOSE_OK)
        if r=='over': break
        if r=='wait': pg.wait_for_timeout(20)
        n+=1
    print('driver steps',n,'cover screens shown',overlays,'resumed mid-game',resumed)
    # cover order should rotate through the three humans, never the AI
    names=set(seen); print('cover screens named:',sorted(names))
    assert names<= {'Ann','Ben','Cara'}, 'AI must never get a cover screen'
    assert hand_leak==0,'hand visible behind the cover'
    # tiles differ between players
    first={k:sorted(v)[0] for k,v in hands.items()}
    assert len(set(first.values()))==len(first),'players should hold different tiles'
    # no consecutive duplicate cover for the same person (they only get one per hand-over)
    dup=sum(1 for a,b in zip(seen,seen[1:]) if a==b); print('back-to-back covers for same player:',dup)
    print('end:',pg.inner_text('#stT1'),'|',pg.is_visible('#pass'),'cover at end')
    print('end panel visible:',pg.is_visible('#endPanel'),' play again button:',pg.locator('#actions [data-a=rematch]').count())
    pg.click('#actions [data-a=rematch]'); pg.wait_for_timeout(300)
    print('after play again:',pg.inner_text('#passName') if pg.is_visible('#pass') else pg.inner_text('#stT1'))
    # leaving clears cover and shows home
    if pg.is_visible('#pass'): pg.click('#passBtn')
    pg.click('#menuBtn'); pg.click('#leaveBtn'); pg.click('#leaveBtn'); pg.wait_for_timeout(100)
    print('home visible:',pg.is_visible('#home'),'resume local offered:',pg.is_visible('#resumeLocalBtn'))
    print('scrollWidth',pg.evaluate("document.documentElement.scrollWidth"))
    br.close()
print('ERRORS:',errors or 'none')
