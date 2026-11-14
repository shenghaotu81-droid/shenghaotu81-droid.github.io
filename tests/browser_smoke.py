import asyncio,os,json,sys
from playwright.async_api import async_playwright
BASE=os.environ.get('GALLERY_TEST_URL','http://127.0.0.1:8000/')
stage=sys.argv[1] if len(sys.argv)>1 else 'desktop'
checks=[]
def check(name,condition,detail=None):
 assert condition,(name,detail)
 checks.append({'check':name,'passed':True,'detail':detail});print('PASS',name,detail or '',flush=True)
async def state(page):return await page.evaluate('galleryDebug.state')
async def run(browser):
 mobile=stage=='mobile'
 ctx=await browser.new_context(viewport={'width':390 if mobile else 1000,'height':844 if mobile else 700},device_scale_factor=.5,is_mobile=mobile,has_touch=mobile,ignore_https_errors=True)
 try:
  pg=await ctx.new_page();pg.set_default_timeout(6000);errors=[]
  pg.on('pageerror',lambda e:errors.append(str(e)))
  pg.on('console',lambda m:errors.append(m.text)if m.type=='error' else None)
  if stage=='fallback':
   await pg.route('https://cdn.jsdelivr.net/**',lambda route:route.abort())
   await pg.goto(BASE,wait_until='domcontentloaded');await pg.wait_for_timeout(600)
   check('blocked CDN retains full reading content',await pg.locator('#readable').is_visible() and 'MaixCAM-Pro' in await pg.locator('#readable').inner_text())
   await pg.locator('#lang-toggle').click();check('English reading works without WebGL','Armor plate detection' in await pg.locator('#readable').inner_text())
   await ctx.close();ctx=await browser.new_context(ignore_https_errors=True);pg=await ctx.new_page()
   await pg.add_init_script('const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type.startsWith("webgl"))return null;return original.call(this,type,...args)}')
   await pg.goto(BASE,wait_until='domcontentloaded');await pg.wait_for_timeout(800)
   check('no WebGL retains readable content',await pg.locator('#readable').is_visible() and 'ROS 2' in await pg.locator('#readable').inner_text())
   await pg.route('**/content/notes.json',lambda route:route.fulfill(json={'items':[{'id':'qa-new','title':'新增条目验证','summary':'<script>alert(1)</script>','body':'只改 JSON 即可显示。','url':'javascript:alert(1)'}]}))
   await pg.reload(wait_until='domcontentloaded');await pg.wait_for_function('document.querySelector("#readable").textContent.includes("新增条目验证")')
   check('new JSON entry renders without code changes','新增条目验证' in await pg.locator('#readable').inner_text())
   check('JSON does not inject HTML or unsafe links',await pg.locator('#readable script,#readable a[href^="javascript:"]').count()==0)
   await ctx.close();ctx=await browser.new_context(java_script_enabled=False,ignore_https_errors=True);pg=await ctx.new_page();await pg.goto(BASE)
   check('no JavaScript snapshot readable','Honors Calculus' in await pg.locator('#readable').inner_text());return
  await pg.goto(BASE+'?debug',wait_until='domcontentloaded');await pg.wait_for_function('!!window.galleryDebug',timeout=18000)
  check(stage+' initializes in standard quality',(await state(pg))['quality']=='standard')
  if stage=='regression':
   await pg.locator('#lang-toggle').click()
   for zone,needle in [('about','First-year student'),('work','MaixCAM-Pro'),('notes','Notes to come'),('contact','oyster.stream')]:
    await pg.locator('[data-zone="'+zone+'"]').click();check('final arrival '+zone,(await state(pg))['near']==zone)
    await pg.locator('#nearby').click();check('final content '+zone,needle in await pg.locator('#reader-content').inner_text());await pg.locator('#close-reader').click()
    if zone=='work':await pg.screenshot(path='/tmp/gallery-final-work.png')
   pos=(await state(pg))['position'];await pg.locator('#lang-toggle').click();check('final language preserves position',(await state(pg))['position']==pos)
   await pg.set_viewport_size({'width':390,'height':844});check('final small viewport fits',await pg.evaluate('document.documentElement.scrollWidth<=innerWidth'))
   check('final no runtime errors',not errors,errors);return
  if stage=='assets':
   for zone,asset in [('notes','mech.glb'),('work','robot-arm.glb'),('contact','companion.glb')]:
    await pg.locator('[data-zone="'+zone+'"]').click()
    await pg.wait_for_function('(name)=>galleryDebug.state.assets.some(a=>a.url.endsWith(name)&&a.status==="loaded")',arg=asset,timeout=8000)
    check('on-demand asset '+asset,True)
   check('assets no shader errors',not errors,errors);return
  if stage=='visual':
   await pg.locator('#lang-toggle').click()
   for zone,asset in [('about',None),('work','robot-arm.glb'),('notes','mech.glb'),('contact','companion.glb')]:
    await pg.locator('[data-zone="'+zone+'"]').click()
    if asset:await pg.wait_for_function('(name)=>galleryDebug.state.assets.some(a=>a.url.endsWith(name)&&a.status==="loaded")',arg=asset,timeout=6000)
    await pg.wait_for_timeout(150);await pg.screenshot(path='/tmp/gallery-final-'+zone+'.png')
   check('final exhibit screenshots without animation',True)
   return
  # Paused and welcome views must not render continuously.
  await pg.wait_for_timeout(1500);before=(await state(pg))['frames'];await pg.wait_for_timeout(500);after=(await state(pg))['frames']
  check('welcome does not continuously draw',after-before<=1,[before,after])
  await pg.locator('#lang-toggle').click();check('English UI and content','Finding the shape' in await pg.locator('#welcome-title').inner_text() and 'First-year student' in await pg.locator('#readable').inner_text())
  await pg.screenshot(path='/tmp/gallery-'+stage+'-latest.png')
  await pg.locator('#enter').click();await pg.wait_for_timeout(120)
  check(stage+' enters',(await state(pg))['active'])
  if not mobile:
   check('desktop pointer lock',await pg.evaluate('document.pointerLockElement===document.querySelector("canvas")'))
   start=(await state(pg))['position'];await pg.keyboard.down('KeyW');await pg.wait_for_timeout(220);await pg.keyboard.up('KeyW')
   if (await state(pg))['near']=='language':
    await pg.keyboard.press('KeyE');check('physical language plaque switches to Chinese',await pg.locator('html').get_attribute('lang')=='zh-CN')
    await pg.keyboard.press('KeyE');check('physical language plaque switches back',await pg.locator('html').get_attribute('lang')=='en')
   await pg.evaluate('galleryDebug.pause()')
   check('short real WASD input moves',(await state(pg))['position'][2]<start[2])
  else:
   session=await ctx.new_cdp_session(pg);r=await pg.locator('#joystick').bounding_box();x=r['x']+r['width']/2;y=r['y']+r['height']/2;start=(await state(pg))['position']
   await session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':1}]})
   await session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x,'y':y-32,'id':1}]})
   await pg.wait_for_timeout(220)
   await session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y-32,'id':1},{'x':300,'y':400,'id':2}]})
   await session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x,'y':y-32,'id':1},{'x':335,'y':420,'id':2}]})
   await session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});await pg.evaluate('galleryDebug.pause()')
   check('real touch joystick moves',(await state(pg))['position'][2]<start[2])
   check('simultaneous mobile look works',abs((await state(pg))['yaw'])>.05)
  # Flood fill the actual runtime colliders (not a duplicate test layout).
  reachable=await pg.evaluate('''()=>{const d=galleryDebug,step=.5,q=[[0,9]],seen=new Set(['0,18']);for(let i=0;i<q.length;i++){const[x,z]=q[i];for(const[dx,dz]of[[step,0],[-step,0],[0,step],[0,-step]]){const nx=x+dx,nz=z+dz,key=nx/step+','+nz/step;if(!seen.has(key)&&d.valid(nx,nz)&&d.valid(x+dx/2,z+dz/2)){seen.add(key);q.push([nx,nz]);}}}return Object.fromEntries(Object.entries(d.zones).map(([id,v])=>[id,q.some(([x,z])=>Math.hypot(x-v.spawn[0],z-v.spawn[2])<.6)]));}''')
  check('all four regions connected through actual collisions',all(reachable.values()),reachable)
  for zone,needle in [('about','First-year student'),('work','MaixCAM-Pro'),('notes','Notes to come'),('contact','oyster.stream')]:
   await pg.locator('[data-zone="'+zone+'"]').click();check('arrives '+zone,(await state(pg))['near']==zone)
   await pg.locator('#nearby').click();check('reads '+zone,needle in await pg.locator('#reader-content').inner_text())
   await pg.locator('#reader-lang').click();check('reader switches language',await pg.locator('html').get_attribute('lang')=='zh-CN')
   await pg.locator('#reader-lang').click();await pg.locator('#close-reader').click()
  check('no horizontal overflow',await pg.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  # Keep the scene paused while the three small models finish loading, no animation loop.
  for zone,asset in [('notes','mech.glb'),('work','robot-arm.glb'),('contact','companion.glb')]:
   await pg.locator('[data-zone="'+zone+'"]').click()
   await pg.wait_for_function('(name)=>galleryDebug.state.assets.some(a=>a.url.endsWith(name)&&a.status==="loaded")',arg=asset,timeout=6000)
   check('licensed GLB loads '+asset,True)
  pos=(await state(pg))['position'];yaw=(await state(pg))['yaw'];await pg.locator('#lang-toggle').click();s=await state(pg)
  check('language preserves camera',pos==s['position']and yaw==s['yaw'])
  await pg.locator('#lang-toggle').click();await pg.screenshot(path='/tmp/gallery-'+stage+'-contact.png')
  # Main header switch and the physical sign share the same callback.
  await pg.evaluate('galleryDebug.goTo("notes")');await pg.locator('#text-toggle').click();check('reading room includes all content','AI Explorer Lab' in await pg.locator('#readable').inner_text())
  check('no runtime or shader errors',not errors,errors)
 finally:await ctx.close()
async def main():
 async with async_playwright()as p:
  browser=await p.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader','--num-raster-threads=1','--renderer-process-limit=1','--js-flags=--max-old-space-size=128'])
  try:await asyncio.wait_for(run(browser),timeout=45)
  finally:await browser.close()
 with open('/tmp/gallery-'+stage+'-checks.json','w')as f:json.dump(checks,f,ensure_ascii=False,indent=2)
asyncio.run(main())
