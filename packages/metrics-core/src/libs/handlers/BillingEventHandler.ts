import type { BillingStore, PlanRegistry } from '@croco/billing-core';
import { OrderPaidEvent, PlanChangedEvent, SubscriptionCanceledEvent } from '@croco/billing-core';
import { type DomainEvent, type EventHandler, RegisterEventHandler } from '@croco/events-core';
import type { Money, MRRMovement } from '../../types';
import type { MetricsRepository } from '../interfaces/MetricsRepository';
import { MrrCalculator } from '../MrrCalculator';

@RegisterEventHandler(OrderPaidEvent)
@RegisterEventHandler(PlanChangedEvent)
@RegisterEventHandler(SubscriptionCanceledEvent)
export class BillingEventHandler
  implements EventHandler<OrderPaidEvent | PlanChangedEvent | SubscriptionCanceledEvent>
{
  private readonly calculator: MrrCalculator;
  private readonly processedEventIds: Set<string> = new Set();

  constructor(
    private readonly planRegistry: PlanRegistry,
    private readonly billingStore: BillingStore,
    private readonly metricsRepository: MetricsRepository
  ) {
    this.calculator = new MrrCalculator();
  }

  async handle(event: DomainEvent): Promise<void> {
    if (event instanceof OrderPaidEvent) {
      await this.handleOrderPaid(event);
    } else if (event instanceof PlanChangedEvent) {
      await this.handlePlanChanged(event);
    } else if (event instanceof SubscriptionCanceledEvent) {
      await this.handleSubscriptionCanceled(event);
    }
  }

  private async handleOrderPaid(event: OrderPaidEvent): Promise<void> {
    const eventId = this.getEventId(event);
    if (this.processedEventIds.has(eventId)) {
      return;
    }

    const account = await this.billingStore.findAccountByTenantId(event.tenantId);
    if (account === null) {
      return;
    }

    const subscription = await this.billingStore.findSubscription(account.id);
    if (subscription === null) {
      return;
    }

    const plan = await this.planRegistry.getPlan(subscription.planId);
    if (plan === null) {
      return;
    }

    const mrrAmount = this.calculator.normalizeMRR(plan.amount, plan.interval, plan.intervalCount);

    const mrr: Money = { amount: mrrAmount, currency: plan.currency };
    const movement = this.createMRRMovement(mrr, 'new');

    await this.metricsRepository.recordMRRMovement(event.tenantId, movement, new Date());

    this.processedEventIds.add(eventId);
  }

  private async handlePlanChanged(event: PlanChangedEvent): Promise<void> {
    const eventId = this.getEventId(event);
    if (this.processedEventIds.has(eventId)) {
      return;
    }

    const account = await this.billingStore.findAccountByTenantId(event.tenantId);
    if (account === null) {
      return;
    }

    const subscription = await this.billingStore.findSubscriptionByExternalId(event.externalSubscriptionId);
    if (subscription === null) {
      return;
    }

    const previousPlan = await this.planRegistry.getPlan(event.previousPlanId);
    const newPlan = await this.planRegistry.getPlan(event.newPlanId);

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

    await this.metricsRepository.recordMRRMovement(event.tenantId, movement, new Date());

    this.processedEventIds.add(eventId);
  }

  private async handleSubscriptionCanceled(event: SubscriptionCanceledEvent): Promise<void> {
    const eventId = this.getEventId(event);
    if (this.processedEventIds.has(eventId)) {
      return;
    }

    const subscription = await this.billingStore.findSubscriptionByExternalId(event.externalSubscriptionId);
    if (subscription === null) {
      return;
    }

    const plan = await this.planRegistry.getPlan(subscription.planId);
    if (plan === null) {
      return;
    }

    const mrrAmount = this.calculator.normalizeMRR(plan.amount, plan.interval, plan.intervalCount);

    const mrr: Money = { amount: mrrAmount, currency: plan.currency };
    const movement = this.createMRRMovement(mrr, 'churned');

    await this.metricsRepository.recordMRRMovement(event.tenantId, movement, new Date());

    this.processedEventIds.add(eventId);
  }

  private createMRRMovement(
    mrr: Money,
    type: 'new' | 'expansion' | 'contraction' | 'churned' | 'reactivation'
  ): MRRMovement {
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
