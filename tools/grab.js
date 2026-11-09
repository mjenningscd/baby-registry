(function(){
var q=function(s){return document.querySelector(s)},m=function(p){var e=q('meta[property="'+p+'"],meta[name="'+p+'"]');return e?e.content:""};
var name="",price="",img="";
document.querySelectorAll('script[type="application/ld+json"]').forEach(function(s){try{var f=function(n){if(!n||typeof n!="object")return;if(Array.isArray(n))return n.forEach(f);if(n["@graph"])f(n["@graph"]);var t=n["@type"];if(t=="Product"||(Array.isArray(t)&&t.indexOf("Product")>=0)){name=name||n.name;var o=Array.isArray(n.offers)?n.offers[0]:n.offers;if(o&&!price)price=o.price||o.lowPrice||"";if(!img&&n.image){var i=Array.isArray(n.image)?n.image[0]:n.image;img=i.url||i}}};f(JSON.parse(s.textContent))}catch(e){}});
var h=q("#productTitle")||q("h1");name=(h&&h.textContent.trim())||name||m("og:title")||document.title;
if(!price){var sel=['#corePrice_feature_div .a-offscreen','.a-price .a-offscreen','[itemprop=price]','[data-testid*="price" i]','[class*="price" i]'];
for(var k=0;k<sel.length&&!price;k++){var els=document.querySelectorAll(sel[k]);for(var j=0;j<els.length;j++){var e=els[j];if(e.closest("s,del,[class*=was i],[class*=old i],[class*=strike i]"))continue;var t=(e.getAttribute("content")||e.textContent||"").match(/\$?\s*(\d{1,5}(?:[.,]\d{2})?)/);if(t&&e.offsetParent!==null||t&&e.getAttribute("content")){price=t[1].replace(",",".");break}}}}
var li=q("#landingImage");img=(li&&(li.getAttribute("data-old-hires")||li.src))||img||m("og:image");
if(!img){var b=null,a=0;document.querySelectorAll("img").forEach(function(i){var s=i.naturalWidth*i.naturalHeight;if(s>a&&i.offsetParent){a=s;b=i}});if(b)img=b.currentSrc||b.src}
var d={url:location.href.split("#")[0],name:name.replace(/\s+/g," ").slice(0,140),price:price?parseFloat(price):null,image:img,site:(m("og:site_name")||"")};
window.open("https://babyjennings.netlify.app/#add="+encodeURIComponent(JSON.stringify(d)),"_blank")||(location.href="https://babyjennings.netlify.app/#add="+encodeURIComponent(JSON.stringify(d)));
})();
