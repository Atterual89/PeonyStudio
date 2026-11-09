/** Suggerisce la separazione delle coppie inserite da Ale.
 * È una proposta, non una modifica automatica del nome/nickname.
 */
export function suggestCoupleSplit(raw:string):{first:string;second:string;separator:"e"|"+"|"/"}|null {
  const value=raw.trim().replace(/\s+/g," ");
  if(!value||value.includes("@"))return null;
  const match=value.match(/^(.+?)\s+(e|\+|\/)\s+(.+)$/i)||
    value.match(/^([^/+]+)([+/])([^/+]+)$/);
  if(!match)return null;
  const first=match[1].trim(),second=match[3].trim();
  if(first.length<2||second.length<2||first.length>120||second.length>120)return null;
  return {first,second,separator:match[2].toLowerCase() as "e"|"+"|"/"};
}
