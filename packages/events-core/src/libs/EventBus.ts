import type { DomainEvent } from './DomainEvent';
import type { EventHandler, EventHandlerClass } from './EventHandler';
import type { EventPublishing } from './interfaces/EventPublishing';
import type { EventSubscribing } from './interfaces/EventSubscribing';

export interface EventSubscription<TEvent extends DomainEvent = DomainEvent> {
  eventName: EventNamePattern;
  handlerClass: EventHandlerClass<TEvent>;
  handler?: EventHandler<TEvent>;
}

export interface EventBus<TEvent extends DomainEvent = DomainEvent>
  extends EventPublishing<TEvent>,
    EventSubscribing<TEvent> {}

export type EventNamePattern = string;

type TrieNode<TValue> = {
  children: Map<string, TrieNode<TValue>>;
  values: Set<TValue>;
};

class PrefixTrie<TValue> {
  private readonly root: TrieNode<TValue> = {
    children: new Map(),
    values: new Set(),
  };

  add(prefix: string, value: TValue): void {
    let node = this.root;
    for (const ch of prefix) {
      let next = node.children.get(ch);
      if (!next) {
        next = {
          children: new Map(),
          values: new Set(),
        };
        node.children.set(ch, next);
      }
      node = next;
    }

    node.values.add(value);
  }

  delete(prefix: string, value: TValue): void {
    let node = this.root;
    const path: Array<{ parent: TrieNode<TValue>; char: string; node: TrieNode<TValue> }> = [];

    for (const ch of prefix) {
      const next = node.children.get(ch);
      if (!next) {
        return;
      }

      path.push({ parent: node, char: ch, node: next });
      node = next;
    }

    node.values.delete(value);

    for (let i = path.length - 1; i >= 0; i--) {
      const { parent, char, node: current } = path[i];
      if (current.values.size > 0 || current.children.size > 0) {
        break;
      }

      parent.children.delete(char);
    }
  }

  match(eventName: string, out: Set<TValue>): void {
    let node = this.root;
    for (const value of node.values) {
      out.add(value);
    }

    for (const ch of eventName) {
      const next = node.children.get(ch);
      if (!next) {
        return;
      }
      node = next;

      for (const value of node.values) {
        out.add(value);
      }
    }
  }

  clear(): void {
    this.root.children.clear();
    this.root.values.clear();
  }
}

type GlobEntry<TValue> = {
  matcher: (eventName: string) => boolean;
  values: Set<TValue>;
};

function getSingleTrailingWildcardPrefix(pattern: EventNamePattern): string | undefined {
  const firstWildcardIndex = pattern.indexOf('*');
  if (firstWildcardIndex === -1) {
    return undefined;
  }

  const lastWildcardIndex = pattern.lastIndexOf('*');
  if (firstWildcardIndex === pattern.length - 1 && lastWildcardIndex === firstWildcardIndex) {
    return pattern.slice(0, -1);
  }

  return undefined;
}

function compileGlobPattern(pattern: EventNamePattern): (eventName: string) => boolean {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const source = `^${escaped.replace(/\*/g, '.*')}$`;
  const regex = new RegExp(source);
  return (eventName: string) => regex.test(eventName);
}

function addToMapSet<TValue>(map: Map<string, Set<TValue>>, key: string, value: TValue): void {
  const values = map.get(key);
  if (values) {
    values.add(value);
    return;
  }

  map.set(key, new Set([value]));
}

function deleteFromMapSet<TValue>(map: Map<string, Set<TValue>>, key: string, value: TValue): void {
  const values = map.get(key);
  if (!values) {
    return;
  }

  values.delete(value);
  if (values.size === 0) {
    map.delete(key);
  }
}

/**
 * 이벤트 이름(예: `user.created`)과 구독 패턴(예: `user.*`)을 매칭하기 위한 인덱스입니다.
 *
 * - 정확 매칭: O(1)
 * - 접두사 와일드카드(`prefix*`) : Trie 기반 O(|eventName|)
 * - 그 외(glob 패턴): 캐시된 정규식으로 O(#complexPatterns)
 */
export class EventSubscriptionIndex<TValue> {
  private readonly exact: Map<string, Set<TValue>> = new Map();
  private readonly prefixTrie: PrefixTrie<TValue> = new PrefixTrie();
  private readonly glob: Map<EventNamePattern, GlobEntry<TValue>> = new Map();

  add(pattern: EventNamePattern, value: TValue): void {
    const prefix = getSingleTrailingWildcardPrefix(pattern);
    if (prefix !== undefined) {
      this.prefixTrie.add(prefix, value);
      return;
    }

    if (!pattern.includes('*')) {
      addToMapSet(this.exact, pattern, value);
      return;
    }

    const existing = this.glob.get(pattern);
    if (existing) {
      existing.values.add(value);
      return;
    }

    this.glob.set(pattern, {
      matcher: compileGlobPattern(pattern),
      values: new Set([value]),
    });
  }

  delete(pattern: EventNamePattern, value: TValue): void {
    const prefix = getSingleTrailingWildcardPrefix(pattern);
    if (prefix !== undefined) {
      this.prefixTrie.delete(prefix, value);
      return;
    }

    if (!pattern.includes('*')) {
      deleteFromMapSet(this.exact, pattern, value);
      return;
    }

    const entry = this.glob.get(pattern);
    if (!entry) {
      return;
    }

    entry.values.delete(value);
    if (entry.values.size === 0) {
      this.glob.delete(pattern);
    }
  }

  match(eventName: string): Set<TValue> {
    const result = new Set<TValue>();

    const exactMatches = this.exact.get(eventName);
    if (exactMatches) {
      for (const value of exactMatches) {
        result.add(value);
      }
    }

    this.prefixTrie.match(eventName, result);

    for (const entry of this.glob.values()) {
      if (entry.matcher(eventName)) {
        for (const value of entry.values) {
          result.add(value);
        }
      }
    }

    return result;
  }

  clear(): void {
    this.exact.clear();
    this.prefixTrie.clear();
    this.glob.clear();
  }
}
