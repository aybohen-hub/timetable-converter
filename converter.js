/* No input HTML is inserted into the live document. */
(function(root){
'use strict';
const clean=s=>(s||'').replace(/\s+/g,' ').trim();
function date(s){const m=s.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);if(!m)return null;const d=`${m[3]}-${m[2]}-${m[1]}`;if(new Date(d+'T00:00:00Z').toISOString().slice(0,10)!==d)throw Error('Invalid date in timetable.');return d;}
function parse(html){
 // Strip active and resource-loading markup before detached parsing.
 const safe=html.replace(/<(script|style|iframe|object|embed|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'').replace(/<(?:img|link|base|meta|source|video|audio)\b[^>]*>/gi,'');
 const doc=new DOMParser().parseFromString(safe,'text/html');const nodes=[...doc.querySelectorAll('.gridEvent')];
 if(!nodes.length)throw Error('No classes found. Choose the HTML export from the university timetable, not a PDF or a saved login page.');
 const result=[],seen=new Set();let duplicates=0;
 for(const node of nodes){const cell=node.closest('td'),table=node.closest('table');if(!cell||!table)throw Error('Unsupported timetable layout: an event has no date column.');
 const row=cell.parentElement;const index=[...row.children].indexOf(cell);const headers=[...table.querySelector('tr').children];
 const explicit=clean(node.querySelector('.gridEventDate')?.textContent);const day=date(explicit)||date(headers[index]?.textContent||'')||date(row.querySelector('.date-cell')?.textContent||'');
 const title=clean(node.querySelector('.gridEventDesc')?.textContent)||clean(node.querySelector('.gridEventTitle')?.textContent);
 const time=clean(node.querySelector('.gridEventTime')?.textContent).match(/^(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})$/);
 if(!day||!title||!time)throw Error('An event is missing a date, full title or time. Export was not downloaded: please use a fresh university HTML export.');
 const start=+time[1]*60+ +time[2],end=+time[3]*60+ +time[4];if(+time[1]>23||+time[3]>23||+time[2]>59||+time[4]>59||end<=start)throw Error('Invalid or overnight event time. Please check the source timetable.');
 const location=clean([...node.querySelectorAll('.gridEventLocation')].map(n=>n.textContent).join('; '));
 const e={date:day,start:`${time[1].padStart(2,'0')}:${time[2]}`,end:`${time[3].padStart(2,'0')}:${time[4]}`,title,location};
 const key=JSON.stringify(e);if(seen.has(key)){duplicates++;continue;}seen.add(key);result.push(e);
 }
 result.sort((a,b)=>(a.date+a.start+a.title).localeCompare(b.date+b.start+b.title));return {events:result,duplicates,sourceCount:nodes.length,weeks:doc.querySelectorAll('.tableHeader').length};
}
const escape=s=>s.replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
function fold(s){let lines=[],line='',size=0;for(const ch of s){const n=new TextEncoder().encode(ch).length;if(size+n>75){lines.push(line);line=' ';size=1;}line+=ch;size+=n;}lines.push(line);return lines.join('\r\n');}
function summary(e,options={}){let t=e.title;if(options.group===false)t=t.replace(/\s*[-–]\s*Group\b.*$/i,'');const type=e.location.match(/\s-\s([^;]+)$/)?.[1];return t+(options.room&&type?' | '+type:'');}
async function uid(e){const data=new TextEncoder().encode(JSON.stringify([e.date,e.start,e.end,e.title]));const hash=await crypto.subtle.digest('SHA-256',data);return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('')+'@lancaster-timetable-converter';}
async function ics(events,options={}){
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Lancaster Timetable Converter//EN','CALSCALE:GREGORIAN','X-WR-CALNAME:Lancaster Timetable','X-WR-TIMEZONE:Europe/Berlin',
 'BEGIN:VTIMEZONE','TZID:Europe/Berlin','BEGIN:DAYLIGHT','DTSTART:19960331T020000','TZOFFSETFROM:+0100','TZOFFSETTO:+0200','TZNAME:CEST','RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU','END:DAYLIGHT','BEGIN:STANDARD','DTSTART:19961027T030000','TZOFFSETFROM:+0200','TZOFFSETTO:+0100','TZNAME:CET','RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU','END:STANDARD','END:VTIMEZONE'];
 const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
 for(const e of events){const dt=t=>e.date.replace(/-/g,'')+'T'+t.replace(':','')+'00';lines.push('BEGIN:VEVENT','UID:'+await uid(e),'DTSTAMP:'+stamp,'DTSTART;TZID=Europe/Berlin:'+dt(e.start),'DTEND;TZID=Europe/Berlin:'+dt(e.end),'SUMMARY:'+escape(summary(e,options)),'LOCATION:'+escape(e.location),'DESCRIPTION:'+escape('Original title: '+e.title+'\nRoom designation describes the room, not the teaching format.'),'STATUS:CONFIRMED','TRANSP:OPAQUE');
 if(options.reminder>0)lines.push('BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:Class reminder','TRIGGER:-PT'+Number(options.reminder)+'M','END:VALARM');lines.push('END:VEVENT');}
 lines.push('END:VCALENDAR');return lines.map(fold).join('\r\n')+'\r\n';
}
root.Timetable={parse,ics,summary,uid,fold};
})(globalThis);
