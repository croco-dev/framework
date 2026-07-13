export class EventBusStats {
  private publishedCount = 0;
  private failCount = 0;
  private droppedPublishCount = 0;

  publish(failed: boolean): void {
    if (failed) {
      this.failCount++;
    } else {
      this.publishedCount++;
    }
  }

  drop(): void {
    this.droppedPublishCount++;
  }

  getStats(): {
    publishedCount: number;
    failCount: number;
    droppedPublishCount: number;
  } {
    return {
      publishedCount: this.publishedCount,
      failCount: this.failCount,
      droppedPublishCount: this.droppedPublishCount,
    };
  }
}
