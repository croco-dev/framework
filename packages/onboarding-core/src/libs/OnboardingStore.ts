import { Component, Token } from '@croco/framework-context';
import type { OnboardingState } from './types';

export abstract class OnboardingStore {
  static readonly token = new Token<OnboardingStore>('OnboardingStore');

  abstract getState(tenantId: string, userId: string): Promise<OnboardingState | null>;
  abstract saveState(tenantId: string, userId: string, state: OnboardingState): Promise<void>;
}

@Component()
export class InMemoryOnboardingStore extends OnboardingStore {
  private readonly storage = new Map<string, OnboardingState>();

  async getState(tenantId: string, userId: string): Promise<OnboardingState | null> {
    const key = this.getKey(tenantId, userId);
    return this.storage.get(key) ?? null;
  }

  async saveState(tenantId: string, userId: string, state: OnboardingState): Promise<void> {
    const key = this.getKey(tenantId, userId);
    this.storage.set(key, state);
  }

  private getKey(tenantId: string, userId: string): string {
    return `${tenantId}:${userId}`;
  }
}
