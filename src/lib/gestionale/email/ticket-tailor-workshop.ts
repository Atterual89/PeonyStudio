import type { WorkshopEmailData } from "./types";

/**
 * Read-only presentation of the exact Ticket Tailor event content stored by sync.
 * Keep its headings and text; no LLM inference or invented daily schedule.
 */
export type TicketTailorWorkshopSource = {
  description: string;
  introductoryText: string;
  information: { title: string; text: string }[];
  program: { title: string; text: string }[];
  prerequisites: { title: string; text: string }[];
  whatToBring: { title: string; text: string }[];
  photoPolicy: { title: string; text: string }[];
  eventUrl: string | null;
};

type RecordValue=Record<string,unknown>;
function record(value:unknown):RecordValue|null{
  return value!==null && typeof value==="object" && !Array.isArray(value) ? value as RecordValue : null;
}
function str(value:unknown):string|null{
  return typeof value==="string" && value.trim() ? value.trim() : null;
}
const entities:Record<string,string>={amp:"&",lt:"<",gt:">",quot:'"',apos:"'",nbsp:" ",ndash:"–",mdash:"—",hellip:"…",rsquo:"’",lsquo:"‘",ldquo:"“",rdquo:"”"};
function decodeEntities(text:string):string{
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi,(_,entity:string)=>{
    if(entity.startsWith("#")){
      const hex=/^#x/i.test(entity);
      const number=Number.parseInt(entity.slice(hex?2:1),hex?16:10);
      return Number.isFinite(number) && number>0 && number<=0x10ffff &&
        !(number>=0xd800&&number<=0xdfff) ? String.fromCodePoint(number):"";
    }
    return entities[entity.toLowerCase()]??"&"+entity+";";
  });
}
/** Convert the TT HTML into plain text before it is escaped by the email layout. */
export function ticketTailorHtmlText(html:string):string{
  return decodeEntities(html
    .replace(/<\s*(script|style|iframe)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,"")
    .replace(/<!--[\s\S]*?-->/g,"")
    .replace(/<br\s*\/?>/gi,"\n")
    .replace(/<\/(?:p|div|h[1-6]|li|ul|ol|blockquote|table|tr)>/gi,"\n")
    .replace(/<li\b[^>]*>/gi,"• ")
    .replace(/<[^>]+>/g," ")
    .replace(/\r/g,"")
    .split("\n").map(line=>line.replace(/[ \t\u00a0]+/g," ").trim())
    .join("\n").replace(/\n{3,}/g,"\n\n").trim());
}
type SourceSection={title:string;text:string};
function sourceSections(html:string):{intro:string;sections:SourceSection[]}{
  const headings=[...html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi)];
  if(!headings.length)return {intro:ticketTailorHtmlText(html),sections:[]};
  const intro=ticketTailorHtmlText(html.slice(0,headings[0].index));
  const sections:SourceSection[]=[];
  for(let i=0;i<headings.length;i++){
    const heading=headings[i];
    const name=ticketTailorHtmlText(heading[2]).trim();
    const from=(heading.index??0)+heading[0].length;
    const to=i+1<headings.length ? headings[i+1].index??html.length : html.length;
    const body=ticketTailorHtmlText(html.slice(from,to));
    if(name && body) sections.push({title:name.slice(0,180),text:body.slice(0,16000)});
  }
  return {intro,sections};
}
function time(value:unknown):string|null{
  const candidate=str(value);
  return candidate && /^[0-2]\d:[0-5]\d$/.test(candidate) && candidate!=="00:00" ? candidate:null;
}
function sourceTime(original:RecordValue,side:"start"|"end"):string|null{
  const raw=record(original[side]);
  return time(raw?.time);
}
function eventDate(value:unknown):string|null{
  const date=str(value);
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}
function shortDate(date:string):string{
  const dt=new Date(date+"T12:00:00Z");
  return new Intl.DateTimeFormat("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(dt);
}
function dailyTimeFromDescription(html:string,normalizedText:string):string|null{
  // Only parse a labelled "Time:" entry, usually in the TT "Event summary" section.
  const match=html.match(/<strong\b[^>]*>\s*Time:\s*<\/strong>\s*([^<\n]{5,65})/i) ||
    normalizedText.match(/\bTime:\s*((?:[0-2]?\d:[0-5]\d)\s*[\u2013\u2014-]\s*(?:around\s*)?[0-2]?\d:[0-5]\d)/i);
  const value=match?.[1] ? ticketTailorHtmlText(match[1]).trim() : null;
  return value && /[0-2]?\d:[0-5]\d/.test(value) ? value : null;
}
function emailDateLabel(start:string,end:string):string {
  const format=(date:string)=>new Intl.DateTimeFormat("en-GB",{
    day:"numeric",month:"long",year:"numeric",timeZone:"UTC",
  }).format(new Date(date+"T12:00:00Z"));
  if(start===end)return format(start);
  // Two consecutive days in the same month, as in the reference emails.
  if(start.slice(0,7)===end.slice(0,7))
    return Number(start.slice(8,10))+"–"+format(end);
  return format(start)+" – "+format(end);
}
function cleanTitle(value:string):string{
  return value.replace(/^\s*SOLD\s*-?\s*OUT\s*[-–:]\s*/i,"")
    .replace(/\s*[-–]\s*workshop\s*$/i,"").trim();
}
function safeUrl(input:unknown):string|null {
  const value=str(input);
  if(!value)return null;
  try{
    const url=new URL(value);
    return url.protocol==="https:" ? url.href : null;
  }catch{return null;}
}
function classify(sections:SourceSection[]):Omit<TicketTailorWorkshopSource,"description"|"introductoryText"|"eventUrl">{
  const information:SourceSection[]=[],program:SourceSection[]=[],prerequisites:SourceSection[]=[],
    whatToBring:SourceSection[]=[],photoPolicy:SourceSection[]=[];
  for(const section of sections){
    const name=section.title.toLowerCase();
    // Global email blocks replace (and can update) TT's generic studio instructions.
    if(/association membership|booking and information|^contacts?$|how to book/.test(name))continue;
    if(/photos? and videos?|photo.*video/.test(name)){photoPolicy.push(section);continue;}
    if(/what to bring|equipment|clothing|ropes to bring/.test(name)){whatToBring.push(section);continue;}
    if(/prerequisites?|who this workshop is for|for riggers|for models|for bottoms/.test(name)){
      prerequisites.push(section);continue;
    }
    if(/what we will work on|what you.ll learn|program|programme|during the workshop|topics covered/.test(name)){
      program.push(section);continue;
    }
    if(/event summary/.test(name))continue; // represented in the timetable and title.
    information.push(section);
  }
  return {information,program,prerequisites,whatToBring,photoPolicy};
}

export function ticketTailorWorkshopFields(input:{
  rawPayload:unknown;bookingUrl?:unknown;
  startsAt?:unknown;endsAt?:unknown;
}):Partial<WorkshopEmailData>{
  const payload=record(input.rawPayload);
  const normalized=record(payload?.normalized);
  const original=record(payload?.ticket_tailor_original) ??
    record(normalized?.rawTicketTailorPayload);
  const html=str(original?.description);
  const fallback=str(normalized?.description);
  if(!original && !normalized)return {};
  const description=html ? ticketTailorHtmlText(html) : fallback??"";
  const parse=html ? sourceSections(html) : {intro:description,sections:[] as SourceSection[]};
  const classified=classify(parse.sections);
  const firstDate=eventDate(record(original?.start)?.date);
  const finalDate=eventDate(record(original?.end)?.date);
  const start=sourceTime(original??{},"start");
  const end=sourceTime(original??{},"end");
  const schedule:string[]=[];
  const daily= dailyTimeFromDescription(html??"",fallback??"");
  if(daily)schedule.push("Daily time indicated on Ticket Tailor: "+daily);
  if(firstDate && start)schedule.push("First day ("+shortDate(firstDate)+"): event starts at "+start);
  else if(start)schedule.push("Event start (Ticket Tailor): "+start);
  if(finalDate && end && firstDate!==finalDate)
    schedule.push("Last day ("+shortDate(finalDate)+"): event ends at "+end);
  else if(end)schedule.push("Event end (Ticket Tailor): "+end);
  const eventName=str(normalized?.title) ?? str(original?.name);
  const source:TicketTailorWorkshopSource={
    description,
    introductoryText: parse.intro,
    ...classified,
    eventUrl:safeUrl(input.bookingUrl)??safeUrl(normalized?.bookingUrl)??safeUrl(original?.url),
  };
  // The source is read-only metadata; never persist it as a local workshop override.
  return {
    ...(eventName ? {title:cleanTitle(eventName)}:{}),
    ...(firstDate ? {dateLabel:emailDateLabel(firstDate,finalDate??firstDate)}:{}),
    ...(schedule.length ? {schedule}:{}),
    ticketTailor: source,
  };
}
