import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { Conversation } from '../../models/chat.models';
import type { User } from '../../models/chat.models';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sidebar {
  readonly conversations = input.required<Conversation[]>();
  readonly activeId = input<string | null>(null);
  readonly open = input(false);
  readonly newChat = output<void>();
  readonly selectChat = output<string>();
  readonly deleteChat = output<string>();
  readonly openSettings = output<void>();
  readonly closeSidebar = output<void>();
  readonly user = input<User | null>(null);
  readonly logout = output<void>();

  remove(event: Event, id: string): void {
    event.stopPropagation();
    this.deleteChat.emit(id);
  }
}
