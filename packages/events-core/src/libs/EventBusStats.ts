export class EventBusStats {
  private publishedCount = 0;
  private failCount = 0;

  publish(failed: boolean): void {
    if (failed) {
      this.failCount++;
    } else {
      this.publishedCount++;
    }
  }

  getStats(): { publishedCount: number; failCount: number } {
    return { publishedCount: this.publishedCount, failCount: this.failCount };
  }
}
