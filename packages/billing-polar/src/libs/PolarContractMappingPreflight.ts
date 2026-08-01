export type PolarContractMappingInput = {
  readonly planVersionRef: string;
  readonly productId: string;
  readonly priceIds: readonly string[];
  readonly meterBindings: readonly { readonly meterId: string }[];
};

export type PolarRemoteProductMapping = {
  readonly priceIds: readonly string[];
  readonly meterIds: readonly string[];
};

export interface PolarContractMappingReader {
  readProduct(productId: string): Promise<PolarRemoteProductMapping>;
}

export type PolarContractMappingDrift = {
  readonly planVersionRef: string;
  readonly productId: string;
  readonly missingPriceIds: readonly string[];
  readonly missingMeterIds: readonly string[];
};

/**
 * Opt-in, read-only provider preflight. Ordinary ContractGraph verification never calls this seam.
 */
export async function inspectPolarContractMappingDrift(
  inputs: readonly PolarContractMappingInput[],
  reader: PolarContractMappingReader,
): Promise<readonly PolarContractMappingDrift[]> {
  const drifts = await Promise.all(
    inputs.map(async (input) => {
      const remote = await reader.readProduct(input.productId);
      const remotePriceIds = new Set(remote.priceIds);
      const remoteMeterIds = new Set(remote.meterIds);
      return {
        planVersionRef: input.planVersionRef,
        productId: input.productId,
        missingPriceIds: [...input.priceIds].filter((id) => !remotePriceIds.has(id)).sort(),
        missingMeterIds: input.meterBindings
          .map(({ meterId }) => meterId)
          .filter((id) => !remoteMeterIds.has(id))
          .sort(),
      };
    }),
  );

  return drifts
    .filter((drift) => drift.missingPriceIds.length > 0 || drift.missingMeterIds.length > 0)
    .sort((left, right) =>
      `${left.planVersionRef}:${left.productId}`.localeCompare(
        `${right.planVersionRef}:${right.productId}`,
      ),
    );
}
