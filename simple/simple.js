(()=>{"use strict";
const SUPABASE_URL=window.M_COMMERCE_SUPABASE_URL;
const SUPABASE_KEY=window.M_COMMERCE_SUPABASE_KEY;
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const app=document.getElementById("app"),toastEl=document.getElementById("toast");
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=(v,c="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:c,maximumFractionDigits:0}).format(Number(v)||0);
const toast=(m,bad=false)=>{toastEl.textContent=m;toastEl.style.background=bad?"#9f2330":"#111827";toastEl.classList.add("show");setTimeout(()=>toastEl.classList.remove("show"),3500)};
const fail=e=>{console.error(e);toast(e?.message||"Ocurrió un error. Intentá nuevamente.",true)};
const loading=()=>app.innerHTML='<main class="loading"><div class="spinner"></div><p>Cargando M Commerce…</p></main>';
const rpc=async(name,args={})=>{const {data,error}=await sb.rpc(name,args);if(error)throw error;return data};
const meta=(selector,attr,value)=>{let el=document.head.querySelector(selector);if(!el){el=document.createElement("meta");document.head.appendChild(el)}el.setAttribute(attr,value)};
const setSeo=(title,description,url=location.href,image="")=>{document.title=title;meta('meta[name="description"]',"content",description);meta('meta[property="og:title"]',"content",title);meta('meta[property="og:description"]',"content",description);meta('meta[property="og:url"]',"content",url);if(image)meta('meta[property="og:image"]',"content",image);let canonical=document.head.querySelector('link[rel="canonical"]');if(!canonical){canonical=document.createElement("link");canonical.rel="canonical";document.head.appendChild(canonical)}canonical.href=url};
const getSession=async()=>{const {data,error}=await sb.auth.getSession();if(error)throw error;return data.session};
const field=(name,label,type="text",value="",extra="")=>`<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" value="${esc(value)}" ${extra}></div>`;
const route=decodeURIComponent(location.pathname);
function nav(){return `<nav class="nav site-nav">
  <a class="brand brand-lockup" href="/simple" aria-label="M Commerce - inicio">
    <img src="/assets/m-commerce-mark.svg" alt="M Commerce">
    <span><strong>M COMMERCE</strong><small>TU TIENDA ONLINE</small></span>
  </a>
  <div class="nav-links" aria-label="Navegación principal">
    <a href="/simple#como-funciona">Cómo funciona</a>
    <a href="/simple#planes">Planes</a>
    <a href="/simple#comparacion">Diferencias</a>
    <a href="https://wa.me/5491162760623?text=Hola%20Joaco%2C%20vi%20M%20Commerce%20y%20quiero%20asesoramiento." target="_blank" rel="noopener noreferrer">Contacto</a>
  </div>
  <div class="nav-actions">
    <a class="btn secondary" href="/simple/app">Ingresar</a>
    <a class="btn brand" href="/simple/app?mode=register">Crear mi tienda</a>
  </div>
</nav>`}
function landing(){
 setSeo("M Commerce | Tu tienda online","Creá tu tienda online, cargá productos, recibí pedidos y elegí entre M Commerce Simple o una solución PRO personalizada.",location.origin+"/simple");
 app.innerHTML=`<div class="shell landing-shell">${nav()}<main id="app-main">
 <section class="hero hero-pro">
   <div class="hero-copy">
     <div class="eyebrow">M Commerce · Plataforma de ventas online</div>
     <h1>Tu tienda online, lista para vender.</h1>
     <p>Mostrá tus productos, compartí tu enlace y recibí pedidos con una experiencia profesional desde cualquier celular.</p>
     <div class="hero-actions">
       <a class="btn brand" href="/simple/app?mode=register">Crear mi tienda</a>
       <a class="btn secondary hero-secondary" href="#planes">Ver planes</a>
       <a class="btn whatsapp-btn" href="https://wa.me/5491162760623?text=Hola%20Joaco%2C%20vi%20M%20Commerce%20y%20quiero%20asesoramiento." target="_blank" rel="noopener noreferrer"><svg aria-hidden="true" viewBox="0 0 32 32" width="20" height="20"><path fill="currentColor" d="M19.1 17.4c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-1.8-.9-3-1.7-4.2-3.8-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.6-.1-.2-.7-1.7-1-2.3-.3-.7-.6-.6-.8-.6h-.7c-.2 0-.6.1-.9.4-.3.3-1.2 1.2-1.2 2.9s1.2 3.3 1.4 3.6c.2.2 2.4 3.7 5.9 5.2.8.4 1.5.6 2 .7.8.3 1.6.2 2.2.1.7-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.2-.3-.2-.6-.4M16.1 26h-.1c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A10 10 0 1 1 16.1 26m8.5-18.6A12 12 0 0 0 5.7 21.9L4 28l6.3-1.6A12 12 0 1 0 24.6 7.4"/></svg><span>Hablá con Joaco</span></a>
     </div>
     <div class="trust-line"><span>✓ Alta online</span><span>✓ Catálogo profesional</span><span>✓ Pedidos y cobros</span><span>✓ Gestión desde celular</span></div>
   </div>
   <div class="hero-brand-card" aria-label="M Commerce">
     <img src="/assets/m-commerce-mark.svg" alt="Logo M Commerce">
     <strong>M COMMERCE</strong>
     <span>TU TIENDA ONLINE</span>
     <small>Simple para empezar. PRO para crecer.</small>
   </div>
 </section>

 <section class="company-strip" aria-label="Beneficios de M Commerce">
   <div><b>Una sola plataforma</b><span>Catálogo, carrito, pedidos y gestión.</span></div>
   <div><b>Lista para compartir</b><span>Tu negocio con un enlace propio.</span></div>
   <div><b>Hecha para vender</b><span>Experiencia clara en celular y PC.</span></div>
   <div><b>Escalable</b><span>Empezá Simple y pasá a PRO cuando lo necesites.</span></div>
 </section>

 <section class="social-proof" aria-label="Experiencia M Commerce">
   <div class="section-intro center">
     <div class="eyebrow">Experiencia M Commerce</div>
     <h2>Tu próxima tienda empieza acá.</h2>
     <p>Una plataforma pensada para que vender online sea simple, rápido y ordenado.</p>
   </div>
   <div class="testimonial-grid">
     <article class="testimonial-card">
       <span class="testimonial-label">Mensaje de muestra</span>
       <p>“La verdad, el flujo para cargar productos y recibir pedidos es muchísimo más simple de lo que esperaba.”</p>
       <strong>Comercio M Commerce</strong>
     </article>
     <article class="testimonial-card">
       <span class="testimonial-label">Mensaje de muestra</span>
       <p>“Me gustó que el cliente entra, ve todo claro y puede hacer el pedido sin vueltas. Eso era justamente lo que buscaba.”</p>
       <strong>Comercio M Commerce</strong>
     </article>
     <article class="testimonial-card">
       <span class="testimonial-label">Mensaje de muestra</span>
       <p>“El panel es práctico y desde el celular puedo controlar mi tienda sin estar dependiendo de una computadora.”</p>
       <strong>Comercio M Commerce</strong>
     </article>
   </div>
 </section>

 <section id="como-funciona" class="landing-section">
   <div class="section-intro"><div class="eyebrow">Así de simple</div><h2>De cero a tienda online en pocos pasos.</h2><p>No necesitás saber programar. M Commerce te guía y después administrás tu catálogo desde el mismo panel.</p></div>
   <div class="steps-grid">
     <article><span>01</span><h3>Creás tu cuenta</h3><p>Registrás tu comercio y elegís tu enlace.</p></article>
     <article><span>02</span><h3>Cargás tu negocio</h3><p>Logo, datos, categorías, productos, fotos y precios.</p></article>
     <article><span>03</span><h3>Conectás tus cobros</h3><p>Podés vincular el Mercado Pago propio de tu comercio.</p></article>
     <article><span>04</span><h3>Compartís y vendés</h3><p>Mandás tu link y recibís pedidos desde tu tienda.</p></article>
   </div>
 </section>

 <section class="catalog-showcase">
   <div class="catalog-copy">
     <div class="eyebrow">M Commerce Simple</div>
     <h2>Así puede verse tu catálogo online.</h2>
     <p>Fotos reales, precios claros, categorías y botón para agregar al pedido. Tu cliente ve una tienda limpia y vos la administrás desde el panel.</p>
     <ul class="feature-checks">
       <li>Subís fotos desde el celular</li>
       <li>Cambiás precios y disponibilidad</li>
       <li>Organizás por categorías</li>
       <li>Compartís tu tienda con link y QR</li>
     </ul>
     <a class="btn brand" href="/simple/app?mode=register">Quiero crear mi catálogo</a>
   </div>
   <div class="catalog-preview" role="img" aria-label="Ejemplo realista de catálogo M Commerce Simple">
     <div class="catalog-phone">
       <div class="catalog-top"><span class="catalog-avatar">MC</span><div><b>Mi Tienda</b><small>Catálogo online</small></div><span class="catalog-bag">🛍</span></div>
       <div class="catalog-chips"><span class="active">Todo</span><span>Novedades</span><span>Accesorios</span></div>
       <div class="catalog-demo-grid">
         <article><img loading="lazy" src="https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=700&q=82" alt="Anillo de ejemplo"><div><b>Anillo Silver</b><strong>$ 27.900</strong><button type="button" tabindex="-1">Agregar</button></div></article>
         <article><img loading="lazy" src="https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=700&q=82" alt="Cadena de ejemplo"><div><b>Cadena Urban</b><strong>$ 69.900</strong><button type="button" tabindex="-1">Agregar</button></div></article>
         <article><img loading="lazy" src="https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=700&q=82" alt="Accesorio de ejemplo"><div><b>Accesorio Premium</b><strong>$ 54.900</strong><button type="button" tabindex="-1">Agregar</button></div></article>
       </div>
       <div class="catalog-cart">Ver pedido <b>3 productos</b></div>
     </div>
   </div>
 </section>

 <section id="planes" class="landing-section plans-section">
   <div class="section-intro center"><div class="eyebrow">Elegí cómo empezar</div><h2>Simple para arrancar. PRO para llevarlo más lejos.</h2><p>Las dos opciones usan M Commerce, pero están pensadas para necesidades distintas.</p></div>
   <div class="plans upgraded-plans">
    <article class="plan simple">
      <div class="plan-top"><div><div class="eyebrow">Autogestionable</div><h2>M Commerce Simple</h2></div><span class="plan-badge light">Empezá hoy</span></div>
      <p>Para emprendedores y comercios que quieren una tienda profesional, rápida y económica, administrada por ellos mismos.</p>
      <div class="price" id="simple-price">Plan mensual</div>
      <ul class="ticks compact-ticks">
        <li>Alta online autogestionable</li><li>Catálogo con fotos, categorías y precios</li><li>Carrito y pedidos online</li><li>Stock y disponibilidad</li><li>Variantes de productos</li><li>Retiro y delivery</li><li>Link propio + QR para compartir</li><li>Panel desde celular o PC</li><li>Mercado Pago del comercio</li>
      </ul>
      <a class="btn brand full" href="/simple/app?mode=register">Crear mi tienda Simple</a>
    </article>

    <article class="plan pro-plan">
      <div class="pro-glow"></div>
      <div class="plan-top"><div><div class="eyebrow">Solución personalizada</div><h2>M Commerce PRO</h2></div><span class="plan-badge pro">Recomendado para negocios</span></div>
      <p>Para comercios que necesitan una presencia más fuerte, operaciones más complejas y una solución adaptada a su negocio.</p>
      <ul class="ticks compact-ticks pro-ticks">
        <li>Diseño e identidad visual personalizados</li><li>Dominio propio o subdominio profesional</li><li>Panel de comercio completo</li><li>Editor visual avanzado</li><li>Mercado Pago integrado</li><li>Gestión avanzada de pedidos</li><li>Seguimiento de pedidos</li><li>Stock y variantes avanzadas</li><li>Categorías y estructura a medida</li><li>Sucursales</li><li>Delivery y retiro configurables</li><li>Reservas cuando el rubro lo requiere</li><li>Notificaciones</li><li>Reportes y estadísticas</li><li>Soporte prioritario</li><li>Configuración e implementación personalizada</li>
      </ul>
      <div class="pro-actions"><a class="btn whatsapp-btn pro-wa full" href="https://wa.me/5491162760623?text=Hola%20Joaco%2C%20vi%20M%20Commerce%20y%20quiero%20asesoramiento." target="_blank" rel="noopener noreferrer"><svg aria-hidden="true" viewBox="0 0 32 32" width="20" height="20"><path fill="currentColor" d="M19.1 17.4c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-1.8-.9-3-1.7-4.2-3.8-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.6-.1-.2-.7-1.7-1-2.3-.3-.7-.6-.6-.8-.6h-.7c-.2 0-.6.1-.9.4-.3.3-1.2 1.2-1.2 2.9s1.2 3.3 1.4 3.6c.2.2 2.4 3.7 5.9 5.2.8.4 1.5.6 2 .7.8.3 1.6.2 2.2.1.7-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.2-.3-.2-.6-.4M16.1 26h-.1c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A10 10 0 1 1 16.1 26m8.5-18.6A12 12 0 0 0 5.7 21.9L4 28l6.3-1.6A12 12 0 1 0 24.6 7.4"/></svg><span>Hablá con Joaco por PRO</span></a><a class="btn secondary full" href="/simple/pro">Enviar solicitud PRO</a></div>
    </article>
   </div>
 </section>

 <section id="comparacion" class="landing-section comparison-section">
   <div class="section-intro"><div class="eyebrow">Comparación rápida</div><h2>La diferencia se ve en el nivel de personalización.</h2></div>
   <div class="compare-table" role="table" aria-label="Comparación M Commerce Simple y PRO">
     <div class="compare-row head" role="row"><div>Función</div><div>Simple</div><div>PRO</div></div>
     <div class="compare-row"><div>Crear y administrar productos</div><div>✓</div><div>✓</div></div>
     <div class="compare-row"><div>Carrito y pedidos online</div><div>✓</div><div>✓</div></div>
     <div class="compare-row"><div>Mercado Pago propio</div><div>✓</div><div>✓</div></div>
     <div class="compare-row"><div>Diseño personalizado</div><div>Base M Commerce</div><div><b>✓ A medida</b></div></div>
     <div class="compare-row"><div>Editor avanzado / funciones especiales</div><div>—</div><div><b>✓</b></div></div>
     <div class="compare-row"><div>Sucursales, reservas y flujos complejos</div><div>—</div><div><b>✓</b></div></div>
     <div class="compare-row"><div>Implementación y soporte prioritario</div><div>Autogestión</div><div><b>✓ Equipo M Commerce</b></div></div>
   </div>
 </section>

 <section class="final-cta">
   <img src="/assets/m-commerce-mark.svg" alt="" aria-hidden="true">
   <div><div class="eyebrow">M Commerce</div><h2>Tu negocio puede empezar a vender online hoy.</h2><p>Creá tu tienda Simple o hablá con Joaco si necesitás una solución PRO.</p></div>
   <div class="final-actions"><a class="btn brand" href="/simple/app?mode=register">Crear mi tienda</a><a class="btn whatsapp-btn" href="https://wa.me/5491162760623?text=Hola%20Joaco%2C%20vi%20M%20Commerce%20y%20quiero%20asesoramiento." target="_blank" rel="noopener noreferrer"><svg aria-hidden="true" viewBox="0 0 32 32" width="20" height="20"><path fill="currentColor" d="M19.1 17.4c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-1.8-.9-3-1.7-4.2-3.8-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.6-.1-.2-.7-1.7-1-2.3-.3-.7-.6-.6-.8-.6h-.7c-.2 0-.6.1-.9.4-.3.3-1.2 1.2-1.2 2.9s1.2 3.3 1.4 3.6c.2.2 2.4 3.7 5.9 5.2.8.4 1.5.6 2 .7.8.3 1.6.2 2.2.1.7-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.2-.3-.2-.6-.4M16.1 26h-.1c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A10 10 0 1 1 16.1 26m8.5-18.6A12 12 0 0 0 5.7 21.9L4 28l6.3-1.6A12 12 0 1 0 24.6 7.4"/></svg><span>Hablá con Joaco</span></a></div>
 </section>
 </main>
 <footer class="site-footer">
   <div class="footer-brand"><img src="/assets/m-commerce-mark.svg" alt="M Commerce"><div><strong>M COMMERCE</strong><span>Tu tienda online</span></div></div>
   <div class="footer-links"><a href="#planes">Planes</a><a href="#como-funciona">Cómo funciona</a><a href="#comparacion">Simple vs PRO</a><a href="https://wa.me/5491162760623?text=Hola%20Joaco%2C%20vi%20M%20Commerce%20y%20quiero%20asesoramiento." target="_blank" rel="noopener noreferrer">WhatsApp</a><a href="https://www.instagram.com/mcommercee/" target="_blank" rel="noopener noreferrer">Instagram</a></div>
   <small>© M Commerce · Plataforma de tiendas online.</small>
 </footer>
 <a class="floating-whatsapp" href="https://wa.me/5491162760623?text=Hola%20Joaco%2C%20vi%20M%20Commerce%20y%20quiero%20asesoramiento." target="_blank" rel="noopener noreferrer" aria-label="Hablar con Joaco por WhatsApp"><svg aria-hidden="true" viewBox="0 0 32 32" width="20" height="20"><path fill="currentColor" d="M19.1 17.4c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-1.8-.9-3-1.7-4.2-3.8-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.6-.1-.2-.7-1.7-1-2.3-.3-.7-.6-.6-.8-.6h-.7c-.2 0-.6.1-.9.4-.3.3-1.2 1.2-1.2 2.9s1.2 3.3 1.4 3.6c.2.2 2.4 3.7 5.9 5.2.8.4 1.5.6 2 .7.8.3 1.6.2 2.2.1.7-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.2-.3-.2-.6-.4M16.1 26h-.1c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A10 10 0 1 1 16.1 26m8.5-18.6A12 12 0 0 0 5.7 21.9L4 28l6.3-1.6A12 12 0 1 0 24.6 7.4"/></svg><span>Hablá con Joaco</span></a>
 </div>`;
 loadPrice();
}
function proRequest(){
 setSeo("M Commerce PRO · Solicitud comercial","Contanos sobre tu negocio y diseñamos una tienda online a medida.",location.origin+"/simple/pro");
 app.innerHTML=`<div class="shell">${nav()}<main class="auth-wrap card"><div class="eyebrow">M Commerce PRO</div><h1>Una tienda diseñada para tu negocio.</h1><p class="muted">Dejanos tus datos. El equipo de M Commerce revisará la solicitud para preparar una propuesta personalizada.</p><a class="btn whatsapp-btn full" href="https://wa.me/5491162760623?text=Hola%20Joaco%2C%20quiero%20asesoramiento%20sobre%20M%20Commerce%20PRO." target="_blank" rel="noopener noreferrer">Hablá con Joaco por WhatsApp</a><form id="pro-form">${field("lead_name","Tu nombre","text","","required maxlength=\"120\"")}${field("lead_business","Nombre del negocio","text","","required maxlength=\"120\"")}${field("lead_email","Email","email","","required maxlength=\"254\"")}${field("lead_phone","WhatsApp","tel","","required maxlength=\"40\"")}<div class="field"><label for="lead_details">¿Qué necesitás?</label><textarea id="lead_details" maxlength="2000" placeholder="Rubro, funciones o integraciones que necesitás"></textarea></div><button class="btn brand" type="submit">Enviar solicitud</button></form></main></div>`;
 document.getElementById("pro-form").onsubmit=async ev=>{ev.preventDefault();try{setBusy(ev.submitter,true);const body={name:document.getElementById("lead_name").value,business_name:document.getElementById("lead_business").value,email:document.getElementById("lead_email").value,phone:document.getElementById("lead_phone").value,details:document.getElementById("lead_details").value},res=await fetch(SUPABASE_URL+"/functions/v1/simple-pro-lead",{method:"POST",headers:{"content-type":"application/json","apikey":SUPABASE_KEY},body:JSON.stringify(body)}),out=await res.json();if(!res.ok)throw new Error(out.message||out.error);ev.currentTarget.innerHTML='<h2>Solicitud recibida</h2><p>Gracias. El equipo de M Commerce ya puede continuar el contacto comercial.</p>';toast("Solicitud enviada.")}catch(e){fail(e)}finally{setBusy(ev.submitter,false)}};
}
async function loadPrice(){try{const data=await rpc("simple_public_plan");if(data)document.getElementById("simple-price").innerHTML=`${money(data.monthly_price,data.currency_code)} <small>/ mes</small>`}catch(e){console.warn(e)}}
function authView(mode){
 if(mode==="verify")return authPendingView();
 if(mode==="recover")return authRecoverView();
 const register=mode==="register";
 app.innerHTML=`<div class="shell">${nav()}<main class="auth-wrap card"><div class="eyebrow">M Commerce Simple</div><h1>${register?"Creá tu cuenta":"Ingresá a tu tienda"}</h1><p class="muted">${register?"Empezá a configurar tu tienda en pocos minutos.":"Administrá productos y pedidos desde cualquier dispositivo."}</p>
 <form id="auth-form">${register?field("full_name","Tu nombre","text","","required autocomplete=\"name\""):""}${field("email","Email","email","","required autocomplete=\"email\"")}${field("password","Contraseña","password","","required minlength=\"8\" autocomplete=\""+(register?"new-password":"current-password")+"\"")}<button class="btn brand" type="submit">${register?"Crear cuenta":"Ingresar"}</button></form>
 <p class="muted">${register?'¿Ya tenés cuenta? <a href="/simple/app">Ingresar</a>':'¿Todavía no tenés cuenta? <a href="/simple/app?mode=register">Crear cuenta</a>'}</p>
 <button id="recover" class="mini" type="button">Recuperar contraseña</button></main></div>`;
 document.getElementById("auth-form").onsubmit=async ev=>{ev.preventDefault();const fd=new FormData(ev.currentTarget),email=String(fd.get("email")).trim(),password=String(fd.get("password"));try{setBusy(ev.submitter,true);if(register){const {data,error}=await sb.auth.signUp({email,password,options:{emailRedirectTo:location.origin+"/simple/app",data:{full_name:String(fd.get("full_name")).trim()}}});if(error)throw error;if(data.session){location.replace("/simple/app");}else{try{sessionStorage.setItem("mc_pending_confirmation_email",email)}catch{}location.replace("/simple/app?mode=verify")}}else{const {error}=await sb.auth.signInWithPassword({email,password});if(error)throw error;location.href="/simple/app";}}catch(e){fail(e)}finally{setBusy(ev.submitter,false)}};
 document.getElementById("recover").onclick=()=>{const email=document.getElementById("email")?.value.trim();if(email){try{sessionStorage.setItem("mc_pending_confirmation_email",email)}catch{}}location.href="/simple/app?mode=recover"};
}
function authPreviousEmail(){try{return sessionStorage.getItem("mc_pending_confirmation_email")||""}catch{return ""}}
function authPendingView(){
 app.innerHTML=`<div class="shell">${nav()}<main class="auth-wrap card"><div class="eyebrow">Verificación de correo</div><h1>Revisá tu email</h1><p class="muted">Si la cuenta necesita confirmación, te enviamos un enlace. Revisá también Spam y Promociones.</p><form id="confirmation-form">${field("email","Tu email","email",authPreviousEmail(),'required maxlength="254" autocomplete="email"')}<button class="btn brand" type="submit">Reenviar verificación</button></form><p id="confirmation-status" class="muted" role="status" aria-live="polite"></p><p><a href="/simple/app">Volver a ingresar</a></p></main></div>`;
 document.getElementById("confirmation-form").onsubmit=async ev=>{
  ev.preventDefault();const button=ev.submitter,status=document.getElementById("confirmation-status"),email=document.getElementById("email").value.trim();
  try{setBusy(button,true);const {error}=await sb.auth.resend({type:"signup",email,options:{emailRedirectTo:window.M_COMMERCE_OFFICIAL_ORIGIN+"/simple/app?verified=1"}});if(error)throw error;status.textContent="Si hay una confirmación pendiente para ese correo, vas a recibir el enlace. Revisá también Spam."}
  catch(e){status.textContent=/rate|seconds|minute|too many/i.test(String(e?.message||""))?"Esperá un minuto y volvé a intentar.":"No pudimos reenviar el enlace. Intentá nuevamente.";console.warn("confirmation_resend",e?.code||"failed")}
  finally{setBusy(button,false)}
 };
}
function authRecoverView(){
 app.innerHTML=`<div class="shell">${nav()}<main class="auth-wrap card"><div class="eyebrow">Seguridad de tu cuenta</div><h1>Recuperar contraseña</h1><p class="muted">Ingresá el email con el que te registraste. Si existe una cuenta, vas a recibir un enlace para crear otra contraseña.</p><form id="recover-form">${field("email","Email","email",authPreviousEmail(),'required maxlength="254" autocomplete="email"')}<button class="btn brand" type="submit">Enviar enlace</button></form><p id="recover-status" class="muted" role="status" aria-live="polite"></p><p><a href="/simple/app">Volver a ingresar</a></p></main></div>`;
 document.getElementById("recover-form").onsubmit=async ev=>{
  ev.preventDefault();const button=ev.submitter,status=document.getElementById("recover-status"),email=document.getElementById("email").value.trim();
  try{setBusy(button,true);const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:window.M_COMMERCE_OFFICIAL_ORIGIN+"/simple/app?reset=1"});if(error)throw error;status.textContent="Si existe una cuenta asociada, vas a recibir un enlace. Revisá también Spam y Promociones."}
  catch(e){status.textContent=/rate|seconds|minute|too many/i.test(String(e?.message||""))?"Esperá un minuto antes de pedir otro enlace.":"No pudimos enviar el enlace ahora. Intentá nuevamente.";console.warn("password_recovery",e?.code||"failed")}
  finally{setBusy(button,false)}
 };
}
function authExpiredView(){
 app.innerHTML=`<div class="shell">${nav()}<main class="auth-wrap card"><div class="eyebrow">Seguridad</div><h1>No pudimos validar el enlace</h1><p class="muted">Es posible que haya vencido o ya se haya utilizado. Pedí uno nuevo para recuperar tu contraseña.</p><a class="btn brand" href="/simple/app?mode=recover">Solicitar otro enlace</a><p><a href="/simple/app">Volver a ingresar</a></p></main></div>`;
}
function setBusy(el,on){if(!el)return;el.disabled=on;el.dataset.label??=el.textContent;el.textContent=on?"Procesando…":el.dataset.label}
async function adminRoute(){
 const session=await getSession();if(!session)return authView("login");
 const masterDate=(value,withTime=false)=>{
   if(!value)return "Sin fecha";
   const date=new Date(value);
   return Number.isNaN(date.getTime())?"Sin fecha":withTime?date.toLocaleString("es-AR"):date.toLocaleDateString("es-AR");
 };
 const masterPrice=(amount,currency)=>{
   if(amount==null||!Number.isFinite(Number(amount)))return "Sin precio informado";
   try{return new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:2}).format(Number(amount));}
   catch{return String(amount)+" "+String(currency||"ARS");}
 };
 const masterPaymentAttention=x=>!["trial","active"].includes(String(x.subscription?.status||x.subscription_status||"").toLowerCase());
 let stores=[],leads=[],leadsError="",query="",filter="all",busy=false;
 try{
   stores=await rpc("simple_master_stores");
   if(!Array.isArray(stores))throw new Error("No se recibió una lista válida de comercios.");
 }catch(error){
   const denied=/ADMIN_REQUIRED|SITE_ACCESS_DENIED|ACCESS_DENIED|FORBIDDEN/.test(String(error?.message||error));
   app.innerHTML=denied?
      '<main class="loading"><h1>Acceso restringido</h1><p>Esta sección requiere una cuenta autorizada del Panel Maestro.</p><a class="mini" href="/simple/app">Volver</a></main>':
      '<main class="loading"><h1>No se pudo cargar el Panel Maestro</h1><p>Revisá la conexión e intentá nuevamente. No se realizaron cambios.</p><button id="master-retry" class="btn">Reintentar</button></main>';
   if(!denied)document.getElementById("master-retry").onclick=()=>adminRoute();
   return;
 }
 const loadLeads=async()=>{
   try{
     const result=await rpc("simple_master_pro_leads");
     if(!Array.isArray(result))throw new Error("Respuesta inválida");
     leads=result;leadsError="";
   }catch(error){
     leadsError="No se pudieron cargar las solicitudes PRO. Los comercios siguen disponibles.";
     console.warn("simple_master_pro_leads",error);
   }
 };
 await loadLeads();
 app.innerHTML=`<div class="app-shell"><header class="app-head"><div class="inner"><span class="brand">M COMMERCE <small>SIMPLE · MAESTRO</small></span><div><a class="mini" href="/app-maestro/panel">Panel Maestro general</a> <button id="logout" class="mini">Salir</button></div></div></header>
 <main class="app-main"><section class="welcome"><div><div class="eyebrow">Administración autorizada</div><h1>Comercios y suscripciones</h1><p class="muted">Supervisión de tiendas Simple. Los cobros se administran desde el sistema de facturación, no desde este listado.</p></div><button id="master-refresh" class="btn secondary">Actualizar datos</button></section>
 <section id="master-stats" class="admin-master-stats" aria-label="Resumen de comercios"></section>
 <section class="section"><div class="section-head"><h2>Tiendas Simple</h2><span id="master-count" class="status"></span></div>
 <div class="admin-master-controls"><label class="field"><span>Buscar comercio</span><input id="master-search" type="search" placeholder="Nombre, enlace o email" autocomplete="off"></label><label class="field"><span>Mostrar</span><select id="master-filter"><option value="all">Todas</option><option value="published">Publicadas</option><option value="draft">Borradores</option><option value="suspended">Suspendidas</option><option value="payment">Suscripción pendiente</option></select></label></div>
 <div id="master-stores" class="list" aria-live="polite"></div></section>
 <section class="section"><div class="section-head"><h2>Solicitudes M Commerce PRO</h2><span id="master-leads-count" class="status"></span></div><p id="master-leads-error" class="hint" role="status"></p><div id="master-leads" class="list"></div></section></main></div>`;
 document.getElementById("logout").onclick=logout;
 const renderStats=()=>{
   const total=stores.length,published=stores.filter(x=>x.status==="published"&&!x.is_suspended).length;
   const suspended=stores.filter(x=>x.is_suspended).length,payment=stores.filter(masterPaymentAttention).length;
   const stats=[["Tiendas Simple",total],["Publicadas",published],["Suspendidas",suspended],["Suscripciones a revisar",payment]];
   document.getElementById("master-stats").innerHTML=stats.map(([label,value])=>
      `<article class="card admin-master-stat"><div class="muted">${esc(label)}</div><strong>${value}</strong></article>`).join("");
 };
 const renderStores=()=>{
   const filtered=stores.filter(x=>{
      const matchesQuery=[x.name,x.slug,x.owner_email].some(v=>String(v||"").toLocaleLowerCase("es-AR").includes(query));
      const matchesFilter=filter==="all"||(filter==="published"&&x.status==="published"&&!x.is_suspended)||
        (filter==="draft"&&x.status==="draft")||(filter==="suspended"&&Boolean(x.is_suspended))||
        (filter==="payment"&&masterPaymentAttention(x));
      return matchesQuery&&matchesFilter;
   });
   document.getElementById("master-count").textContent=filtered.length+" de "+stores.length+" tiendas";
   document.getElementById("master-stores").innerHTML=filtered.map(x=>{
      const sub=x.subscription||{},isSuspended=Boolean(x.is_suspended);
      const subscriptionState=sub.status||x.subscription_status||"Sin datos";
      const publicStatus=isSuspended?"Suspendida":x.status||"Sin datos";
      const nextDue=sub.next_due_at?" · Próximo vencimiento: "+masterDate(sub.next_due_at):"";
      const grace=sub.grace_until?" · Gracia hasta: "+masterDate(sub.grace_until):"";
      const productCount=Number.isFinite(Number(x.products))?Number(x.products):0;
      const orderCount=Number.isFinite(Number(x.orders))?Number(x.orders):0;
      return `<article class="card row admin-master-store"><div class="row-main">
       <div class="row-title">${esc(x.name||"Sin nombre")} <span class="status">${esc(publicStatus)}</span></div>
       <div class="row-sub">${esc(x.owner_email||"Sin email")} · /tienda/${esc(x.slug||"")} · Alta ${esc(masterDate(x.created_at))}</div>
       <div class="row-sub">${productCount} productos · ${orderCount} pedidos · Última actividad ${esc(masterDate(x.last_activity_at,true))}</div>
       <div class="row-sub"><strong>Suscripción: ${esc(subscriptionState)}</strong> · ${esc(sub.plan_name||"Sin plan")} · ${esc(masterPrice(sub.monthly_amount,sub.currency_code))} / mes</div>
       <div class="row-sub">${esc(sub.provider||"Sin proveedor")} · ${esc(sub.provider_status||"Sin estado del proveedor")}${esc(nextDue)}${esc(grace)}</div>
       </div><button class="btn admin-state" type="button" data-id="${esc(x.id)}" ${busy?"disabled":""}>${isSuspended?"Reactivar":"Suspender"}</button></article>`;
   }).join("")||'<div class="card empty">No hay comercios que coincidan con el filtro.</div>';
 };
 const renderLeads=()=>{
   document.getElementById("master-leads-count").textContent=leads.length+" solicitudes";
   document.getElementById("master-leads-error").textContent=leadsError;
   document.getElementById("master-leads").innerHTML=leads.map(l=>
     `<article class="card"><div class="row-title">${esc(l.business_name||"Sin comercio")} · ${esc(l.name||"Sin nombre")}</div>
       <div class="row-sub">${esc(l.email||"Sin email")} · ${esc(l.phone||"Sin teléfono")} · ${esc(masterDate(l.created_at,true))}</div>
       <p>${esc(l.details||"Sin detalle")}</p></article>`
   ).join("")||'<div class="card empty">No hay solicitudes PRO registradas.</div>';
 };
 const renderAll=()=>{renderStats();renderStores();renderLeads();};
 const refresh=async()=>{
   if(busy)return;
   const button=document.getElementById("master-refresh");
   busy=true;setBusy(button,true);
   try{
     const fresh=await rpc("simple_master_stores");
     if(!Array.isArray(fresh))throw new Error("No se recibió una lista válida de comercios.");
     stores=fresh;
     await loadLeads();
     renderAll();
     toast("Datos del Panel Maestro actualizados.");
   }catch(error){fail(error);}
   finally{busy=false;setBusy(button,false);renderStores();}
 };
 document.getElementById("master-refresh").onclick=refresh;
 document.getElementById("master-search").oninput=e=>{query=String(e.currentTarget.value||"").trim().toLocaleLowerCase("es-AR");renderStores();};
 document.getElementById("master-filter").onchange=e=>{filter=e.currentTarget.value;renderStores();};
 document.getElementById("master-stores").onclick=async event=>{
   const button=event.target.closest(".admin-state");
   if(!button||busy)return;
   const store=stores.find(x=>x.id===button.dataset.id);if(!store)return;
   const expected=Boolean(store.is_suspended),action=expected?"reactivate":"suspend";
   const verb=expected?"reactivar":"suspender";
   if(!window.confirm(`¿Confirmás ${verb} la tienda «${store.name}»? El cambio afecta su disponibilidad pública, pero no modifica sus pagos ni su suscripción.`))return;
   busy=true;setBusy(button,true);renderStats();
   try{
     const result=await rpc("simple_admin_set_store_state_safe",{
       p_site_id:store.id,p_action:action,p_expected_suspended:expected
     });
     if(!result||result.id!==store.id||Boolean(result.is_suspended)===expected)
       throw new Error("El servidor no confirmó el cambio de estado.");
     store.is_suspended=Boolean(result.is_suspended);
     toast("Estado actualizado y auditado.");
   }catch(error){
     fail(error);
     if(String(error?.message||"").includes("STORE_STATE_CHANGED_RELOAD")){
       try{const fresh=await rpc("simple_master_stores");if(Array.isArray(fresh))stores=fresh;}catch(e){console.warn("simple_master_refresh",e);}
     }
   }finally{busy=false;renderStats();renderStores();}
 };
 renderAll();
}
function resetPasswordView(){app.innerHTML=`<div class="shell">${nav()}<main class="auth-wrap card"><div class="eyebrow">Seguridad</div><h1>Elegí una nueva contraseña</h1><form id="reset-form">${field("new_password","Nueva contraseña","password","","required minlength=\"8\" autocomplete=\"new-password\"")}${field("confirm_password","Repetí la contraseña","password","","required minlength=\"8\" autocomplete=\"new-password\"")}<button class="btn brand" type="submit">Actualizar contraseña</button></form><p><a href="/simple/app?mode=recover">Solicitar otro enlace</a></p></main></div>`;document.getElementById("reset-form").onsubmit=async ev=>{ev.preventDefault();const password=document.getElementById("new_password").value;if(password!==document.getElementById("confirm_password").value)return toast("Las contraseñas no coinciden.",true);try{setBusy(ev.submitter,true);const {error}=await sb.auth.updateUser({password});if(error)throw error;location.replace("/simple/app?password_updated=1")}catch(e){fail(e)}finally{setBusy(ev.submitter,false)}}}
async function appRoute(){
 const params=new URLSearchParams(location.search),session=await getSession();
 if(params.get("reset")==="1")return session?resetPasswordView():authExpiredView();
 if(!session)return authView(params.get("mode"));
 if(params.get("password_updated")==="1")toast("Contraseña actualizada correctamente.");
 if(params.get("verified")==="1")toast("Ingresaste correctamente a M Commerce.");
 let site=await rpc("simple_my_store").catch(()=>null);
 if(!site)return createStoreView(session.user);
 if(new URLSearchParams(location.search).get("billing_return")==="1"){
  try{await billingCall("subscription_refresh",site.id)}catch(e){console.warn("subscription_refresh",e)}
  site=await rpc("simple_my_store");
 }
 return dashboard(site);
}
function createStoreView(user){
 app.innerHTML=`<div class="app-shell"><header class="app-head"><div class="inner"><span class="brand">M COMMERCE <small>SIMPLE</small></span><button id="logout" class="mini">Salir</button></div></header><main class="app-main"><section class="card wizard"><div class="eyebrow">Primera configuración</div><h1>Creá tu tienda</h1><p class="muted">Después vas a cargar la información, primera categoría y primer producto.</p><form id="create-store">${field("store_name","Nombre del comercio","text","","required maxlength=\"100\"")}${field("store_slug","Enlace deseado","text","","required minlength=\"3\" maxlength=\"60\" pattern=\"[a-z0-9-]+\"")}<p class="hint">Tu enlace será: ${esc(window.M_COMMERCE_OFFICIAL_ORIGIN)}/tienda/<strong id="slug-preview">mitienda</strong></p><button class="btn brand" type="submit">Crear mi tienda</button></form></section></main></div>`;
 document.getElementById("logout").onclick=logout;
 const name=document.getElementById("store_name"),slug=document.getElementById("store_slug");
 name.oninput=()=>{if(!slug.dataset.touched){slug.value=slugify(name.value);document.getElementById("slug-preview").textContent=slug.value||"mitienda"}};
 slug.oninput=()=>{slug.dataset.touched="1";slug.value=slugify(slug.value);document.getElementById("slug-preview").textContent=slug.value||"mitienda"};
 document.getElementById("create-store").onsubmit=async ev=>{ev.preventDefault();try{setBusy(ev.submitter,true);const data=await rpc("simple_create_store",{p_name:name.value,p_slug:slug.value});await subscriptionGate(data)}catch(e){fail(e)}finally{setBusy(ev.submitter,false)}};
}
const slugify=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
async function dashboard(site){
 let data;try{data=await rpc("simple_dashboard",{p_site_id:site.id})}catch(e){return fail(e)}
 const sub=data.subscription||{};
 if(!["trial","active"].includes(String(sub.status||data.site.subscription_status||"")))return subscriptionGate(data.site,sub);
 if(!data.site.simple_onboarding_completed_at&&Number(data.settings.simple_onboarding_step||1)<=10)return wizard(site.id,Number(data.settings.simple_onboarding_step||1),data);
 const c=data.counts||{},s=data.site;
 app.innerHTML=`<div class="app-shell"><header class="app-head"><div class="inner"><span class="brand">M COMMERCE <small>SIMPLE</small></span><button id="logout" class="mini">Salir</button></div></header><main class="app-main">
 <section class="welcome"><div><div class="eyebrow">Mi tienda</div><h1>${esc(s.name)}</h1><div class="muted">${esc(window.M_COMMERCE_OFFICIAL_ORIGIN)}/tienda/${esc(s.slug)}</div></div><span class="status ${sub.status==="active"?"active":""}">${esc(sub.status||"pending")}</span></section>
 <section class="stats"><div class="stat"><div class="count">${c.new_orders||0}</div><small>Pedidos nuevos</small></div><div class="stat"><div class="count">${c.products||0}</div><small>Productos</small></div><div class="stat"><div class="count">${c.categories||0}</div><small>Categorías</small></div><div class="stat"><div class="count">${c.orders||0}</div><small>Pedidos totales</small></div></section>
 <section class="section menu-grid">
  ${menu("orders","📦","Pedidos","Ver y actualizar")}
  ${menu("products","🛍️","Productos","Precios y stock")}
  ${menu("categories","▦","Categorías","Ordená tu catálogo")}
  ${menu("store","🏪","Mi tienda","Datos e imágenes")}
  ${menu("payments","💳","Pagos","Métodos y conexión")}
  ${menu("delivery","🛵","Entregas","Retiro y delivery")}
  ${menu("hours","🕐","Horarios","Cuándo vendés")}
  ${menu("share","↗","Compartir tienda","Link y QR")}
  ${menu("plan","★","Mi plan",money(sub.amount||0,sub.currency_code||"ARS"))}
 </section><section id="panel" class="section"></section></main></div>`;
 document.getElementById("logout").onclick=logout;
 document.querySelectorAll("[data-panel]").forEach(b=>b.onclick=()=>openPanel(b.dataset.panel,site.id,data));
}
const menu=(id,icon,title,sub)=>`<button class="menu-item" data-panel="${id}"><span>${icon}</span><div>${title}<br><small>${sub}</small></div></button>`;
async function openPanel(kind,siteId,dash){
 const panel=document.getElementById("panel");panel.innerHTML='<div class="loading"><div class="spinner"></div></div>';
 try{
  if(kind==="orders")return ordersPanel(panel,siteId);
  if(kind==="products")return productsPanel(panel,siteId);
  if(kind==="categories")return categoriesPanel(panel,siteId);
  if(kind==="share")return sharePanel(panel,dash.site.slug);
  if(kind==="plan")return planPanel(panel,siteId,dash.subscription);
  if(kind==="payments")return paymentsPanel(panel,siteId,dash);
  if(kind==="delivery")return deliveryPanel(panel,siteId,dash);
  panel.innerHTML=`<div class="card"><div class="section-head"><h2>${esc({store:"Mi tienda",payments:"Pagos",delivery:"Entregas",hours:"Horarios"}[kind])}</h2></div><p class="muted">Esta información se administra desde el asistente simple.</p><button id="edit-profile" class="btn">Editar configuración</button></div>`;
  document.getElementById("edit-profile").onclick=()=>wizard(siteId,1,dash);
 }catch(e){panel.innerHTML="";fail(e)}
}

async function deliveryPanel(panel,siteId,dash){
 let fresh=await rpc("simple_dashboard",{p_site_id:siteId});
 const settings=fresh.settings||{},config=settings.fulfillment_config||{};
 const fee=Number(settings.delivery_fee??0);
 panel.innerHTML=`<form id="simple-delivery-settings" class="card">
 <div class="section-head"><h2>Retiro y delivery</h2><span class="status">Configuración de tu comercio</span></div>
 <p class="muted">Definí cómo entregás los pedidos. El precio del envío es fijo y se calcula en el servidor al confirmar la compra.</p>
 <label class="field"><span><input type="checkbox" id="simple-pickup" ${config.pickup_enabled!==false?"checked":""}> Permitir retiro en el local</span></label>
 <label class="field"><span><input type="checkbox" id="simple-shipping" ${config.shipping_enabled===true?"checked":""}> Ofrecer delivery</span></label>
 <div class="field"><label for="simple-shipping-fee">Costo fijo de envío</label><input id="simple-shipping-fee" inputmode="decimal" type="number" min="0" max="10000000" step="0.01" value="${esc(Number.isFinite(fee)&&fee>=0?String(fee):"0")}" required><p class="hint">Si es gratis, poné 0. No se cobra cuando el cliente elige retiro.</p></div>
 <div class="field"><label for="simple-coverage">Zonas / barrios donde entregás (informativo)</label>
 <textarea id="simple-coverage" maxlength="500" rows="3" placeholder="Ej: Merlo centro, San Antonio de Padua, Libertad">${esc(settings.delivery_info||"")}</textarea>
 <p class="hint">Este texto orienta al cliente; aún no bloquea automáticamente pedidos fuera de la zona. Confirmá la cobertura antes de despachar.</p></div>
 <button class="btn brand" id="simple-delivery-save" type="submit">Guardar entregas</button></form>`;
 const form=panel.querySelector("#simple-delivery-settings");
 form.onsubmit=async event=>{
  event.preventDefault();
  const button=panel.querySelector("#simple-delivery-save");
  const pickup=panel.querySelector("#simple-pickup").checked;
  const shipping=panel.querySelector("#simple-shipping").checked;
  const feeString=panel.querySelector("#simple-shipping-fee").value.trim();
  const value=Number(feeString);
  const coverage=panel.querySelector("#simple-coverage").value.trim();
  if(!pickup&&!shipping)return toast("Habilitá retiro, delivery o ambas opciones.",true);
  if(!feeString||!Number.isFinite(value)||value<0||value>10000000||Math.abs(value-Math.round(value*100)/100)>1e-8)
     return toast("Ingresá un costo de envío válido, sin valores negativos.",true);
  if(coverage.length>500)return toast("La cobertura no puede superar 500 caracteres.",true);
  try{
   setBusy(button,true);
   const result=await rpc("simple_update_delivery_settings",{
    p_site_id:siteId,p_config:{pickup_enabled:pickup,shipping_enabled:shipping,
      delivery_fee:value,delivery_info:coverage},
    p_expected_updated_at:settings.updated_at
   });
   if(!result?.updated_at)throw new Error("El servidor no confirmó la configuración de entregas.");
   settings.updated_at=result.updated_at;
   settings.delivery_fee=result.delivery_fee;
   settings.delivery_info=result.delivery_info;
   settings.fulfillment_config=result.fulfillment_config;
   if(dash?.settings)Object.assign(dash.settings,{
    updated_at:result.updated_at,delivery_fee:result.delivery_fee,
    delivery_info:result.delivery_info,fulfillment_config:result.fulfillment_config
   });
   toast("Opciones de entrega guardadas correctamente.");
  }catch(error){
   fail(error);
   if(/DELIVERY_SETTINGS_CHANGED_RELOAD/.test(String(error?.message||""))) {
     try{await deliveryPanel(panel,siteId,dash);}catch(e){fail(e)}
   }
  }finally{setBusy(button,false)}
 };
}
async function ordersPanel(panel,siteId){
 const {data,error}=await sb.from("orders").select("id,order_number,customer_name,created_at,total,delivery_method,payment_method,payment_status,status").eq("site_id",siteId).order("created_at",{ascending:false}).limit(100);if(error)throw error;
 const ids=(data||[]).map(o=>o.id);let items=[];if(ids.length){const result=await sb.from("order_items").select("order_id,product_name,variant_name,quantity,line_total").eq("site_id",siteId).in("order_id",ids);if(result.error)throw result.error;items=result.data||[]}
 panel.innerHTML=`<div class="section-head"><h2>Pedidos</h2><button class="mini" type="button" id="refresh-orders">Actualizar pedidos</button></div><p class="muted">Últimos 100 pedidos</p><div class="list">${(data||[]).map(o=>`<article class="row"><div class="row-main"><div class="row-title">#${o.order_number} · ${esc(o.customer_name)}</div><div class="row-sub">${new Date(o.created_at).toLocaleString("es-AR")} · ${esc(o.delivery_method)} · ${esc(o.payment_method)} (${esc(o.payment_status)}) · ${money(o.total)}</div><div class="row-sub">${items.filter(i=>i.order_id===o.id).map(i=>`${i.quantity} × ${esc(i.product_name)}${i.variant_name?" · "+esc(i.variant_name):""}`).join(" · ")}</div></div><select class="order-status" data-id="${o.id}">${["new","preparing","ready","delivered","cancelled"].map(x=>`<option value="${x}" ${x===o.status?"selected":""}>${({new:"NUEVO",preparing:"EN PREPARACIÓN",ready:"LISTO",delivered:"COMPLETADO",cancelled:"CANCELADO"})[x]}</option>`).join("")}</select></article>`).join("")||'<div class="card empty">Todavía no hay pedidos.</div>'}</div>`;
 document.getElementById("refresh-orders").onclick=async()=>{try{await ordersPanel(panel,siteId);toast("Pedidos actualizados.")}catch(e){fail(e)}};
 panel.querySelectorAll(".order-status").forEach(x=>{
    x.dataset.savedStatus=x.value;
    x.onchange=async()=>{
      const previous=x.dataset.savedStatus||"new",next=x.value;
      if(next===previous)return;
      x.disabled=true;
      try{
        const saved=await rpc("platform_update_order_status",{p_order_id:x.dataset.id,p_status:next});
        x.dataset.savedStatus=String(saved?.status||next);
        x.value=x.dataset.savedStatus;
        toast("Estado actualizado.");
      }catch(e){
        x.value=previous;
        fail(e);
      }finally{x.disabled=false}
    };
  });
}
async function paymentsPanel(panel,siteId,dash){
 const mp=await rpc("simple_mercadopago_status",{p_site_id:siteId}),methods={cash:true,transfer:true,mercadopago:false,...(dash.settings?.payment_methods||{})};
 panel.innerHTML=`<form id="payment-settings" class="card"><div class="section-head"><h2>Pagos</h2><span class="status ${mp.connected?"active":""}">${mp.connected?"Mercado Pago conectado":"Mercado Pago no conectado"}</span></div><label><input id="pay_cash" type="checkbox" ${methods.cash?"checked":""}> Efectivo</label><label><input id="pay_transfer" type="checkbox" ${methods.transfer?"checked":""}> Transferencia</label><label><input id="pay_mp" type="checkbox" ${methods.mercadopago?"checked":""} ${mp.connected?"":"disabled"}> Mercado Pago</label><div class="hero-actions"><button class="btn brand" type="submit">Guardar medios de pago</button><button id="connect-mp" class="btn secondary" type="button">${mp.connected?"Reconectar Mercado Pago":"Conectar Mercado Pago"}</button></div><p class="hint">La cuenta conectada pertenece únicamente a este comercio. Los pagos de clientes nunca se mezclan con la suscripción de M Commerce.</p></form>`;
 document.getElementById("connect-mp").onclick=async ev=>{try{setBusy(ev.currentTarget,true);const session=await getSession();const res=await fetch(SUPABASE_URL+"/functions/v1/mercadopago-connect",{method:"POST",headers:{"content-type":"application/json","apikey":SUPABASE_KEY,"authorization":"Bearer "+session.access_token},body:JSON.stringify({action:"start",site_id:siteId})}),out=await res.json();if(!res.ok||!out.authorization_url)throw new Error(out.message||out.error||"No se pudo conectar Mercado Pago.");location.href=out.authorization_url}catch(e){fail(e)}finally{setBusy(ev.currentTarget,false)}};
 document.getElementById("payment-settings").onsubmit=async ev=>{ev.preventDefault();const payment_methods={cash:document.getElementById("pay_cash").checked,transfer:document.getElementById("pay_transfer").checked,mercadopago:document.getElementById("pay_mp").checked};if(!Object.values(payment_methods).some(Boolean))return toast("Elegí al menos un medio de pago.",true);try{setBusy(ev.submitter,true);await rpc("simple_save_store_profile",{p_site_id:siteId,p_profile:{...dash.settings,payment_methods,onboarding_step:dash.settings?.simple_onboarding_step||10}});dash.settings.payment_methods=payment_methods;toast("Medios de pago actualizados.")}catch(e){fail(e)}finally{setBusy(ev.submitter,false)}};
}
async function productsPanel(panel,siteId){
 const {data,error}=await sb.from("products").select("id,name,description,price,category,category_id,active,stock_tracking,stock_quantity,image_url").eq("site_id",siteId).order("sort_order");if(error)throw error;
 panel.innerHTML=`<div class="section-head"><h2>Productos</h2><button id="new-product" class="btn">Nuevo producto</button></div><div class="list">${(data||[]).map(p=>`<article class="row"><div class="row-main"><div class="row-title">${esc(p.name)}</div><div class="row-sub">${esc(p.category)} · ${money(p.price)}${p.stock_tracking?" · Stock "+p.stock_quantity:""}</div></div><button class="mini edit-product" data-json="${esc(JSON.stringify(p))}">Editar</button></article>`).join("")||'<div class="card empty">Cargá tu primer producto.</div>'}</div><div id="product-form"></div>`;
 document.getElementById("new-product").onclick=()=>productForm(siteId,{});
 panel.querySelectorAll(".edit-product").forEach(b=>b.onclick=()=>productForm(siteId,JSON.parse(b.dataset.json)));
}
async function productForm(siteId,p){
 const host=document.getElementById("product-form");const [{data:cats,error:categoriesError},{data:variants,error:variantsError}]=await Promise.all([
    sb.from("product_categories").select("id,name").eq("site_id",siteId).eq("active",true).is("archived_at",null).order("sort_order"),
    p.id?sb.from("product_variants").select("id,name,price_delta,sort_order,stock_tracking,stock_quantity,attributes,sku,available").eq("site_id",siteId).eq("product_id",p.id).eq("active",true).order("sort_order"):Promise.resolve({data:[]})
  ]);
  if(categoriesError)throw categoriesError;
  if(variantsError)throw variantsError;
 host.innerHTML=`<form class="card section" id="product-edit"><div class="section-head"><h2>${p.id?"Editar":"Nuevo"} producto</h2>${p.image_url?`<img class="product-edit-thumb" src="${esc(p.image_url)}" alt="Foto actual de ${esc(p.name||"producto")}">`:""}</div>${field("p_name","Nombre","text",p.name||"","required")}${field("p_price","Precio","number",p.price??"","required min=\"0\" step=\"0.01\"")}<div class="field"><label>Categoría</label><select id="p_category" required><option value="">Elegí una</option>${(cats||[]).map(c=>`<option value="${c.id}" data-name="${esc(c.name)}" ${c.id===p.category_id?"selected":""}>${esc(c.name)}</option>`).join("")}</select></div><div class="field"><label>Descripción</label><textarea id="p_description">${esc(p.description||"")}</textarea></div><div class="field"><label>Foto del producto</label><input id="p_image" type="file" accept="image/jpeg,image/png,image/webp,image/avif"><p class="hint">Podés cambiarla cuando quieras. M Commerce optimiza las imágenes grandes.</p></div><div class="stock-editor"><label><input id="p_stock_tracking" type="checkbox" ${p.stock_tracking?"checked":""}> Controlar stock</label><div class="field"><label for="p_stock_quantity">Unidades disponibles</label><input id="p_stock_quantity" type="number" min="0" step="1" value="${p.stock_quantity??""}" ${p.stock_tracking?"":"disabled"}></div></div><div class="field"><label>Variantes opcionales</label><textarea id="p_variants" placeholder="Una por línea. Ej: Talle: M">${esc((variants||[]).map(v=>v.name+(Number(v.price_delta)?" | "+v.price_delta:"")).join("\n"))}</textarea><p class="hint">Podés usar talle, color, tamaño, sabor o medida. Para un adicional de precio: Grande | 1500</p></div><label><input id="p_active" type="checkbox" ${p.active!==false?"checked":""}> Disponible</label><button class="btn brand" type="submit">Guardar producto</button></form>`;document.getElementById("p_stock_tracking").onchange=e=>{document.getElementById("p_stock_quantity").disabled=!e.currentTarget.checked};
 document.getElementById("product-edit").onsubmit=async ev=>{ev.preventDefault();try{setBusy(ev.submitter,true);let image_url=p.image_url||"";const file=document.getElementById("p_image").files[0];if(document.getElementById("product-edit")?.dataset.mcEnhanced!=="ready")throw new Error("No se cargó completamente el editor de variantes. Actualizá la página antes de guardar para proteger el stock.");const stockField=document.getElementById("p_stock_quantity");if(document.getElementById("p_stock_tracking").checked&&(!/^\d+$/.test(stockField.value)||!Number.isSafeInteger(Number(stockField.value))))throw new Error("Ingresá un stock válido: un número entero mayor o igual a cero.");if(file)image_url=await upload(siteId,file,"products");const sel=document.getElementById("p_category"),opt=sel.selectedOptions[0];if(!sel.value||!opt)throw new Error("Elegí una categoría para este producto.");const inputPrice=Number(document.getElementById("p_price").value);if(!Number.isFinite(inputPrice)||inputPrice<0)throw new Error("Ingresá un precio válido.");await rpc("simple_upsert_product",{p_site_id:siteId,p_product:{id:p.id||null,name:document.getElementById("p_name").value,price:inputPrice,...(p.id&&p.stock_tracking?{expected_stock_quantity:p.stock_quantity}:{}),description:document.getElementById("p_description").value,category_id:sel.value,category:opt.dataset.name,image_url,active:document.getElementById("p_active").checked,stock_tracking:document.getElementById("p_stock_tracking").checked,stock_quantity:document.getElementById("p_stock_tracking").checked?Number(document.getElementById("p_stock_quantity").value||0):null,variants:document.getElementById("p_variants").value.split(/\n/).map((line,index)=>{const [name,delta]=line.split("|");return {name:name.trim(),price_delta:Number((delta||"0").trim())||0,sort_order:index}}).filter(v=>v.name)}});toast("Producto guardado.");openPanel("products",siteId,{})}catch(e){fail(e)}finally{setBusy(ev.submitter,false)}};
}
async function categoriesPanel(panel,siteId){
 const {data,error}=await sb.from("product_categories").select("*").eq("site_id",siteId).order("sort_order");if(error)throw error;
 panel.innerHTML=`<div class="section-head"><h2>Categorías</h2><button id="new-category" class="btn">Nueva categoría</button></div><div class="list">${(data||[]).map(c=>`<article class="row"><div><div class="row-title">${esc(c.name)}</div><div class="row-sub">${c.active?"Visible":"Oculta"}</div></div><button class="mini edit-category" data-json="${esc(JSON.stringify(c))}">Editar</button></article>`).join("")||'<div class="card empty">Creá tu primera categoría.</div>'}</div><div id="category-form"></div>`;
 document.getElementById("new-category").onclick=()=>categoryForm(siteId,{});
 panel.querySelectorAll(".edit-category").forEach(b=>b.onclick=()=>categoryForm(siteId,JSON.parse(b.dataset.json)));
}
function categoryForm(siteId,c){const host=document.getElementById("category-form");host.innerHTML=`<form id="category-edit" class="card section"><h2>${c.id?"Editar":"Nueva"} categoría</h2>${field("c_name","Nombre","text",c.name||"","required maxlength=\"80\"")}<label><input id="c_active" type="checkbox" ${c.active!==false?"checked":""}> Visible</label><button class="btn brand" type="submit">Guardar</button></form>`;document.getElementById("category-edit").onsubmit=async ev=>{ev.preventDefault();try{setBusy(ev.submitter,true);await rpc("simple_upsert_category",{p_site_id:siteId,p_category:{id:c.id||null,name:document.getElementById("c_name").value,active:document.getElementById("c_active").checked}});toast("Categoría guardada.");openPanel("categories",siteId,{})}catch(e){fail(e)}finally{setBusy(ev.submitter,false)}}}
function sharePanel(panel,slug){const url=window.M_COMMERCE_OFFICIAL_ORIGIN+"/tienda/"+encodeURIComponent(slug);panel.innerHTML=`<div class="card"><h2>Compartir mi tienda</h2><p class="muted">${esc(url)}</p><div class="hero-actions"><button id="copy-url" class="btn">Copiar enlace</button><a class="btn brand" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent("Conocé mi tienda: "+url)}">Compartir por WhatsApp</a></div><div id="qr" class="section"></div></div>`;document.getElementById("copy-url").onclick=async()=>{await navigator.clipboard.writeText(url);toast("Enlace copiado.")};if("share"in navigator){const b=document.createElement("button");b.className="btn secondary";b.textContent="Compartir…";b.onclick=()=>navigator.share({title:"Mi tienda",url});panel.querySelector(".hero-actions").appendChild(b)}document.getElementById("qr").innerHTML=`<img width="220" height="220" alt="QR de la tienda" src="https://api.qrserver.com/v1/create-qr-code/?size=440x440&data=${encodeURIComponent(url)}">`}
async function billingCall(action,siteId){const session=await getSession();const res=await fetch(SUPABASE_URL+"/functions/v1/j3-billing",{method:"POST",headers:{"content-type":"application/json","apikey":SUPABASE_KEY,"authorization":"Bearer "+session.access_token},body:JSON.stringify({action,site_id:siteId,return_path:"/simple/app?billing_return=1&site="+encodeURIComponent(siteId)})});const out=await res.json();if(!res.ok)throw new Error(out.message||out.error||"No se pudo procesar la suscripción.");return out}
async function startSubscription(siteId,button){try{setBusy(button,true);const out=await billingCall("subscription_create",siteId),url=out.checkout_url||out.init_point;if(url)location.href=url;else toast("Suscripción iniciada.")}catch(e){fail(e)}finally{setBusy(button,false)}}
function subscriptionGate(site,sub={}){app.innerHTML=`<div class="app-shell"><header class="app-head"><div class="inner"><span class="brand">M COMMERCE <small>SIMPLE</small></span><button id="logout" class="mini">Salir</button></div></header><main class="app-main"><section class="card wizard"><div class="eyebrow">Suscripción</div><h1>Activá M Commerce Simple</h1><p class="muted">La suscripción de M Commerce es independiente de los pagos que recibirás de tus clientes.</p><div class="price">${sub?.amount?money(sub.amount,sub.currency_code||"ARS"):"Plan mensual"} <small>${sub?.amount?"/ mes":""}</small></div><button id="gate-subscribe" class="btn brand">Continuar con Mercado Pago</button><button id="gate-refresh" class="btn secondary" type="button">Ya pagué · verificar</button></section></main></div>`;document.getElementById("logout").onclick=logout;document.getElementById("gate-subscribe").onclick=ev=>startSubscription(site.id,ev.currentTarget);document.getElementById("gate-refresh").onclick=async ev=>{try{setBusy(ev.currentTarget,true);await billingCall("subscription_refresh",site.id);await dashboard(site)}catch(e){fail(e)}finally{setBusy(ev.currentTarget,false)}}}
function planPanel(panel,siteId,sub){panel.innerHTML=`<div class="card"><h2>Mi plan</h2><div class="price">${money(sub?.amount||0,sub?.currency_code||"ARS")} <small>/ mes</small></div><p>Estado: <strong>${esc(sub?.status||"pending")}</strong></p><button id="subscribe" class="btn brand">Administrar suscripción</button></div>`;document.getElementById("subscribe").onclick=ev=>startSubscription(siteId,ev.currentTarget)}
async function wizard(siteId,step=1,dash=null){
 dash=dash||await rpc("simple_dashboard",{p_site_id:siteId});const st=dash.settings||{},state={business_name:st.business_name||"",business_category:st.business_category||"",whatsapp_number:st.whatsapp_number||"",address:st.address||"",schedule:st.schedule||"",logo_url:st.logo_url||"",cover_url:st.cover_url||"",fulfillment_config:st.fulfillment_config||{pickup_enabled:true,shipping_enabled:false},payment_methods:st.payment_methods||{cash:true,transfer:true,mercadopago:false}};let current=Math.max(1,Math.min(10,step));
 const canEditSlug=dash.site?.status==="draft";
 let slug=String(dash.site?.slug||""),slugTouched=false;
 const hasGeneratedSlug=canEditSlug&&/^tienda-[0-9a-f]{12}(?:-[0-9a-f]{6})?$/.test(slug);
 if(hasGeneratedSlug)slug=slugify(state.business_name).slice(0,60);
 const [catExisting,prodExisting]=await Promise.all([
   sb.from("product_categories").select("id").eq("site_id",siteId).eq("active",true).is("archived_at",null).limit(1),
   sb.from("products").select("id").eq("site_id",siteId).eq("active",true).limit(1)
 ]);
 if(catExisting.error)throw catExisting.error;
 if(prodExisting.error)throw prodExisting.error;
 let hasCategory=Boolean(catExisting.data?.length);
 let hasProduct=Boolean(prodExisting.data?.length);
 const render=()=>{const content=[
   ["Nombre del comercio",field("w_name","¿Cómo se llama tu comercio?","text",state.business_name,'required minlength="2" maxlength="100"')+(canEditSlug?field("w_slug","Enlace de tu tienda","text",slug,'required minlength="3" maxlength="60" pattern="[a-z0-9]+(-[a-z0-9]+)*"')+'<p class="hint">Tu enlace: '+esc(window.M_COMMERCE_OFFICIAL_ORIGIN)+'/tienda/<strong id="w_slug_preview">'+esc(slug)+'</strong></p>':'<p class="hint">Enlace publicado: '+esc(dash.site?.slug||"")+'. No se modifica desde el asistente.</p>')],
  ["Logo y portada",`<div class="upload-grid"><div class="field"><label for="w_logo">Logo del comercio</label>${state.logo_url?`<img class="upload-preview logo-preview" src="${esc(state.logo_url)}" alt="Logo actual">`:""}<input id="w_logo" type="file" accept="image/jpeg,image/png,image/webp,image/avif"><span class="hint">JPG, PNG, WebP o AVIF · máx. 8 MB.</span></div><div class="field"><label for="w_cover">Imagen de portada</label>${state.cover_url?`<img class="upload-preview cover-preview" src="${esc(state.cover_url)}" alt="Portada actual">`:""}<input id="w_cover" type="file" accept="image/jpeg,image/png,image/webp,image/avif"><span class="hint">Se muestra arriba de tu tienda.</span></div></div>`],
  ["Rubro",field("w_category","¿A qué se dedica?","text",state.business_category,"required placeholder=\"Ej: Indumentaria, comidas, ferretería\"")],
  ["WhatsApp",field("w_phone","Número con código de área","tel",state.whatsapp_number,"required")],
  ["Dirección y localidad",field("w_address","Dirección","text",state.address,"required")],
  ["Modalidad de entrega",`<div class="option-grid"><button type="button" class="option fulfillment ${state.fulfillment_config.pickup_enabled?"selected":""}" data-k="pickup_enabled">Retiro</button><button type="button" class="option fulfillment ${state.fulfillment_config.shipping_enabled?"selected":""}" data-k="shipping_enabled">Delivery</button></div>`],
  ["Métodos de pago",`<div class="option-grid">${[["cash","Efectivo"],["transfer","Transferencia"]].map(([k,l])=>`<button type="button" class="option payment ${state.payment_methods[k]?"selected":""}" data-k="${k}">${l}</button>`).join("")}</div>`],
  ["Horarios",`<div class="field"><label for="w_schedule">Horarios de atención</label><textarea id="w_schedule" required>${esc(state.schedule)}</textarea></div>`],
   ["Primera categoría",hasCategory?'<p class="muted">Ya tenés categorías creadas. Podés gestionarlas después desde tu panel.</p>':field("w_first_category","Nombre de la categoría","text","",'required maxlength="80" placeholder="Ej: Remeras"')],
   ["Primer producto",hasProduct?'<p class="muted">Ya tenés productos en tu tienda. Podés gestionarlos desde Productos al terminar.</p>':field("w_product_name","Nombre del producto","text","",'required maxlength="160"')+field("w_product_price","Precio","number","",'required min="0" step="0.01"')+'<div class="field"><label>Foto opcional</label><input id="w_product_image" type="file" accept="image/jpeg,image/png,image/webp,image/avif"></div>']
 ][current-1];
 app.innerHTML=`<div class="app-shell"><header class="app-head"><div class="inner"><span class="brand">M COMMERCE <small>SIMPLE</small></span><button id="logout" class="mini">Salir</button></div></header><main class="app-main"><form id="wizard" class="card wizard"><div class="eyebrow">Paso ${current} de 10</div><div class="progress"><div style="width:${current*10}%"></div></div><section class="wizard-step"><h2>${content[0]}</h2>${content[1]}</section><div class="wizard-actions"><button class="btn secondary" type="button" id="back" ${current===1?"disabled":""}>Atrás</button><button class="btn brand" type="submit">${current===10?"Terminar":"Continuar"}</button></div></form></main></div>`;
 document.getElementById("logout").onclick=logout;document.getElementById("back").onclick=()=>{current--;render()};
 if(current===1&&canEditSlug){
   const nameInput=document.getElementById("w_name"),slugInput=document.getElementById("w_slug"),preview=document.getElementById("w_slug_preview");
   nameInput.oninput=()=>{if(hasGeneratedSlug&&!slugTouched){slug=slugify(nameInput.value).slice(0,60);slugInput.value=slug;preview.textContent=slug||"tu-tienda";}};
   slugInput.oninput=()=>{slugTouched=true;slug=slugify(slugInput.value).slice(0,60);slugInput.value=slug;preview.textContent=slug||"tu-tienda";};
 }
 document.querySelectorAll(".fulfillment,.payment").forEach(b=>b.onclick=()=>{const target=b.classList.contains("payment")?state.payment_methods:state.fulfillment_config;target[b.dataset.k]=!target[b.dataset.k];b.classList.toggle("selected",target[b.dataset.k])});
 document.getElementById("wizard").onsubmit=async ev=>{ev.preventDefault();try{setBusy(ev.submitter,true);
  if(current===1){
   state.business_name=document.getElementById("w_name").value.trim();
   if(state.business_name.length<2||state.business_name.length>100)throw new Error("El nombre debe tener entre 2 y 100 caracteres.");
   if(canEditSlug){slug=String(document.getElementById("w_slug").value||"").trim().toLowerCase();if(slug.length<3||slug.length>60||!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))throw new Error("El enlace debe tener de 3 a 60 caracteres: letras, números y guiones.");}
 }
  if(current===2){const logo=document.getElementById("w_logo").files[0],cover=document.getElementById("w_cover").files[0];if(logo)state.logo_url=await upload(siteId,logo,"brand");if(cover)state.cover_url=await upload(siteId,cover,"cover")}
  if(current===3)state.business_category=document.getElementById("w_category").value.trim();
  if(current===4)state.whatsapp_number=document.getElementById("w_phone").value.trim();
  if(current===5)state.address=document.getElementById("w_address").value.trim();
  if(current===6&&!state.fulfillment_config.pickup_enabled&&!state.fulfillment_config.shipping_enabled)throw new Error("Elegí retiro, delivery o ambas modalidades.");
  if(current===7&&!Object.values(state.payment_methods).some(Boolean))throw new Error("Elegí al menos un método de pago.");
  if(current===8)state.schedule=document.getElementById("w_schedule").value.trim();
  if(current===9&&!hasCategory){await rpc("simple_upsert_category",{p_site_id:siteId,p_category:{name:document.getElementById("w_first_category").value.trim(),active:true}});hasCategory=true;}
  if(current===10){
    if(!hasProduct){
      const {data:cats,error:catsError}=await sb.from("product_categories").select("id,name").eq("site_id",siteId).eq("active",true).is("archived_at",null).order("created_at").limit(1);
      if(catsError)throw catsError;
      if(!cats?.[0]?.id)throw new Error("Creá una categoría antes de agregar productos.");
      let image_url="";
      const f=document.getElementById("w_product_image").files[0];
      if(f)image_url=await upload(siteId,f,"products");
      await rpc("simple_upsert_product",{p_site_id:siteId,p_product:{name:document.getElementById("w_product_name").value.trim(),price:Number(document.getElementById("w_product_price").value),category_id:cats[0].id,category:cats[0].name,image_url,active:true}});
      hasProduct=true;
    }
    const done=await rpc("simple_complete_onboarding",{p_site_id:siteId});
    if(!done.ready)throw new Error("Falta completar: "+(done.missing||[]).join(", "));
    toast("Tu tienda está lista.");
    const sites=await rpc("platform_my_sites");
    return dashboard((Array.isArray(sites)?sites:sites.sites).find(x=>x.id===siteId));
  }
  await rpc("simple_save_store_profile",{p_site_id:siteId,p_profile:{...state,onboarding_step:Math.min(10,current+1)}});if(current===1&&canEditSlug){const saved=await rpc("simple_set_draft_slug",{p_site_id:siteId,p_slug:slug});dash.site.slug=saved.slug;}current++;render();
 }catch(e){fail(e)}finally{setBusy(ev.submitter,false)}};
 };render();
}
async function optimizeImage(file){if(file.size<350000)return file;try{const bitmap=await createImageBitmap(file),scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext("2d").drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const blob=await new Promise((resolve,reject)=>canvas.toBlob(x=>x?resolve(x):reject(new Error("No se pudo optimizar la imagen.")),"image/webp",0.82));return new File([blob],file.name.replace(/\.[^.]+$/,"")+".webp",{type:"image/webp"})}catch(e){console.warn("image_optimization",e);return file}}
async function upload(siteId,file,folder){if(file.size>8*1024*1024)throw new Error("La imagen supera el máximo de 8 MB.");if(!["image/jpeg","image/png","image/webp","image/avif"].includes(file.type))throw new Error("Formato no permitido. Usá JPG, PNG, WebP o AVIF.");file=await optimizeImage(file);const ext=(file.name.split(".").pop()||"jpg").toLowerCase(),path=`sites/${siteId}/${folder}/${crypto.randomUUID()}.${ext}`;const {error}=await sb.storage.from("simple-store-images").upload(path,file,{cacheControl:"31536000",upsert:false});if(error)throw error;return sb.storage.from("simple-store-images").getPublicUrl(path).data.publicUrl}
async function storefront(slug){
 let data;try{data=await rpc("simple_public_storefront",{p_slug:slug})}catch(e){return fail(e)}if(!data){app.innerHTML='<main class="loading"><h1>Tienda no disponible</h1><p>Revisá el enlace o intentá más tarde.</p></main>';return}
 const site=data.site,st=data.settings||{},products=(data.products||[]).filter(p=>p.effective_available!==false),cats=data.categories||[],variants=(data.variants||[]).filter(v=>v.available!==false);let cart=[],checkoutAttemptId=null,lastCheckoutPayload="",checkoutSubmitting=false;
  // A return URL is not evidence of payment approval: the verified webhook decides.
  const returnState=new URLSearchParams(location.search).get("payment");
  const returnMessages={
    success:"Volviste de Mercado Pago. Tu pago se está verificando. El comercio recibirá la confirmación cuando Mercado Pago la informe.",
    pending:"El pago está pendiente de confirmación. Antes de repetir el pedido, verificá su estado con Mercado Pago o consultá al comercio.",
    failure:"No pudimos confirmar el pago. Antes de realizar otro pedido, comprobá si el anterior quedó pendiente."
  };
  const returnNotice=Object.hasOwn(returnMessages,returnState||"")?returnMessages[returnState]:"";setSeo(`${site.name} · M Commerce`,`${site.name}: catálogo online, productos y pedidos.`,window.M_COMMERCE_OFFICIAL_ORIGIN+"/tienda/"+encodeURIComponent(site.slug),st.cover_url||st.logo_url||"");
 const render=()=>{app.innerHTML=`<div class="store"><header class="store-head"><div class="store-cover" style="background-image:url('${esc(st.cover_url||"")}')"></div><div class="store-info">${st.logo_url?`<img class="store-logo" src="${esc(st.logo_url)}" alt="Logo de ${esc(site.name)}">`:""}<div><h1>${esc(site.name)}</h1><p>${esc(st.schedule||"")} · ${esc(st.address||"")}</p></div></div></header>${returnNotice?`<section class="card checkout-return" role="status" aria-live="polite"><strong>Estado del pago</strong><p>${esc(returnNotice)}</p></section>`:""}<main class="catalog"><div class="category-tabs"><button class="chip active" data-cat="">Todo</button>${cats.map(c=>`<button class="chip" data-cat="${esc(c.name)}">${esc(c.name)}</button>`).join("")}</div><div class="products">${products.map(p=>`<article class="product" data-category="${esc(p.category)}">${p.image_url?`<img loading="lazy" src="${esc(p.image_url)}" alt="${esc(p.name)}">`:'<div style="aspect-ratio:4/3;background:#eef1f5"></div>'}<div class="product-body"><h3>${esc(p.name)}</h3><p>${esc(p.description||"")}</p>${variants.some(v=>v.product_id===p.id)?`<select class="variant-select" aria-label="Variante de ${esc(p.name)}"><option value="">Elegí una variante</option>${variants.filter(v=>v.product_id===p.id).map(v=>`<option value="${v.id}">${esc(v.name)}${Number(v.price_delta)?` (+${money(v.price_delta,site.currency_code)})`:""}</option>`).join("")}</select>`:""}<div class="product-foot"><span class="money">${money(p.price,site.currency_code)}</span><button class="mini add" data-id="${p.id}">Agregar</button></div></div></article>`).join("")||'<div class="empty">No hay productos disponibles.</div>'}</div></main>${cart.length?`<button id="cart-bar" class="cart-bar"><span>Ver pedido (${cart.reduce((n,x)=>n+x.quantity,0)})</span><span>${money(total(),site.currency_code)}</span></button>`:""}</div>`;bind()};
 const bind=()=>{document.querySelectorAll(".add").forEach(b=>b.onclick=()=>{const p=products.find(x=>x.id===b.dataset.id),productVariants=variants.filter(v=>v.product_id===p.id),select=b.closest(".product").querySelector(".variant-select"),variantId=select?.value||null;if(productVariants.length&&!variantId)return toast("Elegí una variante.",true);const variant=productVariants.find(v=>v.id===variantId)||null,key=p.id+":"+(variantId||""),row=cart.find(x=>x.key===key);row?row.quantity++:cart.push({...p,key,variant_id:variantId,variant_name:variant?.name||"",unit_price:Number(p.price)+Number(variant?.price_delta||0),quantity:1});lastCheckoutPayload="";render()});document.querySelectorAll(".chip").forEach(b=>b.onclick=()=>{document.querySelectorAll(".chip").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll(".product").forEach(x=>x.hidden=!!b.dataset.cat&&x.dataset.category!==b.dataset.cat)});const cb=document.getElementById("cart-bar");if(cb)cb.onclick=cartDrawer};
 const total=()=>cart.reduce((n,x)=>n+Number(x.unit_price??x.price)*x.quantity,0);
 const cartDrawer=()=>{const d=document.createElement("div");d.className="drawer";d.innerHTML=`<section class="drawer-panel"><div class="drawer-inner"><div class="section-head"><h2>Tu pedido</h2><button class="mini close">Cerrar</button></div><div class="list">${cart.map(x=>`<div class="row"><div><strong>${esc(x.name)}${x.variant_name?" · "+esc(x.variant_name):""}</strong><div class="row-sub">${money(x.unit_price??x.price)} × ${x.quantity}</div></div><div class="qty"><button class="mini q" data-key="${esc(x.key)}" data-d="-1">−</button><strong>${x.quantity}</strong><button class="mini q" data-key="${esc(x.key)}" data-d="1">+</button></div></div>`).join("")}</div><div class="mc-checkout-totals"><div>Productos: <strong>${money(total(),site.currency_code)}</strong></div><div id="mc-shipping-charge">Envío: se calcula al elegir entrega</div><h2 id="mc-grand-total">Total estimado: ${money(total(),site.currency_code)}</h2><p class="hint">El importe definitivo lo confirma el servidor al registrar el pedido.</p></div><form id="checkout">${field("customer_name","Nombre","text","","required")}${field("customer_phone","Teléfono","tel","","required")}<div class="field"><label>Entrega</label><select id="delivery_method">${st.fulfillment_config?.pickup_enabled!==false?'<option value="pickup">Retiro</option>':""}${st.fulfillment_config?.shipping_enabled?'<option value="delivery">Delivery</option>':""}</select></div>${field("delivery_address","Dirección (si elegís delivery)")}${st.delivery_info?`<p class="hint">Cobertura informada por el comercio: ${esc(st.delivery_info)}</p>`:""}<div class="field"><label>Forma de pago</label><select id="payment_method">${st.payment_methods?.cash!==false?'<option value="cash">Efectivo</option>':""}${st.payment_methods?.transfer?'<option value="transfer">Transferencia</option>':""}${st.payment_methods?.mercadopago?'<option value="mercadopago">Mercado Pago</option>':""}</select></div><button class="btn brand" type="submit">Confirmar pedido</button></form></div></section>`;document.body.appendChild(d);d.querySelector(".close").onclick=()=>d.remove();d.querySelectorAll(".q").forEach(b=>b.onclick=()=>{const x=cart.find(i=>i.key===b.dataset.key);if(!x)return;x.quantity+=Number(b.dataset.d);cart=cart.filter(i=>i.quantity>0);lastCheckoutPayload="";d.remove();render();if(cart.length)cartDrawer()});const updateDeliveryQuote=()=>{const shipping=d.querySelector("#delivery_method")?.value==="delivery";const fee=Number(st.delivery_fee||0);const amount=shipping&&Number.isFinite(fee)&&fee>0?fee:0;const label=d.querySelector("#mc-shipping-charge"),sum=d.querySelector("#mc-grand-total");if(label)label.textContent="Envío: "+(shipping?money(amount,site.currency_code):"sin cargo por retiro");if(sum)sum.textContent="Total estimado: "+money(total()+amount,site.currency_code);};d.querySelector("#delivery_method").addEventListener("change",updateDeliveryQuote);updateDeliveryQuote();d.querySelector("#checkout").onsubmit=async ev=>{ev.preventDefault();if(checkoutSubmitting)return;checkoutSubmitting=true;try{setBusy(ev.submitter,true);const session=await getSession();const body={site_id:site.id,customer_name:document.getElementById("customer_name").value,customer_phone:document.getElementById("customer_phone").value,delivery_method:document.getElementById("delivery_method").value,delivery_address:document.getElementById("delivery_address").value,payment_method:document.getElementById("payment_method").value,items:cart.map(x=>({product_id:x.id,quantity:x.quantity,variant_id:x.variant_id||null}))};
const name=body.customer_name.trim(),phone=body.customer_phone.replace(/\D/g,""),delivery=body.delivery_method,method=body.payment_method;
if(!cart.length)throw new Error("Agregá al menos un producto.");
if(cart.length>40||cart.some(x=>!Number.isInteger(x.quantity)||x.quantity<1||x.quantity>100))throw new Error("Revisá las cantidades del carrito (máximo 40 productos diferentes).");
if(name.length<2||name.length>120)throw new Error("Ingresá un nombre válido.");
if(phone.length<8||phone.length>15)throw new Error("Ingresá un teléfono válido, con código de área.");
if(!["pickup","delivery"].includes(delivery)||!["cash","transfer","mercadopago"].includes(method))throw new Error("Elegí entrega y forma de pago.");
if(delivery==="delivery"&&body.delivery_address.trim().length<5)throw new Error("Ingresá la dirección de entrega.");
// Delivery details must be part of the attempt fingerprint: changing the map pin,
// apartment or instructions after a failed checkout must create a NEW attempt ID.
if(delivery==="delivery"){
 const loc=window.__mcDeliveryLocation;
 const lat=loc?.lat==null?NaN:Number(loc.lat),lng=loc?.lng==null?NaN:Number(loc.lng);
 const valid=Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180;
 if(valid){
   body.delivery_latitude=lat;body.delivery_longitude=lng;
   body.delivery_place_id=String(loc.place_id||"");
   body.delivery_address_formatted=String(loc.formatted||body.delivery_address);
   body.delivery_address_source=loc.source==="google"?"google":"manual_map";
   if(loc.formatted)body.delivery_address=String(loc.formatted);
 }else body.delivery_address_source="manual";
 body.delivery_unit=String(document.getElementById("mc_delivery_unit")?.value||"");
 body.delivery_instructions=String(document.getElementById("mc_delivery_instructions")?.value||"");
}
const fingerprint=JSON.stringify(body);
if(!checkoutAttemptId||fingerprint!==lastCheckoutPayload){checkoutAttemptId=crypto.randomUUID();lastCheckoutPayload=fingerprint;}
body.checkout_attempt_id=checkoutAttemptId;
const res=await fetch(SUPABASE_URL+"/functions/v1/simple-checkout",{method:"POST",headers:{"content-type":"application/json","apikey":SUPABASE_KEY,...(session?{"authorization":"Bearer "+session.access_token}:{})},body:JSON.stringify(body)}),out=await res.json();if(!res.ok)throw new Error(out.message||out.error||"No se pudo confirmar el pedido.");if(out.payment_url)return location.href=out.payment_url;cart=[];checkoutAttemptId=null;lastCheckoutPayload="";d.remove();render();toast("Pedido registrado.");if(out.whatsapp_url)setTimeout(()=>location.href=out.whatsapp_url,350)}catch(e){fail(e)}finally{setBusy(ev.submitter,false);checkoutSubmitting=false}}};
 render();
}
async function logout(){await sb.auth.signOut();location.href="/simple"}
sb.auth.onAuthStateChange((event)=>{if(event==="PASSWORD_RECOVERY"&&route.startsWith("/simple/app"))resetPasswordView()});
(async()=>{try{loading();if(route.startsWith("/tienda/"))await storefront(route.split("/").filter(Boolean).pop());else if(route.startsWith("/simple/admin"))await adminRoute();else if(route.startsWith("/simple/app"))await appRoute();else if(route.startsWith("/simple/pro"))proRequest();else landing()}catch(e){app.innerHTML='<main class="loading"><h1>No pudimos cargar M Commerce</h1><p>Actualizá la página o intentá más tarde.</p></main>';fail(e)}})();
})();