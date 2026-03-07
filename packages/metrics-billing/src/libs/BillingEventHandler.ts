import type { BillingStore, PlanRegistry } from '@croco/billing-core';
import { OrderPaidEvent, PlanChangedEvent, SubscriptionCanceledEvent } from '@croco/billing-core';
import { type DomainEvent, type EventHandler, RegisterEventHandler } from '@croco/events-core';
import type { MetricsRepository, Money, PlanProvider } from '@croco/metrics-core';
import { MrrCalculator } from '@croco/metrics-core';

@RegisterEventHandler(OrderPaidEvent)
@RegisterEventHandler(PlanChangedEvent)
@RegisterEventHandler(SubscriptionCanceledEvent)
export class BillingEventHandler
  implements EventHandler<OrderPaidEvent | PlanChangedEvent | SubscriptionCanceledEvent>, PlanProvider
{
  private readonly calculator = new MrrCalculator();

  constructor(
    private readonly planRegistry: PlanRegistry,
    private readonly billingStore: BillingStore,
    private readonly metricsRepository: MetricsRepository
  ) {}

  async getPlan(planId: string) {
    const plan = await this.planRegistry.getPlan(planId);
    if (plan === null) {
      return null;
    }

    return {
      id: plan.id,
      amount: plan.amount,
      currency: plan.currency,
      interval: plan.interval,
      intervalCount: plan.intervalCount,
    };
  }

  async handle(event: DomainEvent): Promise<void> {
    if (event instanceof OrderPaidEvent) {
      await this.handleOrderPaid(event);
      return;
    }

    if (event instanceof PlanChangedEvent) {
      await this.handlePlanChanged(event);
      return;
    }

    if (event instanceof SubscriptionCanceledEvent) {
      await this.handleSubscriptionCanceled(event);
    }
  }

  private async handleOrderPaid(event: OrderPaidEvent): Promise<void> {
    const account = await this.billingStore.findAccountByTenantId(event.tenantId);
    if (account === null) {
      return;
    }

    const subscription = await this.billingStore.findSubscription(account.id);
    if (subscription === null) {
      return;
    }

    const plan = await this.getPlan(subscription.planId);
    if (plan === null) {
      return;
    }

    const mrrAmount = this.calculator.normalizeMRR(plan.amount, plan.interval, plan.intervalCount);
    const mrr: Money = { amount: mrrAmount, currency: plan.currency };
    const movement = this.createMRRMovement(mrr, 'new');

    await this.metricsRepository.recordMRRMovement(event.tenantId, movement, event.timestamp, this.getEventId(event));
  }

  private async handlePlanChanged(event: PlanChangedEvent): Promise<void> {
    const account = await this.billingStore.findAccountByTenantId(event.tenantId);
    if (account === null) {
      return;
    }

    const subscription = await this.billingStore.findSubscriptionByExternalId(event.externalSubscriptionId);
    if (subscription === null) {
      return;
    }

    const previousPlan = await this.getPlan(event.previousPlanId);
    const newPlan = await this.getPlan(event.newPlanId);
    if (previousPlan === null || newPlan === null) {
      return;
    }

    const previousMrrAmount = this.calculator.normalizeMRR(
      previousPlan.amount,
      previousPlan.interval,
      previousPlan.intervalCount
    );
    const newMrrAmount = this.calculator.normalizeMRR(newPlan.amount, newPlan.interval, newPlan.intervalCount);
    const movementType = this.calculator.classifyMRRMovement(true, false, previousMrrAmount, newMrrAmount);

    const mrrDiff = Math.abs(newMrrAmount - previousMrrAmount);
    const mrr: Money = { amount: mrrDiff, currency: newPlan.currency };
    const movement = this.createMRRMovement(mrr, movementType);

    await this.metricsRepository.recordMRRMovement(event.tenantId, movement, event.timestamp, this.getEventId(event));
  }

  private async handleSubscriptionCanceled(event: SubscriptionCanceledEvent): Promise<void> {
    const subscription = await this.billingStore.findSubscriptionByExternalId(event.externalSubscriptionId);
    if (subscription === null) {
      return;
    }

    const plan = await this.getPlan(subscription.planId);
    if (plan === null) {
      return;
    }

    const mrrAmount = this.calculator.normalizeMRR(plan.amount, plan.interval, plan.intervalCount);
    const mrr: Money = { amount: mrrAmount, currency: plan.currency };
    const movement = this.createMRRMovement(mrr, 'churned');

    await this.metricsRepository.recordMRRMovement(event.tenantId, movement, event.timestamp, this.getEventId(event));
  }

  private createMRRMovement(mrr: Money, type: 'new' | 'expansion' | 'contraction' | 'churned' | 'reactivation') {
    const empty: Money = { amount: 0, currency: mrr.currency };

    switch (type) {
      case 'new':
        return {
          new: mrr,
          expansion: empty,
          contraction: empty,
          churned: empty,
          reactivation: empty,
          net: mrr,
        };
      case 'expansion':
        return {
          new: empty,
          expansion: mrr,
          contraction: empty,
          churned: empty,
          reactivation: empty,
          net: mrr,
        };
      case 'contraction':
        return {
          new: empty,
          expansion: empty,
          contraction: mrr,
          churned: empty,
          reactivation: empty,
          net: { amount: -mrr.amount, currency: mrr.currency },
        };
      case 'churned':
        return {
          new: empty,
          expansion: empty,
          contraction: empty,
          churned: mrr,
          reactivation: empty,
          net: { amount: -mrr.amount, currency: mrr.currency },
        };
      case 'reactivation':
        return {
          new: empty,
          expansion: empty,
          contraction: empty,
          churned: empty,
          reactivation: mrr,
          net: mrr,
        };
    }
  }

  private getEventId(event: DomainEvent): string {
    return `${event.eventName}_${event.timestamp.getTime()}`;
  }
}
