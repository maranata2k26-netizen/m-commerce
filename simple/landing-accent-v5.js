(()=>{"use strict";
function wrapText(el,needle,className){
  if(!el||el.dataset.mcAccentDone?.includes(needle))return;
  const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
  let node;
  while((node=walker.nextNode())){
    const text=node.nodeValue||"";
    const i=text.indexOf(needle);
    if(i===-1)continue;
    const frag=document.createDocumentFragment();
    if(i)frag.appendChild(document.createTextNode(text.slice(0,i)));
    const span=document.createElement("span");
    span.className=className;
    span.textContent=needle;
    frag.appendChild(span);
    if(i+needle.length<text.length)frag.appendChild(document.createTextNode(text.slice(i+needle.length)));
    node.parentNode.replaceChild(frag,node);
    el.dataset.mcAccentDone=(el.dataset.mcAccentDone||"")+"|"+needle;
    return;
  }
}
function apply(){
  const landing=document.querySelector(".landing-shell");
  if(!landing)return;
  wrapText(landing.querySelector(".hero-pro h1"),"lista para vender.","mc-accent-gradient");
  wrapText(landing.querySelector("#como-funciona .section-intro h2"),"tienda online","mc-accent-blue");
  const plans=landing.querySelector("#planes .section-intro h2");
  wrapText(plans,"Simple","mc-accent-blue");
  wrapText(plans,"PRO","mc-accent-pink");
  wrapText(landing.querySelector(".comparison-section .section-intro h2"),"personalización.","mc-accent-pink");
  wrapText(landing.querySelector(".final-cta h2"),"vender online hoy.","mc-accent-gradient");
}
new MutationObserver(apply).observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener("DOMContentLoaded",apply);
apply();
})();
