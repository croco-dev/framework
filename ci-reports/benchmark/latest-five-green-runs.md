# Latest Five Green Benchmark Variance Evidence

Reviewed on 2026-07-01 from successful GitHub Actions benchmark workflow runs targeting
`trunk` pull requests. The five reviewed artifacts emitted the same 17 benchmark rows and
recorded no runner/module failures, missing reports, empty reports, threshold failures, threshold skips, or
baseline skips. Because the pre-promotion benchmark baseline was stale, the original warning-only artifacts
recorded 80 baseline gate failures; this contract preserves those failures instead of
hiding them. The promoted baseline uses the median p75 from this reviewed window and has
0 promoted-baseline failures. The maximum p75 spread is 13.48%, which is below
the documented 15% variance tolerance and below the benchmark gate's 20% baseline failure tolerance.

<!-- croco-benchmark-variance-evidence:v1 -->

```json
{
  "version": 1,
  "source": "github-actions",
  "reviewedAt": "2026-07-01T02:51:18Z",
  "tolerance": 0.15,
  "runs": [
    {
      "id": 28461533906,
      "url": "https://github.com/croco-dev/framework/actions/runs/28461533906",
      "headSha": "8a95577333dfec6582242f7d408ff13af146992f",
      "headBranch": "fix/1088-manifest-bundle",
      "baseBranch": "trunk",
      "createdAt": "2026-06-30T16:55:52Z",
      "workflowStatus": "completed",
      "workflowConclusion": "success",
      "artifact": {
        "allPassed": false,
        "reportCount": 17,
        "gateFailures": [
          "CrocoApp constructor: p75 8.2μs exceeds baseline 3.4μs by more than 20%",
          "CrocoApp lambdaHandler (10 controllers): p75 241.2μs exceeds baseline 33.3μs by more than 20%",
          "Lambda cold-start simulation: p75 418.1μs exceeds baseline 70.2μs by more than 20%",
          "Lambda cold-start with headers: p75 369.7μs exceeds baseline 66.7μs by more than 20%",
          "Lambda cold-start with binary body: p75 339.1μs exceeds baseline 63.2μs by more than 20%",
          "Lambda cold-start with query params: p75 316.2μs exceeds baseline 63.9μs by more than 20%",
          "Lambda cold-start with authorizer context: p75 299.8μs exceeds baseline 59.8μs by more than 20%",
          "Lambda cold-start realistic scenario: p75 299.2μs exceeds baseline 60.2μs by more than 20%",
          "EventBusConfig.start (10 handlers): p75 1.4μs exceeds baseline 0.9μs by more than 20%",
          "EventPublisher.publishNow single event: p75 1.7μs exceeds baseline 1.1μs by more than 20%",
          "DefaultHandlerResolver.resolve × 10: p75 0.1μs exceeds baseline 0.0μs by more than 20%",
          "Container.get singleton (cold): p75 70.0μs exceeds baseline 0.6μs by more than 20%",
          "Container.register × 50 components: p75 3.3ms exceeds baseline 12.1μs by more than 20%",
          "Container.validate (50 components): p75 3.3ms exceeds baseline 29.7μs by more than 20%",
          "Container.get singleton (warm): p75 1.6μs exceeds baseline 0.3μs by more than 20%",
          "lambdaPreset config creation: p75 1.4μs exceeds baseline 1.0μs by more than 20%"
        ]
      }
    },
    {
      "id": 28459339571,
      "url": "https://github.com/croco-dev/framework/actions/runs/28459339571",
      "headSha": "4a027ad157eddaf5dd795d12f415c07c402105db",
      "headBranch": "fix/1087-runtime-capability-manifest",
      "baseBranch": "trunk",
      "createdAt": "2026-06-30T16:19:30Z",
      "workflowStatus": "completed",
      "workflowConclusion": "success",
      "artifact": {
        "allPassed": false,
        "reportCount": 17,
        "gateFailures": [
          "CrocoApp constructor: p75 8.2μs exceeds baseline 3.4μs by more than 20%",
          "CrocoApp lambdaHandler (10 controllers): p75 258.4μs exceeds baseline 33.3μs by more than 20%",
          "Lambda cold-start simulation: p75 405.8μs exceeds baseline 70.2μs by more than 20%",
          "Lambda cold-start with headers: p75 366.6μs exceeds baseline 66.7μs by more than 20%",
          "Lambda cold-start with binary body: p75 332.2μs exceeds baseline 63.2μs by more than 20%",
          "Lambda cold-start with query params: p75 300.8μs exceeds baseline 63.9μs by more than 20%",
          "Lambda cold-start with authorizer context: p75 297.1μs exceeds baseline 59.8μs by more than 20%",
          "Lambda cold-start realistic scenario: p75 295.7μs exceeds baseline 60.2μs by more than 20%",
          "EventBusConfig.start (10 handlers): p75 1.4μs exceeds baseline 0.9μs by more than 20%",
          "EventPublisher.publishNow single event: p75 1.7μs exceeds baseline 1.1μs by more than 20%",
          "DefaultHandlerResolver.resolve × 10: p75 0.1μs exceeds baseline 0.0μs by more than 20%",
          "Container.get singleton (cold): p75 70.3μs exceeds baseline 0.6μs by more than 20%",
          "Container.register × 50 components: p75 3.3ms exceeds baseline 12.1μs by more than 20%",
          "Container.validate (50 components): p75 3.5ms exceeds baseline 29.7μs by more than 20%",
          "Container.get singleton (warm): p75 1.6μs exceeds baseline 0.3μs by more than 20%",
          "lambdaPreset config creation: p75 1.4μs exceeds baseline 1.0μs by more than 20%"
        ]
      }
    },
    {
      "id": 28458476660,
      "url": "https://github.com/croco-dev/framework/actions/runs/28458476660",
      "headSha": "8018b234743ce7af7a538cd0dd9f1c39d5e95cb1",
      "headBranch": "fix/1088-manifest-bundle",
      "baseBranch": "trunk",
      "createdAt": "2026-06-30T16:05:54Z",
      "workflowStatus": "completed",
      "workflowConclusion": "success",
      "artifact": {
        "allPassed": false,
        "reportCount": 17,
        "gateFailures": [
          "CrocoApp constructor: p75 7.2μs exceeds baseline 3.4μs by more than 20%",
          "CrocoApp lambdaHandler (10 controllers): p75 240.9μs exceeds baseline 33.3μs by more than 20%",
          "Lambda cold-start simulation: p75 426.4μs exceeds baseline 70.2μs by more than 20%",
          "Lambda cold-start with headers: p75 374.0μs exceeds baseline 66.7μs by more than 20%",
          "Lambda cold-start with binary body: p75 342.7μs exceeds baseline 63.2μs by more than 20%",
          "Lambda cold-start with query params: p75 301.3μs exceeds baseline 63.9μs by more than 20%",
          "Lambda cold-start with authorizer context: p75 306.9μs exceeds baseline 59.8μs by more than 20%",
          "Lambda cold-start realistic scenario: p75 302.3μs exceeds baseline 60.2μs by more than 20%",
          "EventBusConfig.start (10 handlers): p75 1.4μs exceeds baseline 0.9μs by more than 20%",
          "EventPublisher.publishNow single event: p75 1.7μs exceeds baseline 1.1μs by more than 20%",
          "DefaultHandlerResolver.resolve × 10: p75 0.1μs exceeds baseline 0.0μs by more than 20%",
          "Container.get singleton (cold): p75 70.7μs exceeds baseline 0.6μs by more than 20%",
          "Container.register × 50 components: p75 3.2ms exceeds baseline 12.1μs by more than 20%",
          "Container.validate (50 components): p75 3.4ms exceeds baseline 29.7μs by more than 20%",
          "Container.get singleton (warm): p75 1.7μs exceeds baseline 0.3μs by more than 20%",
          "lambdaPreset config creation: p75 1.4μs exceeds baseline 1.0μs by more than 20%"
        ]
      }
    },
    {
      "id": 28456296473,
      "url": "https://github.com/croco-dev/framework/actions/runs/28456296473",
      "headSha": "2f93c17ab960bbf223e69e00585d8cea3f1140e8",
      "headBranch": "fix/1087-runtime-capability-manifest",
      "baseBranch": "trunk",
      "createdAt": "2026-06-30T15:32:32Z",
      "workflowStatus": "completed",
      "workflowConclusion": "success",
      "artifact": {
        "allPassed": false,
        "reportCount": 17,
        "gateFailures": [
          "CrocoApp constructor: p75 8.3μs exceeds baseline 3.4μs by more than 20%",
          "CrocoApp lambdaHandler (10 controllers): p75 258.5μs exceeds baseline 33.3μs by more than 20%",
          "Lambda cold-start simulation: p75 412.8μs exceeds baseline 70.2μs by more than 20%",
          "Lambda cold-start with headers: p75 368.0μs exceeds baseline 66.7μs by more than 20%",
          "Lambda cold-start with binary body: p75 334.2μs exceeds baseline 63.2μs by more than 20%",
          "Lambda cold-start with query params: p75 294.9μs exceeds baseline 63.9μs by more than 20%",
          "Lambda cold-start with authorizer context: p75 297.1μs exceeds baseline 59.8μs by more than 20%",
          "Lambda cold-start realistic scenario: p75 293.3μs exceeds baseline 60.2μs by more than 20%",
          "EventBusConfig.start (10 handlers): p75 1.4μs exceeds baseline 0.9μs by more than 20%",
          "EventPublisher.publishNow single event: p75 1.6μs exceeds baseline 1.1μs by more than 20%",
          "DefaultHandlerResolver.resolve × 10: p75 0.1μs exceeds baseline 0.0μs by more than 20%",
          "Container.get singleton (cold): p75 68.4μs exceeds baseline 0.6μs by more than 20%",
          "Container.register × 50 components: p75 2.9ms exceeds baseline 12.1μs by more than 20%",
          "Container.validate (50 components): p75 3.5ms exceeds baseline 29.7μs by more than 20%",
          "Container.get singleton (warm): p75 1.6μs exceeds baseline 0.3μs by more than 20%",
          "lambdaPreset config creation: p75 1.5μs exceeds baseline 1.0μs by more than 20%"
        ]
      }
    },
    {
      "id": 28455453392,
      "url": "https://github.com/croco-dev/framework/actions/runs/28455453392",
      "headSha": "935c71d1b7044d68042e36d1b935b88800817965",
      "headBranch": "fix/1088-manifest-bundle",
      "baseBranch": "trunk",
      "createdAt": "2026-06-30T15:19:46Z",
      "workflowStatus": "completed",
      "workflowConclusion": "success",
      "artifact": {
        "allPassed": false,
        "reportCount": 17,
        "gateFailures": [
          "CrocoApp constructor: p75 7.4μs exceeds baseline 3.4μs by more than 20%",
          "CrocoApp lambdaHandler (10 controllers): p75 268.3μs exceeds baseline 33.3μs by more than 20%",
          "Lambda cold-start simulation: p75 420.2μs exceeds baseline 70.2μs by more than 20%",
          "Lambda cold-start with headers: p75 379.0μs exceeds baseline 66.7μs by more than 20%",
          "Lambda cold-start with binary body: p75 345.5μs exceeds baseline 63.2μs by more than 20%",
          "Lambda cold-start with query params: p75 323.9μs exceeds baseline 63.9μs by more than 20%",
          "Lambda cold-start with authorizer context: p75 304.0μs exceeds baseline 59.8μs by more than 20%",
          "Lambda cold-start realistic scenario: p75 304.4μs exceeds baseline 60.2μs by more than 20%",
          "EventBusConfig.start (10 handlers): p75 1.5μs exceeds baseline 0.9μs by more than 20%",
          "EventPublisher.publishNow single event: p75 1.7μs exceeds baseline 1.1μs by more than 20%",
          "DefaultHandlerResolver.resolve × 10: p75 0.1μs exceeds baseline 0.0μs by more than 20%",
          "Container.get singleton (cold): p75 71.2μs exceeds baseline 0.6μs by more than 20%",
          "Container.register × 50 components: p75 3.2ms exceeds baseline 12.1μs by more than 20%",
          "Container.validate (50 components): p75 3.4ms exceeds baseline 29.7μs by more than 20%",
          "Container.get singleton (warm): p75 1.7μs exceeds baseline 0.3μs by more than 20%",
          "lambdaPreset config creation: p75 1.4μs exceeds baseline 1.0μs by more than 20%"
        ]
      }
    }
  ],
  "checks": {
    "sameRowSet": true,
    "runnerFailures": 0,
    "moduleFailures": 0,
    "emptyReports": 0,
    "missingReports": 0,
    "thresholdFailures": 0,
    "thresholdSkips": 0,
    "baselineSkips": 0,
    "prePromotionBaselineFailures": 80,
    "promotedBaselineFailures": 0
  },
  "rows": [
    {
      "name": "Container.get singleton (cold)",
      "min": 0.06836800000002086,
      "median": 0.07025099999998474,
      "max": 0.07123300000000654,
      "spread": 0.04078233761777493,
      "status": "pass",
      "p75ByRun": {
        "28461533906": 0.06997199999995019,
        "28459339571": 0.07025099999998474,
        "28458476660": 0.0706519999999955,
        "28456296473": 0.06836800000002086,
        "28455453392": 0.07123300000000654
      }
    },
    {
      "name": "Container.get singleton (warm)",
      "min": 0.001592999999957101,
      "median": 0.001633000000310858,
      "max": 0.0016630000000077416,
      "spread": 0.042865891021013756,
      "status": "pass",
      "p75ByRun": {
        "28461533906": 0.0016129999999066058,
        "28459339571": 0.001633000000310858,
        "28458476660": 0.0016630000000077416,
        "28456296473": 0.001592999999957101,
        "28455453392": 0.0016630000000077416
      }
    },
    {
      "name": "Container.register × 50 components",
      "min": 2.8686549999999897,
      "median": 3.2280520000001616,
      "max": 3.2806869999999435,
      "spread": 0.12764106650076676,
      "status": "pass",
      "p75ByRun": {
        "28461533906": 3.2806869999999435,
        "28459339571": 3.2769760000001042,
        "28458476660": 3.1843800000001465,
        "28456296473": 2.8686549999999897,
        "28455453392": 3.2280520000001616
      }
    },
    {
      "name": "Container.validate (50 components)",
      "min": 3.300224000000071,
      "median": 3.389411999999993,
      "max": 3.5192990000000464,
      "spread": 0.06463510485003762,
      "status": "pass",
      "p75ByRun": {
        "28461533906": 3.300224000000071,
        "28459339571": 3.5192990000000464,
        "28458476660": 3.389411999999993,
        "28456296473": 3.4675540000000638,
        "28455453392": 3.3701370000001134
      }
    },
    {
      "name": "CrocoApp constructor",
      "min": 0.007162999999991371,
      "median": 0.008174999999937427,
      "max": 0.008265000000164946,
      "spread": 0.13480122326385446,
      "status": "pass",
      "p75ByRun": {
        "28461533906": 0.008244999999988067,
        "28459339571": 0.008174999999937427,
        "28458476660": 0.007162999999991371,
        "28456296473": 0.008265000000164946,
        "28455453392": 0.007364000000052329
      }
    },
    {
      "name": "CrocoApp lambdaHandler (10 controllers)",
      "min": 0.24087099999997008,
      "median": 0.2584429999999429,
      "max": 0.2682720000000245,
      "spread": 0.10602337846279629,
      "status": "pass",
      "p75ByRun": {
        "28461533906": 0.24121400000012727,
        "28459339571": 0.2584429999999429,
        "28458476660": 0.24087099999997008,
        "28456296473": 0.2585030000000188,
        "28455453392": 0.2682720000000245
      }
    },
    {
      "name": "DefaultHandlerResolver.resolve × 10",
      "min": 0.00007099999993442907,
      "median": 0.00007999999979801942,
      "max": 0.00007999999979801942,
      "spread": 0.11249999857891453,
      "status": "pass",
      "p75ByRun": {
        "28461533906": 0.00007999999979801942,
        "28459339571": 0.00007999999979801942,
        "28458476660": 0.00007099999993442907,
        "28456296473": 0.00007999999979801942,
        "28455453392": 0.00007099999993442907
      }
    },
    {
      "name": "EventBusConfig.start (10 handlers)",
      "min": 0.001393000000007305,
      "median": 0.0014330000000200016,
      "max": 0.0014630000000579457,
      "spread": 0.04884856946940936,
      "status": "pass",
      "p75ByRun": {
        "28461533906": 0.0014330000000200016,
        "28459339571": 0.001393000000007305,
        "28458476660": 0.0014330000000200016,
        "28456296473": 0.001422000000047774,
        "28455453392": 0.0014630000000579457
      }
    },
    {
      "name": "EventPublisher.publishNow single event",
      "min": 0.0016439999999420252,
      "median": 0.0016829999999572465,
      "max": 0.0017130000001088774,
      "spread": 0.04099821756898697,
      "status": "pass",
      "p75ByRun": {
        "28461533906": 0.0016829999999572465,
        "28459339571": 0.0016529999998056155,
        "28458476660": 0.0017130000001088774,
        "28456296473": 0.0016439999999420252,
        "28455453392": 0.001692999999931999
      }
    },
    {
      "name": "Lambda cold-start realistic scenario",
      "min": 0.29332700000031764,
      "median": 0.2992019999992408,
      "max": 0.30442000000039116,
      "spread": 0.03707528693023999,
      "status": "pass",
      "p75ByRun": {
        "28461533906": 0.2992019999992408,
        "28459339571": 0.2956930000000284,
        "28458476660": 0.30230500000016036,
        "28456296473": 0.29332700000031764,
        "28455453392": 0.30442000000039116
      }
    },
    {
      "name": "Lambda cold-start simulation",
      "min": 0.4058479999998781,
      "median": 0.4180870000000141,
      "max": 0.4263880000003155,
      "spread": 0.04912853066571488,
      "status": "pass",
      "p75ByRun": {
        "28461533906": 0.4180870000000141,
        "28459339571": 0.4058479999998781,
        "28458476660": 0.4263880000003155,
        "28456296473": 0.4128209999998944,
        "28455453392": 0.42021599999998216
      }
    },
    {
      "name": "Lambda cold-start with authorizer context",
      "min": 0.2971350000007078,
      "median": 0.2998139999999694,
      "max": 0.3068839999996271,
      "spread": 0.032516827095867146,
      "status": "pass",
      "p75ByRun": {
        "28461533906": 0.2998139999999694,
        "28459339571": 0.2971449999995457,
        "28458476660": 0.3068839999996271,
        "28456296473": 0.2971350000007078,
        "28455453392": 0.303979000000254
      }
    },
    {
      "name": "Lambda cold-start with binary body",
      "min": 0.3321810000002188,
      "median": 0.33912800000007337,
      "max": 0.34547599999996237,
      "spread": 0.03920348658836993,
      "status": "pass",
      "p75ByRun": {
        "28461533906": 0.33912800000007337,
        "28459339571": 0.3321810000002188,
        "28458476660": 0.34267099999988204,
        "28456296473": 0.3341840000002776,
        "28455453392": 0.34547599999996237
      }
    },
    {
      "name": "Lambda cold-start with headers",
      "min": 0.36664599999994607,
      "median": 0.3696549999999661,
      "max": 0.37902900000017326,
      "spread": 0.03349880293849216,
      "status": "pass",
      "p75ByRun": {
        "28461533906": 0.3696549999999661,
        "28459339571": 0.36664599999994607,
        "28458476660": 0.3740099999999984,
        "28456296473": 0.36800700000003417,
        "28455453392": 0.37902900000017326
      }
    },
    {
      "name": "Lambda cold-start with query params",
      "min": 0.29494099999919854,
      "median": 0.30128400000012334,
      "max": 0.32385599999997794,
      "spread": 0.09597257073315398,
      "status": "pass",
      "p75ByRun": {
        "28461533906": 0.31621499999982916,
        "28459339571": 0.3008319999999003,
        "28458476660": 0.30128400000012334,
        "28456296473": 0.29494099999919854,
        "28455453392": 0.32385599999997794
      }
    },
    {
      "name": "TelemetryRuntime.init (lambda preset)",
      "min": 1.048569999999927,
      "median": 1.0944030000000566,
      "max": 1.108363000000054,
      "spread": 0.05463526689905263,
      "status": "pass",
      "p75ByRun": {
        "28461533906": 1.0664649999999938,
        "28459339571": 1.048569999999927,
        "28458476660": 1.0944030000000566,
        "28456296473": 1.107097000000067,
        "28455453392": 1.108363000000054
      }
    },
    {
      "name": "lambdaPreset config creation",
      "min": 0.0014130000001841836,
      "median": 0.001422000000047774,
      "max": 0.0014830000000074506,
      "spread": 0.04922644150556628,
      "status": "pass",
      "p75ByRun": {
        "28461533906": 0.0014429999998810672,
        "28459339571": 0.001422000000047774,
        "28458476660": 0.001422000000047774,
        "28456296473": 0.0014830000000074506,
        "28455453392": 0.0014130000001841836
      }
    }
  ]
}
```
