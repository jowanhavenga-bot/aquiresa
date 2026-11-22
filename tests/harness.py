import re
def wrap(page_html):
    return ('<!doctype html><html><head><meta charset="utf8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
            '<style>:root{color-scheme:light}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>'
            + page_html + '</body></html>')
FAST = "const _st=window.setTimeout;window.setTimeout=(f,d,...a)=>_st(f,Math.min(d||0,15),...a);"
DRIVER = """
() => {
  const q=s=>document.querySelector(s), act=q('#actions');
  const first=sel=>act.querySelector(sel);
  let b;
  if(first('[data-a=rematch]')||first('[data-a=home]')) return 'over';
  if(b=first('[data-a=place]')){b.click();return 'place'}
  if(b=first('[data-a^="found:"]')){b.click();return 'found'}
  if(b=first('[data-a^="surv:"]')){b.click();return 'surv'}
  if(b=first('[data-a^="ord:"]')){b.click();return 'ord'}
  if(first('[data-a=dok]')){
    const pick=['dall','dmax','dkeep'][Math.floor(Math.random()*3)];
    const bb=first('[data-a='+pick+']'); bb.click();
    // after click the panel re-renders; confirm in the next tick
    return 'dispose-set';
  }
  if(first('[data-a=dok]')===null && false){}
  if(first('[data-a=bok]')){
    const plus=[...act.querySelectorAll('[data-a^="bplus:"]')].filter(x=>!x.disabled);
    if(plus.length && Math.random()<0.8){plus[Math.floor(Math.random()*plus.length)].click();return 'buy-plus'}
    const end=first('[data-a=bend]'); if(end && Math.random()<0.6){end.click();return 'buy-end'}
    first('[data-a=bok]').click();return 'buy-ok'
  }
  const end=first('[data-a=end]'); 
  const tiles=[...document.querySelectorAll('#hand [data-t]:not(:disabled)')];
  if(tiles.length){ if(end && Math.random()<0.5){end.click();return 'end'} tiles[Math.floor(Math.random()*tiles.length)].click();return 'select'}
  return 'wait';
}
"""
DISPOSE_OK = "()=>{const b=document.querySelector('#actions [data-a=dok]'); if(b){b.click();return true} return false}"
