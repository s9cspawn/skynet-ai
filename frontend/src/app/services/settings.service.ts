import { Injectable, signal } from '@angular/core';
import { DEFAULT_SETTINGS } from '../core/constants';
import type { ChatSettings } from '../models/chat.models';

@Injectable({providedIn:'root'})
export class SettingsService{
  readonly settings=signal<ChatSettings>({...DEFAULT_SETTINGS});
  async initialize():Promise<void>{
    this.settings.set({...DEFAULT_SETTINGS});
    const response=await fetch('/api/settings');if(!response.ok)return;
    const body=await response.json() as {settings:ChatSettings|null};
    if(body.settings){this.settings.set({...DEFAULT_SETTINGS,...body.settings});return}
    try{const legacy=JSON.parse(localStorage.getItem('local-ai.settings.v1')??'null') as ChatSettings|null;if(legacy){this.update({...DEFAULT_SETTINGS,...legacy});localStorage.removeItem('local-ai.settings.v1')}}catch{/* use defaults */}
  }
  update(value:ChatSettings):void{const normalized={systemPrompt:value.systemPrompt.trim()||DEFAULT_SETTINGS.systemPrompt,temperature:Math.min(2,Math.max(0,value.temperature)),topP:Math.min(1,Math.max(0,value.topP)),maxTokens:Math.min(131072,Math.max(1,Math.round(value.maxTokens)))};this.settings.set(normalized);void fetch('/api/settings',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(normalized)})}
  reset():void{this.update({...DEFAULT_SETTINGS})}
}
