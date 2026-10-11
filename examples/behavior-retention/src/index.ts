import {
  computeCohortRetention,
  computeFrequencyDistribution,
  computePeriodicRetention,
} from "@croco/metrics-core";
import { definition, dataset, baseline, returning } from "./fixture.js";

const periodic = computePeriodicRetention(definition, dataset, { baseline, returning });
const cohort = computeCohortRetention(definition, dataset, { baseline, returning });
const frequency = computeFrequencyDistribution(definition, dataset, {
  window: returning,
  measure: "count",
});
const activeDays = computeFrequencyDistribution(definition, dataset, {
  window: returning,
  measure: "activeDays",
});

if (periodic.numerator !== 40 || periodic.denominator !== 100 || periodic.value !== 0.4) {
  throw new Error("Periodic retention did not match the known example");
}
if (frequency.subjects.find((subject) => subject.subjectId === "new-0")?.count !== 3) {
  throw new Error("Action count did not preserve three distinct events");
}
if (activeDays.subjects.find((subject) => subject.subjectId === "new-0")?.activeDays !== 1) {
  throw new Error("Active days did not use distinct local days");
}

console.log(
  JSON.stringify({
    periodic: {
      numerator: periodic.numerator,
      denominator: periodic.denominator,
      value: periodic.value,
      availability: periodic.availability,
    },
    cohort: {
      numerator: cohort.numerator,
      denominator: cohort.denominator,
      value: cohort.value,
      availability: cohort.availability,
    },
    countBuckets: frequency.buckets,
    activeDayBuckets: activeDays.buckets,
  }),
);
