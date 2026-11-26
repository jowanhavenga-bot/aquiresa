import re,json,time
from playwright.sync_api import sync_playwright
from harness import *
import fakebroker as fb
page=wrap(open('page.html',encoding='utf-8').read())
page=page.replace('<body>','<body><script>'+fb.FAKE_JS+'</script>',1)
fb.start(page.encode('utf-8'),8791)
URL='http://127.0.0.1:8791/page.html'
errors=[]
def mk(br,name):
    c=br.new_context(viewport={'width':420,'height':900}); pg=c.new_page()
    pg.on('pageerror',lambda e:errors.append(name+': '+str(e)))
    pg.goto(URL); pg.wait_for_timeout(500); pg.fill('#nameInput',name); return c,pg
def finish(pg,limit=240):
    t0=time.time();seen={}
    while time.time()-t0<limit:
        r=pg.evaluate(DRIVER); seen[r]=seen.get(r,0)+1
        if r=='dispose-set': pg.evaluate(DISPOSE_OK)
        if r=='over': return True
        if r=='wait': pg.wait_for_timeout(30)
    return False
with sync_playwright() as p:
    br=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    # ---------- toggles UI ----------
    c,H=mk(br,'Hanna')
    print('daily card visible by default:',H.is_visible('#dailyPanel'))
    H.click('#hideEvents'); H.click('#hideHcap'); print('hcap seg visible:',H.is_visible('#hcapSeg'),'| pressed events/hcap:',H.get_attribute('#hideEvents','aria-pressed'),H.get_attribute('#hideHcap','aria-pressed'))
    print('beginner checkboxes visible:',H.is_visible('#lbeg0'))
    H.click('#hideHcap'); print('hcap seg hidden after off:',not H.is_visible('#hcapSeg'))
    H.click('#prefDaily'); print('daily card hidden after toggle:',not H.is_visible('#dailyPanel')); H.click('#prefDaily')
    print('descs:',[x[:50] for x in H.eval_on_selector_all('#hideEvents small, #hideHcap small, #prefDaily small, #prefReact small','e=>e.map(x=>x.textContent)')])
    # ---------- daily: same tiles for everyone ----------
    ca,A=mk(br,'Ann'); cb,B=mk(br,'Ben')
    outs=[]
    for pg in (A,B):
        pg.click('#dailyBtn'); pg.wait_for_timeout(400)
        hand=pg.eval_on_selector_all('#hand [data-t]','e=>e.map(x=>x.dataset.t).sort((a,b)=>a-b).join(",")')
        pl=pg.inner_text('#players').replace('you','').replace('\n','|')
        names=pg.eval_on_selector_all('#players .nm, #players [class*=nm]','e=>e.map(x=>x.textContent)')
        outs.append((hand,re.sub(r'(Ann|Ben)','X',pl)[:200]))
    print('A hand',outs[0][0],'| B hand',outs[1][0]); print('same hands:',outs[0][0]==outs[1][0],'| same opponents/seat order:',outs[0][1]==outs[1][1])
    print('topinfo:',A.inner_text('#topinfo'))
    print('A finished:',finish(A)); print('B finished:',finish(B))
    A.wait_for_timeout(500)
    print('end button:',A.inner_text('#actions [data-a=rematch]') if A.query_selector('#actions [data-a=rematch]') else A.inner_text('.row [data-a=rematch]'))
    A.click('[data-a=dailyboard]'); A.wait_for_timeout(4500)
    print('A board:',A.inner_text('#dailyBody').replace('\n',' | ')[:200]); print('status:',A.inner_text('#dailyStatus'))
    cc,C=mk(br,'Cara'); C.click('#dailyBoardBtn'); C.wait_for_timeout(4500)
    body=C.inner_text('#dailyBody').replace('\n',' | '); print('C (fresh) sees:',body[:200]); print('C sees Ann+Ben:','Ann' in body and 'Ben' in body)
    C.click('#dailyBack'); C.wait_for_timeout(300); C.reload(); C.wait_for_timeout(500); print('daily topics on relay:',len([t for t in fb.RET if 'daily' in t]))
    # ---------- online: events + handicap + reactions + rotate ----------
    ch,HA=mk(br,'Hosty'); cg,GB=mk(br,'Guesty')
    HA.click('#hideEvents'); HA.click('#hideHcap'); HA.click('#hostBtn'); HA.wait_for_timeout(2500)
    code=HA.inner_text('#lobbyCode'); GB.fill('#codeInput',code); GB.click('#joinBtn'); GB.wait_for_timeout(1500)
    print('host lobby events/hcap on:',HA.get_attribute('#lobbyHide [data-h=events]','aria-pressed'),HA.get_attribute('#lobbyHide [data-h=hcap]','aria-pressed'),'| hcap seg:',HA.is_visible('#lobbyHcap'))
    HA.click('#lobbyHide [data-h="hcap"]'); HA.wait_for_timeout(300); HA.click('#lobbyHide [data-h="hcap"]'); HA.wait_for_timeout(500)
    beg=[b for b in HA.query_selector_all('[data-beg]')]; print('beginner buttons:',len(beg))
    HA.query_selector('#plist li:nth-child(2) [data-beg]').click(); HA.wait_for_timeout(1200)
    print('guest sees beginner badge:','beginner' in GB.inner_text('#plist'))
    print('guest lobby note:',GB.inner_text('#lobbyMode')[-120:])
    HA.click('[data-l=start]'); HA.wait_for_timeout(2000)
    for n,pg in (('host',HA),('guest',GB)):
        print(n,'hand size',pg.eval_on_selector_all('#hand [data-t]','e=>e.length'))
    # reaction
    GB.click('#reactBar [data-re="1"]'); HA.wait_for_timeout(1500)
    print('host sees reaction:',HA.inner_text('#rfloat').replace('\n',' '),'| guest sees own:',GB.inner_text('#rfloat').replace('\n',' '))
    # play with event watch
    t0=time.time();evseen=0;tagseen=0;done=0;nclose=0
    while time.time()-t0<400:
        done=0
        for n,pg in (('H',HA),('G',GB)):
            r=pg.evaluate(DRIVER)
            if r=='dispose-set': pg.evaluate(DISPOSE_OK)
            if r=='over': done+=1
        if done==2: break
        if int(time.time()*5)%7==0:
            if HA.is_visible('#evnote'): evseen+=1
            if HA.query_selector('.evtag'): tagseen+=1
    print('finished',done==2,'| event note seen frames:',evseen,'| price tag seen:',tagseen)
    log=HA.inner_text('#log'); print('market events in log:',len(re.findall('Market event',HA.evaluate("()=>[...document.querySelectorAll('#log li')].map(x=>x.textContent).join('\\n')"))))
    print('guest sees same total log:',GB.evaluate("()=>document.querySelectorAll('#log li').length")==HA.evaluate("()=>document.querySelectorAll('#log li').length"))
    order1=HA.eval_on_selector_all('#players .nm','e=>e.map(x=>x.textContent)') 
    HA.click('[data-a=rematch]'); HA.wait_for_timeout(2500)
    logs=HA.evaluate("()=>[...document.querySelectorAll('#log li')].map(x=>x.textContent)")
    print('rotation log:',[l for l in logs if 'Seats rotate' in l or 'goes first' in l or 'Handicap' in l])
    print('guest after rematch in game:',GB.is_visible('#game'),'| guest hand',GB.eval_on_selector_all('#hand [data-t]','e=>e.length'))
    # records stats
    HA.click('#menuBtn') if HA.is_visible('#menuBtn') else None
    br.close()
print('ERRORS:',errors[:10] if errors else 'none')
