const sample = `# راهنمای استقرار / Deployment Guide

این سرویس درخواست‌های کاربران را پردازش می‌کند و نتیجه را در cache نگه می‌دارد.

## مراحل اجرا
1. متغیرهای محیطی را تنظیم کنید
2. تست‌ها را اجرا کنید
3. نسخهٔ نهایی را deploy کنید

\`\`\`http
GET /v1/models
Authorization: Bearer sk-...
\`\`\`

| وضعیت | Status | توضیح |
| --- | --- | --- |
| آماده | Ready | قابل انتشار |
| بررسی | Review | نیازمند تأیید |`;
const source=document.querySelector("#source"),output=document.querySelector("#output"),wikiTab=document.querySelector("#wiki-tab"),mdTab=document.querySelector("#markdown-tab");
let mode="wiki";source.value=sample;
function splitRow(s){return s.trim().replace(/^\||\|$/g,"").split("|").map(x=>x.trim())}
function detectLanguage(s){if(/\b(const|let|function|console\.log|=>)\b/.test(s))return"javascript";if(/\b(def|import|print|elif)\b/.test(s))return"python";if(/\b(SELECT|FROM|WHERE|INSERT)\b/i.test(s))return"sql";return"text"}
function parse(text){const lines=text.replace(/\r/g,"").split("\n"),blocks=[];let i=0;while(i<lines.length){const line=lines[i];if(!line.trim()){i++;continue}const fence=line.match(/^```([\w#+.-]*)\s*$/);if(fence){const body=[];i++;while(i<lines.length&&!/^```\s*$/.test(lines[i]))body.push(lines[i++]);i++;blocks.push({type:"code",language:fence[1]||detectLanguage(body.join("\n")),text:body.join("\n")});continue}const h=line.match(/^(#{1,6})\s+(.+)$/);if(h){blocks.push({type:"heading",level:h[1].length,text:h[2]});i++;continue}if(/^(\s*[-*_]){3,}\s*$/.test(line)){blocks.push({type:"rule"});i++;continue}if(/^>\s?/.test(line)){const q=[];while(i<lines.length&&/^>\s?/.test(lines[i]))q.push(lines[i++].replace(/^>\s?/,""));blocks.push({type:"quote",text:q.join("\n")});continue}if(line.includes("|")&&i+1<lines.length&&/^\s*\|?[\s:|-]+\|[\s:|-]+/.test(lines[i+1])){const rows=[splitRow(line)];i+=2;while(i<lines.length&&lines[i].includes("|")&&lines[i].trim())rows.push(splitRow(lines[i++]));blocks.push({type:"table",rows});continue}const list=line.match(/^\s*(?:([-+*])|(\d+)[.)])\s+(.+)$/);if(list){const ordered=Boolean(list[2]),items=[];while(i<lines.length){const item=lines[i].match(/^\s*(?:([-+*])|(\d+)[.)])\s+(.+)$/);if(!item||Boolean(item[2])!==ordered)break;items.push(item[3]);i++}blocks.push({type:"list",ordered,items});continue}const p=[line.trim()];i++;while(i<lines.length&&lines[i].trim()&&!/^(#{1,6})\s|^```|^>\s?|^\s*(?:[-+*]|\d+[.)])\s+/.test(lines[i]))p.push(lines[i++].trim());blocks.push({type:"paragraph",text:p.join(" ")})}return blocks}
function wi(s){return s.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,"[$1|$2]").replace(/`([^`]+)`/g,"{{$1}}").replace(/\*\*([^*]+)\*\*/g,"*$1*").replace(/__([^_]+)__/g,"*$1*").replace(/(?<!\*)\*([^*]+)\*(?!\*)/g,"_$1_")}
function wiki(blocks){const supported={javascript:"javascript",typescript:"javascript",js:"javascript",ts:"javascript",python:"python",py:"python",java:"java",sql:"sql",bash:"bash",shell:"bash",css:"css",html:"html/xml",xml:"html/xml",json:"javascript"};return blocks.map(b=>{if(b.type==="rule")return"----";if(b.type==="heading")return`h${b.level}. ${wi(b.text)}`;if(b.type==="paragraph")return wi(b.text);if(b.type==="quote")return`{quote}\n${wi(b.text)}\n{quote}`;if(b.type==="code")return`{code:language=${supported[b.language.toLowerCase()]||"none"}}\n${b.text}\n{code}`;if(b.type==="list")return b.items.map(x=>`${b.ordered?"#":"*"} ${wi(x)}`).join("\n");const[head,...rows]=b.rows;return[`||${head.map(wi).join("||")}||`,...rows.map(r=>`|${r.map(wi).join("|")}|`)].join("\n")}).join("\n\n")}
function render(){const blocks=parse(source.value);output.value=mode==="wiki"?wiki(blocks):source.value;document.querySelector("#blocks").textContent=blocks.length;document.querySelector("#codes").textContent=blocks.filter(x=>x.type==="code").length;document.querySelector("#tables").textContent=blocks.filter(x=>x.type==="table").length;document.querySelector("#characters").textContent=`${source.value.length.toLocaleString("en-US")} characters`}
function setMode(next){mode=next;wikiTab.classList.toggle("active",mode==="wiki");mdTab.classList.toggle("active",mode==="markdown");document.querySelector("#copy").textContent="Copy";document.querySelector("#usage").textContent=`Use in Confluence: Insert → Markup → ${mode==="wiki"?"Confluence Wiki":"Markdown"}`;document.querySelector("#format").textContent=mode==="wiki"?"Confluence Wiki":"Markdown";render()}
source.addEventListener("input",render);wikiTab.addEventListener("click",()=>setMode("wiki"));mdTab.addEventListener("click",()=>setMode("markdown"));document.querySelector("#clear").addEventListener("click",()=>{source.value="";render()});document.querySelector("#copy").addEventListener("click",async e=>{await navigator.clipboard.writeText(output.value);e.currentTarget.textContent="Copied ✓";e.currentTarget.classList.add("done");setTimeout(()=>{e.currentTarget.classList.remove("done");e.currentTarget.textContent="Copy"},1600)});render();
