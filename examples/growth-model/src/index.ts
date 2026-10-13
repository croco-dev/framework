import {
  estimateTransitionMatrix,
  projectGrowthModel,
  backtestGrowthModel,
} from "@croco/metrics-core";
import { request, dataset } from "./fixture";
const data = dataset();
const estimate = estimateTransitionMatrix(request.model, data);
console.log(
  JSON.stringify(
    {
      estimate,
      projection: projectGrowthModel(request.model, estimate.matrix, request.scenario),
      backtest: backtestGrowthModel(request.model, data, request.backtest),
    },
    null,
    2,
  ),
);
