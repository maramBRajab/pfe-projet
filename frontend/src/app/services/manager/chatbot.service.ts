import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type ChatMessageRole = 'user' | 'bot';
export type ChatMessageType = 'analyse' | 'info' | 'stats' | 'aide' | 'erreur';

export interface ChatMessage {
  id:         string;
  role:       ChatMessageRole;
  content:    string;
  type?:      ChatMessageType;
  resultats?: ChatbotResult[];
  timestamp:  Date;
  isLoading?: boolean;
}

export interface ChatbotResult {
  rang?:             number;
  collaborateurNom?: string;
  score?:            number | string;
  potentielLabel?:   string;
  [key: string]:     unknown;
}

export interface ChatbotResponse {
  message:    string;
  type:       ChatMessageType;
  resultats?: ChatbotResult[];
  timestamp:  string;
}

@Injectable({ providedIn: 'root' })
export class ChatbotService {

  private readonly API = `${environment.apiUrl}/chatbot`;

  private readonly isOpenSubject = new BehaviorSubject<boolean>(false);
  readonly isOpen$ = this.isOpenSubject.asObservable();

  private readonly messagesSubject = new BehaviorSubject<ChatMessage[]>([
    {
      id:        '0',
      role:      'bot',
      content:   '👋 Bonjour ! Je suis l\'assistant IA SmartAssign.\n\nJe peux analyser vos projets, trouver les meilleurs collaborateurs et vous donner des statistiques.\n\nTapez **aide** pour voir mes commandes.',
      type:      'aide',
      timestamp: new Date()
    }
  ]);
  readonly messages$ = this.messagesSubject.asObservable();

  constructor(private readonly http: HttpClient) {}

  toggleChat(): void { this.isOpenSubject.next(!this.isOpenSubject.value); }
  openChat():   void { this.isOpenSubject.next(true); }
  closeChat():  void { this.isOpenSubject.next(false); }

  envoyerMessage(message: string, managerId: number = 1): Observable<ChatbotResponse> {
    return this.http.post<ChatbotResponse>(`${this.API}/message`, { message, managerId });
  }

  getSuggestions(): Observable<string[]> {
    return this.http.get<string[]>(`${this.API}/suggestions`);
  }

  addMessage(msg: ChatMessage): void {
    this.messagesSubject.next([...this.messagesSubject.value, msg]);
  }

  updateLastBotMessage(content: string, type: ChatMessageType, resultats?: ChatbotResult[]): void {
    const msgs = [...this.messagesSubject.value];
    let idx = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'bot' && msgs[i].isLoading) { idx = i; break; }
    }
    if (idx !== -1) {
      msgs[idx] = { ...msgs[idx], content, type, resultats, isLoading: false };
      this.messagesSubject.next(msgs);
    }
  }

  clearHistory(): void {
    this.messagesSubject.next([{
      id:        '0',
      role:      'bot',
      content:   '💬 Conversation effacée. Comment puis-je vous aider ?',
      type:      'aide',
      timestamp: new Date()
    }]);
  }

  // Markdown → HTML très simple (gras + sauts de ligne). Le reste est échappé.
  markdownToHtml(text: string): string {
    const escaped = (text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return escaped
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }
}
