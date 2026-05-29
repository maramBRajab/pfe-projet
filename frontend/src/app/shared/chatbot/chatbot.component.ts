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

import {
  ChatbotService,
  ChatMessage,
  ChatMessageType
} from '../../services/manager/chatbot.service';

@Component({
  selector:    'app-chatbot',
  standalone:  true,
  imports:     [CommonModule, FormsModule],
  templateUrl: './chatbot.component.html',
  styleUrl:    './chatbot.component.scss'
})
export class ChatbotComponent implements OnInit, AfterViewChecked {

  @ViewChild('messagesContainer') messagesContainer!: ElementRef<HTMLDivElement>;

  messages:     ChatMessage[] = [];
  isOpen        = false;
  inputMessage  = '';
  isTyping      = false;
  suggestions:  string[] = [];
  unreadCount   = 0;

  private subs: Subscription[] = [];
  private shouldScroll = false;

  constructor(private readonly chatbotService: ChatbotService) {}

  ngOnInit(): void {
    this.subs.push(
      this.chatbotService.messages$.subscribe(msgs => {
        this.messages = msgs;
        this.shouldScroll = true;
      })
    );
    this.subs.push(
      this.chatbotService.isOpen$.subscribe(open => {
        this.isOpen = open;
        if (open) {
          this.unreadCount = 0;
          this.shouldScroll = true;
        }
      })
    );
    this.chatbotService.getSuggestions().subscribe({
      next: s => (this.suggestions = s || []),
      error: () => (this.suggestions = [])
    });
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

  toggleChat(): void { this.chatbotService.toggleChat(); }
  closeChat():  void { this.chatbotService.closeChat(); }

  sendMessage(text?: string): void {
    const msg = (text ?? this.inputMessage).trim();
    if (!msg || this.isTyping) return;
    this.inputMessage = '';

    this.chatbotService.addMessage({
      id:        Date.now().toString(),
      role:      'user',
      content:   msg,
      timestamp: new Date()
    });

    this.chatbotService.addMessage({
      id:        (Date.now() + 1).toString(),
      role:      'bot',
      content:   '',
      type:      'info',
      timestamp: new Date(),
      isLoading: true
    });

    this.isTyping = true;

    this.chatbotService.envoyerMessage(msg).subscribe({
      next: response => {
        this.chatbotService.updateLastBotMessage(
          response.message,
          (response.type as ChatMessageType) ?? 'info',
          response.resultats
        );
        this.isTyping = false;
        if (!this.isOpen) this.unreadCount++;
      },
      error: () => {
        this.chatbotService.updateLastBotMessage(
          '❌ Erreur de connexion. Vérifiez que le backend est démarré.',
          'erreur'
        );
        this.isTyping = false;
      }
    });
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  clearHistory(): void { this.chatbotService.clearHistory(); }

  renderHtml(text: string): string {
    return this.chatbotService.markdownToHtml(text);
  }

  getTypeIcon(type?: string): string {
    const icons: Record<string, string> = {
      analyse: '🤖',
      info:    '💡',
      stats:   '📊',
      aide:    '❓',
      erreur:  '❌'
    };
    return type ? (icons[type] ?? '💬') : '💬';
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }
}
