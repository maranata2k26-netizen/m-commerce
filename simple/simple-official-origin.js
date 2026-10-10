(()=>{"use strict";
const host=String(window.location.hostname||"").toLowerCase();
const staging=host==="localhost"||host==="127.0.0.1"||host==="m-commerce-staging.vercel.app"||/^(?:m-commerce|mcommerce|m-commerce-staging)-git-[a-z0-9-]+\.vercel\.app$/.test(host)||/^(?:m-commerce|mcommerce|m-commerce-staging)-[a-z0-9]{9}-maranata3\.vercel\.app$/.test(host);
window.M_COMMERCE_IS_STAGING=staging;
window.M_COMMERCE_OFFICIAL_ORIGIN=staging?"https://m-commerce-staging.vercel.app":"https://mcommerce.vercel.app";
window.M_COMMERCE_SUPABASE_URL=staging?"https://jcgvunffeskkbgsbomgy.supabase.co":"https://kjoixhzaxopdbmudzfsg.supabase.co";
window.M_COMMERCE_SUPABASE_KEY=staging?"sb_publishable_5TX-YZ5p7yiZHZDAjQSGXg_c29FCBQ8":"sb_publishable_G9dKTg3ev1183qjfVkqMXg_kp5WDPaq";
})();
