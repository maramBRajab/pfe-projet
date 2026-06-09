import { CommonModule } from '@angular/common';
import {
  AfterViewChecked,
  Component,
  ElementRef,
  OnInit,
  ViewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { catchError, of } from 'rxjs';

import {
  ChatbotService
} from '../../services/manager/chatbot.service';

import {
  ManagerIaService
} from '../../services/manager/manager-ia.service';

type PanelMessageRole = 'user' | 'assistant';

interface PanelMessage {
  id: string;
  role: PanelMessageRole;
  content: string;
  timestamp: Date;
  isLoading?: boolean;
}

@Component({
  selector:    'app-chatbot',
  standalone:  true,
  imports:     [CommonModule, FormsModule],
  templateUrl: './chatbot.component.html',
  styleUrl:    './chatbot.component.scss'
})
export class ChatbotComponent implements OnInit, AfterViewChecked {

  @ViewChild('messagesContainer') messagesContainer!: ElementRef<HTMLDivElement>;

  messages:     PanelMessage[] = [];
  isOpen        = false;
  inputMessage  = '';
  isTyping      = false;
  suggestions:  string[] = ['Qui est disponible ?', 'Surchargés ?', 'Stats globales'];
  unreadCount   = 0;

  private subs: Subscription[] = [];
  private shouldScroll = false;

  constructor(
    private readonly managerIaService: ManagerIaService,
    private readonly chatbotService: ChatbotService
  ) {}

  ngOnInit(): void {
    this.messages = [
      {
        id: '0',
        role: 'assistant',
        content: 'Bonjour. Je suis votre assistant IA SmartAssign. Posez une question ou utilisez une commande rapide.',
        timestamp: new Date()
      }
    ];

    this.subs.push(
      this.chatbotService.isOpen$.subscribe((open) => {
        this.isOpen = open;
        if (open) {
          this.unreadCount = 0;
          this.shouldScroll = true;
        }
      })
    );
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  private scrollToBottom(): void {
    const el = this.messagesContainer?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  toggleChat(): void {
    this.chatbotService.toggleChat();
  }

  closeChat(): void {
    this.chatbotService.closeChat();
  }

  sendMessage(text?: string): void {
    const msg = (text ?? this.inputMessage).trim();
    if (!msg || this.isTyping) return;
    this.inputMessage = '';

    this.messages = [
      ...this.messages,
      {
        id: Date.now().toString(),
        role: 'user',
        content: msg,
        timestamp: new Date()
      },
      {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isLoading: true
      }
    ];
    this.shouldScroll = true;
    this.isTyping = true;

    this.managerIaService.analyse(msg).pipe(
      catchError(() => of({ reponse: '❌ Analyse IA indisponible pour le moment. Merci de réessayer.' }))
    ).subscribe({
      next: response => {
        const msgs = [...this.messages];
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].role === 'assistant' && msgs[i].isLoading) {
            msgs[i] = {
              ...msgs[i],
              content: response.reponse,
              isLoading: false,
              timestamp: new Date()
            };
            break;
          }
        }
        this.messages = msgs;
        this.isTyping = false;
        this.shouldScroll = true;
        if (!this.isOpen) {
          this.unreadCount++;
        }
      },
      error: () => {
        const msgs = [...this.messages];
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].role === 'assistant' && msgs[i].isLoading) {
            msgs[i] = {
              ...msgs[i],
              content: '❌ Erreur de connexion. Vérifiez que le backend est démarré.',
              isLoading: false,
              timestamp: new Date()
            };
            break;
          }
        }
        this.messages = msgs;
        this.isTyping = false;
        this.shouldScroll = true;
      }
    });
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  clearHistory(): void {
    this.messages = [{
      id: '0',
      role: 'assistant',
      content: 'Conversation effacée. Comment puis-je vous aider ?',
      timestamp: new Date()
    }];
  }

  renderHtml(text: string): string {
    const escaped = (text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return escaped
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  getTypeIcon(type?: string): string {
    return type === 'assistant' ? '🤖' : '💬';
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }
}
