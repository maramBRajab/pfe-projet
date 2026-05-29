import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ManagerNotificationsPanelService {
  private _isOpen = new BehaviorSubject<boolean>(false);
  public isOpen$ = this._isOpen.asObservable();

  constructor() {}

  isOpen(): boolean {
    return this._isOpen.getValue();
  }

  open(): void {
    this._isOpen.next(true);
  }

  close(): void {
    this._isOpen.next(false);
  }

  toggle(): void {
    this._isOpen.next(!this._isOpen.getValue());
  }
}