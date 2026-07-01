import type { CrocoDataFn } from "@croco/frontend-react";

type HomePageData = {
  readonly message: string;
};

export const data: CrocoDataFn<HomePageData> = async ({ urlOriginal }) => {
  const response = await fetch(new URL("/api/hello", urlOriginal));
  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return response.json() as Promise<HomePageData>;
};
