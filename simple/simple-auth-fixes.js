(()=>{"use strict";
const OFFICIAL_ORIGIN=String(window.M_COMMERCE_OFFICIAL_ORIGIN||"https://m-commerce-ar.vercel.app").replace(/\/+$/,"");
const sb=window.__mcSimpleClient;
if(!sb)return;

const official=path=>OFFICIAL_ORIGIN+path;
const originalSignUp=sb.auth.signUp.bind(sb.auth);

sb.auth.signUp=async(credentials)=>{
  const result=await originalSignUp(credentials);
  if(result?.error)return result;

  const user=result?.data?.user;
  const identities=user?.identities;
  const noSession=!result?.data?.session;

  // Supabase deliberately returns a successful-looking response for repeated signups.
  // When identities is an empty array, do not lie to the user saying a new email was sent.
  if(noSession&&Array.isArray(identities)&&identities.length===0){
    const error=new Error("Este email ya tiene una cuenta. Ingresá con tu contraseña o usá Recuperar contraseña.");
    error.code="ACCOUNT_ALREADY_REGISTERED";
    return {data:result.data,error};
  }

  if(noSession&&credentials?.email){
    try{sessionStorage.setItem("mc_pending_confirmation_email",String(credentials.email).trim())}catch{}
  }
  return result;
};

function helper(){
  const form=document.getElementById("auth-form");
  if(!form||document.getElementById("mc-email-confirmation-help"))return;
  const q=new URLSearchParams(location.search);
  if(q.get("mode")!=="register")return;

  const box=document.createElement("div");
  box.id="mc-email-confirmation-help";
  box.style.cssText="margin-top:14px;padding:14px;border:1px solid #dbe4f0;border-radius:14px;background:#f8fbff;font-size:14px;line-height:1.45";
  box.innerHTML='<strong style="display:block;margin-bottom:5px">¿No te llegó el correo?</strong><span style="display:block;color:#526174;margin-bottom:10px">Revisá Spam/Promociones. Si no aparece, podés reenviarlo.</span><button id="mc-resend-confirmation" class="mini" type="button">Reenviar verificación</button><span id="mc-resend-status" style="display:block;margin-top:8px;color:#526174"></span>';
  form.insertAdjacentElement("afterend",box);

  const btn=document.getElementById("mc-resend-confirmation");
  const status=document.getElementById("mc-resend-status");
  btn.onclick=async()=>{
    const email=String(document.getElementById("email")?.value||sessionStorage.getItem("mc_pending_confirmation_email")||"").trim();
    if(!email){status.textContent="Ingresá tu email primero.";return;}
    btn.disabled=true;
    btn.textContent="Reenviando…";
    status.textContent="";
    try{
      const {error}=await sb.auth.resend({type:"signup",email,options:{emailRedirectTo:official("/simple/app?verified=1")}});
      if(error){
        const msg=String(error.message||"");
        if(/already.*confirm|confirmed|registered/i.test(msg)){
          status.textContent="Ese email ya está confirmado. Usá Ingresar o Recuperar contraseña.";
        }else if(/rate|seconds|minute|too many/i.test(msg)){
          status.textContent="Esperá un minuto y volvé a tocar Reenviar verificación.";
        }else{
          status.textContent="No se pudo reenviar todavía. Probá nuevamente en un minuto.";
          console.error("M Commerce resend confirmation",error);
        }
      }else{
        status.textContent="Correo reenviado. Revisá también Spam y Promociones.";
      }
    }catch(error){
      console.error("M Commerce resend confirmation",error);
      status.textContent="No se pudo reenviar todavía. Probá nuevamente en un minuto.";
    }finally{
      setTimeout(()=>{btn.disabled=false;btn.textContent="Reenviar verificación"},60000);
    }
  };
}

new MutationObserver(helper).observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener("DOMContentLoaded",helper);
helper();
})();
