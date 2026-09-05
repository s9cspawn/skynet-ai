import { computed, Injectable, signal } from '@angular/core';
import type { ChatMessage, Conversation } from '../models/chat.models';

const createId = (): string => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
const deriveTitle = (message: string): string => {
  const words = message.replace(/[`*_#>\[\]{}()]/g,' ').replace(/[^\p{L}\p{N}'-]+/gu,' ').trim().split(/\s+/).filter(Boolean);
  const ignored = new Set(['a','an','the','to','me','please','can','you','could','would','about']);
  const useful = words.filter((word,index)=>index===0||!ignored.has(word.toLowerCase())).slice(0,5);
  const title = (useful.length>=3?useful:words).slice(0,6).join(' ');
  return title ? title.charAt(0).toUpperCase()+title.slice(1) : 'New conversation';
};

interface StoredConversation extends Omit<Conversation,'createdAt'|'updatedAt'|'messages'> { createdAt:string; updatedAt:string; messages:Array<Omit<ChatMessage,'createdAt'>&{createdAt:string}>; }

@Injectable({ providedIn:'root' })
export class ConversationService {
  readonly conversations=signal<Conversation[]>([]);
  readonly activeId=signal<string|null>(null);
  readonly activeConversation=computed(()=>this.conversations().find(c=>c.id===this.activeId())??null);

  async initialize():Promise<void>{
    const response=await fetch('/api/conversations');
    if(!response.ok) throw new Error('Unable to load conversations.');
    const body=await response.json() as {conversations:StoredConversation[]};
    let items=body.conversations.map(c=>({...c,createdAt:new Date(c.createdAt),updatedAt:new Date(c.updatedAt),messages:c.messages.map(m=>({...m,createdAt:new Date(m.createdAt)}))}));
    if(items.length===0) items=await this.migrateLegacy();
    this.conversations.set(items);
    this.activeId.set(items[0]?.id??null);
    if(items.length===0) this.create();
  }

  reset():void{this.conversations.set([]);this.activeId.set(null)}
  create():string{const now=new Date();const item:Conversation={id:createId(),title:'New conversation',messages:[],createdAt:now,updatedAt:now};this.conversations.update(v=>[item,...v]);this.activeId.set(item.id);void this.persistOne(item);return item.id}
  select(id:string):void{if(this.conversations().some(c=>c.id===id))this.activeId.set(id)}
  delete(id:string):void{this.conversations.update(v=>v.filter(c=>c.id!==id));void fetch(`/api/conversations/${encodeURIComponent(id)}`,{method:'DELETE'});if(this.activeId()===id)this.activeId.set(this.conversations()[0]?.id??null);if(this.conversations().length===0)this.create()}
  clearActive():void{const id=this.activeId();if(id)this.updateConversation(id,c=>({...c,title:'New conversation',messages:[]}))}
  addMessage(message:Omit<ChatMessage,'id'|'createdAt'>):ChatMessage{const id=this.activeId()??this.create();const next={...message,id:createId(),createdAt:new Date()};this.updateConversation(id,c=>({...c,title:c.messages.some(m=>m.role==='user')||message.role!=='user'?c.title:deriveTitle(message.content),messages:[...c.messages,next]}));return next}
  appendToMessage(messageId:string,chunk:string):void{const id=this.activeId();if(id)this.updateConversation(id,c=>({...c,messages:c.messages.map(m=>m.id===messageId?{...m,content:m.content+chunk}:m)}),false)}
  updateMessage(messageId:string,patch:Partial<Pick<ChatMessage,'content'|'error'>>):void{const id=this.activeId();if(id)this.updateConversation(id,c=>({...c,messages:c.messages.map(m=>m.id===messageId?{...m,...patch}:m)}))}
  truncateFromMessage(messageId:string):void{const id=this.activeId();if(id)this.updateConversation(id,c=>{const index=c.messages.findIndex(m=>m.id===messageId);return index<0?c:{...c,messages:c.messages.slice(0,index)}})}
  persist():void{const active=this.activeConversation();if(active)void this.persistOne(active)}

  private updateConversation(id:string,update:(c:Conversation)=>Conversation,persist=true):void{let changed:Conversation|undefined;this.conversations.update(items=>items.map(c=>{if(c.id!==id)return c;changed={...update(c),updatedAt:new Date()};return changed}).sort((a,b)=>b.updatedAt.getTime()-a.updatedAt.getTime()));if(persist&&changed)void this.persistOne(changed)}
  private async persistOne(item:Conversation):Promise<void>{await fetch(`/api/conversations/${encodeURIComponent(item.id)}`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(item)})}
  private async migrateLegacy():Promise<Conversation[]>{
    try{const raw=localStorage.getItem('local-ai.conversations.v1');if(!raw)return[];const stored=JSON.parse(raw) as StoredConversation[];const items=stored.map(c=>({...c,createdAt:new Date(c.createdAt),updatedAt:new Date(c.updatedAt),messages:c.messages.map(m=>({...m,createdAt:new Date(m.createdAt)}))}));await Promise.all(items.map(c=>this.persistOne(c)));localStorage.removeItem('local-ai.conversations.v1');return items}catch{return[]}
  }
}
